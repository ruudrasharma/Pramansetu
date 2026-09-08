"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, EmptyState } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { AlertCard } from "@/components/modules/AlertCard";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/Dialog";
import { useAuditService } from "@/lib/services/auditService";
import { findIdentity } from "@/lib/mock/fixtures";
import type { AnomalyAlert } from "@/lib/mock/fixtures";
import { formatRelativeTime } from "@/lib/utils";

export default function AnomalyDashboardPage() {
  const auditService = useAuditService();
  const alerts = auditService.getAnomalies();
  const [selected, setSelected] = useState<AnomalyAlert | null>(null);

  const chartData = [
    { severity: "Info", count: alerts.filter((a) => a.severity === "info").length, fill: "var(--ink-400)" },
    { severity: "Warning", count: alerts.filter((a) => a.severity === "warning").length, fill: "var(--alert-500)" },
    { severity: "Critical", count: alerts.filter((a) => a.severity === "critical").length, fill: "var(--danger-500)" },
  ];

  const openAlerts = alerts.filter((a) => a.status === "open").sort((a, b) => b.riskScore - a.riskScore);
  const resolvedAlerts = alerts.filter((a) => a.status === "dismissed");

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <Link href="/audit" className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-ink-400 hover:text-ink-200">
        <ArrowLeft size={14} /> Back to audit trail
      </Link>

      <div className="mb-5">
        <h2 className="text-[15px] font-medium text-ink-50">Anomaly detection</h2>
        <p className="mt-0.5 text-[13px] text-ink-400">
          Rule-based checks on the indexed event stream — mint velocity, off-hours role escalation,
          mass-transfer patterns. Every flag names the rule that fired; never a bare score alone.
        </p>
      </div>

      <Card className="mb-5 h-56 p-4">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--graphite-800)" horizontal={false} />
            <XAxis type="number" allowDecimals={false} stroke="var(--ink-600)" fontSize={11} />
            <YAxis type="category" dataKey="severity" stroke="var(--ink-600)" fontSize={12} width={70} />
            <Tooltip
              contentStyle={{ background: "var(--graphite-850)", border: "1px solid var(--graphite-800)", borderRadius: 8, fontSize: 12 }}
              labelStyle={{ color: "var(--ink-50)" }}
            />
            <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={28} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <div className="mb-3 flex items-center gap-2">
        <h3 className="text-[13px] font-medium text-ink-50">Open alerts</h3>
        <Badge tone="danger">{openAlerts.length}</Badge>
      </div>
      {openAlerts.length === 0 ? (
        <EmptyState title="No open alerts" description="Everything currently flagged has been reviewed." />
      ) : (
        <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {openAlerts.map((a) => (
            <AlertCard key={a.id} alert={a} onDismiss={auditService.dismissAlert} onOpen={setSelected} />
          ))}
        </div>
      )}

      {resolvedAlerts.length > 0 && (
        <>
          <h3 className="mb-3 text-[13px] font-medium text-ink-50">Resolved</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {resolvedAlerts.map((a) => (
              <AlertCard key={a.id} alert={a} onOpen={setSelected} />
            ))}
          </div>
        </>
      )}

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent>
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle>{selected.rule}</DialogTitle>
                <DialogDescription>{selected.detail}</DialogDescription>
              </DialogHeader>
              <div className="flex flex-col gap-2 text-[13px]">
                <div className="flex justify-between border-b border-graphite-800 pb-2">
                  <span className="text-ink-500">Risk score</span>
                  <Badge tone={selected.severity === "critical" ? "danger" : selected.severity === "warning" ? "alert" : "neutral"}>
                    {selected.riskScore}
                  </Badge>
                </div>
                <div className="flex justify-between border-b border-graphite-800 pb-2">
                  <span className="text-ink-500">Actor</span>
                  <span className="text-ink-200">{findIdentity(selected.actorDid)?.name ?? selected.actorDid.slice(0, 14) + "…"}</span>
                </div>
                <div className="flex justify-between border-b border-graphite-800 pb-2">
                  <span className="text-ink-500">Detected</span>
                  <span className="text-ink-200">{formatRelativeTime(selected.timestamp)}</span>
                </div>
                {selected.dismissReason && (
                  <div className="rounded-lg bg-graphite-900 p-2.5 text-ink-400">{selected.dismissReason}</div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
