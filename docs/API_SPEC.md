# API Specification — Praman Setu

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
| Resolve dispute | `resolveDispute(uint256 txId, bool proceed)` | `SUPER_ADMIN_ROLE` — `proceed: true` returns the tx to Queued (still needs `executeTransaction` once `eta` passes), `false` cancels it permanently |
| Execute | `executeTransaction(uint256 txId)` | Anyone, after `eta` and no active dispute — **no UI or service caller wires this today, see TODO.md T-053** |

## 2. Off-Chain Read API (Indexer)

Base URL (prototype): `https://api.thegraph.com/subgraphs/name/praman-setu/idam`
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
UI_UX_SPEC §2.6). Returns only real, heuristic-derived results — an empty array (rendered by the UI as
"No anomalies detected.") is a valid, honest response when no anomaly rule fired; this endpoint never
substitutes placeholder/sample alerts to keep the panel populated. Returns `500` with an explicit error
message if `NEXT_PUBLIC_SUBGRAPH_URL` isn't configured, rather than falling back to a hardcoded endpoint.
Each alert carries `status: "open" | "dismissed"` — dismissed status/`dismissReason` come from the
`POST` below, overlaid onto the freshly-recomputed heuristic result on every request (T-036).

### `POST /api/audit/anomalies`
Dismisses an anomaly alert (T-036). Body: `{ "id": string, "reason": string }` — `id` is the
deterministic anomaly id from the `GET` response above (stable across recomputation since it's derived
from the source event id / actor+timestamp, not a random value). Persists to a small server-side JSON
store (`lib/server/dismissedAlerts.ts`, `data/dismissed-alerts.json` — gitignored, not a source of
truth for anything derivable from the chain, just enough state to remember "an operator reviewed this").
Returns `{ "ok": true }` on success, `400` if `id`/`reason` are missing, `500` on a write failure. This
is the one piece of mutable off-chain state in the whole platform that isn't either on-chain or
re-derived from the subgraph — it only ever records "an operator dismissed alert X for reason Y",
never anything that could substitute for real chain state.

### `subscribeToEvents` (service-layer, not a REST endpoint)
`lib/services/auditService.ts`'s `AuditService.subscribeToEvents` is not implemented as a push
subscription in onchain mode — it throws a clear error naming this decision (T-037) rather than
silently no-op-ing. The real "live" mechanism for this project's scope is polling: `GET /audit` events
and `GET /audit/anomalies` both refresh on a `refetchInterval` (5s / 10s respectively) via React Query,
which is a genuinely live-updating read, just not a WebSocket/event-subscription one. There are zero
real callers of `subscribeToEvents` anywhere in the app; if a future feature needs true push delivery,
wire `wagmi`'s `useWatchContractEvent` per relevant contract rather than reusing this method's signature
for polling.

### `POST /api/ipfs/upload`
Server-side-only IPFS pin via Pinata — generic JSON metadata upload, not asset-specific. Body:
any JSON object with at least `name` (asset-mint callers additionally send `description`,
`image?`, `clearanceLevel?`, `properties?`; `didService.createDID` sends `{ name, department }`
for onboarding metadata). Returns `{ cid: "ipfs://<hash>" }` on success. Reads
`PINATA_API_KEY`/`PINATA_SECRET_API_KEY` from the server environment only (never `NEXT_PUBLIC_`-
prefixed, never bundled into client JS); returns `500` with an explicit error if those aren't
configured, or `502` if the Pinata call itself fails. Never returns a mocked/placeholder CID.

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
