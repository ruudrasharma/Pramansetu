"use client";

import { usePathname } from "next/navigation";
import { Search, Circle, Bell, ChevronDown, Fingerprint } from "lucide-react";
import { cn, truncateMiddle } from "@/lib/utils";
import { commandPaletteSignal } from "@/lib/commandPaletteSignal";
import { ThemeToggle } from "@/components/shell/ThemeToggle";
import { Badge } from "@/components/ui/Badge";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/DropdownMenu";
import { useAppStore } from "@/lib/store/appStore";
import { identityByRole, ROLE_LABEL, type Role } from "@/lib/mock/fixtures";
import { useAuditService } from "@/lib/services/auditService";

const titles: Record<string, string> = {
  "/": "Welcome",
  "/dashboard": "Dashboard",
  "/identity": "Identity",
  "/roles": "Roles & Access",
  "/assets": "Assets",
  "/governance": "Governance",
  "/audit": "Audit & Anomalies",
  "/settings": "Settings",
  "/compliance": "Compliance",
};

const roles: Role[] = ["SUPER_ADMIN", "ADMIN", "MANAGER", "AUDITOR", "USER"];

export function TopBar() {
  const pathname = usePathname();
  const activeRole = useAppStore((s) => s.activeRole);
  const setActiveRole = useAppStore((s) => s.setActiveRole);
  const { getAnomalies } = useAuditService();

  const openAlertCount = getAnomalies().filter((a) => a.status === "open").length;
  const activeIdentity = identityByRole[activeRole];

  const title =
    Object.entries(titles).find(([href]) => (href === "/" ? pathname === "/" : pathname.startsWith(href)))?.[1] ??
    "Dashboard";

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-graphite-800 bg-graphite-950/80 px-4 backdrop-blur md:px-6">
      <div className="flex items-center gap-3">
        <h1 className="text-[15px] font-medium text-ink-50">{title}</h1>
        <span className="hidden h-1 w-1 rounded-full bg-graphite-700 sm:inline-block" aria-hidden />
        <div className="hidden items-center gap-1.5 text-[13px] text-ink-400 sm:flex">
          <Circle size={7} className="fill-current text-verified-500" />
          Live · Ethereum Sepolia
        </div>
      </div>

      <div className="flex items-center gap-2 md:gap-3">
        {/* ⌘K button */}
        <button
          onClick={() => commandPaletteSignal.open()}
          className="hidden items-center gap-2 rounded-lg border border-graphite-700 bg-graphite-900 px-3 py-1.5 text-[13px] text-ink-400 transition-colors hover:border-graphite-600 hover:text-ink-200 lg:flex"
          aria-label="Open command palette"
        >
          <Search size={14} strokeWidth={1.75} />
          <span>Search or run a command</span>
          <kbd className="mono-value ml-2 rounded border border-graphite-700 bg-graphite-800 px-1.5 py-0.5 text-[11px] text-ink-400">
            ⌘K
          </kbd>
        </button>

        {/* Role switcher — demo mode, independent of the connected wallet */}
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2 rounded-lg border border-graphite-700 bg-graphite-900 px-2.5 py-1.5 text-[13px] text-ink-200 transition-colors hover:border-graphite-600">
            <Fingerprint size={14} className="text-signal-400" />
            <span className="hidden sm:inline">{activeIdentity.name}</span>
            <Badge tone="signal" className="hidden md:inline-flex">{ROLE_LABEL[activeRole]}</Badge>
            <ChevronDown size={13} className="text-ink-600" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>View app as</DropdownMenuLabel>
            {roles.map((role) => (
              <DropdownMenuItem key={role} onSelect={() => setActiveRole(role)} className={cn(role === activeRole && "bg-graphite-700/60")}>
                <div className="flex flex-1 items-center justify-between">
                  <div>
                    <p className="text-ink-50">{identityByRole[role].name}</p>
                    <p className="text-[11px] text-ink-500">{identityByRole[role].department}</p>
                  </div>
                  <Badge tone={role === activeRole ? "signal" : "neutral"}>{ROLE_LABEL[role]}</Badge>
                </div>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <p className="px-2.5 pb-1 text-[11px] text-ink-600">
              DID: <span className="mono-value">{truncateMiddle(activeIdentity.did, 10, 4)}</span>
            </p>
          </DropdownMenuContent>
        </DropdownMenu>

        <ThemeToggle />

        {/* Notification bell — unread count = open anomaly alerts */}
        <button
          aria-label={`${openAlertCount} open anomaly alerts`}
          className="relative flex h-8 w-8 items-center justify-center rounded-lg text-ink-400 transition-colors hover:bg-graphite-800 hover:text-ink-200"
        >
          <Bell size={15} strokeWidth={1.75} />
          {openAlertCount > 0 && (
            <span className="absolute right-1 top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-danger-500 text-[9px] font-semibold text-white">
              {openAlertCount}
            </span>
          )}
        </button>

        {/* WalletConnect button — real Web3 auth path, independent of the demo role switcher */}
        <w3m-button />
      </div>
    </header>
  );
}
