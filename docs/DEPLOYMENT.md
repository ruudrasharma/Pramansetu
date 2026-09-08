# Deployment — Cipherloom

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

1. **Prerequisites**:
   Create a `.env.local` file with the following variables:
   ```env
   DEPLOYER_PRIVATE_KEY=<hardware-wallet-or-test-key>
   ALCHEMY_API_KEY=<key>
   NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=<key>
   ETHERSCAN_API_KEY=<key>
   ```
   Ensure the deployer wallet is funded with Sepolia ETH.

2. **Deploy via Hardhat**:
   ```bash
   npx hardhat run scripts/deploy.ts --network sepolia
   ```
   This deploys the DIDRegistry, CredentialRegistry, TimeBoundAccessControl (proxy), AssetRegistry (proxy), GuardianRecovery, and GovernanceTimelock.
   The script outputs the contract addresses to `deployments/sepolia.json`.

3. **Verify Contracts** (Optional but recommended):
   ```bash
   npx hardhat verify --network sepolia <address> <constructor args>
   ```

## 4. Subgraph Deployment

Once the contracts are deployed, we must deploy the indexer.

1. **Update Addresses**: Copy the contract addresses from `deployments/sepolia.json` into `subgraph/subgraph.yaml`.
2. **Build and Deploy**:
   ```bash
   cd subgraph
   npm install
   npm run codegen
   npm run build
   npx graph auth --studio <GRAPH_DEPLOY_KEY>
   npx graph deploy --studio cipherloom -l v1
   ```

## 5. Post-Deploy Security Checklist

Once the system is live, execute the following steps to secure the platform (as detailed in the `deploy.ts` script output):

1. **Enroll second SUPER_ADMIN hardware wallet**: Propose and execute a `PlatformAction` via the `GovernanceTimelock` to add a second admin for redundancy.
2. **Revoke deployer SUPER_ADMIN**: For maximum security, use a co-signed platform action to revoke the original deployer's `SUPER_ADMIN_ROLE`.
3. **Set Signature Verifier**: Deploy the `ECDSASignatureVerifier` and call `DIDRegistry.setSignatureVerifier(verifier_address)` to enable cryptographic proof verification on Key Rotations.
4. **Grant ISSUER_ROLE**: Grant the `ISSUER_ROLE` in the `TimeBoundAccessControl` contract to the `CredentialRegistry` contract to enable automated verification pathways.

## 6. Frontend Deployment

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
