# Changelog

All notable changes to Cipherloom (SIH 2026, PS 26125) are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
Versioning is `MAJOR.MINOR.PATCH` starting from `0.1.0` (pre-deployment).

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
