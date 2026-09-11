# Praman Setu — Implementation Gap Audit
**PS 26125 (BEL) · Team Crypto Nova · Audit date: 2026-09-10**

Verified against: GitHub `ruudrasharma/Pramansetu@main` (fetched live — byte-for-byte identical to
the uploaded zip, so every finding below applies to the current public repo) + `Problem_Gap_Analysis.pdf`
+ `Complete_Solution_Document.pdf`. Contract compilation couldn't be executed in this sandbox (solc
binary host is not on the egress allowlist), so contract logic was verified by direct source reading
and by reading the existing Hardhat test files' actual call patterns, not by re-running `npx hardhat test`.

**Headline:** this is a genuinely unusual hackathon repo — your own `TODO.md`/`CHANGELOG.md` already
self-audit most of the frontend gaps honestly (T-015 through T-043), and the "no fabricated data"
discipline is visibly real in most places (IPFS route, anomaly route). The contract layer is solid.
The gaps that matter most are: (1) one contract-level bug that silently breaks all NFT transfers made
through the real UI, (2) two governance surfaces that bypass the multisig you advertise, (3) one still-live
fabrication bug your own audit missed, and (4) two Phase-4 modules that exist only as prose/UI-theater,
not code.

---

## 1. Scorecard vs. the Complete Solution Document's 5 modules

| Module | Claimed | Contracts | Frontend (onchain mode) | Verdict |
|---|---|---|---|---|
| M1 — DID & VCs | Full lifecycle: create, resolve, guardian recovery, Sybil-resistant VC issuance, ZK selective disclosure | ✅ Solid | 🟡 Partial — see §2 | **~50% real** |
| M2 — RBAC Engine | Time-bound roles, 2-of-N multisig grants, emergency pause, UUPS upgrade | ✅ Mostly solid, 2 gaps | 🟡 Partial — see §2 | **~70% real** |
| M3 — NFT Asset Registry | Dual-attestation mint, IPFS content-addressing, credential-gated transfer | 🔴 One critical bug | 🟡 Partial — see §2 | **~55% real, transfer path broken** |
| M4 — Audit Trail + AI Anomaly Detection | Immutable event log, subgraph indexing, "AI" real-time monitoring | N/A (events only) | 🟢 Mostly real, "AI" is overclaimed, 1 fabrication bug | **~75% real** |
| M5 — Multi-Sig Governance & Dispute | Gnosis-Safe-style M-of-N for all Super Admin actions, timelock, Auditor veto | 🟡 Real but narrower than claimed | 🔴 Barely wired — see §2 | **~40% real** |

Numbers are directional, not a formal coverage metric — they're here to show relative maturity across
modules, not to be quoted precisely.

---

## 2. Critical issues (fix before demo / before trusting the live deployment)

### 2.1 🔴 `AssetRegistry` — the credential-gated transfer check is fed the wrong value, and it will revert almost every real transfer
**Where:** `contracts/AssetRegistry.sol` (`coSignMint`, `_update`) + `app/(app)/assets/mint/page.tsx` + `lib/services/assetService.ts`
**Solution doc claim (§6.1, step 3):** *"ownership transfer functions check the recipient DID holds a valid, non-revoked identity credential before allowing transfer."*

`proposeMint`'s second argument is literally named `recipientDid` in the contract, and `coSignMint` stores
that value directly into `vcIdOf[tokenId]`. `_update()` later calls `credentialRegistry.isValid(vcIdOf[tokenId])`
on every transfer. The problem: **the real mint page in the app asks the operator to type in a "Recipient DID
hash," not a `vcId` issued by `CredentialRegistry.issueCredential`.** Your own frontend even labels the field
*"Recipient DID hash (bytes32) — stored as `vcId` on-chain; see TODO.md T-019"* — i.e., the team already knows
and flagged it, correctly refusing to patch it without sign-off (good discipline — this note is just to make
the severity explicit).

**Why it's more than a labeling issue:** a DID hash was never registered as a credential in
`CredentialRegistry`, so `isValid()` returns `false` for it. On every transfer after the initial mint,
`_update()` will revert with `RecipientCredentialInvalid()` — **any asset minted through the real UI becomes
permanently non-transferable.** This doesn't show up in your 86/86 passing tests because
`test/AssetRegistry.test.ts` deliberately calls `issueVcForRecipient()` first and passes the *real* `vcId`
into `proposeMint` — i.e., the tests exercise the contract correctly, while the shipped UI exercises it
incorrectly. Tests-green + demo-broken is exactly the gap here.
**Fix shape:** either (a) change the mint page to actually call `CredentialRegistry.issueCredential` first
and use its returned `vcId`, or (b) rename the contract parameter/field to match what's actually passed and
decide whether transfer-gating-by-DID is an acceptable substitute for transfer-gating-by-VC (it isn't quite
the same guarantee, but at least it would stop reverting). Contract-storage change → needs the sign-off your
own `AI_DEVELOPMENT_RULES.md` §9 requires.

### 2.2 🔴 UUPS upgrade authorization bypasses the multisig you advertise for "contract upgrades"
**Where:** `TimeBoundAccessControl.sol` and `AssetRegistry.sol`, both `_authorizeUpgrade()`
**Solution doc claim (§8.1):** *"Super Admin actions (contract upgrades, adding/removing Admins, emergency
pause/unpause) require M-of-N multisig approval."*

`pause`/`unpause` genuinely go through the 2-of-N `proposePlatformAction`/`coSignPlatformAction` flow — that
part is real. But `_authorizeUpgrade()` on both upgradeable contracts is gated only by
`onlyRole(SUPER_ADMIN_ROLE)` — a **single** Super Admin signature is enough to push a new implementation to a
live proxy holding every DID, role, and asset in the system. This is the exact single-key-takeover risk
Section 2.2.1 of your gap analysis calls out — and it currently applies to the one action (a logic upgrade)
that could rewrite the entire system's behavior.
**Fix shape:** route `_authorizeUpgrade` through `GovernanceTimelock.queueTransaction` (which already exists)
or through a dedicated `proposeUpgrade`/`coSignUpgrade` pair analogous to `proposePrivilegedGrant`.

### 2.3 🔴 `DIDRegistry`'s crypto-agility switch is owned by a single EOA, not the RBAC/multisig system at all
**Where:** `contracts/DIDRegistry.sol` (`owner`, `onlyOwner`, `setSignatureVerifier`, `setGuardianRecoveryContract`)

`DIDRegistry` has its own separate `owner` (`msg.sender` at deploy time) that is completely disconnected from
`TimeBoundAccessControl`'s `SUPER_ADMIN_ROLE` / multisig machinery. `setSignatureVerifier` — the function that
performs the entire post-quantum migration your Section 11 roadmap is built around — is gated by nothing more
than one address matching `owner`. Whoever holds that one deployer key can silently swap in a malicious
"verifier" contract that always returns `true`, which would let them forge every DID authentication in the
system. This is the same single-point-of-failure the whole platform exists to eliminate, just relocated one
layer down. `CredentialRegistry`'s separate `DEFAULT_ADMIN_ROLE` (able to unilaterally `revokeCredential` on
anyone) has the same shape of issue, at lower severity.
**Fix shape:** make `DIDRegistry.owner` a contract address (`TimeBoundAccessControl` or `GovernanceTimelock`)
rather than an EOA, or add the same propose/co-sign pattern used elsewhere.

### 2.4 🔴 Dashboard "Simulate" button fabricates live-looking chain events, in *any* data mode — a fresh instance of the fabrication pattern your own audit was hunting for
**Where:** `app/(app)/dashboard/page.tsx`, `simulateLiveEvent()`

Sitting right next to a label that reads *"Newest first · live from chain events,"* there's a "Simulate"
button that injects a synthetic `AuditEvent` — random type, a fabricated `0x####…####` tx hash, prefixed
`[LIVE]` — straight into the same list used for real subgraph-indexed events. It is **not gated by
`dataMode === "mock"`**, unlike the auth page's "Simulate (demo)" button which your `TODO.md` (T-040) already
flagged as needing a mock-only gate. This is the exact same category of issue — an operator or judge in
onchain mode could click it and see what looks like a real on-chain event with a plausible tx hash that never
happened. Worth adding to `TODO.md` alongside T-040; same fix pattern (`dataMode === "mock"` gate or removal).

### 2.5 🟡 `GovernanceTimelock.queueTransaction` is single-signer, not the M-of-N multisig the doc describes
**Where:** `contracts/GovernanceTimelock.sol`

The comment says *"Requires Super Admin multisig approval upstream in practice"* — but "in practice" means
off-chain/social convention, not something the contract enforces. `queueTransaction` only checks
`onlyRole(SUPER_ADMIN_ROLE)` — any **one** Super Admin can queue a high-value action (including, per §8.1,
things like large asset transfers or admin changes) into the timelock alone. The genuine M-of-N enforcement in
`TimeBoundAccessControl` (`proposePrivilegedGrant`/`coSignGrant`, `proposePlatformAction`/`coSignPlatformAction`)
does not extend to `GovernanceTimelock`. Given the deployment currently has exactly 2 Super Admins (per
`TODO.md`'s T-020), this is a real, exploitable gap today, not just a documentation nuance.

---

## 3. Frontend "onchain mode" — service-by-service reality check

Your own `TODO.md`/`CHANGELOG.md` (Phase 10's "Corrected" note, T-021–T-043) already document most of this
in detail — this section is a condensed cross-check confirming the current zip/repo matches what's written
there, plus 2 items not yet in your tracker (marked **NEW**).

| Service | Function | Status |
|---|---|---|
| `didService` | `resolveDID` / `listCredentials` | ✅ Real (subgraph + on-chain reads) |
| `didService` | `getGuardians` | 🟡 Real except `activeRecovery` (documented as impossible with current ABI, not an oversight) |
| `didService` | `createDID` | ✅ Real (client-side keypair, real IPFS pin, real tx). Private key sits in `localStorage` — fine for a prototype, called out correctly in `docs/SECURITY.md` |
| `didService` | `initiateRecovery` | 🔴 Still throws — blocked on T-039 (no "act as someone else's guardian" UI exists; current `/identity/recovery` page is framed backwards for the real ownership model) |
| `rbacService` | `grantTimedRole` / `revokeRole` | ✅ Real, resolves target address/role at call time |
| `rbacService` | `requestRole` | Honest thrown error (no on-chain self-service path exists — correct, not a bug) |
| `assetService` | `proposeMint` / `coSignMint` | ✅ Submits real txs; **the value it submits as "vcId" is wrong — see §2.1** |
| `assetService` | `transferAsset` | ✅ Real `transferFrom` call — **will revert per §2.1 for any asset minted via the UI** |
| `assetService` | `listAssets` / `getAsset` | ✅ Real subgraph + IPFS metadata fetch |
| `assetService` | `getProvenance` | Stopgapped (zero callers currently; `AuditEvent` schema has no asset-id field to filter by anyway) |
| `governanceService` | `getProposals` / `getDisputes` | 🔴 Always returns mock fixtures, even in onchain mode |
| `governanceService` | `proposeAction` | 🔴 Hardcodes zero role/account; maps `addAdmin`/`upgrade`/`removeAdmin` onto `actionType` values that don't match the contract's real enum (1=emergencyRevoke, 2=pause, 3=unpause) — these calls will revert with `InvalidActionType` |
| `governanceService` | `approveProposal` | 🔴 Calls `BigInt("gov-1")` on a mock-shaped string ID — throws at runtime the first time it's exercised onchain |
| `governanceService` | `resolveDispute` | 🔴 Ignores its own `proceed: boolean` argument, always calls `executeTransaction` (can never actually cancel a disputed action) |
| `auditService` | `getEvents` / `getAnomalies` | ✅ Real subgraph query + real `/api/audit/anomalies` polling |
| `auditService` | `dismissAlert` | No-op — dismissal is silently dropped, no persistence layer |
| `auditService` | `subscribeToEvents` | No-op in both modes — falls back to polling (`refetchInterval`) instead, which works but isn't what the name promises |
| Dashboard "Simulate" button | injects synthetic events | 🔴 **NEW** — not gated by `dataMode`, fabricates a plausible tx hash alongside genuinely-live data (§2.4) |
| `/onboarding` walkthrough | full 5-step "identity creation" flow | 🟡 **NEW** — entirely illustrative: uses `Math.random()` for the DID/pubkey shown, never calls any real or mock service, and never respects `dataMode`. Fine as a marketing/explainer screen, but it duplicates (in pure animation form) the identity creation that already works for real at `/identity`, and step 5 ("Credential receipt") shows a green "Issued" badge with no `issueCredential` call anywhere — see §4.1 |

---

## 4. Features present only as documentation / UI theater, not working code

### 4.1 Verifiable-Credential issuance has no UI anywhere
`lib/hooks/useCredentialRegistry.ts` defines a real, working `issueCredential` wagmi hook — but it has
**zero callers** in the entire `app/`/`components/` tree. The Complete Solution Document's own onboarding
workflow (§9.1, step 5: *"Authorized HR-Issuer DID signs a Verifiable Credential... VC hash + revocation-registry
entry pushed on-chain"*) has no corresponding button, form, or page. Right now, once a real DID is created
on Sepolia, there is no way through the app itself to actually issue it a credential — someone would have to
call the contract directly (Etherscan, a script). This also means M1's Sybil-resistance story ("DIDs are
functionally worthless without a VC") is unenforceable through the product today, even though the contract
mechanism for it is real and tested.

### 4.2 Zero-Knowledge selective disclosure — 0% implemented, and your own audit already caught it
README/`docs/TECH_STACK.md`/`docs/SECURITY.md` all describe **Semaphore** for "prove role without revealing
identity." There is no `semaphore`, `snarkjs`, or any ZK library in `package.json`. The "Generate proof"
button on `/identity` (`runZkDemo`) is a `setTimeout(..., 1400)` that flips a state variable to `"proved"` —
in *every* data mode, mock or onchain. Your `CHANGELOG.md` Phase 10 entry already self-corrected this
overclaim on 2026-09-09 ("Not backed by any real implementation... resolution tracked separately, Phase C,
not yet decided") — flagging here only because it's still live in the current zip/repo and is the single most
visible "fake security feature" a judge could click on.

### 4.3 Oracle / decentralized attestation — 0% implemented
Gap analysis §2.2.5/§2.3.3 and Solution doc's dual-attestation design substitute for a full oracle (which is
a reasonable scoping decision), but the standalone "decentralized oracle design with multiple independent
attestors and a dispute window" (gap analysis §2.2.5) has no contract, no service, no docs beyond a mention.
Correctly scoped in your own `TODO.md` as **T-016, Phase 4, not blocking demo** — just confirming it's truly
0%, not partially started.

### 4.4 "AI" anomaly detection is real, but it's not AI
`app/api/audit/anomalies/route.ts` is a genuinely working, honest implementation — it queries the real
subgraph and applies two concrete heuristics (rapid role-grant velocity, emergency-pause detection). That's
good, working code. But `docs/TECH_STACK.md` describes it as *"Python service (rule-based + lightweight ML)"*
and the README calls it *"AI Anomaly Detection... AI monitoring."* The shipped version is a TypeScript Next.js
API route with two if-statements — zero ML, zero Python service. Recommend either building the lightweight-ML
piece for real (even a simple z-score/rolling-average model would justify the "AI" label) or changing the
marketing language to "rule-based heuristic monitoring," which is what a judge will see if they open the file.

### 4.5 Permissioned consortium chain (Hyperledger Fabric / Polygon Edge) — 0% implemented
Correctly scoped as the Phase 3 production target in both PDFs, not the hackathon deliverable. `docker-compose.yml`
only stands up a self-hosted Graph node + IPFS + Postgres (the Section 12.2 "self-hosted indexing" piece) —
there's no Fabric/Polygon Edge config anywhere, which is expected at this stage. Not a gap, just confirming
scope.

---

## 5. Things that are genuinely solid (so the above doesn't read as all-negative)

- **Contract layer is well-built and matches the design intent** in `DIDRegistry`, `CredentialRegistry`,
  `GuardianRecovery`, and most of `TimeBoundAccessControl` — real 2-of-N co-signature flows, real time-bound
  role expiry (`hasRole()` override), real crypto-agility interface (`ISignatureVerifier`/`ECDSASignatureVerifier`),
  real dual-attestation mint flow.
- **The "no fabricated data" discipline is real in the places that matter most for a judge demo**: the IPFS
  upload route fails loudly with a clear error if Pinata keys are missing (no fake CID fallback), and the
  anomaly-detection route correctly returns an empty array rather than a hardcoded fake incident — both of
  these were flagged as violations in an earlier internal audit (`CIPHERLOOM_STATE_AND_PLAN.md`) and have
  since been genuinely fixed.
- **Your own `TODO.md`/`CHANGELOG.md` self-audit is unusually rigorous** — T-021 through T-043 already catch
  the majority of the frontend gaps in this report, with specific technical reasoning for each, including a
  documented incident (the T-017/T-018 self-lockout) and why a redeploy was the right call. This audit mostly
  corroborates and adds contract-level/UI findings your service-layer-focused pass wouldn't have caught.
- **86/86 Hardhat tests passing is credible** — spot-checked `test/AssetRegistry.test.ts` and confirmed it
  exercises the contracts *correctly* (using a real `vcId` from `CredentialRegistry`), which is exactly why
  the tests don't catch the frontend integration bug in §2.1 — the tests are fine, the UI's usage of the
  contract is what's wrong.

---

## 6. Housekeeping (low severity, easy to clear)

1. **`CIPHERLOOM_STATE_AND_PLAN.md`** — 20 KB stray file at repo root still carrying the old "Cipherloom"
   name, contradicting your own naming-hygiene rule that all prior naming be fully replaced. Its findings are
   also stale/superseded (the IPFS and anomaly fabrication bugs it describes are already fixed in the current
   code). Recommend deleting it or moving its still-relevant history into `CHANGELOG.md`, then removing the
   file.
2. **`next@14.2.15` has known, since-patched CVEs** — `npm install` itself warns on this
   (`npm warn deprecated next@14.2.15: This version has a security vulnerability`). Next.js's December 2025 /
   January 2026 security advisories (CVE-2025-55182/55183/55184, CVE-2025-66478/67779, CVE-2026-23864) affect
   Next.js 14.x builds below 14.2.35, and this repo's App Router usage is exactly the affected surface.
   For a defense-sector security submission this is worth a one-line `package.json` bump to `next@14.2.35`
   (or later 14.x) before judging — cheap fix, bad look if a judge runs `npm audit` live.
3. Confirm and clean up the stray `master` branch alongside `main` mentioned in your own backlog — GitHub's
   branch API was rate-limited during this session so it couldn't be independently re-checked here.

---

## 7. Suggested priority order

1. §2.1 (transfer-breaking vcId bug) — this is the one a judge is most likely to hit live during a "mint
   then transfer" demo walkthrough.
2. §2.4 (Simulate button fabrication in onchain mode) — quick fix, same pattern as your existing T-040, and
   directly touches your own "no fabricated data" rule.
3. §2.2 / §2.3 (single-signer upgrade + DIDRegistry owner) — highest real-world severity, lower demo-visibility;
   worth fixing before treating Sepolia deployment as anything beyond a prototype.
4. §3 governance service wiring (T-032–T-035, already tracked) — needed before Module 5 can be demoed live
   in onchain mode at all.
5. §4.1 (missing VC-issuance UI) — needed before the Sybil-resistance story is demonstrable end-to-end, not
   just testable at the contract layer.
6. §4.2/§4.4 (ZK / "AI" labeling) — either build the minimal real version or soften the claim in
   README/docs before a judge who reads code finds the gap between the two.
