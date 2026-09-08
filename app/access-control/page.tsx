"use client";

import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ExpiryRing } from "@/components/modules/ExpiryRing";
import { truncateMiddle, expiryLevel } from "@/lib/utils";
import { Octagon, AlertTriangle } from "lucide-react";

import { useAccount } from "wagmi";
import { ROLE, useRoleExpiry, usePlatformPaused } from "@/lib/hooks";

const rolesToDisplay = [
  { name: "SUPER_ADMIN", hash: ROLE.SUPER_ADMIN_ROLE },
  { name: "ADMIN", hash: ROLE.ADMIN_ROLE },
  { name: "MANAGER", hash: ROLE.MANAGER_ROLE },
  { name: "AUDITOR", hash: ROLE.AUDITOR_ROLE },
];

function RoleRow({ roleName, roleHash, account }: { roleName: string; roleHash: `0x${string}`; account: `0x${string}` }) {
  const { data: expiry, isLoading } = useRoleExpiry(roleHash, account);
  
  if (isLoading) return (
    <tr className="border-b border-graphite-800 last:border-none hover:bg-graphite-800/30">
      <td className="px-5 py-3"><Badge tone="neutral">{roleName}</Badge></td>
      <td className="px-5 py-3" colSpan={3}><span className="text-ink-500">Loading...</span></td>
    </tr>
  );

  const expiryTimestamp = Number(expiry ?? 0) * 1000;
  // if expiry is 0, they don't have the role. If it's max uint256, it's permanent.
  const hasRole = expiryTimestamp > Date.now();
  const level = expiryLevel(expiryTimestamp);

  return (
    <tr className="border-b border-graphite-800 last:border-none hover:bg-graphite-800/30">
      <td className="px-5 py-3">
        <Badge tone={hasRole ? "neutral" : "neutral"}>{roleName}</Badge>
      </td>
      <td className="px-5 py-3">
        {hasRole ? (
          <span className="mono-value text-ink-200">{truncateMiddle(account, 16, 6)}</span>
        ) : (
          <span className="text-ink-600">—</span>
        )}
      </td>
      <td className="px-5 py-3">
        {hasRole ? <ExpiryRing expiresAt={expiryTimestamp} size={28} /> : <span className="text-ink-600">—</span>}
      </td>
      <td className="px-5 py-3">
        {!hasRole ? (
          <Badge tone="neutral" className="opacity-50">inactive</Badge>
        ) : level === "expired" ? (
          <Badge tone="danger">expired</Badge>
        ) : level === "critical" ? (
          <Badge tone="alert">expiring soon</Badge>
        ) : (
          <Badge tone="verified">active</Badge>
        )}
      </td>
    </tr>
  );
}

export default function AccessControlPage() {
  const { address, isConnected } = useAccount();
  const { data: isPaused } = usePlatformPaused();

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

      <Card className="mb-5 min-h-[200px] overflow-hidden p-0">
        {!isConnected ? (
          <div className="flex h-[200px] flex-col items-center justify-center gap-3 text-ink-400">
            <p className="text-[14px]">Connect your wallet to view your access roles.</p>
            <w3m-button />
          </div>
        ) : (
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="border-b border-graphite-800 text-[11px] uppercase tracking-wide text-ink-600">
                <th className="px-5 py-3 font-medium">Role</th>
                <th className="px-5 py-3 font-medium">Identity</th>
                <th className="px-5 py-3 font-medium">Expiry</th>
                <th className="px-5 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {rolesToDisplay.map((r) => (
                <RoleRow key={r.name} roleName={r.name} roleHash={r.hash} account={address as `0x${string}`} />
              ))}
            </tbody>
          </table>
        )}
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
          <Button variant="danger" className="shrink-0" disabled={isPaused}>
            <AlertTriangle size={14} />
            {isPaused ? "Platform is Paused" : "Pause platform"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
