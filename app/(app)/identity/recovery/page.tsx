"use client";

import { Users, ShieldAlert, Clock, Check } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/Card";
import { TimelockCountdown } from "@/components/modules/TimelockCountdown";
import { truncateMiddle } from "@/lib/utils";
import { useAppStore } from "@/lib/store/appStore";
import { identityByRole, findIdentity } from "@/lib/mock/fixtures";
import { useDidService } from "@/lib/services/didService";

export default function GuardianRecoveryPage() {
  const activeRole = useAppStore((s) => s.activeRole);
  const me = identityByRole[activeRole];
  const didService = useDidService();
  const guardianSet = didService.getGuardians(me.did);

  const recovery = guardianSet?.activeRecovery;
  const signedCount = recovery?.signatures.length ?? 0;
  const threshold = guardianSet?.threshold ?? 0;
  const timelockMet = recovery ? Date.now() >= recovery.timelockEndsAt : false;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <div className="mb-5">
        <h2 className="text-[15px] font-medium text-ink-50">Guardian recovery</h2>
        <p className="mt-0.5 text-[13px] text-ink-400">
          No single point of recovery failure — any {threshold || "M"}-of-{guardianSet?.guardians.length ?? "N"}{" "}
          guardians can jointly rotate a lost key after a 24h cooling-off window.
        </p>
      </div>

      {!guardianSet ? (
        <EmptyState
          title="No guardians configured"
          description={`${me.name} hasn't registered a guardian set yet. This happens once, during onboarding.`}
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
                  <div key={did} className="flex items-center justify-between rounded-lg border border-graphite-800 bg-graphite-900 px-3 py-2 text-[12px]">
                    <div className="min-w-0">
                      <p className="truncate text-ink-200">{g?.name ?? truncateMiddle(did)}</p>
                      <p className="mono-value truncate text-[11px] text-ink-600">{truncateMiddle(did, 10, 4)}</p>
                    </div>
                    {recovery && (hasSigned ? <Check size={14} className="text-verified-400" /> : <span className="text-ink-600">—</span>)}
                  </div>
                );
              })}
            </div>
          </Card>

          {recovery ? (
            <Card className="border-alert-500/25 bg-alert-500/[0.04]">
              <div className="mb-4 flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-alert-500/10 text-alert-400">
                  <ShieldAlert size={17} strokeWidth={1.75} />
                </div>
                <div>
                  <h3 className="text-[14px] font-medium text-ink-50">Recovery in progress</h3>
                  <p className="mt-1 text-[13px] text-ink-400">
                    Initiated by {findIdentity(recovery.initiatedBy)?.name ?? truncateMiddle(recovery.initiatedBy)} — device reported lost.
                  </p>
                </div>
              </div>

              <div className="mb-4 flex items-center justify-between rounded-lg border border-graphite-800 bg-graphite-900 px-4 py-3">
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

              <Button disabled={signedCount < threshold || !timelockMet} className="w-full">
                {signedCount < threshold
                  ? `Awaiting ${threshold - signedCount} more guardian signature(s)`
                  : !timelockMet
                    ? "Awaiting timelock…"
                    : "Finalize recovery — rotate key"}
              </Button>
            </Card>
          ) : (
            <Card className="flex items-center justify-between gap-4">
              <div>
                <h3 className="text-[14px] font-medium text-ink-50">Lost your device?</h3>
                <p className="mt-1 max-w-md text-[13px] text-ink-400">
                  Any guardian above can initiate recovery on your behalf. Once {guardianSet.threshold} of them
                  sign and 24h elapse, your key rotates and all roles/assets stay intact.
                </p>
              </div>
              <Button
                variant="secondary"
                className="shrink-0"
                onClick={() => didService.initiateRecovery(me.did, guardianSet.guardians[0]!)}
              >
                Simulate recovery
              </Button>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
