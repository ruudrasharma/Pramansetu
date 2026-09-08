# Changelog — Cipherloom

All notable work is logged here, newest first. Format loosely follows Keep a Changelog.

## [Unreleased]

## [0.2.0] - 2026-09-08
- Rebranded platform name from "BEL-Chain" to "Cipherloom".

## 2026-09-05
### Added
- Initial project scaffold: full documentation set (README, PRD, ARCHITECTURE, UI_UX_SPEC,
  DATABASE_SCHEMA, API_SPEC, SECURITY, TECH_STACK, USER_FLOWS, FEATURES, ENVIRONMENT, TESTING,
  DEPLOYMENT, CHANGELOG, TODO).
- Solidity contract set: `DIDRegistry`, `CredentialRegistry`, `TimeBoundAccessControl`,
  `AssetRegistry`, `GuardianRecovery`, `GovernanceTimelock`, `ISignatureVerifier` interface.
- Next.js 14 (App Router) + TypeScript + Tailwind frontend scaffold with custom "control deck" design
  system (not a sidebar+topbar template) — Overview ledger stream, Identity, Access Control, Assets,
  Governance, Audit screens.
- wagmi/viem wallet integration scaffold, mock-data layer for demo-without-live-chain scenarios.
- Hardhat config targeting Polygon Amoy testnet; `.env.example` covering all required variables.

### Notes
- Derived directly from `original-docs/Problem_Gap_Analysis.pdf` and `original-docs/Complete_Solution_Document.pdf` — every
  stated, unstated, and future-facing problem identified there is traceable to a specific module,
  contract function, or UI feature in this codebase (see PRD.md §7 and SECURITY.md §5).
