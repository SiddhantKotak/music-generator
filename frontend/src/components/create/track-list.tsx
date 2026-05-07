"use client";

import {
  Download,
  MoreHorizontal,
  Music,
  Pencil,
  Play,
  RefreshCcw,
  Search,
  XCircle,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { getPlayUrl } from "~/actions/generation";
import { renameSong, setPublishedStatus } from "~/actions/song";
import { usePlayerStore } from "~/stores/use-player-store";
import { Input } from "../ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { RenameDialog } from "./rename-dialog";

export interface Track {
  id: string;
  title: string | null;
  createdAt: Date;
  instrumental: boolean;
  prompt: string | null;
  lyrics: string | null;
  describedLyrics: string | null;
  fullDescribedSong: string | null;
  thumbnailUrl: string | null;
  playUrl: string | null;
  status: string | null;
  createdByUserName: string | null;
  published: boolean;
}

export function TrackList({ tracks }: { tracks: Track[] }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadingTrackId, setLoadingTrackId] = useState<string | null>(null);
  const [trackToRename, setTrackToRename] = useState<Track | null>(null);
  const router = useRouter();
  const setTrack = usePlayerStore((state) => state.setTrack);

  const handleTrackSelect = async (track: Track) => {
    if (loadingTrackId) return;
    setLoadingTrackId(track.id);
    try {
      const playUrl = await getPlayUrl(track.id);
      setTrack({
        id: track.id,
        title: track.title,
        url: playUrl,
        artwork: track.thumbnailUrl,
        prompt: track.prompt,
        createdByUserName: track.createdByUserName,
      });
    } finally {
      setLoadingTrackId(null);
    }
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    router.refresh();
    setTimeout(() => setIsRefreshing(false), 700);
  };

  const filteredTracks = tracks.filter((t) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      t.title?.toLowerCase().includes(q) ?? t.prompt?.toLowerCase().includes(q)
    );
  });

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="px-7 py-7">
        {/* Header */}
        <div className="section-head">
          <div>
            <p className="text-eyebrow">Your sessions</p>
            <h2 className="text-section mt-1">Tonight&rsquo;s takes</h2>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative w-[220px]">
              <Search className="text-muted-foreground absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search your songs"
                className="h-8 pl-8 text-[12px]"
              />
            </div>
            <button
              type="button"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="border-border/60 text-muted-foreground hover:text-foreground hover:bg-secondary/40 flex size-8 items-center justify-center rounded-md border transition-colors disabled:opacity-50"
              aria-label="Refresh"
            >
              <RefreshCcw
                className={`size-3.5 ${isRefreshing ? "animate-spin" : ""}`}
                strokeWidth={1.75}
              />
            </button>
          </div>
        </div>

        {/* Tracks */}
        <div className="flex flex-col">
          {filteredTracks.length > 0 ? (
            filteredTracks.map((track) => (
              <TrackRow
                key={track.id}
                track={track}
                isLoading={loadingTrackId === track.id}
                onSelect={() => handleTrackSelect(track)}
                onTogglePublish={async () =>
                  setPublishedStatus(track.id, !track.published)
                }
                onDownload={async () => {
                  const playUrl = await getPlayUrl(track.id);
                  window.open(playUrl, "_blank");
                }}
                onRename={() => setTrackToRename(track)}
              />
            ))
          ) : (
            <EmptyState hasQuery={Boolean(searchQuery)} />
          )}
        </div>
      </div>

      {trackToRename && (
        <RenameDialog
          track={trackToRename}
          onClose={() => setTrackToRename(null)}
          onRename={(trackId, newTitle) => renameSong(trackId, newTitle)}
        />
      )}
    </section>
  );
}

function TrackRow({
  track,
  isLoading,
  onSelect,
  onTogglePublish,
  onDownload,
  onRename,
}: {
  track: Track;
  isLoading: boolean;
  onSelect: () => void;
  onTogglePublish: () => Promise<void>;
  onDownload: () => Promise<void>;
  onRename: () => void;
}) {
  if (track.status === "failed") {
    return (
      <Row>
        <CoverError />
        <div className="min-w-0 flex-1">
          <p className="text-meta text-destructive/80">generation failed</p>
          <p className="text-foreground/80 truncate font-serif text-[14px] italic">
            {track.title ?? "Untitled"}
          </p>
          <p className="text-muted-foreground mt-0.5 truncate text-[11px]">
            Try composing it again — sometimes the GPU has an off night.
          </p>
        </div>
      </Row>
    );
  }

  if (track.status === "no credits") {
    return (
      <Row>
        <CoverError />
        <div className="min-w-0 flex-1">
          <p className="text-meta text-destructive/80">no credits</p>
          <p className="text-foreground/80 truncate font-serif text-[14px] italic">
            {track.title ?? "Untitled"}
          </p>
          <p className="text-muted-foreground mt-0.5 truncate text-[11px]">
            You ran out before this one ran. Top up to keep composing.
          </p>
        </div>
      </Row>
    );
  }

  if (track.status === "queued" || track.status === "processing") {
    return (
      <Row>
        <CoverProcessing />
        <div className="min-w-0 flex-1">
          <p className="text-meta-brand">processing · ~ 90 sec</p>
          <p className="text-muted-foreground truncate font-serif text-[14px] italic">
            {track.title ?? "Untitled"}
          </p>
          <p className="text-muted-foreground mt-0.5 truncate text-[11px] italic">
            {track.prompt ?? track.fullDescribedSong ?? "Composing your song…"}
          </p>
        </div>
      </Row>
    );
  }

  // Done state
  return (
    <Row interactive onClick={onSelect}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onSelect();
        }}
        className="bg-secondary group/cover relative size-14 shrink-0 overflow-hidden rounded-md"
        aria-label={`Play ${track.title ?? "track"}`}
      >
        {track.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={track.thumbnailUrl}
            alt=""
            className="h-full w-full object-cover transition-opacity group-hover:opacity-90"
          />
        ) : (
          <div className="text-muted-foreground/40 flex h-full w-full items-center justify-center">
            <Music className="size-5" strokeWidth={1.5} />
          </div>
        )}
        <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 transition-opacity group-hover/cover:opacity-100">
          {isLoading ? (
            <span className="size-3 animate-spin rounded-full border-[1.5px] border-white/40 border-t-white" />
          ) : (
            <Play
              className="size-3.5 translate-x-px text-white"
              fill="currentColor"
              strokeWidth={0}
            />
          )}
        </div>
      </button>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-meta-brand truncate">
            {track.instrumental ? "instrumental" : "vocal"}
            {track.prompt
              ? ` · ${shortPrompt(track.prompt)}`
              : track.describedLyrics
                ? ` · ${shortPrompt(track.describedLyrics)}`
                : ""}
          </p>
        </div>
        <p className="text-foreground truncate font-serif text-[14px] italic">
          {track.title ?? "Untitled"}
        </p>
        <p className="text-muted-foreground mt-0.5 truncate text-[11px] italic">
          {track.prompt ?? track.fullDescribedSong ?? ""}
        </p>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            void onTogglePublish();
          }}
          className={[
            "rounded-full border px-2.5 py-1 text-[9px] tracking-[0.18em] uppercase transition-colors",
            track.published
              ? "border-brand text-brand bg-brand/5"
              : "border-border text-muted-foreground hover:text-foreground hover:border-border/80",
          ].join(" ")}
        >
          {track.published ? "Published" : "Publish"}
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              onClick={(e) => e.stopPropagation()}
              className="text-muted-foreground hover:text-foreground hover:bg-secondary/60 flex size-7 items-center justify-center rounded transition-colors"
              aria-label="More actions"
            >
              <MoreHorizontal className="size-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem
              onClick={async (e) => {
                e.stopPropagation();
                await onDownload();
              }}
            >
              <Download className="mr-2 size-3.5" /> Download
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation();
                onRename();
              }}
            >
              <Pencil className="mr-2 size-3.5" /> Rename
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </Row>
  );
}

function Row({
  children,
  interactive,
  onClick,
}: {
  children: React.ReactNode;
  interactive?: boolean;
  onClick?: () => void;
}) {
  const Wrapper = interactive ? "div" : "div";
  return (
    <Wrapper
      onClick={interactive ? onClick : undefined}
      className={[
        "border-border/30 grid grid-cols-[56px_1fr_auto] items-center gap-4 border-b px-3 py-3 last:border-b-0",
        interactive
          ? "hover:bg-brand/[0.03] cursor-pointer transition-colors"
          : "",
      ].join(" ")}
    >
      {children}
    </Wrapper>
  );
}

function CoverProcessing() {
  return (
    <div className="border-border/60 bg-secondary/40 flex size-14 shrink-0 items-center justify-center rounded-md border">
      <span className="border-border border-t-brand size-4 animate-spin rounded-full border-[1.5px]" />
    </div>
  );
}

function CoverError() {
  return (
    <div className="bg-destructive/10 flex size-14 shrink-0 items-center justify-center rounded-md">
      <XCircle className="text-destructive/70 size-5" strokeWidth={1.5} />
    </div>
  );
}

function EmptyState({ hasQuery }: { hasQuery: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <Music
        className="text-muted-foreground/40 size-10"
        strokeWidth={1.25}
      />
      <p className="text-section mt-5">Empty studio.</p>
      <p className="text-muted-foreground mt-2 max-w-sm text-[13px]">
        {hasQuery
          ? "Nothing in your library matches that. Try a shorter search."
          : "Describe a song on the left. ~90 seconds and your first track is ready."}
      </p>
    </div>
  );
}

function shortPrompt(s: string, max = 28) {
  return s.length > max ? `${s.slice(0, max).trim()}…` : s;
}
