import "~/styles/globals.css";

import { type Metadata } from "next";
import { Geist, Instrument_Serif } from "next/font/google";
import { Providers } from "~/components/providers";
import { Toaster } from "~/components/ui/sonner";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "~/components/ui/sidebar";
import { AppSidebar } from "~/components/sidebar/app-sidebar";
import BreadcrumbPageClient from "~/components/sidebar/breadcrumb-page-client";
import SoundBar from "~/components/sound-bar";

export const metadata: Metadata = {
  title: "aria. — music studio",
  description:
    "Describe a song in plain English; aria writes, sings, and produces it.",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
};

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: "italic",
  variable: "--font-instrument-serif",
});

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${geist.variable} ${instrumentSerif.variable} dark`}
    >
      <body className="bg-background text-foreground">
        <Providers>
          <SidebarProvider
            style={
              {
                "--sidebar-width": "16rem",
              } as React.CSSProperties
            }
          >
            <AppSidebar />
            <SidebarInset className="bg-background flex h-screen flex-col">
              <header className="border-border/60 bg-background/80 sticky top-0 z-10 flex h-12 shrink-0 items-center gap-3 border-b px-4 backdrop-blur">
                <SidebarTrigger className="text-muted-foreground hover:text-foreground -ml-1 size-7" />
                <span className="bg-border h-3 w-px" aria-hidden="true" />
                <BreadcrumbPageClient />
              </header>
              <main className="flex-1 overflow-y-auto">{children}</main>
              <SoundBar />
            </SidebarInset>
          </SidebarProvider>
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}
