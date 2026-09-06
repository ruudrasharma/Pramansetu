import type { Metadata } from "next";
import { Inter, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { CommandRail } from "@/components/shell/CommandRail";
import { ContextBar } from "@/components/shell/ContextBar";

// UI_UX_SPEC.md specifies Geist / Geist Mono as the target typefaces. Using Inter + IBM Plex Mono
// here (same CSS variable names) so the project runs with zero extra font-file setup; swap to
// `geist`/`geist/font/mono` npm packages for the exact spec typefaces with no other code changes.
const geistSans = Inter({
  subsets: ["latin"],
  variable: "--font-geist",
  weight: ["400", "500", "600", "700"],
});

const geistMono = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "BEL Chain — Identity, Access & Asset Platform",
  description:
    "Blockchain-based secure platform for identity, access control, and digital asset management — PS 26125.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="min-h-screen bg-graphite-950 font-sans text-ink-50 antialiased">
        <div className="flex h-screen overflow-hidden">
          <CommandRail />
          <div className="flex min-w-0 flex-1 flex-col">
            <ContextBar />
            <main className="flex-1 overflow-y-auto">{children}</main>
          </div>
        </div>
      </body>
    </html>
  );
}
