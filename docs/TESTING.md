# Testing Strategy — Praman Setu

## 1. Smart Contract Tests (Hardhat + Chai)

| Suite | Coverage |
|---|---|
| `DIDRegistry.test.ts` | create/resolve/rotate DID; reject duplicate registration; only-controller rotation |
| `CredentialRegistry.test.ts` | issue/revoke; `isValid` respects expiry and revocation flag; only `ISSUER_ROLE` can issue |
| `TimeBoundAccessControl.test.ts` | `hasRole` false past expiry; 2-of-3 multisig gate on privileged grants; `emergencyRevoke`; `pause`/`unpause` blocks all state-changing calls |
| `AssetRegistry.test.ts` | dual-attestation mint (reverts with single signer, succeeds with two distinct signers); transfer reverts on invalid/revoked recipient credential; tokenURI returns correct CID |
| `GuardianRecovery.test.ts` | registration bounds (3–5 guardians); M-of-N threshold enforcement; timelock window respected; finalize reverts before threshold met |
| `GovernanceTimelock.test.ts` | queue/execute happy path; dispute freezes execution even after `eta`; only `AUDITOR_ROLE` can dispute |
| `OracleAttestation.test.ts` (T-016) | 2-of-N attestor threshold; dispute window role-gating and expiry; Super Admin dispute resolution (both branches); permissionless finalize before/after the window; end-to-end fact recorded on `AssetRegistry`; `recordOracleFact` gated to only the wired `OracleAttestation` address |
| `SemaphoreRoleGroups.test.ts` (T-015) | Against a **real locally-deployed Semaphore instance** (not a mock) — commitment registration idempotency; `syncMember`'s live-`hasRole()` reconciliation; `removeMemberFromRole`'s real Merkle-proof-based removal; genuine end-to-end proof generation → local verify → on-chain verify → revoke → remove → stale-root-rejected cycle (`docs/FEATURES.md` F1.4's edge case, actually exercised) |
| Upgrade tests | UUPS upgrade preserves all existing role/asset state; unauthorized upgrade attempt reverts; `ORACLE_ATTESTOR_ROLE`'s `reinitializer(2)`-based introduction (T-016) — role-admin set atomically with the upgrade, double-init reverts, atomic failure if the caller isn't authorized even once the implementation itself is |

**Target coverage:** 100% branch coverage on `TimeBoundAccessControl` and `AssetRegistry` (the two
modules where a missed branch = a security bypass), ≥90% overall. 139 tests passing as of T-015/T-016.

**Static analysis:** run Slither and Mythril in CI on every PR touching `contracts/`.

## 2. Frontend Unit Tests

**Runner:** [Vitest](https://vitest.dev) (`npm run test` / `npm run test:watch`), config in
`vitest.config.mts`. Chosen 2026-09-11 (T-049) as the ESM-native standard for a Next.js 14 App Router +
TypeScript stack — no separate transform config needed, shares the Vite resolver/alias setup with the
rest of the toolchain. Test files live next to the code they cover (`*.test.ts`/`*.test.tsx`), not in a
separate `__tests__/` tree.

- Utility tests for: DID truncation/copy helper, CID validation, timestamp formatting — `lib/utils.test.ts`.
- API-route tests for every route under `app/api/`, per `AI_DEVELOPMENT_RULES.md` §5 (happy path +
  failure case) — `app/api/audit/anomalies/route.test.ts` covers both `GET` (subgraph-config-missing
  failure, subgraph-request failure, and a happy path with `graphql-request` mocked) and `POST`.
- Anomaly-detection heuristics (velocity check, emergency-pause detection) are pure functions in
  `lib/server/anomalyDetection.ts`, unit-tested directly in `lib/server/anomalyDetection.test.ts`
  rather than only indirectly through the route — the route handler has no branching logic of its own
  left to hide a heuristic bug in.
- Component-level tests (React Testing Library, not yet added — install alongside the first component
  test) for: role-expiry ring calculation, signer-chip fill logic, mint-flow stepper state machine,
  dispute countdown timer.

## 3. Integration Tests

- Full mint flow against a local Hardhat node: upload mock metadata → propose → co-sign → verify
  `AssetMinted` event → verify subgraph (or mock indexer) reflects the new asset.
- Full recovery flow: register guardians → initiate → sign to threshold → wait timelock → finalize →
  verify DID's linked roles/assets survive unchanged.
- Emergency pause flow: trigger pause mid-transaction-queue → verify all pending privileged actions
  revert → unpause → verify queue resumes correctly.
- **Fork rehearsal (established T-016/T-015)**: before any transaction sequence touches live
  Sepolia state — especially an in-place contract upgrade — replay the exact sequence against a
  `HARDHAT_FORK_URL`-forked copy of real Sepolia state, impersonating the real signer addresses
  (`hardhat_impersonateAccount`, no private keys needed). See `scripts/forkRehearsal_*.ts` for the
  established pattern; delete/keep as a reusable tool per the task, but always rehearse first.

## 4. End-to-End Tests (Playwright)

| Scenario | Steps |
|---|---|
| Onboarding | Connect wallet → create DID → register guardians → receive credential (mocked issuer) → sign challenge to "log in" |
| Mint & view asset | Admin proposes mint → Manager co-signs (second wallet) → asset appears in Assets grid with correct CID |
| Emergency pause UX | Super Admin triggers pause → verify all privileged UI actions show "paused" state, not silent failure |
| Dispute flow | Queue a transfer → Auditor raises dispute → verify Governance screen shows frozen state → Super Admin resolves |
| Oracle attestation (T-016) | Attestor submits a fact → second attestor co-signs → Auditor disputes mid-window → Super Admin resolves → asset's real `"disputed"` status reflects live |
| ZK proof-of-role (T-015) | Set up anonymous identity → register commitment → sync into role group → generate + verify proof (local, then on-chain) → revoke role → clean up stale membership |

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

Every PR must pass: `npm run typecheck`, `npm run lint`, `npm run test` (Vitest — frontend/API-route
unit tests), `npm run test:contracts` (with coverage threshold), and the Playwright smoke suite, before
merge to `main`. See DEPLOYMENT.md for the pipeline definition.
