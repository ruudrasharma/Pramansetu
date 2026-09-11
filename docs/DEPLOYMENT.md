# Deployment — Praman Setu

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
   Deploys TimeBoundAccessControl (UUPS proxy), DIDRegistry, CredentialRegistry, AssetRegistry (UUPS proxy), GuardianRecovery, GovernanceTimelock — in this order, not alphabetical/module order — and writes addresses to `deployments/sepolia.json`. `TimeBoundAccessControl` deploys first because `DIDRegistry`'s constructor now takes its address (TODO.md §3.2, audit §2.3): `setSignatureVerifier`/`setGuardianRecoveryContract` route owner-equivalent authority through `TimeBoundAccessControl`'s 2-of-N `SUPER_ADMIN_ROLE` approval instead of a bare `owner` address. `GuardianRecovery` is **not** wired into `DIDRegistry` by this script — that call now needs 2-of-N approval that doesn't exist yet at this point (only the deployer holds `SUPER_ADMIN_ROLE`); it happens in `postDeploySetup.ts` instead, once a second Super Admin is enrolled.
   Etherscan verification is attempted automatically but is non-fatal if `ETHERSCAN_API_KEY` isn't set (it currently isn't — contracts are deployed and functional, just not source-verified on Etherscan yet).

3. **Post-deploy setup** — run immediately after, same session:
   ```bash
   TS_NODE_PROJECT=tsconfig.hardhat.json npx hardhat run scripts/postDeploySetup.ts --network sepolia
   ```
   This single script does the entire post-deploy checklist below — do **not** perform any of these steps manually/separately in between. Doing so (a one-off manual `grantTimedRole` call before running this script) is exactly what caused the incident documented in `TODO.md`'s "Resolved — T-017/T-018" entry: an untracked address ended up holding `SUPER_ADMIN_ROLE`, and the eventual fix for that left the contract in a state where no new Super Admin could ever be added. Run `deploy.ts` then `postDeploySetup.ts` back-to-back with nothing manual in between.

### 3.1 In-Place UUPS Upgrade Runbook (T-016, first performed for real 2026-09-11)

Every prior "upgrade" on this project (T-3.1/T-3.2) was actually a full fresh redeploy —
abandoning old addresses is fine when there's no real state yet, but T-016 needed to add a role
(`ORACLE_ATTESTOR_ROLE`) to the *already-live* `TimeBoundAccessControl` without disturbing its real
`SUPER_ADMIN_ROLE`/`DEFAULT_ADMIN_ROLE` state (T-020). This is the exact real sequence used —
**always rehearse it on a fork first** (`scripts/forkRehearsal_oracleAttestation.ts` as the
template), impersonating the real Super Admin addresses, no private keys needed:

1. Deploy the new implementation contract(s) — no approval needed to deploy, only to authorize the
   upgrade itself.
2. `proposePlatformAction(4, 0x0, newImplementationAddr)` per contract being upgraded — actionType
   4 = `authorizeUpgrade`.
3. **A second, real Super Admin must co-sign** (`coSignPlatformAction(actionId)`) — this needs
   their own wallet signature; it cannot be scripted with a single available key. If Etherscan's
   Write Contract tab shows no usable interface for the proxy (its implementation may not be
   verified there), a minimal standalone wallet-connect page calling
   `coSignPlatformAction(uint256)` directly by raw selector works without any Etherscan dependency
   — see the note at the end of this section.
4. Once both co-signs land (verify via `pendingActions(actionId).executed == true`, not assumed),
   execute: `proxy.upgradeToAndCall(newImplementationAddr, initCalldata)`. If the upgrade
   introduces something needing one-time setup (like `ORACLE_ATTESTOR_ROLE`'s role-admin), pass a
   `reinitializer(N)`-guarded function's calldata as `initCalldata` so the setup is atomic with the
   upgrade itself — no window where the new code is live but its setup isn't.
5. Verify immediately after each individual step (not just at the end) — e.g.
   `getRoleAdmin(NEW_ROLE) == SUPER_ADMIN_ROLE`, and separately re-verify the *existing* role state
   (`hasRole` for every account that mattered before the upgrade) is unchanged.

**Note on co-signing without a working Etherscan UI**: if a proxy's implementation was never
verified on Etherscan, both its default "Contract" tab and "Write as Proxy" tab can silently show
no usable functions, with no clear error explaining why. A minimal HTML page using
`window.ethereum`'s `eth_call`/`eth_sendTransaction` directly against the known function selector
(e.g. `coSignPlatformAction(uint256)` = `0x26ac1c20`) sidesteps this entirely — the signer still
does all the actual signing, this just avoids the broken UI.

### 3.2 Standalone New-Contract Deploy Runbook (T-015)

Simpler than an upgrade — a new contract that only *reads* from `TimeBoundAccessControl` (never
modifies it, never needs to be authorized by it) needs no governance choreography at all:

1. Rehearse on a fork first anyway if the contract references a real external dependency (T-015's
   `SemaphoreRoleGroups` constructor calls into the official Semaphore contract's `createGroup` —
   worth proving that interaction against forked real state before spending real gas on it).
2. Deploy directly from any funded key: `Factory.deploy(...)`. No proposal, no co-sign.
3. Verify whatever the constructor is expected to have set up (e.g. T-015's 5 distinct
   `groupIdOf(role)` values) before wiring the frontend to the new address.

## 4. Post-Deploy Checklist (performed by `postDeploySetup.ts`)

**Reordered (2026-09-11, TODO.md §3.2/§3.3, audit §2.3/§2.5)** — `DIDRegistry.setGuardianRecoveryContract`/
`setSignatureVerifier` now require 2-of-N `SUPER_ADMIN_ROLE` approval via `TimeBoundAccessControl`'s
propose/co-sign flow (`proposePlatformAction`/`coSignPlatformAction`, actionType 5/6), not a bare
`owner` address. That approval needs two real signers, so every step needing it must run *before*
the deployer's own `SUPER_ADMIN_ROLE` is revoked — revocation moved from step 2 to step 4.

1. Generates a second Super Admin wallet, funds it with 0.005 ETH, and grants it `SUPER_ADMIN_ROLE` directly via `grantTimedRole` (single deployer signature, using the deployer's still-held `DEFAULT_ADMIN_ROLE` — this is what creates the second signer every step below depends on).
2. Proposes+co-signs `proposePlatformAction`/`coSignPlatformAction` actionType 6 (`authorizeDIDGuardianRecovery`) for the deployed `GuardianRecovery` address, then calls `DIDRegistry.setGuardianRecoveryContract(guardianRecovery_address)`.
3. Deploys `ECDSASignatureVerifier`, proposes+co-signs actionType 5 (`authorizeDIDSignatureVerifier`) for its address, then calls `DIDRegistry.setSignatureVerifier(verifier_address)`.
4. **Now** revokes the deployer's `SUPER_ADMIN_ROLE` via a co-signed `proposePlatformAction`/`coSignPlatformAction` (actionType 1), co-signed by the second admin — steps 2–3 above still needed the deployer as one of the two signers, so this can't run any earlier.
5. Generates an issuer wallet and grants it `ISSUER_ROLE` on `CredentialRegistry`.

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
   npx graph deploy praman-setu subgraph.yaml --version-label v<N>
   ```
   Bump `<N>` on every redeploy — Graph Studio's query URL includes the version label (`.../praman-setu/v3`, currently), so `NEXT_PUBLIC_SUBGRAPH_URL` in `.env.local` needs updating to match after each deploy.
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
docker build -t praman-setu-frontend .
docker run -p 3000:3000 --env-file .env.production praman-setu-frontend
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
| **Phase 3 — Production Migration** | Permissioned chain deployment, L2 scaling, self-hosted indexing, full AI anomaly-detection service |
| **Phase 4 — Forward-Looking** | Post-quantum signature migration activated, legal-tech bridge integration, cross-organization DID interoperability |

## 9. Rollback Plan

- Contracts: UUPS proxies allow logic rollback to the previous implementation via the same governed
  upgrade path (§3.1) — no state loss. `deployments/sepolia.json`'s `t016Upgrade` block records the
  pre-upgrade implementation addresses for `TimeBoundAccessControl`/`AssetRegistry` for exactly
  this purpose.
- `SemaphoreRoleGroups` (T-015) is non-upgradeable and standalone — "rollback" means simply
  pointing the frontend's `NEXT_PUBLIC_SEMAPHORE_ROLE_GROUPS_ADDRESS` at nothing (or a redeployed
  instance); it can't corrupt `TimeBoundAccessControl`'s own state since it only ever reads from it.
- Frontend: Vercel/Docker image rollback to previous tagged release.
- Indexer: subgraph redeploy from any prior commit — always safely re-derivable from raw chain data.
