# Product Requirements Document — Praman Setu (PS 26125)

## 1. Problem Statement

BEL currently secures identity, access, and digital-asset ownership through centralized IAM systems and
disconnected records. This creates a single point of failure, exposes the organization to identity theft and
unauthorized access, and leaves asset ownership impossible to verify with cryptographic certainty. BEL requires
a blockchain-based platform that decentralizes identity, enforces access control at the protocol level, and
tracks digital assets with immutable, verifiable provenance.

## 2. Goals

| Goal | Success Metric |
|---|---|
| Eliminate single point of failure in identity | No single server/DB holds a master identity record |
| Remove password-based auth entirely | 100% of authentication is challenge-response key-pair signing |
| Enforce access control automatically | 0 manual override paths in the RBAC contract |
| Make asset ownership independently verifiable | Any third party can verify ownership via public read calls, no API key needed |
| Survive admin-key compromise | System recoverable via multisig + guardian flow without any single actor |
| Be production-credible for a defense PSU | Documented migration path to a permissioned chain satisfying data-localization needs |

## 3. Non-Goals (Explicit Scope Boundaries)

- **Not** claiming full legal enforceability of NFT ownership under current Indian law (Section 2.3.1 of gap
  analysis) — we build the `legalReference` bridge field and stop there until regulation matures.
- **Not** shipping a production-grade ML anomaly-detection pipeline in the hackathon build — Phase 1 ships
  rule-based detection; the full ML pipeline is Phase 3 (see roadmap).
- **Not** claiming "quantum-proof" cryptography today — we ship a crypto-agile interface, not a
  post-quantum signature scheme in the MVP (Section 11 of the solution doc).
- **Not** replacing BEL's physical/HR identity-verification process — DID/VC issuance is bound to it, not a
  replacement for it.

## 4. User Roles

| Role | Who | Core Needs |
|---|---|---|
| **Super Admin** | BEL security leadership (multisig, 3–5 signers) | Deploy/upgrade contracts, emergency pause, approve high-privilege governance actions |
| **Admin** | IT/HR admins | Mint assets, issue credentials, grant time-bound roles |
| **Manager** | Department heads | Co-sign dual-attestation mints, approve allocations |
| **Auditor** | Internal audit / compliance | Read-only access to full trail, raise disputes, no write access |
| **User (Employee)** | Any BEL staff member | Own a DID, hold credentials/assets, request transfers, register recovery guardians |

Full behavior per role is in [USER_FLOWS.md](./USER_FLOWS.md).

## 5. Functional Requirements

### 5.1 Identity (M1)
- FR-1.1: System issues a DID (`did:ethr:0x...`) on verified onboarding; no DID exists without a linked Verifiable Credential from an authorized issuer.
- FR-1.2: Authentication is exclusively challenge-response signature verification — no password field exists anywhere in the schema.
- FR-1.3: Users register 3–5 guardian DIDs; losing a private key triggers an M-of-N guardian-signed recovery inside a time-locked window.
- FR-1.4: Sensitive role-proof actions support zero-knowledge disclosure (prove "I hold role X" without revealing which DID). **Implemented (T-015)** — `SemaphoreRoleGroups.sol`, live on Sepolia, using the official Semaphore V4 protocol deployment. See §5.7.

### 5.2 Access Control (M2)
- FR-2.1: Every role grant carries an expiry timestamp; `hasRole()` returns false automatically once expired — no separate revocation transaction required for expiry.
- FR-2.2: Any 2-of-3 Admin-tier signatures required for minting or role escalation.
- FR-2.3: Any 2 Super Admins can invoke `emergencyPause()`, freezing all state-changing functions in one transaction.
- FR-2.4: RBAC logic lives behind a UUPS upgradeable proxy so bugs are patchable without state loss.

### 5.3 Digital Assets (M3)
- FR-3.1: Every asset is minted as an ERC-721 token; metadata is content-addressed on IPFS (CID on-chain, not a mutable URL).
- FR-3.2: Minting requires dual attestation — an Admin proposes, a Manager (or second Admin) must co-sign before the mint executes.
- FR-3.3: Transfers are blocked unless the recipient DID holds a valid, non-revoked credential.
- FR-3.4: Metadata schema includes an optional `legalReference` hash field for future legal-tech bridging.

### 5.4 Audit & Monitoring (M4)
- FR-4.1: Every state-changing contract call emits a typed event carrying actor DID, target, timestamp, and metadata hash.
- FR-4.2: A subgraph indexes all events into a queryable, re-derivable API — no centralized backend is the source of truth.
- FR-4.3: An anomaly-detection service flags unusual mint velocity, off-hours role escalation, and mass-transfer patterns as risk-scored alerts.

### 5.5 Governance (M5)
- FR-5.1: Super Admin actions (upgrades, add/remove Admin, pause/unpause) require M-of-N multisig.
- FR-5.2: High-value transfers pass through a `TimelockController` with a 24–48h cooling-off window.
- FR-5.3: Any Auditor-role DID can raise a dispute during the cooling-off window, freezing the queued transaction pending Super Admin review.

### 5.6 Oracle Attestation (M6) — **implemented, T-016, gap analysis §2.2.5, live on Sepolia**
- FR-6.1: Any real-world fact about a minted asset (e.g. "this asset was delivered") requires
  2-of-N independent `ORACLE_ATTESTOR_ROLE` attestors to submit and co-sign before it's considered
  attested — distinct from `AssetRegistry`'s mint-time dual attestation, which only guards minting.
- FR-6.2: An attested fact enters a dispute window (demo-scale: 15 minutes) before it finalizes
  and writes into `AssetRegistry` state; any Auditor-role account can freeze it mid-window.
- FR-6.3: A disputed fact is adjudicated by Super Admin multisig — proceed (finalize) or reject
  permanently — mirroring `GovernanceTimelock`'s existing propose/dispute/resolve shape.
- Contract: `OracleAttestation.sol` (`0xE3aa1B2406125731711cdC5897Ee665F551D05f3`), wired into
  `AssetRegistry` via a real in-place UUPS upgrade to both `TimeBoundAccessControl` (introducing
  `ORACLE_ATTESTOR_ROLE`) and `AssetRegistry` itself (introducing `recordOracleFact`).

### 5.7 Zero-Knowledge Proof-of-Role (M7) — **implemented, T-015, gap analysis §2.1.4, live on Sepolia**
- FR-7.1: A user can prove "I hold role X" without revealing which wallet/DID they are, using a
  real Semaphore group per `TimeBoundAccessControl` role.
- FR-7.2: Group membership is kept in sync with live, time-bound role state — not a static
  snapshot — including real on-chain removal once a role is revoked or expires, so a stale proof's
  Merkle root stops verifying once its grace window elapses (not just documented as a gap).
- FR-7.3: Verification is available both instantly off-chain (free, no wallet) and on-chain against
  the official Semaphore contract, with no custom trusted setup or verifier deployed by this project.
- Contract: `SemaphoreRoleGroups.sol` (`0x0fa48402ee578d6579B68da85B9910bFec1e7B47`), bridging into
  the official, audited Semaphore V4 deployment on Sepolia (`0x8A1fd199516489B0Fb7153EB5f075cDAC83c693D`).

## 6. Non-Functional Requirements

| Category | Requirement |
|---|---|
| Security | External audit checklist before any mainnet/production deployment (see SECURITY.md) |
| Performance | UI perceived-load < 150ms for cached reads; on-chain writes show optimistic UI + pending state |
| Scalability | Layer-2 (Polygon rollup) target for organizational transaction volume |
| Compliance | Production deployment target is a permissioned chain to satisfy data-localization norms for a defense PSU |
| Accessibility | WCAG AA across the frontend; full keyboard navigation; command palette (⌘K) as a first-class nav path |
| Availability | Read path never depends on a single centralized server — indexer is self-hostable and re-derivable from raw chain data |

## 7. Problem → Requirement Traceability

Full stated / unstated / future-facing problem mapping lives in Section 10 of `Complete_Solution_Document.pdf`
and is mirrored functionally above (FR-1.x through FR-7.x cover all three tiers).

## 8. Release Plan

See [`TODO.md`](./TODO.md) and Phase table in [`DEPLOYMENT.md`](./DEPLOYMENT.md) — four phases: Hackathon MVP →
Pilot Hardening → Production Migration → Forward-Looking (post-quantum, legal bridge, cross-org interoperability).
