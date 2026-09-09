# Environment Configuration — Praman Setu

## .env.example

```bash
# ── Chain / RPC ──────────────────────────────────────────────
NEXT_PUBLIC_CHAIN_ID=11155111                    # Ethereum Sepolia testnet
NEXT_PUBLIC_SEPOLIA_RPC_URL=                     # Your Alchemy/Infura Sepolia RPC URL
DEPLOYER_PRIVATE_KEY=                            # NEVER commit — deployer wallet for Hardhat scripts
ALCHEMY_API_KEY=
ETHERSCAN_API_KEY=                               # for contract verification (Etherscan Sepolia)

# ── Deployed Contract Addresses (filled after deploy:testnet) ─
NEXT_PUBLIC_DID_REGISTRY_ADDRESS=
NEXT_PUBLIC_CREDENTIAL_REGISTRY_ADDRESS=
NEXT_PUBLIC_ACCESS_CONTROL_ADDRESS=
NEXT_PUBLIC_ASSET_REGISTRY_ADDRESS=
NEXT_PUBLIC_GUARDIAN_RECOVERY_ADDRESS=
NEXT_PUBLIC_GOVERNANCE_TIMELOCK_ADDRESS=

# ── WalletConnect / wagmi ──────────────────────────────────────
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=

# ── IPFS / Pinata ───────────────────────────────────────────────
PINATA_API_KEY=                                  # server-only — read by app/api/ipfs/upload/route.ts, never NEXT_PUBLIC_
PINATA_SECRET_API_KEY=
NEXT_PUBLIC_IPFS_GATEWAY=https://gateway.pinata.cloud/ipfs/

# ── Subgraph / Indexer ───────────────────────────────────────────
# The old hosted-service URL format (api.thegraph.com/subgraphs/name/...) has been dead since
# June 2024. Use a real Graph Studio URL once deployed: https://api.studio.thegraph.com/query/<id>/<name>/<version>
NEXT_PUBLIC_SUBGRAPH_URL=
GRAPH_DEPLOY_KEY=

# ── Anomaly Detection Service ─────────────────────────────────────
ANOMALY_SERVICE_URL=http://localhost:8090
ANOMALY_SERVICE_API_KEY=

# ── App ────────────────────────────────────────────────────────────
NEXT_PUBLIC_APP_ENV=development                  # development | staging | production
```

## Variable Notes

| Variable | Required For | Notes |
|---|---|---|
| `DEPLOYER_PRIVATE_KEY` | Contract deployment only | Never used client-side; never committed; use a dedicated deploy wallet, not a personal one |
| `NEXT_PUBLIC_*` | Frontend | Anything prefixed `NEXT_PUBLIC_` is bundled into client JS — never put secrets here |
| `PINATA_API_KEY` / secret | Server-side IPFS upload route only | Called from a Next.js API route, never the browser |
| `GRAPH_DEPLOY_KEY` | CI subgraph deployment | GitHub Actions secret only |
| `ANOMALY_SERVICE_API_KEY` | Server-to-server call from Next.js to the Python anomaly service | Not exposed to browser |

## Per-Environment Config

| Env | Chain | Frontend Host | Indexer |
|---|---|---|---|
| `development` | Hardhat local node (`localhost:8545`) | `next dev` | local Graph node (docker-compose) |
| `staging` (hackathon demo) | Ethereum Sepolia testnet | Vercel preview | hosted subgraph |
| `production` | Permissioned Hyperledger Fabric / Polygon Edge | BEL internal infra | self-hosted Graph node |

## Secrets Management

- **Local dev:** `.env.local`, gitignored.
- **CI (GitHub Actions):** repository encrypted secrets, injected at build/deploy step only.
- **Production:** BEL's internal secrets vault; `DEPLOYER_PRIVATE_KEY` equivalent should be a
  hardware-backed multisig signer key for production deploys, never a raw env var.
