import { Music } from "lucide-react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getPresignedUrl } from "~/actions/generation";
import { SongCard } from "~/components/home/song-card";
import { auth } from "~/lib/auth";
import { db } from "~/server/db";

export default async function Page() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/auth/sign-in");

  const songs = await db.song.findMany({
    where: { published: true },
    include: {
      user: { select: { name: true } },
      _count: { select: { likes: true } },
      categories: true,
      likes: session.user.id
        ? { where: { userId: session.user.id } }
        : false,
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const songsWithUrls = await Promise.all(
    songs.map(async (song) => {
      const thumbnailUrl = song.thumbnailS3Key
        ? await getPresignedUrl(song.thumbnailS3Key)
        : null;
      return { ...song, thumbnailUrl };
    }),
  );

  const twoDaysAgo = new Date();
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

  const trendingSongs = songsWithUrls
    .filter((song) => song.createdAt >= twoDaysAgo)
    .slice(0, 12);

  const trendingSongIds = new Set(trendingSongs.map((song) => song.id));

  const categorizedSongs = songsWithUrls
    .filter(
      (song) => !trendingSongIds.has(song.id) && song.categories.length > 0,
    )
    .reduce(
      (acc, song) => {
        const primaryCategory = song.categories[0];
        if (primaryCategory) {
          acc[primaryCategory.name] ??= [];
          if (acc[primaryCategory.name]!.length < 12) {
            acc[primaryCategory.name]!.push(song);
          }
        }
        return acc;
      },
      {} as Record<string, Array<(typeof songsWithUrls)[number]>>,
    );

  const isEmpty =
    trendingSongs.length === 0 && Object.keys(categorizedSongs).length === 0;

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  return (
    <div className="mx-auto w-full max-w-[1280px] px-6 pt-10 pb-32 md:px-10">
      <header className="mb-12">
        <p className="text-eyebrow">{today}</p>
        <h1 className="text-display mt-2 max-w-2xl">
          New <em>arrivals,</em> fresh from the studio.
        </h1>
        <p className="text-muted-foreground mt-3 max-w-xl text-[13px] leading-relaxed">
          A handful of new tracks made by the aria community in the last 48 hours.
          Click anything to listen.
        </p>
      </header>

      {isEmpty ? (
        <EmptyState />
      ) : (
        <>
          {trendingSongs.length > 0 && (
            <Section title="Trending now" meta="past 48 hours">
              <SongGrid songs={trendingSongs} />
            </Section>
          )}

          {Object.entries(categorizedSongs)
            .slice(0, 5)
            .map(([category, songs]) => (
              <Section
                key={category}
                title={category}
                meta={`${songs.length} ${songs.length === 1 ? "track" : "tracks"}`}
              >
                <SongGrid songs={songs} />
              </Section>
            ))}
        </>
      )}
    </div>
  );
}

function Section({
  title,
  meta,
  children,
}: {
  title: string;
  meta: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-10 first:mt-0">
      <div className="section-head">
        <h2 className="text-section">{title}</h2>
        <span className="text-meta">{meta}</span>
      </div>
      {children}
    </section>
  );
}

type SongGridProps = {
  songs: Array<React.ComponentProps<typeof SongCard>["song"]>;
};

function SongGrid({ songs }: SongGridProps) {
  return (
    <div className="grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {songs.map((song) => (
        <SongCard key={song.id} song={song} />
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="border-border/60 mt-12 flex flex-col items-center rounded-md border border-dashed py-24 text-center">
      <Music
        className="text-muted-foreground/40 size-10"
        strokeWidth={1.25}
      />
      <p className="text-section mt-5">Quiet on the wire.</p>
      <p className="text-muted-foreground mt-2 max-w-sm text-[13px]">
        No published tracks yet. Be the first &mdash; make a song in the Studio
        and toggle &ldquo;publish&rdquo; when it&rsquo;s ready.
      </p>
    </div>
  );
}
