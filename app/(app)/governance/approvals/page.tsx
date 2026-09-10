"use client";

import { useState } from "react";
import { Card, EmptyState } from "@/components/ui/Card";
import { MultisigApprovalWidget } from "@/components/modules/MultisigApprovalWidget";
import { useAppStore } from "@/lib/store/appStore";
import { identityByRole } from "@/lib/mock/fixtures";
import { useGovernanceService } from "@/lib/services/governanceService";
import { useCurrentIdentity } from "@/lib/hooks/useCurrentIdentity";
import { dataMode } from "@/lib/services/dataMode";

export default function MultisigApprovalsPage() {
  const activeRole = useAppStore((s) => s.activeRole);
  const { did: myDid, address: myAddress } = useCurrentIdentity();
  const meMock = identityByRole[activeRole];
  const me = dataMode === "onchain" ? { did: myDid ?? "" } : meMock;
  const governanceService = useGovernanceService();
  const proposals = governanceService.getProposals().filter((p) => p.status === "queued");

  // The real per-mode actor identifier: an address onchain (multisig co-signing on
  // TimeBoundAccessControl is by msg.sender, not DID — MultisigApprovalWidget's "already signed"
  // check needs this to match), a DID in mock mode. approveProposal's signer argument is ignored
  // by the onchain service today, but this stays the semantically correct value regardless.
  const currentSignerId = dataMode === "onchain" ? (myAddress ?? "") : me.did;

  const [actionError, setActionError] = useState<string | null>(null);

  async function handleApprove(id: string) {
    setActionError(null);
    try {
      await governanceService.approveProposal(id, currentSignerId);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to approve proposal");
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
      <div className="mb-5">
        <h2 className="text-[15px] font-medium text-ink-50">Multisig approval queue</h2>
        <p className="mt-0.5 text-[13px] text-ink-400">
          High-privilege platform actions — adding/removing Admins, contract upgrades, pause/unpause —
          require a 2-of-N Super Admin co-signature before they execute.
        </p>
      </div>

      {actionError && (
        <Card className="mb-4 border-danger-500/25 bg-danger-500/[0.04] text-[13px] text-danger-400">{actionError}</Card>
      )}

      {proposals.length === 0 ? (
        <EmptyState title="Queue is empty" description="No high-privilege actions are currently awaiting co-signature." />
      ) : (
        <div className="flex flex-col gap-4">
          {proposals.map((p) => (
            <MultisigApprovalWidget key={p.id} proposal={p} currentSignerDid={currentSignerId} onApprove={handleApprove} />
          ))}
        </div>
      )}
    </div>
  );
}
