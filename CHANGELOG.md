# Changelog

All notable changes to Cipherloom (SIH 2026, PS 26125) are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
Versioning is `MAJOR.MINOR.PATCH` starting from `0.1.0` (pre-deployment).

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
- Subgraph indexer deployed to Graph Studio (`cipherloom` schema) with fully implemented mapping logic
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
- Rebranded platform name from "BEL-Chain" to "Cipherloom".

## [0.1.0] - 2026-09-05 - Phase 1: Contract Environment

### Added
- Monorepo root at `bel-chain/` (Next.js 14 App Router + Hardhat in same directory)
- Contract scaffold: DIDRegistry, CredentialRegistry, TimeBoundAccessControl (UUPS), AssetRegistry (UUPS), GuardianRecovery, GovernanceTimelock
- Hardhat toolbox + OpenZeppelin Contracts Upgradeable v5
- Test suite: 86 tests covering all contracts
- `lib/mock-data.ts` — typed demo dataset mirroring DATABASE_SCHEMA.md §2
- Frontend shell: CommandRail, ContextBar, card/badge/button component library
- Module pages: Identity, Access Control, Assets, Governance, Audit
- `docs/`: ARCHITECTURE.md, SECURITY.md, DATABASE_SCHEMA.md, API_SPEC.md, UI_UX_SPEC.md
