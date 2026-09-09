# TODO — Cipherloom (SIH 2026, PS 26125)

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

### T-040 — `app/auth/page.tsx`'s "Simulate (demo)" button fakes wallet-signature authentication
Found while auditing the connect/identity flow for B.1 (2026-09-09), not yet fixed — out of this
session's `lib/services/*` scope, flagging so it doesn't get missed. `handleSimulateResolve` flips
the UI through "resolving" → "done" via two `setTimeout`s and redirects to `/dashboard`, without
ever calling `signMessage` or resolving anything real — a second, independent instance of the same
fabricated-success pattern Rule Zero exists to catch. The real `handleSign` path (wallet-signed
challenge) sits right next to it and is genuinely wired. Needs either removal of the simulate button
or a clearly-labeled "demo shortcut, mock mode only" gate (`dataMode === "mock"`), same pattern as
the role switcher above.

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

### Audit event labeling
- **T-038** `KeyRotated` is missing from the `EventType` union in `lib/mock/fixtures/auditEvents.ts`
  — found while fixing `components/modules/EventRow.tsx`'s `eventMeta` record, which had a
  `KeyRotated` entry that no longer type-checks against the current union. This undoes real work:
  Phase 6 added `KeyRotated` as its own tracked event type, and Phase 8 fixed
  `subgraph/src/did-registry.ts` specifically so `KeyRotated` events get their own label instead of
  being lumped into `DIDCreated`. Somewhere in the Phase 10 refactor (fixtures split into
  `lib/mock/fixtures/*`) the union lost that member, so a real `KeyRotated` audit event from the
  subgraph now has no matching frontend type/icon/tone. Needs `KeyRotated` added back to `EventType`
  and `eventMeta`, and the real subgraph `AuditEvent.type` values cross-checked against the union
  to make sure nothing else silently dropped out the same way.

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
