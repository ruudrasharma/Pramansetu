"use client";

import { identities } from "@/lib/mock-data";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ExpiryRing } from "@/components/modules/ExpiryRing";
import { truncateMiddle } from "@/lib/utils";
import { Users, Copy } from "lucide-react";

import { useAccount } from "wagmi";
import { useDIDOf, useResolveDID } from "@/lib/hooks";
import { formatDistanceToNow } from "date-fns";

const statusTone = { verified: "verified", pending: "alert", revoked: "danger" } as const;

export default function IdentityPage() {
  const { address, isConnected } = useAccount();
  const { data: did, isLoading: isDIDLoading } = useDIDOf(address);
  const { data: didDoc, isLoading: isDocLoading } = useResolveDID(did);

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

      <Card className="min-h-[200px] p-6">
        {!isConnected ? (
          <div className="flex h-[150px] flex-col items-center justify-center gap-3 text-ink-400">
            <p className="text-[14px]">Connect your wallet to view your identity.</p>
            <w3m-button />
          </div>
        ) : isDIDLoading || isDocLoading ? (
          <div className="flex h-[150px] items-center justify-center text-[13px] text-ink-500">
            Loading identity data...
          </div>
        ) : !did || did === "0x0000000000000000000000000000000000000000000000000000000000000000" ? (
          <div className="flex h-[150px] flex-col items-center justify-center gap-2 text-ink-400">
            <p className="text-[14px]">No DID found for this wallet address.</p>
            <span className="mono-value text-[11px]">{address}</span>
            <Button variant="primary" className="mt-2">Create DID</Button>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            <div>
              <p className="mb-1 text-[12px] uppercase tracking-wide text-ink-600">Your DID</p>
              <div className="flex items-center gap-2">
                <span className="mono-value text-[15px] text-ink-100">{did}</span>
                <button aria-label="Copy DID" className="text-ink-600 hover:text-ink-300">
                  <Copy size={14} />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <div>
                <p className="mb-1 text-[12px] uppercase tracking-wide text-ink-600">Controller</p>
                <span className="mono-value text-[13px] text-ink-200">{truncateMiddle(didDoc?.controller ?? "", 10, 6)}</span>
              </div>
              <div>
                <p className="mb-1 text-[12px] uppercase tracking-wide text-ink-600">Created</p>
                <span className="text-[13px] text-ink-200">
                  {didDoc?.createdAt ? formatDistanceToNow(Number(didDoc.createdAt) * 1000, { addSuffix: true }) : "Unknown"}
                </span>
              </div>
              <div>
                <p className="mb-1 text-[12px] uppercase tracking-wide text-ink-600">Status</p>
                <Badge tone={didDoc?.exists ? "verified" : "danger"}>
                  {didDoc?.exists ? "Active" : "Inactive"}
                </Badge>
              </div>
              <div>
                <p className="mb-1 text-[12px] uppercase tracking-wide text-ink-600">Key Type</p>
                <span className="mono-value text-[13px] text-ink-200">{didDoc?.exists ? "ES256K" : "—"}</span>
              </div>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
