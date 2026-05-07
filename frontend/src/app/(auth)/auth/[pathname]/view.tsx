"use client";

import { AuthCard } from "@daveyplate/better-auth-ui";
import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const COPY: Record<
  string,
  { eyebrow: string; title: React.ReactNode; sub: string }
> = {
  "sign-in": {
    eyebrow: "Welcome back",
    title: <>Sign <em>in.</em></>,
    sub: "Pick up where you left off. Tonight's takes are waiting.",
  },
  "sign-up": {
    eyebrow: "Join aria",
    title: <>Make an <em>account.</em></>,
    sub: "100 credits to start. About 100 songs before you'll need more.",
  },
  "forgot-password": {
    eyebrow: "Reset",
    title: <>Forgot the <em>password?</em></>,
    sub: "Drop your email and we'll send a reset link.",
  },
};

const DEFAULT_COPY = {
  eyebrow: "Account",
  title: <>Settings.</>,
  sub: "",
};

export function AuthView({ pathname }: { pathname: string }) {
  const router = useRouter();
  const copy = COPY[pathname] ?? DEFAULT_COPY;
  const isInternal = ["settings", "security"].includes(pathname);

  return (
    <div className="bg-background flex min-h-svh flex-col">
      {/* top wordmark */}
      <header className="px-6 pt-6 md:px-10">
        <Link
          href="/"
          className="text-foreground inline-block font-serif text-[26px] leading-none italic tracking-tight"
        >
          aria<span className="text-brand">.</span>
        </Link>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-6 py-10">
        <div className="w-full max-w-[380px]">
          {isInternal && (
            <button
              type="button"
              onClick={() => router.back()}
              className="text-muted-foreground hover:text-foreground mb-6 inline-flex items-center gap-1.5 text-[11px] tracking-[0.16em] uppercase transition-colors"
            >
              <ArrowLeftIcon className="size-3" /> Back
            </button>
          )}

          {!isInternal && (
            <div className="mb-7">
              <p className="text-eyebrow">{copy.eyebrow}</p>
              <h1 className="text-display mt-2 text-[36px]">{copy.title}</h1>
              {copy.sub && (
                <p className="text-muted-foreground mt-2 text-[13px] leading-relaxed">
                  {copy.sub}
                </p>
              )}
            </div>
          )}

          <div className="auth-shell">
            <AuthCard pathname={pathname} />
          </div>
        </div>
      </main>

      <footer className="px-6 pb-6 md:px-10">
        <p className="text-muted-foreground/60 text-[10px] tracking-[0.18em] uppercase">
          aria. — music studio
        </p>
      </footer>

      {/* Style overrides for the better-auth-ui AuthCard so it inherits the
          editorial mono+lime aesthetic. The lib renders its own markup; we
          target it via the wrapper class. */}
      <style jsx global>{`
        .auth-shell [data-slot="card"] {
          background: var(--card);
          border-color: var(--border);
          border-radius: 0.5rem;
          box-shadow: none;
        }
        .auth-shell [data-slot="card-title"] {
          font-family: var(--font-serif);
          font-style: italic;
          font-weight: 400;
          letter-spacing: -0.01em;
        }
        .auth-shell button[data-slot="button"][type="submit"] {
          background: var(--brand);
          color: var(--brand-foreground);
        }
        .auth-shell button[data-slot="button"][type="submit"]:hover {
          opacity: 0.9;
        }
        .auth-shell a {
          color: var(--brand);
        }
        .auth-shell a:hover {
          opacity: 0.85;
        }
      `}</style>
    </div>
  );
}
