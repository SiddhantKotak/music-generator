"use client";

import { useState } from "react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Input } from "../ui/input";
import type { Track } from "./track-list";

export function RenameDialog({
  track,
  onClose,
  onRename,
}: {
  track: Track;
  onClose: () => void;
  onRename: (trackId: string, newTitle: string) => void;
}) {
  const [title, setTitle] = useState(track.title ?? "");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (title.trim()) {
      onRename(track.id, title.trim());
    }
    onClose();
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[420px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <p className="text-eyebrow">Rename</p>
            <DialogTitle className="text-section mt-1">
              What should we call it?
            </DialogTitle>
            <DialogDescription className="text-muted-foreground text-[13px]">
              Pick a title that fits the mood. Old title:{" "}
              <span className="text-foreground/70 italic">
                &ldquo;{track.title ?? "Untitled"}&rdquo;
              </span>
            </DialogDescription>
          </DialogHeader>
          <div className="py-5">
            <Input
              id="name"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
              placeholder="Untitled"
            />
          </div>
          <DialogFooter className="gap-2">
            <DialogClose asChild>
              <button
                type="button"
                className="border-border text-muted-foreground hover:text-foreground hover:bg-secondary/40 rounded-md border px-4 py-2 text-[12px] transition-colors"
              >
                Cancel
              </button>
            </DialogClose>
            <button
              type="submit"
              className="bg-brand text-brand-foreground rounded-md px-4 py-2 text-[12px] font-semibold transition-opacity hover:opacity-90"
            >
              Save
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
