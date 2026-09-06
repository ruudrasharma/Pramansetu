"use client";

import { identities, systemHealth } from "@/lib/mock-data";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ExpiryRing } from "@/components/modules/ExpiryRing";
import { truncateMiddle, expiryLevel } from "@/lib/utils";
import { Octagon, AlertTriangle } from "lucide-react";

const roleOrder = ["SUPER_ADMIN", "ADMIN", "MANAGER", "AUDITOR", "USER"] as const;

export default function AccessControlPage() {
  return (
    <div className="mx-auto max-w-7xl px-6 py-6">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h2 className="text-[15px] font-medium text-ink-50">Role matrix</h2>
          <p className="mt-0.5 text-[13px] text-ink-400">
            Access is enforced inside the contract — every grant is time-bound and expires
            automatically. No manual override path exists.
          </p>
        </div>
        <Button variant="secondary">Grant timed role</Button>
      </div>

      <Card className="mb-5 overflow-hidden p-0">
        <table className="w-full text-left text-[13px]">
          <thead>
            <tr className="border-b border-graphite-800 text-[11px] uppercase tracking-wide text-ink-600">
              <th className="px-5 py-3 font-medium">Identity</th>
              <th className="px-5 py-3 font-medium">Held role</th>
              <th className="px-5 py-3 font-medium">Expiry</th>
              <th className="px-5 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {identities.map((identity) => {
              const level = expiryLevel(identity.roleExpiresAt);
              return (
                <tr key={identity.did} className="border-b border-graphite-800 last:border-none hover:bg-graphite-800/30">
                  <td className="px-5 py-3">
                    <span className="mono-value text-ink-200">{truncateMiddle(identity.did, 16, 6)}</span>
                  </td>
                  <td className="px-5 py-3">
                    <Badge tone="neutral">{identity.role}</Badge>
                  </td>
                  <td className="px-5 py-3">
                    <ExpiryRing expiresAt={identity.roleExpiresAt} size={28} />
                  </td>
                  <td className="px-5 py-3">
                    {level === "expired" ? (
                      <Badge tone="danger">expired — hasRole() now false</Badge>
                    ) : level === "critical" ? (
                      <Badge tone="alert">expiring soon</Badge>
                    ) : (
                      <Badge tone="verified">active</Badge>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      <Card className="border-danger-500/25 bg-danger-500/[0.04]">
        <div className="flex items-start justify-between gap-6">
          <div className="flex gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-danger-500/10 text-danger-400">
              <Octagon size={17} strokeWidth={1.75} />
            </div>
            <div>
              <h3 className="text-[14px] font-medium text-ink-50">Emergency pause</h3>
              <p className="mt-1 max-w-md text-[13px] text-ink-400">
                Freezes every state-changing function across all modules — minting, transfers, role
                grants, governance execution — in a single transaction. Requires 2 Super Admin
                signatures. Use only on suspected key compromise.
              </p>
            </div>
          </div>
          <Button variant="danger" className="shrink-0">
            <AlertTriangle size={14} />
            Pause platform
          </Button>
        </div>
      </Card>
    </div>
  );
}
