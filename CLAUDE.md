# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository layout

Two independent projects in one repo:

- `frontend/` — Next.js 15 (App Router) + React 19 + TypeScript app, scaffolded from `create-t3-app`. Uses Prisma (PostgreSQL), better-auth, Inngest, Polar (billing), AWS S3, Tailwind v4, and shadcn/ui (`components.json` configured for the `new-york` style under `~/components/ui`). Path alias `~/*` → `frontend/src/*`.
- `backend/` — Python Modal app (`main.py`) deployed to [Modal](https://modal.com) that exposes three FastAPI endpoints for music generation. The Node `package.json` here only exists to install the `modal` CLI.

## Commands

All frontend commands run from `frontend/`:

| Task | Command |
| --- | --- |
| Dev server (Turbopack) | `npm run dev` |
| Production build | `npm run build` |
| Lint + typecheck | `npm run check` |
| Lint only / autofix | `npm run lint` / `npm run lint:fix` |
| Typecheck only | `npm run typecheck` |
| Format check / write | `npm run format:check` / `npm run format:write` |
| Prisma migrate (dev) | `npm run db:generate` |
| Prisma migrate (deploy) | `npm run db:migrate` |
| `prisma db push` | `npm run db:push` |
| Prisma Studio | `npm run db:studio` |
| Local Postgres in Docker | `./start-database.sh` (reads `DATABASE_URL` from `.env`) |
| ngrok tunnel for Polar webhooks | `npm run polar-webhooks` |

`postinstall` runs `prisma generate` automatically.

There is no test runner configured — do not invent test commands.

Backend (`backend/`):

- Run/deploy the Modal app with the `modal` CLI (e.g. `modal run main.py`, `modal deploy main.py`). The local `npm install` in `backend/` is only there to vendor the Modal CLI as a node module.
- Modal expects a secret named `music-gen-secret` and two volumes (`ace-step-models`, `qwen-hf-cache`). `S3_BUCKET_NAME` must be set in the secret.

## Architecture

### Generation pipeline (the core flow)

1. User submits a request from the `/create` page → server action `generateSong` in `frontend/src/actions/generation.ts`.
2. The action creates a `Song` row (status `queued`) and emits an Inngest event `generate-song-event`. **Note**: it actually queues two songs per request, at guidance scales 7.5 and 15.
3. `frontend/src/inngest/functions.ts` consumes the event (concurrency keyed per `userId`, limit 1), reads the song, picks one of three Modal endpoints based on which fields are populated, and calls it via `fetch` with a 5-minute timeout:
   - `fullDescribedSong` → `GENERATE_FROM_DESCRIPTION`
   - `lyrics + prompt` → `GENERATE_WITH_LYRICS`
   - `describedLyrics + prompt` → `GENERATE_FROM_DESCRIBED_LYRICS`
4. Modal (`backend/main.py`, `MusicGenServer` on an L40S GPU) loads three models on container start: ACE-Step (audio), Qwen2-7B-Instruct (prompt/lyric/category generation), and SDXL-Turbo (cover art). It writes the `.wav` and `.png` to S3 and returns `{ s3_key, cover_image_s3_key, categories }`.
5. The Inngest handler updates the song row (`status: "processed"`, S3 keys, connectOrCreate categories) and decrements the user's credits. On failure it sets `status: "failed"`; if `credits === 0` it sets `status: "no credits"` and skips the Modal call.
6. Playback URLs are short-lived presigned S3 URLs minted by `getPresignedUrl` / `getPlayUrl` in `actions/generation.ts`.

When changing the generation flow, keep the three-endpoint dispatch in `inngest/functions.ts` and the three FastAPI methods in `backend/main.py:MusicGenServer` in sync — the request bodies are tightly coupled (`AudioGenerationBase` in Python ↔ `RequestBody` in TS).

### Auth & billing

- `better-auth` with the Prisma adapter, email+password (min length 6), 7-day sessions, 5-min cookie cache. Configured in `frontend/src/lib/auth.ts`. Catch-all handler at `app/api/auth/[...all]/route.ts`.
- Client uses `@daveyplate/better-auth-ui` and the `@polar-sh/better-auth` plugin (`src/lib/auth-client.ts`).
- Polar handles paid credit top-ups; webhooks are tunneled in dev via `npm run polar-webhooks` (ngrok on port 3000). `POLAR_ACCESS_TOKEN` and `POLAR_WEBHOOK_SECRET` are required env vars.
- Credits live on the `User` model (default 100) and are decremented in the Inngest function after a successful Modal response.

### App routing (Next App Router)

- Two route groups: `(auth)` for sign-in/sign-up and `(main)` for the authenticated shell (sidebar + sound bar). Server-side `auth.api.getSession` redirects to `/auth/sign-in` when missing — follow that pattern in any new server action or page that touches user data.
- API routes: `app/api/auth/[...all]/route.ts` (better-auth) and `app/api/inngest/route.ts` (Inngest serve handler — register new functions here).
- `src/stores/use-player-store.ts` is the single Zustand store driving the global `SoundBar`.

### Environment variables

`frontend/src/env.js` is the source of truth — it uses `@t3-oss/env-nextjs` with Zod, so adding any server var requires entries in both `server` and `runtimeEnv`. `.env.example` lists the keys but not values. `SKIP_ENV_VALIDATION=1` bypasses validation for Docker/CI builds.

Required server vars: `DATABASE_URL`, `BETTER_AUTH_SECRET`, `MODAL_KEY`, `MODAL_SECRET`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY_ID` (note the `_ID` suffix — typo preserved across the codebase), `AWS_REGION`, `S3_BUCKET_NAME`, `GENERATE_FROM_DESCRIPTION`, `GENERATE_FROM_DESCRIBED_LYRICS`, `GENERATE_WITH_LYRICS`, `POLAR_ACCESS_TOKEN`, `POLAR_WEBHOOK_SECRET`.

### Database

PostgreSQL via Prisma (`frontend/prisma/schema.prisma`). Core models: `User` (with `credits`), `Song` (status string: `queued | processing | processed | failed | no credits`; nullable `s3Key`/`thumbnailS3Key`; many-to-many `Category`), `Like` (composite PK `userId_songId`), `Session`/`Account`/`Verification` (better-auth tables, mapped to lower-case table names). The Prisma client singleton is in `src/server/db.ts`.

## Conventions

- Use the `~/` import alias inside `frontend/src` rather than relative paths.
- Server actions live in `src/actions/`; always start the file with `"use server"` and gate on `auth.api.getSession`.
- Prettier is configured with `prettier-plugin-tailwindcss` — let it sort Tailwind classes.
- shadcn/ui components belong in `src/components/ui/` (per `components.json`); do not edit them ad-hoc, regenerate with the shadcn CLI.
