"use client";

import { usePathname } from "next/navigation";
import { Search, Circle } from "lucide-react";
import { systemHealth } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

const titles: Record<string, string> = {
  "/": "Overview",
  "/identity": "Identity",
  "/access-control": "Access Control",
  "/assets": "Assets",
  "/governance": "Governance",
  "/audit": "Audit",
};

export function ContextBar() {
  const pathname = usePathname();
  const title =
    Object.entries(titles).find(([href]) => (href === "/" ? pathname === "/" : pathname.startsWith(href)))?.[1] ??
    "Overview";

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-graphite-800 bg-graphite-950/80 px-6 backdrop-blur">
      <div className="flex items-center gap-3">
        <h1 className="text-[15px] font-medium text-ink-50">{title}</h1>
        <span className="h-1 w-1 rounded-full bg-graphite-700" aria-hidden />
        <div className="flex items-center gap-1.5 text-[13px] text-ink-400">
          <Circle
            size={7}
            className={cn(
              "fill-current",
              systemHealth.platformPaused ? "text-danger-500" : "text-verified-500"
            )}
          />
          {systemHealth.platformPaused ? "Platform paused" : "Live · Polygon Amoy"}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          className="flex items-center gap-2 rounded-lg border border-graphite-700 bg-graphite-900 px-3 py-1.5 text-[13px] text-ink-400 transition-colors hover:border-graphite-600 hover:text-ink-200"
          aria-label="Open command palette"
        >
          <Search size={14} strokeWidth={1.75} />
          <span>Search or run a command</span>
          <kbd className="mono-value ml-2 rounded border border-graphite-700 bg-graphite-800 px-1.5 py-0.5 text-[11px] text-ink-400">
            ⌘K
          </kbd>
        </button>

        <div className="flex items-center gap-2 rounded-lg border border-signal-500/30 bg-signal-500/10 px-3 py-1.5">
          <span className="mono-value text-[11px] font-medium text-signal-400">SUPER_ADMIN</span>
        </div>
      </div>
    </header>
  );
}
