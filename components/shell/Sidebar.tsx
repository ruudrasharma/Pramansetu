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
  Settings,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/lib/store/appStore";

const modules = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutGrid },
  { href: "/identity", label: "Identity", icon: Fingerprint },
  { href: "/roles", label: "Roles & Access", icon: ShieldCheck },
  { href: "/assets", label: "Assets", icon: Boxes },
  { href: "/governance", label: "Governance", icon: Landmark },
  { href: "/audit", label: "Audit & Anomalies", icon: ScrollText },
  { href: "/settings", label: "Settings", icon: Settings },
];

function NavItem({
  href,
  label,
  icon: Icon,
  collapsed,
  active,
}: {
  href: string;
  label: string;
  icon: typeof LayoutGrid;
  collapsed: boolean;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      title={collapsed ? label : undefined}
      className={cn(
        "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] transition-colors duration-150",
        collapsed && "justify-center px-0 py-2.5",
        active ? "bg-signal-500/10 text-signal-400" : "text-ink-400 hover:bg-graphite-700/60 hover:text-ink-200"
      )}
    >
      {active && (
        <span
          className={cn(
            "absolute rounded-r bg-signal-500",
            collapsed ? "left-0 top-1/2 h-5 w-[2px] -translate-y-1/2" : "left-0 top-1/2 h-5 w-[2px] -translate-y-1/2"
          )}
          aria-hidden
        />
      )}
      <Icon size={16} strokeWidth={1.75} className="shrink-0" />
      {!collapsed && <span className="truncate font-medium">{label}</span>}
    </Link>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const collapsed = useAppStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useAppStore((s) => s.toggleSidebar);

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  return (
    <aside
      className={cn(
        "hidden shrink-0 flex-col border-r border-graphite-800 bg-graphite-900 py-4 transition-[width] duration-200 md:flex",
        collapsed ? "w-16 px-2" : "w-[216px] px-3"
      )}
    >
      <div className={cn("mb-4 flex items-center gap-2 px-1", collapsed && "justify-center px-0")}>
        <div className="mono-value flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-signal-500/15 text-[11px] font-semibold text-signal-400">
          BC
        </div>
        {!collapsed && <span className="truncate text-[13px] font-medium text-ink-50">Praman Setu</span>}
      </div>

      <nav className="flex flex-1 flex-col gap-1">
        {modules.map((m) => (
          <NavItem key={m.href} {...m} collapsed={collapsed} active={isActive(m.href)} />
        ))}
      </nav>

      <button
        type="button"
        onClick={toggleSidebar}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        className={cn(
          "mt-2 flex items-center gap-2 rounded-lg px-3 py-2 text-[12px] text-ink-600 transition-colors hover:bg-graphite-700/60 hover:text-ink-300",
          collapsed && "justify-center px-0"
        )}
      >
        {collapsed ? <ChevronsRight size={15} /> : <ChevronsLeft size={15} />}
        {!collapsed && <span>Collapse</span>}
      </button>
    </aside>
  );
}

export function MobileNav() {
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-around border-t border-graphite-800 bg-graphite-900/95 py-1.5 backdrop-blur md:hidden">
      {modules.slice(0, 5).map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          aria-label={label}
          className={cn(
            "flex flex-col items-center gap-0.5 rounded-lg px-2.5 py-1.5 text-[10px]",
            isActive(href) ? "text-signal-400" : "text-ink-500"
          )}
        >
          <Icon size={18} strokeWidth={1.75} />
          <span className="truncate">{label.split(" ")[0]}</span>
        </Link>
      ))}
    </nav>
  );
}
