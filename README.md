# Cipherloom — Blockchain-Based Secure Platform for Identity, Access Control & Digital Asset Management

**SIH 2026 · Problem Statement 26125 · Bharat Electronics Limited (BEL) · Theme: Blockchain & Cybersecurity**

A five-module platform that replaces centralized IAM with on-chain Decentralized Identity (DID), enforces
Role-Based Access Control inside smart contracts (not application code), tracks organizational digital assets as
NFTs with dual-attestation minting, maintains an immutable AI-monitored audit trail, and governs itself through
multi-signature approval and a time-locked dispute-resolution process.

This repo is a hackathon prototype deployed on a public EVM testnet, engineered with an explicit, documented
migration path to a permissioned consortium chain (Hyperledger Fabric / Polygon Edge) for BEL's actual
defense-sector production environment.

## Why this exists

PS 26125 names four problems: centralized IAM as a single point of failure, vulnerability to identity theft,
unauthorized access, and disconnected/unverifiable asset ownership. Our team went further and mapped every
architectural flaw those four problems create once you actually build the obvious solution — admin-key
compromise, key-loss lockout, irreversible contract bugs, oracle trust gaps, legal-enforceability limits of NFTs,
and the long-horizon risk of quantum computers breaking ECDSA. Full analysis: [`Problem_Gap_Analysis.pdf`](./original-docs/Problem_Gap_Analysis.pdf).
Full engineered response: [`Complete_Solution_Document.pdf`](./original-docs/Complete_Solution_Document.pdf).

## Module Map

| Module | Solves |
|---|---|
| **M1 — Decentralized Identity & Credentials** | Centralized IAM risk, identity theft, key loss, Sybil attacks, privacy leakage |
| **M2 — Smart-Contract RBAC Engine** | Unauthorized access, admin key compromise, instant revocation, contract bugs |
| **M3 — NFT Asset Registry** | Disconnected ownership records, authenticity, metadata rot, legal enforceability |
| **M4 — Immutable Audit Trail + Anomaly Detection** | Transparency, tamper-proof history, real-time misuse detection |
| **M5 — Multi-Sig Governance & Dispute Resolution** | "Who watches the admin," irreversible fraud, single point of trust |

Deep detail on each module lives in [`FEATURES.md`](./FEATURES.md) and [`ARCHITECTURE.md`](./ARCHITECTURE.md).

## Tech Stack (short version — full detail in [`TECH_STACK.md`](./TECH_STACK.md))

- **Contracts:** Solidity 0.8.x, OpenZeppelin (AccessControl, Pausable, UUPS Proxy, ERC-721), Hardhat
- **Chain (prototype):** Ethereum Sepolia testnet
- **Chain (production target):** Hyperledger Fabric or permissioned Polygon Edge
- **Frontend:** Next.js 14 (App Router) + TypeScript + Tailwind CSS + Framer Motion + shadcn/ui (customized)
- **Web3 layer:** wagmi + viem + ethers.js
- **Identity standard:** W3C DID Core + Verifiable Credentials (`did:ethr` / `did:key`)
- **Off-chain storage:** IPFS via Pinata/Web3.Storage
- **Indexing:** The Graph subgraph
- **ZK layer:** Semaphore (proof-of-role without identity reveal)

## Repository Structure

```
Cipherloom/
├── docs/                     # this documentation set
├── contracts/                # Solidity source (DID, RBAC, NFT, Governance, Recovery)
│   ├── DIDRegistry.sol
│   ├── CredentialRegistry.sol
│   ├── TimeBoundAccessControl.sol
│   ├── AssetRegistry.sol
│   ├── GuardianRecovery.sol
│   ├── GovernanceTimelock.sol
│   └── interfaces/ISignatureVerifier.sol
├── app/                       # Next.js App Router pages
│   ├── layout.tsx
│   ├── page.tsx               # Overview / Ledger stream
│   ├── identity/page.tsx
│   ├── access-control/page.tsx
│   ├── assets/page.tsx
│   ├── governance/page.tsx
│   └── audit/page.tsx
├── components/
│   ├── shell/                 # CommandRail, TopBar, CommandPalette
│   ├── ui/                    # customized design-system primitives
│   └── modules/                # per-module widgets (RoleExpiryRing, MintFlow, etc.)
├── lib/                        # utils, mock data, wagmi config, contract ABIs
├── scripts/deploy.ts
├── hardhat.config.ts
├── package.json
└── tailwind.config.ts
```

## Getting Started

```bash
# 1. Install dependencies
npm install

# 2. Copy environment template and fill in values — see ENVIRONMENT.md
cp .env.example .env.local

# 3. Compile contracts
npm run compile:contracts

# 4. Run contract tests
npm run test:contracts

# 5. Deploy to Ethereum Sepolia testnet
npm run deploy:testnet

# 6. Run the frontend
npm run dev
# → http://localhost:3000
```

## Documentation Index

| Doc | Purpose |
|---|---|
| [PRD.md](./docs/PRD.md) | Product requirements & feature scope |
| [ARCHITECTURE.md](./docs/ARCHITECTURE.md) | System layers, data flow, service boundaries |
| [UI_UX_SPEC.md](./docs/UI_UX_SPEC.md) | Design system, screens, layout, motion |
| [DATABASE_SCHEMA.md](./docs/DATABASE_SCHEMA.md) | On-chain state layout + off-chain indexer schema |
| [API_SPEC.md](./docs/API_SPEC.md) | Contract ABIs as endpoints, REST indexer API, auth |
| [SECURITY.md](./docs/SECURITY.md) | Threat model, auth, encryption, mitigations |
| [TECH_STACK.md](./docs/TECH_STACK.md) | Exact versions and infra |
| [USER_FLOWS.md](./docs/USER_FLOWS.md) | Step-by-step journeys per role |
| [FEATURES.md](./docs/FEATURES.md) | Feature-by-feature spec per module |
| [ENVIRONMENT.md](./docs/ENVIRONMENT.md) | .env variables & deployment config |
| [TESTING.md](./docs/TESTING.md) | Unit/integration/E2E/security testing plan |
| [DEPLOYMENT.md](./docs/DEPLOYMENT.md) | Build, Docker, CI/CD, production rollout |
| [CHANGELOG.md](./docs/CHANGELOG.md) | Dated log of completed work |
| [TODO.md](./docs/TODO.md) | Open items, bugs, roadmap |

## Git Workflow

This repo is committed after every meaningful change so the SIH team has a restorable history through the
build and demo phases:

```bash
git add -A
git commit -m "fix: <what was fixed> / feat: <what was added>"
git push origin main
```

See [DEPLOYMENT.md](./DEPLOYMENT.md) for the branching model and CI pipeline.
