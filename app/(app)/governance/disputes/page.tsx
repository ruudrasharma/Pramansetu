"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Flag, CheckCircle2, XCircle } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { DateStrip } from "@/components/ui/DateStrip";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/Dialog";
import { TimelockCountdown } from "@/components/modules/TimelockCountdown";

const DAY_MS = 24 * 3_600_000;
import { truncateMiddle, formatRelativeTime } from "@/lib/utils";
import { useAppStore } from "@/lib/store/appStore";
import { identityByRole, findIdentity } from "@/lib/mock/fixtures";
import { useGovernanceService } from "@/lib/services/governanceService";
import type { TimelockTransaction } from "@/lib/mock/fixtures";

const statusTone = { queued: "signal", disputed: "danger", executed: "verified", cancelled: "neutral" } as const;

export default function DisputesPage() {
  const activeRole = useAppStore((s) => s.activeRole);
  const me = identityByRole[activeRole];
  const governanceService = useGovernanceService();
  const disputes = governanceService.getDisputes();

  const canRaise = activeRole === "AUDITOR";
  const canResolve = activeRole === "SUPER_ADMIN";

  const [disputeTarget, setDisputeTarget] = useState<TimelockTransaction | null>(null);
  const [reason, setReason] = useState("");

  function submitDispute() {
    if (!disputeTarget || !reason) return;
    governanceService.raiseDispute(disputeTarget.txId, reason, me.did);
    setDisputeTarget(null);
    setReason("");
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <Link href="/governance" className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-ink-400 hover:text-ink-200">
        <ArrowLeft size={14} /> Back to governance
      </Link>

      <div className="mb-5">
        <h2 className="text-[15px] font-medium text-ink-50">Dispute resolution</h2>
        <p className="mt-0.5 text-[13px] text-ink-400">
          High-value transfers queue for a 24-48h cooling-off window. Any Auditor can freeze one mid-window;
          a dispute raised before execution is honored even if the timelock has already elapsed.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        {disputes.map((tx) => (
          <Card key={tx.txId} className={tx.status === "disputed" ? "border-danger-500/25 bg-danger-500/[0.04]" : undefined}>
            <div className="mb-2 flex items-center justify-between">
              <Badge tone="neutral">Tx #{tx.txId}</Badge>
              <Badge tone={statusTone[tx.status]}>{tx.status}</Badge>
            </div>
            <p className="text-[13px] font-medium text-ink-50">{tx.title}</p>
            <p className="mt-1 text-[12px] text-ink-400">{tx.description}</p>
            <p className="mono-value mt-1 text-[11px] text-ink-600">{truncateMiddle(tx.target, 14, 6)}</p>

            {tx.status === "queued" && (
              <>
                <DateStrip
                  className="mb-3 mt-3"
                  items={Array.from({ length: Math.max(1, Math.ceil((tx.eta - tx.queuedAt) / DAY_MS) + 1) }, (_, i) => ({
                    date: new Date(tx.queuedAt + i * DAY_MS),
                    tone: tx.queuedAt + i * DAY_MS >= tx.eta ? ("alert" as const) : undefined,
                  }))}
                  selected={new Date(Date.now())}
                />
                <div className="flex items-center justify-between">
                  <TimelockCountdown eta={tx.eta} size="sm" />
                  {canRaise && (
                    <Button variant="danger" className="px-2.5 py-1 text-[12px]" onClick={() => setDisputeTarget(tx)}>
                      <Flag size={12} /> Raise dispute
                    </Button>
                  )}
                </div>
              </>
            )}

            {tx.status === "disputed" && (
              <div className="mt-3 rounded-2xl bg-danger-500/10 p-2.5 text-[12px] text-danger-400">
                <span className="font-medium">{findIdentity(tx.raisedBy ?? "")?.name ?? "An Auditor"}:</span> {tx.disputeReason}
                {canResolve && (
                  <div className="mt-2 flex gap-2">
                    <Button
                      variant="secondary"
                      className="px-2.5 py-1 text-[11px]"
                      onClick={() => governanceService.resolveDispute(tx.txId, true, me.did)}
                    >
                      <CheckCircle2 size={12} /> Proceed
                    </Button>
                    <Button
                      variant="danger"
                      className="px-2.5 py-1 text-[11px]"
                      onClick={() => governanceService.resolveDispute(tx.txId, false, me.did)}
                    >
                      <XCircle size={12} /> Cancel
                    </Button>
                  </div>
                )}
              </div>
            )}

            {(tx.status === "executed" || tx.status === "cancelled") && tx.resolution && (
              <p className="mt-3 text-[11px] text-ink-600">
                Resolved by {findIdentity(tx.resolution.resolvedBy)?.name ?? "Super Admin"} —{" "}
                {formatRelativeTime(tx.resolution.resolvedAt)}
              </p>
            )}
          </Card>
        ))}
      </div>

      <Dialog open={!!disputeTarget} onOpenChange={(open) => !open && setDisputeTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Raise dispute on tx #{disputeTarget?.txId}</DialogTitle>
            <DialogDescription>This freezes the transaction until a Super Admin resolves it.</DialogDescription>
          </DialogHeader>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason for dispute…"
            rows={3}
            className="w-full rounded-xl border border-graphite-800 bg-graphite-900 px-3 py-2 text-[13px] text-ink-50 placeholder:text-ink-700 focus:border-danger-500 focus:outline-none"
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDisputeTarget(null)}>
              Cancel
            </Button>
            <Button variant="danger" disabled={!reason} onClick={submitDispute}>
              Raise dispute
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
