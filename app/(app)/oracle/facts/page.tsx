"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Radio, Flag, CheckCircle2, XCircle } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/Dialog";
import { truncateMiddle, formatRelativeTime, formatCountdown } from "@/lib/utils";
import { findIdentity, FACT_TYPE_LABELS, type OracleFact, type OracleFactStatus } from "@/lib/mock/fixtures";
import { useOracleAttestationService } from "@/lib/services/oracleAttestationService";
import { useAppStore } from "@/lib/store/appStore";
import { useCurrentIdentity } from "@/lib/hooks/useCurrentIdentity";
import { useDidService } from "@/lib/services/didService";
import { useHasRole, ROLE } from "@/lib/hooks/useAccessControl";
import { dataMode } from "@/lib/services/dataMode";

const statusTone: Record<OracleFactStatus, "verified" | "alert" | "signal" | "danger" | "neutral"> = {
  submitted: "neutral",
  attested: "alert",
  disputed: "danger",
  finalized: "verified",
  rejected: "danger",
};

/**
 * Dedicated review queue for OracleAttestation facts across every asset (T-016, gap analysis
 * §2.2.5) — mirrors app/(app)/governance/disputes/page.tsx's structure (inline error banner,
 * live-ticking dispute-window countdown, dispute-reason Dialog), for Auditors/attestors who need
 * to see the whole live queue rather than one asset at a time.
 */
export default function OracleFactsPage() {
  const oracleService = useOracleAttestationService();
  const facts = oracleService.getFacts();

  const activeRole = useAppStore((s) => s.activeRole);
  const { did: myDid, address: myAddress } = useCurrentIdentity();
  const didService = useDidService(myDid);
  const myRealIdentity = dataMode === "onchain" ? didService.resolveDID() : undefined;
  const { data: hasOracleAttestorRole } = useHasRole(ROLE.ORACLE_ATTESTOR_ROLE, myAddress);
  const canAttest = dataMode === "onchain" ? !!hasOracleAttestorRole : activeRole === "MANAGER";
  const canDispute = dataMode === "onchain" ? myRealIdentity?.role === "AUDITOR" : activeRole === "AUDITOR";
  const canResolve = dataMode === "onchain" ? myRealIdentity?.role === "SUPER_ADMIN" : activeRole === "SUPER_ADMIN";
  const currentActorId = dataMode === "onchain" ? (myAddress ?? "") : (myDid ?? "");

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const [disputeTarget, setDisputeTarget] = useState<OracleFact | null>(null);
  const [reason, setReason] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);

  async function submitDispute() {
    if (!disputeTarget || !reason) return;
    setActionError(null);
    try {
      await oracleService.raiseDispute(disputeTarget.factId, reason, currentActorId);
      setDisputeTarget(null);
      setReason("");
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to raise dispute");
    }
  }

  async function handleAttest(factId: number) {
    setActionError(null);
    try {
      await oracleService.attestFact(factId, currentActorId);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to attest fact");
    }
  }

  async function handleFinalize(factId: number) {
    setActionError(null);
    try {
      await oracleService.finalize(factId);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to finalize fact");
    }
  }

  async function handleResolve(factId: number, proceed: boolean) {
    setActionError(null);
    try {
      await oracleService.resolveDispute(factId, proceed, currentActorId);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to resolve dispute");
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <Link href="/governance" className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-ink-400 hover:text-ink-200">
        <ArrowLeft size={14} /> Back to governance
      </Link>

      <div className="mb-5">
        <h2 className="text-[15px] font-medium text-ink-50">Oracle attestation</h2>
        <p className="mt-0.5 text-[13px] text-ink-400">
          Real-world facts about minted assets (delivery, damage, decommission…) need 2-of-N
          independent attestors before a 15-minute dispute window opens. Any Auditor can freeze one
          mid-window; a Super Admin adjudicates disputes.
        </p>
      </div>

      {actionError && (
        <Card className="mb-4 border-danger-500/25 bg-danger-500/[0.04] text-[13px] text-danger-400">{actionError}</Card>
      )}

      {facts.length === 0 ? (
        <Card className="text-[13px] text-ink-400">No oracle facts have been submitted yet.</Card>
      ) : (
        <div className="flex flex-col gap-4">
          {facts.map((fact) => {
            const canFinalize = fact.status === "attested" && (fact.disputeWindowEnd ?? Infinity) <= now;
            const canDisputeThis = canDispute && fact.status === "attested" && (fact.disputeWindowEnd ?? 0) > now;
            return (
              <Card key={fact.factId} className={fact.status === "disputed" ? "border-danger-500/25 bg-danger-500/[0.04]" : undefined}>
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge tone="neutral">Fact #{fact.factId}</Badge>
                    <Link href={`/assets/${fact.tokenId}`} className="text-[12px] text-signal-400 hover:underline">
                      Token #{fact.tokenId}
                    </Link>
                  </div>
                  <Badge tone={statusTone[fact.status]}>{fact.status}</Badge>
                </div>
                <p className="text-[13px] font-medium text-ink-50">
                  {FACT_TYPE_LABELS[fact.factType] ?? `Fact type ${fact.factType}`}
                </p>
                <p className="mono-value mt-1 text-[11px] text-ink-600">{truncateMiddle(fact.dataHash, 14, 6)}</p>
                <p className="mt-1 text-[11px] text-ink-600">
                  Proposed by {findIdentity(fact.proposer)?.name ?? truncateMiddle(fact.proposer)}
                  {fact.coSigner && <> · attested by {findIdentity(fact.coSigner)?.name ?? truncateMiddle(fact.coSigner)}</>}
                  {" · "}
                  {formatRelativeTime(fact.submittedAt)}
                </p>

                {fact.status === "submitted" && canAttest && (
                  <div className="mt-3">
                    <Button
                      variant="secondary"
                      className="px-2.5 py-1 text-[12px]"
                      onClick={() => handleAttest(fact.factId)}
                      disabled={oracleService.isPending}
                    >
                      <Radio size={12} /> Attest
                    </Button>
                  </div>
                )}

                {fact.status === "attested" && (
                  <div className="mt-3 flex items-center gap-2">
                    {canFinalize && (
                      <Button
                        variant="secondary"
                        className="px-2.5 py-1 text-[12px]"
                        onClick={() => handleFinalize(fact.factId)}
                        disabled={oracleService.isPending}
                      >
                        <CheckCircle2 size={12} /> Finalize
                      </Button>
                    )}
                    {canDisputeThis && (
                      <Button variant="danger" className="px-2.5 py-1 text-[12px]" onClick={() => setDisputeTarget(fact)}>
                        <Flag size={12} /> Raise dispute
                      </Button>
                    )}
                    {!canFinalize && !canDisputeThis && (
                      <p className="text-[11px] text-ink-600">
                        Dispute window closes in {formatCountdown(fact.disputeWindowEnd ?? 0)}.
                      </p>
                    )}
                  </div>
                )}

                {fact.status === "disputed" && (
                  <div className="mt-3 rounded-2xl bg-danger-500/10 p-2.5 text-[12px] text-danger-400">
                    <span className="font-medium">{findIdentity(fact.disputedBy ?? "")?.name ?? "An Auditor"}:</span>{" "}
                    {fact.disputeReason}
                    {canResolve && (
                      <div className="mt-2 flex gap-2">
                        <Button variant="secondary" className="px-2.5 py-1 text-[11px]" onClick={() => handleResolve(fact.factId, true)}>
                          <CheckCircle2 size={12} /> Proceed
                        </Button>
                        <Button variant="danger" className="px-2.5 py-1 text-[11px]" onClick={() => handleResolve(fact.factId, false)}>
                          <XCircle size={12} /> Reject
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                {(fact.status === "finalized" || fact.status === "rejected") && fact.finalizedAt && (
                  <p className="mt-3 text-[11px] text-ink-600">
                    {fact.status === "finalized" ? "Finalized" : "Rejected"} · {formatRelativeTime(fact.finalizedAt)}
                  </p>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={!!disputeTarget} onOpenChange={(open) => !open && setDisputeTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Raise dispute on fact #{disputeTarget?.factId}</DialogTitle>
            <DialogDescription>This blocks finalization until a Super Admin resolves it.</DialogDescription>
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
