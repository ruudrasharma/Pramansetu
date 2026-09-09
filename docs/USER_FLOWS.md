# User Flows — Praman Setu

## 1. New Employee Onboarding (Identity Creation)
1. HR verifies the employee's real-world identity through BEL's existing internal process.
2. Employee's wallet generates a key pair locally — the private key never leaves the device.
3. Public key + metadata submitted via `DIDRegistry.createDID()` → `DIDCreated` event fires.
4. Employee registers 3–5 guardian DIDs for future key recovery (Identity screen → "Register Guardians").
5. An authorized HR-Issuer DID signs a Verifiable Credential stating role and department; the VC hash +
   revocation-registry entry is pushed on-chain, and the full VC is handed to the employee's wallet.
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

## 5. Lost Private Key Recovery
1. Employee (or their manager, on their behalf) opens Identity → "Recover Identity."
2. Employee's registered guardians are notified (off-chain, e.g. internal comms) to initiate/sign
   recovery.
3. Any guardian calls `initiateRecovery(did, newPubKey)`.
4. Each subsequent registered guardian calls `signRecovery(did)` until the M-of-N threshold is met.
5. After the threshold is met and the recovery time-lock window elapses, anyone can call
   `finalizeRecovery(did)` — the DID's controlling key rotates to the new key; all linked roles/assets
   remain intact.

## 6. Raising and Resolving a Dispute
1. A high-value asset transfer is queued via `GovernanceTimelock.queueTransaction()` and enters its
   24–48h cooling-off window (visible on the Governance screen's Timelock Queue with a live countdown).
2. An Auditor-role DID reviewing the queue notices something wrong and calls
   `raiseDispute(txId, reason)`.
3. The queued transaction freezes; Super Admins are notified and review the dispute.
4. Super Admin multisig either resolves the dispute (transaction proceeds) or cancels the queued
   transaction — either outcome is itself logged as an auditable governance event.

## 7. Proving Role Membership Without Revealing Identity (Zero-Knowledge Flow)
1. A user needs to prove "I hold a valid Auditor credential" to access a sensitive read (e.g. a
   compliance report) without revealing which specific DID/wallet they are.
2. The frontend generates a Semaphore zero-knowledge proof referencing the user's credential membership
   set.
3. The verifying contract/service checks the proof against the on-chain credential-issuance Merkle root
   — access is granted without the verifier ever learning the specific DID.

Each flow above maps directly to functional requirements in [PRD.md](./PRD.md) §5 and to the
threat-mitigation table in [SECURITY.md](./SECURITY.md) §5.
