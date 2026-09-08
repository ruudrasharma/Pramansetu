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

---

## 🟡 High Priority — Development

### T-005: Wire `lib/hooks/` into live UI pages
Replace `mock-data.ts` reads with real `useReadContract` calls now that hooks exist.
Files to update:
- `app/page.tsx` → `useHasRole`, `usePlatformPaused`, subgraph `AuditEvent` query
- `app/identity/page.tsx` → `useResolveDID`, `useDIDOf`
- `app/access-control/page.tsx` → `useHasRole`, `useRoleExpiry`
- `app/assets/page.tsx` → `useTokenURI`, `useVcIdOf`, `useOwnerOf`
- `app/governance/page.tsx` → `useQueuedTx`, `useNextTxId`
- `app/audit/page.tsx` → subgraph `AuditEvent` query

### T-006: ECDSASignatureVerifier test coverage
Currently 0% (the contract exists but tests need live ECDSA signatures).
Add a Hardhat test using `ethers.signMessage` to exercise `verify()`.

### T-007: WalletConnect modal
`lib/wagmi.ts` includes the `walletConnect` connector but the modal
(`@web3modal/wagmi` or `rainbowkit`) is not yet wired into `Web3Providers.tsx`.

### T-008: Subgraph `roleExpiry` value
`access-control.ts` mapping sets `grant.validUntil = BigInt.fromI32(0)` as a placeholder.
Fix: call `TimeBoundAccessControl.roleExpiry(role, account)` via eth_call in the mapping
or read it from the `TimedRoleGranted` event parameters once that event is emitted.

---

## 🟢 Medium Priority — Polish & Robustness

### T-009: Anomaly detection service integration
`GET /audit/anomalies` (see API_SPEC.md §2) is a computed layer.
Wire it into the Audit page `AnomalyAlerts` card as a real API call
with a clear "⚠ NOT from chain" disclaimer (UI_UX_SPEC §2.6).

### T-010: IPFS upload flow for asset CIDs
`useProposeMint` takes a `cid` string. Add a `lib/ipfs.ts` helper
using Pinata (`PINATA_API_KEY` / `PINATA_SECRET_API_KEY`) to upload
the asset metadata JSON and return the CID before calling `proposeMint`.

### T-011: Role-based UI gates
Use `useHasRole` to show/hide action buttons per the connected wallet's role.
Prevents showing "Propose Mint" to users without ADMIN_ROLE.

### T-012: Pagination in ledger stream
The `app/page.tsx` ledger is currently capped at 30 mock events.
Once wired to TheGraph, implement cursor-based pagination using
`AuditEvent(orderBy: timestamp, orderDirection: desc, first: 20, after: $cursor)`.

### T-013: KeyRotation event type in EventType union
`lib/mock-data.ts` and `EventRow.tsx` don't have a "KeyRotated" event type yet.
Add it when wiring DIDRegistry real data.

### T-014: docs/DEPLOYMENT.md
Create a step-by-step deployment runbook documenting T-001 through T-004 for
the BEL operations team. Reference the post-deploy checklist from `deploy.ts`.

---

## ✅ Completed (see CHANGELOG.md for details)

- Phase 1: Contract scaffold, Hardhat environment, mock data, frontend shell
- Phase 2: OZ v5 migration, full contract hardening, 86/86 tests, SECURITY.md
- Phase 3: Web3Providers, ABI exports, ⌘K palette, detail panel, ledger animation
- Phase 4: Production deploy script, wagmi hooks layer, TheGraph subgraph scaffold
- Phase 5: Coverage report (94% stmts, 83.5% branches), ESLint clean, Slither audit
