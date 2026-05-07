"use server";

import { headers } from "next/headers";
import { auth } from "~/lib/auth";
import { db } from "~/server/db";

export async function Credits() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) return null;

  const user = await db.user.findUniqueOrThrow({
    where: { id: session.user.id },
    select: { credits: true },
  });

  return (
    <div className="border-border/60 px-3 py-3 border-t">
      <div className="flex items-baseline gap-2">
        <span className="text-brand font-serif text-[18px] italic leading-none tabular">
          {user.credits}
        </span>
        <span className="text-muted-foreground text-[10px] tracking-[0.16em] uppercase">
          credits
        </span>
      </div>
    </div>
  );
}
