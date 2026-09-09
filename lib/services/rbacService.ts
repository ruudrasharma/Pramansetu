"use client";

/**
 * lib/services/rbacService.ts — Smart-Contract-Governed RBAC Engine (M2): time-bound,
 * auto-expiring roles + multisig-gated privileged grants + emergency pause.
 */

import { dataMode } from "./dataMode";
import { useMockDataStore } from "@/lib/store/mockDataStore";
import { identities, type Identity, type Role } from "@/lib/mock/fixtures";
import { ROLE, useGrantTimedRole as useGrantTimedRoleOnchain, useProposePlatformAction, useCoSignPlatformAction, usePlatformPaused as usePlatformPausedOnchain } from "@/lib/hooks/useAccessControl";

export interface RbacService {
  listIdentities: () => Identity[];
  getRoleExpiry: (did: string) => number | undefined;
  grantTimedRole: (did: string, role: Role, validUntil: number, grantedBy: string) => void;
  revokeRole: (did: string, revokedBy: string) => void;
  requestRole: (did: string, role: Role) => void;
  isPlatformPaused: boolean;
  isPending: boolean;
}

function useMockRbacService(): RbacService {
  const store = useMockDataStore();

  return {
    listIdentities: () => store.identities,
    getRoleExpiry: (did) => store.identities.find((i) => i.did === did)?.roleExpiresAt,
    grantTimedRole: store.grantTimedRole,
    revokeRole: store.revokeRole,
    requestRole: (did, role) => {
      const identity = store.identities.find((i) => i.did === did);
      store.logEvent("RoleGranted", did, `${identity?.name ?? did.slice(0, 14) + "…"} requested ${role}_ROLE — pending Admin approval`);
    },
    isPlatformPaused: store.platformPaused,
    isPending: false,
  };
}

function useOnchainRbacService(): RbacService {
  const { grantTimedRole, isPending: isGranting } = useGrantTimedRoleOnchain();
  const { proposePlatformAction, isPending: isProposing } = useProposePlatformAction();
  const { isPending: isCoSigning } = useCoSignPlatformAction();
  const { data: isPaused } = usePlatformPausedOnchain();

  return {
    // TODO(onchain): no "list all identities" view exists on TimeBoundAccessControl —
    // it's a per-(role,account) mapping. Needs a subgraph query over RoleGrant entities
    // (docs/DATABASE_SCHEMA.md) rather than an on-chain enumeration.
    listIdentities: () => identities,
    // TODO(onchain): wire useRoleExpiry(roleHash, account) once the UI resolves a DID's
    // controller address — roleExpiry is keyed by (role, address), not by did.
    getRoleExpiry: () => undefined,
    grantTimedRole: (_did, role, validUntil, _grantedBy) => {
      // TODO(onchain): resolve `did`'s controller address; ROLE[`${role}_ROLE`] must
      // exist in the ROLE map (see lib/hooks/useAccessControl.ts).
      grantTimedRole({ role: ROLE.ADMIN_ROLE, account: "0x0000000000000000000000000000000000000000", validUntil: BigInt(Math.floor(validUntil / 1000)) });
    },
    // TODO(onchain): single-signer emergencyRevoke was removed in Phase 2 audit fixes —
    // revocation now goes through proposePlatformAction(1, role, account) + a second
    // Super Admin's coSignPlatformAction (contracts/TimeBoundAccessControl.sol:156-186).
    revokeRole: (_did, _revokedBy) => proposePlatformAction({ actionType: 1, role: ROLE.ADMIN_ROLE, account: "0x0000000000000000000000000000000000000000" }),
    // TODO(onchain): self-service role requests have no on-chain analog yet — this needs
    // an off-chain request queue (or a dedicated RequestRole contract event) that an
    // Admin's grantTimedRole call then fulfills.
    requestRole: () => {},
    isPlatformPaused: !!isPaused,
    isPending: isGranting || isProposing || isCoSigning,
  };
}

export function useRbacService(): RbacService {
  // See didService.ts's useDidService for why both are called unconditionally.
  const mock = useMockRbacService();
  const onchain = useOnchainRbacService();
  return dataMode === "onchain" ? onchain : mock;
}
