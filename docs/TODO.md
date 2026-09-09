# TODO — Cipherloom (SIH 2026, PS 26125)

This file tracks outstanding work ordered by priority.
Completed items are moved to CHANGELOG.md.

---

## 🔴 Blocker — Needs Your Decision

### T-017: Unidentified address holds live SUPER_ADMIN_ROLE on the deployed contract
`0x40e020ea754620900bd72c3dac61ef35030497e7` currently holds `SUPER_ADMIN_ROLE` on the real
deployed `TimeBoundAccessControl` (verified on-chain — see `deployments/sepolia.json`'s two real
tracked admins for comparison, neither of which is this address). It's not in `deployments/sepolia.json`,
not in any `.env` file, and not referenced anywhere else in the repo. If this isn't a wallet you
control, it needs to be revoked before Phase 2 (team onboarding) — an untracked Super Admin
breaks the "2-of-N, no single actor" guarantee the whole governance model depends on. This is an
access-control change (`AI_DEVELOPMENT_RULES.md` §9) and needs explicit sign-off before anyone
acts on it.

### T-018: Deployer wallet still holds DEFAULT_ADMIN_ROLE
`scripts/postDeploySetup.ts` revokes the deployer's `SUPER_ADMIN_ROLE` via a co-signed platform
action, but not `DEFAULT_ADMIN_ROLE` (OpenZeppelin's base role, which can grant/revoke any role —
including re-granting itself `SUPER_ADMIN_ROLE` unilaterally). Verified on-chain: deployer
currently has `DEFAULT_ADMIN_ROLE: true`. The "deployer's privileged access was revoked" checklist
item is therefore not actually true yet. Needs a decision on how to close this (e.g. have the two
real Super Admins propose+co-sign revoking it now that both exist) — access-control change,
needs sign-off.

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
  deployed and wired into `DIDRegistry`, `ISSUER_ROLE` granted — all confirmed via live `hasRole`/
  `signatureVerifier()` calls. (Deployer's `SUPER_ADMIN_ROLE` revocation is real and confirmed; see
  T-018 above for what's still incomplete about that step.)
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
