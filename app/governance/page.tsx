"use client";

import { governanceItems } from "@/lib/mock-data";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { SignerChips } from "@/components/modules/SignerChips";
import { formatCountdown } from "@/lib/utils";
import { Flag, Clock } from "lucide-react";

export default function GovernancePage() {
  const multisigItems = governanceItems.filter((g) => g.lane === "multisig");
  const timelockItems = governanceItems.filter((g) => g.lane === "timelock");

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
          <h3 className="mb-3 text-[13px] font-medium text-ink-400">Multisig queue</h3>
          <div className="flex flex-col gap-3">
            {multisigItems.map((item) => (
              <Card key={item.id}>
                <div className="mb-3 flex items-center justify-between">
                  <Badge tone="neutral">{item.kind}</Badge>
                  <Badge tone={item.status === "disputed" ? "danger" : "signal"}>{item.status}</Badge>
                </div>
                <p className="text-[13px] text-ink-50">{item.title}</p>
                <div className="mt-4">
                  <SignerChips signers={item.signers} required={item.requiredSignatures} />
                </div>
              </Card>
            ))}
          </div>
        </div>

        <div>
          <h3 className="mb-3 text-[13px] font-medium text-ink-400">Timelock queue</h3>
          <div className="flex flex-col gap-3">
            {timelockItems.map((item) => (
              <Card
                key={item.id}
                className={item.status === "disputed" ? "border-danger-500/25 bg-danger-500/[0.04]" : ""}
              >
                <div className="mb-3 flex items-center justify-between">
                  <Badge tone="neutral">{item.kind}</Badge>
                  <Badge tone={item.status === "disputed" ? "danger" : "alert"}>{item.status}</Badge>
                </div>
                <p className="text-[13px] text-ink-50">{item.title}</p>

                {item.status === "disputed" ? (
                  <div className="mt-3 flex items-start gap-2 rounded-lg bg-danger-500/10 p-2.5 text-[12px] text-danger-400">
                    <Flag size={13} className="mt-0.5 shrink-0" />
                    <span>{item.disputeReason}</span>
                  </div>
                ) : (
                  item.eta && (
                    <div className="mt-3 flex items-center gap-1.5 text-[12px] text-ink-400">
                      <Clock size={13} />
                      <span className="mono-value">Executable in {formatCountdown(item.eta)}</span>
                    </div>
                  )
                )}

                <div className="mt-4 flex items-center justify-between">
                  <SignerChips signers={item.signers} required={item.requiredSignatures} />
                  {item.status !== "disputed" && (
                    <Button variant="secondary">
                      <Flag size={13} />
                      Raise dispute
                    </Button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
