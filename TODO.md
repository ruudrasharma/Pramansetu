# TODO — Praman Setu (SIH 2026, PS 26125)

This file tracks outstanding work ordered by priority.
Completed items are moved to CHANGELOG.md.

---

## 🔴 High Priority — T-021–T-037: Phase 10 onchain-mode stubs

Catalogued 2026-09-09 during the post-Phase-10 audit (see `CHANGELOG.md`'s "Corrected" note under
Phase 10). `NEXT_PUBLIC_DATA_MODE` defaults to `mock` precisely because these aren't done yet — per
`AI_DEVELOPMENT_RULES.md` Rule Zero, the default does not flip to `onchain` until every item below
is either genuinely wired or explicitly gated to fail loudly instead of silently faking success.

### `lib/services/didService.ts` — B.1, closed 2026-09-09 (T-021/T-022/T-024), partial (T-023), open (T-025)
- **T-021** ✅ `resolveDID` — real `useResolveDID(did)` read, adapted to `Identity`. `name`/`department`
  are left as `""` (would need fetching `metadataURI`'s ipfs:// content — no current caller reads
  these two fields off `resolveDID`'s result, so this wasn't built; revisit if that changes).
  `role` is genuinely derived from 5 real `useHasRole` checks against the resolved controller.
- **T-022** ✅ `listCredentials` — real subgraph query (`GET_CREDENTIALS_BY_SUBJECT`) filtered by subject.
- **T-023** 🟡 `getGuardians` — `guardians`/`threshold` are real (`recoveryThreshold` +
  `lib/hooks/useGuardianRecovery.ts`'s new `useGuardiansList`, which probes `guardiansOf(did, 0..4)`
  since `GuardianRecovery.MAX_GUARDIANS` is a real contract constant). `activeRecovery` is always
  `undefined` in onchain mode, not a stub oversight: confirmed against the compiled ABI that
  `activeRecovery(did)`'s auto-generated getter omits the `signers` array entirely (Solidity drops
  dynamic-array struct members from public-mapping getters), and `initiatedBy` is only ever emitted
  in the `RecoveryInitiated` event, never stored. Signer count / initiator need an event or subgraph
  source that doesn't exist yet — building it is pointless until T-039 exists anyway.
- **T-024** ✅ `createDID` — generates a real keypair client-side (`viem/accounts`), uploads real
  `{name, department}` metadata to IPFS via `/api/ipfs/upload` (loosened to accept any metadata
  shape with a `name`, not just asset metadata — see that route + `docs/API_SPEC.md`), and submits
  the real public key + real `ipfs://` metadataURI. The generated private key is stored in
  `localStorage` (prototype-grade only, per `docs/SECURITY.md` — not real custody).
- **T-025** `initiateRecovery` — still throws in onchain mode. Blocked on **T-039** below, not a
  simple wiring gap: fixing the hardcoded zero args isn't enough on its own.

### T-039 — Guardian recovery needs a guardian-actor UI, not just service fixes
Found while implementing T-023/T-025 (2026-09-09). `GuardianRecovery.initiateRecovery`/`signRecovery`
can only be called by a **registered guardian of the target DID** — never by the person who lost
their device. The current `/identity/recovery` page is framed backwards for onchain mode: it renders
*my own* recovery status and shows a "Simulate recovery" button as if a guardian clicked it on my
behalf, but with the real connected-wallet model (see `lib/hooks/useCurrentIdentity.ts`), whoever's
wallet is connected while viewing that button would need to *be* one of my guardians for the real
transaction to succeed — which is never true when I'm looking at my own page. `initiateRecovery` also
needs a real new-controller-address / new-pubkey input that no UI currently collects (the mock model
only ever tracked a signature-count list). Needs a product decision on a genuine "act as a guardian
for someone else's recovery" flow (a different page, or a lookup-by-did console) before `initiateRecovery`/
`signRecovery`/`finalizeRecovery` can be wired for real — not something to guess at unilaterally.

### T-040 ✅ closed 2026-09-10 — `app/auth/page.tsx`'s "Simulate (demo)" button fakes wallet-signature authentication
`handleSimulateResolve` flips the UI through "resolving" → "done" via two `setTimeout`s and redirects
to `/dashboard`, without ever calling `signMessage` or resolving anything real. Fixed by gating the
button behind `dataMode === "mock"` (hidden entirely in onchain mode), same pattern as the role
switcher. See also **T-045** below — a real gap this fix surfaced, not fixed in this pass.

### T-044 ✅ closed 2026-09-10 — Dashboard "Simulate" button fabricated live-looking chain events in *any* data mode
Found in the 2026-09-10 gap audit (§2.4). `app/(app)/dashboard/page.tsx`'s `simulateLiveEvent()`
injects a synthetic `AuditEvent` with a fabricated `0x####…####` tx hash straight into the same list
used for real subgraph-indexed events, and — unlike T-040's button — it wasn't gated by `dataMode` at
all, so it was live and fabricating in onchain mode too. Fixed with the same `dataMode === "mock"`
gate as T-040.

### T-045 — `app/auth/page.tsx`'s real (non-simulated) sign-in path dead-ends at "Resolving DID…"
Found while fixing T-040 (2026-09-10), not fixed this pass — out of scope for the audit item that
surfaced it. `handleSign`'s `onSuccess` callback sets `step` to `"resolving"`, but nothing in the
component ever resolves a real DID from the signed message and advances `step` to `"done"` — there is
no `useEffect` or callback watching the `"resolving"` state. In onchain mode, once the mock-only
Simulate button is hidden (per T-040's fix), a real user who actually signs the challenge gets stuck
on "Resolving DID from signature…" forever with no way to reach the dashboard through this page.
Needs a real DID-resolution step wired to the `"resolving"` state (likely reusing
`useCurrentIdentity()`'s address→DID lookup, the same hook `TopBar.tsx` already uses) before onchain
mode's auth flow is actually usable end-to-end.

### `lib/services/rbacService.ts` — B.2, closed 2026-09-09 (T-026/T-028/T-041), stopgapped (T-027)
- **T-026** ✅ `grantTimedRole` — resolves the target DID's real controller address via the new
  `resolveControllerAddress` (`lib/hooks/useDIDRegistry.ts`, an imperative `readContract` call, not
  a hook — the target `did` is only known inside a click handler, not at render time) before calling
  the real contract function. `revokeRole` also resolves the address, then determines which role to
  revoke via a new `findActiveRole` (`lib/hooks/useAccessControl.ts`) imperative check across the 5
  checkable roles — the mock interface's `revokeRole(did, revokedBy)` doesn't carry a role argument
  at all, so this couldn't be a hardcoded fix; it had to be resolved for real at call time.
- **T-027** `getRoleExpiry` — confirmed zero callers anywhere in the app (`listIdentities()`'s
  `roleExpiresAt` field already covers this per-row). Stopgapped with a clear thrown error per
  Phase A.3 rather than building unverifiable machinery for a dead code path.
- **T-028** ✅ `requestRole` — confirmed no on-chain self-service path exists
  (`TimeBoundAccessControl.sol` / `docs/API_SPEC.md`: only `grantTimedRole`/`proposePrivilegedGrant`,
  both Admin/Super-Admin-initiated). Now an honest thrown "no self-service path — contact an Admin"
  error; `app/(app)/roles/request/page.tsx` shows this as a static message instead of the old fake
  "Request submitted" success state.
- **T-041** (found during B.2, not in the original catalogue) `listIdentities` — same category of bug
  as T-031/T-032 (mock fixtures returned unconditionally in the onchain branch), just missed in the
  original audit. Without a real list, T-026's fixes would have nothing real to operate on — grantTimedRole/revokeRole
  would still be resolving fake fixture dids. Now a real `GET_IDENTITIES` subgraph query, adapted via
  the new `lib/services/shared/credentials.ts` (shared with `didService.ts` to avoid duplicating the
  credential-status/role-derivation logic). `name`/`department` are `""` for the same reason as T-021 —
  would need N ipfs:// metadata fetches for a list this size, not done this pass.

### `lib/services/assetService.ts` — B.3, closed 2026-09-09 (T-029/T-030/T-042), partial (T-031), stopgapped (T-043)
- **T-029** ✅ `proposeMint` — now throws if `vcId`/`recipient` are missing instead of defaulting to
  a zero placeholder; both reach the real transaction as-provided from the mint page's raw inputs.
- **T-030** ✅ `transferAsset` — real `transferFrom` via the new `useTransferAsset` hook
  (`lib/hooks/useAssetRegistry.ts`); resolves the recipient DID to a real address via
  `resolveControllerAddress` and reads the asset's real current `ownerAddress` (added to the
  `Asset` type — mock mode leaves it `undefined`) rather than guessing the `from` argument.
  `app/(app)/assets/[tokenId]/transfer/page.tsx` no longer redirects on click — it waits for
  `assetService.isTransferConfirmed` (a real `useWaitForTransactionReceipt` result) via `useEffect`.
- **T-031** 🟡 `listAssets`/`getAsset` ✅ — real `GET_ASSETS` subgraph query, each asset's real
  IPFS-pinned metadata (`name`/`category`) fetched and merged in (worth the extra round-trip here,
  unlike didService's name/department, since `Asset.name` is prominently displayed everywhere —
  a failed fetch shows "(metadata unavailable)", never a blank or fabricated name). `status` is
  always `"finalized"` for any indexed `Asset` (an entity only exists once `AssetMinted` fired) —
  `"transferred"`/`"disputed"` aren't derived (would need a provenance lookup per list row just for
  a list-view status); see T-043. `getProvenance` itself is stopgapped, see below.
- **T-042** (found during B.3, not in the original catalogue) — **higher severity than a stub**:
  the old onchain `proposeMint` submitted the real transaction correctly but then **returned a
  hardcoded fake `Asset` object** (`assetById(0) ?? assets[0]!`) regardless of what was actually
  proposed, and the mint page's `handleCoSign` synchronously faked `{...asset, status: "finalized"}`
  on click without waiting for the real co-sign transaction at all. Both fixed: `proposeMint`/
  `coSignMint` no longer return anything; callers read progress from new reactive fields
  (`lastRequestId`, `isProposeConfirmed`, `lastMintedTokenId`, `isCoSignConfirmed`) that resolve
  instantly in mock mode and only once a real transaction confirms onchain.
- **T-043** `getProvenance` — confirmed zero callers anywhere in the app, same pattern as T-027/
  dead-code stopgaps. If a caller appears: `AuditEvent` has no `assetId`/`targetId` field to filter
  by (checked against `schema.graphql`) — a real implementation means fetching the event stream and
  regex-matching `"#<tokenId>"` against the free-text `summary` field, honest but fragile enough
  that it's worth building deliberately rather than guessing at a call site that doesn't exist yet.

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
- **T-036** ✅ closed 2026-09-10 — `dismissAlert` was a no-op in onchain mode; the dismissal was
  silently dropped. Added a minimal server-side dismissed-ids store (`lib/server/dismissedAlerts.ts`,
  a JSON file at `data/dismissed-alerts.json`, gitignored) plus a new `POST /api/audit/anomalies`
  endpoint (documented in `docs/API_SPEC.md`, new state documented in `docs/DATABASE_SCHEMA.md` §4.1).
  `GET /api/audit/anomalies` now overlays dismissed status/reason onto each freshly-recomputed
  anomaly by its deterministic id. `app/(app)/audit/anomalies/page.tsx` now awaits the real call and
  surfaces failures instead of firing-and-forgetting.
  - **Found while fixing this**: the route's velocity-check anomaly used `status: "investigating"`,
    which isn't a member of `AnomalyAlert.status`'s `"open" | "dismissed"` union — so it matched
    neither the "Open alerts" nor "Resolved" filter on the anomalies page and silently never
    rendered. Normalized to `"open"`. Also found: every anomaly object from this route was missing
    `severity` and `actorDid`, both required, non-optional fields on `AnomalyAlert` — `AlertCard.tsx`
    indexes `severityMeta[alert.severity]` unconditionally, so a real onchain anomaly would have
    **crashed the anomalies page** (`Cannot read properties of undefined`) the first time this route
    ever returned real data. Fixed by adding `severity` per rule (`critical` for emergency-pause,
    `warning` for velocity) and `actorDid: event.actorAddress` (the raw address, not a resolved DID —
    `findIdentity()` simply won't match it in onchain mode, which is an honest degrade, not a crash).
  - **Not fixed this pass**: no frontend/API test framework exists anywhere in this repo (only
    Hardhat contract tests — `docs/TESTING.md`'s Frontend/Integration/E2E sections describe a plan
    with zero actual implementation, no test runner in `package.json`). `AI_DEVELOPMENT_RULES.md` §5
    asks for a happy-path + auth-failure test on every new endpoint; introducing a whole test
    framework (Vitest/Jest + route-handler testing) to satisfy that for one endpoint felt like a
    bigger, separate infrastructure decision than this fix warranted — flagging as **T-049** rather
    than deciding unilaterally.
- **T-037** ✅ closed 2026-09-10 — `subscribeToEvents` was a no-op in both branches. Decision: kept
  as polling rather than building real `wagmi` `useWatchContractEvent` wiring, since `getEvents()`/
  `getAnomalies()` already poll live (5s/10s `refetchInterval`) and there are zero real callers of
  `subscribeToEvents` anywhere in the app. Documented explicitly in a code comment
  (`lib/services/auditService.ts`) and in `docs/API_SPEC.md` — the onchain branch now throws a clear
  error naming this decision instead of silently no-op-ing (same pattern as T-027/T-043's stopgaps).

### T-049 — No frontend/API-route test framework exists anywhere in this repo
Found while closing T-036 (2026-09-10). `docs/TESTING.md` §2–4 (Frontend Unit Tests, Integration
Tests, End-to-End Tests) describe a testing plan, but `package.json` has no Jest/Vitest/Playwright/
React Testing Library dependency and no `test`-equivalent script beyond `test:contracts` (Hardhat).
The new `POST /api/audit/anomalies` endpoint (T-036) has no automated test as a result, same as every
other existing API route (`/api/ipfs/upload`, `GET /api/audit/anomalies`). Per
`AI_DEVELOPMENT_RULES.md` §5, new endpoints need a happy-path + auth-failure test; closing that gap
means picking and wiring up a real frontend test framework first, which is a deliberate infrastructure
decision, not a drive-by addition to one endpoint's fix.

### Audit event labeling
- **T-038** ✅ closed 2026-09-10 — `KeyRotated` was missing from the `EventType` union in
  `lib/mock/fixtures/auditEvents.ts`, so a real `KeyRotated` audit event from the subgraph had no
  matching frontend type/icon/tone. Added back to `EventType`, `EventRow.tsx`'s `eventMeta` (new
  `KeyRound` icon, `alert` tone), and `app/(app)/audit/page.tsx`'s filter dropdown (`eventTypes`),
  which had also silently dropped it. Cross-checked every `audit.type = "..."` assignment across
  `subgraph/src/*.ts` against the union — `KeyRotated` was the only value the subgraph emits that the
  union was missing. See **T-046** below for the inverse gap this check surfaced.
- **T-046** — `GuardianRegistered`/`RecoveryInitiated`/`RecoveryFinalized` are in the `EventType`
  union but the subgraph never emits them: `subgraph/src/` has mapping files for `did-registry`,
  `credential-registry`, `access-control`, `asset-registry`, and `governance-timelock`, but none for
  `GuardianRecovery.sol` — so none of that contract's events (`GuardianRegistered`,
  `RecoveryInitiated`, `RecoverySigned`, `RecoveryFinalized`) ever reach the audit trail in onchain
  mode, even though the frontend has always been able to render them. Found while closing T-038, not
  fixed in this pass (out of that item's scope — needs a new `subgraph/src/guardian-recovery.ts`
  mapping + a manifest entry in `subgraph.yaml`, then a subgraph redeploy).

---

## ✅ Resolved — T-017 / T-018 (redeploy, 2026-09-09)

**T-017** (untracked address holding `SUPER_ADMIN_ROLE`) and **T-018** (deployer retaining
`DEFAULT_ADMIN_ROLE`) were both closed, but not by patching the old deployment — see the incident
note below for why. The platform is now on a **fresh deployment** (new addresses in
`deployments/sepolia.json` / `.env.local`, new subgraph at `.../praman-setu/v3`) produced by a
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

### T-015: ZK Privacy Module (Phase 4) — labeling fixed 2026-09-10, implementation still open
Implement Zero-Knowledge proofs for selective credential disclosure and transaction privacy.
**2026-09-10 (audit §4.2):** the `/identity` page's "Generate proof" button (`runZkDemo`) fabricated a
Semaphore-style verification result via `setTimeout` in *every* data mode, with no ZK library anywhere
in `package.json`. Fixed the honesty gap without building the real thing (out of scope for this pass):
the card is now `dataMode === "mock"`-only, carries a visible "Illustrative — not a real proof" badge,
its copy no longer implies a live Merkle-root check, and `docs/FEATURES.md` F1.4 /
`docs/SECURITY.md` §5.2 both now explicitly say "not yet implemented, Phase 4 roadmap" instead of
reading like a shipped mitigation. The actual Semaphore/snarkjs integration remains open.

### T-016: Oracle Attestation (Phase 4)
Integrate decentralized oracles for off-chain data validation.

### T-047 ✅ closed 2026-09-10 — "AI" anomaly detection relabeled honestly (audit §4.4)
`app/api/audit/anomalies/route.ts` is a genuinely working, honest rule-based heuristic (mint/role-grant
velocity + emergency-pause checks) — good code, but `README.md`, `docs/README.md`, `docs/ARCHITECTURE.md`,
and `docs/TECH_STACK.md` described it as "AI"/"AI monitoring"/a "Python service (rule-based + lightweight
ML)". None of that matches the shipped TypeScript Next.js API route. Reworded all four to describe it as
rule-based heuristic detection, consistent with `docs/PRD.md`'s existing Non-Goals ("not shipping a
production-grade ML anomaly-detection pipeline in the hackathon build"). Left `docs/SECURITY.md` §5.3 and
`docs/DEPLOYMENT.md`'s Phase 3 row alone — both already correctly frame "AI anomaly-detection service" as
future-facing/production-roadmap language, not a claim about the current build.

### T-048 — Root vs. `docs/` copies of TODO.md/CHANGELOG.md/README.md have diverged; `docs/` copies are stale
Found while doing T-047's doc pass (2026-09-10). This repo has two copies each of `TODO.md`, `CHANGELOG.md`,
and `README.md`: one at the repo root (actively maintained — every phase referenced throughout `docs/*.md`
and this audit lines up with the root copies' history) and one under `docs/` (last touched 2026-09-09
21:44, i.e. end of Phase 9 — before Phase 10's merge and all of Phase B.1–B.3/T-021–T-046). `docs/TODO.md`
still lists items like "wire real wagmi hooks to deployed Sepolia addresses" and "deploy contracts to
Sepolia" as outstanding blockers, both long since done per the root `TODO.md`'s "Already done, verified
live on-chain" section. `AI_DEVELOPMENT_RULES.md` §6 names `docs/CHANGELOG.md`/`docs/TODO.md` as canonical,
which doesn't match actual practice (root files). Not resolved in this pass — deciding whether to delete
the stale `docs/` copies, turn them into pointers to the root files, or repoint `AI_DEVELOPMENT_RULES.md`
§6 at the root paths is a documentation-hygiene call worth a deliberate decision rather than a drive-by
fix, since a stale copy being read instead of the live one is exactly the kind of doc-drift this project's
own rules exist to prevent.

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
