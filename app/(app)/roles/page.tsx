"use client";

import { useState } from "react";
import Link from "next/link";
import { ShieldOff } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { ProgressList } from "@/components/ui/ProgressList";
import { Table, TableHead, TableBody, TableRow, TableHeadCell, TableCell } from "@/components/ui/Table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/Dialog";
import { RoleBadge } from "@/components/modules/RoleBadge";
import { useAppStore } from "@/lib/store/appStore";
import { identityByRole, ROLE_LABEL, type Identity, type Role } from "@/lib/mock/fixtures";
import { useRbacService } from "@/lib/services/rbacService";
import { useDidService } from "@/lib/services/didService";
import { useCurrentIdentity } from "@/lib/hooks/useCurrentIdentity";
import { dataMode } from "@/lib/services/dataMode";

export default function RolesPage() {
  const activeRole = useAppStore((s) => s.activeRole);
  const { did: myDid } = useCurrentIdentity();
  const meMock = identityByRole[activeRole];
  const me = dataMode === "onchain" ? { did: myDid ?? "" } : meMock;
  const didService = useDidService(myDid);
  const myRealIdentity = dataMode === "onchain" ? didService.resolveDID() : undefined;
  const rbacService = useRbacService();
  const identities = rbacService.listIdentities();

  const roleDistribution = (["SUPER_ADMIN", "ADMIN", "MANAGER", "AUDITOR", "USER"] as Role[])
    .map((role) => ({
      label: ROLE_LABEL[role],
      value: identities.length ? (identities.filter((i) => i.role === role).length / identities.length) * 100 : 0,
      tone: role === "SUPER_ADMIN" || role === "ADMIN" ? ("signal" as const) : role === "AUDITOR" ? ("sage" as const) : ("charcoal" as const),
    }))
    .filter((r) => r.value > 0);

  const canManage = dataMode === "onchain" ? myRealIdentity?.role === "SUPER_ADMIN" || myRealIdentity?.role === "ADMIN" : activeRole === "SUPER_ADMIN" || activeRole === "ADMIN";

  const [revokeTarget, setRevokeTarget] = useState<Identity | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function confirmRevoke() {
    if (!revokeTarget) return;
    setActionError(null);
    try {
      await rbacService.revokeRole(revokeTarget.did, me.did);
      setRevokeTarget(null);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to revoke role");
    }
  }

  async function handleRenew(identity: Identity) {
    setActionError(null);
    try {
      await rbacService.grantTimedRole(identity.did, identity.role, Date.now() + 30 * 24 * 3_600_000, me.did);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to renew role");
    }
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

      {actionError && (
        <Card className="mb-4 border-danger-500/25 bg-danger-500/[0.04] text-[13px] text-danger-400">{actionError}</Card>
      )}

      {roleDistribution.length > 0 && (
        <Card className="mb-5">
          <h3 className="mb-3 text-[13px] font-semibold text-ink-50">Role distribution</h3>
          <ProgressList items={roleDistribution} />
        </Card>
      )}

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
            {rbacService.isLoadingIdentities && identities.length === 0 && (
              <TableRow>
                <TableCell colSpan={canManage ? 6 : 5} className="text-center text-ink-500">
                  Loading identities…
                </TableCell>
              </TableRow>
            )}
            {!rbacService.isLoadingIdentities && identities.length === 0 && (
              <TableRow>
                <TableCell colSpan={canManage ? 6 : 5} className="text-center text-ink-500">
                  No identities yet.
                </TableCell>
              </TableRow>
            )}
            {identities.map((identity) => (
              <TableRow key={identity.did}>
                <TableCell>
                  <div className="flex items-center gap-2.5">
                    <Avatar name={identity.name} />
                    <div>
                      <p className="text-ink-100">{identity.name}</p>
                      <p className="mono-value text-[11px] text-ink-600">{identity.did.slice(0, 20)}…</p>
                    </div>
                  </div>
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
                        onClick={() => handleRenew(identity)}
                        disabled={rbacService.isPending}
                      >
                        Renew
                      </Button>
                      <Button
                        variant="danger"
                        className="px-2.5 py-1 text-[12px]"
                        onClick={() => setRevokeTarget(identity)}
                        disabled={identity.did === me.did || rbacService.isPending}
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
