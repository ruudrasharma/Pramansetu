"use client";

import { auditEvents, anomalyAlerts } from "@/lib/mock-data";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EventRow } from "@/components/modules/EventRow";
import { formatRelativeTime } from "@/lib/utils";
import { Download, TriangleAlert } from "lucide-react";

const riskTone = (score: number): "danger" | "alert" | "neutral" =>
  score >= 65 ? "danger" : score >= 40 ? "alert" : "neutral";

export default function AuditPage() {
  return (
    <div className="mx-auto max-w-7xl px-6 py-6">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h2 className="text-[15px] font-medium text-ink-50">Audit trail</h2>
          <p className="mt-0.5 text-[13px] text-ink-400">
            Nothing here is trusted unless it's an on-chain event — this table is re-derivable from
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
            {auditEvents
              .slice()
              .sort((a, b) => b.timestamp - a.timestamp)
              .map((event) => (
                <EventRow key={event.id} event={event} />
              ))}
          </div>
        </Card>

        <Card>
          <div className="mb-3 flex items-center gap-2">
            <TriangleAlert size={15} className="text-alert-400" />
            <h3 className="text-[14px] font-medium text-ink-50">Anomaly alerts</h3>
          </div>
          <p className="mb-4 text-[12px] text-ink-600">
            Rule-based checks on the indexed event stream — each flag names the specific rule that
            fired, never a bare score.
          </p>
          <div className="flex flex-col gap-3">
            {anomalyAlerts.map((alert) => (
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
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
