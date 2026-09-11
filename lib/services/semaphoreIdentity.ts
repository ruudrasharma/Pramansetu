"use client";

/**
 * lib/services/semaphoreIdentity.ts — T-015 (gap analysis §2.1.4): real client-side Semaphore
 * identity management, group reconstruction, and proof generation/verification. Unlike most
 * services in this app, this one is NOT split by dataMode — a Semaphore proof is real
 * cryptography regardless of whether the surrounding page is reading mock or onchain contract
 * data, so mock mode's illustrative card stays untouched and this powers only the real one.
 */

import { Identity } from "@semaphore-protocol/identity";
import { Group } from "@semaphore-protocol/group";
import type { SemaphoreProof } from "@semaphore-protocol/proof";
import { getPublicClient } from "wagmi/actions";
import { wagmiConfig, contractAddresses } from "@/lib/wagmi";
import { SemaphoreRoleGroupsAbi } from "@/lib/abis";

const IDENTITY_STORAGE_PREFIX = "praman-setu:semaphore-identity:";

/**
 * Reads (or generates and persists) this account's Semaphore identity. Same "prototype-grade
 * only, not recoverable if storage is cleared" caveat as didService.ts's own client-side key
 * storage (docs/SECURITY.md) — no rotation path in this pass, see SemaphoreRoleGroups.sol's
 * registerCommitment docstring.
 */
export function getOrCreateIdentity(account: `0x${string}`): Identity {
  const key = `${IDENTITY_STORAGE_PREFIX}${account}`;
  try {
    const stored = localStorage.getItem(key);
    if (stored) return Identity.import(stored);
    const identity = new Identity();
    localStorage.setItem(key, identity.export());
    return identity;
  } catch {
    throw new Error("Could not read or save a local Semaphore identity (storage unavailable).");
  }
}

export function hasLocalIdentity(account: `0x${string}`): boolean {
  try {
    return localStorage.getItem(`${IDENTITY_STORAGE_PREFIX}${account}`) !== null;
  } catch {
    return false;
  }
}

/**
 * Reconstructs a role's Semaphore group from SemaphoreRoleGroups' own MemberSynced/
 * MemberRemovedFromRole event log, replayed in order — the same real state both proof
 * generation (needs a group to prove membership in) and removal (needs Merkle proof siblings)
 * are built on. Real event replay, not a cached/guessed member list.
 */
export async function reconstructGroup(role: `0x${string}`): Promise<Group> {
  const address = contractAddresses.semaphoreRoleGroups;
  if (!address) throw new Error("SemaphoreRoleGroups address not configured");
  const client = getPublicClient(wagmiConfig);
  if (!client) throw new Error("No public RPC client available");

  const [syncedLogs, removedLogs] = await Promise.all([
    client.getLogs({
      address,
      event: {
        type: "event",
        name: "MemberSynced",
        inputs: [
          { name: "role", type: "bytes32", indexed: true },
          { name: "account", type: "address", indexed: true },
          { name: "commitment", type: "uint256", indexed: false },
        ],
      },
      args: { role },
      fromBlock: 0n,
      toBlock: "latest",
    }),
    client.getLogs({
      address,
      event: {
        type: "event",
        name: "MemberRemovedFromRole",
        inputs: [
          { name: "role", type: "bytes32", indexed: true },
          { name: "account", type: "address", indexed: true },
          { name: "commitment", type: "uint256", indexed: false },
        ],
      },
      args: { role },
      fromBlock: 0n,
      toBlock: "latest",
    }),
  ]);

  // Replay in block/log order: an add followed later by a remove for the same commitment nets
  // out to "not currently a member" — reconstructing the group means applying both event types
  // in the order they actually happened on-chain, not just listing every MemberSynced.
  type Ev = { blockNumber: bigint; logIndex: number; kind: "add" | "remove"; commitment: bigint };
  const events: Ev[] = [
    ...syncedLogs.map((l) => ({
      blockNumber: l.blockNumber ?? 0n,
      logIndex: l.logIndex ?? 0,
      kind: "add" as const,
      commitment: (l.args as { commitment?: bigint }).commitment ?? 0n,
    })),
    ...removedLogs.map((l) => ({
      blockNumber: l.blockNumber ?? 0n,
      logIndex: l.logIndex ?? 0,
      kind: "remove" as const,
      commitment: (l.args as { commitment?: bigint }).commitment ?? 0n,
    })),
  ].sort((a, b) => (a.blockNumber === b.blockNumber ? a.logIndex - b.logIndex : Number(a.blockNumber - b.blockNumber)));

  const group = new Group();
  for (const ev of events) {
    if (ev.kind === "add") {
      group.addMember(ev.commitment);
    } else {
      const index = group.indexOf(ev.commitment);
      if (index !== -1) group.removeMember(index);
    }
  }
  return group;
}

/**
 * Generates a real Semaphore proof that `identity` is a member of `group`, scoped to `role` so
 * the proof can't be replayed to claim membership in a different role's group.
 * @semaphore-protocol/proof pulls in snarkjs (large — real circuit/witness handling), so it's
 * dynamically imported here rather than at module load: most visits to this page never click
 * "Prove", and every /identity page load shouldn't pay for snarkjs up front.
 */
export async function proveRole(identity: Identity, group: Group, role: `0x${string}`): Promise<SemaphoreProof> {
  const { generateProof } = await import("@semaphore-protocol/proof");
  return generateProof(identity, group, "praman-setu-role-proof", role);
}

/** Instant, free, no wallet needed — verifies the proof's zero-knowledge validity locally. */
export async function verifyRoleProofLocal(proof: SemaphoreProof): Promise<boolean> {
  const { verifyProof } = await import("@semaphore-protocol/proof");
  return verifyProof(proof);
}

/**
 * generateProof's SemaphoreProof fields (merkleTreeRoot/nullifier/message/scope/points) are
 * decimal NumericStrings, not native bigints -- convert to the tuple shape the on-chain
 * Semaphore.sol ABI (and useVerifyProofOnchain) expects before passing a proof to a contract call.
 */
export function toOnchainProof(proof: SemaphoreProof) {
  return {
    merkleTreeDepth: BigInt(proof.merkleTreeDepth),
    merkleTreeRoot: BigInt(proof.merkleTreeRoot),
    nullifier: BigInt(proof.nullifier),
    message: BigInt(proof.message),
    scope: BigInt(proof.scope),
    points: proof.points.map((p) => BigInt(p)) as [bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint],
  };
}

export type { SemaphoreProof };
export { Identity, Group };
export const SEMAPHORE_ROLE_GROUPS_ABI = SemaphoreRoleGroupsAbi;
