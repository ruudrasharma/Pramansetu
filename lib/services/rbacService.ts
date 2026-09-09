"use client";

/**
 * lib/services/rbacService.ts — Smart-Contract-Governed RBAC Engine (M2): time-bound,
 * auto-expiring roles + multisig-gated privileged grants + emergency pause.
 */

import { dataMode } from "./dataMode";
import { useMockDataStore } from "@/lib/store/mockDataStore";
import { identities, type Identity, type Role } from "@/lib/mock/fixtures";
import {
  ROLE,
  useGrantTimedRole as useGrantTimedRoleOnchain,
  useProposePlatformAction,
  useCoSignPlatformAction,
  usePlatformPaused as usePlatformPausedOnchain,
  findActiveRole,
} from "@/lib/hooks/useAccessControl";
import { resolveControllerAddress } from "@/lib/hooks/useDIDRegistry";
import { useQuery } from "@tanstack/react-query";
import { getGraphQLClient } from "@/lib/graphql";
import { GET_IDENTITIES } from "@/lib/queries";
import { adaptCredentials, deriveCredentialStatus, deriveRoleFromCredentials, type RawCredential } from "@/lib/services/shared/credentials";

export interface RbacService {
  listIdentities: () => Identity[];
  getRoleExpiry: (did: string) => number | undefined;
  grantTimedRole: (did: string, role: Role, validUntil: number, grantedBy: string) => void;
  revokeRole: (did: string, revokedBy: string) => void;
  requestRole: (did: string, role: Role) => void;
  isPlatformPaused: boolean;
  isPending: boolean;
  isLoadingIdentities: boolean;
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
    isLoadingIdentities: false,
  };
}

interface RawIdentity {
  id: string;
  controller: string;
  keyType: string;
  createdAt: string;
  credentials: RawCredential[];
}

function useOnchainRbacService(): RbacService {
  const { grantTimedRole, isPending: isGranting } = useGrantTimedRoleOnchain();
  const { proposePlatformAction, isPending: isProposing } = useProposePlatformAction();
  const { isPending: isCoSigning } = useCoSignPlatformAction();
  const { data: isPaused } = usePlatformPausedOnchain();

  const identitiesQuery = useQuery({
    queryKey: ["identities"],
    queryFn: async () => {
      const data = await getGraphQLClient().request<{ identities: RawIdentity[] }>(GET_IDENTITIES);
      return data.identities;
    },
  });

  const adaptedIdentities: Identity[] = (identitiesQuery.data ?? []).map((raw) => {
    const credentials = adaptCredentials(raw.id, raw.credentials);
    const chosen = credentials.find((c) => !c.revoked && c.validUntil > Date.now()) ?? credentials[0];
    return {
      did: raw.id,
      controller: raw.controller,
      keyType: raw.keyType as Identity["keyType"],
      // Not populated — would need fetching each identity's metadataURI ipfs:// content, N
      // fetches for a list this size. See didService.ts T-021 for the same tradeoff on a
      // single identity; doing it N times over for a list is out of scope for this pass.
      name: "",
      department: "",
      createdAt: Number(raw.createdAt) * 1000,
      role: deriveRoleFromCredentials(credentials),
      credentialStatus: deriveCredentialStatus(credentials),
      guardianCount: 0,
      roleExpiresAt: chosen?.validUntil ?? 0,
    };
  });

  return {
    listIdentities: () => adaptedIdentities,
    // Dead code path: nothing in the app calls getRoleExpiry directly (checked 2026-09-09) —
    // listIdentities()'s roleExpiresAt field already covers its purpose per-row. Stopgapped
    // per Phase A.3 rather than building unverifiable machinery for zero real callers.
    getRoleExpiry: () => {
      throw new Error("getRoleExpiry is not implemented in onchain mode — see TODO.md T-027; use listIdentities()'s roleExpiresAt field instead.");
    },
    grantTimedRole: async (did, role, validUntil, _grantedBy) => {
      const account = await resolveControllerAddress(did as `0x${string}`);
      grantTimedRole({ role: ROLE[`${role}_ROLE`], account, validUntil: BigInt(Math.floor(validUntil / 1000)) });
    },
    // Single-signer emergencyRevoke was removed in Phase 2 audit fixes — revocation goes
    // through proposePlatformAction(1, role, account) + a second Super Admin's
    // coSignPlatformAction (contracts/TimeBoundAccessControl.sol:156-186). The role being
    // revoked isn't part of this function's own arguments (mock model assumes one role per
    // identity), so it's resolved for real at call time via findActiveRole rather than
    // guessed/hardcoded.
    revokeRole: async (did, _revokedBy) => {
      const account = await resolveControllerAddress(did as `0x${string}`);
      const active = await findActiveRole(account);
      if (!active) throw new Error(`${did} holds no active role to revoke.`);
      proposePlatformAction({ actionType: 1, role: active.hash, account });
    },
    // No on-chain self-service request path exists (checked docs/API_SPEC.md +
    // TimeBoundAccessControl.sol — grantTimedRole/proposePrivilegedGrant are both
    // Admin/Super-Admin-initiated only). Per Rule Zero's second branch: an honest
    // "unavailable" signal, not a fake submitted-request call. See TODO.md T-028.
    requestRole: () => {
      throw new Error("requestRole has no on-chain self-service path — see TODO.md T-028. Contact an Admin directly to request a role grant.");
    },
    isPlatformPaused: !!isPaused,
    isPending: isGranting || isProposing || isCoSigning,
    isLoadingIdentities: identitiesQuery.isLoading,
  };
}

export function useRbacService(): RbacService {
  // See didService.ts's useDidService for why both are called unconditionally.
  const mock = useMockRbacService();
  const onchain = useOnchainRbacService();
  return dataMode === "onchain" ? onchain : mock;
}
