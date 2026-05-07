"use server";

import { UserButton } from "@daveyplate/better-auth-ui";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
} from "../ui/sidebar";
import { Credits } from "./credits";
import SidebarMenuItems from "./sidebar-menu-items";

export async function AppSidebar() {
  return (
    <Sidebar>
      <SidebarHeader className="px-4 pt-5 pb-2">
        <div className="flex flex-col">
          <span className="font-serif text-[26px] leading-none italic tracking-tight">
            aria<span className="text-brand">.</span>
          </span>
          <span className="text-muted-foreground mt-1.5 text-[9px] tracking-[0.22em] uppercase">
            music studio
          </span>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2 pt-4">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenuItems />
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="gap-0 p-0">
        <Credits />
        <div className="border-border/60 border-t p-2">
          <UserButton variant="outline" />
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
