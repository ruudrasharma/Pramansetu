"use client";

import { identities } from "@/lib/mock-data";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ExpiryRing } from "@/components/modules/ExpiryRing";
import { truncateMiddle } from "@/lib/utils";
import { Users, Copy } from "lucide-react";

const statusTone = { verified: "verified", pending: "alert", revoked: "danger" } as const;

export default function IdentityPage() {
  return (
    <div className="mx-auto max-w-7xl px-6 py-6">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h2 className="text-[15px] font-medium text-ink-50">Decentralized identities</h2>
          <p className="mt-0.5 text-[13px] text-ink-400">
            Every user, device, and department is a DID — credential-gated, guardian-recoverable, no
            master identity database.
          </p>
        </div>
        <Button variant="secondary">Register guardians</Button>
      </div>

      <Card className="overflow-hidden p-0">
        <table className="w-full text-left text-[13px]">
          <thead>
            <tr className="border-b border-graphite-800 text-[11px] uppercase tracking-wide text-ink-600">
              <th className="px-5 py-3 font-medium">DID</th>
              <th className="px-5 py-3 font-medium">Role</th>
              <th className="px-5 py-3 font-medium">Credential</th>
              <th className="px-5 py-3 font-medium">Guardians</th>
              <th className="px-5 py-3 font-medium">Role expiry</th>
            </tr>
          </thead>
          <tbody>
            {identities.map((identity) => (
              <tr key={identity.did} className="border-b border-graphite-800 last:border-none hover:bg-graphite-800/30">
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2">
                    <span className="mono-value text-ink-200">{truncateMiddle(identity.did, 16, 6)}</span>
                    <button aria-label="Copy DID" className="text-ink-600 hover:text-ink-300">
                      <Copy size={12} />
                    </button>
                  </div>
                </td>
                <td className="px-5 py-3">
                  <Badge tone="neutral">{identity.role}</Badge>
                </td>
                <td className="px-5 py-3">
                  <Badge tone={statusTone[identity.credentialStatus]}>{identity.credentialStatus}</Badge>
                </td>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-1.5 text-ink-400">
                    <Users size={13} />
                    <span>{identity.guardianCount || "—"}</span>
                  </div>
                </td>
                <td className="px-5 py-3">
                  <ExpiryRing expiresAt={identity.roleExpiresAt} size={28} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
