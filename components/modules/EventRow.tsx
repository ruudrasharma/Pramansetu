"use client";

import { motion } from "framer-motion";
import {
  Fingerprint,
  KeyRound,
  BadgeCheck,
  ShieldCheck,
  Hourglass,
  Boxes,
  ArrowRightLeft,
  Octagon,
  Flag,
  Users,
  ShieldOff,
  CheckCircle2,
  XCircle,
  Radio,
} from "lucide-react";
import type { AuditEvent, EventType } from "@/lib/mock/fixtures";
import { formatRelativeTime, truncateMiddle } from "@/lib/utils";
import { useDetailPanel } from "@/components/shell/DetailPanelContext";

/**
 * EventRow — a single row in the live ledger stream.
 *
 * Motion (UI_UX_SPEC.md §1 Motion):
 *   - index=0 (newest event): slides up from y=−12 + fade in, spring stiffness 300 damping 30
 *   - Existing events: no re-animation (initial={false})
 *
 * Clicking a row opens the DetailPanel with the full decoded event payload.
 * The row has a subtle hover state (1px border color shift, 80ms) — no scale-up per spec.
 */

const eventMeta: Record<EventType, { icon: typeof Fingerprint; tone: string }> = {
  DIDCreated:         { icon: Fingerprint,     tone: "text-signal-400 bg-signal-500/10" },
  KeyRotated:         { icon: KeyRound,        tone: "text-alert-400 bg-alert-500/10" },
  CredentialIssued:   { icon: BadgeCheck,      tone: "text-verified-400 bg-verified-500/10" },
  CredentialRevoked:  { icon: XCircle,         tone: "text-danger-400 bg-danger-500/10" },
  RoleGranted:        { icon: ShieldCheck,     tone: "text-signal-400 bg-signal-500/10" },
  RoleRevoked:        { icon: ShieldOff,       tone: "text-danger-400 bg-danger-500/10" },
  RoleExpired:        { icon: Hourglass,       tone: "text-ink-400 bg-graphite-800" },
  AssetMinted:        { icon: Boxes,           tone: "text-verified-400 bg-verified-500/10" },
  AssetTransferred:   { icon: ArrowRightLeft,  tone: "text-signal-400 bg-signal-500/10" },
  EmergencyPaused:    { icon: Octagon,         tone: "text-danger-400 bg-danger-500/10" },
  DisputeRaised:      { icon: Flag,            tone: "text-alert-400 bg-alert-500/10" },
  GovernanceExecuted: { icon: CheckCircle2,    tone: "text-verified-400 bg-verified-500/10" },
  GuardianRegistered: { icon: Users,           tone: "text-ink-400 bg-graphite-800" },
  RecoveryInitiated:  { icon: ShieldOff,       tone: "text-alert-400 bg-alert-500/10" },
  RecoveryFinalized:  { icon: CheckCircle2,    tone: "text-verified-400 bg-verified-500/10" },
  OracleFactSubmitted:  { icon: Radio,         tone: "text-ink-400 bg-graphite-800" },
  OracleFactAttested:   { icon: Radio,         tone: "text-signal-400 bg-signal-500/10" },
  OracleFactDisputed:   { icon: Flag,          tone: "text-alert-400 bg-alert-500/10" },
  OracleFactFinalized:  { icon: CheckCircle2,  tone: "text-verified-400 bg-verified-500/10" },
  OracleFactRejected:   { icon: XCircle,       tone: "text-danger-400 bg-danger-500/10" },
};

export function EventRow({ event, index = 0 }: { event: AuditEvent; index?: number }) {
  const meta = eventMeta[event.type] ?? { icon: Fingerprint, tone: "text-ink-400 bg-graphite-800" };
  const { icon: Icon, tone } = meta;
  const { openPanel } = useDetailPanel();

  return (
    <motion.div
      layout
      key={event.id}
      initial={index === 0 ? { opacity: 0, y: -12 } : false}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      onClick={() => openPanel(event)}
      className="group flex cursor-pointer items-start gap-3 border-b border-graphite-800 py-3 last:border-none transition-colors duration-75 hover:bg-graphite-800/30 px-1 rounded"
      role="button"
      tabIndex={0}
      aria-label={`View details for ${event.type} event`}
      onKeyDown={(e) => e.key === "Enter" && openPanel(event)}
    >
      <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${tone}`}>
        <Icon size={14} strokeWidth={1.75} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] text-ink-50 group-hover:text-ink-50">{event.summary}</p>
        <div className="mt-0.5 flex items-center gap-2 text-[11px] text-ink-600">
          <span className="mono-value">{truncateMiddle(event.actorDid ?? event.actorAddress ?? "", 12, 4)}</span>
          <span>·</span>
          <span className="mono-value">{truncateMiddle(event.txHash, 8, 6)}</span>
        </div>
      </div>
      <span className="mono-value shrink-0 text-[11px] text-ink-600">
        {formatRelativeTime(event.timestamp)}
      </span>
    </motion.div>
  );
}
