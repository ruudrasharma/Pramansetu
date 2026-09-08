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

## Phase 2 — Contract Bug Fixes ✅ 86/86 tests passing
- [x] 2.1 — Fix GuardianRecovery.registerGuardians — controller-only check (audit A3)
          DIDRegistry.resolveDID called; NotController revert if msg.sender ≠ doc.controller
- [x] 2.2 — Fix CredentialRegistry.revokeCredential — allow DEFAULT_ADMIN_ROLE emergency path (A5)
- [x] 2.3 — Credential-gated transfer in AssetRegistry._update (FEATURES.md F3.2, audit A7)
          recipientDid param repurposed as vcId; vcIdOf[tokenId] stored at mint; _minting flag
          bypasses check during _safeMint; revoked/expired VC → RecipientCredentialInvalid
- [x] 2.4 — ISignatureVerifier wired into DIDRegistry (SECURITY.md §6, audit A8)
          rotateKey now takes proof bytes; setSignatureVerifier; zero addr = skip (migration window)
          rotateKey now updates controller to keccak256(newPubKey)-derived address
- [x] 2.5 — emergencyRevoke replaced by proposePlatformAction(1,...)+coSignPlatformAction (A9)
- [x] 2.6 — pause/unpause replaced by proposePlatformAction(2/3,...)+coSignPlatformAction (A10)
- [x] 2.7 — API_SPEC.md updated to match Phase 2 contract signatures
- [x] 2.8 — DATABASE_SCHEMA.md updated (controllerOf → didOf, all structs corrected)

## Phase 3 — Frontend Foundation ✅ 0 TS errors · build ✓ (9/9 pages)
- [x] 3.1 — WagmiProvider + QueryClientProvider in layout.tsx
          Web3Providers.tsx wrapper ('use client'); QueryClient created in useState
          (prevents cross-request cache leakage in Next.js App Router)
- [x] 3.2 — lib/abis/ — typed ABI exports from all 6 Hardhat artifacts
          DIDRegistryAbi, CredentialRegistryAbi, TimeBoundAccessControlAbi,
          AssetRegistryAbi, GuardianRecoveryAbi, GovernanceTimelockAbi
          (import from lib/abis/ not artifacts/ — swap point for viem codegen)
- [x] 3.3 — ⌘K Command Palette (cmdk) — CommandPalette.tsx
          Groups: Navigate · Identity · Access Control · Assets · Governance
          Fuzzy search across label + description + keywords
          Opens via ⌘K/Ctrl+K shortcut AND ContextBar button (commandPaletteSignal)
          Backdrop is blurred, not opaque — spec: "content stays visible"
- [x] 3.4 — Slide-in Detail Panel — DetailPanel.tsx + DetailPanelContext.tsx
          Spring animation (stiffness 300, damping 28) from right edge
          Semi-transparent backdrop; primary content fully visible underneath
          Shows: event type badge, summary, actor DID (copyable), tx hash, timestamp
          Etherscan link in footer; keyboard accessible
- [x] 3.5 — Live ledger stream animation — AnimatePresence on Overview page
          Each event: upward slide y=-12 + fade, spring stiffness 300 damping 30
          "Simulate" button demonstrates live event arrival without RPC
          Clicking any event row opens DetailPanel
          Health cards animate in on mount
          next.config.js: webpack stubs for @x402/* and @coinbase/cdp-sdk
          tsconfig.json: excludes test/, scripts/, typechain-types/

## Phase 4 — Wire Live Data
- [ ] 4.1 — Deploy contracts to Ethereum Sepolia
- [ ] 4.2 — Replace mock-data with wagmi hooks
- [ ] 4.3 — Stand up subgraph, wire into frontend

## Phase 5 — Verification & Polish
- [ ] 5.1 — Full Hardhat test suite + coverage report
- [ ] 5.2 — lint + typecheck + build
- [ ] 5.3 — Update CHANGELOG.md + TODO.md
- [ ] 5.4 — Slither static analysis
