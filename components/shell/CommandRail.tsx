"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutGrid,
  Fingerprint,
  ShieldCheck,
  Boxes,
  Landmark,
  ScrollText,
} from "lucide-react";
import { cn } from "@/lib/utils";

const modules = [
  { href: "/", label: "Overview", icon: LayoutGrid },
  { href: "/identity", label: "Identity", icon: Fingerprint },
  { href: "/access-control", label: "Access Control", icon: ShieldCheck },
  { href: "/assets", label: "Assets", icon: Boxes },
  { href: "/governance", label: "Governance", icon: Landmark },
  { href: "/audit", label: "Audit", icon: ScrollText },
];

/**
 * The rail is icon-only by design (UI_UX_SPEC.md §1 Layout Shape) — a module switcher that reads
 * like a hardware panel, not a text-labeled sidebar. Active state is a 2px signal-500 left edge,
 * not a filled background block.
 */
export function CommandRail() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Module navigation"
      className="flex w-16 shrink-0 flex-col items-center gap-1 border-r border-graphite-800 bg-graphite-900 py-4"
    >
      <div className="mb-4 flex h-8 w-8 items-center justify-center rounded-lg bg-signal-500/15">
        <span className="mono-value text-[11px] font-semibold text-signal-400">BC</span>
      </div>

      {modules.map(({ href, label, icon: Icon }) => {
        const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            title={label}
            aria-label={label}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "group relative flex h-11 w-11 items-center justify-center rounded-xl transition-colors duration-150",
              isActive ? "bg-graphite-800 text-ink-50" : "text-ink-400 hover:bg-graphite-800/60 hover:text-ink-200"
            )}
          >
            {isActive && (
              <span className="absolute left-[-9px] h-5 w-[2px] rounded-full bg-signal-500" />
            )}
            <Icon size={19} strokeWidth={1.75} />
          </Link>
        );
      })}

      <div className="mt-auto flex flex-col items-center gap-2">
        <div className="h-9 w-9 rounded-full border border-graphite-700 bg-graphite-800" aria-hidden />
      </div>
    </nav>
  );
}
