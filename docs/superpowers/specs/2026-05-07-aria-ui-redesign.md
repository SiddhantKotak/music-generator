# aria. — UI Redesign Spec

**Date:** 2026-05-07
**Status:** Approved (visual direction + scope), ready for implementation plan
**Codebase target:** `frontend/` (Next.js 15, App Router, React 19, Tailwind v4, shadcn/ui)

---

## Why this exists

The deployed app is technically working end-to-end (Vercel + Modal + R2 + Neon + Inngest, generation verified), but the UI reads as a generic `create-t3-app` + shadcn scaffold:

- "MUSIC GENERATOR" placeholder wordmark, no brand identity
- Hardcoded `text-gray-900` / `bg-gray-200` instead of theme tokens, breaking dark mode
- Generic orange→pink gradient CTA (signature of "AI tool circa 2023")
- Filler empty-state copy ("No Music Yet")
- No visual hierarchy or editorial polish — every section sits at the same volume
- Default shadcn radii/spacing — instantly recognizable to anyone who's seen shadcn before

The product needs to look like a **real, deliberately-designed startup** for an investor / client pitch. That means escaping the AI-generated visual vocabulary (purple+black, soft gradients, centered hero forms, ✨emoji-heavy✨ copy) and adopting an editorial music-product visual language (Boiler Room, Resident Advisor, NTS Radio, Bandcamp Daily).

## The product, named

**`aria.`** — italic serif wordmark, period included. The name is short, music-coded (operatic aria = "solo melody"), pronounceable, and the `aria.` typographic treatment is the brand's signature element.

## Visual system

### Color tokens

Pure monochrome with one chromatic accent:

| Role | Value | Notes |
|---|---|---|
| Canvas (background) | `#0a0a0a` | Off-black, slightly warm |
| Surface (sidebar, cards) | `#050505` | One step deeper, separates by depth not color |
| Surface elevated (hover, modal) | `#111111` | One step lighter than canvas |
| Border subtle | `#1a1a1a` | Hairlines |
| Border strong | `#2a2a2a` | Inputs, dividers between major sections |
| Foreground primary | `#fafafa` | Body text |
| Foreground muted | `#888888` | Metadata, captions, inactive nav |
| Foreground disabled | `#444444` | |
| **Accent** | `#d4ff00` | Lime — used only for: active nav indicator, CTA fill, "now playing" state, eyebrow labels, the period in `aria.` |
| Destructive | `#f87171` | Errors only — used sparingly |
| Success | `#d4ff00` | Same as accent, no separate success color |

Light mode tokens stay defined (so the app doesn't break when forced) but the brand identity is the dark version. We do not invest in polishing light mode.

### Typography

| Family | Use | Source |
|---|---|---|
| **Geist Sans** | Body, UI, buttons, nav, labels | Already in repo via `next/font/google` |
| **Instrument Serif** (italic regular) | Wordmark `aria.`, page H1s, song titles, editorial section headers | Google Fonts (free) — add via `next/font/google` |
| `font-variant-numeric: tabular-nums` | All time/duration/credit numbers | CSS only |

Typographic scale (semantic, not utility):

- `text-display` — 30–42px, Instrument Serif italic, line-height 1.05, letter-spacing -0.02em (page H1s)
- `text-section` — 14–18px, Instrument Serif italic, letter-spacing -0.005em (section headers, song titles)
- `text-eyebrow` — 9–10px, Geist, uppercase, letter-spacing 0.22em, color = accent (above-headline labels)
- `text-meta` — 9–11px, Geist, uppercase, letter-spacing 0.16em (metadata: genre, BPM, duration)
- `text-body` — 13px Geist regular
- `text-ui` — 11–12px Geist (nav, buttons, captions)

### Spacing & geometry

- Radius: tighten from current `0.625rem` (10px) default to `0.375rem` (6px) for inputs/buttons, `0.25rem` (4px) for cover art. Editorial restraint.
- Sidebar: 200px wide (down from current default 256px)
- Sound bar: 70px tall (down from current 96px)
- Page max-width: none — let content breathe
- Vertical rhythm: 8px base grid, sections separated by 28–36px

### Motion

- All transitions: 180ms `cubic-bezier(0.4, 0, 0.2, 1)` (existing default)
- Hover: subtle, no scale transforms on cover art (anti-tacky)
- Focus rings: 2px lime offset, never dropped for "design"
- No flashy entrance animations; this is editorial, not a casino

## Page-by-page

### Sidebar (`src/components/sidebar/`)

```
┌──────────────────┐
│ aria.            │ <- Instrument Serif italic, 26px, lime period
│ MUSIC STUDIO     │ <- Geist 9px tracking-wider, 50% opacity
│                  │
│ ▌ Discover       │ <- inset 2px lime bar on active, item bg = #111
│   Studio         │
│                  │
│                  │
│                  │
│ ─────────────── │
│ 100 credits      │ <- "100" in Instrument Serif italic, lime
│ remaining        │
│ [SK] Siddhant K. │ <- 22px lime avatar with initials
└──────────────────┘
```

The codebase currently has only two routes (Home `/` and Create `/create`) — relabeled here as **Discover** and **Studio**. The mockups also showed a "Library" item but no underlying route exists in the codebase; the user's track list lives inside Studio (right-hand panel), so we don't need a separate Library page for v1. Adding a real Library route is a sensible v2 follow-on but is **out of scope** for this redesign.

Removes: the current `<Upgrade />` button (already gone from this codebase, mention here for clarity), the dual "MUSIC / Generator" stack (replaced with `aria.` + tagline).

Adds: lucide icons for nav items, a single "credits remaining" line with serif numeral, a clean user row with a lime initial-avatar.

### Discover (`src/app/(main)/page.tsx` + `src/components/home/song-card.tsx`)

```
WED · MAY 7
New arrivals, fresh from the studio.    <- Instrument Serif italic, lime "arrivals,"
A handful of new tracks made by aria's community in the last 48 hours.

Trending now                                      PAST 48 HOURS
─────────────────────────────────────────────────────────────────
[5-up grid of cover cards]
  cover (gradient art)
  GENRE · BPM       <- text-meta, lime
  Track title       <- Instrument Serif italic, 14px
  by Artist Name    <- 11px muted

Electronic                                          8 TRACKS
─────────────────────────────────────────────────────────────────
[5-up grid]
```

`SongCard` rewrite: replace hardcoded grays with semantic tokens (`text-foreground`, `text-muted-foreground`); replace black/50 hover overlay with subtle lift (no scale transform); add metadata line (`text-meta` color = accent) above title; remove the visible likes/listens count from the grid view (move to detail or make it secondary).

Empty state copy:
- Was: "No Music Here · There are no published songs available right now. Check back later!"
- Now: "Quiet on the wire. · Be the first to publish a track to the community feed."

### Studio (Create) — `src/app/(main)/create/page.tsx` + `src/components/create/song-panel.tsx` + `src/components/create/track-list.tsx`

Two-column layout (existing). New treatments:

**Left panel — Composer:**
- Eyebrow: `COMPOSER`
- H1: `Make a song.` (Instrument Serif italic, "song." in lime)
- Mode toggle as a 2-pill segmented control inside a darker pill background (Quick / Custom), not full-width tabs
- Field label format: `DESCRIBE YOUR SONG    REQUIRED` (label left, requirement marker right in lime)
- Textarea: `#111` bg, `#2a2a2a` border, focus ring lime
- Inspiration chips: outline by default; on click, lime border + lime text + 6% lime bg
- "Instrumental only" as a horizontal switch row, top-bordered separator
- CTA: full-width black-on-lime button with `✦` icon — `Compose · 1 credit`. Below it, in 9px tracking-wider muted: `~ 90 SEC TO FIRST LISTEN`

**Right panel — Track list:**
- Eyebrow + serif H2: `YOUR SESSIONS / Tonight's takes`
- Search box: minimal — dark bg, hairline border, search icon
- Track row: `56px cover · title block · meta+actions` grid
  - Processing state: cover replaced by spinner ring in lime; title `Untitled · <prompt fragment>` in italic muted
  - Done state: cover (real gradient art), `genre · bpm · duration` meta line in lime, title in serif italic, prompt excerpt below in italic muted
  - Failed state: red-tinted cover with X icon, title `Generation failed` muted
  - Hover: 4% accent overlay
- Published badge: small outline pill in lime, `PUBLISHED` text-meta
- Action buttons: ghost icon buttons (download, more) in muted, hover lime

Empty state copy:
- Was: "No Music Yet · Create your first song to get started."
- Now: "Empty studio. · Describe a song on the left. ~90 seconds and your first track is ready."

### Sound bar (`src/components/sound-bar.tsx`)

```
┌───────────────────────────────────────────────────────────────────┐
│ [cover] Sunburn radio        ⏮  ▶  ⏭        ♪ ━━━━━━━              │
│         disco · 140 bpm        ──•───────                           │
│                                1:02         2:43                    │
└───────────────────────────────────────────────────────────────────┘
```

- Frosted glass: `rgba(10,10,12,0.7)` + `backdrop-filter: blur(20px)` (works on dark, not gimmicky)
- Track title in Instrument Serif italic (echoing page H1)
- Play button: 28px lime circle with black play icon (echoing CTA)
- Progress line: 2px tall, `#1a1a1a` track + lime fill
- Times: tabular-nums, 9px muted
- Volume: 60px line + lime knob, never opens a dropdown

Removes: the current `Card` wrapper (too heavy), the right-side dropdown menu's Download option (move to track-row actions instead).

### Auth pages (`src/app/(auth)/auth/[pathname]/`)

`@daveyplate/better-auth-ui`'s `<AuthCard>` is themeable via Tailwind + `appearance` props. We re-skin it:

- Layout: full-screen black, `aria.` wordmark top-left, AuthCard centered (max-width 380px)
- AuthCard: dark bg `#050505`, hairline border, no rounded card chrome — feels like a single editorial panel, not a popup
- Inputs: `#111` bg, `#2a2a2a` border, focus ring lime
- Submit button: lime fill, black text, same as Compose CTA
- Above the card: tiny eyebrow `WELCOME BACK` / `JOIN ARIA`, then italic serif H2 `Sign in.` / `Make an account.`
- Below the card: `By signing up you agree to...` 9px muted

`(auth)/layout.tsx` gets the dark canvas treatment + a small footer line.

## Theme infrastructure

### `frontend/src/styles/globals.css` rewrite

The existing file has solid bones (Tailwind v4 + oklch tokens) but the values are stock shadcn defaults. The rewrite:

1. Add `Instrument Serif` import via `next/font/google` (in `(main)/layout.tsx` and `(auth)/layout.tsx`, expose as `--font-serif`)
2. Replace the `:root` and `.dark` variable bodies with the values from "Color tokens" above
3. Add semantic typography utility classes (`.text-display`, `.text-section`, `.text-eyebrow`, `.text-meta`) inside `@layer components`
4. Tighten radii: `--radius: 0.375rem`
5. Add `--font-sans: var(--font-geist-sans)` and `--font-serif: var(--font-instrument-serif)` so Tailwind's `font-sans` / `font-serif` resolve correctly

### `frontend/src/components/ui/` shadcn primitives

Re-style (do not regenerate) the components actually in use:

- `button.tsx` — add a `lime` variant (lime fill, black text), tighten radius
- `input.tsx` / `textarea.tsx` — adopt new bg/border, focus ring lime
- `badge.tsx` — outline variant default to lime border + lime text
- `tabs.tsx` — segmented-control aesthetic, smaller
- `switch.tsx` — lime when on, dark when off
- `slider.tsx` — 2px track, lime fill, lime knob
- `dialog.tsx` — `#050505` content bg, hairline border, no border-radius shadow
- `sidebar.tsx` — slim 200px, custom active-item treatment
- `dropdown-menu.tsx` — dark popover, hairline border, lime hover bg

Components untouched (already fine or used minimally): `breadcrumb.tsx`, `card.tsx` (replace use-sites with bare divs), `label.tsx`, `separator.tsx`, `sheet.tsx`, `skeleton.tsx`, `tooltip.tsx`, `sonner.tsx`.

## Out of scope

These exist on purpose to keep this implementation finite:

- **Marketing/landing page** — pitch demo opens the app directly
- **Light-mode visual polish** — light mode keeps working through tokens but isn't designed
- **Mobile responsive polish** — current breakpoints kept; no tablet/phone-specific layouts
- **Animation library** — no Framer Motion / GSAP introduction, CSS transitions only
- **`Like` button visual rework** — feature exists but isn't pitch-critical; inherits new tokens passively
- **Customer-portal/upgrade flows** — already removed earlier in this project
- **Separate Library route** — not in the codebase; track list lives inside Studio for v1
- **Component test coverage** — visual changes only, no behavior changes that need tests
- **Storybook / component docs** — out of scope for a startup pitch

## Implementation order (informs the writing-plans pass)

1. **Tokens + fonts** — rewrite `globals.css`, add Instrument Serif, expose CSS variables, add typography utilities. Verifiable by visiting any page and seeing the new color/type apply automatically.
2. **shadcn primitive re-skins** — `button`, `input`, `textarea`, `badge`, `tabs`, `switch`, `slider`, `dialog`, `dropdown-menu`. Self-contained file edits.
3. **Sidebar + shell** — `app-sidebar.tsx`, `sidebar-menu-items.tsx`, `credits.tsx`, `breadcrumb-page-client.tsx`, `(main)/layout.tsx`. Brand wordmark, slim layout, new credit treatment.
4. **Sound bar** — `sound-bar.tsx`. Frosted glass, lime play button, serif title, refined controls.
5. **Discover** — `(main)/page.tsx`, `home/song-card.tsx`. Editorial header with eyebrow/serif H1, section headers with meta on right, refined cover cards, empty state copy.
6. **Studio (Create)** — `(main)/create/page.tsx`, `song-panel.tsx`, `track-list.tsx`, `rename-dialog.tsx`. Two-column layout polish, mode pill, inspiration chips with lime active state, processing/done/failed track row variants, new CTA copy.
7. **Auth** — `(auth)/layout.tsx`, `(auth)/auth/[pathname]/page.tsx`, `view.tsx`. Re-theme `<AuthCard>` via better-auth-ui's `appearance` API; wordmark + editorial framing around it.
8. **Empty / processing / failed copy** — pass through every empty state and rewrite per the editorial voice. Quick win after everything else.

## Verification

End-to-end manual smoke after each step (dev server is `npm run dev`):

- **Tokens land**: open any page, confirm the canvas is `#0a0a0a`, an existing button looks lime-styled, body type renders in Geist, headlines render in Instrument Serif italic.
- **Sidebar**: `aria.` wordmark appears with lime period, nav active state has the inset lime bar, credits row shows serif numeral, no broken `<Upgrade />` reference.
- **Discover**: empty state shows new copy, when songs exist they render in 5-up grid with lime meta line above serif italic titles. Hover state subtle (no scale).
- **Studio**: composer panel renders; clicking inspiration chips toggles them lime; the Compose CTA shows `Compose · 1 credit` + `~90 SEC TO FIRST LISTEN` line; processing track row shows lime spinner + italic muted title.
- **Sound bar**: when a track is selected from the UI, plays through the global player; title in serif italic, lime play button, frosted glass.
- **Auth**: `/auth/sign-in` shows full-screen dark canvas, `aria.` wordmark, dark AuthCard, lime submit button. Sign-up flow visually consistent.
- **Generation flow**: sign up → land in Studio → submit a song → see processing track row → wait for it to flip to done with cover/title → click play → audio streams from the lime-styled sound bar. End-to-end visual + functional verification in one pass.

## Risks / things to watch

- **Instrument Serif at small sizes** — the italic looks beautiful at display sizes but can feel unstable at 14px. Test the section headers (14–18px) carefully; fall back to a slightly heavier weight if needed.
- **Lime accent overuse** — easy to slip into "lime everywhere" which becomes loud. Discipline: lime appears on (a) the period in `aria.`, (b) active nav indicator, (c) CTA fill, (d) eyebrow labels, (e) metadata line above song titles, (f) play button when "now playing", (g) focus rings. Anywhere else, default to white or muted gray.
- **`@daveyplate/better-auth-ui` themeability** — the lib accepts class overrides on most surfaces, but its internals can resist heavy restyling. First attempt: use whatever class/theme override API the installed version (2.1.11) exposes. If that proves too constrained, fall back to either (a) using the lib's lower-level form parts (it exports them) wrapped in our own primitives, or (b) re-implementing the auth screens ourselves using `better-auth/react` directly — `better-auth-ui` is convenience, not load-bearing.
- **Cover art generation continues to use SDXL-Turbo** — those covers are part of the visual language. We don't change the model, but the pitch screenshots will only look as good as the covers. If demoing, queue a few generations beforehand so the grid is full of nice art.
