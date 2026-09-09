# Cipherloom — Real Current State, What's Fake, What's Left, and the 6-Person Deploy Plan

Checked against the live GitHub repo + your latest uploaded zip (they match). This supersedes my last two audits — real engineering happened since then, but there's a specific, serious problem baked into that work that directly hits your "no fake data" requirement. Read the first section before anything else.

---

## 0. THE HEADLINE PROBLEM: there is fabricated/fake data already committed, disguised as real

You said explicitly: no fake data, everything should actually work. Right now, three things in the repo violate that, and none of them are obvious from the UI — they fail silently and *look* like real data.

### 0.1 `app/api/audit/anomalies/route.ts` — hardcoded fake security incidents

This is the most serious one. Read the actual comment in the code:

```ts
// Default mock data if no anomalies are found from heuristic (so the demo looks populated)
if (anomalies.length === 0) {
  anomalies.push({
    id: "anomaly-default-1",
    rule: "Off-hours Privileged Action",
    detail: "SUPER_ADMIN_ROLE proposal initiated outside of defined geographical bounds (IP: non-domestic).",
    riskScore: 65, ...
  });
  anomalies.push({
    id: "anomaly-default-2",
    rule: "Velocity Check: Repeated Dispute",
    detail: "AUDITOR_ROLE raised 3 consecutive disputes on Governance queue within 5 minutes.",
    riskScore: 45, ...
  });
}
```

If your real event stream has zero genuine anomalies (which it will, in a clean demo), this endpoint invents two fake security incidents and serves them as if they were detected. This isn't a "not implemented yet" gap — it's actively fabricating output. **Delete this fallback block entirely.** An audit page showing "0 anomalies detected" is a correct, honest result. A judge asking "what's this off-hours alert?" and getting an answer that traces back to `// so the demo looks populated` is the single worst thing that could happen to your credibility in a demo.

### 0.2 `lib/ipfs.ts` — silently fakes every IPFS upload

```ts
if (!apiKey || !apiSecret) {
  console.warn("Pinata keys not found in environment. Mocking IPFS upload.");
  await new Promise(resolve => setTimeout(resolve, 1000));
  return `ipfs://mocked-cid-${Date.now()}`;
}
```

And here's the part that makes this worse than it looks: **even if you fill in the Pinata keys exactly as `.env.example` tells you to**, this will still always return a fake CID. Why: this function reads `NEXT_PUBLIC_PINATA_API_KEY` / `NEXT_PUBLIC_PINATA_SECRET_API_KEY`, but `.env.example` defines `PINATA_API_KEY` / `PINATA_SECRET_API_KEY` — no `NEXT_PUBLIC_` prefix. In Next.js, only `NEXT_PUBLIC_*` variables are exposed to client-side code, so this browser-side function can never see the correctly-named variable even if you set it. **Every asset you mint in the demo today gets a CID that resolves to nothing**, silently, with only a `console.warn` in the browser dev console that nobody watching the demo will ever see.

### 0.3 The subgraph contract addresses are almost certainly fabricated, and the CHANGELOG overclaims a deployment that didn't happen

- `subgraph/subgraph.yaml` now has five real-looking addresses filled in.
- But `TODO.md` still lists **T-001/T-002 as open blockers** — "Blocked on: key provisioning by BEL team" — meaning by the project's own tracker, the contracts have never been deployed.
- There is no `deployments/sepolia.json` anywhere in the repo (deploy.ts and postDeploySetup.ts both require this file to exist and would throw immediately if run).
- Those five addresses don't appear anywhere else in the repo — not in an env file, not in a deploy log, nowhere. There's nothing they were copied from.
- `CHANGELOG.md`'s Phase 6 entry claims "*Subgraph indexer deployed to Graph Studio (cipherloom schema) with fully implemented mapping logic*" — but `.env.example`'s subgraph URL is still the dead, shut-down Graph hosted-service format, and `GRAPH_DEPLOY_KEY` is still blank.
- Separately, `app/api/audit/anomalies/route.ts` has a *different* hardcoded fallback URL — `https://api.studio.thegraph.com/query/1758953/cipherloom/v1` — that also isn't backed by anything in the repo.

**Conclusion: nothing has actually been deployed to a chain, and the addresses/URLs in the repo are placeholder-shaped text, not real deployment artifacts.** The CHANGELOG entry claiming otherwise is not accurate. This matters a lot for your ask — you cannot demo against these; they don't point at anything real.

### 0.4 Bugs disguised as fixes: the subgraph mapping "fixes" now store the *wrong* data instead of crashing

Last time I found the mappings referenced event fields that don't exist (`event.params.recipient`, `event.params.vcHash`, etc. — fields the Solidity events never emit). That's been "fixed" in three of four files, but not correctly — instead of pulling the real value, the code now stuffs the *wrong* value into the field so it compiles:

```ts
// subgraph/src/asset-registry.ts
asset.ownerAddress  = event.params.recipientDid; // storing DID hash in ownerAddress field for now
```
```ts
// subgraph/src/did-registry.ts
identity.metadataURI = event.params.keyType; // the ABI actually named this string param 'keyType'
```
```ts
// subgraph/src/credential-registry.ts
cred.vcHash = event.params.vcId; // the event no longer emits vcHash, fallback to vcId
```

Once this actually gets deployed, your **Assets page will show a DID hash where the owner's wallet address should be**, your **Identity page will show a key-type string ("ES256K") where the metadata URI should be**, and your **credential records will show the vcId twice instead of a real hash**. This is worse than obviously-fake data because it looks plausible — a judge won't notice unless they check it against the contract source, but it's still wrong. `subgraph/src/governance-timelock.ts` is the one file that did this correctly — it makes a real `GovernanceTimelock.bind(event.address).queue(txId)` contract call to fetch the real calldata. That's the pattern the other three should follow (see Phase 0 below).

---

## 1. What's genuinely real and working now (credit where due)

- `app/page.tsx`, `app/governance/page.tsx`, `app/audit/page.tsx` now query a real GraphQL client (`lib/graphql.ts` + `lib/queries.ts`) instead of static mock arrays. (The client's endpoint variable name has a bug — see §2 — but the querying pattern itself is correctly built.)
- `app/assets/page.tsx` now does real role-gating with `useHasRole(ROLE.ADMIN_ROLE, address)`.
- `test/ECDSASignatureVerifier.test.ts` is a real 4-case test suite (valid signature, invalid signature, unsupported key type, invalid pubkey length) — the coverage gap I flagged before is closed.
- `scripts/postDeploySetup.ts` is a legitimate, well-written script: generates and funds a real second Super Admin wallet, grants the role on-chain, fails loudly (`throw`) if `deployments/sepolia.json` is missing instead of faking it. This is the right pattern — contrast with §0.2's silent fallback.
- `docker-compose.yml` — a real self-hosted Graph Node stack (graph-node + IPFS + Postgres) as a fallback if Graph Studio access is a problem.
- WalletConnect modal is genuinely wired (confirmed this last time too).

---

## 2. Remaining bugs to fix (Phase 0 — do these before anything else)

1. **Rip out the anomalies fake-data fallback** (§0.1) — return an empty array when no real anomalies are found, and say so plainly in the UI ("No anomalies detected in the current event window") instead of inventing incidents.
2. **Fix the Pinata env var name mismatch** — either rename `.env.example`'s `PINATA_API_KEY`/`PINATA_SECRET_API_KEY` to `NEXT_PUBLIC_PINATA_API_KEY`/`NEXT_PUBLIC_PINATA_SECRET_API_KEY` to match what `lib/ipfs.ts` actually reads, or (better, since a secret API key shouldn't be shipped to the browser at all) move the Pinata upload into a server route (`app/api/ipfs/upload/route.ts`) and keep the keys server-only. Do the second one — client-exposed Pinata secrets is also a real security smell, not just a naming bug.
3. **Fix `lib/graphql.ts`'s env var name** — it reads `NEXT_PUBLIC_GRAPHQL_ENDPOINT`, but `.env.example` only defines `NEXT_PUBLIC_SUBGRAPH_URL`. Pick one name and use it everywhere (queries.ts callers, graphql.ts, the anomalies route, `.env.example`, `.env.local`).
4. **Fix the three subgraph mappings that store the wrong field** (§0.4) — follow `governance-timelock.ts`'s pattern: bind the generated contract instance at the event's address and make a real view-function call to get the actual value (recipient address, metadata URI, vcHash), instead of reusing an adjacent field that happens to type-check.
5. **Update `.env.example`'s `NEXT_PUBLIC_SUBGRAPH_URL` default** — the hosted-service URL format (`api.thegraph.com/subgraphs/name/...`) has been dead since June 2024. Use a real Graph Studio URL format once deployed: `https://api.studio.thegraph.com/query/<id>/<name>/<version>`.
6. **Delete the fabricated addresses in `subgraph/subgraph.yaml`** and leave them as placeholders (or template variables) until Phase 1's real deploy produces real ones — having plausible-but-fake addresses sitting there is worse than an obvious placeholder, because it invites exactly the confusion in §0.3.
7. **Correct `CHANGELOG.md`'s Phase 6 entry** — it currently claims the subgraph is deployed to Graph Studio. It isn't. Amend it to reflect the mapping/hook work that's genuinely done and remove the deployment claim until it's true.

---

## 3. What's still 100% unimplemented

Same as before — confirmed still absent, and now honestly tracked as "Planned" in `TODO.md` (T-015, T-016) rather than falsely claimed done, which is the right way to leave a gap:

- **Zero-Knowledge privacy layer** — no `semaphore`/`snarkjs` dependency, no code, anywhere.
- **Oracle attestation module** — no contract, no off-chain attestor script, anywhere.
- **Real deployment to any chain** — nothing has actually gone on-chain yet (§0.3).

---

## 4. Deploying this as BEL, for real, with a 6-person team

You're standing in as BEL for the demo. Here's how the 6 people map onto the platform's actual role hierarchy (`SUPER_ADMIN_ROLE`, `ADMIN_ROLE`, `MANAGER_ROLE`, `AUDITOR_ROLE`, `USER_ROLE` — five roles, `GRANT_THRESHOLD = 2` and `ACTION_THRESHOLD = 2` are both hardcoded as 2-of-N in the contract, which is exactly right for two Super Admins co-signing each other):

| # | Person | On-chain role | Wallet needed | What they actually do in the demo |
|---|--------|---------------|----------------|-------------------------------------|
| 1 | You (deploy lead) | **Super Admin A** | Yes — this is the deployer wallet, funded with Sepolia ETH | Runs `scripts/deploy.ts`, then co-signs the post-deploy checklist (enroll Super Admin B, revoke deployer's own default grant, wire the signature verifier, grant `ISSUER_ROLE`) |
| 2 | Teammate | **Super Admin B** | Yes — separate wallet, funded with a small amount of Sepolia ETH by person 1 (`postDeploySetup.ts` already automates this funding step) | Co-signs every 2-of-N action alongside person 1 — role grants above User tier, emergency pause/unpause, governance queue actions. This pairing is what demonstrates "who watches the admin" (Module 5) live |
| 3 | Teammate | **Admin** | Yes | Issues credentials via `CredentialRegistry.issueCredential`, proposes NFT mints (`proposeMint`), demonstrates the DID/VC onboarding flow for a new "employee" |
| 4 | Teammate | **Manager** | Yes | Co-signs the dual-attestation mint that person 3 proposes (`coSignMint`) — this pairing demonstrates Module 3's "no single person can mint an asset" guarantee |
| 5 | Teammate | **Auditor** | Yes | Read-only role — pulls up the Audit dashboard, demonstrates `raiseDispute()` on a governance transaction during the timelock window (Module 5's dispute mechanism) |
| 6 | Teammate | **User** | Yes | Holds a minted asset, receives a role grant, shows the "ordinary employee" experience — sign a challenge to authenticate, view their own identity/assets, no admin buttons visible (this is where the role-gated UI from §1 actually pays off) |

Practical setup for all 6:
- Each person needs a MetaMask (or any WalletConnect-compatible) wallet with a small amount of **Sepolia testnet ETH** — use the Alchemy or Infura Sepolia faucet, a few cents worth of test ETH is enough for the whole demo.
- Person 1 collects all 6 addresses ahead of time and either grants roles live during the demo (more impressive) or pre-grants everything except the one live action you want to showcase per person (safer if you're time-constrained on stage).
- Decide *before* the demo which specific flow each pairing performs live vs. which is pre-seeded — e.g., pre-create most identities/credentials so the demo doesn't spend ten minutes on onboarding, but do the dual-attestation mint and the dispute-raise live, since those are the two moments that actually prove the architecture (nobody can act alone).

---

## 5. Ordered task list to reach a genuinely working, no-fake-data prototype

**Phase 0 — Kill the fake data and fix the mismatches (§2 above).** Do this first; there's no point deploying on top of code that fabricates results.

**Phase 1 — Real deployment**
1. Fund the deployer wallet (person 1) with Sepolia ETH.
2. Get an Alchemy or Infura Sepolia RPC URL (the public `rpc.sepolia.org` fallback is rate-limited and unreliable for a live demo — this also finally uses the `ALCHEMY_API_KEY` variable that's currently declared but dead).
3. Run `npx hardhat run scripts/deploy.ts --network sepolia` for real. Confirm `deployments/sepolia.json` is written with real addresses.
4. Run `scripts/postDeploySetup.ts` to enroll and fund Super Admin B.
5. Complete the rest of the post-deploy checklist (revoke deployer's own grant via a real co-signed action, deploy `ECDSASignatureVerifier`, grant `ISSUER_ROLE`).
6. Copy the *real* addresses from `deployments/sepolia.json` into `subgraph/subgraph.yaml`, replacing the fabricated ones.
7. Deploy the subgraph for real — either to Graph Studio (`npx graph deploy --studio cipherloom`, needs a real `GRAPH_DEPLOY_KEY`) or self-hosted via the `docker-compose.yml` that's already in the repo. Given six people need reliable access during a live demo, self-hosted via Docker on a machine you control is arguably the safer choice — no dependency on a third party's uptime during judging.
8. Point `.env.local` at the real subgraph URL and confirm the frontend actually reads live data (create one real DID, watch it appear on the dashboard within a few seconds).

**Phase 2 — Onboard the six wallets**
1. Collect all six addresses.
2. Create six DIDs (one `createDID` call each), issue the appropriate credential/role to each per §4's table.
3. Do a full dry run of the demo script end-to-end at least once before the actual judging session — connect each wallet, perform each role's action, confirm the audit trail and dashboards update live.

**Phase 3 — IPFS, for real**
1. Move the Pinata upload server-side (§2.2) so the keys are never exposed to the browser.
2. Mint one real asset with a real Pinata-pinned CID, confirm it resolves via a public IPFS gateway.

**Phase 4 (optional, time permitting) — the two modules that don't exist yet**
Given everything above, I'd genuinely reconsider whether ZK and the oracle module are worth building from scratch before your demo date versus polishing and rehearsing what's real. A working, honestly-presented five-module platform with six live wallets performing real multisig and dispute actions is a stronger demo than a six-module platform where the sixth module is a rushed, unaudited proof-of-concept. If you do want them, the scoped-down versions I described last time (one concrete Semaphore proof, one minimal 2-attestor oracle contract) still stand — just sequence them after Phases 0–3 are solid, not before.

---

## 6. If you want this handed to Antigravity as a build prompt

Say the word and I'll fold Phase 0 (as a hard, first, non-negotiable pass — explicitly listing every fake-data instance in §0 by file and line so the agent removes them rather than working around them again) into an updated version of the prompt document I gave you before, plus Phases 1–4 above rewritten as agent-executable steps. The one thing I'd add as a standing rule for that prompt, given what happened here: **never let the agent add a silent mock/placeholder fallback when a real credential or dependency is missing — it should fail loudly and tell you what's missing, every time, no exceptions.** That single rule would have prevented all three issues in §0.
