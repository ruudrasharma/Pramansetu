"use client";

import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ProgressList } from "@/components/ui/ProgressList";
import { SignerChips } from "@/components/modules/SignerChips";
import { formatRelativeTime } from "@/lib/utils";
import type { GovernanceProposal } from "@/lib/mock/fixtures";

/** A pending high-privilege action awaiting 2-of-N co-signature — the multisig approval
 * queue's core unit, reused on the Dashboard, Governance console, and approvals page. */
export function MultisigApprovalWidget({
  proposal,
  currentSignerDid,
  onApprove,
}: {
  proposal: GovernanceProposal;
  currentSignerDid?: string;
  onApprove?: (proposalId: string) => void;
}) {
  const signedCount = proposal.signers.filter((s) => s.signed).length;
  const alreadySigned = proposal.signers.some((s) => s.did === currentSignerDid && s.signed);
  const canApprove = proposal.status === "queued" && !alreadySigned && !!currentSignerDid;

  return (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <Badge tone="neutral">{proposal.kind}</Badge>
        <Badge tone={proposal.status === "executed" ? "verified" : "signal"}>{proposal.status}</Badge>
      </div>
      <p className="text-[13px] text-ink-50">{proposal.title}</p>
      <p className="mt-1 text-[12px] text-ink-400">{proposal.description}</p>
      <p className="mt-1 text-[11px] text-ink-600">Proposed {formatRelativeTime(proposal.proposedAt)}</p>

      <ProgressList
        className="mt-3"
        items={[
          {
            label: "Signatures collected",
            value: (signedCount / proposal.requiredSignatures) * 100,
            tone: signedCount >= proposal.requiredSignatures ? "verified" : "signal",
          },
        ]}
      />

      <div className="mt-3 flex items-center justify-between gap-3">
        <SignerChips signers={proposal.signers} required={proposal.requiredSignatures} />
        {onApprove && (
          <Button
            variant="secondary"
            className="shrink-0"
            disabled={!canApprove}
            onClick={() => onApprove(proposal.id)}
          >
            {alreadySigned ? "Signed" : `Co-sign (${signedCount}/${proposal.requiredSignatures})`}
          </Button>
        )}
      </div>
    </Card>
  );
}
