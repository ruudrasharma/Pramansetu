"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Download, Search } from "lucide-react";
import { Card, EmptyState } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { AreaChartCard } from "@/components/ui/AreaChartCard";
import { EventRow } from "@/components/modules/EventRow";
import { useAuditService } from "@/lib/services/auditService";
import type { EventType } from "@/lib/mock/fixtures";

const DAY_MS = 24 * 3_600_000;

const eventTypes: EventType[] = [
  "DIDCreated",
  "KeyRotated",
  "CredentialIssued",
  "CredentialRevoked",
  "RoleGranted",
  "RoleRevoked",
  "RoleExpired",
  "AssetMinted",
  "AssetTransferred",
  "EmergencyPaused",
  "DisputeRaised",
  "GovernanceExecuted",
  "GuardianRegistered",
  "RecoveryInitiated",
  "RecoveryFinalized",
];

export default function AuditPage() {
  const auditService = useAuditService();
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<EventType | "all">("all");

  const events = useMemo(() => {
    return auditService
      .getEvents()
      .slice()
      .sort((a, b) => b.timestamp - a.timestamp)
      .filter((e) => (typeFilter === "all" ? true : e.type === typeFilter))
      .filter((e) => (query ? e.summary.toLowerCase().includes(query.toLowerCase()) || e.actorDid.includes(query) : true));
  }, [auditService, query, typeFilter]);

  const volumeData = useMemo(() => {
    const allEvents = auditService.getEvents();
    const days: Array<{ label: string; events: number }> = [];
    for (let i = 6; i >= 0; i--) {
      const dayStart = new Date().setHours(0, 0, 0, 0) - i * DAY_MS;
      const dayEnd = dayStart + DAY_MS;
      const count = allEvents.filter((e) => e.timestamp >= dayStart && e.timestamp < dayEnd).length;
      days.push({ label: new Date(dayStart).toLocaleDateString(undefined, { weekday: "short" }), events: count });
    }
    return days;
  }, [auditService]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-medium text-ink-50">Audit trail</h2>
          <p className="mt-0.5 text-[13px] text-ink-400">
            Nothing here is trusted unless it&apos;s an on-chain event — this table is re-derivable from
            raw chain data at any time.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/audit/anomalies">
            <Button variant="secondary">Anomaly dashboard</Button>
          </Link>
          <Button variant="secondary">
            <Download size={14} /> Export
          </Button>
        </div>
      </div>

      <AreaChartCard
        className="mb-4"
        title="Event volume"
        subtitle="Last 7 days · all event types"
        data={volumeData}
        series={[{ key: "events", color: "signal", label: "Events" }]}
      />

      <Card className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-600" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search summary or actor DID…"
            className="w-full rounded-xl border border-graphite-800 bg-graphite-900 py-2 pl-9 pr-3 text-[13px] text-ink-50 placeholder:text-ink-700 focus:border-signal-500 focus:outline-none"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as EventType | "all")}
          className="rounded-xl border border-graphite-800 bg-graphite-900 px-3 py-2 text-[13px] text-ink-50 focus:border-signal-500 focus:outline-none"
        >
          <option value="all">All event types</option>
          {eventTypes.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </Card>

      <Card>
        {events.length === 0 ? (
          <EmptyState title="No matching events" description="Try a different search term or event type filter." />
        ) : (
          events.map((event) => <EventRow key={event.id} event={event} />)
        )}
      </Card>
    </div>
  );
}
