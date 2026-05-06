import { db } from "~/server/db";
import { inngest } from "./client";
import { env } from "~/env";

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

type SpawnResponse = { call_id: string };

type ModalResult = {
  s3_key: string;
  cover_image_s3_key: string;
  categories: string[];
};

type StatusResponse =
  | { status: "running" }
  | { status: "done"; result: ModalResult }
  | { status: "failed"; error?: string }
  | { status: "expired" };

const POLL_MAX_ATTEMPTS = 30;
const POLL_INTERVAL = "20s";

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
            where: { id: eventData.songId },
            data: { status: "failed" },
          });
        }
      } catch (e) {
        console.error("Failed to update song status to failed:", e);
      }
    },
  },
  { event: "generate-song-event" },
  async ({ event, step }) => {
    const { songId } = event.data as { songId: string; userId: string };

    const { userId, credits, endpoint, body } = await step.run(
      "check-credits",
      async () => {
        const song = await db.song.findUniqueOrThrow({
          where: { id: songId },
          select: {
            user: { select: { id: true, credits: true } },
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

        let endpoint = "";
        let body: RequestBody = {};

        const commonParams = {
          guidance_scale: song.guidanceScale ?? undefined,
          infer_step: song.inferStep ?? undefined,
          audio_duration: song.audioDuration ?? undefined,
          seed: song.seed ?? undefined,
          instrumental: song.instrumental ?? undefined,
        };

        if (song.fullDescribedSong) {
          endpoint = env.GENERATE_FROM_DESCRIPTION;
          body = { full_described_song: song.fullDescribedSong, ...commonParams };
        } else if (song.lyrics && song.prompt) {
          endpoint = env.GENERATE_WITH_LYRICS;
          body = { lyrics: song.lyrics, prompt: song.prompt, ...commonParams };
        } else if (song.describedLyrics && song.prompt) {
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
          endpoint,
          body,
        };
      },
    );

    if (credits <= 0) {
      await step.run("set-status-no-credits", async () => {
        return await db.song.update({
          where: { id: songId },
          data: { status: "no credits" },
        });
      });
      return;
    }

    if (!endpoint) {
      throw new Error("No endpoint configured for this generation type");
    }

    await step.run("set-status-processing", async () => {
      return await db.song.update({
        where: { id: songId },
        data: { status: "processing" },
      });
    });

    // 1) Spawn the Modal job — fast, well within Vercel's 60 s function cap.
    const callId = await step.run("spawn-modal-job", async () => {
      const response = await fetch(endpoint, {
        method: "POST",
        body: JSON.stringify(body),
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Modal spawn failed with status ${response.status}: ${errorText}`,
        );
      }
      const spawn = (await response.json()) as SpawnResponse;
      if (!spawn.call_id) {
        throw new Error("Modal spawn response missing call_id");
      }
      return spawn.call_id;
    });

    // 2) Poll for completion. Each step.run is a fresh, short-lived invocation.
    let result: ModalResult | null = null;
    for (let attempt = 0; attempt < POLL_MAX_ATTEMPTS; attempt++) {
      await step.sleep(`poll-wait-${attempt}`, POLL_INTERVAL);
      const status = await step.run(`poll-${attempt}`, async () => {
        const url = `${env.MODAL_STATUS_URL}?call_id=${encodeURIComponent(callId)}`;
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Status check failed: ${response.status}`);
        }
        return (await response.json()) as StatusResponse;
      });

      if (status.status === "done") {
        result = status.result;
        break;
      }
      if (status.status === "failed" || status.status === "expired") {
        throw new Error(
          `Modal job ${status.status}` +
            ("error" in status && status.error ? `: ${status.error}` : ""),
        );
      }
      // status === "running": loop again
    }

    if (!result) {
      throw new Error(
        `Modal job did not complete in ${POLL_MAX_ATTEMPTS} polls (~${POLL_MAX_ATTEMPTS * 20}s)`,
      );
    }

    const modalResult = result;

    await step.run("update-song-result", async () => {
      await db.song.update({
        where: { id: songId },
        data: {
          s3Key: modalResult.s3_key,
          thumbnailS3Key: modalResult.cover_image_s3_key,
          status: "processed",
        },
      });

      if (modalResult.categories && modalResult.categories.length > 0) {
        await db.song.update({
          where: { id: songId },
          data: {
            categories: {
              connectOrCreate: modalResult.categories.map((name) => ({
                where: { name },
                create: { name },
              })),
            },
          },
        });
      }
    });

    return await step.run("deduct-credits", async () => {
      return await db.user.update({
        where: { id: userId },
        data: { credits: { decrement: 1 } },
      });
    });
  },
);
