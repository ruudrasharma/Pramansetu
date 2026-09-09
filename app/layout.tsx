import type { Metadata } from "next";
import { Inter, IBM_Plex_Mono } from "next/font/google";
import { ThemeProvider } from "next-themes";
import "./globals.css";
import { Web3Providers } from "@/components/shell/Web3Providers";
import { CommandPalette } from "@/components/shell/CommandPalette";
import { DetailPanelProvider } from "@/components/shell/DetailPanelContext";
import { DetailPanel } from "@/components/shell/DetailPanel";

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
  title: "Praman Setu — Identity, Access & Asset Platform",
  description:
    "Blockchain-based secure platform for identity, access control, and digital asset management — PS 26125.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="min-h-screen bg-graphite-950 font-sans text-ink-50 antialiased">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <Web3Providers>
            <DetailPanelProvider>
              {children}
              {/* right-hand slide-in, global so any page's event/asset click can open it */}
              <DetailPanel />
              {/* ⌘K command palette — global, rendered outside the flex layout so it overlays everything */}
              <CommandPalette />
            </DetailPanelProvider>
          </Web3Providers>
        </ThemeProvider>
      </body>
    </html>
  );
}
