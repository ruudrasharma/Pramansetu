"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, ShieldAlert, Users, Check, Loader2, KeyRound, PenLine, PlayCircle } from "lucide-react";
import { Card, EmptyState } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { IconBadge } from "@/components/ui/IconBadge";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/Select";
import { TimelockCountdown } from "@/components/modules/TimelockCountdown";
import { truncateMiddle } from "@/lib/utils";
import { identities, findIdentity } from "@/lib/mock/fixtures";
import { useDidService } from "@/lib/services/didService";
import { useCurrentIdentity } from "@/lib/hooks/useCurrentIdentity";
import { dataMode } from "@/lib/services/dataMode";

/**
 * /identity/recovery/guardian — the real guardian-actor console (T-039). `/identity/recovery`
 * shows *my own* recovery status (correct for viewing, but a lost-key victim's own connected
 * wallet can never itself call initiateRecovery/signRecovery — only a registered guardian's
 * wallet can, per GuardianRecovery.sol's onlyGuardian checks). This page takes an explicit target
 * DID instead of assuming "my own" — any connected wallet can look one up; the contract's own
 * NotAGuardian() revert is the real enforcement boundary if the connected wallet isn't actually
 * one of that DID's registered guardians, same "frontend is UX only" principle as everywhere else
 * in this app (docs/SECURITY.md §4).
 */
export default function GuardianConsolePage() {
  const { did: myDid } = useCurrentIdentity();
  const [targetDid, setTargetDid] = useState(dataMode === "mock" ? (identities[0]?.did ?? "") : "");
  const didService = useDidService(targetDid || undefined);
  const target = didService.resolveDID();
  const guardianSet = didService.getGuardians();
  const recovery = guardianSet?.activeRecovery;

  const [newController, setNewController] = useState("");
  const [newPubKey, setNewPubKey] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);

  const signedCount = recovery?.signatures.length ?? 0;
  const threshold = guardianSet?.threshold ?? 0;
  const timelockMet = recovery ? Date.now() >= recovery.timelockEndsAt : false;

  async function handleInitiate() {
    setActionError(null);
    try {
      if (dataMode === "onchain") {
        if (!newController || !newPubKey) {
          setActionError("Enter the affected identity's new controller address and public key.");
          return;
        }
        await didService.initiateRecovery(targetDid, myDid ?? "", { controller: newController, pubKey: newPubKey });
      } else {
        await didService.initiateRecovery(targetDid, myDid ?? identities[0]!.did);
      }
      setNewController("");
      setNewPubKey("");
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to initiate recovery");
    }
  }

  async function handleSign() {
    setActionError(null);
    try {
      await didService.signRecovery(targetDid, myDid ?? "");
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to sign recovery — are you a registered guardian for this DID?");
    }
  }

  async function handleFinalize() {
    setActionError(null);
    try {
      await didService.finalizeRecovery(targetDid);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to finalize recovery");
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <Link href="/identity/recovery" className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-ink-400 hover:text-ink-200">
        <ArrowLeft size={14} /> Back to my recovery status
      </Link>

      <div className="mb-5">
        <h2 className="text-[15px] font-medium text-ink-50">Act as a guardian</h2>
        <p className="mt-0.5 text-[13px] text-ink-400">
          Look up any DID to help recover it. The contract itself checks whether your connected wallet is
          actually one of that DID&apos;s registered guardians — nothing here pre-filters that for you.
        </p>
      </div>

      <Card className="mb-5">
        {dataMode === "mock" ? (
          <div>
            <label className="mb-1.5 block text-[12px] text-ink-500">Identity to recover</label>
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
          <div>
            <label className="mb-1.5 block text-[12px] text-ink-500">Target DID (bytes32)</label>
            <input
              value={targetDid}
              onChange={(e) => setTargetDid(e.target.value)}
              placeholder="0x..."
              className="w-full rounded-xl border border-graphite-800 bg-graphite-900 px-3 py-2 text-[13px] text-ink-50 mono-value focus:border-signal-500 focus:outline-none"
            />
          </div>
        )}
      </Card>

      {!targetDid ? (
        <EmptyState title="Enter a DID" description="Look up the identity whose recovery you want to help with." />
      ) : didService.isResolving ? (
        <Card className="flex items-center gap-2 text-[13px] text-ink-400">
          <Loader2 size={14} className="animate-spin" /> Resolving…
        </Card>
      ) : !target ? (
        <EmptyState title="No DID found" description="No identity is registered for this DID." />
      ) : !guardianSet ? (
        <EmptyState
          title="No guardians configured"
          description={`${target.name || truncateMiddle(target.did)} hasn't registered a guardian set yet.`}
        />
      ) : (
        <>
          <Card className="mb-5">
            <div className="mb-3 flex items-center gap-2">
              <Users size={15} className="text-signal-400" />
              <h3 className="text-[14px] font-medium text-ink-50">
                {target.name || truncateMiddle(target.did)}&apos;s guardians
              </h3>
              <Badge tone="neutral">
                {guardianSet.threshold}-of-{guardianSet.guardians.length}
              </Badge>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {guardianSet.guardians.map((g) => {
                const identity = findIdentity(g);
                const hasSigned = recovery?.signatures.includes(g);
                return (
                  <div key={g} className="flex items-center justify-between rounded-2xl border border-graphite-800 bg-graphite-900 px-3 py-2 text-[12px]">
                    <div className="min-w-0">
                      <p className="truncate text-ink-200">{identity?.name ?? truncateMiddle(g)}</p>
                      <p className="mono-value truncate text-[11px] text-ink-600">{truncateMiddle(g, 10, 4)}</p>
                    </div>
                    {recovery && (hasSigned ? <Check size={14} className="text-verified-400" /> : <span className="text-ink-600">—</span>)}
                  </div>
                );
              })}
            </div>
          </Card>

          {actionError && (
            <Card className="mb-4 border-danger-500/25 bg-danger-500/[0.04] text-[13px] text-danger-400">{actionError}</Card>
          )}

          {recovery ? (
            <Card className="border-alert-500/25 bg-alert-500/[0.04]">
              <div className="mb-4 flex items-start gap-3">
                <IconBadge icon={ShieldAlert} tone="alert" />
                <div>
                  <h3 className="text-[14px] font-medium text-ink-50">Recovery in progress</h3>
                  <p className="mt-1 text-[13px] text-ink-400">
                    Initiated by {findIdentity(recovery.initiatedBy)?.name ?? truncateMiddle(recovery.initiatedBy)} — new
                    controller <span className="mono-value">{truncateMiddle(recovery.newController, 8, 4)}</span>.
                  </p>
                </div>
              </div>

              <div className="mb-4 flex items-center justify-between rounded-2xl border border-graphite-800 bg-graphite-900 px-4 py-3">
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-ink-600">Guardian approval</p>
                  <p className={`mono-value mt-0.5 text-[15px] font-medium ${signedCount >= threshold ? "text-verified-400" : "text-ink-50"}`}>
                    {signedCount} of {threshold} guardians approved
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] uppercase tracking-wide text-ink-600">Cooling-off timelock</p>
                  <TimelockCountdown eta={recovery.timelockEndsAt} size="sm" />
                </div>
              </div>

              <div className="flex gap-2">
                <Button variant="secondary" className="flex-1" onClick={handleSign} disabled={didService.isPending}>
                  {didService.isPending ? <Loader2 size={14} className="animate-spin" /> : <PenLine size={14} />}
                  Sign as guardian
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleFinalize}
                  disabled={signedCount < threshold || !timelockMet || didService.isPending}
                >
                  {didService.isPending ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <PlayCircle size={14} />
                  )}
                  {signedCount < threshold
                    ? `Awaiting ${threshold - signedCount} more`
                    : !timelockMet
                      ? "Awaiting timelock…"
                      : "Finalize — rotate key"}
                </Button>
              </div>
            </Card>
          ) : (
            <Card>
              <div className="mb-3 flex items-center gap-2">
                <KeyRound size={15} className="text-signal-400" />
                <h3 className="text-[14px] font-medium text-ink-50">Initiate recovery</h3>
              </div>
              <p className="mb-3 text-[13px] text-ink-400">
                {dataMode === "onchain"
                  ? "Enter the new controller address and public key the affected identity generated on a new device — communicated to you out-of-band."
                  : "Simulates a guardian kicking off recovery on this identity's behalf."}
              </p>
              {dataMode === "onchain" && (
                <div className="mb-3 grid grid-cols-1 gap-3">
                  <div>
                    <label className="mb-1.5 block text-[12px] text-ink-500">New controller address</label>
                    <input
                      value={newController}
                      onChange={(e) => setNewController(e.target.value)}
                      placeholder="0x..."
                      className="w-full rounded-xl border border-graphite-800 bg-graphite-900 px-3 py-2 text-[13px] text-ink-50 mono-value focus:border-signal-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-[12px] text-ink-500">New public key</label>
                    <input
                      value={newPubKey}
                      onChange={(e) => setNewPubKey(e.target.value)}
                      placeholder="0x..."
                      className="w-full rounded-xl border border-graphite-800 bg-graphite-900 px-3 py-2 text-[13px] text-ink-50 mono-value focus:border-signal-500 focus:outline-none"
                    />
                  </div>
                </div>
              )}
              <Button onClick={handleInitiate} disabled={didService.isPending}>
                {didService.isPending && <Loader2 size={14} className="animate-spin" />}
                Initiate recovery
              </Button>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
