"use client";

import { useQuery } from "@tanstack/react-query";
import { graphQLClient } from "@/lib/graphql";
import { GET_AUDIT_EVENTS } from "@/lib/queries";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EventRow } from "@/components/modules/EventRow";
import { formatRelativeTime } from "@/lib/utils";
import { Download, TriangleAlert, ChevronDown } from "lucide-react";
import { useState } from "react";

const riskTone = (score: number): "danger" | "alert" | "neutral" =>
  score >= 65 ? "danger" : score >= 40 ? "alert" : "neutral";

export default function AuditPage() {
  const [page, setPage] = useState(0);
  const itemsPerPage = 20;

  const { data, isLoading } = useQuery({
    queryKey: ["auditEvents", page],
    queryFn: async () => graphQLClient.request<any>(GET_AUDIT_EVENTS, { first: itemsPerPage, skip: page * itemsPerPage }),
    refetchInterval: 5000,
  });

  const { data: anomaliesData, isLoading: isAnomaliesLoading } = useQuery({
    queryKey: ["anomalyAlerts"],
    queryFn: async () => {
      const res = await fetch("/api/audit/anomalies");
      return res.json();
    },
    refetchInterval: 10000,
  });

  const events = data?.auditEvents || [];
  const anomalies = anomaliesData || [];

  return (
    <div className="mx-auto max-w-7xl px-6 py-6">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h2 className="text-[15px] font-medium text-ink-50">Audit trail</h2>
          <p className="mt-0.5 text-[13px] text-ink-400">
            Nothing here is trusted unless it&apos;s an on-chain event — this table is re-derivable from
            raw chain data at any time.
          </p>
        </div>
        <Button variant="secondary">
          <Download size={14} />
          Export report
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_320px]">
        <Card>
          <div>
            {isLoading && page === 0 ? (
              <div className="flex items-center justify-center py-8 text-[13px] text-ink-500">Loading audit trail...</div>
            ) : events.length === 0 ? (
              <div className="flex items-center justify-center py-8 text-[13px] text-ink-500">No events found.</div>
            ) : (
              <>
                {events.map((event: any) => {
                  const formattedEvent = {
                    ...event,
                    timestamp: Number(event.timestamp) * 1000
                  };
                  return <EventRow key={event.id} event={formattedEvent} />;
                })}
                <div className="p-4 flex justify-center">
                  <Button variant="secondary" onClick={() => setPage(p => p + 1)} disabled={events.length < itemsPerPage}>
                    <ChevronDown size={14} />
                    Load older events
                  </Button>
                </div>
              </>
            )}
          </div>
        </Card>

        <Card>
          <div className="mb-3 flex items-center gap-2">
            <TriangleAlert size={15} className="text-alert-400" />
            <h3 className="text-[14px] font-medium text-ink-50">Anomaly alerts</h3>
            <span className="ml-auto text-[10px] font-medium tracking-wide text-alert-500 bg-alert-500/10 px-2 py-0.5 rounded uppercase border border-alert-500/20">⚠ NOT from chain</span>
          </div>
          <p className="mb-4 text-[12px] text-ink-600">
            Rule-based checks on the indexed event stream — computed off-chain via heuristics API.
          </p>
          <div className="flex flex-col gap-3">
            {isAnomaliesLoading ? (
              <div className="flex items-center justify-center py-4 text-[12px] text-ink-500">Scanning for anomalies...</div>
            ) : anomalies.length === 0 ? (
              <div className="flex items-center justify-center py-4 text-[12px] text-ink-500">No anomalies detected.</div>
            ) : (
              anomalies.map((alert: any) => (
                <div key={alert.id} className="rounded-xl border border-graphite-800 bg-graphite-900/60 p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-[13px] font-medium text-ink-50">{alert.rule}</p>
                    <Badge tone={riskTone(alert.riskScore)}>{alert.riskScore}</Badge>
                  </div>
                  <p className="mt-1 text-[12px] text-ink-400">{alert.detail}</p>
                  <div className="mt-2 flex items-center justify-between text-[11px] text-ink-600">
                    <span>{formatRelativeTime(alert.timestamp)}</span>
                    <span className="capitalize">{alert.status}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
