# User Flows — Praman Setu

## 1. New Employee Onboarding (Identity Creation)
1. HR verifies the employee's real-world identity through BEL's existing internal process.
2. Employee's wallet generates a key pair locally — the private key never leaves the device.
3. Public key + metadata submitted via `DIDRegistry.createDID()` → `DIDCreated` event fires.
4. Employee registers 3–5 guardians' wallet addresses for future key recovery (Identity screen →
   "Register guardians", `/identity` — `GuardianRecovery.guardiansOf` stores addresses, not DIDs).
5. An authorized HR-Issuer DID signs a Verifiable Credential stating role and department (Identity
   screen → "Issue credential", `/identity/issue` — ISSUER_ROLE-gated); the VC hash + revocation-
   registry entry is pushed on-chain, and the full VC is handed to the employee's wallet.
6. Employee can now authenticate anywhere in the system by signing a challenge — no password is ever
   created, so none exists to steal.

## 2. Minting and Allocating a Digital Asset
1. Admin uploads asset metadata + documents to IPFS, receives a CID.
2. Admin calls `proposeMint(CID, recipientDID)` — creates a pending mint request (no token yet).
3. A second authorized role (Manager) reviews and calls `coSignMint(requestId)` — dual attestation
   satisfied.
4. `AssetRegistry.mint()` executes automatically once both signatures are present, emitting
   `AssetMinted`; the NFT appears in the recipient's wallet, permanently linked to their DID.
5. The event is indexed by the subgraph and immediately visible on the Auditor Dashboard.

## 3. Role Revocation (Employee Termination)
1. HR/Admin calls `revokeRole(role, employeeDID)` — role removed instantly, no waiting on expiry.
2. In parallel, `roleExpiry` is set to `block.timestamp`, so even a queued/pending transaction from that
   DID fails the `hasRole()` check on its next execution.
3. `CredentialRegistry` marks the associated VC as revoked; any zero-knowledge proof referencing that
   credential fails verification from this point forward.
4. `RoleExpired` / `CredentialRevoked` events fire, visible instantly on the audit trail.

## 4. Detecting and Freezing a Compromised Admin Key
1. Anomaly Detection service flags unusual behavior (e.g. rapid sequential role grants at 3 AM) from an
   Admin DID.
2. Alert surfaces to Auditor + remaining Super Admins (Audit screen → Anomaly Alerts panel).
3. Any 2 Super Admins call `emergencyPause()` — all state-changing functions revert platform-wide within
   a single transaction.
4. Investigation proceeds off-chain; once resolved, the compromised DID's key is rotated via the
   guardian-recovery flow and the contract is unpaused by a fresh multisig vote.

## 5. Lost Private Key Recovery (2026-09-11, T-039: real UI, not just the contract flow)
1. Employee generates a fresh keypair on a new device (same client-side technique `createDID` uses) and
   shares the resulting address + public key with their guardians **out-of-band** (phone, internal
   comms) — this app has no mechanism for that hand-off itself, same as any real social-recovery scheme.
2. Employee (or whoever's helping) opens Identity → "Guardian recovery" (`/identity/recovery`) to view
   status — this is a *view*, not an action page: `initiateRecovery`/`signRecovery` can only be called
   by a registered guardian's own wallet, never by the affected employee themselves.
3. A guardian opens "Act as a guardian" (`/identity/recovery/guardian`), looks up the employee's DID, and
   calls `initiateRecovery(did, newController, newPubKey)` with the address/pubkey from step 1.
4. Each subsequent registered guardian visits the same console and calls `signRecovery(did)` until the
   M-of-N threshold is met — real signer count comes from the subgraph's `Recovery` entity.
5. After the threshold is met and the 24h recovery time-lock window elapses, anyone (including the
   employee, back on `/identity/recovery`) can call `finalizeRecovery(did)` — the DID's controlling key
   rotates to the new key; all linked roles/assets remain intact.

## 6. Raising and Resolving a Dispute
1. A high-value asset transfer is queued via `GovernanceTimelock.queueTransaction()` and enters its
   24–48h cooling-off window (visible on the Governance screen's Timelock Queue with a live countdown).
2. An Auditor-role DID reviewing the queue notices something wrong and calls
   `raiseDispute(txId, reason)`.
3. The queued transaction freezes; Super Admins are notified and review the dispute.
4. Super Admin multisig either resolves the dispute (transaction proceeds) or cancels the queued
   transaction — either outcome is itself logged as an auditable governance event.

## 7. Proving Role Membership Without Revealing Identity (Zero-Knowledge Flow) — **real, T-015, live on Sepolia**
1. On `/identity`, a user with a real connected wallet clicks "Set up anonymous proof" — a
   Semaphore `Identity` (a real EdDSA keypair) is generated client-side and stored locally, the
   same convention as this app's existing DID key storage (`docs/SECURITY.md` — prototype-grade,
   not recoverable if cleared).
2. The user registers their identity's commitment on-chain via `SemaphoreRoleGroups.registerCommitment`
   — one real transaction, one time.
3. If the wallet currently holds a role (checked live against `TimeBoundAccessControl.hasRole()`,
   not cached), the user syncs into that role's Semaphore group via `syncMember` — permissionless,
   self-correcting, real `addMember` call on the official Semaphore contract.
4. Clicking "Prove [role] anonymously" reconstructs the group from real on-chain events, generates
   a real Groth16 proof client-side (`@semaphore-protocol/proof`, circuit artifacts fetched from
   the Semaphore project's own `snark-artifacts` repo), and verifies it instantly off-chain — with
   an optional "verify on-chain" call against the same official Semaphore contract for genuine
   on-chain settlement.
5. If the role is later revoked or expires, `/identity` surfaces a "Clean up stale membership"
   action — `removeMemberFromRole` performs a real on-chain Merkle-tree removal (computed from the
   reconstructed group), so a proof against the old root stops verifying once its ~1-hour grace
   window elapses. This is what makes step 4's "live root, not cached" property actually true.

## 8. Attesting a Real-World Fact About an Asset (Oracle Attestation) — **real, T-016, live on Sepolia**
1. An `ORACLE_ATTESTOR_ROLE` account (e.g. a field inspector confirming physical delivery) calls
   `OracleAttestation.submitFact(tokenId, factType, dataHash)` for a minted asset — auto-signs as
   the first of two required independent attestors.
2. A second, distinct `ORACLE_ATTESTOR_ROLE` account calls `attestFact(factId)`. Once 2-of-N
   attestors agree, the fact enters a dispute window (demo-scale: 15 minutes) rather than
   finalizing immediately.
3. Any Auditor-role account reviewing `/oracle/facts` (or the asset's own "Oracle facts" card) can
   freeze the fact mid-window via `raiseDispute(factId, reason)` if something looks wrong.
4. If undisputed, anyone can permissionlessly call `finalize(factId)` once the window elapses —
   the fact writes real state into `AssetRegistry` (`recordOracleFact`), finally making the
   frontend's `"disputed"` asset status a real, live-derived value instead of a permanent gap.
5. If disputed, Super Admin multisig adjudicates via `resolveDispute(factId, proceed)` — proceed
   finalizes immediately, reject permanently discards the fact.

Each flow above maps directly to functional requirements in [PRD.md](./PRD.md) §5 and to the
threat-mitigation table in [SECURITY.md](./SECURITY.md) §5.
