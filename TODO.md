# TODO — Cipherloom (SIH 2026, PS 26125)

This file tracks outstanding work ordered by priority.
Completed items are moved to CHANGELOG.md.

---

## 🔴 High Priority — T-021–T-037: Phase 10 onchain-mode stubs

Catalogued 2026-09-09 during the post-Phase-10 audit (see `CHANGELOG.md`'s "Corrected" note under
Phase 10). `NEXT_PUBLIC_DATA_MODE` defaults to `mock` precisely because these aren't done yet — per
`AI_DEVELOPMENT_RULES.md` Rule Zero, the default does not flip to `onchain` until every item below
is either genuinely wired or explicitly gated to fail loudly instead of silently faking success.

### `lib/services/didService.ts`
- **T-021** `resolveDID` — always returns `undefined` in onchain mode. Needs `useDIDOf(controllerAddress)`
  → bytes32 did → `useResolveDID(did)`, then adapt the on-chain `DIDDocument` shape to the UI's
  `Identity` type (`docs/API_SPEC.md` §1).
- **T-022** `listCredentials` — always returns `[]`. `CredentialRegistry` has no list-by-subject view;
  needs a subgraph query over `Credential` entities filtered by `subject`.
- **T-023** `getGuardians` — always returns `undefined`. No `Guardian`/`GuardianSet` entity exists in
  `subgraph/schema.graphql` (checked directly against the current schema) — needs
  `recoveryThreshold(did)` + iterated `guardiansOf(did, index)` contract reads, not a subgraph query.
- **T-024** `createDID` — **higher severity than a stub**: submits a real `createDID` transaction with a
  hardcoded fake `pubKey: "0x00"`. Every DID created in onchain mode today is permanently registered
  with garbage key material. Needs a real client-side-generated keypair as part of the onboarding flow
  before this ships.
- **T-025** `initiateRecovery` — same severity as T-024: submits a real `initiateRecovery` transaction
  with hardcoded `newController: 0x0…0` / `newPubKey: "0x00"`, regardless of what the caller intended.
  Needs the real recovery-target arguments wired from the UI form.

### `lib/services/rbacService.ts`
- **T-026** `grantTimedRole` / `revokeRole` — both target a hardcoded zero address. Needs the target
  DID resolved to its controller address (same path as T-021) before either call.
- **T-027** `getRoleExpiry` — always returns `undefined`. Needs `useRoleExpiry(roleHash, account)` once
  the caller's controller address is resolved.
- **T-028** `requestRole` — no-op. `TimeBoundAccessControl` has no self-service request path on-chain;
  per Rule Zero's second branch this may end up as an honest "no on-chain self-service path — contact
  an Admin" UI state rather than a fake call (Phase B.2 decision, not yet made).

### `lib/services/assetService.ts`
- **T-029** `proposeMint` — submits a zero recipient/vcId when either is unresolved. Needs both
  resolved for real before the transaction is built.
- **T-030** `transferAsset` — no-op. Needs the real ERC-721 `transferFrom`/`safeTransferFrom` call
  wired, plus the missing hook in `lib/hooks/useAssetRegistry.ts`.
- **T-031** `listAssets` / `getAsset` / `getProvenance` — all three return the imported mock fixture
  array/lookup even in onchain mode. Needs subgraph queries over `Asset` entities, and the indexed
  `AssetMinted`/`AssetTransferred` stream for provenance (`docs/API_SPEC.md`'s
  `GET /audit?type=AssetTransferred`).

### `lib/services/governanceService.ts`
- **T-032** `getProposals` / `getDisputes` — both return mock fixture arrays. Needs subgraph queries
  over `GovernanceTx`/`PlatformAction` entities.
- **T-033** `proposeAction` — hardcodes zero role/account, and maps `addAdmin`/`upgrade` onto
  `actionType` values that don't correspond to real contract enum members (only 1/2/3 are valid —
  emergencyRevoke/pause/unpause). Needs real per-kind branching against the actual contract surface
  (`grantRole`/`_authorizeUpgrade`) for `addAdmin`/`removeAdmin`/`upgrade`, not the platform-action queue.
- **T-034** `approveProposal` — calls `BigInt(proposalId)` where `proposalId` is a mock-shaped string
  (e.g. `"gov-1"`); **throws at runtime** the first time this path is exercised in onchain mode. Needs
  the real numeric `actionId` read from the proposing transaction's receipt, same pattern as
  `assetService`'s `useProposeMint`.
- **T-035** `resolveDispute` — silently ignores its own `proceed: boolean` argument and always calls
  `executeTransaction`, even when the caller meant to reject/cancel a disputed transaction. Needs a
  real `resolveDispute`-equivalent wagmi hook in `lib/hooks/useGovernanceTimelock.ts` that branches on
  `proceed`.

### `lib/services/auditService.ts`
- **T-036** `dismissAlert` — no-op; the dismissal is silently dropped. Needs a real persistence layer
  (a minimal server-side dismissed-ids store is sufficient).
- **T-037** `subscribeToEvents` — no-op in both the mock and onchain branches. Needs `wagmi`'s
  `useWatchContractEvent` wired per relevant contract in the onchain branch.

---

## ✅ Resolved — T-017 / T-018 (redeploy, 2026-09-09)

**T-017** (untracked address holding `SUPER_ADMIN_ROLE`) and **T-018** (deployer retaining
`DEFAULT_ADMIN_ROLE`) were both closed, but not by patching the old deployment — see the incident
note below for why. The platform is now on a **fresh deployment** (new addresses in
`deployments/sepolia.json` / `.env.local`, new subgraph at `.../cipherloom/v3`) produced by a
clean, unmodified `deploy.ts` + `postDeploySetup.ts` run with no manual grants in between. On this
deployment: exactly one tracked address holds `SUPER_ADMIN_ROLE` (`deployments/sepolia.json`'s
`mockWallets.secondSuperAdmin`), and the deployer **still holds `DEFAULT_ADMIN_ROLE`** —
deliberately, this time, as a documented decision (see T-020) rather than an oversight.

### Incident note: the first T-017/T-018 fix caused a lockout
Revoking the unknown address's `SUPER_ADMIN_ROLE` and then renouncing the deployer's
`DEFAULT_ADMIN_ROLE` (in that order, on the *original* deployment) left the contract with exactly
one `SUPER_ADMIN_ROLE` holder and no `DEFAULT_ADMIN_ROLE` holder at all. Since adding a new Super
Admin requires either `DEFAULT_ADMIN_ROLE` or 2-of-3 co-signatures, and only one legitimate signer
remained, **the contract could never grant `SUPER_ADMIN_ROLE` to anyone again** — a genuine
self-lockout, verified by reading `grantTimedRole`'s `onlyRole(getRoleAdmin(role))` gate. This is
why the fix here is a redeploy rather than a further patch to that instance: with essentially zero
real state on it (no DIDs, no assets, no team onboarded yet), redeploying was cheaper and safer
than an upgrade-based recovery. The old contract addresses are abandoned; nothing on them should
be referenced going forward.

### T-020: `DEFAULT_ADMIN_ROLE` is intentionally still held by the deployer
Unlike the first attempt, this deployment does **not** renounce the deployer's `DEFAULT_ADMIN_ROLE`
— it's the only path to add a third Super Admin (or recover from a lost key) as long as there are
only two. Before renouncing it for real: either enroll a third Super Admin first (restoring 2-of-N
headroom), or ship a UUPS upgrade to `TimeBoundAccessControl` adding a proper recovery path that
doesn't depend on `DEFAULT_ADMIN_ROLE`. Until one of those happens, treat this as a deliberate,
tracked trade-off, not a forgotten checklist item — don't "fix" it again without doing one of those
first.

### T-019 (contract-level, not fixed): `AssetRegistry.vcIdOf[tokenId]` stores a DID, not a VC id
`proposeMint`'s second parameter is named `recipientDid` in the contract (not `vcId` as
`docs/API_SPEC.md` describes), and `coSignMint` stores that DID hash directly into
`vcIdOf[tokenId]`. So the "credential gating transfers" mechanism (`docs/FEATURES.md` F3.2,
`docs/SECURITY.md` §5.1) is checking a DID hash against `CredentialRegistry`, which will almost
always look invalid since a DID hash isn't a real `vcId`. This is a contract bug, not a subgraph
bug — the subgraph fix in this session (Phase 0) faithfully indexes whatever `vcIdOf` actually
holds on-chain, it doesn't correct the underlying value. Fixing it means changing already-deployed
contract logic — flagged per `AI_DEVELOPMENT_RULES.md` §9, not touched without sign-off.

---

## ✅ Already done, verified live on-chain (this file previously listed these as blocked)

What follows used to be listed as blocked on credential provisioning. Verified directly against
Sepolia and the live Graph Studio subgraph in this session — not from a doc, from `eth_getCode`,
`hasRole()`, and `_meta` queries against the real endpoints:

- Deployer wallet funded, `.env.local` fully populated (Alchemy RPC, deploy key, WalletConnect
  project ID, Graph deploy key).
- All 6 core contracts deployed to Sepolia (`deployments/sepolia.json`), bytecode confirmed live
  on-chain at every recorded address.
- Subgraph deployed to Graph Studio and indexing with zero errors.
- Post-deploy checklist: second Super Admin enrolled and confirmed live, `ECDSASignatureVerifier`
  deployed and wired into `DIDRegistry`, `ISSUER_ROLE` granted, deployer's `SUPER_ADMIN_ROLE`
  revoked — all confirmed via live `hasRole`/`signatureVerifier()` calls. (Deployer intentionally
  retains `DEFAULT_ADMIN_ROLE` — see T-020.)
- WalletConnect modal (`lib/web3modal.ts` + `Web3Providers.tsx`) is wired and real.

---

## 🟢 Medium Priority — Polish & Robustness

### T-015: ZK Privacy Module (Phase 4)
Implement Zero-Knowledge proofs for selective credential disclosure and transaction privacy.

### T-016: Oracle Attestation (Phase 4)
Integrate decentralized oracles for off-chain data validation.

---

## ✅ Completed (see CHANGELOG.md for details)

- Phase 1: Contract scaffold, Hardhat environment, mock data, frontend shell
- Phase 2: OZ v5 migration, full contract hardening, 86/86 tests, SECURITY.md
- Phase 3: Web3Providers, ABI exports, ⌘K palette, detail panel, ledger animation
- Phase 4: Production deploy script, wagmi hooks layer, TheGraph subgraph scaffold
- Phase 5: Coverage report (94% stmts, 83.5% branches), ESLint clean, Slither audit
- Phase 6: Live data wiring, subgraph deployed to Graph Studio, testing polish
- Phase 7: Real Sepolia deployment + post-deploy setup (verified on-chain, see above)
- Phase 8: Fake-data removal pass (see CHANGELOG.md "Phase 8" entry for the full list)
