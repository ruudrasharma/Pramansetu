# Database / State Schema — Praman Setu

This system has **no central relational database of record** — the blockchain itself is the source of
truth (this is the entire point of PS 26125). Two schema layers exist: (1) on-chain contract storage, and
(2) an off-chain indexer schema (subgraph) that mirrors chain events into a queryable read model. The
indexer can be deleted and rebuilt from raw chain data at any time with no data loss — this must remain
true at all times as a system invariant.

## 1. On-Chain Storage (Contract State)

### DIDRegistry
| Field | Type | Notes |
|---|---|---|
| `_documents[did]` | `struct DIDDocument { address controller; string keyType; bytes pubKey; string metadataURI; uint256 createdAt; bool exists; }` | private mapping keyed by DID hash |
| `didOf[address]` | `bytes32` (did hash) | reverse lookup: controller address → DID (Phase 2.8 fix: was `controllerOf`) |
| `guardianRecoveryContract` | `address` | only this contract may call `forceRotateKey` |
| `signatureVerifier` | `ISignatureVerifier` | pluggable verifier; zero address = skip proof check (Phase 2.4) |

### CredentialRegistry
| Field | Type | Notes |
|---|---|---|
| `credentials[vcId]` | `struct Credential { bytes32 subjectDid; bytes32 issuerDid; bytes32 vcHash; string role; uint256 validUntil; bool revoked; bool exists; }` | mapping keyed by vcId |

> **Note:** Off-chain VC payload is never stored on-chain. `vcHash` is a commitment; `isValid()` checks `exists && !revoked && block.timestamp < validUntil`.

### TimeBoundAccessControl
| Field | Type | Notes |
|---|---|---|
| `roleExpiry[role][account]` | `uint256` (unix ts) | `hasRole()` returns false once `block.timestamp >= this` |
| `_roles[role][account]` | `bool` (OZ AccessControl base) | standard grant flag |
| `pendingGrants[grantId]` | `struct { bytes32 role; address account; uint256 validUntil; address proposer; address[] signers; bool executed; }` | 2-of-N multisig staging for privileged grants |
| `pendingActions[actionId]` | `struct { uint8 actionType; bytes32 role; address account; address proposer; address[] signers; bool executed; }` | 2-of-N staging for emergencyRevoke/pause/unpause (Phase 2.5+2.6) |

### AssetRegistry (ERC-721 extension)
| Field | Type | Notes |
|---|---|---|
| `assetMeta[tokenId]` | `struct AssetMeta { string cid; bytes32 legalReference; uint256 mintedAt; }` | IPFS CID is content-addressed |
| `vcIdOf[tokenId]` | `bytes32` (vcId) | CredentialRegistry ID gating this token's transferability (Phase 2.3) |
| `pendingMints[requestId]` | `struct { string cid; bytes32 recipientDid; address recipient; address proposer; address coSigner; bool executed; }` | dual-attestation staging |

### GuardianRecovery
| Field | Type | Notes |
|---|---|---|
| `guardiansOf[did]` | `address[]` | 3–5 registered guardian addresses; only DID controller may set (Phase 2.1) |
| `recoveryThreshold[did]` | `uint8` | M in M-of-N |
| `activeRecovery[did]` | `struct { address newController; bytes newPubKey; address[] signers; uint256 initiatedAt; bool finalized; }` | in-progress recovery; 24h timelock from `initiatedAt` |

### GovernanceTimelock
| Field | Type | Notes |
|---|---|---|
| `queue[txId]` | `struct QueuedTx { address target; bytes data; uint256 eta; Status status; address raisedBy; string disputeReason; }` | **corrected 2026-09-11 (T-056)** — there is no separate `disputes[txId]` mapping; dispute fields live inside this same struct. `Status` is a 4-value enum (`Queued`, `Executed`, `Disputed`, `Cancelled`), not a boolean `executed` as this table previously said. |

## 2. Off-Chain Indexer Schema (Subgraph / Read Model)

These entities mirror emitted events 1:1 — the indexer never stores anything not derivable from an event.

**2026-09-11 (T-056): synced against the real, buildable `subgraph/schema.graphql` line-by-line** —
the previous version of this section was an idealized sketch that had drifted from the real schema on
nearly every entity (wrong field names, a `GovernanceAction` entity that never existed, no
`MintRequest`/`PendingGrant`/`Recovery`). This block is now copied from the real file rather than
redescribed — **keep both in sync on future changes**, or this drifts again.

```graphql
type Identity @entity {
  id: ID!                          # DID hash (bytes32 as hex string)
  controller: Bytes!               # controlling wallet address
  keyType: String!                 # "ES256K" | "Dilithium3" etc.
  pubKey: Bytes!                   # current public key bytes
  metadataURI: String!             # ipfs:// URI for off-chain metadata
  createdAt: BigInt!               # block timestamp
  updatedAt: BigInt!
  credentials: [Credential!]!      @derivedFrom(field: "subject")
  ownedAssets: [Asset!]!           @derivedFrom(field: "owner")
  roleGrants: [RoleGrant!]!        @derivedFrom(field: "account")
}

type Credential @entity {
  id: ID!                          # vcId (bytes32 as hex)
  subject: Identity!               # → Identity
  issuerDid: Bytes!
  vcHash: Bytes!                   # commitment to off-chain VC payload
  role: String!
  validUntil: BigInt!
  revoked: Boolean!
  revokedAt: BigInt
  revokedBy: Bytes
  issuedAt: BigInt!
  txHash: Bytes!
}

type RoleGrant @entity {
  id: ID!                          # <role>-<account>-<txHash>
  role: Bytes!                     # role hash (bytes32)
  roleLabel: String                # human label if known (ADMIN_ROLE etc.)
  account: Identity                # → Identity (may be null if DID not yet indexed)
  accountAddress: Bytes!
  grantedBy: Bytes!
  validUntil: BigInt!
  revoked: Boolean!
  revokedAt: BigInt
  grantedAt: BigInt!
  txHash: Bytes!
}

type Asset @entity {
  id: ID!                          # tokenId as string
  tokenId: BigInt!
  cid: String!                     # IPFS CID
  owner: Identity                  # → Identity (null if owner address has no DID)
  ownerAddress: Bytes!
  vcId: Bytes!                     # credential gating transferability
  legalReference: Bytes            # optional off-chain doc hash
  proposedBy: Bytes!
  coSignedBy: Bytes!
  mintedAt: BigInt!
  txHash: Bytes!
}

type MintRequest @entity {
  id: ID!                          # requestId as string
  requestId: BigInt!
  cid: String!
  vcId: Bytes!
  recipient: Bytes!
  proposer: Bytes!
  coSigner: Bytes
  executed: Boolean!
  proposedAt: BigInt!
  executedAt: BigInt
}

type PlatformAction @entity {
  id: ID!                          # actionId as string
  actionId: BigInt!
  actionType: Int!                 # 1=emergencyRevoke 2=pause 3=unpause
  role: Bytes!
  account: Bytes!
  proposer: Bytes!
  coSigner: Bytes
  executed: Boolean!
  proposedAt: BigInt!
  executedAt: BigInt
}

# 2-of-N staging for privileged (Super-Admin-tier) role grants, e.g. addAdmin — a distinct
# mapping/threshold from PlatformAction on TimeBoundAccessControl (T-054). Unlike ActionProposed,
# GrantProposed does carry role/account, so both are real here, not left empty.
type PendingGrant @entity {
  id: ID!                          # grantId as string
  grantId: BigInt!
  role: Bytes!
  account: Bytes!
  proposer: Bytes!
  coSigner: Bytes
  executed: Boolean!
  proposedAt: BigInt!
  executedAt: BigInt
}

type GovernanceTx @entity {
  id: ID!                          # txId as string
  txId: BigInt!
  target: Bytes!
  calldata: Bytes!
  eta: BigInt!
  executed: Boolean!
  executedAt: BigInt
  dispute: Dispute                 @derivedFrom(field: "governanceTx")
  queuedAt: BigInt!
  txHash: Bytes!
}

type Dispute @entity {
  id: ID!                          # txId as string
  governanceTx: GovernanceTx!
  raisedBy: Bytes!
  reason: String!
  resolved: Boolean!
  proceeded: Boolean               # set on resolution: true = tx returns to queue, false = cancelled
  resolvedBy: Bytes                # DisputeResolved doesn't carry this param — tx.from is used instead
  resolvedAt: BigInt
  raisedAt: BigInt!
  txHash: Bytes!
}

# GuardianRecovery.sol's activeRecovery(did) auto-generated getter omits the dynamic `signers`
# array entirely (Solidity drops dynamic-array struct members from public-mapping getters) and
# never stores `initiatedBy` at all (only emitted in the event) — T-023/T-039/T-046's flagged gap.
# One entity per did, overwritten on each new RecoveryInitiated — matches the contract's own
# activeRecovery[did] semantics (exactly one active/most-recent recovery per did at a time).
type Recovery @entity {
  id: ID!                          # did (bytes32 as hex string)
  did: Bytes!
  newController: Bytes!
  initiatedBy: Bytes!
  initiatedAt: BigInt!
  signers: [Bytes!]!
  finalized: Boolean!
  finalizedAt: BigInt
  txHash: Bytes!
}

# ── Unified audit log ────────────────────────────────────────────────────────
# Every significant on-chain event lands here, in addition to its typed entity.
# This powers the Overview ledger stream and Audit page table without a join.

type AuditEvent @entity {
  id: ID!                          # <contract>-<txHash>-<logIndex>
  type: String!                    # EventType string matching mock-data.ts union
  actorAddress: Bytes!
  actorDid: Bytes                  # null if actor has no DID
  summary: String!                 # human-readable one-liner
  timestamp: BigInt!
  blockNumber: BigInt!
  txHash: Bytes!
  riskScore: Int                   # null until anomaly service annotates
}
```

## 3. Relationships

```
Identity 1 ── * Credential (as subject)
Identity 1 ── * RoleGrant (as account)
Identity 1 ── * Asset (as owner)
GovernanceTx 1 ── * Dispute (as governanceTx) — at most one real dispute per tx in practice,
                                                 modeled as derived-many since GraphQL doesn't
                                                 express "zero or one" for a @derivedFrom field
PlatformAction, PendingGrant, MintRequest, Recovery — standalone; each also emits a matching
AuditEvent row for the unified ledger stream, but there's no formal foreign key between them
(AuditEvent.id encodes <contract>-<txHash>-<logIndex>, not a reference to the typed entity's id)
```

## 4. Indexes (Indexer-Side, for Query Performance)

- `Identity.controller` — for wallet-address → DID lookup on login
- `RoleGrant.validUntil` — for the "expiring in 24h" system-health widget (there is no `expiresAt`
  field — corrected 2026-09-11, matches the real schema's `RoleGrant.validUntil`)
- `AuditEvent.timestamp` — for the ledger stream and date-range filters
- `Asset.owner` — for the Assets grid per-user filter (there is no `ownerDid` field — corrected
  2026-09-11, matches the real schema's `Asset.owner`)

## 4.1 Off-Chain Application State (the one exception to "no DB", T-036)

`data/dismissed-alerts.json` (server-side, gitignored, written by `lib/server/dismissedAlerts.ts` via
`POST /api/audit/anomalies` — see `docs/API_SPEC.md`) is the platform's only piece of mutable state that
is neither on-chain nor re-derived from the subgraph. It records `{ [anomalyId]: { reason, dismissedAt } }`
— an operator's decision to dismiss a heuristic-detected anomaly alert, nothing more. This is a
deliberate, narrow exception to the "no central database" invariant stated at the top of this doc: an
anomaly *alert* is a computed, non-chain artifact to begin with (see `docs/API_SPEC.md`'s `GET
/audit/anomalies`), so "an operator reviewed and dismissed it" has nowhere else to live. If this were
lost (file deleted, redeployed to a fresh host), previously-dismissed alerts would simply reappear as
open — not a data-integrity risk, since nothing it stores is a source of truth for chain state.

## 5. Constraints Enforced at Contract Level (not DB-level, since there is no DB)

- A DID cannot exist without exactly one controlling key at a time (enforced in `DIDRegistry`).
- **Corrected 2026-09-11 (T-056), previously false**: `TimeBoundAccessControl.grantTimedRole` does
  **not** check for any credential — it only checks `onlyRole(getRoleAdmin(role))` and that
  `validUntil` is in the future (verified directly against the contract source, which has no
  credential-related code path at all in this function). Role grants and credentials are enforced
  independently on this contract; nothing links them at the grant call site.
- An `Asset` cannot be minted without two distinct signer addresses on `pendingMints` — checked in
  `AssetRegistry.coSignMint` (not a function literally named `mint`), which reverts with
  `SameSignerNotAllowed()` if the co-signer address matches the original proposer.
