"use client";

import { MultisigApprovalWidget } from "@/components/modules/MultisigApprovalWidget";
import { EmptyState } from "@/components/ui/Card";
import { useAppStore } from "@/lib/store/appStore";
import { identityByRole } from "@/lib/mock/fixtures";
import { useGovernanceService } from "@/lib/services/governanceService";

export default function MultisigApprovalsPage() {
  const activeRole = useAppStore((s) => s.activeRole);
  const me = identityByRole[activeRole];
  const governanceService = useGovernanceService();
  const proposals = governanceService.getProposals().filter((p) => p.status === "queued");

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
      <div className="mb-5">
        <h2 className="text-[15px] font-medium text-ink-50">Multisig approval queue</h2>
        <p className="mt-0.5 text-[13px] text-ink-400">
          High-privilege platform actions — adding/removing Admins, contract upgrades, pause/unpause —
          require a 2-of-N Super Admin co-signature before they execute.
        </p>
      </div>

      {proposals.length === 0 ? (
        <EmptyState title="Queue is empty" description="No high-privilege actions are currently awaiting co-signature." />
      ) : (
        <div className="flex flex-col gap-4">
          {proposals.map((p) => (
            <MultisigApprovalWidget
              key={p.id}
              proposal={p}
              currentSignerDid={me.did}
              onApprove={(id) => governanceService.approveProposal(id, me.did)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
