"use client";

import { AnimatePresence, motion } from "framer-motion";
import { X, ExternalLink, Copy, CheckCheck } from "lucide-react";
import { useState } from "react";
import { useDetailPanel } from "./DetailPanelContext";
import { Badge } from "@/components/ui/Badge";
import { formatDistanceToNow } from "date-fns";

/**
 * DetailPanel — right-hand slide-in panel (UI_UX_SPEC.md §1 Layout Shape).
 *
 * Renders ALONGSIDE the primary content, NOT as a modal overlay. The primary
 * list/stream remains visible and interactive underneath — reinforcing
 * "nothing here is ever the only copy of the truth."
 *
 * Motion: slides in from the right with a spring (stiffness 300, damping 28).
 * The backdrop dims the content area slightly but remains partially transparent.
 */

const TONE_MAP: Record<string, "signal" | "verified" | "alert" | "danger"> = {
  DIDCreated: "signal",
  RoleGranted: "verified",
  RoleRevoked: "danger",
  CredentialIssued: "verified",
  CredentialRevoked: "danger",
  AssetMinted: "signal",
  GuardianRegistered: "alert",
  RecoveryInitiated: "alert",
  RecoveryFinalized: "verified",
  DisputeRaised: "danger",
  GovernanceExecuted: "verified",
  EmergencyPaused: "danger",
};

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }
  return (
    <button
      onClick={copy}
      className="ml-1.5 inline-flex h-5 w-5 items-center justify-center rounded text-ink-600 transition-colors hover:text-ink-200"
      aria-label="Copy to clipboard"
    >
      {copied ? <CheckCheck size={12} /> : <Copy size={12} />}
    </button>
  );
}

function FieldRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5 py-3 border-b border-graphite-800 last:border-0">
      <span className="text-[11px] uppercase tracking-widest font-semibold text-ink-600">{label}</span>
      <div className="flex items-start">
        <span className={`text-[13px] break-all text-ink-200 ${mono ? "mono-value" : ""}`}>
          {value}
        </span>
        {mono && <CopyButton value={value} />}
      </div>
    </div>
  );
}

export function DetailPanel() {
  const { event, isOpen, closePanel } = useDetailPanel();
  const tone = event ? (TONE_MAP[event.type] ?? "signal") : "signal";

  return (
    <AnimatePresence>
      {isOpen && event && (
        <>
          {/* Backdrop — partial dim only, content stays visible */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-30 bg-graphite-950/40"
            onClick={closePanel}
          />

          {/* Slide-in panel */}
          <motion.aside
            key="panel"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 300, damping: 28 }}
            className="fixed right-0 top-0 z-40 flex h-full w-[380px] flex-col border-l border-graphite-800 bg-graphite-900 shadow-2xl shadow-black/50"
            aria-label="Event detail panel"
          >
            {/* Header */}
            <div className="flex h-14 shrink-0 items-center justify-between border-b border-graphite-800 px-5">
              <div className="flex items-center gap-2">
                <Badge tone={tone}>{event.type}</Badge>
              </div>
              <button
                onClick={closePanel}
                className="flex h-7 w-7 items-center justify-center rounded-full text-ink-400 transition-colors hover:bg-graphite-700/60 hover:text-ink-200"
                aria-label="Close panel"
              >
                <X size={16} strokeWidth={1.75} />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-5 py-2">
              <p className="mt-1 text-[14px] font-medium text-ink-50 leading-snug">
                {event.summary}
              </p>
              <p className="mt-1 text-[12px] text-ink-600">
                {formatDistanceToNow(new Date(event.timestamp), { addSuffix: true })}
              </p>

              <div className="mt-5">
                <FieldRow label="Event ID" value={event.id} />
                <FieldRow
                  label={event.actorDid ? "Actor DID" : "Actor address"}
                  value={event.actorDid ?? event.actorAddress ?? "unknown"}
                  mono
                />
                <FieldRow
                  label="Timestamp"
                  value={new Date(event.timestamp).toISOString()}
                  mono
                />
                <FieldRow label="Tx Hash" value={event.txHash} mono />
                {event.riskScore !== undefined && (
                  <FieldRow
                    label="Risk Score"
                    value={`${event.riskScore}/100`}
                  />
                )}
              </div>
            </div>

            {/* Footer — link to block explorer */}
            <div className="shrink-0 border-t border-graphite-800 p-4">
              <a
                href={`https://sepolia.etherscan.io/tx/${event.txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-graphite-700 bg-graphite-800 px-4 py-2 text-[13px] text-ink-400 transition-colors hover:border-graphite-600 hover:text-ink-200"
              >
                <ExternalLink size={13} strokeWidth={1.75} />
                View on Etherscan
              </a>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
