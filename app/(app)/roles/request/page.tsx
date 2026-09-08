"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/Select";
import { useAppStore } from "@/lib/store/appStore";
import { identityByRole, ROLE_LABEL, type Role } from "@/lib/mock/fixtures";
import { useRbacService } from "@/lib/services/rbacService";
import { useAuditService } from "@/lib/services/auditService";
import { formatRelativeTime } from "@/lib/utils";

const requestableRoles: Role[] = ["MANAGER", "AUDITOR", "ADMIN"];

export default function RoleRequestPage() {
  const activeRole = useAppStore((s) => s.activeRole);
  const me = identityByRole[activeRole];
  const rbacService = useRbacService();
  const auditService = useAuditService();
  const [desiredRole, setDesiredRole] = useState<Role>("MANAGER");
  const [submitted, setSubmitted] = useState(false);

  const myRequests = auditService.getEvents().filter((e) => e.actorDid === me.did && e.summary.includes("requested"));

  function submit() {
    rbacService.requestRole(me.did, desiredRole);
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 2500);
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
      <div className="mb-5">
        <h2 className="text-[15px] font-medium text-ink-50">Request a role</h2>
        <p className="mt-0.5 text-[13px] text-ink-400">
          Self-service requests still route through an Admin&apos;s <span className="mono-value">grantTimedRole</span> —
          nothing here grants access on its own.
        </p>
      </div>

      <Card className="mb-5">
        <div className="mb-4 flex items-center justify-between text-[13px]">
          <span className="text-ink-400">Current role</span>
          <Badge tone="neutral">{ROLE_LABEL[activeRole]}</Badge>
        </div>

        <label className="mb-1.5 block text-[12px] text-ink-500">Requested role</label>
        <Select value={desiredRole} onValueChange={(v) => setDesiredRole(v as Role)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {requestableRoles.map((r) => (
              <SelectItem key={r} value={r}>
                {ROLE_LABEL[r]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button className="mt-4 w-full" onClick={submit}>
          <Send size={14} />
          Submit request
        </Button>
        {submitted && <p className="mt-2 text-center text-[12px] text-verified-400">Request submitted — pending Admin approval.</p>}
      </Card>

      <Card>
        <h3 className="mb-3 text-[13px] font-medium text-ink-50">Your request history</h3>
        {myRequests.length === 0 ? (
          <p className="text-[12px] text-ink-600">No requests yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {myRequests.map((e) => (
              <div key={e.id} className="flex items-center justify-between text-[13px]">
                <span className="truncate text-ink-200">{e.summary}</span>
                <span className="mono-value shrink-0 text-[11px] text-ink-600">{formatRelativeTime(e.timestamp)}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
