"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ShieldOff, UserPlus } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { ProgressList } from "@/components/ui/ProgressList";
import { Table, TableHead, TableBody, TableRow, TableHeadCell, TableCell } from "@/components/ui/Table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/Dialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/Select";
import { RoleBadge } from "@/components/modules/RoleBadge";
import { useAppStore } from "@/lib/store/appStore";
import { identityByRole, ROLE_LABEL, type Identity, type Role } from "@/lib/mock/fixtures";
import { useRbacService } from "@/lib/services/rbacService";
import { useDidService } from "@/lib/services/didService";
import { useCurrentIdentity } from "@/lib/hooks/useCurrentIdentity";
import { dataMode } from "@/lib/services/dataMode";
import { ROLE, useGrantTimedRole, useProposePrivilegedGrant, useCoSignGrant, usePendingGrants } from "@/lib/hooks/useAccessControl";
import { resolveControllerAddress } from "@/lib/hooks/useDIDRegistry";
import { truncateMiddle } from "@/lib/utils";

const GRANTABLE_ROLES: Role[] = ["SUPER_ADMIN", "ADMIN", "MANAGER", "AUDITOR", "USER"];
const ROLE_HASH_TO_LABEL: Record<string, string> = Object.fromEntries(
  GRANTABLE_ROLES.map((r) => [ROLE[`${r}_ROLE` as keyof typeof ROLE], ROLE_LABEL[r]]),
);
// proposePrivilegedGrant/coSignGrant isn't actually restricted to SUPER_ADMIN_ROLE on-chain — it
// takes any role, and every one of the 5 roles now goes through it from this panel: a deliberate
// choice (not a technical requirement) to make every grant of every role require 2 Super Admin
// signatures, with full visibility for every Super Admin, rather than letting some roles execute
// instantly with just one signature. The real tradeoff this carries: proposePrivilegedGrant/
// coSignGrant is gated onlyRole(SUPER_ADMIN_ROLE) on-chain, so a plain Admin (who isn't also a
// Super Admin) can no longer grant MANAGER_ROLE/USER_ROLE on their own through this panel at all —
// only a Super Admin can propose or co-sign any grant now, for every role.
const PRIVILEGED_GRANT_ROLES = new Set<Role>(["SUPER_ADMIN", "ADMIN", "MANAGER", "AUDITOR", "USER"]);

function defaultExpiryInput(): string {
  const d = new Date(Date.now() + 365 * 24 * 3_600_000);
  d.setSeconds(0, 0);
  return d.toISOString().slice(0, 16);
}

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

  // New-grant panel (T-028's gap: Renew only re-grants a role an identity already holds — there
  // was no in-app way to give a role to an identity that holds none yet, or to change which role
  // an identity holds). SUPER_ADMIN_ROLE has no single role-admin (contracts/TimeBoundAccessControl.sol
  // never assigns it one — it defaults to DEFAULT_ADMIN_ROLE, held only by the original deployer),
  // so it can't go through grantTimedRole like the other four; it uses the same 2-of-N
  // proposePrivilegedGrant/coSignGrant queue this app already uses everywhere else for
  // privileged actions, requiring a second Super Admin's separate coSignGrant call below.
  const [grantTargetDid, setGrantTargetDid] = useState("");
  const [grantRole, setGrantRole] = useState<Role>("USER");
  const [grantExpiry, setGrantExpiry] = useState(defaultExpiryInput);

  const { grantTimedRole: grantTimedRoleOnchain, isPending: isGranting, isSuccess: grantSucceeded, error: grantError } = useGrantTimedRole();
  const { proposePrivilegedGrant, grantId: proposedGrantId, isPending: isProposing, isSuccess: proposeSucceeded, error: proposeError } = useProposePrivilegedGrant();
  const [lastGrantTarget, setLastGrantTarget] = useState<{ role: Role; account: string } | null>(null);
  const { coSignGrant, isPending: isCoSigning, isSuccess: coSignSucceeded, error: coSignError } = useCoSignGrant();
  const { data: pendingGrants, isLoading: isLoadingPendingGrants, refetch: refetchPendingGrants } = usePendingGrants();
  const [coSigningId, setCoSigningId] = useState<string | null>(null);

  // Status is derived entirely from isProposing/isGranting (wallet+confirmation in flight) and
  // proposeSucceeded/grantSucceeded or proposeError/grantError below — never set optimistically
  // here. This used to call setGrantResult("Proposed…") unconditionally right after invoking the
  // write function, before the wallet even prompted, which showed "success" even when the user
  // rejected the signature or the call never reached the chain at all (the actual root cause
  // behind "signed from both Super Admins but nothing happened" — nothing was ever submitted).
  async function handleGrantRole() {
    if (!grantTargetDid) return;
    setActionError(null);
    try {
      const account = await resolveControllerAddress(grantTargetDid as `0x${string}`);
      const validUntil = BigInt(Math.floor(new Date(grantExpiry).getTime() / 1000));
      const roleHash = ROLE[`${grantRole}_ROLE` as keyof typeof ROLE];
      setLastGrantTarget({ role: grantRole, account });
      if (PRIVILEGED_GRANT_ROLES.has(grantRole)) {
        proposePrivilegedGrant({ role: roleHash, account, validUntil });
      } else {
        grantTimedRoleOnchain({ role: roleHash, account, validUntil });
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to grant role");
    }
  }

  useEffect(() => {
    if (proposedGrantId !== undefined || coSignSucceeded) refetchPendingGrants();
  }, [proposedGrantId, coSignSucceeded, refetchPendingGrants]);

  function handleCoSign(idInput: string) {
    if (!idInput) return;
    setActionError(null);
    setCoSigningId(idInput);
    try {
      coSignGrant(BigInt(idInput));
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to co-sign grant");
    }
  }

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

      {canManage && dataMode === "onchain" && (
        <Card className="mb-5">
          <h3 className="mb-1 text-[13px] font-semibold text-ink-50">Grant a role</h3>
          <p className="mb-3 text-[12px] text-ink-500">
            Pick any identity below, choose a role and expiry, and submit. Every role grant
            proposes a 2-of-N action instead of granting immediately — a second Super Admin must
            co-sign it below before it takes effect. Only a Super Admin can propose or co-sign;
            this panel has no direct single-signature path for any role anymore.
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[2fr_1fr_1fr_auto]">
            <div>
              <label className="mb-1.5 block text-[12px] text-ink-500">Target identity</label>
              <Select value={grantTargetDid} onValueChange={setGrantTargetDid}>
                <SelectTrigger>
                  <SelectValue placeholder="Select identity…" />
                </SelectTrigger>
                <SelectContent>
                  {identities.map((i) => (
                    <SelectItem key={i.did} value={i.did}>
                      {truncateMiddle(i.did, 10, 6)} — currently {ROLE_LABEL[i.role]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1.5 block text-[12px] text-ink-500">Role</label>
              <Select value={grantRole} onValueChange={(v: string) => setGrantRole(v as Role)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GRANTABLE_ROLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {ROLE_LABEL[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1.5 block text-[12px] text-ink-500">Expires</label>
              <input
                type="datetime-local"
                value={grantExpiry}
                onChange={(e) => setGrantExpiry(e.target.value)}
                className="w-full rounded-xl border border-graphite-800 bg-graphite-900 px-3 py-2 text-[13px] text-ink-50 focus:border-signal-500 focus:outline-none"
              />
            </div>
            <div className="flex items-end">
              <Button
                onClick={handleGrantRole}
                disabled={!grantTargetDid || isGranting || isProposing}
                className="w-full sm:w-auto"
              >
                <UserPlus size={14} />
                {isGranting || isProposing
                  ? "Confirm in wallet…"
                  : PRIVILEGED_GRANT_ROLES.has(grantRole)
                    ? "Propose"
                    : "Grant"}
              </Button>
            </div>
          </div>
          {(grantError || proposeError) && (
            <p className="mt-2 text-[12px] text-danger-400">
              {(grantError ?? proposeError) instanceof Error ? (grantError ?? proposeError)!.message : "Grant failed."}
            </p>
          )}
          {!grantError && !proposeError && (isGranting || isProposing) && (
            <p className="mt-2 text-[12px] text-ink-400">Waiting for wallet confirmation and mining…</p>
          )}
          {!grantError && grantSucceeded && lastGrantTarget && !PRIVILEGED_GRANT_ROLES.has(lastGrantTarget.role) && (
            <p className="mt-2 text-[12px] text-verified-400">
              Granted {ROLE_LABEL[lastGrantTarget.role]} to{" "}
              <span className="mono-value">{truncateMiddle(lastGrantTarget.account, 10, 6)}</span>.
            </p>
          )}
          {!proposeError && proposeSucceeded && proposedGrantId !== undefined && (
            <p className="mt-2 text-[12px] text-verified-400">
              Proposed — grantId <span className="mono-value">{proposedGrantId.toString()}</span>, needs a second
              Super Admin&apos;s co-sign below to take effect.
            </p>
          )}

          <div className="mt-4 border-t border-graphite-800 pt-3">
            <div className="mb-2 flex items-center justify-between">
              <label className="text-[12px] text-ink-500">Pending grant requests (all Super Admins can co-sign)</label>
              <Button variant="ghost" className="px-2 py-1 text-[11px]" onClick={() => refetchPendingGrants()} disabled={isLoadingPendingGrants}>
                {isLoadingPendingGrants ? "Refreshing…" : "Refresh"}
              </Button>
            </div>
            <p className="mb-2 text-[11px] text-ink-500">
              Any Super Admin sees the same list here — no need for the proposer to share a
              grantId out of band. Needs 2 signatures to execute.
            </p>
            {isLoadingPendingGrants && !pendingGrants && (
              <p className="text-[12px] text-ink-500">Scanning for pending grants…</p>
            )}
            {!isLoadingPendingGrants && pendingGrants?.length === 0 && (
              <p className="text-[12px] text-ink-500">No pending grants right now.</p>
            )}
            <div className="space-y-2">
              {pendingGrants?.map((g) => (
                <div
                  key={g.grantId.toString()}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-graphite-800 bg-graphite-900 px-3 py-2"
                >
                  <div className="text-[12px] text-ink-300">
                    <span className="mono-value text-ink-500">#{g.grantId.toString()}</span>{" "}
                    grant <Badge tone="neutral">{ROLE_HASH_TO_LABEL[g.role] ?? truncateMiddle(g.role, 10, 6)}</Badge> to{" "}
                    <span className="mono-value">{truncateMiddle(g.account, 10, 6)}</span> — {g.signatureCount}/2 signed
                    <span className="block text-[11px] text-ink-600">proposed by {truncateMiddle(g.proposer, 10, 6)}</span>
                  </div>
                  <Button
                    variant="secondary"
                    className="px-2.5 py-1 text-[12px]"
                    onClick={() => handleCoSign(g.grantId.toString())}
                    disabled={isCoSigning}
                  >
                    {isCoSigning && coSigningId === g.grantId.toString() ? "Co-signing…" : "Co-sign"}
                  </Button>
                </div>
              ))}
            </div>
            {coSignError && (
              <p className="mt-2 text-[12px] text-danger-400">
                {coSignError instanceof Error ? coSignError.message : "Co-sign failed."}
              </p>
            )}
            {coSignSucceeded && <p className="mt-2 text-[12px] text-verified-400">Co-signed — grant executed if threshold was met.</p>}
          </div>
        </Card>
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
                      <p className="mono-value text-[11px] text-ink-600">{truncateMiddle(identity.did, 10, 6)}</p>
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
