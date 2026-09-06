# Security — BEL Chain

This document is the security section of the submission: authentication, authorization, encryption,
input validation, and the full threat model — stated, unstated, and future-facing (quantum). Source
analysis: `Problem_Gap_Analysis.pdf` §2 and `Complete_Solution_Document.pdf` §11–13.

## 1. Authentication

- **No passwords exist anywhere in the system.** Authentication is exclusively challenge-response
  signature verification: the dApp issues a nonce, the user's wallet signs it with the private key
  controlling their DID, and the contract/backend verifies the signature against the DID Document's
  registered public key.
- Every signature check routes through a single `ISignatureVerifier` interface rather than an inline
  `ecrecover()` call — this is what makes future signature-scheme migration (see §6) possible without
  touching calling contracts.
- Session state on the frontend is wallet-connection state only (wagmi), never a server-issued token.

## 2. Authorization (RBAC)

- Enforced **inside the smart contract**, not application middleware — there is no code path that can
  bypass a role check, unlike a centralized system where a misconfigured API gateway could.
- Every role grant is a `(DID, role, expiry)` triple. `hasRole()` is overridden to require both "role
  granted" AND "not yet expired" — an expired grant fails silently without needing a revocation
  transaction, closing the "instant revocation latency" gap identified in the analysis.
- High-privilege actions (minting, role escalation above User tier) require 2-of-3 Admin-tier multisig —
  a single compromised Admin key cannot unilaterally mint assets or escalate privileges.
- Any 2 Super Admins can call `emergencyPause()`, freezing all state-changing functions across the
  platform in a single transaction while a suspected compromise is investigated.

## 3. Encryption & Data Handling

| Data | At Rest | In Transit |
|---|---|---|
| Private keys | Never leave the user's device/wallet; hardware-backed wallet recommended for production | N/A |
| VC payloads | Held in the user's own wallet; only hash + revocation status on-chain | TLS between wallet and dApp |
| Asset metadata | Content-addressed on IPFS (hash-verified on every fetch) | HTTPS to IPFS gateway |
| On-chain data | Public by design (this is the whole point) — sensitive fields never go on-chain in cleartext | Standard chain P2P encryption |
| Indexer API | No PII beyond what's already public on-chain | HTTPS |

## 4. Input Validation

- All contract functions validate role/expiry/signature preconditions before any state change
  (checks-effects-interactions pattern; reentrancy guards on `AssetRegistry` transfer/mint paths).
- Frontend performs client-side schema validation (Zod) on all form inputs before constructing a
  transaction, but the **contract is the actual enforcement boundary** — the frontend check is UX only,
  never trusted as the security control.
- IPFS CIDs are validated as correctly-formed content hashes before being accepted into `proposeMint`.

## 5. Full Threat Model

### 5.1 Stated in PS 26125
| Threat | Mitigation |
|---|---|
| Centralized IAM single point of failure | DIDs anchored on-chain; no master identity server |
| Identity theft via credential-store breach | No password/credential store exists; challenge-response only |
| Unauthorized access via misconfigured checks | RBAC enforced inside contract logic, no manual override path |
| Disconnected/unverifiable ownership records | Single shared NFT registry, on-chain provenance |

### 5.2 Unstated Architectural Flaws We Identified
| Threat | Mitigation |
|---|---|
| Private key loss = permanent identity lockout | M-of-N guardian social recovery with time-locked window |
| Sybil identity creation | DIDs worthless without an issuer-signed, non-revoked VC |
| DID proves key control, not real identity | VC issuance bound to BEL's existing verified onboarding |
| Permanent public correlation / privacy leakage | Zero-knowledge proof of credential possession (Semaphore) |
| Admin key compromise = full system takeover | 2-of-3 multisig for privileged actions + emergency pause |
| No instant revocation | Time-bound roles with automatic on-chain expiry |
| Irreversible smart contract bugs | UUPS upgradeable proxy + external audit before mainnet |
| Gas cost / scalability at organizational scale | Layer-2 rollup (Polygon) deployment target |
| Oracle / off-chain trust gap | Multi-attestor oracle design + dispute window |
| NFT ownership ≠ legal ownership | `legalReference` bridge field; explicitly flagged as a known limitation |
| Off-chain metadata rot | IPFS content-addressing — tampering changes the hash, detectable instantly |
| Fake physical-asset minting | Mandatory dual attestation (two independent roles) |
| "Who watches the Admin" | Multisig governance + fully auditable governance log |
| No dispute resolution for fraud | Timelock cooling-off window + Auditor veto |
| Regulatory / data-localization blindness | Permissioned consortium chain as the production target |

### 5.3 Future-Facing
| Threat | Mitigation |
|---|---|
| Quantum computers breaking ECDSA ("harvest now, decrypt later") | Crypto-agile `ISignatureVerifier` interface; ready for CRYSTALS-Dilithium/Kyber once mature EVM implementations exist |
| Sophisticated real-time misuse patterns | AI anomaly-detection service on indexed event stream |
| Cross-organization identity portability | Interoperable `did:web` method planned for cross-PSU bridges |
| Compliance proof without data exposure | Zero-knowledge compliance proofs (future roadmap) |

## 6. Quantum-Resistance Design (Detail)

ECDSA — used for every DID key and transaction signature on Ethereum/Polygon — is provably breakable by
Shor's algorithm on a cryptographically-relevant quantum computer. Because on-chain data is public and
permanent, an adversary can record public keys/signatures **today** and break them retroactively once
quantum hardware matures. The exposure window has already started regardless of when the hardware
arrives.

**Our answer is crypto-agility, not a premature quantum-proof claim:**
1. Every signature check routes through `ISignatureVerifier`, never an inline `ecrecover()`.
2. DID Documents store a `keyType` field (`"ES256K"` today) beside the public key.
3. When NIST-standardized post-quantum schemes (CRYSTALS-Dilithium for signatures, CRYSTALS-Kyber for
   key exchange — both finalized 2024) have mature, audited EVM-compatible implementations, a new key
   type can be registered per-DID and the verifier swapped via the governed upgrade path — no identity,
   asset, or role data is lost or needs re-issuing.
4. New DIDs can optionally register a **hybrid key** (classical + post-quantum required together) ahead
   of full migration, for early risk reduction on the highest-privilege Super Admin accounts.

## 7. Pre-Production Security Checklist

- [ ] External smart-contract audit (minimum: Slither + Mythril static analysis, plus manual review)
- [ ] Formal verification of `TimeBoundAccessControl.hasRole()` expiry logic
- [ ] Reentrancy test suite for `AssetRegistry` mint/transfer paths
- [ ] Multisig threshold configuration reviewed and signed off by BEL security leadership
- [ ] Guardian recovery flow tested against a simulated lost-key scenario end-to-end
- [ ] Timelock + dispute flow tested against a simulated social-engineering attack scenario
- [ ] Load test of the indexer under organizational-scale event volume
- [ ] Penetration test of the frontend (wallet-connect flow, CSRF/XSS on any off-chain form)
