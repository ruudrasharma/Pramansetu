# TODO — Praman Setu (SIH 2026, PS 26125)

This file tracks outstanding work ordered by priority.
Completed items are moved to CHANGELOG.md.

---

### T-065 ✅ closed 2026-09-11 — `AuditEvent.actorDid` crashed the ledger/audit UI on real null values
Found immediately after T-064, clicking through the local dev server with the real redeployed
contracts + `v12` subgraph: `/dashboard` threw a full-page client error boundary
(`TypeError: Cannot read properties of null (reading 'length')`) the moment a real indexed event
with no registered DID rendered. Root cause: `AuditEvent.actorDid` is genuinely nullable on real
onchain data (`subgraph/src/*.ts` leaves it unset whenever the actor address has no DID —
`lib/server/anomalyDetection.ts` already had a comment about this exact gap, for the *anomalies*
path only) but the mock-fixture-derived TypeScript type declared it as a plain non-nullable
`string`, and `lib/services/auditService.ts`'s onchain adapter (`{...e, timestamp: ...}`) passes the
raw nullable GraphQL value straight through with an `any` cast masking the mismatch. Three real call
sites crashed or would have crashed on this: `components/modules/EventRow.tsx` (confirmed crash,
the ledger stream), `app/(app)/audit/page.tsx`'s search filter (`.includes(query)` on null — crashes
only when a user actually searches), and `components/shell/DetailPanel.tsx`'s "Actor DID" field
(silently rendered blank, not a crash, but not honest either).

Fixed at the type level (`AuditEvent.actorDid: string | null`, new optional `actorAddress?: string`
— the always-present onchain fallback both `GET_AUDIT_EVENTS`/`GET_DASHBOARD_DATA` already select)
and at all three call sites (`?? event.actorAddress ?? "..."` fallback, matching the exact pattern
`anomalyDetection.ts` already established for the same nullability). Verified fixed live: reloaded
`/dashboard` and `/audit` against the real redeployed contracts with a connected wallet — no crash,
console clean, real events render with real addresses (`DIDRegistry guardian recovery contract
authorized: 0xdc30f7f9…`, etc.), and the `/audit` search box correctly filters by the fallback
address (`0x2972` matches events with a null DID). `npx tsc --noEmit` clean, `npm run lint`
unchanged (0 errors), `npm run build` succeeds.

**Never caught before now** because no prior session in this project's history had a working Chrome
extension connection to actually click through a page with a real wallet against real indexed data
— every previous verification pass was route-level (`curl`, HTTP status codes) or source-reading,
neither of which executes client-side React and so neither could ever hit this class of bug.

---

### T-064 ✅ closed 2026-09-11 — `/dashboard` was hardcoded to the mock persona in every data mode
Found by actually clicking through the live Vercel deployment with a real wallet connected (Chrome
extension), not from source reading — the first real browser verification this session managed to
do. `app/(app)/dashboard/page.tsx` line 37 read `const me = identityByRole[activeRole]`
unconditionally, regardless of `dataMode` — every other page that shows "who am I"
(`/roles`, `/identity`, `/governance`) was fixed to use `useCurrentIdentity()`/`useDidService(...).resolveDID()`
in earlier sessions (T-026, T-055, etc.); the Dashboard's own hero section was missed entirely from
that wave. Live symptom: connecting a real wallet to the redeployed Sepolia site still showed
"Welcome back, Priya" (a mock fixture name) with mock "Admin"/"Admin" badges, completely
independent of the connected wallet or the real on-chain role — the flagship page fabricating an
identity, the exact pattern this project's audits exist to catch, just never caught here because no
prior session had real browser access to click through it with a wallet connected.

Fixed to match the established pattern exactly (`/roles/page.tsx`'s `me`/`myRealIdentity` split):
`myRole`/`myCredentialStatus`/`myRoleExpiresAt`/`myDisplayName` are now derived from
`useCurrentIdentity()` + `didService.resolveDID()` in onchain mode (falling back to the truncated
address for the greeting, matching `TopBar.tsx`'s own convention, since `resolveDID()` honestly
leaves `name` unpopulated onchain — see T-021). `myAssets` now filters by real `ownerAddress` in
onchain mode instead of a mock `ownerDid` comparison. `myApprovals`' signer match now uses
`currentSignerId` (real address onchain, matching T-055's `governanceService` convention) instead
of `me.did`. The "Pending approvals" card and the anomaly banner's role gate now check the real
resolved role instead of the mock role-switcher's `activeRole`. `npx tsc --noEmit` clean, `npm run
lint` unchanged baseline (0 errors), verified 200 locally; the live Vercel deployment still needs
this redeployed to actually show the fix (code fix alone doesn't reach the deployed site).

---

## ✅ Phase 3 — Contract-level fixes (audit §2.2/§2.3/§2.5): DEPLOYED LIVE to Sepolia 2026-09-11

Per explicit sign-off from Rudra, `deploy.ts` then `postDeploySetup.ts` were run for real against
Sepolia — this is now the live deployment, not a pending plan. New addresses in
`deployments/sepolia.json` (all 6 contracts + `ECDSASignatureVerifier`); the old addresses this
file previously referenced (`0xd1de1e...`/`0x309C32...`/etc.) are abandoned, same precedent as the
T-017/T-018 redeploy.

**Verified directly on-chain after deploy, not assumed**: deployer's `SUPER_ADMIN_ROLE` → `false`
(revoked, last step), second admin's → `true`, deployer's `DEFAULT_ADMIN_ROLE` → `true`
(intentionally retained, same as T-020), `DIDRegistry.accessControl()`/`signatureVerifier()`/
`guardianRecoveryContract()` all correctly wired to the real new addresses, issuer wallet's
`ISSUER_ROLE` → `true`, all 7 contracts have real bytecode on Sepolia.

**Subgraph redeployed twice more to track this** (`v11` pointing at the new addresses, `v12` fixing
a bug found while verifying `v11` against real data — see below) — `NEXT_PUBLIC_SUBGRAPH_URL` in
`.env.local` now points at `v12`.

**New finding while verifying `v11`, fixed in `v12`**: `subgraph/src/access-control.ts`'s
`handleActionExecuted` only ever labeled actionType 1/2 descriptively — 3 (unpause) and the new
4/5/6 (T-3.1/T-3.2) all fell through to a generic `"Platform action executed: type=N"` summary,
and my first attempt at fixing this referenced `event.params.account`, which doesn't exist —
`ActionExecuted` only emits `(actionId, actionType)`, and `ActionProposed` doesn't carry
role/account either (a real contract-level gap already flagged as T-032, previously left
permanently `Bytes.empty()`). Fixed for real: `handleActionProposed` now reads the real
`role`/`account` via a bound `pendingActions(actionId)` call (same pattern `asset-registry.ts`
already uses for its own event-data gaps), and `handleActionExecuted` uses that to build a genuine,
address-specific summary per actionType (e.g. "DIDRegistry guardian recovery contract authorized:
0xdc30f7f9…") instead of a raw type number. Verified against live `v12` data: `platformActions`'
`account` field now matches the real `guardianRecovery`/`ecdsaSignatureVerifier`/revoked-deployer
addresses exactly, and `auditEvents` summaries are genuinely descriptive, not placeholders.

**Historical note — the section below is the original design writeup**, kept for the reasoning
behind each fix; treat "not yet deployed"/"not yet implemented" language inside it as describing
the state *before* this deploy, superseded by the paragraphs above.

### 3.1 ✅ Single-signer UUPS upgrade authorization (audit §2.2)
**Files/functions**: `contracts/TimeBoundAccessControl.sol` (`_authorizeUpgrade`, new
`upgradeAuthorized` mapping + `consumeUpgradeAuthorization`, `proposePlatformAction`/
`coSignPlatformAction` extended with actionType 4), `contracts/AssetRegistry.sol`
(`_authorizeUpgrade`). Both `_authorizeUpgrade` overrides previously reduced to a single
`onlyRole(SUPER_ADMIN_ROLE)`/`hasRole(...)` check — one compromised key could push any upgrade.

**Design**: routed through the existing `proposePlatformAction`/`coSignPlatformAction` 2-of-N
pattern rather than a parallel mechanism, exactly as instructed — new `actionType == 4`
(`authorizeUpgrade`) reuses `PendingAction.account` to hold the pending implementation address (no
new struct field). `AssetRegistry` delegates to `TimeBoundAccessControl.upgradeAuthorized(...)` /
`consumeUpgradeAuthorization(...)` rather than duplicating its own 2-of-N staging, since it already
holds an `accessControl` reference. The approval is **consumed on use** (not left standing) — see
the code comment on `consumeUpgradeAuthorization` for why leaving it un-consumed would be a real
downgrade-replay hole, not just tidiness. `consumeUpgradeAuthorization` is intentionally
permissionless (anyone can clear a pending approval) — a documented low-severity griefing/DoS
tradeoff (forces a re-propose+re-co-sign), never a privilege escalation, explained in the code
comment; restricting it would need either a new trusted-caller registry or a reverse dependency
from `TimeBoundAccessControl` onto `AssetRegistry`, both disproportionate here.

**Upgrade-safety**: both contracts are UUPS-upgradeable. `upgradeAuthorized` (and the two mappings
added for 3.2 below) are appended after all existing state variables — nothing reordered or
removed. `AssetRegistry`'s `_authorizeUpgrade` changed from `view` to non-`view` (it now makes a
state-changing external call to consume the approval) — a visibility/mutability change only, not a
storage-layout change, so still upgrade-safe.

**Tests**: `test/TimeBoundAccessControl.test.ts` (6 new cases: closes the single-signer hole,
`upgradeAuthorized` set on 2-of-N, upgrade succeeds once approved, execution is permissionless once
approved, approval consumed on use, `consumeUpgradeAuthorization` works), `test/AssetRegistry.test.ts`
(3 new cases, same shape), `test/Upgrade.test.ts` (existing storage-layout-safety suite updated to
go through the new 2-of-N flow instead of a bare `upgradeProxy` call — this is what actually
exercises the "no reordering" storage-layout check end-to-end, not just the new tests in isolation).

### 3.2 ✅ `DIDRegistry.owner` → routed through `TimeBoundAccessControl` (audit §2.3)
**Files/functions**: `contracts/DIDRegistry.sol` (`owner`/`onlyOwner` removed, constructor now
takes `accessControlAddr`, `setSignatureVerifier`/`setGuardianRecoveryContract` check+consume a
2-of-N approval instead of a bare-address gate), `contracts/TimeBoundAccessControl.sol` (extended
further: actionType 5 = `authorizeDIDSignatureVerifier`, 6 = `authorizeDIDGuardianRecovery`, two
new mappings + two new consume functions, same pattern as 3.1's `upgradeAuthorized`).

**Design**: same propose/co-sign pattern as 3.1, generalized — `DIDRegistry` no longer holds any
bare-address authority at all, only a reference to `TimeBoundAccessControl`.

**Not upgrade-safe by design — requires a fresh deployment.** `DIDRegistry` is intentionally
non-upgradeable (`docs/DATABASE_SCHEMA.md`/`docs/SECURITY.md` treat its storage as a security
boundary). Changing its constructor signature and removing `owner` means the *contract itself* is
different code at a new address — there is no "upgrade" path for it, by design, before or after
this fix.

**What's live on the current `DIDRegistry` right now (verified directly against Sepolia this
session, not assumed)**: `didOf()` returns zero for every address this session holds a key for or
has interacted with, and — independent of any address-specific check — `nextTokenId`/`nextRequestId`
on `AssetRegistry` and `nextTxId` on `GovernanceTimelock` are all `0`. Combined with the subgraph's
own `identities: []` (verified in T-050/T-059's redeploy), there is no real evidence any DID has
ever been created through the live deployment. A redeploy loses nothing real today, but this was
checked, not assumed.

**What cascades (per `GuardianRecovery.didRegistry` being `immutable`)**: `GuardianRecovery` holds
an immutable reference to a specific `DIDRegistry` address set at its own construction — a fresh
`DIDRegistry` deploy means `GuardianRecovery` must also be freshly deployed pointing at the new
address (its own storage — `guardiansOf`/`recoveryThreshold`/`activeRecovery`, also empty per the
same zero-DID finding above — would be abandoned, same as the old contract). Nothing else in the
codebase holds an immutable reference to `DIDRegistry` (checked via
`grep -n immutable contracts/*.sol`).

**Deploy-script bootstrapping — ✅ implemented, smoke-tested, then run for real against Sepolia
2026-09-11** (see this section's top for the live deployment record): `scripts/deploy.ts` reordered
so `TimeBoundAccessControl` deploys first (step 1, was
step 3), then `DIDRegistry(accessControlAddr)` (step 2). The direct `didRegistry.setGuardianRecoveryContract(...)`
call that used to run inside `deploy.ts` right after `GuardianRecovery` deployed is now gone from
that script entirely — it needs 2-of-N `SUPER_ADMIN_ROLE` approval, and only the deployer holds
the role at that point, so it moved to `scripts/postDeploySetup.ts`, which is what actually creates
the second Super Admin.

`postDeploySetup.ts` reordered end-to-end: (1) enroll second `SUPER_ADMIN_ROLE` holder via
`grantTimedRole` from the deployer's `DEFAULT_ADMIN_ROLE` — the same single-signer bootstrap path
T-020 already used live, unchanged; (2) *now* propose+co-sign actionType 6 with the two real Super
Admins and call `setGuardianRecoveryContract`; (3) deploy `ECDSASignatureVerifier`, propose+co-sign
actionType 5, call `setSignatureVerifier`; (4) **only now** revoke the deployer's `SUPER_ADMIN_ROLE`
(actionType 1) — moved from step 2 to step 4, since steps 2–3 still need the deployer as one of the
two signers; (5) grant `ISSUER_ROLE`, unchanged. A shared `proposeAndCoSign` helper replaces the
three near-duplicate propose/co-sign blocks the old script had inline.

**Verified by smoke-testing both scripts' actual logic against Hardhat's ephemeral local network**
(`--network hardhat`, never Sepolia, never real funds) — not just read for plausibility: a combined
run reproducing `deploy.ts` then the full reordered `postDeploySetup.ts` sequence completed all 5
steps and the final on-chain state was checked directly, not assumed: deployer's `SUPER_ADMIN_ROLE`
→ `false`, `secondAdmin`'s → `true`, `didRegistry.guardianRecoveryContract()`/`signatureVerifier()`
both correctly set to the real deployed addresses, issuer's `ISSUER_ROLE` → `true`. The scratch
script and its throwaway `deployments/hardhat.json` output were deleted after — nothing from this
smoke test is committed or was ever real. `npm run test:contracts` (105/105) unaffected.
`lib/hooks/useGovernanceTimelock.ts`'s `useQueueTransaction`/DIDRegistry ABI consumers would need
matching updates at that time too (checked: zero real UI callers of either today, so nothing live
breaks by deferring this).

**Tests**: `test/DIDRegistry.test.ts` (rewritten `beforeEach` to deploy `TimeBoundAccessControl`
first; 3 new/changed cases on `setSignatureVerifier` covering the 2-of-N approval, the closed
single-signer hole, and approval consumption), `test/GuardianRecovery.test.ts` (`beforeEach`
updated to the new `DIDRegistry` constructor + authorized `setGuardianRecoveryContract` call — all
15 existing cases still pass unmodified otherwise), `test/TimeBoundAccessControl.test.ts` (3 new
cases for actionType 5/6 staging).

### 3.3 ✅ `GovernanceTimelock.queueTransaction` single-signer despite its own "multisig" docstring (audit §2.5)
**Files/functions**: `contracts/GovernanceTimelock.sol` — `queueTransaction` (`onlySuperAdmin`,
single signer) replaced by `proposeQueueTransaction`/`coSignQueueTransaction` (new `PendingQueue`
struct/mapping, `QUEUE_THRESHOLD = 2`).

**Design decision, stated explicitly (`AI_DEVELOPMENT_RULES.md` §7)**: unlike 3.1/3.2, this does
**not** reuse `TimeBoundAccessControl.proposePlatformAction`'s `PendingAction` struct — that struct
has no field that can hold arbitrary-length `bytes calldata data`, only a fixed `bytes32 role` +
`address account` pair, and hashing/committing `data` for a later reveal would be a materially
different (and more complex) design than what 3.1/3.2 needed. Instead, `GovernanceTimelock` gained
its own native propose/co-sign staging, deliberately mirroring the exact idiom
`TimeBoundAccessControl` already established elsewhere (proposer auto-signs, `DuplicateSigner`/
already-executed checks, 2-of-N threshold) — the same *pattern*, scoped to the contract that
actually owns this data, rather than forcing a parallel-but-incompatible reuse.

**Not upgrade-safe by design — requires a fresh deployment.** `GovernanceTimelock` is
non-upgradeable by the same design choice as `DIDRegistry`. **Cascade check**: nothing in the
codebase holds an immutable reference to `GovernanceTimelock`'s address (`grep -n immutable
contracts/*.sol` — only `GuardianRecovery.didRegistry` and each contract's own `accessControl`
reference exist as immutables; nothing points at `GovernanceTimelock`), so this redeploy's blast
radius is just the one contract. **What's live today**: `nextTxId() == 0` on the current deployment
(verified directly against Sepolia this session) — no transaction has ever been queued, so nothing
real is lost by a redeploy.

**Breaking interface change**: `queueTransaction(address,bytes,uint256)` no longer exists — replaced
by the two-step `proposeQueueTransaction`/`coSignQueueTransaction`. `lib/hooks/useGovernanceTimelock.ts`'s
`useQueueTransaction` hook (checked: zero real callers anywhere in `app/`/`lib/services/*` today) would
need updating to the two-step call at actual cutover — not done in this pass, not blocking anything live.

**Tests**: `test/GovernanceTimelock.test.ts` — `queueNoOp` test helper (used throughout the file's
`executeTransaction`/`raiseDispute`/`resolveDispute` suites) rewritten to the 2-step flow; the old
`queueTransaction` describe block replaced with 7 cases covering the new flow, including the closed
failure mode (a lone `SUPER_ADMIN` proposing alone never populates `queue`) and duplicate/already-
executed edge cases. All 4 downstream describe blocks that depend on `queueNoOp` still pass
unmodified.

### 3.4 — Optional, skipped this pass (audit §2.1 / T-019's naming half)
`AssetRegistry.proposeMint`'s `recipientDid` parameter (which actually holds a `vcId` — T-019's
functional bug was already closed frontend-only) is genuinely optional per the original instruction
("only do this one if 3.1–3.3 are already fully written up"). Not done: a real rename touches the
`MintProposed`/`AssetMinted` event parameter names too, which cascades into
`subgraph/generated/AssetRegistry/AssetRegistry.ts`'s auto-generated bindings and
`subgraph/src/asset-registry.ts`'s `.recipientDid` usage — meaning a full rename needs its own
`graph codegen`/`graph build`/redeploy cycle to actually verify, not just a Hardhat-test-level diff.
Disproportionate for a pure code-clarity fix with no functional gap remaining. Ask for this to be
picked up as its own item if wanted.

### Full test-suite output (this session, after 3.1–3.3)
```
npm run test:contracts
  105 passing (2s)
```
90 pre-existing tests + 15 new (6 for 3.1's `TimeBoundAccessControl` cases, 3 for 3.1's
`AssetRegistry` cases, 3 for 3.2's actionType 5/6 staging, plus `test/DIDRegistry.test.ts`/
`test/GuardianRecovery.test.ts`/`test/Upgrade.test.ts`/`test/GovernanceTimelock.test.ts` updated
in place rather than net-new) — **0 failing**. `npx tsc --noEmit` clean, `npm run lint` unchanged
baseline (76 warnings, 0 errors).

---

## 🔴 High Priority — T-021–T-037: Phase 10 onchain-mode stubs

Catalogued 2026-09-09 during the post-Phase-10 audit (see `CHANGELOG.md`'s "Corrected" note under
Phase 10). `NEXT_PUBLIC_DATA_MODE` defaults to `mock` precisely because these aren't done yet — per
`AI_DEVELOPMENT_RULES.md` Rule Zero, the default does not flip to `onchain` until every item below
is either genuinely wired or explicitly gated to fail loudly instead of silently faking success.

### `lib/services/didService.ts` — B.1, closed 2026-09-09 (T-021/T-022/T-024), fully closed 2026-09-11 (T-023/T-025)
- **T-021** ✅ `resolveDID` — real `useResolveDID(did)` read, adapted to `Identity`. `name`/`department`
  are left as `""` (would need fetching `metadataURI`'s ipfs:// content — no current caller reads
  these two fields off `resolveDID`'s result, so this wasn't built; revisit if that changes).
  `role` is genuinely derived from 5 real `useHasRole` checks against the resolved controller.
- **T-022** ✅ `listCredentials` — real subgraph query (`GET_CREDENTIALS_BY_SUBJECT`) filtered by subject.
- **T-023** ✅ closed 2026-09-11 — `getGuardians`'s `activeRecovery` now comes from the subgraph's real
  `Recovery` entity (added for T-039, see below) instead of being left `undefined` — the missing
  event/subgraph source this item was blocked on now exists.
- **T-024** ✅ `createDID` — generates a real keypair client-side (`viem/accounts`), uploads real
  `{name, department}` metadata to IPFS via `/api/ipfs/upload` (loosened to accept any metadata
  shape with a `name`, not just asset metadata — see that route + `docs/API_SPEC.md`), and submits
  the real public key + real `ipfs://` metadataURI. The generated private key is stored in
  `localStorage` (prototype-grade only, per `docs/SECURITY.md` — not real custody).
- **T-025** ✅ closed 2026-09-11 — `initiateRecovery` now submits a real transaction in onchain mode
  (see T-039).

### T-039 ✅ closed 2026-09-11 — Built the real guardian-actor UI
Design decision made (not escalated, per the reasoning below — this was dictated by how the contract
actually works, not an arbitrary style choice): kept `/identity/recovery` as the "view my own status"
page (it already worked correctly for this) and added a **separate** page,
`/identity/recovery/guardian`, for "act as a guardian for someone else." These have to be different
pages — `initiateRecovery`/`signRecovery` can only ever be called by a registered guardian's own
wallet, never by the affected person's, so there is no single "my own did" framing that serves both.
The new console takes an explicit target DID (mock: dropdown; onchain: bytes32 input) rather than
assuming "my own" — the contract's own `NotAGuardian()` revert is the real check for whether the
connected wallet is entitled to act, matching this app's "frontend is UX only" principle everywhere
else. `initiateRecovery` now collects the real `newController`/`newPubKey` inputs it always needed
(communicated to the guardian out-of-band by the affected person — this app has no mechanism for that
hand-off, same as any real social-recovery scheme).

**Also built, a genuine prerequisite this item's own text didn't call out**: there was no UI anywhere
to actually *register* guardians in the first place (`useRegisterGuardians` existed, unused; the
Command Palette's "Register Guardians" entry navigated to `/identity?action=guardians`, which
`/identity/page.tsx` never read — a fully dead menu item). Added a "Register guardians" card to
`/identity`, shown self-service when none exist yet.

**Subgraph work required to show real signer counts, closes T-046 too**: `GuardianRecovery.sol` had
no subgraph mapping at all. Added `subgraph/src/guardian-recovery.ts` + a new `Recovery` entity +
`subgraph.yaml` dataSource, verified via `graph codegen`/`graph build`. Attempted a real redeploy
(`--version-label v6`) — failed with the same "Subgraph not found" as T-050 (third confirmation now
across three separate redeploy attempts this project); ready to ship the moment that's resolved.

**Found and fixed along the way, not previously suspected**:
- `lib/services/didService.ts`'s mock branch: `getGuardians()`/`listCredentials()` read from the
  *static* fixture helpers (`guardianSetFor`/`credentialForDid`), not the reactive Zustand store
  (`store.guardianSets`/`store.credentials`) that mutations actually write to. This meant the
  existing "Simulate recovery" button (and, less visibly, T-051's `issueCredential` for any caller
  other than the issuing page itself) never actually showed up in the UI in mock mode — a real,
  user-visible bug, not just an onchain gap. Fixed by reading from the store instead.
- `/identity/recovery/page.tsx`'s "Finalize recovery" button had no `onClick` handler at all — dead
  even when enabled. `finalizeRecovery` is genuinely permissionless (anyone can call it once
  threshold + timelock are met, including the affected person themselves), so this is now wired for
  real with error surfacing, not left for the new guardian console to cover.

**Not built this pass**: no UI flags an off-boarded guardian (their own DID/role later revoked) —
`docs/FEATURES.md` F1.3's edge case, tracked as a follow-up.

### T-062 ✅ closed 2026-09-11 — Off-boarded guardian indicator (F1.3's flagged edge case)
Built `components/modules/GuardianStatusBadge.tsx`: a small warning badge (never a block —
`GuardianRecovery.sol` still allows an off-boarded guardian to sign, this is UI-only) shown per
guardian row when that guardian's own resolved identity has `credentialStatus === "revoked"`. Mock mode
resolves via the existing `findIdentity(guardianRef)`; onchain mode resolves the guardian's DID from
its address via `useDIDOf` (same reverse lookup `useCurrentIdentity` uses) then reuses
`useDidService(did).resolveDID()` — the same `resolveDID`/`hasRole`-derived `credentialStatus` every
other identity display in the app already relies on, not a new derivation. Wired into the two real
per-guardian list UIs: `/identity/recovery` (viewing my own guardians) and
`/identity/recovery/guardian` (acting as guardian for someone else). **Scoping note**: the top-level
`/identity` page never had a per-guardian list to begin with — only a `"N configured"` count on the
Guardians stat (see T-039) — so there's no individual row there to attach a badge to; the two pages
above are the app's actual guardian-list surfaces. `tsc --noEmit` clean; `npm run lint` unchanged
(76 warnings, 0 errors).

### T-040 ✅ closed 2026-09-10 — `app/auth/page.tsx`'s "Simulate (demo)" button fakes wallet-signature authentication
`handleSimulateResolve` flips the UI through "resolving" → "done" via two `setTimeout`s and redirects
to `/dashboard`, without ever calling `signMessage` or resolving anything real. Fixed by gating the
button behind `dataMode === "mock"` (hidden entirely in onchain mode), same pattern as the role
switcher. See also **T-045** below — a real gap this fix surfaced, not fixed in this pass.

### T-044 ✅ closed 2026-09-10 — Dashboard "Simulate" button fabricated live-looking chain events in *any* data mode
Found in the 2026-09-10 gap audit (§2.4). `app/(app)/dashboard/page.tsx`'s `simulateLiveEvent()`
injects a synthetic `AuditEvent` with a fabricated `0x####…####` tx hash straight into the same list
used for real subgraph-indexed events, and — unlike T-040's button — it wasn't gated by `dataMode` at
all, so it was live and fabricating in onchain mode too. Fixed with the same `dataMode === "mock"`
gate as T-040.

### T-045 ✅ closed 2026-09-11 — `app/auth/page.tsx`'s real sign-in path now resolves for real
Added a `useEffect` watching `step === "resolving"` against `useCurrentIdentity()` (the same
address→DID hook `TopBar.tsx` already uses): once resolution finishes and a real DID exists, it
advances to `"done"` and redirects to `/dashboard`, same as before. `didOf(address)` only needs the
connected address, not the signature itself — there's no on-chain/server-side signature verification
anywhere in this flow (the signed challenge is discarded after `onSuccess`, same as before this fix;
a connected wallet is already treated as proof of key control everywhere else in the app, e.g.
`useCurrentIdentity` itself). This makes the fix mode-aware for free: mock personas resolve instantly
(`isResolving=false`, `hasNoDid=false` by construction), so the same effect closes the dead-end in
mock mode too, not just onchain — previously, actually signing for real (rather than clicking
"Simulate (demo)") dead-ended in mock mode as well, just usually unnoticed since Simulate was always
available there.

**New case handled, not previously possible to reach**: a real wallet with a valid signature but no
registered DID (`hasNoDid`). Previously this would have hit the same infinite spinner forever (worse
than before T-040's fix, since Simulate is now hidden in onchain mode). Now shows an honest "Signature
verified, but no DID is registered for this wallet yet" state with a link to `/identity` (which already
has the real `createDID` flow) — never silently claims "Authenticated" for a wallet with no identity
to authenticate as.

### `lib/services/rbacService.ts` — B.2, closed 2026-09-09 (T-026/T-028/T-041), stopgapped (T-027)
- **T-026** ✅ `grantTimedRole` — resolves the target DID's real controller address via the new
  `resolveControllerAddress` (`lib/hooks/useDIDRegistry.ts`, an imperative `readContract` call, not
  a hook — the target `did` is only known inside a click handler, not at render time) before calling
  the real contract function. `revokeRole` also resolves the address, then determines which role to
  revoke via a new `findActiveRole` (`lib/hooks/useAccessControl.ts`) imperative check across the 5
  checkable roles — the mock interface's `revokeRole(did, revokedBy)` doesn't carry a role argument
  at all, so this couldn't be a hardcoded fix; it had to be resolved for real at call time.
- **T-027** `getRoleExpiry` — confirmed zero callers anywhere in the app (`listIdentities()`'s
  `roleExpiresAt` field already covers this per-row). Stopgapped with a clear thrown error per
  Phase A.3 rather than building unverifiable machinery for a dead code path.
- **T-028** ✅ `requestRole` — confirmed no on-chain self-service path exists
  (`TimeBoundAccessControl.sol` / `docs/API_SPEC.md`: only `grantTimedRole`/`proposePrivilegedGrant`,
  both Admin/Super-Admin-initiated). Now an honest thrown "no self-service path — contact an Admin"
  error; `app/(app)/roles/request/page.tsx` shows this as a static message instead of the old fake
  "Request submitted" success state.
- **T-041** (found during B.2, not in the original catalogue) `listIdentities` — same category of bug
  as T-031/T-032 (mock fixtures returned unconditionally in the onchain branch), just missed in the
  original audit. Without a real list, T-026's fixes would have nothing real to operate on — grantTimedRole/revokeRole
  would still be resolving fake fixture dids. Now a real `GET_IDENTITIES` subgraph query, adapted via
  the new `lib/services/shared/credentials.ts` (shared with `didService.ts` to avoid duplicating the
  credential-status/role-derivation logic). `name`/`department` are `""` for the same reason as T-021 —
  would need N ipfs:// metadata fetches for a list this size, not done this pass.

### `lib/services/assetService.ts` — B.3, closed 2026-09-09 (T-029/T-030/T-042), fully closed 2026-09-11 (T-031/T-063), stopgapped (T-043)
- **T-029** ✅ `proposeMint` — now throws if `vcId`/`recipient` are missing instead of defaulting to
  a zero placeholder; both reach the real transaction as-provided from the mint page's raw inputs.
- **T-030** ✅ `transferAsset` — real `transferFrom` via the new `useTransferAsset` hook
  (`lib/hooks/useAssetRegistry.ts`); resolves the recipient DID to a real address via
  `resolveControllerAddress` and reads the asset's real current `ownerAddress` (added to the
  `Asset` type — mock mode leaves it `undefined`) rather than guessing the `from` argument.
  `app/(app)/assets/[tokenId]/transfer/page.tsx` no longer redirects on click — it waits for
  `assetService.isTransferConfirmed` (a real `useWaitForTransactionReceipt` result) via `useEffect`.
- **T-031** ✅ `listAssets`/`getAsset` — real `GET_ASSETS` subgraph query, each asset's real
  IPFS-pinned metadata (`name`/`category`) fetched and merged in (worth the extra round-trip here,
  unlike didService's name/department, since `Asset.name` is prominently displayed everywhere —
  a failed fetch shows "(metadata unavailable)", never a blank or fabricated name). `getProvenance`
  itself is stopgapped, see below.
- **T-063** ✅ closed 2026-09-11 — `status` is now real for `"finalized"`/`"transferred"`, not always
  `"finalized"`. `Asset.ownerAddress` mutates on every real `Transfer` (`asset-registry.ts`'s
  `handleTransfer`), so once a transfer happens there was no field left recording the *original*
  mint-time recipient to compare against — added `Asset.mintRecipient: Bytes!` to
  `subgraph/schema.graphql`, populated once in `handleAssetMinted` from the correlated
  `MintRequest.recipient` (linked via `AssetMinted`'s own `requestId` param — a field that already
  existed on `MintRequest`, not fabricated for this). `lib/services/assetService.ts` derives
  `status: ownerAddress === mintRecipient ? "finalized" : "transferred"` (case-insensitive; a
  `"0x"`/empty `mintRecipient` — the rare case the originating `MintRequest` wasn't found — falls
  back to `"finalized"` rather than a false-positive "transferred"). Redeployed as subgraph `v10`,
  verified schema accepts the new field against live data (currently `assets: []` — no asset has
  been minted through the real UI yet, same as everywhere else in this session).
  **`"disputed"` intentionally not derived** — this contract has no asset-level dispute concept,
  only `GovernanceTimelock`'s generic queued-transaction disputes, and nothing links a
  `GovernanceTx`/`Dispute` back to a specific `tokenId` (would mean regex-matching free-text
  summaries against a target/calldata heuristic — the same category of fragile guess T-043 already
  declined for `getProvenance`, not worth it for a list-view status either).
- **T-042** (found during B.3, not in the original catalogue) — **higher severity than a stub**:
  the old onchain `proposeMint` submitted the real transaction correctly but then **returned a
  hardcoded fake `Asset` object** (`assetById(0) ?? assets[0]!`) regardless of what was actually
  proposed, and the mint page's `handleCoSign` synchronously faked `{...asset, status: "finalized"}`
  on click without waiting for the real co-sign transaction at all. Both fixed: `proposeMint`/
  `coSignMint` no longer return anything; callers read progress from new reactive fields
  (`lastRequestId`, `isProposeConfirmed`, `lastMintedTokenId`, `isCoSignConfirmed`) that resolve
  instantly in mock mode and only once a real transaction confirms onchain.
- **T-043** `getProvenance` — confirmed zero callers anywhere in the app, same pattern as T-027/
  dead-code stopgaps. If a caller appears: `AuditEvent` has no `assetId`/`targetId` field to filter
  by (checked against `schema.graphql`) — a real implementation means fetching the event stream and
  regex-matching `"#<tokenId>"` against the free-text `summary` field, honest but fragile enough
  that it's worth building deliberately rather than guessing at a call site that doesn't exist yet.

### T-051 ✅ closed 2026-09-10 — Verifiable-Credential issuance had no UI anywhere (audit §4.1)
`lib/hooks/useCredentialRegistry.ts`'s `issueCredential` hook was fully built but had zero callers in
`app/`/`components/` — once a real DID existed on Sepolia, there was no way through the product itself
to issue it a credential (someone would have to call the contract directly). Built
`app/(app)/identity/issue/page.tsx` (ISSUER_ROLE-gated — note ISSUER_ROLE lives on `CredentialRegistry`
itself, a separate `AccessControl` instance from `TimeBoundAccessControl`'s 5-role hierarchy, so a new
`useHasIssuerRole` hook was needed rather than reusing `useAccessControl.ts`'s `useHasRole`), wired
through a new `didService.issueCredential` method (mock branch pushes a real `Credential` into the
mock store; onchain branch submits a real transaction with a `vcHash` genuinely computed from the
credential's actual subject/issuer/role/validUntil fields, and decodes the real resulting `vcId` from
the transaction's `CredentialIssued` log, same pattern as `assetService`'s `useProposeMint`). Linked
from `/identity`'s header (shown only to issuers). Updated `docs/USER_FLOWS.md` step 5 and
`docs/FEATURES.md` F1.2 (revised its UI description — no DID directory/detail-panel exists yet to hang
a panel off of, so this ships as a standalone route instead, and flagged that the "already has a
non-expired credential of this role" edge case isn't checked yet — see **T-052**).

### T-052 ✅ closed 2026-09-11 — `/identity/issue` now warns on an existing non-expired credential
Added a second `useDidService(subjectDid)` instance (distinct from the issuer's own, already used for
`issueCredential`) to read the subject's existing credentials, and a warning banner (shown, not
blocking — the contract allows it) when one already exists for the selected role, non-expired and
non-revoked, naming its `vcId` and expiry.

**Corrected `docs/FEATURES.md` F1.2 while implementing this**: its edge-case note said "most recent
`validUntil` governs authorization checks" — checked the contract and that's not accurate.
`CredentialRegistry.issueCredential` keys each `Credential` by an independent `vcId`
(`keccak256(subjectDid, issuerDid, vcHash, block.timestamp)`); issuing a new credential doesn't revoke
or supersede an older one for the same subject+role — both stay independently valid, and whichever
specific `vcId` a consumer (e.g. `AssetRegistry.vcIdOf[tokenId]`) references is what's actually
checked, not "the newest one for this subject." The warning is purely an anti-duplicate nudge for the
issuer, not a reflection of any conflict-resolution the contract performs.

### `lib/services/governanceService.ts` — closed 2026-09-10 (T-032–T-035), with major adjacent findings
- **T-032** ✅ `getProposals`/`getDisputes` now query real subgraph entities (`GET_PLATFORM_ACTIONS`
  over `PlatformAction`, `GET_GOVERNANCE` over `GovernanceTx`+`Dispute`), adapted to the
  `GovernanceProposal`/`TimelockTransaction` shapes. `role`/`account` on `PlatformAction` stay empty
  in the adapted output — `ActionProposed` genuinely doesn't emit them
  (`contracts/TimeBoundAccessControl.sol:60`), a contract-level limitation, not a mapping gap.
- **T-033** ✅ `proposeAction` now branches per kind for real: `pause`/`unpause` unchanged (already
  correct); `removeAdmin` → `proposePlatformAction(1=emergencyRevoke, ADMIN_ROLE, account)`;
  `addAdmin` → the real `proposePrivilegedGrant` (new hook, see below) since privileged grants use a
  separate `pendingGrants` mapping/threshold from `pendingActions`; `upgrade` throws an honest "not
  yet supported" error (no on-chain path exists — `_authorizeUpgrade` is single-signer only, TODO §3.2,
  contract change gated behind sign-off). Extended the interface with an optional `target` param
  (account + validUntil) since the old signature couldn't carry what real addAdmin/removeAdmin need —
  safe because `proposeAction` has zero real UI callers today (see **T-054**).
- **T-034** ✅ `approveProposal` no longer calls `BigInt()` on a mock-shaped string. Onchain proposal
  ids are now prefixed by which pending-item mapping they live in — `action-<actionId>` or
  `grant-<grantId>` — decoded from the proposing transaction's real event log
  (`useProposePlatformAction`'s new `actionId` field, `useProposePrivilegedGrant`'s new `grantId`
  field, both added to `lib/hooks/useAccessControl.ts`, same log-decoding pattern as
  `useProposeMint`'s `requestId`). `approveProposal` branches on the prefix to call
  `coSignPlatformAction` or the new `useCoSignGrant`.
- **T-035** ✅ `resolveDispute` now calls a real `useResolveDispute` hook (new, in
  `lib/hooks/useGovernanceTimelock.ts`) wrapping `GovernanceTimelock.resolveDispute(txId, proceed)` —
  confirmed the function exists and behaves as the audit described (`proceed: true` returns the tx to
  Queued, `false` cancels it permanently) — instead of unconditionally calling `executeTransaction`.

#### Major finding while implementing T-032: the subgraph manifest didn't match the contracts at all
`subgraph/subgraph.yaml` declared **wrong event signatures** for 5 of the ~20 event handlers across
`TimeBoundAccessControl`, `CredentialRegistry`, `DIDRegistry`, and `AssetRegistry` — wrong event names
(`RoleGranted` vs. the contract's actual `TimedRoleGranted`), wrong param counts (`ActionProposed`
declared with 5 params, the deployed contract's is 3; `MintProposed` similarly overcounted), and wrong
param types (`KeyRotated`'s 2nd param declared `bytes`, actually `indexed address`;
`CredentialRevoked`'s 2nd param declared `indexed address`, actually `uint256`; `AssetMinted`'s params
declared in the wrong types/order entirely). Confirmed by running `graph codegen`, which failed outright
with "Event with signature '...' not present in ABI" for every one of these — **this subgraph could not
have been built from the current state of `contracts/` + `subgraph/src/*.ts` + `subgraph/subgraph.yaml`
all together**, regardless of anything in this session's scope. The `.ts` mapping files themselves were
already written correctly against the real event params (confirmed by reading e.g.
`asset-registry.ts`'s `event.params.recipientDid` usage, which only makes sense against the real
4-param `AssetMinted`) — only the manifest's declared signatures had drifted. Fixed all 5, plus added
two previously-missing handlers needed for this session's own fixes to actually reflect state correctly:
`ActionCoSigned` (populates `PlatformAction.coSigner`, which the schema already declared but no handler
ever set — without it, `getProposals()`'s "1/2 signed" state was unobservable) and `DisputeResolved`
(populates `Dispute.resolved`/`proceeded`/`resolvedBy`/`resolvedAt` — new schema fields; without it,
T-035's real `resolveDispute` calls would succeed on-chain but a resolved dispute would show as
still-disputed forever in `getDisputes()`). `graph codegen` and `graph build` both succeed cleanly
after these fixes — verified in this session, not assumed.

**Also found, likely inert (not fixed — compiles fine, not a blocker):** `TimeBoundAccessControl`'s
manifest binds `handleRoleRevoked` to the inherited OZ `AccessControl.RoleRevoked` event, but the
contract never calls `_revokeRole`/`renounceRole` anywhere — emergency revocation works purely by
setting `roleExpiry` to `block.timestamp` inside `coSignPlatformAction`'s actionType==1 branch, which
already correctly surfaces as a `"RoleRevoked"` audit event via `handleActionExecuted`. This handler
binding is real, valid, and harmless, just structurally unreachable.

**Attempted, blocked: could not actually redeploy.** Ran `graph deploy praman-setu subgraph.yaml
--studio --deploy-key <the GRAPH_DEPLOY_KEY from .env.local> --version-label v4` after confirming a
clean local build — it failed with **"Subgraph not found."** This is a Graph Studio-side rejection
(the deploy key doesn't correspond to an existing `praman-setu` subgraph slot under whatever account it
belongs to), not a build or code problem — see **T-050** below, which this directly confirms and
sharpens: the "Not found" the live query endpoint returns isn't a transient/network issue, it's that
the subgraph slot itself doesn't currently exist (or isn't reachable by this deploy key). Creating a
Graph Studio subgraph slot is a one-time dashboard action (studio.thegraph.com) that needs a human with
account access — this session has the deploy key but not that access. All the fixes above are ready to
deploy the moment that slot exists: run `npm run deploy:studio -- --deploy-key <key> --version-label
v5` (or whatever label) from `subgraph/`, then update `.env.local`'s `NEXT_PUBLIC_SUBGRAPH_URL` to the
resulting query URL.

### T-054 ✅ closed 2026-09-11 — Built the "Propose Admin change" form
Added a "Propose Admin change" dialog to `/governance` (gated to Super Admin, next to the Multisig
queue heading): kind select (Add/Remove Admin), a target-identity field (mock: dropdown; onchain: DID
hash, resolved to an address via `resolveControllerAddress` at submit time), and a validity-period
select for Add Admin. Calls the real `governanceService.proposeAction` branching built for T-033.

**Found while wiring this up, and fixed in the same pass**: `getProposals()` only ever queried
`PlatformAction` entities (`removeAdmin`/`pause`/`unpause`, via `proposePlatformAction`) — `addAdmin`
goes through a *completely separate* `proposePrivilegedGrant`/`pendingGrants` mapping on the contract
that had no subgraph entity or mapping at all (same category of gap as T-032's original finding, just
for the grant side instead of the action side). Without fixing this, a real "Add Admin" proposal
would have succeeded on-chain and then **silently vanished** from the visible queue — nothing to
co-sign, no sign that it ever happened, the exact "fabricated success" pattern this whole project's
audits exist to catch, just inverted (a broken *absence* of real state instead of a fabricated
presence). Fixed by adding a `PendingGrant` entity (`subgraph/schema.graphql`), `handleGrantProposed`/
`handleGrantCoSigned` mappings (`subgraph/src/access-control.ts` — `GrantProposed` genuinely emits
`role`/`account`, unlike `ActionProposed`, so both are real here), the corresponding manifest entries,
and a `GET_PENDING_GRANTS` query merged into `getProposals()` alongside `PlatformAction` results
(`grant-<id>` vs `action-<id>` prefixes, matching `approveProposal`'s existing dispatch from T-034).
`graph codegen`/`graph build` both verified clean. Attempted a real redeploy
(`--version-label v5`) — failed with the same **"Subgraph not found"** as T-050; this fix is ready to
ship the moment that slot exists, verified by a clean local build and IPFS upload, not just source
review.

Note: `handleGrantCoSigned` marks a grant `executed` on every `GrantCoSigned` event, relying on
`GRANT_THRESHOLD` being the hardcoded constant `2` — the proposer auto-signs on `proposePrivilegedGrant`,
so the one `coSignGrant` call that ever succeeds is necessarily the one that reaches threshold. Flagged
in a code comment; would need a real signer-count check if that constant ever changes.

### T-055 ✅ closed 2026-09-11 — Governance pages are now `dataMode`-aware
`/governance`, `/governance/approvals`, and `/governance/disputes` now resolve "me" the same way
`/roles`/`/identity` do: `useCurrentIdentity()` for the real connected wallet in onchain mode, with
`useDidService(myDid).resolveDID()`'s derived `.role` backing `canPause`/`canRaise`/`canResolve`
instead of the mock-only demo role switcher. `currentSignerDid` passed into `MultisigApprovalWidget`
now uses the real connected **address** in onchain mode (not DID) — matching T-032's onchain
`getProposals()` adapter, which keys `signers[].did` by address since multisig co-signing on
`TimeBoundAccessControl` is by `msg.sender`, not DID — so the "already signed" check now actually
matches a real signer. All three pages' write actions (`pause`/`unpause`/`approveProposal`/
`raiseDispute`/`resolveDispute`/`executeTransaction`) are now awaited with real error surfacing
(`actionError` state), matching the `/roles` convention, instead of firing-and-forgetting.

**2026-09-11 follow-up — closed the `proposedBy`/`raisedBy`/`resolvedBy`/`executedBy` leftover**: all
three pages previously passed `me.did` unconditionally into these arguments, even in onchain mode where
`me.did` is a DID and the real per-mode actor identifier should be an address (same reasoning as
`currentSignerDid` above). This was functionally harmless *today* — confirmed every onchain service
implementation ignores these arguments, the real actor is always `msg.sender` — but was still wrong to
leave: it read as if DID were the correct shape everywhere, and would silently regress the moment any
of these arguments became load-bearing (e.g. if a future audit-log/analytics layer started using them).
Introduced a `currentSignerId`/`currentActorId` value per page (address onchain, DID in mock, same
pattern as the `MultisigApprovalWidget` fix), coalesced to `""` rather than `undefined` to match
`me.did`'s existing safety pattern, and replaced every `me.did` passed as an actor argument with it.

### `lib/services/auditService.ts`
- **T-036** ✅ closed 2026-09-10 — `dismissAlert` was a no-op in onchain mode; the dismissal was
  silently dropped. Added a minimal server-side dismissed-ids store (`lib/server/dismissedAlerts.ts`,
  a JSON file at `data/dismissed-alerts.json`, gitignored) plus a new `POST /api/audit/anomalies`
  endpoint (documented in `docs/API_SPEC.md`, new state documented in `docs/DATABASE_SCHEMA.md` §4.1).
  `GET /api/audit/anomalies` now overlays dismissed status/reason onto each freshly-recomputed
  anomaly by its deterministic id. `app/(app)/audit/anomalies/page.tsx` now awaits the real call and
  surfaces failures instead of firing-and-forgetting.
  - **Found while fixing this**: the route's velocity-check anomaly used `status: "investigating"`,
    which isn't a member of `AnomalyAlert.status`'s `"open" | "dismissed"` union — so it matched
    neither the "Open alerts" nor "Resolved" filter on the anomalies page and silently never
    rendered. Normalized to `"open"`. Also found: every anomaly object from this route was missing
    `severity` and `actorDid`, both required, non-optional fields on `AnomalyAlert` — `AlertCard.tsx`
    indexes `severityMeta[alert.severity]` unconditionally, so a real onchain anomaly would have
    **crashed the anomalies page** (`Cannot read properties of undefined`) the first time this route
    ever returned real data. Fixed by adding `severity` per rule (`critical` for emergency-pause,
    `warning` for velocity) and `actorDid: event.actorAddress` (the raw address, not a resolved DID —
    `findIdentity()` simply won't match it in onchain mode, which is an honest degrade, not a crash).
  - **Not fixed this pass**: no frontend/API test framework exists anywhere in this repo (only
    Hardhat contract tests — `docs/TESTING.md`'s Frontend/Integration/E2E sections describe a plan
    with zero actual implementation, no test runner in `package.json`). `AI_DEVELOPMENT_RULES.md` §5
    asks for a happy-path + auth-failure test on every new endpoint; introducing a whole test
    framework (Vitest/Jest + route-handler testing) to satisfy that for one endpoint felt like a
    bigger, separate infrastructure decision than this fix warranted — flagging as **T-049** rather
    than deciding unilaterally.
- **T-037** ✅ closed 2026-09-10 — `subscribeToEvents` was a no-op in both branches. Decision: kept
  as polling rather than building real `wagmi` `useWatchContractEvent` wiring, since `getEvents()`/
  `getAnomalies()` already poll live (5s/10s `refetchInterval`) and there are zero real callers of
  `subscribeToEvents` anywhere in the app. Documented explicitly in a code comment
  (`lib/services/auditService.ts`) and in `docs/API_SPEC.md` — the onchain branch now throws a clear
  error naming this decision instead of silently no-op-ing (same pattern as T-027/T-043's stopgaps).

### T-050 ✅ closed 2026-09-11 — The configured live subgraph deployment currently returns "Not found"
Found 2026-09-10 while smoke-testing the T-036/T-037 fixes end-to-end against real onchain mode
(`NEXT_PUBLIC_DATA_MODE=onchain` is set in this machine's `.env.local`, pointed at
`NEXT_PUBLIC_SUBGRAPH_URL=https://api.studio.thegraph.com/query/1758953/praman-setu/v3` — the exact
URL this file's "Already done, verified live on-chain" section above claims is "deployed to Graph
Studio and indexing with zero errors"). Querying that URL directly (`curl -X POST ... -d
'{"query":"{ _meta { block { number } } }"}'`) returns `HTTP 200 {"message":"Not found"}` — not a
network/timeout error, a real "this path doesn't exist" from Graph Studio's API. Every onchain-mode
page that depends on the subgraph (`/dashboard`, `/audit`, `/audit/anomalies`, `/identity` credential
lookups, `/roles`, `/assets`, governance) is affected — confirmed `GET /api/audit/anomalies` 500s with
this exact cause when actually run. This blocks live verification of every subgraph-backed onchain
fix in this session (T-036–T-038, T-047, and the governanceService/didService work below) — all of it
was verified by direct source reading and `tsc`/`next build`/lint, the same limitation the 2026-09-10
audit itself flagged for contract compilation, not by exercising it against real indexed data. Needs
a redeploy of `subgraph/` to Graph Studio (or a corrected URL, if the subgraph is alive under a
different version tag) before treating onchain mode as demo-ready.

**2026-09-10 update, while closing T-032–T-035**: this is sharper than "the endpoint returns Not
found" — an actual `graph deploy praman-setu ... --deploy-key <GRAPH_DEPLOY_KEY>` attempt (after fixing
the manifest bugs documented under the governanceService entry below and confirming a clean local
`graph build`) failed with **"Subgraph not found"** directly from Graph Studio's deploy endpoint. The
`praman-setu` subgraph slot itself doesn't exist (or isn't reachable) under whatever Graph Studio
account this deploy key belongs to — not a network/config issue on this session's end. Needs a human
with Graph Studio dashboard access (studio.thegraph.com) to (re)create the `praman-setu` subgraph slot
before any `graph deploy` can succeed — this session has the deploy key but not dashboard access. Every
subgraph fix made this session (manifest signatures, two new handlers, two new schema fields) is
verified buildable and ready to ship the moment that slot exists.

**2026-09-11 update, while closing T-054**: reconfirmed — a second `graph deploy ... --version-label
v5` attempt (this time shipping the new `PendingGrant` entity/mappings) failed with the identical
"Subgraph not found", after another clean local `graph codegen`/`graph build` and a successful IPFS
upload of the build artifacts. This isn't a one-off; the slot is genuinely absent every time.

**2026-09-11 update, while closing T-039**: reconfirmed a third time — `--version-label v6` (shipping
the new `GuardianRecovery`/`Recovery` entity/mappings) failed identically. Three separate redeploy
attempts across two sessions, same manifest slot, same "Subgraph not found" every time.

**2026-09-11 — actually closed.** Rudra confirmed the `praman-setu` Studio project now exists and
provided a fresh `GRAPH_DEPLOY_KEY`. `graph auth --studio <key>` + `graph deploy ... --version-label
v8` succeeded for the first time — `_meta { block { number } hasIndexingErrors }` returned a real,
current block number (`11675189`, matching live Sepolia head) with `hasIndexingErrors: false`, not
`{"message":"Not found"}`. The Studio-side rejection this item tracked is genuinely resolved.

**Immediately found a second, compounding bug while verifying v8 against real data (see T-059
below)**: even with a working Studio slot, `identities`/`assets`/`roleGrants`/etc. all came back
empty on v8 — not because there's no real on-chain activity, but because `subgraph/subgraph.yaml`'s
contract addresses had been silently zeroed to `0x000...000` for all five pre-existing data sources
in the T-039 commit (git history confirms: `git log -p -- subgraph/subgraph.yaml` shows the real
deployed addresses being replaced with the zero address in that diff, alongside the new
`GuardianRecovery` data source that legitimately started unaddressed). Fixed by restoring the real
addresses from `deployments/sepolia.json` and setting `startBlock: 11665400` (the real deploy block,
matching Phase 9's original fix — it had also regressed back to `0`) on all six data sources.
Redeployed as `v9`; `.env.local`'s `NEXT_PUBLIC_SUBGRAPH_URL` now points there. Verified against real
data, not just a clean build: `roleGrants` now returns the real 3 `SUPER_ADMIN_ROLE` grants (matching
the `hasRole()` addresses confirmed live in T-020), `auditEvents` shows the real `RoleGranted`×3 /
`RoleRevoked`×1 history, and `platformActions` shows the real emergencyRevoke action id `0` from the
T-017/T-018 incident. `identities`/`credentials`/`assets`/`mintRequests`/`pendingGrants`/
`governanceTxes`/`disputes`/`recoveries` are all genuinely empty — no DID has ever been created and no
asset ever minted through the real UI yet, consistent with T-019's existing note, not a bug.

### T-060 ✅ closed 2026-09-11 — `governanceTxs` was the wrong GraphQL field name (real, live query break)
Found while re-verifying every onchain-mode subgraph query against the now-real `v9` endpoint (T-050's
own text asked for this: "treat this as genuinely new verification work, not a formality"). Tested
every named query in `lib/queries.ts` directly against the live subgraph — `GET_GOVERNANCE` and
`GET_DASHBOARD_DATA` both failed with `"Type Query has no field governanceTxs"`. The Graph's
auto-generated plural query field for the `GovernanceTx` entity is `governanceTxes` (its own
pluralization convention for a name ending in `Tx`), not `governanceTxs` — confirmed by querying
`governanceTxes` directly, which returns real data.

`GET_DASHBOARD_DATA` has zero callers anywhere in the app (dead code, same category as T-027/T-043) —
fixed for correctness/future-proofing but wasn't live-breaking anything. `GET_GOVERNANCE` **is** live:
`governanceService.ts`'s `governanceQuery` backs `getDisputes()`, consumed by `/governance` and
`/governance/disputes`. Because the broken query's result was accessed as
`governanceQuery.data?.governanceTxes ?? []` (an `?? []` fallback with no error surfaced anywhere in
the service's return object — no `disputesError` field exists), this failure was **completely silent**:
every dispute, forever, would have rendered as "no disputes," indistinguishable from the real,
honest empty state currently on-chain — the exact "fabricated success by omission" pattern this
project's audits exist to catch, just newly discovered rather than previously flagged. Fixed by
renaming the field in both queries (`lib/queries.ts`) and the two consuming references in
`lib/services/governanceService.ts` (the typed `.request<{...}>()` call and the `.data?.` access).
Re-verified directly against the live `v9` endpoint post-fix (`{"data":{"governanceTxes":[]}}`, no
error) — genuinely empty right now (no governance transactions have been queued yet), not broken.
`tsc --noEmit` clean after the fix.

### T-059 ✅ closed 2026-09-11 — `subgraph/subgraph.yaml`'s addresses were silently zeroed in T-039
See T-050's closing note above for the full finding — recorded here as its own item since it's a
distinct regression (a manifest-authoring mistake), not the Studio-access problem T-050 tracked.
Whoever wrote the T-039 diff (adding the `GuardianRecovery` data source, which correctly starts as
`0x000...000` pending deploy) appears to have templated all six data sources from the same
unaddressed scaffold, overwriting the five *already-live* addresses that had been correctly set since
Phase 9's redeploy. Every subsequent "clean build" claim between T-039 and this fix (T-046, T-054's
build/IPFS-upload verification) was real as far as it went — `graph codegen`/`graph build` don't
validate that an address is non-zero or actually has the expected bytecode, only that the manifest is
well-formed — but none of those builds would have indexed anything even if the Studio slot had existed
the whole time. This is exactly the kind of gap T-050's own "verified by source reading, not by
exercising it" caveat was warning about, just one level deeper: even the *build* step didn't have a
way to catch a real regression here, since it's a stale-value bug, not a stale-schema-vs-manifest
mismatch. No test/lint catches this class of bug; flagged as worth a one-line sanity note in
`docs/DEPLOYMENT.md`'s redeploy runbook (verify every data-source address against
`deployments/<network>.json` before any `graph deploy`, not just a clean local build) rather than
building actual tooling for it — out of scope for this pass.

### T-056 ✅ closed 2026-09-11 — `docs/DATABASE_SCHEMA.md` fully synced against the real schema/contracts
Found while writing `governanceService.ts`'s subgraph queries (2026-09-10), fixed in a dedicated pass.
§2's GraphQL block is now copied verbatim from the real, buildable `subgraph/schema.graphql` (11
entities — `Identity`, `Credential`, `RoleGrant`, `Asset`, `MintRequest`, `PlatformAction`,
`PendingGrant`, `GovernanceTx`, `Dispute`, `Recovery`, `AuditEvent` — the old sketch had a
`GovernanceAction` entity that never existed and was missing `MintRequest`/`PendingGrant`/`Recovery`
entirely). §3 (Relationships) and §4 (Indexes) updated to match (no `Asset.ownerDid`/`RoleGrant.expiresAt`
— the real fields are `Asset.owner`/`RoleGrant.validUntil`).

**Also verified and corrected §1 (on-chain storage) and §5 (constraints) directly against the contract
source while doing this pass, not just §2**: `GovernanceTimelock` has no separate `disputes[txId]`
mapping — dispute fields live inside the same `queue[txId]` struct alongside a 4-value `Status` enum,
not a boolean `executed`. §5's claim that `TimeBoundAccessControl.grantTimedRole` checks for a valid
credential was **false** — that function has no credential-related code path at all, verified directly
against the source. §5's mint constraint pointed at a function literally named `mint`, which doesn't
exist — it's enforced in `coSignMint` (`SameSignerNotAllowed()`).

**New finding, out of this item's scope, not fixed**: `docs/API_SPEC.md` §2's entire "Off-Chain Read
API" section describes REST endpoints (`GET /identities`, `GET /assets?ownerDid=`, `GET /role-grants`,
`GET /governance/queue`, `GET /audit`) that don't exist as real routes — only `/api/audit/anomalies`
and `/api/ipfs/upload` are real (`find app/api -type d` confirms). The frontend queries the subgraph
directly via GraphQL (`lib/queries.ts`/`lib/graphql.ts`), bypassing this REST surface entirely. Whether
this was a planned-then-abandoned design or is meant to be built later isn't something to guess at —
flagging for a decision, not fixed here.

### T-053 ✅ closed 2026-09-11 — Added a real `executeTransaction` path
Added `GovernanceService.executeTransaction(txId, executedBy)`: onchain, it wraps the
`useExecuteTransaction` hook (`lib/hooks/useGovernanceTimelock.ts`, already built for T-035, just
unused since then) — permissionless per the contract, `executedBy` is accepted for interface symmetry
but not actually used onchain. Mock mode gained a matching `mockDataStore.executeTransaction` action
(a never-disputed "queued" tx had no way to become "executed" in the mock model either, same gap on
both sides) that mirrors the real contract's preconditions (queued status, `eta` passed). UI: an
"Execute" button on `/governance/disputes`' queued-tx row, visible once a live-ticking clock shows
`eta` has passed — no role gate, matching `executeTransaction`'s real permissionless access control.

### T-049 ✅ closed 2026-09-11 — Wired up a real frontend/API-route test framework
Found while closing T-036 (2026-09-10). `docs/TESTING.md` §2–4 (Frontend Unit Tests, Integration
Tests, End-to-End Tests) describe a testing plan, but `package.json` had no Jest/Vitest/Playwright/
React Testing Library dependency and no `test`-equivalent script beyond `test:contracts` (Hardhat).

Picked **Vitest** — `docs/TECH_STACK.md`/`docs/TESTING.md` name React Testing Library for future
component tests but don't pin a runner, and Vitest is the ESM-native standard for a Next.js 14 App
Router + TypeScript stack (no separate ts-jest/babel transform config needed, shares Vite's resolver).
Added `vitest.config.mts` (`.mts` so the native Vite config loader doesn't warn about ESM-in-CJS; the
project's `package.json` has no `"type": "module"`) with a `@/*` path alias matching `tsconfig.json`,
`environment: "node"` (no DOM tests exist yet — switch a file to `"jsdom"` per-test via a docblock, or
the global config, whenever the first component test is added), and excludes `test/` (the pre-existing
Hardhat contract suite, which must stay on `hardhat test`/Mocha, not Vitest). New `package.json`
scripts: `test` (`vitest run`, CI-style single pass) and `test:watch`.

Wrote a proportionate first batch, matching `docs/TESTING.md` §2's own suggested scope plus
`AI_DEVELOPMENT_RULES.md` §5's requirement for new endpoints:
- `lib/utils.test.ts` — all four exported helpers (`truncateMiddle`, `formatRelativeTime`,
  `formatCountdown`, `expiryLevel`) across their branch boundaries, plus `cn`'s Tailwind-merge/falsy
  behavior. 16 cases.
- `app/api/audit/anomalies/route.test.ts` — `POST /api/audit/anomalies` (the endpoint T-036 added with
  no test at the time): happy path (valid `id`+`reason` dismisses and returns `{ok:true}`), two
  validation-failure cases (missing `id`, missing `reason`, both 400 without touching the store), and a
  malformed-JSON-body case (handled 500, not a crash). `dismissAlert`/`getDismissedAlerts` are mocked
  via `vi.mock` so the test doesn't depend on real filesystem state in `data/`. 4 cases.
  Note: this endpoint has no auth check of its own (nothing in the codebase gates it), so "auth-failure"
  from §5 doesn't apply literally here — validation-failure is the closest real analog and is covered.
  `GET /api/audit/anomalies` is not covered by this pass: it makes a live `GraphQLClient` call against
  `NEXT_PUBLIC_SUBGRAPH_URL` with no seam to inject a fake response without a larger refactor (e.g.
  extracting the anomaly-computation logic from the route handler) — flagging as a **follow-up**, not
  fixing here as a drive-by.

20/20 tests pass (`npm run test`). Full validation cycle also run clean: `tsc --noEmit` (0 errors),
`npm run lint` (76 warnings, 0 errors — unchanged baseline), `npm run build` (succeeds), `npm run
test:contracts` (90/90 passing, untouched by this change).

### T-058 ✅ closed 2026-09-11 — `GET /api/audit/anomalies`'s heuristics now have real test coverage
Found while closing T-049 (2026-09-11). The route computed two real anomaly-detection heuristics
(velocity check across role-grant events, emergency-pause detection) inline inside the handler, driven
by a live `GraphQLClient.request()` call against `NEXT_PUBLIC_SUBGRAPH_URL`, with no seam to feed it a
fixed set of fake subgraph events.

Fixed by extracting the pure `events -> anomalies` computation into `lib/server/anomalyDetection.ts`
(`computeAnomalies(events)`, same thresholds/output shape as before — a refactor, not a behavior
change), which `route.ts`'s `GET` handler now calls instead of inlining the loop.
`lib/server/anomalyDetection.test.ts` exercises it directly with fixed fake event arrays: empty input,
no-match input, the emergency-pause rule (fires once even if the event repeats), the velocity rule
(3-within-an-hour fires, 2-within-an-hour and 3-spread-beyond-an-hour don't, non-role event types are
ignored, multiple offending actors are flagged independently), and both rules firing together. 13 cases.

Also closed the adjacent gap this made visible: `GET`'s own route-level wiring (subgraph-config-missing
failure, upstream-request-failure, and the happy path incl. the dismissed-alert overlay and riskScore
sort) had no test either, only `POST` did. Added 3 more cases to
`app/api/audit/anomalies/route.test.ts` mocking `graphql-request`'s `GraphQLClient` so no real network
call happens.

`npm run test`: 33/33 passing (was 20/20 after T-049). Full validation cycle also run clean: `tsc
--noEmit` (0 errors), `npm run lint` (76 warnings, 0 errors — unchanged baseline), `npm run build`
(succeeds, bundle sizes unchanged — pure refactor), `npm run test:contracts` (90/90, untouched).

### Audit event labeling
- **T-038** ✅ closed 2026-09-10 — `KeyRotated` was missing from the `EventType` union in
  `lib/mock/fixtures/auditEvents.ts`, so a real `KeyRotated` audit event from the subgraph had no
  matching frontend type/icon/tone. Added back to `EventType`, `EventRow.tsx`'s `eventMeta` (new
  `KeyRound` icon, `alert` tone), and `app/(app)/audit/page.tsx`'s filter dropdown (`eventTypes`),
  which had also silently dropped it. Cross-checked every `audit.type = "..."` assignment across
  `subgraph/src/*.ts` against the union — `KeyRotated` was the only value the subgraph emits that the
  union was missing. See **T-046** below for the inverse gap this check surfaced.
- **T-046** ✅ closed 2026-09-11 (while closing T-039) — `GuardianRegistered`/`RecoveryInitiated`/
  `RecoveryFinalized` are in the `EventType` union but the subgraph never emitted them:
  `subgraph/src/` had mapping files for every other contract but none for `GuardianRecovery.sol`.
  Added `subgraph/src/guardian-recovery.ts` (`handleGuardiansRegistered`/`handleRecoveryInitiated`/
  `handleRecoverySigned`/`handleRecoveryFinalized`) and the corresponding `subgraph.yaml`
  `GuardianRecovery` dataSource — needed anyway for T-039's guardian console to show real signer
  counts (see below), not built as a standalone fix.

---

## ✅ Resolved — T-017 / T-018 (redeploy, 2026-09-09)

**T-017** (untracked address holding `SUPER_ADMIN_ROLE`) and **T-018** (deployer retaining
`DEFAULT_ADMIN_ROLE`) were both closed, but not by patching the old deployment — see the incident
note below for why. The platform is now on a **fresh deployment** (new addresses in
`deployments/sepolia.json` / `.env.local`, new subgraph at `.../praman-setu/v3`) produced by a
clean, unmodified `deploy.ts` + `postDeploySetup.ts` run with no manual grants in between. On this
deployment: exactly one tracked address holds `SUPER_ADMIN_ROLE` (`deployments/sepolia.json`'s
`mockWallets.secondSuperAdmin`), and the deployer **still holds `DEFAULT_ADMIN_ROLE`** —
deliberately, this time, as a documented decision (see T-020) rather than an oversight.

### Incident note: the first T-017/T-018 fix caused a lockout
Revoking the unknown address's `SUPER_ADMIN_ROLE` and then renouncing the deployer's
`DEFAULT_ADMIN_ROLE` (in that order, on the *original* deployment) left the contract with exactly
one `SUPER_ADMIN_ROLE` holder and no `DEFAULT_ADMIN_ROLE` holder at all. Since adding a new Super
Admin requires either `DEFAULT_ADMIN_ROLE` or 2-of-3 co-signatures, and only one legitimate signer
remained, **the contract could never grant `SUPER_ADMIN_ROLE` to anyone again** — a genuine
self-lockout, verified by reading `grantTimedRole`'s `onlyRole(getRoleAdmin(role))` gate. This is
why the fix here is a redeploy rather than a further patch to that instance: with essentially zero
real state on it (no DIDs, no assets, no team onboarded yet), redeploying was cheaper and safer
than an upgrade-based recovery. The old contract addresses are abandoned; nothing on them should
be referenced going forward.

### T-020: `DEFAULT_ADMIN_ROLE` is intentionally still held by the deployer
Unlike the first attempt, this deployment does **not** renounce the deployer's `DEFAULT_ADMIN_ROLE`
— it's the only path to add a third Super Admin (or recover from a lost key) as long as there are
only two. Before renouncing it for real: either enroll a third Super Admin first (restoring 2-of-N
headroom), or ship a UUPS upgrade to `TimeBoundAccessControl` adding a proper recovery path that
doesn't depend on `DEFAULT_ADMIN_ROLE`. Until one of those happens, treat this as a deliberate,
tracked trade-off, not a forgotten checklist item — don't "fix" it again without doing one of those
first.

**2026-09-11 update — real 2-of-N headroom restored.** Per explicit user request, granted
`SUPER_ADMIN_ROLE` (1-year `validUntil`, via `grantTimedRole` from the deployer's `DEFAULT_ADMIN_ROLE`
— real transactions, confirmed on Sepolia) to two real addresses:
- `0xD9Bd20FDC3A25C1e4C612cB44BF85C7CD6B5a5ED`
- `0x38c10EAEb7BF06ECC0c5273533465E85717C3E38` (this is also the recorded `deployer` in
  `deployments/sepolia.json` — it already held `DEFAULT_ADMIN_ROLE` and now holds `SUPER_ADMIN_ROLE`
  too, same as the original `initialize(superAdmin)` grant before T-017/T-018's revocation).

Live `SUPER_ADMIN_ROLE` holders as of this grant (confirmed via `hasRole`, not assumed):
`0xD9Bd20FDC3A25C1e4C612cB44BF85C7CD6B5a5ED`, `0x38c10EAEb7BF06ECC0c5273533465E85717C3E38`, and the
pre-existing `mockWallets.secondSuperAdmin` (`0xdE183D969BbeA5596d95b362C20d54fDA2C5939F`) — **three**
real holders now, meaning every 2-of-N multisig action this session's Phase 1–2 work depends on
(governance proposals, privileged grants, platform actions) can now actually reach threshold, and the
Phase 3 plans' "enroll a second Super Admin first" prerequisite is satisfied. `deployments/sepolia.json`
was not updated with these two addresses (it only tracks addresses generated by `deploy.ts`/
`postDeploySetup.ts`, not manually granted ones) — this note is the record of the grant.

**Superseded 2026-09-11 by the Phase 3 redeploy — everything above this line describes the *old*,
now-abandoned deployment.** The Phase 3 redeploy (`deployments/sepolia.json`, `accessControl` =
`0x0a100F8c9389B723Aa0c92F63fE4F05E7737ECC3`) never carried any of the grants above forward — its own
`postDeploySetup.ts` run only granted `SUPER_ADMIN_ROLE` to the deploying account
(`0x38c10EAEb7BF06ECC0c5273533465E85717C3E38`) and then deliberately revoked it again as its last
step (see the Phase 3 section at the top of this file), leaving only that same address holding
`DEFAULT_ADMIN_ROLE` and **no address at all** holding `SUPER_ADMIN_ROLE`. Re-verified live via
`hasRole()` before touching anything further, not assumed from this note — see below.

### T-020 correction (2026-09-11) — real named Super Admins, deployer/recovery separated
Corrected target, per explicit instruction: Super Admin duties and deploy/recovery custody are
different people/purposes and should not share an address.

- **Super Admin 1 — Rudra** — `0xb28EBde85D12Fd402ff8Daa7CFE1C84Bc449AD88` — `SUPER_ADMIN_ROLE`.
- **Super Admin 2 — Shivansh** — `0x38c10EAEb7BF06ECC0c5273533465E85717C3E38` — `SUPER_ADMIN_ROLE`
  only. This is the same address `deployments/sepolia.json` records as `deployer` (it deployed the
  Phase 3 contracts and so became the initial `superAdmin` in `initialize()`), but going forward it
  is a working Super Admin, not a standing deploy/recovery key.
- **Deployer/recovery — a separate, dedicated account** — `0xD9Bd20FDC3A25C1e4C612cB44BF85C7CD6B5a5ED`
  — holds `DEFAULT_ADMIN_ROLE` only (never-expiring `roleExpiry`, via `grantTimedRole` — a plain
  `grantRole` would leave `roleExpiry` at 0 and make `hasRole()` always return `false` under this
  contract's overridden check, so `grantTimedRole` is required even for `DEFAULT_ADMIN_ROLE`). Not a
  working Super Admin — this is the break-glass key that can grant `SUPER_ADMIN_ROLE` to a
  replacement if either Rudra's or Shivansh's key is ever lost.
- The old placeholder `0xdE183D969BbeA5596d95b362C20d54fDA2C5939F` was never granted anything on the
  Phase 3 deployment (it only ever held a role on the old, abandoned one) — no action needed.

**Live-state check before acting (2026-09-11, on the Phase 3 `accessControl` contract, not the old
one)**: `hasRole()` for all four addresses above showed every one of them `false` for both
`SUPER_ADMIN_ROLE` and `DEFAULT_ADMIN_ROLE` except Shivansh, who held `DEFAULT_ADMIN_ROLE = true`
(the deploy's initial grant) and `SUPER_ADMIN_ROLE = false` (revoked as the deploy's last step).
`getRoleAdmin(SUPER_ADMIN_ROLE)` and `getRoleAdmin(DEFAULT_ADMIN_ROLE)` both returned `bytes32(0)` —
this contract never overrides either, so it's the standard OZ hierarchy: `DEFAULT_ADMIN_ROLE` is its
own admin and also the admin of `SUPER_ADMIN_ROLE`. `proposePlatformAction`/`coSignPlatformAction`
(including `authorizeUpgrade`, actionType 4) are gated purely by `onlyRole(SUPER_ADMIN_ROLE)` — no
reference to `DEFAULT_ADMIN_ROLE` anywhere in either function, confirmed by reading
`TimeBoundAccessControl.sol` directly, not assumed. Smoke-tested the full sequence on a local Sepolia
fork (impersonated Shivansh, no real funds/state touched) before broadcasting; scratch scripts
deleted after.

**Executed for real on Sepolia**, each step verified with a real `hasRole()` read before the next was
sent (all from Shivansh's key — the only one available in this environment — since he held
`DEFAULT_ADMIN_ROLE`, the admin of both roles being touched):

1. `grantTimedRole(SUPER_ADMIN_ROLE, 0xb28EBde85D12Fd402ff8Daa7CFE1C84Bc449AD88, +1yr)` —
   tx `0x1cc926f0f5427330383777738225a52138ad7cc855c14f5ca4ae82955f09fca5`
2. `grantTimedRole(SUPER_ADMIN_ROLE, 0x38c10EAEb7BF06ECC0c5273533465E85717C3E38, +1yr)` —
   tx `0xb7436f4845fca7928b18519a11ba43f97d24687f8ec1d304bced432e03ec4af6`
3. `grantTimedRole(DEFAULT_ADMIN_ROLE, 0xD9Bd20FDC3A25C1e4C612cB44BF85C7CD6B5a5ED, never-expires)` —
   tx `0x882b67c0680bbe845ea7cada3f0ca6d0103d274236cef932a8b0d2e2fdfe2a2a` — verified
   `hasRole(DEFAULT_ADMIN_ROLE, 0xD9Bd20...) == true` before proceeding to step 4.
4. `revokeRole(DEFAULT_ADMIN_ROLE, 0x38c10EAEb7BF06ECC0c5273533465E85717C3E38)` (self-revoke, per
   explicit user decision — see below) — tx
   `0xe71847945039de1ad50cc8abaede3ab0ea1642513e24e39e52249022805c1575` — verified
   Shivansh's `DEFAULT_ADMIN_ROLE` is now `false` and the recovery account's is still `true`
   immediately after.

`emergencyRevoke` (the original plan's Step 4, `proposePlatformAction`/`coSignPlatformAction`
actionType 1) turned out to be unnecessary: on the Phase 3 deployment, neither the recovery account
nor the old placeholder had ever held `SUPER_ADMIN_ROLE`, so there was nothing to revoke via that
path.

**Final confirmed live state (all four `hasRole()`, re-read after every transaction, not assumed):**

| Address | Role | `SUPER_ADMIN_ROLE` | `DEFAULT_ADMIN_ROLE` |
|---|---|---|---|
| `0xb28EBde85D12Fd402ff8Daa7CFE1C84Bc449AD88` | Rudra (Super Admin 1) | `true` | `false` |
| `0x38c10EAEb7BF06ECC0c5273533465E85717C3E38` | Shivansh (Super Admin 2) | `true` | `false` |
| `0xD9Bd20FDC3A25C1e4C612cB44BF85C7CD6B5a5ED` | Deployer/recovery | `false` | `true` (never expires) |
| `0xdE183D969BbeA5596d95b362C20d54fDA2C5939F` | Old placeholder | `false` | `false` |

**Resolved — Shivansh's `DEFAULT_ADMIN_ROLE` fully revoked, not kept as redundant backup.** The
original plan for this correction left this open as a question rather than deciding it, specifically
because revoking the last-but-one `DEFAULT_ADMIN_ROLE` holder is the one step in this whole sequence
that risks being unrecoverable if done wrong. Per explicit, repeated instruction from Rudra given
after that risk was laid out, it was executed anyway — safely, in the order the risk itself demands:
the recovery account's `DEFAULT_ADMIN_ROLE` grant was sent and verified `true` first, and only then
was Shivansh's revoked, with a final `hasRole()` re-check confirming exactly one holder
(`0xD9Bd20...`) remained. **The system now has a single `DEFAULT_ADMIN_ROLE` holder — the dedicated
recovery account — with no redundancy.** If that account's key is ever lost, there is no path to
recover `DEFAULT_ADMIN_ROLE`, same class of risk as the T-017/T-018 incident; back it up accordingly.

### T-019 ✅ functional impact closed 2026-09-10 (frontend-only, §3.1(a)); contract naming itself untouched
`proposeMint`'s second parameter is still literally named `recipientDid` in the deployed contract (not
`vcId` as `docs/API_SPEC.md` describes), and `coSignMint` still stores whatever bytes32 it's given
directly into `vcIdOf[tokenId]` — the contract itself doesn't know or care whether that value is a real
`vcId` or a DID hash; both are just `bytes32`. The bug was never really "the contract checks the wrong
thing" — `_update()`'s `credentialRegistry.isValid(vcIdOf[tokenId])` check is correct as written. The
actual bug was **`app/(app)/assets/mint/page.tsx` asking the operator to type in a DID hash** instead of
a real `vcId` from `CredentialRegistry.issueCredential` (which had no UI to call at all until T-051).
Per the 2026-09-10 gap audit §2.1's plan and explicit sign-off (option (a), the frontend-only fix, no
contract change): the mint page's field now clearly asks for a real `vcId`, links to `/identity/issue`
(T-051) to get one, and its help text no longer suggests entering a DID hash. Any *asset minted before
this fix* through the real UI (there are none yet on the live Sepolia deployment — confirmed via
`ownerOf`/event queries, zero tokens minted) would still be stuck with a DID hash in `vcIdOf`, since
this is a workflow fix, not a data migration. The contract's parameter is still misleadingly named
`recipientDid` — that remains a pure code-clarity issue now, not a functional one, and doesn't block
anything. A contract-level rename option (renaming the param/storage to match reality, or changing the
transfer-gating check to be DID-based instead of VC-based) was drafted as part of this session's Phase 3
contract-change plans but not approved or implemented — ask for that plan to be regenerated if the
rename is ever wanted for its own sake.

---

## ✅ Already done, verified live on-chain (this file previously listed these as blocked)

**Superseded 2026-09-11 by the Phase 3 redeploy** (see the top of this file) — every address named
below is from the *old*, now-abandoned deployment. The new `deployments/sepolia.json` has fresh
addresses for all 7 contracts, and the specific facts below (who holds `SUPER_ADMIN_ROLE`, which
wallets exist) no longer describe the live system — they're kept here as the historical record of
what was verified about the old deployment, not a claim about the current one. The current
deployment's own equivalent verification is in the Phase 3 section at the top of this file.

What follows used to be listed as blocked on credential provisioning. Verified directly against
Sepolia and the live Graph Studio subgraph in this session — not from a doc, from `eth_getCode`,
`hasRole()`, and `_meta` queries against the real endpoints:

- Deployer wallet funded, `.env.local` fully populated (Alchemy RPC, deploy key, WalletConnect
  project ID, Graph deploy key).
- All 6 core contracts deployed to Sepolia (`deployments/sepolia.json`), bytecode confirmed live
  on-chain at every recorded address (re-confirmed 2026-09-11 via a direct `eth_getCode` script, not
  re-read from this note).
- Subgraph deployed to Graph Studio and indexing with zero errors — **re-verified 2026-09-11, and this
  specific claim was false at the time it was written**: T-050 later proved the live query endpoint
  actually 404'd, and T-059 found the manifest's contract addresses had also been silently zeroed. Both
  are now genuinely fixed (`v9`, see T-050/T-059) and `_meta`/entity queries against the real deployed
  addresses return real data, not just `hasIndexingErrors: false` on an empty/misaddressed indexer.
- Post-deploy checklist: second Super Admin enrolled and confirmed live, `ECDSASignatureVerifier`
  deployed and wired into `DIDRegistry` (`signatureVerifier()` matches `deployments/sepolia.json`),
  `guardianRecoveryContract()` also confirmed wired to the real `GuardianRecovery` address,
  `ISSUER_ROLE` granted to the recorded issuer wallet — all reconfirmed live 2026-09-11 via direct
  `hasRole`/`signatureVerifier`/`guardianRecoveryContract` calls, not assumed from this note.
  **Correction**: this bullet previously also said "deployer's `SUPER_ADMIN_ROLE` revoked" — that was
  true only briefly, between the original T-017/T-018 fix and T-020's later re-grant. As of T-020, the
  deployer (`0x38c10EAEb7BF06ECC0c5273533465E85717C3E38`) deliberately holds `SUPER_ADMIN_ROLE` again
  (plus its pre-existing `DEFAULT_ADMIN_ROLE`) — reconfirmed live 2026-09-11: all three addresses named
  in T-020's note (`0xD9Bd2...`, `0x38c10...`, `0xdE183...`) currently hold `SUPER_ADMIN_ROLE`, matching
  T-020, not this stale bullet.
- WalletConnect modal (`lib/web3modal.ts` + `Web3Providers.tsx`) is wired and real.

---

## 🟢 Medium Priority — Polish & Robustness

### T-015: ZK Privacy Module (Phase 4) — labeling fixed 2026-09-10, implementation still open
Implement Zero-Knowledge proofs for selective credential disclosure and transaction privacy.
**2026-09-10 (audit §4.2):** the `/identity` page's "Generate proof" button (`runZkDemo`) fabricated a
Semaphore-style verification result via `setTimeout` in *every* data mode, with no ZK library anywhere
in `package.json`. Fixed the honesty gap without building the real thing (out of scope for this pass):
the card is now `dataMode === "mock"`-only, carries a visible "Illustrative — not a real proof" badge,
its copy no longer implies a live Merkle-root check, and `docs/FEATURES.md` F1.4 /
`docs/SECURITY.md` §5.2 both now explicitly say "not yet implemented, Phase 4 roadmap" instead of
reading like a shipped mitigation. The actual Semaphore/snarkjs integration remains open.

**2026-09-11 scope decision**: per explicit instruction from Rudra, this is no longer staying as a
roadmap item for the hackathon submission — the real Semaphore/snarkjs integration is now in scope
to build. Not started yet as of this note; needs its own implementation plan (circuit design,
`snarkjs`/`circomlib` dependency choice, where verification happens on/off-chain) before writing
code, given the size of this addition.

### T-016: Oracle Attestation (Phase 4)
Integrate decentralized oracles for off-chain data validation.

**2026-09-11 scope decision**: per explicit instruction from Rudra, this is also now in scope to
build for real for the hackathon submission, not left as roadmap.

**2026-09-11 — built, tested, and fork-rehearsed; NOT YET deployed to live Sepolia.** Implements the
gap-analysis §2.2.5 requirement directly ("decentralized oracle design with multiple independent
attestors and a dispute window before an oracle-fed fact becomes final on-chain"), distinct from the
already-built dual-attestation mint flow (§2.3.3, mint-time-only). Closes a real, previously-permanent
frontend gap: `lib/services/assetService.ts` used to document that `AssetStatus`'s `"disputed"` value
could never be derived onchain because "this contract has no asset-level dispute concept" — it has one
now.

Design (approved plan, `/Users/rudra/.claude/plans/hashed-doodling-moore.md`):
- New `ORACLE_ATTESTOR_ROLE` on the live `TimeBoundAccessControl` — added via a genuine in-place UUPS
  upgrade (first one ever performed in this project; the prior "upgrade," T-3.1/T-3.2, was actually a
  full fresh redeploy) using a new `reinitializer(2)` function (`initializeOracleAttestorRole`) passed
  atomically as `upgradeToAndCall`'s `data` argument, so there's no window where the implementation is
  swapped but the new role's admin is unset.
- New actionType 7 (`authorizeOracleAttestationContract`) on `proposePlatformAction`/
  `coSignPlatformAction`, mirroring actionType 5/6's exact pattern.
- New non-upgradeable `contracts/OracleAttestation.sol` (mirrors `GovernanceTimelock.sol`'s
  propose→2-of-N co-sign→dispute-window→dispute/resolve→finalize shape): `submitFact`/`attestFact`
  (`ATTESTATION_THRESHOLD = 2`, same precedent as every other multisig gate in this codebase),
  `raiseDispute`/`resolveDispute` (Auditor/Super Admin, same roles as `GovernanceTimelock`), `finalize`
  (permissionless after a `DISPUTE_WINDOW = 15 minutes` — intentionally short for live-demo purposes,
  not a production security parameter, flagged in `docs/SECURITY.md`).
- `AssetRegistry.sol` gets `oracleFactsOf`/`latestOracleFactType` (append-only) and
  `recordOracleFact`, gated to the one address authorized via actionType 7 — also a live in-place
  upgrade (second one in this pass; needs no reinitializer, new state defaults acceptably).
- Frontend: `lib/services/shared/assets.ts`'s new `deriveOracleDisputeOverride` makes `"disputed"` a
  real, live-derived asset status in both mock and onchain mode — verified live in a real browser
  (not just route-level checks): raising a dispute on a fact for a "finalized" asset flips its badge
  to "disputed" and hides the transfer button immediately, and resolving the dispute flips it back.
  New `app/(app)/assets/[tokenId]/page.tsx` "Oracle facts" card (submit/attest/dispute/resolve inline)
  and a dedicated `app/(app)/oracle/facts/page.tsx` review queue, both role-gated
  (`ORACLE_ATTESTOR_ROLE`/`AUDITOR_ROLE`/`SUPER_ADMIN_ROLE` onchain; `MANAGER`/`AUDITOR`/`SUPER_ADMIN`
  personas in mock mode — mock has no dedicated 6th demo persona for the new role, reusing `MANAGER`
  rather than rippling a new value through every `Record<Role,...>` in the app for a cosmetic swap).
- Subgraph: new `OracleFact` entity + `subgraph/src/oracle-attestation.ts` mapping, plus a new
  `OracleFactRecorded` handler on the existing `AssetRegistry` dataSource. `subgraph.yaml`'s new
  `OracleAttestation` dataSource has a placeholder address/startBlock until the live deploy happens.

**Caught and fixed during real-browser verification**: the review page originally rendered
`new Date(fact.disputeWindowEnd).toLocaleTimeString()` directly, which produced a genuine React
hydration mismatch (server and client evaluate `Date.now()`-derived fixture timestamps at different
instants, so the second-precision clock string differed) — same class of bug T-064/T-065 only caught
via real browser clicks, not source review. Fixed by switching to the existing `formatCountdown`
helper (minute-granularity, matching the rest of the app's already-established time-rendering
convention) instead of a raw wall-clock string.

**Verified before touching anything live**: 128 Hardhat contract tests passing (19 new
`OracleAttestation.test.ts`, 4 new `Upgrade.test.ts` cases exercising the real reinitializer
mechanism and the AssetRegistry wiring, 1 existing `TimeBoundAccessControl.test.ts` boundary updated
for the new valid actionType), 40 Vitest tests passing (3 new for `deriveOracleDisputeOverride`),
`npm run lint`/`npm run build` clean, subgraph `codegen`/`build` clean. A new
`scripts/forkRehearsal_oracleAttestation.ts` (plus a `HARDHAT_FORK_URL`-conditional fork config added
to `hardhat.config.ts`) replayed the *entire* live deployment sequence — both upgrades, the new
contract deploy, the actionType-7 wiring, and a full submit→attest→wait→finalize fact lifecycle —
against a forked copy of real Sepolia state, impersonating the two real Super Admin addresses (Rudra,
Shivansh; no private keys needed). It passed cleanly.

**2026-09-11 — live Sepolia deployment started, per explicit go-ahead; in progress, awaiting a
co-sign.** Deployed for real and proposed via Shivansh's key:

- New `TimeBoundAccessControl` implementation: `0x1Be5125fEB98401Ec27A3EF79c7f41B490Fe3C49`
  — `proposePlatformAction(4, ...)` → **actionId 3**, tx
  `0x2f0360bd9e753c335af7f5e0fda3de9e2f9b6d7c7879a186003013220ad2ffde`.
- New `AssetRegistry` implementation: `0x82e14A3CeE7ce1eF53D1C8D07fac15FDe5A0F08F`
  — `proposePlatformAction(4, ...)` → **actionId 4**, tx
  `0x728c0397a5f88d086f2a58a5b73b06dd39bbbf28ff796aff1b523a16ff1d4122`.
- `OracleAttestation` deployed (standalone, no approval needed to deploy it, only to wire it):
  `0xE3aa1B2406125731711cdC5897Ee665F551D05f3`.

**Real sequencing bug caught live, not in the fork rehearsal — the fork missed it because it
impersonated both Super Admins and could complete the whole sequence in one script, never actually
separating "propose" from "execute" in time.** Proposing `actionType 7` (the OracleAttestation
wiring) reverted: the *currently live* `TimeBoundAccessControl` bytecode still only accepts
actionTypes 1–6 (the new actionType 7 branch doesn't exist until the upgrade in actionId 3 is
**executed**, not just proposed) — so actionType 7 cannot be proposed until *after* actionId 3's
`upgradeToAndCall` actually runs. The original plan's "propose all 3, co-sign all 3 in one sitting"
batching was wrong for this reason; corrected sequence below. Verified via `pendingActions(3)`/
`pendingActions(4)` that both real proposals landed correctly and nothing else was affected.

**Corrected remaining sequence** (`[AUTO]` = scriptable now with Shivansh's key; `[HUMAN]` = needs
Rudra's or Shivansh's own wallet):
1. `[HUMAN]` Co-sign actionId 3 and actionId 4 — `coSignPlatformAction(3)` then `coSignPlatformAction(4)`
   on `TimeBoundAccessControl` (`0x0a100F8c9389B723Aa0c92F63fE4F05E7737ECC3`), via Etherscan's
   "Write Contract" tab (connect wallet, `coSignPlatformAction`, enter the actionId) — the simplest
   path since our own Governance UI doesn't yet label actionType 4/7 proposals descriptively (they'd
   show as generic/mislabeled "Unpause platform" — `lib/services/governanceService.ts`'s
   `platformActionProposals` mapping only has friendly labels for actionType 1/2/3, a pre-existing
   gap, not touched here).
2. `[AUTO]` Execute the `TimeBoundAccessControl` upgrade: `upgradeToAndCall(0x1Be5125f..., <reinitializer calldata>)`.
3. `[AUTO]` Verify `getRoleAdmin(ORACLE_ATTESTOR_ROLE) == SUPER_ADMIN_ROLE`.
4. `[AUTO]` Execute the `AssetRegistry` upgrade: `upgradeToAndCall(0x82e14A3C..., "0x")`.
5. `[AUTO]` **Now** propose actionType 7 for `0xE3aa1B24...` (valid only after step 2) → new actionId.
6. `[HUMAN]` Co-sign that actionId.
7. `[AUTO]` `arProxy.setOracleAttestationContract(0xE3aa1B24...)`.
8. `[AUTO]` Grant `ORACLE_ATTESTOR_ROLE` to real attestor addresses via `grantTimedRole`.
9. Off-chain: update `deployments/sepolia.json`, `.env.local`'s and Vercel's
   `NEXT_PUBLIC_ORACLE_ATTESTATION_ADDRESS`, redeploy the subgraph, redeploy Vercel
   (`pramansetu.vercel.app` is live as of this session — see CHANGELOG.md 0.18.5).

Awaiting Rudra's or Shivansh's co-sign on actionId 3 and 4 to continue.

### T-057 ✅ closed 2026-09-10 — `/onboarding` walkthrough was silently ambiguous about being fake (audit §3)
`app/onboarding/page.tsx` is pure animation — `Math.random()` for the DID/pubKey shown, no service
calls, no `dataMode` awareness — duplicating the real identity-creation flow that already works at
`/identity` (+ `/identity/issue` per T-051). Chose option (a) of the two the audit offered (explicitly
label it, rather than rebuild it into the real flow): added a visible "Demo walkthrough — illustrative,
not a real transaction" badge, a "Go to the real flow" link to `/identity`, and a doc comment. Rebuilding
it as a second real onchain wizard would duplicate `/identity`'s + `/identity/issue`'s logic behind a
harder-to-maintain second UI for no functional gain — a real end-to-end onboarding path already exists.

### T-047 ✅ closed 2026-09-10 — "AI" anomaly detection relabeled honestly (audit §4.4)
`app/api/audit/anomalies/route.ts` is a genuinely working, honest rule-based heuristic (mint/role-grant
velocity + emergency-pause checks) — good code, but `README.md`, `docs/README.md`, `docs/ARCHITECTURE.md`,
and `docs/TECH_STACK.md` described it as "AI"/"AI monitoring"/a "Python service (rule-based + lightweight
ML)". None of that matches the shipped TypeScript Next.js API route. Reworded all four to describe it as
rule-based heuristic detection, consistent with `docs/PRD.md`'s existing Non-Goals ("not shipping a
production-grade ML anomaly-detection pipeline in the hackathon build"). Left `docs/SECURITY.md` §5.3 and
`docs/DEPLOYMENT.md`'s Phase 3 row alone — both already correctly frame "AI anomaly-detection service" as
future-facing/production-roadmap language, not a claim about the current build.

### T-048 ✅ closed 2026-09-11 — Deleted the stale `docs/` duplicates, fixed the canonical-path rule
Resolved: deleted `docs/TODO.md`, `docs/CHANGELOG.md`, `docs/README.md`, and (found while doing this,
a **fourth** duplicate not previously catalogued) `docs/AI_DEVELOPMENT_RULES.md` — all four were stale
snapshots frozen at end of Phase 9 (2026-09-09 21:44), before Phase 10's merge and everything since.
`docs/AI_DEVELOPMENT_RULES.md` was particularly worth catching: it's the *governing rules file*, and
it still had the stale `/Users/rudra/Development/SIH2026_Build` local-working-copy path Phase 2
housekeeping fixed in the root copy — a future session reading the wrong copy would follow outdated
rules. Fixed `AI_DEVELOPMENT_RULES.md` §6 itself to correctly say `TODO.md`/`CHANGELOG.md` (repo root),
not `docs/TODO.md`/`docs/CHANGELOG.md` — that mismatch against actual practice was the root cause of
this whole class of drift. `docs/README.md` wasn't a pure duplicate (it had a fuller Documentation
Index table linking `TECH_STACK.md`/`USER_FLOWS.md`/`FEATURES.md`/`ENVIRONMENT.md`/`TESTING.md`/
`DEPLOYMENT.md`, which the root `README.md` didn't) — merged that table into the root `README.md`
rather than losing it; skipped its "Repository Structure" tree (stale — pre-dated the `app/(app)/*`
route-group refactor) and "Git Workflow" section (didn't match this project's actual commit
convention) since merging stale/inaccurate content would just recreate the same problem.

**Before deleting, checked `docs/TODO.md` for anything genuinely unresolved (same discipline as
`CIPHERLOOM_STATE_AND_PLAN.md`'s deletion) — found two real, still-live bugs not captured anywhere in
the root `TODO.md`, both fixed in this same pass**:
- `components/shell/TopBar.tsx`'s identity chip had a real SSR/hydration mismatch: the server always
  renders "not connected" (no wallet state during SSR), but wagmi restores a persisted connection on
  the client almost immediately, so a returning user's very first client render could already show
  "Resolving…"/an address — mismatching the server output and forcing React to discard and fully
  re-render the tree on every load in onchain mode. Fixed at the source, in
  `lib/hooks/useCurrentIdentity.ts` (a `hasMounted` gate deferring real wallet state until after the
  client mounts, first client render matches the server's, then updates normally post-hydration) —
  every consumer benefits, not just TopBar.
- `lib/services/auditService.ts`'s onchain `["auditEvents"]` query: the doc's original complaint (it
  resolved to `undefined` instead of `[]`) was already fixed by the time this was checked, but the
  underlying concern was still real — a genuine query failure (subgraph unreachable, network error)
  was indistinguishable from "zero events, honestly," both rendering as an empty ledger with no error
  indicator. Directly relevant given T-050 (the subgraph genuinely is unreachable right now). Added
  `eventsError`/`anomaliesError` to `AuditService`, surfaced as a clear "Couldn't load" state on
  `/dashboard`, `/audit`, and `/audit/anomalies` instead of blending into the empty-state.

**Also found and fixed while looking at `/dashboard`'s ledger, a separate and more serious bug in the
same area**: `events` state there was a **one-time snapshot** — `useState`'s lazy initializer captured
`auditService.getEvents()` once at mount and never synced again. In onchain mode this silently froze
the ledger forever after first render, regardless of the real 5s `refetchInterval` poll underneath it
— a real subgraph update would never appear without a full page remount. Fixed by deriving `events`
reactively (`useMemo` over the live service data + a separate local list for the mock-only "Simulate"
button's synthetic events, which aren't part of any real store/subgraph data).

---

## ✅ Completed (see CHANGELOG.md for details)

- Phase 1: Contract scaffold, Hardhat environment, mock data, frontend shell
- Phase 2: OZ v5 migration, full contract hardening, 86/86 tests, SECURITY.md
- Phase 3: Web3Providers, ABI exports, ⌘K palette, detail panel, ledger animation
- Phase 4: Production deploy script, wagmi hooks layer, TheGraph subgraph scaffold
- Phase 5: Coverage report (94% stmts, 83.5% branches), ESLint clean, Slither audit
- Phase 6: Live data wiring, subgraph deployed to Graph Studio, testing polish
- Phase 7: Real Sepolia deployment + post-deploy setup (verified on-chain, see above)
- Phase 8: Fake-data removal pass (see CHANGELOG.md "Phase 8" entry for the full list)
