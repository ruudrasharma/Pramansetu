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
import { useDidService } from "@/lib/services/didService";
import { useCurrentIdentity } from "@/lib/hooks/useCurrentIdentity";
import { dataMode } from "@/lib/services/dataMode";

// Ordered longest-prefix-first: pathname.startsWith matches the first entry whose href is a
// prefix, so a more specific route (e.g. "/governance/disputes") must appear before its parent
// ("/governance") or it would always resolve to the parent's title instead of its own.
const titles: Record<string, string> = {
  "/": "Welcome",
  "/dashboard": "Dashboard",
  "/identity": "Identity",
  "/roles": "Roles & Access",
  "/assets": "Assets",
  "/governance/disputes": "Dispute Resolution",
  "/governance": "Governance",
  "/oracle/facts": "Oracle Attestation",
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
  const { did: myDid, address: myAddress, isResolving: isResolvingMe } = useCurrentIdentity();
  const didService = useDidService(myDid);
  const me = dataMode === "onchain" ? didService.resolveDID() : undefined;

  const openAlerts = getAnomalies().filter((a) => a.status === "open");
  const openAlertCount = openAlerts.length;
  const activeIdentity = identityByRole[activeRole];

  const title =
    Object.entries(titles).find(([href]) => (href === "/" ? pathname === "/" : pathname.startsWith(href)))?.[1] ??
    "Dashboard";

  return (
    <header className="flex h-16 shrink-0 items-center justify-between bg-graphite-950/80 px-4 backdrop-blur md:px-6">
      <div>
        <h1 className="text-[17px] font-semibold text-ink-50">{title}</h1>
        <div className="mt-0.5 flex items-center gap-1.5 text-[12px] text-ink-400">
          <Circle size={6} className="fill-current text-verified-500" />
          Live · Ethereum Sepolia
        </div>
      </div>

      <div className="flex items-center gap-2 md:gap-3">
        {/* ⌘K / search pill */}
        <button
          onClick={() => commandPaletteSignal.open()}
          className="hidden items-center gap-2 rounded-full bg-graphite-900 px-4 py-2 text-[13px] text-ink-400 shadow-panel transition-colors hover:text-ink-200 lg:flex"
          aria-label="Open command palette"
        >
          <Search size={14} strokeWidth={1.75} />
          <span>Search or run a command</span>
          <kbd className="mono-value ml-2 rounded-full bg-graphite-700 px-2 py-0.5 text-[11px] text-ink-400">
            ⌘K
          </kbd>
        </button>

        {/* Role switcher — mock-mode-only demo feature (lib/store/appStore.ts). In onchain
            mode "who am I" comes from the real connected wallet, not a persona picker — see
            lib/hooks/useCurrentIdentity.ts — so switching roles here would be dishonest. */}
        {dataMode === "onchain" ? (
          <div
            className="flex items-center gap-2 rounded-full bg-graphite-900 px-3 py-1.5 text-[13px] text-ink-200 shadow-panel"
            title="Role switching is a mock-mode demo feature. Connect the wallet holding the role you want to demonstrate."
          >
            <Fingerprint size={14} className="text-signal-500" />
            <span className="hidden sm:inline">
              {isResolvingMe ? "Resolving…" : myAddress ? truncateMiddle(myAddress, 6, 4) : "Not connected"}
            </span>
            {me && <Badge tone="signal" className="hidden md:inline-flex">{ROLE_LABEL[me.role]}</Badge>}
          </div>
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-2 rounded-full bg-graphite-900 px-3 py-1.5 text-[13px] text-ink-200 shadow-panel transition-colors hover:text-ink-50">
              <Fingerprint size={14} className="text-signal-500" />
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
        )}

        <ThemeToggle />

        {/* Notification bell — unread count = open anomaly alerts. Opens a real preview panel
            of those same alerts (getAnomalies() above), not just a static badge — previously
            the badge counted real alerts but clicking it opened nothing anywhere in the
            viewport (found live 2026-09-11, T-066). */}
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label={`${openAlertCount} open anomaly alerts`}
            className="relative flex h-9 w-9 items-center justify-center rounded-full text-ink-400 transition-colors hover:bg-graphite-700/60 hover:text-ink-200"
          >
            <Bell size={15} strokeWidth={1.75} />
            {openAlertCount > 0 && (
              <span className="absolute right-1 top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-danger-500 text-[9px] font-semibold text-white">
                {openAlertCount}
              </span>
            )}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <DropdownMenuLabel>Anomaly alerts</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {openAlerts.length === 0 ? (
              <p className="px-2.5 py-3 text-[12px] text-ink-500">No open anomaly alerts.</p>
            ) : (
              openAlerts.slice(0, 5).map((alert) => (
                <DropdownMenuItem key={alert.id} asChild>
                  <a href="/audit/anomalies" className="flex-col items-start gap-0.5">
                    <span className="text-ink-50">{alert.rule}</span>
                    <span className="line-clamp-1 text-[11px] text-ink-500">{alert.detail}</span>
                  </a>
                </DropdownMenuItem>
              ))
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <a href="/audit/anomalies" className="justify-center text-signal-400">
                View all anomaly alerts
              </a>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* WalletConnect button — real Web3 auth path, independent of the demo role switcher */}
        <w3m-button />
      </div>
    </header>
  );
}
