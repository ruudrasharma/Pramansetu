# BEL-Chain Task Tracker

## Phase 0 — Repo Hygiene & Infrastructure
- [x] 0.1 — git init at bel-chain/, .gitignore, initial commit
- [x] 0.2 — Copy AI_DEVELOPMENT_RULES.md to repo root
- [x] 0.3 — Remove spurious bracket directories
- [x] 0.4 — npm install + add @openzeppelin/hardhat-upgrades@3.9.1 + dotenv
- [x] 0.5 — Fix hardhat.config.ts: imports + evmVersion: "cancun" (OZ v5 mcopy)
- [x] 0.6 — Add tsconfig.hardhat.json (commonjs/node for ts-node, separate from Next.js)
- [x] 0.7 — Fix package.json scripts: TS_NODE_PROJECT=tsconfig.hardhat.json

## Phase 1 — Contract Compilation & Test Foundation ✅ 79/79 passing
- [x] 1.1 — Fix OZ v5 breaking changes:
  - TimeBoundAccessControl: remove __UUPSUpgradeable_init(), fix hasRole override specifier,
    initialize now sets roleExpiry=type(uint256).max for bootstrap accounts (closes A14/A15)
  - AssetRegistry: remove __UUPSUpgradeable_init()
  - ECDSASignatureVerifier: MessageHashUtils.toEthSignedMessageHash (OZ v5 API)
- [x] 1.2 — Create test/ with 7 Hardhat test suites
  - DIDRegistry.test.ts, CredentialRegistry.test.ts, TimeBoundAccessControl.test.ts
  - AssetRegistry.test.ts, GuardianRecovery.test.ts, GovernanceTimelock.test.ts
  - Upgrade.test.ts (UUPS proxy safety + state preservation)
- [x] 1.3 — All 79 tests passing, 0 failures

## Phase 2 — Contract Bug Fixes (approval required per item)
- [ ] 2.1 — Fix GuardianRecovery.registerGuardians — add controller-only check
          (currently any EOA can register guardians for any DID)
- [ ] 2.2 — Fix CredentialRegistry.revokeCredential — allow Super Admin to revoke
          (currently only the original issuer can revoke — no emergency path)
- [ ] 2.3 — Uncomment credential-gated transfer in AssetRegistry._update
          (currently bypassed — FEATURES.md F3.2 "holder must hold valid credential")
- [ ] 2.4 — Integrate ISignatureVerifier into DIDRegistry (crypto-agility wiring)
          (currently ISignatureVerifier is orphaned — SECURITY.md §6)
- [ ] 2.5 — Fix emergencyRevoke — needs 2-of-N multisig staging (FEATURES.md F2.3)
- [ ] 2.6 — Fix pause()/unpause() — same multisig staging requirement
- [ ] 2.7 — Update API_SPEC.md to match actual contract signatures
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
- [ ] 5.1 — Full Hardhat test suite + coverage report
- [ ] 5.2 — lint + typecheck + build
- [ ] 5.3 — Update CHANGELOG.md + TODO.md
- [ ] 5.4 — Slither static analysis
