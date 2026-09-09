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

This is the exact runbook actually followed for the live deployment currently in `deployments/sepolia.json` (2026-09-09) — not a generic template.

1. **Prerequisites** — `.env.local` populated with:
   ```env
   DEPLOYER_PRIVATE_KEY=<funded Sepolia test key>
   NEXT_PUBLIC_SEPOLIA_RPC_URL=<Alchemy/Infura Sepolia URL>
   ALCHEMY_API_KEY=<key>
   NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=<key>
   GRAPH_DEPLOY_KEY=<key>
   ```
   Deployer wallet funded with Sepolia ETH (a full 6-contract deploy + post-deploy setup costs well under 0.1 ETH on Sepolia).

2. **Deploy via Hardhat**:
   ```bash
   TS_NODE_PROJECT=tsconfig.hardhat.json npx hardhat run scripts/deploy.ts --network sepolia
   ```
   Deploys DIDRegistry, CredentialRegistry, TimeBoundAccessControl (UUPS proxy), AssetRegistry (UUPS proxy), GuardianRecovery, GovernanceTimelock, and writes addresses to `deployments/sepolia.json`.
   Etherscan verification is attempted automatically but is non-fatal if `ETHERSCAN_API_KEY` isn't set (it currently isn't — contracts are deployed and functional, just not source-verified on Etherscan yet).

3. **Post-deploy setup** — run immediately after, same session:
   ```bash
   TS_NODE_PROJECT=tsconfig.hardhat.json npx hardhat run scripts/postDeploySetup.ts --network sepolia
   ```
   This single script does the entire post-deploy checklist below — do **not** perform any of these steps manually/separately in between. Doing so (a one-off manual `grantTimedRole` call before running this script) is exactly what caused the incident documented in `TODO.md`'s "Resolved — T-017/T-018" entry: an untracked address ended up holding `SUPER_ADMIN_ROLE`, and the eventual fix for that left the contract in a state where no new Super Admin could ever be added. Run `deploy.ts` then `postDeploySetup.ts` back-to-back with nothing manual in between.

## 4. Post-Deploy Checklist (performed by `postDeploySetup.ts`)

1. Generates a second Super Admin wallet, funds it with 0.005 ETH, and grants it `SUPER_ADMIN_ROLE` directly via `grantTimedRole` (single deployer signature — this step runs *before* the deployer's own `SUPER_ADMIN_ROLE` is revoked in step 2, which is what makes step 2's 2-of-N co-signature possible in the first place).
2. Revokes the deployer's `SUPER_ADMIN_ROLE` via a co-signed `proposePlatformAction`/`coSignPlatformAction` (actionType 1), co-signed by the new second admin.
3. Deploys `ECDSASignatureVerifier` and calls `DIDRegistry.setSignatureVerifier(verifier_address)`.
4. Generates an issuer wallet and grants it `ISSUER_ROLE` on `CredentialRegistry`.

**The deployer intentionally still holds `DEFAULT_ADMIN_ROLE` after this** (see `TODO.md` T-020) — it is the only path to enroll a third Super Admin or recover from a lost key while there are only two. Do not renounce it until a third Super Admin exists or a proper upgrade-based recovery path is shipped; renouncing it with only one other Super Admin locks the contract out of ever granting `SUPER_ADMIN_ROLE` again (2-of-N can never be reached with a single remaining signer, and there's no other bypass once `DEFAULT_ADMIN_ROLE` is gone).

## 5. Subgraph Deployment

1. **Update addresses**: copy the contract addresses from `deployments/sepolia.json` into each `source.address` in `subgraph/subgraph.yaml`.
2. **Set `startBlock`** on every data source to the block the contracts were actually deployed at (check `deployments/sepolia.json`'s `deployedAt` against a block explorer, or just use the current block number at deploy time minus a small buffer). Leaving this at `0` makes the indexer attempt a full scan from Sepolia genesis and can take a very long time to finish syncing — this is exactly what happened on the first attempt at the 2026-09-09 redeploy.
3. **Build and deploy**:
   ```bash
   cd subgraph
   npm run codegen
   npm run build
   npx graph auth --studio <GRAPH_DEPLOY_KEY>
   npx graph deploy cipherloom subgraph.yaml --version-label v<N>
   ```
   Bump `<N>` on every redeploy — Graph Studio's query URL includes the version label (`.../cipherloom/v3`, currently), so `NEXT_PUBLIC_SUBGRAPH_URL` in `.env.local` needs updating to match after each deploy.
4. **Confirm it's actually indexing** before moving on:
   ```bash
   curl -s -X POST "$NEXT_PUBLIC_SUBGRAPH_URL" -H "Content-Type: application/json" -d '{"query":"{ _meta { block { number } hasIndexingErrors } }"}'
   ```
   A `"Subgraph ... has not started syncing yet"` error after more than ~30 seconds usually means `startBlock` is too low (see step 2).

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

## 7. CI/CD Pipeline (GitHub Actions)

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

## 8. Phased Rollout

| Phase | Scope |
|---|---|
| **Phase 1 — Hackathon MVP** | DID registry, VC issuance, time-bound RBAC, ERC-721 minting with dual attestation, basic audit dashboard, testnet deployment |
| **Phase 2 — Pilot Hardening** | Multisig governance, timelock dispute resolution, guardian recovery, IPFS metadata pipeline, external contract audit |
| **Phase 3 — Production Migration** | Permissioned chain deployment, L2 scaling, self-hosted indexing, full AI anomaly-detection service, ZK privacy layer |
| **Phase 4 — Forward-Looking** | Post-quantum signature migration activated, legal-tech bridge integration, cross-organization DID interoperability |

## 9. Rollback Plan

- Contracts: UUPS proxies allow logic rollback to the previous implementation via the same governed
  upgrade path — no state loss.
- Frontend: Vercel/Docker image rollback to previous tagged release.
- Indexer: subgraph redeploy from any prior commit — always safely re-derivable from raw chain data.
