# Tech Stack — Praman Setu

## Contracts
| Item | Choice | Version |
|---|---|---|
| Language | Solidity | `0.8.24` |
| Framework | Hardhat | `^2.22.15` |
| Libraries | OpenZeppelin Contracts / Contracts-Upgradeable | `^5.1.0` |
| Patterns used | `AccessControlUpgradeable`, `PausableUpgradeable`, `UUPSUpgradeable`, `ERC721Upgradeable`, `TimelockController` | — |
| Testing | Hardhat + Chai + `@nomicfoundation/hardhat-toolbox` | `^5.0.0` |
| Static analysis | Slither, Mythril | latest |

## Prototype Chain
| Item | Choice |
|---|---|
| Network | Ethereum Sepolia testnet |
| RPC | Alchemy / Infura endpoint |
| Faucet | Ethereum Sepolia public faucet |
| Block explorer | Etherscan (Sepolia) |

## Production Target Chain
| Item | Choice |
|---|---|
| Ledger | Hyperledger Fabric (channel-based privacy) **or** private Polygon Edge consortium network |
| Node operators | BEL + partner PSU validating nodes |
| Rationale | Data-localization + classified-handling compliance a public chain cannot satisfy |

## Frontend
| Item | Choice | Version |
|---|---|---|
| Framework | Next.js (App Router) | `14.2.15` |
| Language | TypeScript | `^5.6.3` |
| Styling | Tailwind CSS | `^3.4.14` |
| Component base | shadcn/ui primitives (heavily customized — see UI_UX_SPEC.md) | — |
| Animation | Framer Motion | `^11.11.9` |
| Icons | Lucide React | `^0.383.0` |
| Command palette | `cmdk` | `^1.0.4` |
| Charts | Recharts | `^2.13.0` |

## Web3 Integration
| Item | Choice | Version |
|---|---|---|
| Wallet/contract hooks | wagmi | `^2.12.29` |
| Low-level EVM client | viem | `^2.21.32` |
| Contract SDK (scripting/tests) | ethers.js | `^6.13.4` |
| Server/query cache | @tanstack/react-query | `^5.59.16` |

## Identity & Credentials
| Item | Choice |
|---|---|
| Identity standard | W3C DID Core |
| DID methods | `did:ethr` (prototype), `did:key`; `did:web` planned for cross-org bridge |
| Credential format | W3C Verifiable Credentials |
| Zero-knowledge layer | Semaphore / snarkjs (prototype) → audited zk-SNARK circuits (production) |

## Off-Chain Infrastructure
| Item | Choice |
|---|---|
| Metadata storage | IPFS via Pinata or Web3.Storage (prototype); IPFS + Filecoin with SLA pinning (production) |
| Indexing | The Graph hosted subgraph (prototype) → self-hosted Graph node (production, data sovereignty) |
| Anomaly detection | TypeScript Next.js API route, rule-based heuristics on indexed events (prototype) → full ML pipeline with SOC integration (production) |
| Oracle | Multi-attestor decentralized oracle design with dispute window |

## Deployment / Infra
| Item | Choice |
|---|---|
| Frontend hosting (prototype) | Vercel |
| Frontend hosting (production) | BEL internal infra |
| CI/CD | GitHub Actions |
| Containerization | Docker (indexer, anomaly service) |
| Secrets | `.env.local` (dev), GitHub Actions encrypted secrets (CI), BEL vault (production) |

## Version Pinning Rationale

All versions above are pinned in `package.json`/`hardhat.config.ts` rather than left as ranges beyond
patch level, because a contract-adjacent codebase should never silently pick up a breaking dependency
change between a hackathon demo and a later audit pass.
