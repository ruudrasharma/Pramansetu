# Testing Strategy — BEL Chain

## 1. Smart Contract Tests (Hardhat + Chai)

| Suite | Coverage |
|---|---|
| `DIDRegistry.test.ts` | create/resolve/rotate DID; reject duplicate registration; only-controller rotation |
| `CredentialRegistry.test.ts` | issue/revoke; `isValid` respects expiry and revocation flag; only `ISSUER_ROLE` can issue |
| `TimeBoundAccessControl.test.ts` | `hasRole` false past expiry; 2-of-3 multisig gate on privileged grants; `emergencyRevoke`; `pause`/`unpause` blocks all state-changing calls |
| `AssetRegistry.test.ts` | dual-attestation mint (reverts with single signer, succeeds with two distinct signers); transfer reverts on invalid/revoked recipient credential; tokenURI returns correct CID |
| `GuardianRecovery.test.ts` | registration bounds (3–5 guardians); M-of-N threshold enforcement; timelock window respected; finalize reverts before threshold met |
| `GovernanceTimelock.test.ts` | queue/execute happy path; dispute freezes execution even after `eta`; only `AUDITOR_ROLE` can dispute |
| Upgrade tests | UUPS upgrade preserves all existing role/asset state; unauthorized upgrade attempt reverts |

**Target coverage:** 100% branch coverage on `TimeBoundAccessControl` and `AssetRegistry` (the two
modules where a missed branch = a security bypass), ≥90% overall.

**Static analysis:** run Slither and Mythril in CI on every PR touching `contracts/`.

## 2. Frontend Unit Tests

- Component-level tests (React Testing Library) for: role-expiry ring calculation, signer-chip fill
  logic, mint-flow stepper state machine, dispute countdown timer.
- Utility tests for: DID truncation/copy helper, CID validation, timestamp formatting.

## 3. Integration Tests

- Full mint flow against a local Hardhat node: upload mock metadata → propose → co-sign → verify
  `AssetMinted` event → verify subgraph (or mock indexer) reflects the new asset.
- Full recovery flow: register guardians → initiate → sign to threshold → wait timelock → finalize →
  verify DID's linked roles/assets survive unchanged.
- Emergency pause flow: trigger pause mid-transaction-queue → verify all pending privileged actions
  revert → unpause → verify queue resumes correctly.

## 4. End-to-End Tests (Playwright)

| Scenario | Steps |
|---|---|
| Onboarding | Connect wallet → create DID → register guardians → receive credential (mocked issuer) → sign challenge to "log in" |
| Mint & view asset | Admin proposes mint → Manager co-signs (second wallet) → asset appears in Assets grid with correct CID |
| Emergency pause UX | Super Admin triggers pause → verify all privileged UI actions show "paused" state, not silent failure |
| Dispute flow | Queue a transfer → Auditor raises dispute → verify Governance screen shows frozen state → Super Admin resolves |

## 5. Security Testing

- Reentrancy fuzz tests on `AssetRegistry.mint` / `safeTransferFrom`.
- Access-control fuzz tests: attempt every privileged function from an unauthorized address/role and
  confirm revert.
- Front-running consideration review for `proposeMint`/`coSignMint` (mitigated by requestId binding to
  a specific proposer+CID pair).
- Manual penetration test pass on the frontend wallet-connect flow before the pilot-hardening phase
  (see SECURITY.md §7 checklist).

## 6. Test Environments

| Environment | Purpose |
|---|---|
| Hardhat local network | Fast unit/integration test loop |
| Ethereum Sepolia testnet | Pre-demo E2E dry run with real gas/latency |
| Staging (Vercel preview + hosted subgraph) | Full-stack E2E before each judged milestone |

## 7. CI Gate

Every PR must pass: `npm run typecheck`, `npm run lint`, `npm run test:contracts` (with coverage
threshold), and the Playwright smoke suite, before merge to `main`. See DEPLOYMENT.md for the pipeline
definition.
