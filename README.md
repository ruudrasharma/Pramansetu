# Praman Setu — Blockchain-Based Secure Platform for Identity, Access Control & Digital Asset Management

**Made by Team Crypto Nova**

**Smart India Hackathon 2026 · Problem Statement 26125 · Bharat Electronics Limited (BEL) · Theme: Blockchain & Cybersecurity**

Praman Setu is a comprehensive five-module blockchain platform designed to replace centralized IAM with on-chain Decentralized Identity (DID). It enforces Role-Based Access Control inside smart contracts, tracks organizational digital assets as NFTs with dual-attestation minting, maintains an immutable audit trail with rule-based anomaly detection, and governs itself through multi-signature approval and a time-locked dispute-resolution process.

---

## 1. The Problem

The traditional Identity and Access Management (IAM) infrastructure in large defense organizations faces significant challenges:

### Explicitly Stated Problems (PS 26125)
- **Centralized Single Point of Failure:** Traditional databases are highly vulnerable; if the central server goes down, the entire organization's verification is halted.
- **Identity Theft & Cyberattacks:** Centralized credential stores (like password databases) are high-value targets.
- **Unauthorized Access:** Manual permissions are often bypassed or misconfigured.
- **Disconnected Asset Ownership:** Ownership history lives in silos (spreadsheets, disjointed DBs).
- **Verification Difficulty:** Authenticity cannot be cryptographically proven across systems.

### Deeper Architectural Flaws (Our Gap Analysis)
Beyond the stated problems, our gap analysis identified critical vulnerabilities inherent in standard IAM and naive blockchain implementations:
- **Private Key Loss = Permanent Lockout:** In typical web3 architectures, losing a key means losing identity forever.
- **Sybil Attacks:** Users could generate multiple DIDs to manipulate access.
- **Admin Key Compromise:** If an Admin's key is compromised, it results in a full system takeover with no lockout mechanism.
- **Lack of Dispute Resolution:** Fraudulent but validly-signed transactions are immutable on standard blockchains.
- **Future Threats:** Standard ECDSA cryptography is provably breakable by upcoming quantum computers (Shor's algorithm).

---

## 2. The Complete Solution

To address every single vulnerability, Team Crypto Nova built **Praman Setu** around five fully engineered modules:

### **Module 1 — Decentralized Identity (DID) & Credentials**
Replaces centralized user databases entirely. Every user is a DID, and real-world trust is established through Verifiable Credentials (VCs).
- **Guardian-Based Social Recovery:** Mitigates key loss. 3-of-5 trusted guardians can rotate a user's compromised key without compromising the user's DID.
- **Sybil Resistance:** DIDs are useless without an organization-issued Verifiable Credential confirming real-world HR onboarding.

### **Module 2 — Smart-Contract-Governed RBAC Engine**
Access control is enforced mathematically inside the smart contract, not by application logic.
- **Time-bound Expiries:** Roles carry exact expiry timestamps, enabling instant revocation instead of waiting for block latencies.
- **Emergency Pause:** Super Admins can freeze the entire contract immediately if an exploit or compromise is detected.

### **Module 3 — NFT-Based Digital Asset Registry**
Every digital asset, license, and credential is an ERC-721 NFT directly linked to the owning DID.
- **Dual-Attestation Minting:** Prevents unauthorized minting of physical assets. Two independent roles (e.g. Admin + Auditor) must co-sign before an asset is minted.
- **IPFS Metadata:** Asset metadata is content-addressed, guaranteeing immunity to metadata rot.

### **Module 4 — Immutable Audit Trail & Anomaly Detection**
Every state-changing function emits structured events. 
- **Graph Indexing:** All transactions are indexed by The Graph for a fully decentralized, queryable dashboard.
- **Rule-Based Anomaly Detection:** Real-time heuristics (mint/role-grant velocity, emergency-pause detection) over the indexed event stream flag suspicious patterns as risk-scored alerts. A full ML pipeline is a Phase 3 production-roadmap item, not shipped in this build (see `docs/PRD.md` Non-Goals).

### **Module 5 — Multi-Signature Governance & Dispute Resolution**
Solves the "Who watches the Admin?" problem.
- **Multi-sig Timelocks:** High-value actions require M-of-N multisig approvals and pass through a time-locked cooling-off period. During this window, an Auditor can dispute and reverse fraudulent transactions before they finalize.

---

## 3. Technology Stack & Architecture

Built with a crypto-agile, layered architecture ensuring future-proof scalability and compliance.

- **Contracts:** Solidity 0.8.x, OpenZeppelin (AccessControl, Pausable, UUPS Proxy, ERC-721), Hardhat
- **Chain (Prototype):** Ethereum Sepolia testnet
- **Chain (Production Target):** Hyperledger Fabric / Permissioned Polygon Edge (for strict defense-sector data localization)
- **Frontend:** Next.js 14 (App Router) + TypeScript + Tailwind CSS + Framer Motion
- **Web3 Layer:** wagmi + viem + ethers.js
- **Identity Standard:** W3C DID Core + Verifiable Credentials (`did:ethr` / `did:key`)
- **Off-chain Storage:** IPFS via Pinata/Web3.Storage
- **Indexing:** The Graph subgraph
- **ZK Layer:** Semaphore (proof-of-role without identity reveal)
- **Quantum Resistance (Roadmap):** Pluggable ISignatureVerifier interface designed to seamlessly swap ECDSA for NIST-standardized post-quantum schemes (Dilithium) in the future.

---

## 4. Getting Started

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

## 5. Documentation Index

For exhaustive implementation details, workflows, and specifications, refer to our detailed documentation:

| Doc | Purpose |
|---|---|
| [Problem Gap Analysis](./Problem_Gap_Analysis.pdf) | In-depth breakdown of stated, unstated, and future-facing threats |
| [Complete Solution Document](./Complete_Solution_Document.pdf) | Full system architecture and solution mapping |
| [PRD.md](./docs/PRD.md) | Product requirements & feature scope |
| [ARCHITECTURE.md](./docs/ARCHITECTURE.md) | System layers, data flow, service boundaries |
| [UI_UX_SPEC.md](./docs/UI_UX_SPEC.md) | Design system, screens, layout, motion |
| [DATABASE_SCHEMA.md](./docs/DATABASE_SCHEMA.md) | On-chain state layout + off-chain indexer schema |
| [API_SPEC.md](./docs/API_SPEC.md) | Contract ABIs as endpoints, subgraph GraphQL data access, auth |
| [SECURITY.md](./docs/SECURITY.md) | Threat model, auth, encryption, mitigations |
| [TECH_STACK.md](./docs/TECH_STACK.md) | Exact versions and infra |
| [USER_FLOWS.md](./docs/USER_FLOWS.md) | Step-by-step journeys per role |
| [FEATURES.md](./docs/FEATURES.md) | Feature-by-feature spec per module |
| [ENVIRONMENT.md](./docs/ENVIRONMENT.md) | `.env` variables & deployment config |
| [TESTING.md](./docs/TESTING.md) | Unit/integration/E2E/security testing plan |
| [DEPLOYMENT.md](./docs/DEPLOYMENT.md) | Build, Docker, CI/CD, production rollout |
| [CHANGELOG.md](./CHANGELOG.md) | Dated log of completed work |
| [TODO.md](./TODO.md) | Open items, bugs, roadmap |

## 6. License
This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
