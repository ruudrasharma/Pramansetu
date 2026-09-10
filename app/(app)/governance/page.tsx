"use client";

import { useState } from "react";
import Link from "next/link";
import { Octagon, AlertTriangle, PlayCircle, UserPlus, Loader2 } from "lucide-react";
import { Card, EmptyState } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { IconBadge } from "@/components/ui/IconBadge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/Dialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/Select";
import { MultisigApprovalWidget } from "@/components/modules/MultisigApprovalWidget";
import { TimelockCountdown } from "@/components/modules/TimelockCountdown";
import { truncateMiddle } from "@/lib/utils";
import { useAppStore } from "@/lib/store/appStore";
import { identityByRole, identities, findIdentity, type ProposalKind } from "@/lib/mock/fixtures";
import { useGovernanceService } from "@/lib/services/governanceService";
import { useDidService } from "@/lib/services/didService";
import { useCurrentIdentity } from "@/lib/hooks/useCurrentIdentity";
import { resolveControllerAddress } from "@/lib/hooks/useDIDRegistry";
import { dataMode } from "@/lib/services/dataMode";

const validityOptions = [
  { label: "90 days", ms: 90 * 24 * 3_600_000 },
  { label: "1 year", ms: 365 * 24 * 3_600_000 },
  { label: "2 years", ms: 2 * 365 * 24 * 3_600_000 },
];

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

  const isSuperAdmin = dataMode === "onchain" ? myRealIdentity?.role === "SUPER_ADMIN" : activeRole === "SUPER_ADMIN";
  // The real per-mode actor identifier: an address onchain (multisig co-signing on
  // TimeBoundAccessControl is by msg.sender, not DID — MultisigApprovalWidget's "already signed"
  // check needs this to match), a DID in mock mode. Used both for that comparison and as the
  // proposedBy/signer argument on every write call below — those args are ignored by the onchain
  // service implementations today (the real actor is always msg.sender), but passing the
  // semantically correct value rather than always `me.did` keeps this honest if that ever changes.
  const currentSignerId = dataMode === "onchain" ? (myAddress ?? "") : me.did;

  const [confirmAction, setConfirmAction] = useState<"pause" | "unpause" | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const isPaused = governanceService.isPlatformPaused;

  const [proposeOpen, setProposeOpen] = useState(false);
  const [proposeKind, setProposeKind] = useState<Extract<ProposalKind, "addAdmin" | "removeAdmin">>("addAdmin");
  const [targetDid, setTargetDid] = useState(dataMode === "mock" ? (identities[0]?.did ?? "") : "");
  const [validityMs, setValidityMs] = useState(validityOptions[1]!.ms);
  const [isProposing, setIsProposing] = useState(false);

  async function handleConfirm() {
    setActionError(null);
    try {
      if (confirmAction === "pause") await governanceService.pause(currentSignerId);
      if (confirmAction === "unpause") await governanceService.unpause(currentSignerId);
      setConfirmAction(null);
      setConfirmText("");
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to propose action");
    }
  }

  async function handleApprove(id: string) {
    setActionError(null);
    try {
      await governanceService.approveProposal(id, currentSignerId);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to approve proposal");
    }
  }

  async function handleProposeAdminChange() {
    if (!targetDid) return;
    setActionError(null);
    setIsProposing(true);
    try {
      const targetName = dataMode === "mock" ? findIdentity(targetDid)?.name ?? targetDid : targetDid;
      const title = proposeKind === "addAdmin" ? `Add ${targetName} as Admin` : `Remove Admin: ${targetName}`;
      const account = dataMode === "onchain" ? await resolveControllerAddress(targetDid as `0x${string}`) : targetDid;
      await governanceService.proposeAction(proposeKind, title, currentSignerId, {
        account,
        validUntil: proposeKind === "addAdmin" ? Date.now() + validityMs : undefined,
      });
      setProposeOpen(false);
      setTargetDid(dataMode === "mock" ? identities[0]?.did ?? "" : "");
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to propose action");
    } finally {
      setIsProposing(false);
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
        <div className="flex gap-2">
          <Link href="/oracle/facts">
            <Button variant="secondary">Oracle facts</Button>
          </Link>
          <Link href="/governance/disputes">
            <Button variant="secondary">Disputes</Button>
          </Link>
        </div>
      </div>

      {actionError && (
        <Card className="mb-5 border-danger-500/25 bg-danger-500/[0.04] text-[13px] text-danger-400">{actionError}</Card>
      )}

      {isSuperAdmin && (
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
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-[13px] font-medium text-ink-400">Multisig queue</h3>
            {isSuperAdmin && (
              <Button variant="secondary" className="px-2.5 py-1 text-[12px]" onClick={() => setProposeOpen(true)}>
                <UserPlus size={12} /> Propose Admin change
              </Button>
            )}
          </div>
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

      <Dialog open={proposeOpen} onOpenChange={(open) => !open && setProposeOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Propose Admin change</DialogTitle>
            <DialogDescription>
              Requires a second Super Admin&apos;s co-signature — {proposeKind === "addAdmin"
                ? "via proposePrivilegedGrant"
                : "an emergency revoke via proposePlatformAction"} — before it takes effect.
            </DialogDescription>
          </DialogHeader>

          <div className="mb-3">
            <label className="mb-1.5 block text-[12px] text-ink-500">Action</label>
            <Select value={proposeKind} onValueChange={(v: string) => setProposeKind(v as typeof proposeKind)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="addAdmin">Add Admin</SelectItem>
                <SelectItem value="removeAdmin">Remove Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {dataMode === "mock" ? (
            <div className="mb-3">
              <label className="mb-1.5 block text-[12px] text-ink-500">Target identity</label>
              <Select value={targetDid} onValueChange={setTargetDid}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {identities.map((i) => (
                    <SelectItem key={i.did} value={i.did}>
                      {i.name} — {i.department}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="mb-3">
              <label className="mb-1.5 block text-[12px] text-ink-500">Target DID (bytes32)</label>
              <input
                value={targetDid}
                onChange={(e) => setTargetDid(e.target.value)}
                placeholder="0x..."
                className="w-full rounded-xl border border-graphite-800 bg-graphite-900 px-3 py-2 text-[13px] text-ink-50 mono-value focus:border-signal-500 focus:outline-none"
              />
            </div>
          )}

          {proposeKind === "addAdmin" && (
            <div className="mb-3">
              <label className="mb-1.5 block text-[12px] text-ink-500">Validity</label>
              <Select value={String(validityMs)} onValueChange={(v: string) => setValidityMs(Number(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {validityOptions.map((v) => (
                    <SelectItem key={v.label} value={String(v.ms)}>
                      {v.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <DialogFooter>
            <Button variant="ghost" onClick={() => setProposeOpen(false)}>
              Cancel
            </Button>
            <Button disabled={!targetDid || isProposing} onClick={handleProposeAdminChange}>
              {isProposing && <Loader2 size={14} className="animate-spin" />}
              {isProposing ? "Confirming transaction…" : `Propose ${proposeKind === "addAdmin" ? "add" : "remove"}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
