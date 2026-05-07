"use client";

import { usePathname } from "next/navigation";

const labels: Record<string, string> = {
  "/": "Discover",
  "/create": "Studio",
};

export default function BreadcrumbPageClient() {
  const path = usePathname();
  const label = labels[path] ?? "";

  return (
    <span className="text-muted-foreground text-[10px] tracking-[0.22em] uppercase">
      {label}
    </span>
  );
}
