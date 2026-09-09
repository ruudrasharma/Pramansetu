"use client";

import { useState } from "react";
import Link from "next/link";
import { ShieldOff } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Table, TableHead, TableBody, TableRow, TableHeadCell, TableCell } from "@/components/ui/Table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/Dialog";
import { RoleBadge } from "@/components/modules/RoleBadge";
import { useAppStore } from "@/lib/store/appStore";
import { identityByRole, ROLE_LABEL, type Identity } from "@/lib/mock/fixtures";
import { useRbacService } from "@/lib/services/rbacService";

export default function RolesPage() {
  const activeRole = useAppStore((s) => s.activeRole);
  const me = identityByRole[activeRole];
  const rbacService = useRbacService();
  const identities = rbacService.listIdentities();

  const canManage = activeRole === "SUPER_ADMIN" || activeRole === "ADMIN";

  const [revokeTarget, setRevokeTarget] = useState<Identity | null>(null);

  function confirmRevoke() {
    if (!revokeTarget) return;
    rbacService.revokeRole(revokeTarget.did, me.did);
    setRevokeTarget(null);
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-medium text-ink-50">Role matrix</h2>
          <p className="mt-0.5 text-[13px] text-ink-400">
            Access is enforced inside the contract — every grant is time-bound and expires
            automatically. No manual override path exists.
          </p>
        </div>
        {!canManage && (
          <Link href="/roles/request">
            <Button variant="secondary">Request a role</Button>
          </Link>
        )}
      </div>

      <Card className="overflow-hidden p-0">
        <Table>
          <TableHead>
            <TableRow>
              <TableHeadCell>Identity</TableHeadCell>
              <TableHeadCell>Department</TableHeadCell>
              <TableHeadCell>Role</TableHeadCell>
              <TableHeadCell>Expiry</TableHeadCell>
              <TableHeadCell>Credential</TableHeadCell>
              {canManage && <TableHeadCell className="text-right">Actions</TableHeadCell>}
            </TableRow>
          </TableHead>
          <TableBody>
            {identities.map((identity) => (
              <TableRow key={identity.did}>
                <TableCell>
                  <p className="text-ink-100">{identity.name}</p>
                  <p className="mono-value text-[11px] text-ink-600">{identity.did.slice(0, 20)}…</p>
                </TableCell>
                <TableCell className="text-ink-400">{identity.department}</TableCell>
                <TableCell>
                  <Badge tone="neutral">{ROLE_LABEL[identity.role]}</Badge>
                </TableCell>
                <TableCell>
                  <RoleBadge role={identity.role} expiresAt={identity.roleExpiresAt} size="sm" />
                </TableCell>
                <TableCell>
                  <Badge tone={identity.credentialStatus === "verified" ? "verified" : identity.credentialStatus === "pending" ? "alert" : "danger"}>
                    {identity.credentialStatus}
                  </Badge>
                </TableCell>
                {canManage && (
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="secondary"
                        className="px-2.5 py-1 text-[12px]"
                        onClick={() => rbacService.grantTimedRole(identity.did, identity.role, Date.now() + 30 * 24 * 3_600_000, me.did)}
                      >
                        Renew
                      </Button>
                      <Button
                        variant="danger"
                        className="px-2.5 py-1 text-[12px]"
                        onClick={() => setRevokeTarget(identity)}
                        disabled={identity.did === me.did}
                      >
                        <ShieldOff size={12} /> Revoke
                      </Button>
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={!!revokeTarget} onOpenChange={(open) => !open && setRevokeTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-danger-400">Confirm instant emergency revoke</DialogTitle>
            <DialogDescription>
              This immediately revokes <span className="text-ink-200">{revokeTarget?.name}</span>&apos;s{" "}
              {revokeTarget && ROLE_LABEL[revokeTarget.role]} role and marks their credential revoked — no
              cooling-off window. Any transaction already in flight from this identity will fail on
              submission.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRevokeTarget(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={confirmRevoke}>
              Revoke instantly
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
