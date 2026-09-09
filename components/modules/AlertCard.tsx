"use client";

import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { formatRelativeTime, cn } from "@/lib/utils";
import type { AnomalyAlert } from "@/lib/mock/fixtures";
import { TriangleAlert, ShieldAlert, Info } from "lucide-react";

const severityMeta = {
  info: { icon: Info, tone: "neutral" as const, iconTone: "text-ink-400 bg-graphite-800" },
  warning: { icon: TriangleAlert, tone: "alert" as const, iconTone: "text-alert-400 bg-alert-500/10" },
  critical: { icon: ShieldAlert, tone: "danger" as const, iconTone: "text-danger-400 bg-danger-500/10" },
};

export function AlertCard({
  alert,
  onDismiss,
  onOpen,
}: {
  alert: AnomalyAlert;
  onDismiss?: (id: string, reason: string) => void;
  onOpen?: (alert: AnomalyAlert) => void;
}) {
  const { icon: Icon, tone, iconTone } = severityMeta[alert.severity];

  return (
    <Card
      className={cn("flex flex-col gap-2 transition-colors", onOpen && "cursor-pointer hover:border-graphite-600")}
      onClick={() => onOpen?.(alert)}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <div className={cn("mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full", iconTone)}>
            <Icon size={14} strokeWidth={1.75} />
          </div>
          <div>
            <p className="text-[13px] font-medium text-ink-50">{alert.rule}</p>
            <p className="mt-0.5 text-[12px] text-ink-400">{alert.detail}</p>
          </div>
        </div>
        <Badge tone={tone}>{alert.riskScore}</Badge>
      </div>
      <div className="flex items-center justify-between pl-9 text-[11px] text-ink-600">
        <span>{formatRelativeTime(alert.timestamp)}</span>
        {alert.status === "open" && onDismiss ? (
          <Button
            variant="ghost"
            className="h-auto px-2 py-1 text-[11px]"
            onClick={(e) => {
              e.stopPropagation();
              onDismiss(alert.id, "Reviewed — no action needed.");
            }}
          >
            Dismiss
          </Button>
        ) : (
          <span className="capitalize">{alert.status}</span>
        )}
      </div>
    </Card>
  );
}
