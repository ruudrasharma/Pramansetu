# API Specification — Cipherloom

There are two API surfaces: (1) **on-chain write/read calls** made directly against deployed contracts via
a wallet (this is the actual source of truth and the only place state changes), and (2) an **off-chain
read-only REST/GraphQL API** served by the subgraph indexer, used purely to make the UI fast — every
value it returns is independently re-verifiable against raw chain data.

## 1. On-Chain Interface (Contract Calls)

Authentication for all write calls = the caller's connected wallet signature; no API key, no session
token. Every function below reverts if the caller's DID does not hold the required, non-expired role.

### DIDRegistry
| Function | Signature | Access |
|---|---|---|
| Create DID | `createDID(bytes pubKey, string metadataURI) → bytes32 did` | Any address (gated by prior onboarding credential issuance off-chain) |
| Resolve DID | `resolveDID(bytes32 did) view → DIDDocument` | Public read |
| Rotate key | `rotateKey(bytes32 did, bytes newPubKey, string keyType, bytes proof) → void` | Controller only — `proof` checked against `signatureVerifier` if configured |
| Set verifier | `setSignatureVerifier(address verifier)` | Owner — swaps ECDSA → Dilithium without schema change |
| Set recovery | `setGuardianRecoveryContract(address recovery)` | Owner |

### CredentialRegistry
| Function | Signature | Access |
|---|---|---|
| Issue credential | `issueCredential(bytes32 subjectDid, bytes32 issuerDid, bytes32 vcHash, string role, uint256 validUntil) → bytes32 vcId` | `ISSUER_ROLE` |
| Revoke credential | `revokeCredential(bytes32 vcId)` | `ISSUER_ROLE` **or** `DEFAULT_ADMIN_ROLE` (emergency path — Phase 2.2) |
| Check status | `isValid(bytes32 vcId) view → bool` | Public read |

### TimeBoundAccessControl
| Function | Signature | Access |
|---|---|---|
| Grant timed role | `grantTimedRole(bytes32 role, address account, uint256 validUntil)` | Role admin (single sig for low-privilege roles) |
| Propose privileged grant | `proposePrivilegedGrant(bytes32 role, address account, uint256 validUntil) → uint256 grantId` | `SUPER_ADMIN_ROLE` |
| Co-sign privileged grant | `coSignGrant(uint256 grantId)` | Second distinct `SUPER_ADMIN_ROLE` — executes on threshold |
| Check role | `hasRole(bytes32 role, address account) view → bool` | Public read; auto-false past expiry |
| Propose platform action | `proposePlatformAction(uint8 actionType, bytes32 role, address account) → uint256 actionId` | `SUPER_ADMIN_ROLE` — actionType: 1=emergencyRevoke, 2=pause, 3=unpause |
| Co-sign platform action | `coSignPlatformAction(uint256 actionId)` | Second distinct `SUPER_ADMIN_ROLE` — executes on threshold |

> **Breaking change (Phase 2.5+2.6):** `emergencyRevoke()`, `pause()`, and `unpause()` are removed as direct single-signer calls. All destructive platform actions now require 2-of-N SUPER_ADMIN co-signatures via `proposePlatformAction` + `coSignPlatformAction`.

### AssetRegistry
| Function | Signature | Access |
|---|---|---|
| Propose mint | `proposeMint(string cid, bytes32 vcId, address recipient) → uint256 requestId` | `ADMIN_ROLE` — `vcId` is the CredentialRegistry ID authorizing this recipient; stored as `vcIdOf[tokenId]` |
| Co-sign mint | `coSignMint(uint256 requestId) → uint256 tokenId` | `MANAGER_ROLE` or second `ADMIN_ROLE`, distinct from proposer |
| Transfer | `transferFrom(address from, address to, uint256 tokenId)` | Owner; reverts with `RecipientCredentialInvalid` if `vcIdOf[tokenId]` is no longer valid |
| Get metadata | `tokenURI(uint256 tokenId) view → string` | Public read — returns `ipfs://<CID>` |
| Attach legal ref | `attachLegalReference(uint256 tokenId, bytes32 hash)` | Token owner |
| VC lookup | `vcIdOf(uint256 tokenId) view → bytes32` | Public read — returns the VC gating this token's transferability |

### GuardianRecovery
| Function | Signature | Access |
|---|---|---|
| Register guardians | `registerGuardians(bytes32 did, address[] guardians, uint8 threshold)` | **DID controller only** (Phase 2.1 fix — previously unguarded) |
| Initiate recovery | `initiateRecovery(bytes32 did, address newController, bytes newPubKey)` | Any registered guardian |
| Sign recovery | `signRecovery(bytes32 did)` | Registered guardian, once each |
| Finalize | `finalizeRecovery(bytes32 did)` | Anyone, once threshold + 24h timelock satisfied |

### GovernanceTimelock
| Function | Signature | Access |
|---|---|---|
| Queue transaction | `queueTransaction(address target, bytes data, uint256 eta)` | Super Admin multisig |
| Raise dispute | `raiseDispute(uint256 txId, string reason)` | `AUDITOR_ROLE` |
| Execute | `executeTransaction(uint256 txId)` | Anyone, after `eta` and no active dispute |

## 2. Off-Chain Read API (Indexer)

Base URL (prototype): `https://api.thegraph.com/subgraphs/name/bel-chain/idam`
Base URL (production): self-hosted, e.g. `https://indexer.internal.bel.gov.in/graphql`

All endpoints are **read-only, unauthenticated** (data is already public on-chain; the API just makes it
fast to query). No PII beyond what is already on-chain is ever stored here.

### `GET /identities`
Returns paginated `Identity` entities. Query params: `role`, `credentialStatus`, `limit`, `cursor`.

### `GET /identities/:did`
Full identity detail incl. linked credentials, role grants, owned assets.

### `GET /role-grants?expiringBefore=<unix_ts>`
Powers the "expiring in 24h" widget.

### `GET /assets?ownerDid=<did>`
Assets owned by a given identity.

### `GET /governance/queue`
Pending multisig + timelock items, with dispute status.

### `GET /audit?actor=&type=&from=&to=`
Filtered audit event stream (same data backing the Overview ledger and Audit screen table).

### `GET /audit/anomalies`
Risk-scored alerts from the anomaly-detection service (this is the one endpoint whose data is **not**
purely re-derivable from raw chain data — it's a computed layer, clearly labeled as such in the UI per
UI_UX_SPEC §2.6).

### Example Response — `GET /identities/:did`
```json
{
  "did": "did:ethr:0xA11CE...",
  "controller": "0xA11CE...",
  "keyType": "ES256K",
  "createdAt": "2026-01-14T09:12:00Z",
  "credentials": [
    { "vcId": "0x9f2...", "role": "Manager", "validUntil": "2027-01-14T00:00:00Z", "revoked": false }
  ],
  "roleGrants": [
    { "role": "MANAGER_ROLE", "expiresAt": "2027-01-14T00:00:00Z", "status": "active" }
  ],
  "assets": [ { "tokenId": "42", "cid": "bafybei...", "mintedAt": "2026-02-01T00:00:00Z" } ],
  "guardianCount": 4
}
```

## 3. Authentication Model (applies to both surfaces)

There is no username/password and no bearer-token session anywhere in this system. Every write is a
wallet-signed transaction; every UI "login" is a challenge-response signature (see SECURITY.md §2). The
indexer API requires no auth because it exposes nothing that isn't already public on-chain.
