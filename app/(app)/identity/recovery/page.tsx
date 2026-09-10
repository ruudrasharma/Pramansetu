"use client";

import { useState } from "react";
import Link from "next/link";
import { Users, ShieldAlert, Clock, Check, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { IconBadge } from "@/components/ui/IconBadge";
import { EmptyState } from "@/components/ui/Card";
import { DateStrip } from "@/components/ui/DateStrip";
import { TimelockCountdown } from "@/components/modules/TimelockCountdown";
import { GuardianStatusBadge } from "@/components/modules/GuardianStatusBadge";
import { truncateMiddle } from "@/lib/utils";
import { findIdentity } from "@/lib/mock/fixtures";
import { useDidService } from "@/lib/services/didService";
import { useCurrentIdentity } from "@/lib/hooks/useCurrentIdentity";
import { dataMode } from "@/lib/services/dataMode";

const DAY_MS = 24 * 3_600_000;

export default function GuardianRecoveryPage() {
  const { did: myDid, isResolving: isResolvingMe, hasNoDid } = useCurrentIdentity();
  const didService = useDidService(myDid);
  const me = didService.resolveDID();
  const guardianSet = didService.getGuardians();
  const [actionError, setActionError] = useState<string | null>(null);

  const recovery = guardianSet?.activeRecovery;
  const signedCount = recovery?.signatures.length ?? 0;
  const threshold = guardianSet?.threshold ?? 0;
  const timelockMet = recovery ? Date.now() >= recovery.timelockEndsAt : false;

  async function handleFinalize() {
    if (!me) return;
    setActionError(null);
    try {
      await didService.finalizeRecovery(me.did);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to finalize recovery");
    }
  }

  if (dataMode === "onchain" && (!myDid || !me)) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
        <Card className="flex items-center gap-2 text-[13px] text-ink-400">
          {isResolvingMe ? (
            <>
              <Loader2 size={14} className="animate-spin" /> Resolving your identity from the connected wallet…
            </>
          ) : hasNoDid ? (
            "No DID registered for this wallet yet — create one from the Identity page first."
          ) : (
            "Connect a wallet to view guardian recovery status."
          )}
        </Card>
      </div>
    );
  }

  if (!me) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
        <Card className="flex items-center gap-2 text-[13px] text-ink-400">
          <Loader2 size={14} className="animate-spin" /> Resolving identity…
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <div className="mb-5">
        <h2 className="text-[15px] font-medium text-ink-50">Guardian recovery</h2>
        <p className="mt-0.5 text-[13px] text-ink-400">
          No single point of recovery failure — any {threshold || "M"}-of-{guardianSet?.guardians.length ?? "N"}{" "}
          guardians can jointly rotate a lost key after a 24h cooling-off window.
        </p>
      </div>

      {actionError && (
        <Card className="mb-5 border-danger-500/25 bg-danger-500/[0.04] text-[13px] text-danger-400">{actionError}</Card>
      )}

      {!guardianSet ? (
        <EmptyState
          title="No guardians configured"
          description={`${me.name || truncateMiddle(me.did)} hasn't registered a guardian set yet. This happens once, during onboarding.`}
        />
      ) : (
        <>
          <Card className="mb-5">
            <div className="mb-3 flex items-center gap-2">
              <Users size={15} className="text-signal-400" />
              <h3 className="text-[14px] font-medium text-ink-50">Configured guardians</h3>
              <Badge tone="neutral">{guardianSet.threshold}-of-{guardianSet.guardians.length}</Badge>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {guardianSet.guardians.map((did) => {
                const g = findIdentity(did);
                const hasSigned = recovery?.signatures.includes(did);
                return (
                  <div key={did} className="flex items-center justify-between rounded-2xl border border-graphite-800 bg-graphite-900 px-3 py-2 text-[12px]">
                    <div className="min-w-0">
                      <p className="truncate text-ink-200">{g?.name ?? truncateMiddle(did)}</p>
                      <p className="mono-value truncate text-[11px] text-ink-600">{truncateMiddle(did, 10, 4)}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <GuardianStatusBadge guardianRef={did} />
                      {recovery && (hasSigned ? <Check size={14} className="text-verified-400" /> : <span className="text-ink-600">—</span>)}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          {recovery ? (
            <Card className="border-alert-500/25 bg-alert-500/[0.04]">
              <div className="mb-4 flex items-start gap-3">
                <IconBadge icon={ShieldAlert} tone="alert" />
                <div>
                  <h3 className="text-[14px] font-medium text-ink-50">Recovery in progress</h3>
                  <p className="mt-1 text-[13px] text-ink-400">
                    Initiated by {findIdentity(recovery.initiatedBy)?.name ?? truncateMiddle(recovery.initiatedBy)} — device reported lost.
                  </p>
                </div>
              </div>

              <DateStrip
                className="mb-4"
                items={Array.from({ length: Math.max(1, Math.ceil((recovery.timelockEndsAt - recovery.initiatedAt) / DAY_MS) + 1) }, (_, i) => ({
                  date: new Date(recovery.initiatedAt + i * DAY_MS),
                  tone: recovery.initiatedAt + i * DAY_MS >= recovery.timelockEndsAt ? ("verified" as const) : undefined,
                }))}
                selected={new Date(timelockMet ? recovery.timelockEndsAt : Date.now())}
              />

              <div className="mb-4 flex items-center justify-between rounded-2xl border border-graphite-800 bg-graphite-900 px-4 py-3">
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-ink-600">Guardian approval</p>
                  <p className={`mono-value mt-0.5 text-[15px] font-medium ${signedCount >= threshold ? "text-verified-400" : "text-ink-50"}`}>
                    {signedCount} of {threshold} guardians approved
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] uppercase tracking-wide text-ink-600">Cooling-off timelock</p>
                  <div className="mt-0.5 flex items-center gap-1.5">
                    <Clock size={13} className="text-ink-500" />
                    <TimelockCountdown eta={recovery.timelockEndsAt} size="sm" />
                  </div>
                </div>
              </div>

              <Button
                className="w-full"
                disabled={signedCount < threshold || !timelockMet || didService.isPending}
                onClick={handleFinalize}
              >
                {didService.isPending && <Loader2 size={14} className="animate-spin" />}
                {signedCount < threshold
                  ? `Awaiting ${threshold - signedCount} more guardian signature(s)`
                  : !timelockMet
                    ? "Awaiting timelock…"
                    : "Finalize recovery — rotate key"}
              </Button>
              {/* finalizeRecovery is permissionless once threshold + timelock are met — anyone,
                  including the affected identity viewing this page, can legitimately call it. */}
            </Card>
          ) : (
            <Card className="flex items-center justify-between gap-4">
              <div>
                <h3 className="text-[14px] font-medium text-ink-50">Lost your device?</h3>
                <p className="mt-1 max-w-md text-[13px] text-ink-400">
                  You can&apos;t initiate your own recovery — only a registered guardian&apos;s wallet can
                  (GuardianRecovery.sol only allows a guardian to call this). Ask one of the guardians above
                  to visit the guardian console and act on your behalf.
                </p>
              </div>
              {dataMode === "onchain" ? (
                <Link href="/identity/recovery/guardian" className="shrink-0">
                  <Button variant="secondary">Guardian console</Button>
                </Link>
              ) : (
                <Button
                  variant="secondary"
                  className="shrink-0"
                  onClick={() => didService.initiateRecovery(me.did, guardianSet.guardians[0]!)}
                >
                  Simulate recovery
                </Button>
              )}
            </Card>
          )}
        </>
      )}
    </div>
  );
}
