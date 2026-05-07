"use client";

import {
  Music,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Volume2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { usePlayerStore } from "~/stores/use-player-store";
import { Slider } from "./ui/slider";

export default function SoundBar() {
  const { track } = usePlayerStore();
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState([100]);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateTime = () => setCurrentTime(audio.currentTime);
    const updateDuration = () => {
      if (!isNaN(audio.duration)) setDuration(audio.duration);
    };
    const handleTrackEnd = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener("timeupdate", updateTime);
    audio.addEventListener("loadedmetadata", updateDuration);
    audio.addEventListener("ended", handleTrackEnd);

    return () => {
      audio.removeEventListener("timeupdate", updateTime);
      audio.removeEventListener("loadedmetadata", updateDuration);
      audio.removeEventListener("ended", handleTrackEnd);
    };
  }, [track]);

  useEffect(() => {
    if (audioRef.current && track?.url) {
      setCurrentTime(0);
      setDuration(0);
      audioRef.current.src = track.url;
      audioRef.current.load();

      const playPromise = audioRef.current.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => setIsPlaying(true))
          .catch((error) => {
            console.error("Playback failed: ", error);
            setIsPlaying(false);
          });
      }
    }
  }, [track]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume[0]! / 100;
    }
  }, [volume]);

  const togglePlay = async () => {
    if (!track?.url || !audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      await audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const handleSeek = (value: number[]) => {
    if (audioRef.current && value[0] !== undefined) {
      audioRef.current.currentTime = value[0];
      setCurrentTime(value[0]);
    }
  };

  const formatTime = (time: number) => {
    if (!isFinite(time)) return "0:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  if (!track) return null;

  return (
    <div className="border-border/60 bg-background/70 supports-[backdrop-filter]:bg-background/50 sticky bottom-0 z-20 border-t backdrop-blur-xl">
      <div className="grid h-[70px] grid-cols-[1fr_auto_1fr] items-center gap-6 px-5">
        {/* Left — now playing */}
        <div className="flex min-w-0 items-center gap-3">
          <div className="bg-secondary relative size-10 shrink-0 overflow-hidden rounded-md">
            {track.artwork ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                className="h-full w-full object-cover"
                src={track.artwork}
                alt=""
              />
            ) : (
              <div className="text-muted-foreground flex h-full w-full items-center justify-center">
                <Music className="size-4" />
              </div>
            )}
          </div>
          <div className="min-w-0">
            <p className="truncate font-serif text-[14px] leading-tight italic">
              {track.title ?? "Untitled"}
            </p>
            <p className="text-muted-foreground truncate text-[11px]">
              {track.createdByUserName ?? "—"}
            </p>
          </div>
        </div>

        {/* Center — controls + scrubber */}
        <div className="flex w-[420px] max-w-[480px] flex-col items-stretch gap-1.5">
          <div className="flex items-center justify-center gap-3">
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30"
              disabled
              aria-label="Previous"
            >
              <SkipBack className="size-3.5" strokeWidth={2} />
            </button>
            <button
              type="button"
              onClick={togglePlay}
              aria-label={isPlaying ? "Pause" : "Play"}
              className="bg-brand text-brand-foreground flex size-7 items-center justify-center rounded-full transition-transform hover:scale-105"
            >
              {isPlaying ? (
                <Pause className="size-3" strokeWidth={2.5} fill="currentColor" />
              ) : (
                <Play className="size-3 translate-x-px" strokeWidth={0} fill="currentColor" />
              )}
            </button>
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30"
              disabled
              aria-label="Next"
            >
              <SkipForward className="size-3.5" strokeWidth={2} />
            </button>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground tabular w-9 text-right text-[10px]">
              {formatTime(currentTime)}
            </span>
            <Slider
              className="flex-1"
              value={[currentTime]}
              max={duration || 100}
              step={1}
              onValueChange={handleSeek}
            />
            <span className="text-muted-foreground tabular w-9 text-[10px]">
              {formatTime(duration)}
            </span>
          </div>
        </div>

        {/* Right — volume */}
        <div className="flex items-center justify-end gap-2">
          <Volume2 className="text-muted-foreground size-3.5" strokeWidth={1.75} />
          <Slider
            value={volume}
            onValueChange={setVolume}
            step={1}
            max={100}
            min={0}
            className="w-20"
          />
        </div>
      </div>

      {track?.url && (
        <audio ref={audioRef} src={track.url} preload="metadata" />
      )}
    </div>
  );
}
