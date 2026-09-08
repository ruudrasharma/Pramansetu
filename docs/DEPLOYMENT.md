# Deployment — BEL Chain

## 1. Branching Model

- `main` — always demo-ready; protected, requires CI pass + 1 review.
- `dev` — integration branch for in-progress feature work.
- `feat/<name>`, `fix/<name>` — short-lived branches off `dev`.

Commit convention (used after every change, per project instruction):
```
feat: <what was added>
fix: <what was fixed>
docs: <doc change>
chore: <tooling/infra change>
```

## 2. Local Build

```bash
npm install
npm run compile:contracts     # hardhat compile
npm run test:contracts        # hardhat test
npm run build                 # next build
npm run start                 # next start (production mode, local)
```

## 3. Contract Deployment (Testnet)

```bash
# hardhat.config.ts already targets Ethereum Sepolia — see ENVIRONMENT.md
npm run deploy:testnet
# → deploys DIDRegistry, CredentialRegistry, TimeBoundAccessControl (proxy),
#   AssetRegistry (proxy), GuardianRecovery, GovernanceTimelock
# → writes addresses to deployments/sepolia.json
# → copy addresses into .env.local (NEXT_PUBLIC_*_ADDRESS vars)
npx hardhat verify --network sepolia <address> <constructor args>
```

## 4. Subgraph Deployment

```bash
cd subgraph
graph codegen && graph build
graph deploy --studio bel-chain-idam   # prototype: hosted service
# production: graph deploy --node http://<self-hosted-graph-node>:8020 bel-chain-idam
```

## 5. Frontend Deployment

**Prototype (Vercel):**
```bash
vercel link
vercel env pull .env.local
vercel --prod
```

**Production (BEL internal infra):** containerized deployment —

```dockerfile
# Dockerfile (frontend)
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/public ./public
EXPOSE 3000
CMD ["npm", "run", "start"]
```

```bash
docker build -t bel-chain-frontend .
docker run -p 3000:3000 --env-file .env.production bel-chain-frontend
```

## 6. CI/CD Pipeline (GitHub Actions)

```yaml
name: ci
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - run: npm run typecheck
      - run: npm run lint
      - run: npm run compile:contracts
      - run: npm run test:contracts
      - run: npx playwright install --with-deps && npm run test:e2e
  deploy:
    needs: test
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npx vercel --prod --token=${{ secrets.VERCEL_TOKEN }}
```

## 7. Phased Rollout

| Phase | Scope |
|---|---|
| **Phase 1 — Hackathon MVP** | DID registry, VC issuance, time-bound RBAC, ERC-721 minting with dual attestation, basic audit dashboard, testnet deployment |
| **Phase 2 — Pilot Hardening** | Multisig governance, timelock dispute resolution, guardian recovery, IPFS metadata pipeline, external contract audit |
| **Phase 3 — Production Migration** | Permissioned chain deployment, L2 scaling, self-hosted indexing, full AI anomaly-detection service, ZK privacy layer |
| **Phase 4 — Forward-Looking** | Post-quantum signature migration activated, legal-tech bridge integration, cross-organization DID interoperability |

## 8. Rollback Plan

- Contracts: UUPS proxies allow logic rollback to the previous implementation via the same governed
  upgrade path — no state loss.
- Frontend: Vercel/Docker image rollback to previous tagged release.
- Indexer: subgraph redeploy from any prior commit — always safely re-derivable from raw chain data.
