# TODO — Cipherloom (SIH 2026, PS 26125)

This file tracks outstanding work ordered by priority.
Completed items are moved to CHANGELOG.md.

---

## 🔴 Blocker — Needs Credentials / Infrastructure

### T-001: Fund deployer wallet + populate `.env.local`
```
DEPLOYER_PRIVATE_KEY=<hardware-wallet-or-test-key>
ALCHEMY_API_KEY=<key>
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=<key>
ETHERSCAN_API_KEY=<polygonscan-key>
```
Blocked on: key provisioning by BEL team.

### T-002: Deploy to Ethereum Sepolia
```bash
npx hardhat run scripts/deploy.ts --network sepolia
```
Output: `deployments/sepolia.json` → copy addresses to `.env.local`.
After: run `T-003`.

### T-003: Fill subgraph addresses + deploy to Graph Studio
1. Copy contract addresses from `deployments/sepolia.json` to `subgraph/subgraph.yaml`
2. `cd subgraph && npm install && npm run codegen && npm run build`
3. `npm run deploy:studio` (requires `GRAPH_DEPLOY_KEY`)

### T-004: Post-deploy security checklist (from deploy.ts output)
1. Enroll second SUPER_ADMIN hardware wallet via `proposePlatformAction`
2. Revoke deployer SUPER_ADMIN via co-signed platform action
3. Deploy `ECDSASignatureVerifier` and call `DIDRegistry.setSignatureVerifier(addr)`
4. Grant `ISSUER_ROLE` to the CredentialRegistry issuer address

### T-007: WalletConnect modal
`lib/wagmi.ts` includes the `walletConnect` connector but the modal
(`@web3modal/wagmi` or `rainbowkit`) is not yet wired into `Web3Providers.tsx`.

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
