"use client";

import { useQuery } from "@tanstack/react-query";
import { graphQLClient } from "@/lib/graphql";
import { GET_GOVERNANCE } from "@/lib/queries";
import { useState } from "react";
import { useQueuedTx, useNextTxId } from "@/lib/hooks";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { SignerChips } from "@/components/modules/SignerChips";
import { formatCountdown, truncateMiddle } from "@/lib/utils";
import { Flag, Clock, Search } from "lucide-react";

function TimelockLookup() {
  const { data: nextTxId } = useNextTxId();
  const [txIdInput, setTxIdInput] = useState("");
  const [searchTxId, setSearchTxId] = useState<bigint | undefined>();

  const { data: tx, isLoading } = useQueuedTx(searchTxId);

  const statusMap = ["Queued", "Executed", "Disputed", "Cancelled"];

  return (
    <div className="flex flex-col gap-3">
      <Card className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <p className="text-[13px] text-ink-400">Total queued transactions: {nextTxId?.toString() ?? "..."}</p>
        </div>
        <div className="flex gap-2">
          <input 
            type="number"
            placeholder="Enter Tx ID"
            className="flex-1 rounded-lg border border-graphite-800 bg-graphite-900 px-3 py-2 text-[13px] text-ink-50 placeholder:text-ink-600 focus:border-graphite-600 focus:outline-none"
            value={txIdInput}
            onChange={(e) => setTxIdInput(e.target.value)}
          />
          <Button onClick={() => setSearchTxId(txIdInput ? BigInt(txIdInput) : undefined)}>
            <Search size={14} />
            Lookup
          </Button>
        </div>
      </Card>

      {isLoading ? (
        <Card className="flex items-center justify-center py-8 text-[13px] text-ink-500">Querying transaction...</Card>
      ) : searchTxId !== undefined && tx ? (
        <Card className={tx[3] === 2 ? "border-danger-500/25 bg-danger-500/[0.04]" : ""}>
          <div className="mb-3 flex items-center justify-between">
            <Badge tone="neutral">Tx #{searchTxId.toString()}</Badge>
            <Badge tone={tx[3] === 2 ? "danger" : tx[3] === 1 ? "verified" : tx[3] === 3 ? "neutral" : "alert"}>
              {statusMap[tx[3]] || "Unknown"}
            </Badge>
          </div>
          <div className="flex flex-col gap-1 text-[13px]">
            <div className="flex justify-between"><span className="text-ink-400">Target</span><span className="mono-value text-ink-200">{truncateMiddle(tx[0], 10, 6)}</span></div>
            <div className="flex justify-between"><span className="text-ink-400">Raised By</span><span className="mono-value text-ink-200">{tx[4] === "0x0000000000000000000000000000000000000000" ? "—" : truncateMiddle(tx[4], 10, 6)}</span></div>
          </div>

          {tx[3] === 2 ? (
            <div className="mt-3 flex items-start gap-2 rounded-lg bg-danger-500/10 p-2.5 text-[12px] text-danger-400">
              <Flag size={13} className="mt-0.5 shrink-0" />
              <span>{tx[5] || "No reason provided"}</span>
            </div>
          ) : (
            tx[2] > 0n && (
              <div className="mt-3 flex items-center gap-1.5 text-[12px] text-ink-400">
                <Clock size={13} />
                <span className="mono-value">ETA: {new Date(Number(tx[2]) * 1000).toLocaleString()}</span>
              </div>
            )
          )}
        </Card>
      ) : searchTxId !== undefined ? (
        <Card className="flex items-center justify-center py-8 text-[13px] text-ink-500">Transaction not found.</Card>
      ) : null}
    </div>
  );
}

export default function GovernancePage() {
  const { data, isLoading } = useQuery({
    queryKey: ["governanceData"],
    queryFn: async () => graphQLClient.request<any>(GET_GOVERNANCE),
    refetchInterval: 5000,
  });

  const queueItems = data?.governanceTxs || [];

  return (
    <div className="mx-auto max-w-7xl px-6 py-6">
      <div className="mb-5">
        <h2 className="text-[15px] font-medium text-ink-50">Governance</h2>
        <p className="mt-0.5 text-[13px] text-ink-400">
          No single Admin key acts alone. High-privilege actions require multisig; high-value
          transfers cool off before finalizing, and any Auditor can freeze one mid-window.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div>
          <h3 className="mb-3 text-[13px] font-medium text-ink-400">Timelock queue</h3>
          <div className="flex flex-col gap-3">
            {isLoading ? (
              <Card className="flex items-center justify-center py-8 text-[13px] text-ink-500">Loading queue...</Card>
            ) : queueItems.length === 0 ? (
              <Card className="flex items-center justify-center py-8 text-[13px] text-ink-500">No queued transactions.</Card>
            ) : queueItems.map((item: any) => {
              const status = item.executed ? "executed" : item.dispute && !item.dispute.resolved ? "disputed" : "queued";
              return (
                <Card key={item.id}>
                  <div className="mb-3 flex items-center justify-between">
                    <Badge tone="neutral">Tx #{item.txId}</Badge>
                    <Badge tone={status === "disputed" ? "danger" : status === "executed" ? "verified" : "signal"}>{status}</Badge>
                  </div>
                  <p className="text-[13px] text-ink-50 truncate">Target: {item.target}</p>
                  {item.dispute && !item.dispute.resolved && (
                    <div className="mt-3 flex items-start gap-2 rounded-lg bg-danger-500/10 p-2.5 text-[12px] text-danger-400">
                      <Flag size={13} className="mt-0.5 shrink-0" />
                      <span>{item.dispute.reason}</span>
                    </div>
                  )}
                  {status === "queued" && (
                    <div className="mt-3 flex items-center gap-1.5 text-[12px] text-ink-400">
                      <Clock size={13} />
                      <span className="mono-value">ETA: {new Date(Number(item.eta) * 1000).toLocaleString()}</span>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        </div>

        <div>
          <h3 className="mb-3 text-[13px] font-medium text-ink-400">Timelock lookup</h3>
          <TimelockLookup />
        </div>
      </div>
    </div>
  );
}
