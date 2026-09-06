# Database / State Schema — BEL Chain

This system has **no central relational database of record** — the blockchain itself is the source of
truth (this is the entire point of PS 26125). Two schema layers exist: (1) on-chain contract storage, and
(2) an off-chain indexer schema (subgraph) that mirrors chain events into a queryable read model. The
indexer can be deleted and rebuilt from raw chain data at any time with no data loss — this must remain
true at all times as a system invariant.

## 1. On-Chain Storage (Contract State)

### DIDRegistry
| Field | Type | Notes |
|---|---|---|
| `documents[did]` | `struct DIDDocument { address controller; string keyType; bytes pubKey; string metadataURI; uint256 createdAt; }` | mapping keyed by DID identifier |
| `controllerOf[address]` | `bytes32` (did hash) | reverse lookup |

### CredentialRegistry
| Field | Type | Notes |
|---|---|---|
| `credentialHash[vcId]` | `bytes32` | hash of off-chain VC payload |
| `revoked[vcId]` | `bool` | revocation flag, checked at auth time |
| `issuer[vcId]` | `bytes32` (did) | must hold `ISSUER_ROLE` |

### TimeBoundAccessControl
| Field | Type | Notes |
|---|---|---|
| `roleExpiry[role][account]` | `uint256` (unix ts) | `hasRole()` returns false once `block.timestamp >= this` |
| `_roles[role][account]` | `bool` (OZ AccessControl base) | standard grant flag |
| `pendingGrants[grantId]` | `struct { role; account; validUntil; signatures[]; }` | 2-of-3 multisig staging |

### AssetRegistry (ERC-721 extension)
| Field | Type | Notes |
|---|---|---|
| `tokenMetadataCID[tokenId]` | `string` (IPFS CID) | content-addressed, on-chain reference only |
| `legalReference[tokenId]` | `bytes32` | hash of off-chain signed attestation, optional |
| `pendingMints[requestId]` | `struct { cid; recipientDid; proposer; coSigner; executed; }` | dual-attestation staging |

### GuardianRecovery
| Field | Type | Notes |
|---|---|---|
| `guardiansOf[did]` | `address[]` | 3–5 registered guardian addresses |
| `recoveryThreshold[did]` | `uint8` | M in M-of-N |
| `activeRecovery[did]` | `struct { newPubKey; signatures[]; initiatedAt; timelockEnd; }` | in-progress recovery |

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
