import { Card, MonoValue } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { truncateMiddle, formatCountdown } from "@/lib/utils";
import type { Credential } from "@/lib/mock/fixtures";
import { BadgeCheck, XCircle } from "lucide-react";

export function CredentialCard({ credential }: { credential: Credential }) {
  const expired = credential.validUntil < Date.now();
  const status = credential.revoked ? "revoked" : expired ? "expired" : "valid";

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {status === "valid" ? (
            <BadgeCheck size={15} className="text-verified-400" />
          ) : (
            <XCircle size={15} className="text-danger-400" />
          )}
          <p className="text-[13px] font-medium text-ink-50">{credential.role} credential</p>
        </div>
        <Badge tone={status === "valid" ? "verified" : "danger"}>{status}</Badge>
      </div>
      <div className="grid grid-cols-2 gap-3 text-[12px]">
        <div>
          <p className="mb-0.5 text-ink-600">Issuer</p>
          <MonoValue className="text-[12px]">{truncateMiddle(credential.issuerDid, 10, 4)}</MonoValue>
        </div>
        <div>
          <p className="mb-0.5 text-ink-600">VC ID</p>
          <MonoValue className="text-[12px]">{credential.vcId}</MonoValue>
        </div>
        <div>
          <p className="mb-0.5 text-ink-600">Valid until</p>
          <MonoValue className="text-[12px]">{new Date(credential.validUntil).toLocaleDateString()}</MonoValue>
        </div>
        <div>
          <p className="mb-0.5 text-ink-600">Time left</p>
          <MonoValue className="text-[12px]">{formatCountdown(credential.validUntil)}</MonoValue>
        </div>
      </div>
    </Card>
  );
}
