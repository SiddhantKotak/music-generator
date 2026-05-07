"use client";

import { Compass, Music } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { title: "Discover", url: "/", icon: Compass },
  { title: "Studio", url: "/create", icon: Music },
];

export default function SidebarMenuItems() {
  const path = usePathname();

  return (
    <ul className="flex flex-col gap-px">
      {items.map((item) => {
        const active = path === item.url;
        return (
          <li key={item.title}>
            <Link
              href={item.url}
              className={[
                "group relative flex items-center gap-3 rounded-md px-3 py-2 text-[13px] transition-colors",
                active
                  ? "text-foreground bg-secondary/60"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/30",
              ].join(" ")}
            >
              {active && (
                <span
                  aria-hidden="true"
                  className="bg-brand absolute top-1/2 left-0 h-5 w-[2px] -translate-y-1/2 rounded-r"
                />
              )}
              <item.icon
                className={[
                  "h-[14px] w-[14px] transition-opacity",
                  active ? "opacity-100" : "opacity-70",
                ].join(" ")}
                strokeWidth={1.75}
              />
              <span>{item.title}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
