"use client";

import { useEffect, useState, useCallback } from "react";
import { Command } from "cmdk";
import { useRouter } from "next/navigation";
import {
  Fingerprint,
  ShieldCheck,
  Boxes,
  Landmark,
  ScrollText,
  LayoutGrid,
  Search,
  ArrowRight,
  Coins,
  UserPlus,
  ShieldAlert,
  FileCheck,
} from "lucide-react";
import { commandPaletteSignal } from "@/lib/commandPaletteSignal";

/**
 * CommandPalette — ⌘K global action surface (UI_UX_SPEC.md §1 Context Bar).
 *
 * Opens via:
 *   1. ⌘K / Ctrl+K keyboard shortcut (global keydown listener)
 *   2. commandPaletteSignal.open() fired by the TopBar ⌘K button
 *
 * Groups: Navigate · Identity · Access Control · Assets · Governance
 * Fuzzy search across label + description + keywords via cmdk's built-in filter.
 */

type CommandItem = {
  id: string;
  label: string;
  description?: string;
  icon: React.ElementType;
  group: string;
  action: () => void;
  keywords?: string[];
};

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  const navigate = useCallback(
    (href: string) => {
      setOpen(false);
      router.push(href);
    },
    [router]
  );

  // ── Open triggers ──────────────────────────────────────────────────────
  // 1. ⌘K / Ctrl+K keyboard shortcut
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    }
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  // 2. Signal from TopBar button click
  useEffect(() => {
    return commandPaletteSignal.listen(() => setOpen(true));
  }, []);

  const commands: CommandItem[] = [
    // ── Navigate ──────────────────────────────────────────────────────────
    {
      id: "nav-overview",
      label: "Dashboard",
      description: "Platform health + live ledger stream",
      icon: LayoutGrid,
      group: "Navigate",
      action: () => navigate("/dashboard"),
    },
    {
      id: "nav-identity",
      label: "Identity",
      description: "DID registry, credentials, guardian recovery",
      icon: Fingerprint,
      group: "Navigate",
      action: () => navigate("/identity"),
    },
    {
      id: "nav-access",
      label: "Roles & Access",
      description: "Time-bound role matrix + multisig grants",
      icon: ShieldCheck,
      group: "Navigate",
      action: () => navigate("/roles"),
    },
    {
      id: "nav-assets",
      label: "Assets",
      description: "Digital asset registry + dual-attestation mint",
      icon: Boxes,
      group: "Navigate",
      action: () => navigate("/assets"),
    },
    {
      id: "nav-governance",
      label: "Governance",
      description: "Multisig queue + timelock + disputes",
      icon: Landmark,
      group: "Navigate",
      action: () => navigate("/governance"),
    },
    {
      id: "nav-audit",
      label: "Audit Log",
      description: "Filterable full event history",
      icon: ScrollText,
      group: "Navigate",
      action: () => navigate("/audit"),
    },

    // ── Identity ─────────────────────────────────────────────────────────
    {
      id: "action-create-did",
      label: "Create Identity (DID)",
      description: "Register a new DID on-chain via DIDRegistry.createDID",
      icon: UserPlus,
      group: "Identity",
      action: () => navigate("/identity?action=create"),
      keywords: ["register", "did", "identity", "new user", "onboard"],
    },
    {
      id: "action-register-guardians",
      label: "Register Guardians",
      description: "Set M-of-N guardian set for recovery",
      icon: ShieldAlert,
      group: "Identity",
      action: () => navigate("/identity?action=guardians"),
      keywords: ["guardian", "recovery", "backup", "m-of-n"],
    },

    // ── Access Control ───────────────────────────────────────────────────
    {
      id: "action-grant-role",
      label: "Grant Timed Role",
      description: "Propose a 2-of-N timed role grant (requires co-signature)",
      icon: FileCheck,
      group: "Access Control",
      action: () => navigate("/roles?action=grant"),
      keywords: ["grant", "role", "rbac", "admin", "permission", "timed"],
    },
    {
      id: "action-emergency",
      label: "Propose Platform Action",
      description: "Propose emergencyRevoke / pause — requires 2 Super Admin sigs",
      icon: ShieldAlert,
      group: "Access Control",
      action: () => navigate("/roles?action=platform-action"),
      keywords: ["pause", "freeze", "emergency", "revoke", "super admin"],
    },

    // ── Assets ───────────────────────────────────────────────────────────
    {
      id: "action-propose-mint",
      label: "Propose Asset Mint",
      description: "Begin dual-attestation mint flow (Admin → Manager co-sign)",
      icon: Coins,
      group: "Assets",
      action: () => navigate("/assets?action=mint"),
      keywords: ["mint", "asset", "token", "nft", "propose"],
    },
    {
      id: "action-raise-dispute",
      label: "Raise Governance Dispute",
      description: "Freeze a queued governance action (Auditor role required)",
      icon: ArrowRight,
      group: "Governance",
      action: () => navigate("/governance?action=dispute"),
      keywords: ["dispute", "freeze", "audit", "flag"],
    },
  ];

  const groups = Array.from(new Set(commands.map((c) => c.group)));

  if (!open) return null;

  return (
    // Backdrop — full-screen dim with blur so underlying content stays visible
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]"
      onClick={() => setOpen(false)}
      aria-modal="true"
      role="dialog"
      aria-label="Command palette"
    >
      {/* Blurred backdrop */}
      <div className="absolute inset-0 bg-graphite-950/70 backdrop-blur-sm" />

      {/* Palette panel */}
      <div
        className="relative w-full max-w-[600px] overflow-hidden rounded-2xl border border-graphite-700 bg-graphite-900 shadow-2xl shadow-black/60"
        onClick={(e) => e.stopPropagation()}
      >
        <Command label="Command palette" shouldFilter={true} loop>
          {/* Search input */}
          <div className="flex items-center border-b border-graphite-800 px-4">
            <Search size={16} className="shrink-0 text-ink-400" />
            <Command.Input
              placeholder="Search or run a command…"
              className="w-full bg-transparent px-3 py-4 text-[14px] text-ink-50 placeholder:text-ink-600 focus:outline-none"
              autoFocus
            />
          </div>

          <Command.List className="max-h-[360px] overflow-y-auto py-2">
            <Command.Empty className="py-8 text-center text-[13px] text-ink-600">
              No matching commands
            </Command.Empty>

            {groups.map((group) => (
              <Command.Group
                key={group}
                heading={group}
                className="[&_[cmdk-group-heading]]:px-4 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-widest [&_[cmdk-group-heading]]:text-ink-600"
              >
                {commands
                  .filter((c) => c.group === group)
                  .map(({ id, label, description, icon: Icon, action, keywords }) => (
                    <Command.Item
                      key={id}
                      value={[label, description, ...(keywords ?? [])].join(" ")}
                      onSelect={action}
                      className="mx-2 flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] text-ink-200 transition-colors aria-selected:bg-graphite-800 aria-selected:text-ink-50"
                    >
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-graphite-800 text-ink-400 aria-selected:text-signal-400">
                        <Icon size={14} strokeWidth={1.75} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium leading-snug">{label}</p>
                        {description && (
                          <p className="truncate text-[12px] text-ink-600 leading-snug mt-0.5">
                            {description}
                          </p>
                        )}
                      </div>
                      <ArrowRight size={13} className="shrink-0 text-ink-700" />
                    </Command.Item>
                  ))}
              </Command.Group>
            ))}
          </Command.List>

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-graphite-800 px-4 py-2">
            <span className="text-[11px] text-ink-600">
              Cipherloom · PS 26125
            </span>
            <div className="flex items-center gap-3 text-[11px] text-ink-600">
              <span><kbd className="mono-value rounded border border-graphite-700 bg-graphite-800 px-1.5 py-0.5">↑↓</kbd> navigate</span>
              <span><kbd className="mono-value rounded border border-graphite-700 bg-graphite-800 px-1.5 py-0.5">↵</kbd> select</span>
              <span><kbd className="mono-value rounded border border-graphite-700 bg-graphite-800 px-1.5 py-0.5">esc</kbd> close</span>
            </div>
          </div>
        </Command>
      </div>
    </div>
  );
}
