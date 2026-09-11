"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Fingerprint, Hourglass, Landmark, Octagon, RefreshCw, Boxes, TriangleAlert } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { StatCard } from "@/components/ui/StatCard";
import { AreaChartCard } from "@/components/ui/AreaChartCard";
import { DateStrip, type DateStripItem } from "@/components/ui/DateStrip";
import { EventRow } from "@/components/modules/EventRow";
import { RoleBadge } from "@/components/modules/RoleBadge";
import { AlertCard } from "@/components/modules/AlertCard";
import { useAppStore } from "@/lib/store/appStore";
import { identityByRole, type EventType, type AuditEvent } from "@/lib/mock/fixtures";
import { useAuditService } from "@/lib/services/auditService";
import { useAssetService } from "@/lib/services/assetService";
import { useRbacService } from "@/lib/services/rbacService";
import { useGovernanceService } from "@/lib/services/governanceService";
import { useDidService } from "@/lib/services/didService";
import { useCurrentIdentity } from "@/lib/hooks/useCurrentIdentity";
import { dataMode } from "@/lib/services/dataMode";
import { truncateMiddle } from "@/lib/utils";

const DAY_MS = 24 * 3_600_000;

function startOfDay(ts: number) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/**
 * DashboardPage — the live command center, role-aware via the demo role switcher.
 * The ledger stream is wrapped in AnimatePresence so each event row animates in with an
 * upward slide + fade as it "arrives from the chain" (UI_UX_SPEC.md §1 Motion).
 */
export default function DashboardPage() {
  const activeRole = useAppStore((s) => s.activeRole);
  // Was unconditionally `identityByRole[activeRole]` (the mock role-switcher persona) regardless
  // of dataMode — the one real page in this app never wired to the real connected wallet, unlike
  // /roles, /identity, /governance (see those files for the same pattern followed here). In
  // onchain mode this showed a fabricated "Welcome back, <mock name>" greeting and mock role
  // gates no matter who was actually connected.
  const { did: myDid, address: myAddress, isResolving: isResolvingMe, hasNoDid } = useCurrentIdentity();
  const meMock = identityByRole[activeRole];
  const me = dataMode === "onchain" ? { did: myDid ?? "" } : meMock;
  const didService = useDidService(myDid);
  const myRealIdentity = dataMode === "onchain" ? didService.resolveDID() : undefined;
  const currentSignerId = dataMode === "onchain" ? (myAddress ?? "") : me.did;

  // resolveDID()'s role is genuinely derived from real hasRole() checks (see didService.ts);
  // credentialStatus likewise. name/roleExpiresAt are honestly left unpopulated onchain (no
  // caller previously needed them) — falls back to the truncated address, matching TopBar.tsx's
  // own onchain-mode identity display, rather than fabricating a name.
  //
  // A connected wallet with no registered DID (hasNoDid) previously fell through these same
  // "?? USER" / "?? pending" / "?? 0" defaults forever — myRealIdentity is genuinely undefined
  // for a role-holder who simply hasn't created a DID yet, not still resolving, so the "My
  // identity" card showed a permanent "Pending" and the header rendered a fake "User" role +
  // an already-"Expired" countdown ring for someone who was never granted a role at all (found
  // live 2026-09-11, T-067 — /identity/page.tsx already handles this exact state correctly via
  // its own hasNoDid branch). Now surfaced honestly instead of guessing a default.
  const myRole = dataMode === "onchain" ? (hasNoDid ? undefined : myRealIdentity?.role ?? "USER") : activeRole;
  const myCredentialStatus =
    dataMode === "onchain"
      ? isResolvingMe
        ? "resolving"
        : hasNoDid
          ? "no DID"
          : myRealIdentity?.credentialStatus ?? "pending"
      : meMock.credentialStatus;
  const myRoleExpiresAt = dataMode === "onchain" ? (myRealIdentity?.roleExpiresAt ?? 0) : meMock.roleExpiresAt;
  const myDisplayName =
    dataMode === "onchain" ? (myAddress ? truncateMiddle(myAddress, 6, 4) : "…") : meMock.name.split(" ")[0];

  const auditService = useAuditService();
  const assetService = useAssetService();
  const rbacService = useRbacService();
  const governanceService = useGovernanceService();

  const myAssets = assetService
    .listAssets()
    .filter((a) =>
      dataMode === "onchain"
        ? !!myAddress && a.ownerAddress?.toLowerCase() === myAddress.toLowerCase()
        : a.ownerDid === me.did
    );
  const identities = rbacService.listIdentities();
  const expiringSoon = identities.filter((i) => i.roleExpiresAt - Date.now() < 48 * 3_600_000 && i.roleExpiresAt > Date.now());
  const openAlerts = auditService.getAnomalies().filter((a) => a.status === "open");
  const myApprovals = governanceService
    .getProposals()
    .filter((p) => p.status === "queued" && !p.signers.some((s) => s.did === currentSignerId && s.signed));

  const healthCards: Array<{
    label: string;
    value: string | number;
    icon: typeof Fingerprint;
    tone: "signal" | "sage" | "charcoal" | "alert";
  }> = [
    { label: "My identity", value: myCredentialStatus, icon: Fingerprint, tone: "signal" },
    { label: "Roles expiring < 48h", value: expiringSoon.length, icon: Hourglass, tone: "alert" },
    { label: "Assets I own", value: myAssets.length, icon: Boxes, tone: "sage" },
    {
      label: "Platform status",
      value: governanceService.isPlatformPaused || rbacService.isPlatformPaused ? "Paused" : "Operational",
      icon: Octagon,
      tone: "charcoal",
    },
  ];

  // The mock-only "Simulate" button injects synthetic events that aren't part of the real
  // store/subgraph data — kept as separate local state, merged in below, rather than the old
  // approach of snapshotting auditService.getEvents() into local state once at mount and never
  // syncing again. That snapshot silently froze the ledger forever after the first render —
  // real onchain-mode updates (5s refetchInterval) and other pages' mock-store writes never
  // showed up here without a full remount. Found while investigating the audit ledger's
  // "silently empty" bug class (docs/TODO.md-tracked, closed 2026-09-11).
  const [simulatedEvents, setSimulatedEvents] = useState<AuditEvent[]>([]);
  const liveEvents = auditService.getEvents();
  const events = useMemo(() => {
    const merged = dataMode === "mock" ? [...simulatedEvents, ...liveEvents] : liveEvents;
    return [...merged].sort((a, b) => b.timestamp - a.timestamp);
  }, [simulatedEvents, liveEvents]);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  const last7Days = useMemo(() => {
    const days: DateStripItem[] = [];
    for (let i = 6; i >= 0; i--) {
      days.push({ date: new Date(startOfDay(Date.now() - i * DAY_MS)) });
    }
    return days;
  }, []);

  const volumeData = useMemo(() => {
    return last7Days.map(({ date }) => {
      const dayStart = date.getTime();
      const dayEnd = dayStart + DAY_MS;
      const count = events.filter((e) => e.timestamp >= dayStart && e.timestamp < dayEnd).length;
      return { label: date.toLocaleDateString(undefined, { weekday: "short" }), events: count };
    });
  }, [events, last7Days]);

  const visibleEvents = selectedDay
    ? events.filter((e) => startOfDay(e.timestamp) === startOfDay(selectedDay.getTime()))
    : events;

  function simulateLiveEvent() {
    const syntheticTypes: EventType[] = ["DIDCreated", "RoleGranted", "AssetMinted", "CredentialIssued"];
    const type = syntheticTypes[Math.floor(Math.random() * syntheticTypes.length)] ?? "DIDCreated";
    const newEvent: AuditEvent = {
      id: `evt-live-${Date.now()}`,
      type,
      actorDid: me.did,
      summary: `[LIVE] ${type} event arrived from chain`,
      timestamp: Date.now(),
      txHash: `0x${Math.random().toString(16).slice(2, 6)}…${Math.random().toString(16).slice(2, 6)}`,
    };
    setSimulatedEvents((prev) => [newEvent, ...prev].slice(0, 30));
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-medium text-ink-50">Welcome back, {myDisplayName}</h2>
          <div className="mt-1 flex items-center gap-2">
            {/* RoleBadge already renders both the role label and the expiry ring — a separate
                Badge here duplicated the same label next to it (found live 2026-09-11, T-067:
                "two overlapping User badges"). No role/expiry to show at all for a connected
                wallet with no DID yet, rather than a fake "User" badge next to an
                already-"Expired" ring for a role that was never granted. */}
            {myRole ? (
              <RoleBadge role={myRole} expiresAt={myRoleExpiresAt} size="sm" />
            ) : (
              <a href="/identity" className="text-[12px] text-signal-400 underline underline-offset-2 hover:text-signal-300">
                No DID registered — create one
              </a>
            )}
          </div>
        </div>
      </div>

      {openAlerts.length > 0 && (myRole === "AUDITOR" || myRole === "SUPER_ADMIN" || myRole === "ADMIN") && (
        <div className="mb-5 flex items-center gap-2 rounded-xl border border-alert-500/25 bg-alert-500/[0.06] px-4 py-2.5 text-[13px] text-alert-400">
          <TriangleAlert size={15} />
          {openAlerts.length} open anomaly alert{openAlerts.length > 1 ? "s" : ""} awaiting review —{" "}
          <a href="/audit/anomalies" className="underline underline-offset-2">
            view anomaly dashboard
          </a>
        </div>
      )}

      {/* Health strip */}
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {healthCards.map((card, i) => (
          <StatCard key={card.label} {...card} index={i} />
        ))}
      </div>

      <div className="mb-6">
        <AreaChartCard
          title="Event volume"
          subtitle="Last 7 days · on-chain events"
          data={volumeData}
          series={[{ key: "events", color: "signal", label: "Events" }]}
        />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_320px]">
        {/* Ledger stream */}
        <Card>
          <div className="mb-1 flex items-center justify-between">
            <h2 className="text-[14px] font-medium text-ink-50">Ledger stream</h2>
            <div className="flex items-center gap-3">
              <span className="hidden text-[12px] text-ink-600 sm:inline">Newest first · live from chain events</span>
              {dataMode === "mock" && (
                <button
                  onClick={simulateLiveEvent}
                  title="Simulate incoming chain event (mock mode only)"
                  className="flex items-center gap-1.5 rounded-full bg-graphite-700/50 px-2.5 py-1 text-[12px] text-ink-400 transition-colors hover:bg-graphite-700 hover:text-ink-200"
                >
                  <RefreshCw size={11} strokeWidth={1.75} />
                  Simulate
                </button>
              )}
            </div>
          </div>
          <DateStrip
            items={last7Days}
            selected={selectedDay ?? undefined}
            onSelect={(d) => setSelectedDay((prev) => (prev?.toDateString() === d.toDateString() ? null : d))}
            className="mb-3 mt-2"
          />
          {auditService.eventsError ? (
            <p className="flex items-center gap-1.5 py-6 text-center text-[12px] text-danger-400">
              <TriangleAlert size={13} /> Couldn&apos;t load live events — {auditService.eventsError}
            </p>
          ) : (
            <>
              <AnimatePresence initial={false}>
                {visibleEvents.map((event, i) => (
                  <EventRow key={event.id} event={event} index={i} />
                ))}
              </AnimatePresence>
              {visibleEvents.length === 0 && (
                <p className="py-6 text-center text-[12px] text-ink-500">No events on this day.</p>
              )}
            </>
          )}
        </Card>

        {/* Right column */}
        <div className="flex flex-col gap-5">
          {(myRole === "SUPER_ADMIN" || myRole === "ADMIN") && (
            <Card>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-[14px] font-medium text-ink-50">Pending approvals</h2>
                <Landmark size={14} className="text-ink-500" />
              </div>
              {myApprovals.length === 0 ? (
                <p className="text-[12px] text-ink-600">Nothing awaiting your signature.</p>
              ) : (
                <div className="flex flex-col gap-3">
                  {myApprovals.slice(0, 3).map((item) => (
                    <div key={item.id} className="text-[13px]">
                      <p className="truncate text-ink-200">{item.title}</p>
                      <Badge tone="signal" className="mt-1">
                        {item.signers.filter((s) => s.signed).length}/{item.requiredSignatures} signed
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}

          <Card>
            <h2 className="mb-3 text-[14px] font-medium text-ink-50">Roles expiring soon</h2>
            {expiringSoon.length === 0 ? (
              <p className="text-[12px] text-ink-600">No roles expiring within 48h.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {expiringSoon.slice(0, 4).map((identity) => (
                  <div key={identity.did} className="flex items-center justify-between text-[13px]">
                    <span className="truncate text-ink-200">{identity.name}</span>
                    <RoleBadge role={identity.role} expiresAt={identity.roleExpiresAt} size="sm" />
                  </div>
                ))}
              </div>
            )}
          </Card>

          {openAlerts.length > 0 && (
            <div className="flex flex-col gap-3">
              {openAlerts.slice(0, 2).map((alert) => (
                <AlertCard key={alert.id} alert={alert} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
