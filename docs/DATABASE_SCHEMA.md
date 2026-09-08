# Database / State Schema — Cipherloom

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
| `queuedTx[txId]` | `struct { target; data; eta; executed; }` | standard OZ TimelockController pattern |
| `disputes[txId]` | `struct { raisedBy; reason; frozen; resolved; }` | Auditor-triggered freeze |

## 2. Off-Chain Indexer Schema (Subgraph / Read Model)

These entities mirror emitted events 1:1 — the indexer never stores anything not derivable from an event.

```graphql
type Identity @entity {
  id: ID!                  # DID string
  controller: Bytes!
  keyType: String!
  createdAt: BigInt!
  credentials: [Credential!]! @derivedFrom(field: "subject")
  guardianCount: Int!
}

type Credential @entity {
  id: ID!                  # vcId
  subject: Identity!
  issuer: Identity!
  role: String!
  validUntil: BigInt!
  revoked: Boolean!
}

type RoleGrant @entity {
  id: ID!                  # grantId
  did: Identity!
  role: String!
  grantedAt: BigInt!
  expiresAt: BigInt!
  status: String!          # active | expired | revoked
}

type Asset @entity {
  id: ID!                  # tokenId
  cid: String!
  ownerDid: Identity!
  legalReference: Bytes
  mintedAt: BigInt!
  proposer: Identity!
  coSigner: Identity!
}

type GovernanceAction @entity {
  id: ID!                  # txId
  kind: String!            # upgrade | addAdmin | removeAdmin | pause | transfer
  status: String!          # queued | executed | disputed | frozen
  eta: BigInt!
  disputeReason: String
}

type AuditEvent @entity {
  id: ID!                  # tx hash + log index
  actorDid: Identity
  eventType: String!
  targetId: String
  metadataHash: Bytes
  timestamp: BigInt!
  riskScore: Int           # populated by anomaly-detection service, not the chain itself
}
```

## 3. Relationships

```
Identity 1 ── * Credential
Identity 1 ── * RoleGrant
Identity 1 ── * Asset (as ownerDid)
GovernanceAction * ── 1 AuditEvent (governance actions are also audit events)
```

## 4. Indexes (Indexer-Side, for Query Performance)

- `Identity.controller` — for wallet-address → DID lookup on login
- `RoleGrant.expiresAt` — for the "expiring in 24h" system-health widget
- `AuditEvent.timestamp` — for the ledger stream and date-range filters
- `Asset.ownerDid` — for the Assets grid per-user filter

## 5. Constraints Enforced at Contract Level (not DB-level, since there is no DB)

- A DID cannot exist without exactly one controlling key at a time (enforced in `DIDRegistry`).
- A `RoleGrant` cannot be created without a valid non-revoked `Credential` (checked in
  `TimeBoundAccessControl.grantTimedRole`).
- An `Asset` cannot be minted without two distinct signer addresses on `pendingMints` (checked in
  `AssetRegistry.mint`).
