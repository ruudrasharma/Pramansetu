# Features — Praman Setu

Feature-by-feature behavior spec, organized by module. Each feature lists: what it does, the contract
call(s) behind it, the UI surface, and the edge cases it must handle.

## M1 — Decentralized Identity & Credentials

### F1.1 DID Creation
- **Behavior:** Generates a wallet key pair client-side, registers the public key on-chain, links
  metadata URI.
- **Contract:** `DIDRegistry.createDID`
- **UI:** Onboarding wizard (Identity screen, first-run state)
- **Edge cases:** duplicate registration attempt from an already-controlled address (reverts); malformed
  metadata URI (client-side validation blocks submission before the tx is built).

### F1.2 Credential Issuance
- **Behavior:** An `ISSUER_ROLE` holder signs a VC binding a DID to a role/department; hash + revocation
  entry go on-chain, full VC handed to the user's wallet off-chain.
- **Contract:** `CredentialRegistry.issueCredential`
- **UI:** `/identity/issue` — a standalone ISSUER_ROLE-gated route, linked from the Identity screen's
  header (shown only to issuers). This revises the doc's earlier "DID detail panel" description: no DID
  directory/detail-panel view exists yet in this build to hang a panel off of (`/identity` shows only
  the connected wallet's own identity), so a dedicated route is the honest current implementation. Note
  `ISSUER_ROLE` lives on `CredentialRegistry` itself (a separate `AccessControl` instance), not on
  `TimeBoundAccessControl`'s 5-role RBAC hierarchy — see `lib/hooks/useCredentialRegistry.ts`.
- **Edge cases:** issuing a credential to a DID that already holds a non-expired, non-revoked credential
  of the same role — `/identity/issue` now warns (2026-09-11, T-052) but doesn't block; the contract
  allows it. Corrected framing: there's no "most recent governs" mechanism on-chain — each `vcId` is an
  independently keyed `Credential` struct (`keccak256(subjectDid, issuerDid, vcHash, block.timestamp)`),
  so issuing a new one does **not** revoke or supersede the old one; both stay independently valid until
  their own expiry/revocation, and whichever specific `vcId` a consumer (e.g. `AssetRegistry.vcIdOf`)
  references is what actually gets checked. The warning exists purely to help an issuer avoid creating
  redundant duplicate credentials, not because the contract would reject or auto-resolve a conflict.

### F1.3 Guardian Registration & Social Recovery
- **Behavior:** User selects 3–5 guardians and a signature threshold; a lost key is recovered via M-of-N
  guardian co-signature within a 24h time-locked window. Guardians are identified by **wallet address**
  on-chain (`GuardianRecovery.guardiansOf(did)` returns `address[]`, not DIDs) — the registering user
  picks people, but what actually gets stored is their addresses.
- **Contract:** `GuardianRecovery.registerGuardians / initiateRecovery / signRecovery / finalizeRecovery`
- **UI (2026-09-11, T-039):** three real surfaces, not one — `initiateRecovery`/`signRecovery` can only
  ever be called by a *registered guardian's own wallet*, never by the affected person (who by
  definition has lost the device that would let them call anything), so "my own status" and "acting as
  a guardian for someone else" are necessarily different pages:
  - `/identity` — "Register guardians" card (self-service, shown when none exist yet).
  - `/identity/recovery` — view *my own* guardian set and recovery progress; finalize once ready
    (`finalizeRecovery` is genuinely permissionless — the affected person can call it themselves).
  - `/identity/recovery/guardian` — the actual guardian-actor console: look up any DID, initiate
    recovery on its behalf (providing the affected identity's new controller address + public key,
    communicated out-of-band — this app has no mechanism for that hand-off), or sign an in-progress
    one. The contract's own `NotAGuardian()` revert is the real check for whether the connected wallet
    is actually entitled to act, same "frontend is UX only" principle as everywhere else in this app.
  Real signer count / initiator now come from the subgraph's `Recovery` entity
  (`subgraph/src/guardian-recovery.ts`, added this pass — `GuardianRecovery` had no subgraph mapping at
  all before, see TODO.md T-046) since `activeRecovery(did)`'s auto-generated getter can't expose either.
- **Edge cases:** a guardian is later off-boarded (their own DID/role revoked) — UI flags stale guardians
  and prompts re-registration; recovery threshold not met before a guardian withdraws consent (recovery
  simply stalls, no partial state change). **Not yet handled**: no UI flags an off-boarded guardian —
  tracked as a follow-up, not built this pass.

### F1.4 Zero-Knowledge Role Proof — **real, T-015, gap analysis §2.1.4**
- **Status:** Implemented for real. `contracts/SemaphoreRoleGroups.sol` bridges live
  `TimeBoundAccessControl` role state into one Semaphore group per role, using the official,
  audited Semaphore V4 deployment on Sepolia (`0x8A1fd199516489B0Fb7153EB5f075cDAC83c693D`) — no
  custom trusted setup or verifier deployed by this project. The `/identity` page's "Prove role
  without revealing identity" card is real end-to-end: real client-side `Identity` generation
  (`@semaphore-protocol/identity`), real on-chain group membership sync, real Groth16 proof
  generation (`@semaphore-protocol/proof`, circuit artifacts fetched from PSE's official
  `snark-artifacts` repo), and real verification both locally (free, instant) and on-chain
  against the official Semaphore contract. Not split by `dataMode` — a Semaphore proof is real
  cryptography against the real connected wallet regardless of whether the rest of the app is
  showing mock or onchain contract data.
- **Behavior:** Prove role membership without revealing which DID/wallet holds it.
- **Tooling:** `@semaphore-protocol/core`/`identity`/`group`/`proof`/`contracts` v4.14.3.
- **UI:** "Prove role without revealing identity" card on `/identity` — set up identity → register
  commitment → sync group membership → generate + verify proof (local, then optionally on-chain).
- **Edge case, actually handled, not just documented:** a role revoked mid-session no longer lets
  a stale proof verify once its Merkle root ages past Semaphore's default 1-hour root-history
  window — `SemaphoreRoleGroups.removeMemberFromRole` performs the real on-chain removal (computed
  from a real Merkle proof over the reconstructed group), surfaced in the UI as a "Clean up stale
  membership" action the moment a synced role is detected as no longer held.
- **Known limitation:** `registerCommitment` has no rotation path — a lost local identity secret
  (cleared browser storage) means that commitment is stuck unusable for future proofs, same class
  of caveat as `didService.ts`'s own client-side DID key storage.

## M2 — Smart-Contract RBAC Engine

### F2.1 Time-Bound Role Grant
- **Behavior:** Grants a role with an explicit expiry timestamp; `hasRole()` auto-fails past expiry.
- **Contract:** `TimeBoundAccessControl.grantTimedRole`
- **UI:** Access Control screen → role matrix cell → "Grant Role" with validity-window picker
- **Edge cases:** granting a validity window in the past (client + contract both reject); role granted
  right at a multisig threshold boundary — grant only finalizes once the 2nd/3rd signature lands.

### F2.2 Multisig-Gated Privileged Actions
- **Behavior:** High-privilege grants/mints require 2-of-3 Admin-tier signatures before execution.
- **Contract:** staging in `pendingGrants` / `pendingMints`
- **UI:** Live signer-chip row that fills as each signature lands; action button unlocks only at
  threshold
- **Edge cases:** proposer tries to also be the co-signer (contract rejects — must be a distinct signer).

### F2.3 Emergency Pause
- **Behavior:** Any 2 Super Admins freeze all state-changing functions platform-wide in one call.
- **Contract:** `TimeBoundAccessControl.pause` (propagates via shared `PausableUpgradeable` modifier)
- **UI:** Access Control screen → Emergency section, high-contrast control with named-consequence
  confirmation step
- **Edge cases:** a transaction in-flight when pause lands — it simply reverts; UI must clearly surface
  "this failed because the system is paused," not a generic error.

### F2.4 Upgradeable Contract Logic
- **Behavior:** RBAC/DID/Asset contracts sit behind UUPS proxies; logic upgrades preserve state.
- **Contract:** `UUPSUpgradeable._authorizeUpgrade` gated to Super Admin multisig
- **UI:** Governance screen surfaces pending upgrade proposals like any other multisig action
- **Edge cases:** upgrade proposal targeting an incompatible storage layout — caught at the audit-review
  stage (process control, not a runtime check).

## M3 — NFT Asset Registry

### F3.1 Dual-Attestation Minting
- **Behavior:** Two distinct authorized roles must both sign off before a token exists.
- **Contract:** `AssetRegistry.proposeMint / coSignMint`
- **UI:** Assets screen → Mint flow (3-step stepper: Upload → Propose → Co-sign)
- **Edge cases:** IPFS upload succeeds but CID never gets proposed (stale draft — UI TTLs the local draft
  state, not a contract concern since no on-chain record was created).

### F3.2 Credential-Gated Transfer
- **Behavior:** Transfers revert if the recipient DID's credential is invalid or revoked.
- **Contract:** override on `safeTransferFrom`
- **UI:** Transfer form live-checks recipient credential status before enabling "Send"
- **Edge cases:** recipient credential expires between UI check and transaction confirmation — contract
  is the actual enforcement point, so the tx simply reverts; UI surfaces a clear retry path.

### F3.3 Content-Addressed Metadata
- **Behavior:** Metadata pinned to IPFS; CID stored on-chain; any tampering changes the hash.
- **UI:** Asset detail panel shows a "verify integrity" action that re-fetches from IPFS and compares
  hashes live.
- **Edge cases:** IPFS gateway timeout — UI shows a retry-with-alternate-gateway option rather than
  reporting tampering.

### F3.4 Legal Reference Bridge Field
- **Behavior:** Optional hash field referencing an off-chain signed attestation document.
- **UI:** Asset detail panel shows a "Legal Reference" chip only when populated; explicit tooltip stating
  this is not yet a recognized legal title under current Indian law.

## M4 — Immutable Audit Trail & Anomaly Detection

### F4.1 Universal Event Emission
- **Behavior:** Every state-changing call across every module emits a typed event.
- **UI:** Overview screen ledger stream + Audit screen table (same underlying data, two views).

### F4.2 Subgraph Indexing
- **Behavior:** All events indexed into a queryable, independently re-derivable read model.
- **UI:** Powers every list/table in the app; a visible "verified against chain" indicator distinguishes
  indexed data from the one computed layer (anomaly scores).

### F4.3 Anomaly Detection Alerts
- **Behavior:** Rule-based (prototype) checks for mint velocity, off-hours role escalation, mass-transfer
  patterns; risk-scored alerts.
- **UI:** Audit screen → Anomaly Alerts panel, each alert shows the specific rule that fired, never a
  bare score.
- **Edge cases:** legitimate bulk operation (e.g. quarterly batch onboarding) trips a velocity rule —
  Admins can annotate/dismiss an alert with a reason, itself logged as an audit event.

## M5 — Multi-Sig Governance & Dispute Resolution

### F5.1 Multisig Queue
- **Behavior:** Super Admin actions (upgrades, add/remove Admin, pause/unpause) staged for M-of-N
  approval.
- **UI:** Governance screen, Multisig Queue lane.

### F5.2 Timelock Cooling-Off + Dispute Veto
- **Behavior:** High-value transfers queue with a 24–48h delay; any Auditor can freeze via
  `raiseDispute`.
- **UI:** Governance screen, Timelock Queue lane with live countdown and dispute action.
- **Edge cases:** dispute raised after the timelock has already elapsed but before execution — contract
  must still honor the freeze (execution checks dispute status, not just elapsed time).

### F5.3 Governance Self-Audit
- **Behavior:** All governance actions, including disputes and their resolutions, are themselves logged
  through M4's event system.
- **UI:** Governance actions appear in the same Audit screen table as every other event — no separate,
  less-visible governance log.
