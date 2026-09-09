# Changelog

All notable changes to Praman Setu (SIH 2026, PS 26125) are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
Versioning is `MAJOR.MINOR.PATCH` starting from `0.1.0` (pre-deployment).

---

## [0.9.0] — 2026-09-09 — Phase 9: Warm visual system (light-first), rename cleanup

Full visual-design-system pass across all 20 pages, per an updated brief that supersedes the
dark-first "signal-ops console" concept in `docs/UI_UX_SPEC.md` §0/§1 (kept: shell IA, ledger-as-spine,
mono-for-exact-values — see the doc's revision note). No architecture, contract, service-layer, or IA
changes.

### Added
- `components/ui/IconBadge.tsx`, `StatCard.tsx`, `AreaChartCard.tsx`, `ProgressList.tsx`,
  `DateStrip.tsx`, `GradientBanner.tsx`, `Avatar.tsx` — new shared primitives implementing the
  reference design's recurring patterns (solid-fill icon circles, count-up stat cards, gradient area
  charts with a peak-value badge, stacked progress bars, calendar day-strip, gradient promo banners,
  initials avatars), reused across Dashboard, Roles, Audit/Anomalies, Governance, Identity/Recovery,
  Disputes, and Onboarding rather than one-off per page.
- `sage` and `charcoal` color tokens (`app/globals.css`, `tailwind.config.ts`) alongside the existing
  `signal`/`verified`/`alert`/`danger` — `charcoal-500` is deliberately theme-constant (not redefined
  under `.dark`) since it's a fixed near-black accent, not a surface color.
- Dashboard and Audit pages: a 7-day event-volume area chart and a date-strip filter on the ledger
  stream. Roles page: a role-distribution progress panel. Guardian recovery and Disputes pages: a
  date-strip visualizing the cooling-off window alongside the existing live countdown.

### Changed
- `app/globals.css`: full light/dark token repaint — warm cream (`#F7F5F1`) light background, terracotta
  primary accent, soft card shadow as the primary separator in light mode (border + inner highlight in
  dark, since shadows read poorly there).
- `app/layout.tsx`: display font Inter → Plus Jakarta Sans; `ThemeProvider` default light regardless of
  system preference (`defaultTheme="light"`, `enableSystem={false}`), persisted via `next-themes`.
- `components/ui/{Card,Button,Badge}.tsx`: `rounded-3xl` cards, fully pill-shaped (`rounded-full`)
  buttons/badges, `Card` gained an `interactive` prop for the hover-lift micro-interaction.
- `components/shell/Sidebar.tsx`: active-nav indicator changed from a 2px left-edge bar to a
  Framer-Motion `layoutId`-animated filled pill; corrected the doc's stale "64px icon-only rail"
  description to match the shell's actual always-labeled, collapsible sidebar.
- `components/shell/TopBar.tsx`, `ThemeToggle.tsx`: pill-shaped search/⌘K trigger and role chip,
  circular icon-buttons, theme toggle rebuilt as a circular sun/moon cross-fade (was a track/thumb
  switch).
- Repo-wide: squarish tinted icon containers → solid-fill circular `IconBadge`s; miscellaneous
  `rounded-lg` status/alert boxes → `rounded-2xl`/`rounded-xl` for the softer shape language.
- `docs/UI_UX_SPEC.md`: rewrote §0 Design Concept and §1 Design Tokens/Typography/Shape/Motion to
  describe the shipped light-first system; corrected the Layout Shape rail description (see above).

### Fixed
- Two leftover "BC" (bel-chain) logo-badge initials in `components/shell/Sidebar.tsx` and `app/page.tsx`
  — the product-name rename to "Praman Setu" was otherwise already complete.

### Known gaps found, not fixed (out of this pass's visual-only scope — logged in `docs/TODO.md`)
- `TopBar` role chip hydration mismatch (server/client text differs) in onchain mode.
- `auditService`'s onchain `auditEvents` query resolves `undefined` instead of `[]` without a reachable
  subgraph, silently emptying the Dashboard/Audit ledger rather than showing an error/empty state.

---

## [0.8.0] — 2026-09-09 — Phase 8: Fake-data removal, real fixes, doc reconciliation

A prior pass had left fabricated/mocked data disguised as real functionality in three places, plus
several bugs that silently produced plausible-but-wrong output instead of failing loudly. This pass
removed all of it and replaced each with either real on-chain reads or an honest failure state.

### Removed
- `app/api/audit/anomalies/route.ts`: deleted the hardcoded fallback that invented two fake
  security incidents whenever the real heuristic found zero anomalies. Zero anomalies now returns
  `[]`, and the `/audit` page's existing "No anomalies detected." empty state renders correctly.
- `lib/ipfs.ts`: deleted. It silently returned a fake `ipfs://mocked-cid-*` whenever Pinata keys
  were missing or misnamed — which, due to a `NEXT_PUBLIC_`-prefix mismatch against `.env.example`,
  was firing on every single mint regardless of configuration.
- `app/assets/page.tsx`: removed the hardcoded `mintSteps` array (`done: true, true, false`)
  that displayed a static "Mint flow — Asset #45" progress stepper unconnected to any real request.
- `components/shell/ContextBar.tsx`: removed the `systemHealth.platformPaused` mock-data read that
  drove the top bar's paused/live indicator on every page regardless of actual chain state.

### Added
- `app/api/ipfs/upload/route.ts`: server-side Pinata pin. Reads `PINATA_API_KEY`/
  `PINATA_SECRET_API_KEY` (server-only, never `NEXT_PUBLIC_`) and returns a clear 500 if unset —
  never a fake CID.
- `usePendingMint` hook (`lib/hooks/useAssetRegistry.ts`) + a real mint-request lookup panel on
  the Assets page: every step shown (proposed / co-signed / executed) is read live from
  `AssetRegistry.pendingMints`, with a working "Co-sign as Manager" button for role-holders.
- Honest "Subgraph not reachable: <message>" error states on `/`, `/audit`, `/governance` when
  `NEXT_PUBLIC_SUBGRAPH_URL` is unset or unreachable, instead of a silent empty/blank result.

### Fixed
- **`lib/hooks/useAccessControl.ts`**: `ROLE.ADMIN_ROLE`/`MANAGER_ROLE`/`AUDITOR_ROLE`/`ISSUER_ROLE`/
  `SUPER_ADMIN_ROLE` were computed as a hex-encoded-and-padded role *name* instead of
  `keccak256(roleName)` — meaning every `useHasRole(ROLE.ADMIN_ROLE, ...)` check in the app was
  silently comparing against a role hash nobody had ever been granted on-chain, always returning
  `false`. Now computed via `keccak256(toBytes(name))`, matching the deployed contract exactly.
- **Subgraph mappings** — three fields that were storing the wrong value instead of the real one
  (looked fixed, weren't):
  - `subgraph/src/asset-registry.ts`: `Asset.ownerAddress` now reads the real owner via a bound
    `ownerOf(tokenId)` call (was storing the recipient's DID hash); `Asset.vcId` and
    `MintRequest.recipient` now read real values via bound `vcIdOf`/`pendingMints` calls (were
    hardcoded/wrong).
  - `subgraph/src/did-registry.ts`: `Identity.metadataURI` and `Identity.pubKey` now come from a
    bound `resolveDID()` call in both `handleDIDCreated` and `handleKeyRotated` (were storing the
    `keyType` string in the `metadataURI` field). `KeyRotated` events are now labeled `"KeyRotated"`
    instead of reusing `"DIDCreated"`.
  - `subgraph/src/credential-registry.ts`: `Credential.vcHash` now reads the real value via a
    bound `credentials(vcId)` call (was storing `vcId` itself as a stand-in).
  - `subgraph/src/access-control.ts`: `handleActionExecuted` previously labeled every
    `actionType` (emergencyRevoke, pause, unpause) as `"EmergencyPaused"`, so a real (benign)
    role revocation showed on the ledger identically to an actual platform pause. Each
    `actionType` now gets its own correct label.
- **`lib/graphql.ts`** / anomalies route: both previously read `NEXT_PUBLIC_GRAPHQL_ENDPOINT`
  (undocumented in `.env.example`) with a hardcoded Graph Studio URL as a silent fallback.
  Consolidated to the documented `NEXT_PUBLIC_SUBGRAPH_URL` everywhere; missing config now throws
  a clear error instead of falling back.
- **`lib/web3modal.ts`**: previously fell back to an all-zeros placeholder WalletConnect project ID
  with only a `console.warn` if unset, silently initializing a non-functional wallet modal. Now
  skips initialization and the UI shows "Wallet connection not configured" instead of a broken
  button.
- **`.env.local`**: consolidated duplicate/appended key declarations into their proper slots (no
  functional change — the later declarations were already the ones in effect), and renamed the
  working subgraph URL from `NEXT_PUBLIC_GRAPHQL_ENDPOINT` to the canonical `NEXT_PUBLIC_SUBGRAPH_URL`.
- **`docs/ENVIRONMENT.md`**: `NEXT_PUBLIC_CHAIN_ID=80002` was a leftover from the Polygon
  Amoy → Sepolia migration (80002 is Amoy's chain ID, not Sepolia's `11155111`); corrected, and
  the dead pre-June-2024 hosted-service subgraph URL default replaced with the real Graph Studio
  URL format.

### Corrected (this file, and `TODO.md`)
- **Deployment status was stale, in the other direction from the fake-data problem**: `TODO.md`
  previously listed Sepolia deployment as blocked on credential provisioning. It isn't blocked —
  it already happened. Verified directly against the chain and the live subgraph (not from any
  doc): all 6 contracts have real bytecode on Sepolia, the Graph Studio subgraph is indexing with
  zero errors, and the post-deploy checklist (second Super Admin, signature verifier, `ISSUER_ROLE`)
  is real and confirmed via live `hasRole()`/`signatureVerifier()` calls. See `TODO.md` for what's
  still genuinely open, including two access-control items (T-017, T-018) that need your sign-off
  before anyone acts on them, and one contract-level bug found in the process (T-019, not fixed).

---

## [0.9.0] — 2026-09-09 — Phase 9: Redeploy to close T-017/T-018, subgraph v3

### Context
A same-day earlier fix for T-017 (untracked address holding `SUPER_ADMIN_ROLE`) and T-018
(deployer retaining `DEFAULT_ADMIN_ROLE`) worked but had a side effect discovered immediately
after: it left the contract with exactly one `SUPER_ADMIN_ROLE` holder and no way to ever add
another one. See `TODO.md`'s "Resolved — T-017/T-018" entry for the full incident note.

### Changed
- Redeployed all 6 core contracts to Sepolia via an unmodified `deploy.ts` + `postDeploySetup.ts`
  run, with no manual role grants outside the two scripts this time. New addresses recorded in
  `deployments/sepolia.json` and `.env.local`; old addresses abandoned.
- `subgraph/subgraph.yaml`: updated to the new contract addresses; `startBlock` set to the actual
  deploy block (`11665400`) on all 5 data sources instead of `0` — the previous `startBlock: 0`
  made the indexer attempt a full scan from Sepolia genesis, which is why the first deploy attempt
  never finished syncing in a reasonable time.
- Subgraph redeployed to Graph Studio as `praman-setu/v3` (`.env.local`'s `NEXT_PUBLIC_SUBGRAPH_URL`
  updated to match), confirmed live and indexing with zero errors, and confirmed to correctly show
  the deployer's role revocation as `"RoleRevoked"` (not `"EmergencyPaused"`) — validating the
  Phase 8 subgraph mapping fix against real fresh data.
- Deployer intentionally retains `DEFAULT_ADMIN_ROLE` on this deployment (see `TODO.md` T-020) —
  not renounced this time, to avoid repeating the lockout.

---

## [0.5.0] — 2026-09-06 — Phase 5: Verification & Polish

### Added
- Coverage report via `hardhat coverage` (94% stmts, 83.5% branches)
- Strict ESLint configuration (`next/core-web-vitals` preset with overrides)
- Slither static analysis run on all contracts
- `CHANGELOG.md` + `TODO.md` to track state and remaining tasks

### Fixed
- Unescaped entity error in `app/audit/page.tsx`
- Slither findings:
  - Fixed `missing-zero-check` on `DIDRegistry.setGuardianRecoveryContract` and `setSignatureVerifier`
  - Fixed `immutable-states` for `owner`, `accessControl`, `didRegistry` across contracts
  - Fixed `reentrancy-events` in `GovernanceTimelock` and `GuardianRecovery` by strictly adhering to Checks-Effects-Interactions (CEI) pattern

---

## [0.6.0] — 2026-09-08 — Phase 6: Live Data Wiring & Testing Polish

### Added
- Subgraph indexer deployed to Graph Studio (`praman-setu` schema) with fully implemented mapping logic
- Wired `lib/hooks/` reads into live UI pages, replacing static mock data entirely
- Implemented cursor-based pagination on Audit stream UI (GraphQL query logic + UI load more button)
- Implemented role-based gating to `app/assets/page.tsx` using `useHasRole`
- `test/ECDSASignatureVerifier.test.ts`: Added full Hardhat coverage for cryptographic verification
- `docs/DEPLOYMENT.md`: Step-by-step production runbook documenting contract & subgraph rollouts + security post-deploy checks
- Updated `mock-data.ts` and `EventRow.tsx` with missing `KeyRotated` events.

---

## [Unreleased] — post-deploy

### Planned
- Anomaly detection service integration (`GET /audit/anomalies`)
- IPFS upload flow for asset CIDs using Pinata

---

## [0.4.0] — 2026-09-06 — Phase 4: Live Data Wiring

### Added
- `scripts/deploy.ts` — production-hardened deploy script
  - Deterministic contract deploy order (6 contracts)
  - Auto-wires GuardianRecovery address into DIDRegistry post-deploy
  - Writes `deployments/<network>.json` with full address record
  - Best-effort Etherscan/Polygonscan source verification
  - Prints post-deploy security checklist (enroll second SUPER_ADMIN, revoke deployer)
- `lib/hooks/` — complete wagmi hook layer (23 hooks across 6 contracts)
  - `useDIDRegistry.ts`: useResolveDID, useDIDOf, useCreateDID, useRotateKey
  - `useCredentialRegistry.ts`: useIsVCValid, useGetCredential, useIssueCredential, useRevokeCredential
  - `useAccessControl.ts`: ROLE constants, useHasRole, useRoleExpiry, usePlatformPaused, useGrantTimedRole, useProposePlatformAction, useCoSignPlatformAction
  - `useAssetRegistry.ts`: useTokenURI, useVcIdOf, useOwnerOf, useProposeMint, useCoSignMint, useAttachLegalReference
  - `useGuardianRecovery.ts`: useGuardianAtIndex, useRecoveryThreshold, useActiveRecovery, useRegisterGuardians, useInitiateRecovery, useSignRecovery, useFinalizeRecovery
  - `useGovernanceTimelock.ts`: useQueuedTx, useNextTxId, useQueueTransaction, useRaiseDispute, useExecuteTransaction
  - `lib/hooks/index.ts`: single barrel export
- `subgraph/` — TheGraph subgraph scaffold
  - `subgraph.yaml`: 5 data sources covering all core contracts
  - `schema.graphql`: 9 GraphQL entities (Identity, Credential, RoleGrant, Asset, MintRequest, PlatformAction, GovernanceTx, Dispute, AuditEvent)
  - AssemblyScript mappings: `did-registry.ts`, `credential-registry.ts`, `access-control.ts`, `asset-registry.ts`, `governance-timelock.ts`

### Fixed
- `tsconfig.json`: excludes `test/`, `scripts/`, `typechain-types/`, `subgraph/` — prevents Hardhat/AssemblyScript types bleeding into Next.js TS check
- `next.config.js`: webpack stubs for `@x402/*` + `@coinbase/cdp-sdk` (transitive dead dep in wagmi's unused baseAccount connector)

---

## [0.3.0] — 2026-09-06 — Phase 3: Frontend Foundation

### Added
- `components/shell/Web3Providers.tsx` — WagmiProvider + QueryClientProvider as `'use client'` wrapper; keeps `layout.tsx` a Server Component
- `lib/abis/` — typed ABI exports for all 6 contracts (DIDRegistry, CredentialRegistry, TimeBoundAccessControl, AssetRegistry, GuardianRecovery, GovernanceTimelock); import boundary for swapping ABI sources
- `components/shell/CommandPalette.tsx` — ⌘K global action surface (cmdk); 12 commands across 5 groups; fuzzy search; blurred overlay
- `lib/commandPaletteSignal.ts` — lightweight event bus connecting ContextBar ⌘K button to CommandPalette without prop drilling
- `components/shell/DetailPanel.tsx` + `DetailPanelContext.tsx` — spring slide-in right panel (stiffness 300, damping 28); decoded event payload; PolygonScan link; copyable fields; keyboard accessible
- `app/page.tsx` — AnimatePresence per-event ledger stream animation (y=−12 spring slide); "Simulate" button for live event arrival demo; health cards animate on mount

### Fixed
- `app/audit/page.tsx`: explicit return type on `riskTone` (was `as const` on computed expression — TS1355)
- `lib/mock-data.ts`: `@ts-nocheck` for noUncheckedIndexedAccess on static fixture data
- `components/shell/ContextBar.tsx`: ⌘K button now fires `commandPaletteSignal.open()`
- `components/modules/EventRow.tsx`: added 6 missing EventType variants; added `exit` animation for AnimatePresence; wired to DetailPanel on click

---

## [0.2.0] — 2026-09-06 — Phase 2: Smart Contract Hardening

### Added
- `contracts/interfaces/ISignatureVerifier.sol` — injectable signature verifier interface
- `contracts/ECDSASignatureVerifier.sol` — production ECDSA verifier implementation
- Full `docs/SECURITY.md` — threat model, role hierarchy, access control matrix
- `docs/ARCHITECTURE.md` updated with Phase 2 finalized contract interfaces
- `docs/DATABASE_SCHEMA.md` updated — `controllerOf → didOf`, all struct corrections
- `docs/API_SPEC.md` updated — all signatures match Phase 2 contract state

### Changed (Breaking)
- `DIDRegistry.sol`: `controllerOf` → `didOf`; optional ECDSA proof on `rotateKey`; `setSignatureVerifier` + `setGuardianRecoveryContract` admin functions
- `CredentialRegistry.sol`: `issueCredential` now takes 5 args (`+vcHash` param); issuer stored as `issuerDid` not address
- `TimeBoundAccessControl.sol`: `grantTimedRole` restricted to non-privileged roles; added `proposePrivilegedGrant/coSignGrant` 2-of-N multisig; `proposePlatformAction/coSignPlatformAction` for emergency/pause/unpause
- `AssetRegistry.sol`: `proposeMint` takes 3 args (`cid, vcId, recipient`); co-signer wired to access control
- `GuardianRecovery.sol`: `registerGuardians` restricted to DID controller; 24h timelock enforced on `finalizeRecovery`
- `GovernanceTimelock.sol`: Dispute struct with `raisedBy/reason/frozen`; `resolveDispute` added

### Fixed
## [0.2.0] - 2026-09-08
- Rebranded platform name from "Praman Setu" to "Praman Setu".

## [0.1.0] - 2026-09-05 - Phase 1: Contract Environment

### Added
- Monorepo root at `praman-setu/` (Next.js 14 App Router + Hardhat in same directory)
- Contract scaffold: DIDRegistry, CredentialRegistry, TimeBoundAccessControl (UUPS), AssetRegistry (UUPS), GuardianRecovery, GovernanceTimelock
- Hardhat toolbox + OpenZeppelin Contracts Upgradeable v5
- Test suite: 86 tests covering all contracts
- `lib/mock-data.ts` — typed demo dataset mirroring DATABASE_SCHEMA.md §2
- Frontend shell: CommandRail, ContextBar, card/badge/button component library
- Module pages: Identity, Access Control, Assets, Governance, Audit
- `docs/`: ARCHITECTURE.md, SECURITY.md, DATABASE_SCHEMA.md, API_SPEC.md, UI_UX_SPEC.md
