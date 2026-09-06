# Architecture — BEL Chain

## 1. Layered System

```
┌───────────────────────────────────────────────────────────┐
│ LAYER 4 — Application / UI                                 │
│ Next.js App Router · User Portal · Admin Console            │
│ Auditor Dashboard · Wallet Connect (wagmi/viem)              │
└───────────────────────────────────────────────────────────┘
        ▲ ▼  REST (indexer) / JSON-RPC / Wallet SDK
┌───────────────────────────────────────────────────────────┐
│ LAYER 3 — Off-Chain Services                                │
│ Indexer (The Graph subgraph) · Anomaly Detection service     │
│ Oracle node (multi-attestor) · IPFS/Filecoin metadata store   │
│ Guardian Recovery coordination service                       │
└───────────────────────────────────────────────────────────┘
        ▲ ▼  Web3 calls / on-chain events
┌───────────────────────────────────────────────────────────┐
│ LAYER 2 — Smart Contract Layer (trust core)                  │
│ DIDRegistry · CredentialRegistry · TimeBoundAccessControl     │
│ AssetRegistry (ERC-721) · GovernanceTimelock (multisig)        │
│ GuardianRecovery · Pausable emergency stop · UUPS proxies      │
└───────────────────────────────────────────────────────────┘
        ▲ ▼
┌───────────────────────────────────────────────────────────┐
│ LAYER 1 — Ledger / Consensus                                  │
│ Prototype: Polygon Amoy / Ethereum Sepolia (public testnet)    │
│ Production: Hyperledger Fabric or private Polygon Edge          │
└───────────────────────────────────────────────────────────┘
```

Each layer only talks to the layer directly adjacent to it. This is what lets Layer 1 be swapped
(public testnet → permissioned chain) during the production migration without touching Layers 2–4.

## 2. Crypto-Agility Principle

No contract calls `ecrecover()` inline. Every signature check routes through `ISignatureVerifier`.
DID Documents carry a `keyType` field (`"ES256K"` today) alongside the public key. This is the single
design decision that makes Section 11 (post-quantum migration) possible without rewriting the identity
graph — see [SECURITY.md §6](./SECURITY.md).

## 3. Component Responsibilities

| Component | Responsibility | Talks To |
|---|---|---|
| `DIDRegistry.sol` | Create/resolve DID documents, rotate keys | `GuardianRecovery`, frontend wallet SDK |
| `CredentialRegistry.sol` | Issue/revoke VC hash + revocation status | `TimeBoundAccessControl`, `AssetRegistry` |
| `TimeBoundAccessControl.sol` | RBAC with per-(DID,role) expiry, multisig-gated grants | All modules that check `hasRole()` |
| `AssetRegistry.sol` | ERC-721 mint/transfer with dual attestation | IPFS (metadata), `CredentialRegistry` |
| `GuardianRecovery.sol` | M-of-N key-rotation recovery flow | `DIDRegistry` |
| `GovernanceTimelock.sol` | Multisig + timelock + dispute veto | All privileged calls across modules |
| The Graph subgraph | Index all contract events into queryable API | Auditor Dashboard, Anomaly Detection |
| Anomaly Detection service | Rule-based + lightweight ML on indexed events | Subgraph → Admin/Auditor alert feed |
| IPFS/Pinata | Content-addressed metadata storage | `AssetRegistry` (CID reference only) |

## 4. Data Flow — Example: Minting an Asset

```
Admin (UI) → uploads metadata to IPFS → gets CID
Admin (UI) → AssetRegistry.proposeMint(CID, recipientDID)   [tx 1]
Manager (UI) → AssetRegistry.coSignMint(requestId)          [tx 2]
   └─ contract auto-executes mint() once both signatures present
   └─ emits AssetMinted(tokenId, recipientDID, cidHash, timestamp)
Subgraph → indexes AssetMinted event within next block
Auditor Dashboard → live-updates via subgraph query (no polling of raw chain needed)
Anomaly service → checks mint velocity against rolling baseline → emits risk score if anomalous
```

## 5. Frontend Architecture (Layer 4 detail)

- **Framework:** Next.js 14 App Router, React Server Components for static shell, Client Components for
  wallet-connected/interactive views.
- **State:** wagmi hooks for on-chain reads/writes + React Query cache; local UI state via React state/Zustand-free
  (kept minimal — this app is data-driven, not app-state-heavy).
- **Design system:** see [UI_UX_SPEC.md](./UI_UX_SPEC.md) — a custom "control deck" layout, not a
  sidebar+topbar template.
- **Routing:**
  - `/` — Overview: live ledger stream + system health
  - `/identity` — DID directory, credential issuance, guardian recovery management
  - `/access-control` — Role matrix, time-bound grants, expiry countdown
  - `/assets` — NFT registry, mint flow (dual attestation), provenance viewer
  - `/governance` — Multisig queue, timelock disputes, emergency pause control
  - `/audit` — Immutable event stream, anomaly alerts, exportable reports

## 6. Deployment Topology

| Environment | Ledger | Frontend Host | Indexer |
|---|---|---|---|
| Local dev | Hardhat local network | `next dev` | Local Graph node (docker) |
| Hackathon demo | Polygon Amoy testnet | Vercel | Hosted Graph service |
| Production (BEL) | Hyperledger Fabric / private Polygon Edge | BEL internal infra | Self-hosted Graph node |

Full detail in [DEPLOYMENT.md](./DEPLOYMENT.md).
