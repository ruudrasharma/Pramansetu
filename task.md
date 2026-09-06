# BEL-Chain Task Tracker

## Phase 0 — Repo Hygiene & Infrastructure
- [/] 0.1 — git init at bel-chain/, .gitignore, initial commit, remote config
- [ ] 0.2 — Copy AI_DEVELOPMENT_RULES.md to repo root
- [ ] 0.3 — Remove spurious bracket directories
- [ ] 0.4 — npm install + add @openzeppelin/hardhat-upgrades

## Phase 1 — Contract Compilation & Test Foundation
- [ ] 1.1 — Verify contracts compile cleanly
- [ ] 1.2 — Create test/ directory + all 6 Hardhat test suites
- [ ] 1.3 — Run compile + test, fix errors, show results

## Phase 2 — Contract Bug Fixes (approval required per item)
- [ ] 2.1 — Fix GuardianRecovery.registerGuardians — controller-only check
- [ ] 2.2 — Fix CredentialRegistry.revokeCredential — allow Super Admin
- [ ] 2.3 — Uncomment credential-gated transfer in AssetRegistry._update
- [ ] 2.4 — Integrate ISignatureVerifier into DIDRegistry
- [ ] 2.5 — Fix emergencyRevoke — 2-of-N multisig staging
- [ ] 2.6 — Fix pause()/unpause() — multisig staging
- [ ] 2.7 — Update API_SPEC.md to match actual signatures
- [ ] 2.8 — Update DATABASE_SCHEMA.md (controllerOf → didOf)

## Phase 3 — Frontend Foundation
- [ ] 3.1 — WagmiProvider + QueryClientProvider in layout.tsx
- [ ] 3.2 — Build lib/abis/ with TypeScript ABI exports
- [ ] 3.3 — Implement ⌘K command palette (cmdk)
- [ ] 3.4 — Implement slide-in detail panel
- [ ] 3.5 — Real-time ledger stream animation (AnimatePresence)

## Phase 4 — Wire Live Data
- [ ] 4.1 — Deploy contracts to Polygon Amoy
- [ ] 4.2 — Replace mock-data with wagmi hooks
- [ ] 4.3 — Stand up subgraph, wire into frontend

## Phase 5 — Verification & Polish
- [ ] 5.1 — Full Hardhat test suite + coverage
- [ ] 5.2 — lint + typecheck + build
- [ ] 5.3 — Update CHANGELOG.md + TODO.md
- [ ] 5.4 — Slither static analysis
