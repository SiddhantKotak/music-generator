import { db } from "~/server/db";
import { inngest } from "./client";
import { env } from "~/env";

export const generateSong = inngest.createFunction(
  {
    id: "generate-song",
    concurrency: {
      limit: 1,
      key: "event.data.userId",
    },
    onFailure: async ({ event, error }) => {
      console.error("Song generation failed:", error);
      try {
        const eventData = event?.data?.event?.data as { songId: string };
        if (eventData?.songId) {
          await db.song.update({
            where: {
              id: eventData.songId,
            },
            data: {
              status: "failed",
            },
          });
        }
      } catch (e) {
        console.error("Failed to update song status to failed:", e);
      }
    },
  },
  { event: "generate-song-event" },
  async ({ event, step }) => {
    const { songId } = event.data as {
      songId: string;
      userId: string;
    };

    const { userId, credits, endpoint, body } = await step.run(
      "check-credits",
      async () => {
        const song = await db.song.findUniqueOrThrow({
          where: {
            id: songId,
          },
          select: {
            user: {
              select: {
                id: true,
                credits: true,
              },
            },
            prompt: true,
            lyrics: true,
            fullDescribedSong: true,
            describedLyrics: true,
            instrumental: true,
            guidanceScale: true,
            inferStep: true,
            audioDuration: true,
            seed: true,
          },
        });

        type RequestBody = {
          guidance_scale?: number;
          infer_step?: number;
          audio_duration?: number;
          seed?: number;
          full_described_song?: string;
          prompt?: string;
          lyrics?: string;
          described_lyrics?: string;
          instrumental?: boolean;
        };

        let endpoint = "";
        let body: RequestBody = {};

        const commonParams = {
          guidance_scale: song.guidanceScale ?? undefined,
          infer_step: song.inferStep ?? undefined,
          audio_duration: song.audioDuration ?? undefined,
          seed: song.seed ?? undefined,
          instrumental: song.instrumental ?? undefined,
        };

        // Description of a song
        if (song.fullDescribedSong) {
          endpoint = env.GENERATE_FROM_DESCRIPTION;
          body = {
            full_described_song: song.fullDescribedSong,
            ...commonParams,
          };
        }
        // Custom mode: Lyrics + prompt
        else if (song.lyrics && song.prompt) {
          endpoint = env.GENERATE_WITH_LYRICS;
          body = {
            lyrics: song.lyrics,
            prompt: song.prompt,
            ...commonParams,
          };
        }
        // Custom mode: Prompt + described lyrics
        else if (song.describedLyrics && song.prompt) {
          endpoint = env.GENERATE_FROM_DESCRIBED_LYRICS;
          body = {
            described_lyrics: song.describedLyrics,
            prompt: song.prompt,
            ...commonParams,
          };
        }

        return {
          userId: song.user.id,
          credits: song.user.credits,
          endpoint: endpoint,
          body: body,
        };
      },
    );

    if (credits > 0) {
      // Generate the song
      await step.run("set-status-processing", async () => {
        return await db.song.update({
          where: {
            id: songId,
          },
          data: {
            status: "processing",
          },
        });
      });

      // Call Modal API with proper error handling and timeout
      const modalResponse = await step.run("call-modal-api", async () => {
        console.log("Starting Modal API call");
        console.log("Endpoint:", endpoint);
        console.log("Request body:", JSON.stringify(body, null, 2));
        
        // Validate endpoint exists
        if (!endpoint) {
          console.error("No endpoint provided");
          throw new Error("No endpoint configured for this generation type");
        }

        // Create abort controller for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
          console.log("Request timeout - aborting fetch after 5 minutes");
          controller.abort();
        }, 300000); // 5 minute timeout

        try {
          console.log("Making fetch request to Modal...");
          const response = await fetch(endpoint, {
            method: "POST",
            body: JSON.stringify(body),
            headers: {
              "Content-Type": "application/json",
            },
            signal: controller.signal,
          });

          clearTimeout(timeoutId);
          console.log("Modal response received");
          console.log("Modal response status:", response.status);

          if (!response.ok) {
            const errorText = await response.text();
            console.error("Modal API error response:", errorText);
            throw new Error(`Modal API failed with status ${response.status}: ${errorText}`);
          }

          // Get response JSON directly
          const responseData = await response.json();
          console.log("Modal API response:", JSON.stringify(responseData, null, 2));

          // Validate that we got the expected structure
          if (!responseData.s3_key) {
            console.error("Modal response missing s3_key:", responseData);
            throw new Error("Modal response missing required s3_key field");
          }

          console.log("Modal API call successful!");
          return responseData;

        } catch (error) {
          clearTimeout(timeoutId);
          
          if (error.name === 'AbortError') {
            console.error("Request timed out after 5 minutes");
            throw new Error("Request timed out - Modal API took too long to respond");
          }
          
          console.error("Error calling Modal:", error);
          throw error;
        }
      });

      await step.run("update-song-result", async () => {
        console.log("Updating song with Modal response:", {
          s3Key: modalResponse?.s3_key,
          thumbnailS3Key: modalResponse?.cover_image_s3_key,
          categories: modalResponse?.categories,
        });

        await db.song.update({
          where: {
            id: songId,
          },
          data: {
            s3Key: modalResponse?.s3_key ?? null,
            thumbnailS3Key: modalResponse?.cover_image_s3_key ?? null,
            status: "processed",
          },
        });

        if (modalResponse?.categories && modalResponse.categories.length > 0) {
          console.log("Adding categories:", modalResponse.categories);
          await db.song.update({
            where: { id: songId },
            data: {
              categories: {
                connectOrCreate: modalResponse.categories.map(
                  (categoryName: string) => ({
                    where: { name: categoryName },
                    create: { name: categoryName },
                  }),
                ),
              },
            },
          });
        }
      });

      return await step.run("deduct-credits", async () => {
        console.log("Deducting 1 credit from user:", userId);
        return await db.user.update({
          where: { id: userId },
          data: {
            credits: {
              decrement: 1,
            },
          },
        });
      });
    } else {
      // Set song status "not enough credits"
      await step.run("set-status-no-credits", async () => {
        console.log("User has insufficient credits:", credits);
        return await db.song.update({
          where: {
            id: songId,
          },
          data: {
            status: "no credits",
          },
        });
      });
    }
  },
);