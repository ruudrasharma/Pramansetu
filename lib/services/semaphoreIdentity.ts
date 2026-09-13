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

// SemaphoreRoleGroups' Sepolia deployment block (see deployments/sepolia.json) — starting
// eth_getLogs here instead of block 0 keeps the scan short.
const SEMAPHORE_ROLE_GROUPS_DEPLOY_BLOCK = 11_681_658n;
// Alchemy's free tier rejects eth_getLogs ranges wider than 10 blocks, so range width is capped
// at 9 (fromBlock..fromBlock+9 inclusive = 10 blocks) and results are stitched back together.
const GET_LOGS_MAX_BLOCK_SPAN = 9n;
// Keep this low: the free tier's rate limit is what turns a burst of parallel eth_getLogs calls
// into "Failed to fetch" connection resets, not just the 10-block range cap.
const GET_LOGS_CONCURRENCY = 4;
const GET_LOGS_BATCH_DELAY_MS = 250;
const GET_LOGS_MAX_RETRIES = 4;
const GET_LOGS_RETRY_BASE_DELAY_MS = 400;

// keccak256("MemberSynced(bytes32,address,uint256)") / keccak256("MemberRemovedFromRole(bytes32,address,uint256)")
const MEMBER_SYNCED_TOPIC = "0x2d2ebb812bde7c6deed704c25b440f92c6a67f2e33fb4cc10c402a0994d80a3c" as const;
const MEMBER_REMOVED_TOPIC = "0x49f11a6ba631f126e6c7e7e42c561ed45c5b1e7b0d3979daa3991bfd0f585a3e" as const;

type PublicClient = NonNullable<ReturnType<typeof getPublicClient>>;
type RawLog = { blockNumber: `0x${string}`; logIndex: `0x${string}`; topics: `0x${string}`[]; data: `0x${string}` };
type RoleEvent = { blockNumber: bigint; logIndex: number; kind: "add" | "remove"; commitment: bigint };

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchRoleLogsWithRetry(
  client: PublicClient,
  address: `0x${string}`,
  role: `0x${string}`,
  fromBlock: bigint,
  toBlock: bigint,
  attempt = 0,
): Promise<RawLog[]> {
  try {
    const logs = await client.request({
      method: "eth_getLogs",
      params: [
        {
          address,
          topics: [[MEMBER_SYNCED_TOPIC, MEMBER_REMOVED_TOPIC], role],
          fromBlock: `0x${fromBlock.toString(16)}`,
          toBlock: `0x${toBlock.toString(16)}`,
        },
      ],
    });
    return logs as RawLog[];
  } catch (err) {
    if (attempt >= GET_LOGS_MAX_RETRIES) throw err;
    await sleep(GET_LOGS_RETRY_BASE_DELAY_MS * 2 ** attempt);
    return fetchRoleLogsWithRetry(client, address, role, fromBlock, toBlock, attempt + 1);
  }
}

/** Combines MemberSynced + MemberRemovedFromRole into one filter per window (half the requests) */
async function getRoleGroupEvents(
  client: PublicClient,
  address: `0x${string}`,
  role: `0x${string}`,
  fromBlock: bigint,
  toBlock: bigint,
): Promise<RoleEvent[]> {
  const windows: Array<{ fromBlock: bigint; toBlock: bigint }> = [];
  for (let start = fromBlock; start <= toBlock; start += GET_LOGS_MAX_BLOCK_SPAN + 1n) {
    const end = start + GET_LOGS_MAX_BLOCK_SPAN > toBlock ? toBlock : start + GET_LOGS_MAX_BLOCK_SPAN;
    windows.push({ fromBlock: start, toBlock: end });
  }

  const events: RoleEvent[] = [];
  for (let i = 0; i < windows.length; i += GET_LOGS_CONCURRENCY) {
    const batch = windows.slice(i, i + GET_LOGS_CONCURRENCY);
    const batchLogs = await Promise.all(
      batch.map((w) => fetchRoleLogsWithRetry(client, address, role, w.fromBlock, w.toBlock)),
    );
    for (const logs of batchLogs) {
      for (const log of logs) {
        events.push({
          blockNumber: BigInt(log.blockNumber),
          logIndex: Number(log.logIndex),
          kind: log.topics[0] === MEMBER_SYNCED_TOPIC ? "add" : "remove",
          commitment: BigInt(log.data),
        });
      }
    }
    if (i + GET_LOGS_CONCURRENCY < windows.length) await sleep(GET_LOGS_BATCH_DELAY_MS);
  }
  return events;
}

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

  const latestBlock = await client.getBlockNumber();
  const fromBlock =
    SEMAPHORE_ROLE_GROUPS_DEPLOY_BLOCK < latestBlock ? SEMAPHORE_ROLE_GROUPS_DEPLOY_BLOCK : latestBlock;

  // Replay in block/log order: an add followed later by a remove for the same commitment nets
  // out to "not currently a member" — reconstructing the group means applying both event types
  // in the order they actually happened on-chain, not just listing every MemberSynced.
  const events = (await getRoleGroupEvents(client, address, role, fromBlock, latestBlock)).sort((a, b) =>
    a.blockNumber === b.blockNumber ? a.logIndex - b.logIndex : Number(a.blockNumber - b.blockNumber),
  );

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
