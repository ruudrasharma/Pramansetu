/**
 * lib/hooks/useAccessControl.ts
 *
 * React hooks for TimeBoundAccessControl — time-bound RBAC, multisig role grants,
 * and the 2-of-N platform action queue (emergencyRevoke / pause / unpause).
 */

import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { readContract } from "wagmi/actions";
import { keccak256, toBytes } from "viem";
import { TimeBoundAccessControlAbi } from "@/lib/abis";
import { contractAddresses, wagmiConfig } from "@/lib/wagmi";

const address = contractAddresses.accessControl;

// ── Constants (role hashes — match contracts/TimeBoundAccessControl.sol) ────
// Every non-default role there is declared as `keccak256("<NAME>_ROLE")` (Solidity's
// standard OZ AccessControl pattern) — these must be computed the same way, not derived
// from the ASCII bytes of the name itself, or every hasRole()/roleExpiry() call against
// the real contract silently checks the wrong role.
export const ROLE = {
  SUPER_ADMIN: "0x" + "0".repeat(64) as `0x${string}`, // DEFAULT_ADMIN_ROLE
  SUPER_ADMIN_ROLE: keccak256(toBytes("SUPER_ADMIN_ROLE")),
  ADMIN_ROLE: keccak256(toBytes("ADMIN_ROLE")),
  MANAGER_ROLE: keccak256(toBytes("MANAGER_ROLE")),
  ISSUER_ROLE: keccak256(toBytes("ISSUER_ROLE")),
  AUDITOR_ROLE: keccak256(toBytes("AUDITOR_ROLE")),
  USER_ROLE: keccak256(toBytes("USER_ROLE")),
} as const;

// The 5 non-DEFAULT_ADMIN roles the app's Role union covers, highest privilege first.
const CHECKABLE_ROLES: readonly [string, `0x${string}`][] = [
  ["SUPER_ADMIN", ROLE.SUPER_ADMIN_ROLE],
  ["ADMIN", ROLE.ADMIN_ROLE],
  ["MANAGER", ROLE.MANAGER_ROLE],
  ["AUDITOR", ROLE.AUDITOR_ROLE],
  ["USER", ROLE.USER_ROLE],
];

/**
 * Imperative (non-hook) "which role does this account currently hold" — for write paths that
 * need to know a target's active role at click time (e.g. rbacService.revokeRole doesn't take
 * a role argument; the real proposePlatformAction call needs one). Checks highest-privilege
 * first, since holding multiple roles simultaneously is possible on the real contract even
 * though the mock model assumes one role per identity. Returns undefined, honestly, if the
 * account holds none of the 5 checkable roles — never guesses a default.
 */
export async function findActiveRole(account: `0x${string}`): Promise<{ name: string; hash: `0x${string}` } | undefined> {
  if (!address) throw new Error("AccessControl address not configured");
  for (const [name, hash] of CHECKABLE_ROLES) {
    const held = (await readContract(wagmiConfig, {
      address,
      abi: TimeBoundAccessControlAbi,
      functionName: "hasRole",
      args: [hash, account],
    })) as boolean;
    if (held) return { name, hash };
  }
  return undefined;
}

// ── Read hooks ──────────────────────────────────────────────────────────────

/**
 * Check if an account currently holds a role (false if expired).
 */
export function useHasRole(role: `0x${string}` | undefined, account: `0x${string}` | undefined) {
  return useReadContract({
    address,
    abi: TimeBoundAccessControlAbi,
    functionName: "hasRole",
    args: role && account ? [role, account] : undefined,
    query: { enabled: !!role && !!account && !!address },
  });
}

/**
 * Get the unix timestamp at which an account's role expires.
 * Returns type(uint256).max for permanent grants.
 */
export function useRoleExpiry(role: `0x${string}` | undefined, account: `0x${string}` | undefined) {
  return useReadContract({
    address,
    abi: TimeBoundAccessControlAbi,
    functionName: "roleExpiry",
    args: role && account ? [role, account] : undefined,
    query: { enabled: !!role && !!account && !!address },
  });
}

/**
 * Check if the platform is currently paused.
 */
export function usePlatformPaused() {
  return useReadContract({
    address,
    abi: TimeBoundAccessControlAbi,
    functionName: "paused",
    query: { enabled: !!address },
  });
}

// ── Write hooks ─────────────────────────────────────────────────────────────

/**
 * grantTimedRole — single-signer role grant for lower-privilege roles.
 * High-privilege grants use proposePlatformAction instead.
 */
export function useGrantTimedRole() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  function grantTimedRole({
    role,
    account,
    validUntil,
  }: {
    role: `0x${string}`;
    account: `0x${string}`;
    validUntil: bigint;
  }) {
    if (!address) throw new Error("AccessControl address not configured");
    writeContract({ address, abi: TimeBoundAccessControlAbi, functionName: "grantTimedRole", args: [role, account, validUntil] });
  }

  return { grantTimedRole, hash, isPending: isPending || isConfirming, isSuccess, error };
}

/**
 * proposePlatformAction — first signature in the 2-of-N multisig queue.
 * actionType: 1 = emergencyRevoke, 2 = pause, 3 = unpause
 */
export function useProposePlatformAction() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  function proposePlatformAction({
    actionType,
    role,
    account,
  }: {
    actionType: number;
    role: `0x${string}`;
    account: `0x${string}`;
  }) {
    if (!address) throw new Error("AccessControl address not configured");
    writeContract({
      address,
      abi: TimeBoundAccessControlAbi,
      functionName: "proposePlatformAction",
      args: [actionType, role, account],
    });
  }

  return { proposePlatformAction, hash, isPending: isPending || isConfirming, isSuccess, error };
}

/**
 * coSignPlatformAction — second signature; executes action when threshold met.
 */
export function useCoSignPlatformAction() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  function coSignPlatformAction(actionId: bigint) {
    if (!address) throw new Error("AccessControl address not configured");
    writeContract({ address, abi: TimeBoundAccessControlAbi, functionName: "coSignPlatformAction", args: [actionId] });
  }

  return { coSignPlatformAction, hash, isPending: isPending || isConfirming, isSuccess, error };
}
