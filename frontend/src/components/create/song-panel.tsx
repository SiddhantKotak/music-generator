"use client";

import { useState } from "react";
import { Plus, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Textarea } from "../ui/textarea";
import { Switch } from "../ui/switch";
import { generateSong, type GenerateRequest } from "~/actions/generation";

const inspirationTags = [
  "80s synth-pop",
  "Acoustic ballad",
  "Epic movie score",
  "Lo-fi hip hop",
  "Driving rock anthem",
  "Summer beach vibe",
  "Late-night jazz",
  "City pop",
];

const styleTags = [
  "Industrial rave",
  "Heavy bass",
  "Orchestral",
  "Electronic beats",
  "Funky guitar",
  "Soulful vocals",
  "Ambient pads",
  "140 BPM",
];

export function SongPanel() {
  const [mode, setMode] = useState<"simple" | "custom">("simple");
  const [description, setDescription] = useState("");
  const [instrumental, setInstrumental] = useState(false);
  const [lyricsMode, setLyricsMode] = useState<"write" | "auto">("write");
  const [lyrics, setLyrics] = useState("");
  const [styleInput, setStyleInput] = useState("");
  const [loading, setLoading] = useState(false);

  const appendTag = (
    tag: string,
    value: string,
    setValue: (s: string) => void,
  ) => {
    const tags = value
      .split(", ")
      .map((s) => s.trim())
      .filter(Boolean);
    if (tags.includes(tag)) return;
    setValue(value.trim() === "" ? tag : `${value}, ${tag}`);
  };

  const handleCreate = async () => {
    if (mode === "simple" && !description.trim()) {
      toast.error("Describe a song before composing.");
      return;
    }
    if (mode === "custom" && !styleInput.trim()) {
      toast.error("Add at least one style for the composer to work from.");
      return;
    }

    let requestBody: GenerateRequest;
    if (mode === "simple") {
      requestBody = { fullDescribedSong: description, instrumental };
    } else {
      const prompt = styleInput;
      requestBody =
        lyricsMode === "write"
          ? { prompt, lyrics, instrumental }
          : { prompt, describedLyrics: lyrics, instrumental };
    }

    try {
      setLoading(true);
      await generateSong(requestBody);
      setDescription("");
      setLyrics("");
      setStyleInput("");
      toast.success("Queued. ~90 seconds to first listen.");
    } catch {
      toast.error("Couldn't queue that one. Try again in a moment.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <aside className="border-border/60 bg-card/40 flex w-full shrink-0 flex-col border-r lg:w-[360px]">
      <div className="flex-1 overflow-y-auto px-6 py-7">
        {/* Header */}
        <div className="mb-6">
          <p className="text-eyebrow">Composer</p>
          <h2 className="text-display mt-1 text-[28px]">
            Make a <em>song.</em>
          </h2>
        </div>

        {/* Mode segmented control */}
        <div className="bg-secondary border-border/60 mb-7 inline-flex rounded-md border p-[3px] text-[12px]">
          <button
            type="button"
            onClick={() => setMode("simple")}
            className={[
              "rounded-[4px] px-3 py-1 transition-colors",
              mode === "simple"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            ].join(" ")}
          >
            Quick
          </button>
          <button
            type="button"
            onClick={() => setMode("custom")}
            className={[
              "rounded-[4px] px-3 py-1 transition-colors",
              mode === "custom"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            ].join(" ")}
          >
            Custom
          </button>
        </div>

        {mode === "simple" ? (
          <div className="space-y-7">
            <div>
              <FieldLabel right="required">Describe your song</FieldLabel>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="A late-night drive through Tokyo, neon reflecting off wet pavement. Add mood, instrumentation, a tempo if you have one."
                className="min-h-[120px] resize-none"
              />
            </div>

            <div>
              <FieldLabel right="tap to add">Inspiration</FieldLabel>
              <div className="flex flex-wrap gap-1.5">
                {inspirationTags.map((tag) => {
                  const on = description.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() =>
                        appendTag(tag, description, setDescription)
                      }
                      className={[
                        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] transition-colors",
                        on
                          ? "border-brand text-brand bg-brand/5"
                          : "border-border text-muted-foreground hover:text-foreground hover:border-border/80",
                      ].join(" ")}
                    >
                      <Plus className="size-2.5" strokeWidth={2.5} />
                      {tag}
                    </button>
                  );
                })}
              </div>
            </div>

            <ToggleRow
              label="Instrumental only"
              checked={instrumental}
              onChange={setInstrumental}
            />
          </div>
        ) : (
          <div className="space-y-7">
            <div>
              <div className="mb-2 flex items-center justify-between">
                <FieldLabel>Lyrics</FieldLabel>
                <div className="border-border/60 inline-flex rounded-md border p-[2px] text-[10px]">
                  <button
                    type="button"
                    onClick={() => {
                      setLyricsMode("write");
                      setLyrics("");
                    }}
                    className={[
                      "rounded px-2 py-0.5 transition-colors",
                      lyricsMode === "write"
                        ? "bg-secondary text-foreground"
                        : "text-muted-foreground hover:text-foreground",
                    ].join(" ")}
                  >
                    Write
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setLyricsMode("auto");
                      setLyrics("");
                    }}
                    className={[
                      "rounded px-2 py-0.5 transition-colors",
                      lyricsMode === "auto"
                        ? "bg-secondary text-foreground"
                        : "text-muted-foreground hover:text-foreground",
                    ].join(" ")}
                  >
                    Auto
                  </button>
                </div>
              </div>
              <Textarea
                value={lyrics}
                onChange={(e) => setLyrics(e.target.value)}
                placeholder={
                  lyricsMode === "write"
                    ? "[verse]\nLines, in order, like the studio sheet…"
                    : "Sketch the lyrics in plain English — a sad song about a long drive home."
                }
                className="min-h-[110px] resize-none"
              />
            </div>

            <div>
              <FieldLabel right="tap to add">Style</FieldLabel>
              <Textarea
                value={styleInput}
                onChange={(e) => setStyleInput(e.target.value)}
                placeholder="rave, funk, 140 BPM, female vocal, minor key"
                className="min-h-[64px] resize-none"
              />
              <div className="mt-3 flex flex-wrap gap-1.5">
                {styleTags.map((tag) => {
                  const on = styleInput.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => appendTag(tag, styleInput, setStyleInput)}
                      className={[
                        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] transition-colors",
                        on
                          ? "border-brand text-brand bg-brand/5"
                          : "border-border text-muted-foreground hover:text-foreground hover:border-border/80",
                      ].join(" ")}
                    >
                      <Plus className="size-2.5" strokeWidth={2.5} />
                      {tag}
                    </button>
                  );
                })}
              </div>
            </div>

            <ToggleRow
              label="Instrumental only"
              checked={instrumental}
              onChange={setInstrumental}
            />
          </div>
        )}
      </div>

      <div className="border-border/60 space-y-2 border-t px-6 py-4">
        <button
          type="button"
          onClick={handleCreate}
          disabled={loading}
          className="bg-brand text-brand-foreground inline-flex h-10 w-full items-center justify-center gap-2 rounded-md text-[13px] font-semibold transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {loading ? (
            <span className="border-brand-foreground/40 border-t-brand-foreground size-3.5 animate-spin rounded-full border-[1.5px]" />
          ) : (
            <Sparkles className="size-3.5" strokeWidth={2.25} />
          )}
          {loading ? "Queueing…" : "Compose · 1 credit"}
        </button>
        <p className="text-muted-foreground/80 text-center text-[9px] tracking-[0.18em] uppercase">
          ~ 90 sec to first listen
        </p>
      </div>
    </aside>
  );
}

function FieldLabel({
  children,
  right,
}: {
  children: React.ReactNode;
  right?: string;
}) {
  return (
    <div className="text-muted-foreground mb-2 flex items-center justify-between text-[9px] tracking-[0.16em] uppercase">
      <span>{children}</span>
      {right && <span className="text-muted-foreground/60">{right}</span>}
    </div>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="border-border/60 flex items-center justify-between border-t pt-4">
      <span className="text-foreground text-[13px]">{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
