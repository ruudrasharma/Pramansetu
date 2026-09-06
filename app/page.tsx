"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { auditEvents, systemHealth, identities, governanceItems, type EventType, type AuditEvent } from "@/lib/mock-data";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EventRow } from "@/components/modules/EventRow";
import { DetailPanelProvider } from "@/components/shell/DetailPanelContext";
import { DetailPanel } from "@/components/shell/DetailPanel";
import { Fingerprint, Hourglass, Landmark, Octagon, RefreshCw } from "lucide-react";

const healthCards = [
  {
    label: "Active identities",
    value: systemHealth.activeIdentities,
    icon: Fingerprint,
    tone: "text-signal-400 bg-signal-500/10",
  },
  {
    label: "Roles expiring < 24h",
    value: systemHealth.expiringIn24h,
    icon: Hourglass,
    tone: "text-alert-400 bg-alert-500/10",
  },
  {
    label: "Pending governance",
    value: systemHealth.pendingGovernance,
    icon: Landmark,
    tone: "text-verified-400 bg-verified-500/10",
  },
  {
    label: "Platform status",
    value: systemHealth.platformPaused ? "Paused" : "Operational",
    icon: Octagon,
    tone: systemHealth.platformPaused
      ? "text-danger-400 bg-danger-500/10"
      : "text-verified-400 bg-verified-500/10",
  },
];

/**
 * OverviewPage — the live command center.
 *
 * The ledger stream is wrapped in AnimatePresence so each event row animates
 * in with an upward slide + fade as it "arrives from the chain" (UI_UX_SPEC.md §1 Motion).
 * Clicking any row opens the DetailPanel slide-in without hiding this stream.
 */
export default function OverviewPage() {
  // Simulate live stream: prepend a synthetic event on "Refresh"
  const [events, setEvents] = useState(
    [...auditEvents].sort((a, b) => b.timestamp - a.timestamp)
  );

  function simulateLiveEvent() {
    const syntheticTypes: EventType[] = ["DIDCreated", "RoleGranted", "AssetMinted", "CredentialIssued"];
    const type = syntheticTypes[Math.floor(Math.random() * syntheticTypes.length)] ?? "DIDCreated";
    const newEvent: AuditEvent = {
      id: `evt-live-${Date.now()}`,
      type,
      actorDid: identities[0]?.did ?? "did:ethr:0x0000",
      summary: `[LIVE] ${type} event arrived from chain`,
      timestamp: Date.now(),
      txHash: `0x${Math.random().toString(16).slice(2, 6)}…${Math.random().toString(16).slice(2, 6)}`,
    };
    setEvents((prev) => [newEvent, ...prev].slice(0, 30));
  }

  return (
    <DetailPanelProvider>
      <div className="mx-auto max-w-7xl px-6 py-6">
        {/* Health strip */}
        <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {healthCards.map(({ label, value, icon: Icon, tone }) => (
            <motion.div
              key={label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 280, damping: 26 }}
            >
              <Card className="p-4">
                <div className="flex items-center justify-between">
                  <p className="text-[12px] text-ink-400">{label}</p>
                  <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${tone}`}>
                    <Icon size={14} strokeWidth={1.75} />
                  </div>
                </div>
                <p className="mt-2 text-[26px] font-medium leading-none text-ink-50">{value}</p>
              </Card>
            </motion.div>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_320px]">
          {/* Ledger stream */}
          <Card>
            <div className="mb-1 flex items-center justify-between">
              <h2 className="text-[14px] font-medium text-ink-50">Ledger stream</h2>
              <div className="flex items-center gap-3">
                <span className="text-[12px] text-ink-600">Newest first · live from chain events</span>
                {/* Simulate a live event arriving — demonstrates AnimatePresence */}
                <button
                  onClick={simulateLiveEvent}
                  title="Simulate incoming chain event"
                  className="flex items-center gap-1.5 rounded-lg border border-graphite-700 bg-graphite-900 px-2.5 py-1 text-[12px] text-ink-400 transition-colors hover:border-graphite-600 hover:text-ink-200"
                >
                  <RefreshCw size={11} strokeWidth={1.75} />
                  Simulate
                </button>
              </div>
            </div>
            {/* AnimatePresence makes each new event slide in from top (UI_UX_SPEC §1 Motion) */}
            <AnimatePresence initial={false}>
              {events.map((event, i) => (
                <EventRow key={event.id} event={event} index={i} />
              ))}
            </AnimatePresence>
          </Card>

          {/* Right column */}
          <div className="flex flex-col gap-5">
            <Card>
              <h2 className="mb-3 text-[14px] font-medium text-ink-50">Roles expiring soon</h2>
              <div className="flex flex-col gap-3">
                {identities
                  .filter((i) => i.roleExpiresAt > Date.now())
                  .sort((a, b) => a.roleExpiresAt - b.roleExpiresAt)
                  .slice(0, 3)
                  .map((identity) => (
                    <div key={identity.did} className="flex items-center justify-between text-[13px]">
                      <span className="mono-value truncate text-ink-200">
                        {identity.did.slice(0, 14)}…
                      </span>
                      <Badge tone="alert">{identity.role}</Badge>
                    </div>
                  ))}
              </div>
            </Card>

            <Card>
              <h2 className="mb-3 text-[14px] font-medium text-ink-50">Governance queue</h2>
              <div className="flex flex-col gap-3">
                {governanceItems.map((item) => (
                  <div key={item.id} className="text-[13px]">
                    <p className="truncate text-ink-200">{item.title}</p>
                    <Badge tone={item.status === "disputed" ? "danger" : "signal"} className="mt-1">
                      {item.status}
                    </Badge>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      </div>

      {/* Detail panel — renders alongside content, not over it */}
      <DetailPanel />
    </DetailPanelProvider>
  );
}
