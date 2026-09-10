"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { keccak256, toBytes } from "viem";
import { ArrowLeft, FileCheck, ExternalLink, Radio, Flag, CheckCircle2, XCircle } from "lucide-react";
import { Card, EmptyState, MonoValue } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/Dialog";
import { truncateMiddle, formatRelativeTime } from "@/lib/utils";
import { findIdentity, FACT_TYPE_LABELS, type AssetStatus, type OracleFactStatus } from "@/lib/mock/fixtures";
import { useAssetService } from "@/lib/services/assetService";
import { useOracleAttestationService } from "@/lib/services/oracleAttestationService";
import { useAppStore } from "@/lib/store/appStore";
import { useCurrentIdentity } from "@/lib/hooks/useCurrentIdentity";
import { useDidService } from "@/lib/services/didService";
import { useHasRole, ROLE } from "@/lib/hooks/useAccessControl";
import { dataMode } from "@/lib/services/dataMode";

const statusTone: Record<AssetStatus, "verified" | "alert" | "signal" | "danger"> = {
  finalized: "verified",
  pending_cosign: "alert",
  transferred: "signal",
  disputed: "danger",
};

const factStatusTone: Record<OracleFactStatus, "verified" | "alert" | "signal" | "danger" | "neutral"> = {
  submitted: "neutral",
  attested: "alert",
  disputed: "danger",
  finalized: "verified",
  rejected: "danger",
};

export default function AssetDetailPage() {
  const params = useParams<{ tokenId: string }>();
  const tokenId = Number(params.tokenId);
  const assetService = useAssetService();
  const asset = assetService.getAsset(tokenId);
  const oracleService = useOracleAttestationService();

  // Role gating: onchain checks the real ORACLE_ATTESTOR_ROLE/AUDITOR_ROLE/SUPER_ADMIN_ROLE
  // directly (didService's derivedRole doesn't cover the new role — it only ever checks the
  // app's original 5-role union). Mock mode has no dedicated "oracle attestor" demo persona
  // (adding a 6th role to the app-wide Role union would ripple through every Record<Role,...>
  // in the app for a cosmetic persona swap) — MANAGER stands in for it there, same way it
  // already stands in for the dual-attestation mint co-signer.
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

  const [submitOpen, setSubmitOpen] = useState(false);
  const [factType, setFactType] = useState(1);
  const [evidence, setEvidence] = useState("");
  const [disputeTarget, setDisputeTarget] = useState<number | null>(null);
  const [disputeReason, setDisputeReason] = useState("");
  const [oracleError, setOracleError] = useState<string | null>(null);

  async function submitFact() {
    if (!evidence) return;
    setOracleError(null);
    try {
      const dataHash = keccak256(toBytes(evidence));
      await oracleService.submitFact({ tokenId, factType, dataHash, proposer: currentActorId });
      setSubmitOpen(false);
      setEvidence("");
    } catch (err) {
      setOracleError(err instanceof Error ? err.message : "Failed to submit fact");
    }
  }

  async function submitDispute() {
    if (disputeTarget === null || !disputeReason) return;
    setOracleError(null);
    try {
      await oracleService.raiseDispute(disputeTarget, disputeReason, currentActorId);
      setDisputeTarget(null);
      setDisputeReason("");
    } catch (err) {
      setOracleError(err instanceof Error ? err.message : "Failed to raise dispute");
    }
  }

  if (!asset) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
        <EmptyState title="Asset not found" description={`No asset with token ID #${params.tokenId} exists in the registry.`} />
      </div>
    );
  }

  const owner = findIdentity(asset.ownerDid);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <Link href="/assets" className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-ink-400 hover:text-ink-200">
        <ArrowLeft size={14} /> Back to registry
      </Link>

      <Card className="mb-5">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <p className="mono-value text-[12px] text-ink-600">Token #{asset.tokenId}</p>
            <h1 className="mt-0.5 text-[17px] font-medium text-ink-50">{asset.name}</h1>
          </div>
          <Badge tone={statusTone[asset.status]}>{asset.status.replace("_", " ")}</Badge>
        </div>

        <div className="grid grid-cols-2 gap-4 border-t border-graphite-800 pt-4 md:grid-cols-3">
          <div>
            <p className="mb-1 text-[11px] uppercase tracking-wide text-ink-600">Category</p>
            <p className="text-[13px] text-ink-200">{asset.category}</p>
          </div>
          <div>
            <p className="mb-1 text-[11px] uppercase tracking-wide text-ink-600">Owner</p>
            <p className="text-[13px] text-ink-200">{owner?.name ?? truncateMiddle(asset.ownerDid)}</p>
          </div>
          <div>
            <p className="mb-1 text-[11px] uppercase tracking-wide text-ink-600">CID</p>
            <MonoValue className="text-[12px]">{truncateMiddle(asset.cid, 10, 6)}</MonoValue>
          </div>
          <div>
            <p className="mb-1 text-[11px] uppercase tracking-wide text-ink-600">Proposer</p>
            <p className="text-[13px] text-ink-200">{findIdentity(asset.proposer)?.name ?? "—"}</p>
          </div>
          <div>
            <p className="mb-1 text-[11px] uppercase tracking-wide text-ink-600">Co-signer</p>
            <p className="text-[13px] text-ink-200">{asset.coSigner ? findIdentity(asset.coSigner)?.name ?? "—" : "Awaiting co-sign"}</p>
          </div>
          <div>
            <p className="mb-1 text-[11px] uppercase tracking-wide text-ink-600">Legal reference</p>
            {asset.legalReference ? (
              <span className="flex items-center gap-1 text-[13px] text-verified-400">
                <FileCheck size={12} /> Attached
              </span>
            ) : (
              <span className="text-[13px] text-ink-600">None</span>
            )}
          </div>
        </div>

        {asset.legalReference && (
          <p className="mt-3 text-[11px] text-ink-600">
            Not yet a recognized legal title under current Indian law — a hash bridge to an off-chain
            document, per docs/FEATURES.md F3.4.
          </p>
        )}

        <div className="mt-4 flex gap-2">
          {asset.status === "finalized" && (
            <Link href={`/assets/${asset.tokenId}/transfer`}>
              <Button variant="secondary">Initiate transfer</Button>
            </Link>
          )}
          <a
            href={`https://sepolia.etherscan.io/token/${asset.tokenId}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-xl border border-graphite-800 bg-graphite-900 px-3.5 py-2 text-[13px] text-ink-400 hover:border-graphite-600 hover:text-ink-200"
          >
            View on-chain <ExternalLink size={12} />
          </a>
        </div>
      </Card>

      <Card>
        <h3 className="mb-4 text-[13px] font-medium text-ink-50">Provenance</h3>
        <div className="flex flex-col gap-4">
          {asset.provenance.map((step, i) => (
            <div key={i} className="flex gap-3">
              <div className="flex flex-col items-center">
                <span className="h-2 w-2 shrink-0 rounded-full bg-signal-500" />
                {i < asset.provenance.length - 1 && <span className="mt-1 w-px flex-1 bg-graphite-800" />}
              </div>
              <div className="pb-2">
                <p className="text-[13px] text-ink-200">{step.label}</p>
                <p className="mt-0.5 text-[11px] text-ink-600">
                  {findIdentity(step.actorDid)?.name ?? truncateMiddle(step.actorDid)} · {formatRelativeTime(step.timestamp)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card className="mt-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-[13px] font-medium text-ink-50">Oracle facts</h3>
          {canAttest && (
            <Button variant="secondary" className="px-2.5 py-1 text-[12px]" onClick={() => setSubmitOpen(true)}>
              <Radio size={12} /> Submit fact
            </Button>
          )}
        </div>

        {oracleError && (
          <p className="mb-3 rounded-xl border border-danger-500/25 bg-danger-500/[0.04] p-2.5 text-[12px] text-danger-400">
            {oracleError}
          </p>
        )}

        {oracleService.getFactsForAsset(tokenId).length === 0 ? (
          <p className="text-[12px] text-ink-600">
            No real-world facts (delivery, damage, decommission…) have been attested for this asset yet.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {oracleService.getFactsForAsset(tokenId).map((fact) => {
              const canFinalize = fact.status === "attested" && (fact.disputeWindowEnd ?? Infinity) <= now;
              const canDisputeThis = canDispute && fact.status === "attested" && (fact.disputeWindowEnd ?? 0) > now;
              return (
                <div key={fact.factId} className="rounded-2xl border border-graphite-800 p-3">
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="text-[13px] text-ink-200">
                      {FACT_TYPE_LABELS[fact.factType] ?? `Fact type ${fact.factType}`}
                    </span>
                    <Badge tone={factStatusTone[fact.status]}>{fact.status}</Badge>
                  </div>
                  <p className="mono-value text-[11px] text-ink-600">{truncateMiddle(fact.dataHash, 10, 6)}</p>
                  <p className="mt-1 text-[11px] text-ink-600">
                    Proposed by {findIdentity(fact.proposer)?.name ?? truncateMiddle(fact.proposer)}
                    {fact.coSigner && <> · attested by {findIdentity(fact.coSigner)?.name ?? truncateMiddle(fact.coSigner)}</>}
                    {" · "}
                    {formatRelativeTime(fact.submittedAt)}
                  </p>

                  {fact.status === "submitted" && canAttest && (
                    <div className="mt-2">
                      <Button
                        variant="secondary"
                        className="px-2.5 py-1 text-[11px]"
                        onClick={() => oracleService.attestFact(fact.factId, currentActorId)}
                        disabled={oracleService.isPending}
                      >
                        Attest
                      </Button>
                    </div>
                  )}

                  {fact.status === "attested" && (
                    <div className="mt-2 flex items-center gap-2">
                      {canFinalize && (
                        <Button
                          variant="secondary"
                          className="px-2.5 py-1 text-[11px]"
                          onClick={() => oracleService.finalize(fact.factId)}
                          disabled={oracleService.isPending}
                        >
                          <CheckCircle2 size={12} /> Finalize
                        </Button>
                      )}
                      {canDisputeThis && (
                        <Button
                          variant="danger"
                          className="px-2.5 py-1 text-[11px]"
                          onClick={() => setDisputeTarget(fact.factId)}
                        >
                          <Flag size={12} /> Dispute
                        </Button>
                      )}
                    </div>
                  )}

                  {fact.status === "disputed" && (
                    <div className="mt-2 rounded-xl bg-danger-500/10 p-2 text-[12px] text-danger-400">
                      <span className="font-medium">
                        {findIdentity(fact.disputedBy ?? "")?.name ?? "An Auditor"}:
                      </span>{" "}
                      {fact.disputeReason}
                      {canResolve && (
                        <div className="mt-2 flex gap-2">
                          <Button
                            variant="secondary"
                            className="px-2.5 py-1 text-[11px]"
                            onClick={() => oracleService.resolveDispute(fact.factId, true, currentActorId)}
                          >
                            <CheckCircle2 size={12} /> Proceed
                          </Button>
                          <Button
                            variant="danger"
                            className="px-2.5 py-1 text-[11px]"
                            onClick={() => oracleService.resolveDispute(fact.factId, false, currentActorId)}
                          >
                            <XCircle size={12} /> Reject
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Dialog open={submitOpen} onOpenChange={setSubmitOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Submit oracle fact for token #{tokenId}</DialogTitle>
            <DialogDescription>
              A second independent attestor must confirm this before it enters its dispute window.
            </DialogDescription>
          </DialogHeader>
          <select
            value={factType}
            onChange={(e) => setFactType(Number(e.target.value))}
            className="w-full rounded-xl border border-graphite-800 bg-graphite-900 px-3 py-2 text-[13px] text-ink-50 focus:border-signal-500 focus:outline-none"
          >
            {Object.entries(FACT_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <textarea
            value={evidence}
            onChange={(e) => setEvidence(e.target.value)}
            placeholder="Evidence description (delivery note, inspection reference…) — hashed on submission, not stored in plaintext onchain"
            rows={3}
            className="w-full rounded-xl border border-graphite-800 bg-graphite-900 px-3 py-2 text-[13px] text-ink-50 placeholder:text-ink-700 focus:border-signal-500 focus:outline-none"
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSubmitOpen(false)}>
              Cancel
            </Button>
            <Button variant="secondary" disabled={!evidence} onClick={submitFact}>
              Submit fact
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={disputeTarget !== null} onOpenChange={(open) => !open && setDisputeTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Raise dispute on fact #{disputeTarget}</DialogTitle>
            <DialogDescription>This blocks finalization until a Super Admin resolves it.</DialogDescription>
          </DialogHeader>
          <textarea
            value={disputeReason}
            onChange={(e) => setDisputeReason(e.target.value)}
            placeholder="Reason for dispute…"
            rows={3}
            className="w-full rounded-xl border border-graphite-800 bg-graphite-900 px-3 py-2 text-[13px] text-ink-50 placeholder:text-ink-700 focus:border-danger-500 focus:outline-none"
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDisputeTarget(null)}>
              Cancel
            </Button>
            <Button variant="danger" disabled={!disputeReason} onClick={submitDispute}>
              Raise dispute
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
