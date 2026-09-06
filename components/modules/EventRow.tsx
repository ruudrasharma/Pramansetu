"use client";

import { motion } from "framer-motion";
import {
  Fingerprint,
  BadgeCheck,
  ShieldCheck,
  Hourglass,
  Boxes,
  ArrowRightLeft,
  Octagon,
  Flag,
  Users,
} from "lucide-react";
import type { AuditEvent, EventType } from "@/lib/mock-data";
import { formatRelativeTime, truncateMiddle } from "@/lib/utils";

const eventMeta: Record<EventType, { icon: typeof Fingerprint; tone: string }> = {
  DIDCreated: { icon: Fingerprint, tone: "text-signal-400 bg-signal-500/10" },
  CredentialIssued: { icon: BadgeCheck, tone: "text-verified-400 bg-verified-500/10" },
  RoleGranted: { icon: ShieldCheck, tone: "text-signal-400 bg-signal-500/10" },
  RoleExpired: { icon: Hourglass, tone: "text-ink-400 bg-graphite-800" },
  AssetMinted: { icon: Boxes, tone: "text-verified-400 bg-verified-500/10" },
  AssetTransferred: { icon: ArrowRightLeft, tone: "text-signal-400 bg-signal-500/10" },
  EmergencyPaused: { icon: Octagon, tone: "text-danger-400 bg-danger-500/10" },
  DisputeRaised: { icon: Flag, tone: "text-alert-400 bg-alert-500/10" },
  GuardianRegistered: { icon: Users, tone: "text-ink-400 bg-graphite-800" },
};

export function EventRow({ event, index = 0 }: { event: AuditEvent; index?: number }) {
  const { icon: Icon, tone } = eventMeta[event.type];

  return (
    <motion.div
      initial={index === 0 ? { opacity: 0, y: -12 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="flex items-start gap-3 border-b border-graphite-800 py-3 last:border-none"
    >
      <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${tone}`}>
        <Icon size={14} strokeWidth={1.75} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] text-ink-50">{event.summary}</p>
        <div className="mt-0.5 flex items-center gap-2 text-[11px] text-ink-600">
          <span className="mono-value">{truncateMiddle(event.actorDid, 12, 4)}</span>
          <span>·</span>
          <span className="mono-value">{event.txHash}</span>
        </div>
      </div>
      <span className="mono-value shrink-0 text-[11px] text-ink-600">
        {formatRelativeTime(event.timestamp)}
      </span>
    </motion.div>
  );
}
