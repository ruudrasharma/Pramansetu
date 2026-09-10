"use client";

import { useState } from "react";
import Link from "next/link";
import { Octagon, AlertTriangle, PlayCircle } from "lucide-react";
import { Card, EmptyState } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { IconBadge } from "@/components/ui/IconBadge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/Dialog";
import { MultisigApprovalWidget } from "@/components/modules/MultisigApprovalWidget";
import { TimelockCountdown } from "@/components/modules/TimelockCountdown";
import { truncateMiddle } from "@/lib/utils";
import { useAppStore } from "@/lib/store/appStore";
import { identityByRole } from "@/lib/mock/fixtures";
import { useGovernanceService } from "@/lib/services/governanceService";
import { useDidService } from "@/lib/services/didService";
import { useCurrentIdentity } from "@/lib/hooks/useCurrentIdentity";
import { dataMode } from "@/lib/services/dataMode";

export default function GovernancePage() {
  const activeRole = useAppStore((s) => s.activeRole);
  const { did: myDid, address: myAddress } = useCurrentIdentity();
  const meMock = identityByRole[activeRole];
  const me = dataMode === "onchain" ? { did: myDid ?? "" } : meMock;
  const didService = useDidService(myDid);
  const myRealIdentity = dataMode === "onchain" ? didService.resolveDID() : undefined;
  const governanceService = useGovernanceService();
  const proposals = governanceService.getProposals();
  const disputes = governanceService.getDisputes();

  const canPause = dataMode === "onchain" ? myRealIdentity?.role === "SUPER_ADMIN" : activeRole === "SUPER_ADMIN";
  // Onchain multisig signers are keyed by wallet address, not DID (see governanceService.ts's
  // getProposals adapter) — MultisigApprovalWidget's "already signed" check needs the matching
  // identifier for whichever mode is active.
  const currentSignerId = dataMode === "onchain" ? myAddress : me.did;

  const [confirmAction, setConfirmAction] = useState<"pause" | "unpause" | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const isPaused = governanceService.isPlatformPaused;

  async function handleConfirm() {
    setActionError(null);
    try {
      if (confirmAction === "pause") await governanceService.pause(me.did);
      if (confirmAction === "unpause") await governanceService.unpause(me.did);
      setConfirmAction(null);
      setConfirmText("");
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to propose action");
    }
  }

  async function handleApprove(id: string) {
    setActionError(null);
    try {
      await governanceService.approveProposal(id, me.did);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to approve proposal");
    }
  }

  const queuedTimelocks = disputes.filter((d) => d.status === "queued");

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-medium text-ink-50">Governance</h2>
          <p className="mt-0.5 text-[13px] text-ink-400">
            No single Admin key acts alone. High-privilege actions require multisig; high-value
            transfers cool off before finalizing, and any Auditor can freeze one mid-window.
          </p>
        </div>
        <Link href="/governance/disputes">
          <Button variant="secondary">Disputes</Button>
        </Link>
      </div>

      {actionError && (
        <Card className="mb-5 border-danger-500/25 bg-danger-500/[0.04] text-[13px] text-danger-400">{actionError}</Card>
      )}

      {canPause && (
        <Card className={`mb-5 ${isPaused ? "border-danger-500/25 bg-danger-500/[0.04]" : "border-danger-500/15"}`}>
          <div className="flex flex-col items-start justify-between gap-4 sm:flex-row">
            <div className="flex gap-3">
              <IconBadge icon={Octagon} tone="danger" />
              <div>
                <h3 className="text-[14px] font-medium text-ink-50">
                  Platform status: {isPaused ? <span className="text-danger-400">Paused</span> : <span className="text-verified-400">Operational</span>}
                </h3>
                <p className="mt-1 max-w-md text-[13px] text-ink-400">
                  {isPaused
                    ? "Every state-changing function is frozen. Unpausing also requires 2 Super Admin signatures."
                    : "Freezes every state-changing function across all modules in a single transaction. Requires 2 Super Admin signatures — use only on suspected key compromise."}
                </p>
              </div>
            </div>
            <Button
              variant={isPaused ? "secondary" : "danger"}
              className="shrink-0"
              onClick={() => setConfirmAction(isPaused ? "unpause" : "pause")}
            >
              {isPaused ? <PlayCircle size={14} /> : <AlertTriangle size={14} />}
              {isPaused ? "Propose unpause" : "Pause platform"}
            </Button>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div>
          <h3 className="mb-3 text-[13px] font-medium text-ink-400">Multisig queue</h3>
          {proposals.length === 0 ? (
            <EmptyState title="Nothing queued" description="No multisig actions are pending." />
          ) : (
            <div className="flex flex-col gap-3">
              {proposals.map((p) => (
                <MultisigApprovalWidget key={p.id} proposal={p} currentSignerDid={currentSignerId} onApprove={handleApprove} />
              ))}
            </div>
          )}
        </div>

        <div>
          <h3 className="mb-3 text-[13px] font-medium text-ink-400">Timelock queue</h3>
          {queuedTimelocks.length === 0 ? (
            <EmptyState title="Nothing cooling off" description="No high-value transfers are currently queued." />
          ) : (
            <div className="flex flex-col gap-3">
              {queuedTimelocks.map((tx) => (
                <Card key={tx.txId}>
                  <div className="mb-2 flex items-center justify-between">
                    <Badge tone="neutral">Tx #{tx.txId}</Badge>
                    <Badge tone="signal">queued</Badge>
                  </div>
                  <p className="text-[13px] text-ink-50">{tx.title}</p>
                  <p className="mt-1 text-[12px] text-ink-400">{tx.description}</p>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="mono-value text-[11px] text-ink-600">{truncateMiddle(tx.target, 14, 6)}</span>
                    <TimelockCountdown eta={tx.eta} size="sm" />
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      <Dialog open={!!confirmAction} onOpenChange={(open) => !open && setConfirmAction(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-danger-400">Confirm {confirmAction === "pause" ? "emergency pause" : "unpause"}</DialogTitle>
            <DialogDescription>
              This proposes a platform-wide {confirmAction} requiring a second Super Admin&apos;s
              co-signature to take effect. Type{" "}
              <span className="mono-value text-ink-200">{confirmAction?.toUpperCase()}</span> to confirm.
            </DialogDescription>
          </DialogHeader>
          <input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={confirmAction?.toUpperCase()}
            className="mono-value w-full rounded-xl border border-graphite-800 bg-graphite-900 px-3 py-2 text-[13px] text-ink-50 placeholder:text-ink-700 focus:border-danger-500 focus:outline-none"
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmAction(null)}>
              Cancel
            </Button>
            <Button variant="danger" disabled={confirmText !== confirmAction?.toUpperCase()} onClick={handleConfirm}>
              Propose {confirmAction}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
