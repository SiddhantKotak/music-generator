"use client";

import type { Category, Like, Song } from "@prisma/client";
import { Heart, Music, Play } from "lucide-react";
import { useState } from "react";
import { getPlayUrl } from "~/actions/generation";
import { toggleLikeSong } from "~/actions/song";
import { usePlayerStore } from "~/stores/use-player-store";

type SongWithRelation = Song & {
  user: { name: string | null };
  _count: { likes: number };
  categories: Category[];
  thumbnailUrl?: string | null;
  likes?: Like[];
};

export function SongCard({ song }: { song: SongWithRelation }) {
  const [isLoading, setIsLoading] = useState(false);
  const setTrack = usePlayerStore((s) => s.setTrack);
  const [isLiked, setIsLiked] = useState(
    song.likes ? song.likes.length > 0 : false,
  );
  const [likesCount, setLikesCount] = useState(song._count.likes);

  const handlePlay = async () => {
    setIsLoading(true);
    try {
      const playUrl = await getPlayUrl(song.id);
      setTrack({
        id: song.id,
        title: song.title,
        url: playUrl,
        artwork: song.thumbnailUrl,
        prompt: song.prompt,
        createdByUserName: song.user.name,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleLike = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsLiked(!isLiked);
    setLikesCount(isLiked ? likesCount - 1 : likesCount + 1);
    await toggleLikeSong(song.id);
  };

  const primary = song.categories[0]?.name ?? "untitled";
  const secondary = song.categories[1]?.name;
  const meta = secondary ? `${primary} · ${secondary}` : primary;

  return (
    <div className="group flex flex-col gap-2.5">
      <button
        type="button"
        onClick={handlePlay}
        className="bg-secondary focus-visible:ring-ring focus-visible:ring-offset-background relative aspect-square w-full overflow-hidden rounded-md focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
        aria-label={`Play ${song.title}`}
      >
        {song.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={song.thumbnailUrl}
            alt=""
            className="h-full w-full object-cover transition-opacity duration-300 group-hover:opacity-85"
          />
        ) : (
          <div className="text-muted-foreground/40 flex h-full w-full items-center justify-center">
            <Music className="size-8" strokeWidth={1.5} />
          </div>
        )}
        <div className="absolute inset-0 flex items-end justify-end p-2.5 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
          <span className="bg-brand text-brand-foreground flex size-9 items-center justify-center rounded-full shadow-lg">
            {isLoading ? (
              <span className="border-brand-foreground/40 border-t-brand-foreground size-3 animate-spin rounded-full border-[1.5px]" />
            ) : (
              <Play
                className="size-3.5 translate-x-px"
                fill="currentColor"
                strokeWidth={0}
              />
            )}
          </span>
        </div>
      </button>

      <div className="space-y-0.5">
        <p className="text-meta-brand truncate">{meta}</p>
        <h3 className="text-song text-foreground truncate">{song.title}</h3>
        <div className="flex items-center justify-between pt-0.5">
          <p className="text-muted-foreground truncate text-[11px]">
            {song.user.name ?? "anon"}
          </p>
          <button
            onClick={handleLike}
            className="text-muted-foreground hover:text-foreground inline-flex shrink-0 items-center gap-1 text-[11px] transition-colors"
            aria-label={isLiked ? "Unlike" : "Like"}
          >
            <Heart
              className={[
                "size-3 transition-colors",
                isLiked ? "fill-brand text-brand" : "",
              ].join(" ")}
              strokeWidth={1.75}
            />
            <span className="tabular">{likesCount}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
