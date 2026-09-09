import type { Metadata } from "next";
import { Plus_Jakarta_Sans, IBM_Plex_Mono } from "next/font/google";
import { ThemeProvider } from "next-themes";
import "./globals.css";
import { Web3Providers } from "@/components/shell/Web3Providers";
import { CommandPalette } from "@/components/shell/CommandPalette";
import { DetailPanelProvider } from "@/components/shell/DetailPanelContext";
import { DetailPanel } from "@/components/shell/DetailPanel";

// UI_UX_SPEC.md specifies Plus Jakarta Sans / IBM Plex Mono as the target typefaces (warm,
// rounded geometric sans for display; mono reserved for hashes/DIDs/addresses/CIDs).
const geistSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-geist",
  weight: ["400", "500", "600", "700", "800"],
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
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
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
