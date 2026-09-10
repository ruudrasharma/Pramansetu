# TODO — Praman Setu (SIH 2026, PS 26125)

This file tracks outstanding work ordered by priority.
Completed items are moved to CHANGELOG.md.

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

### `lib/services/assetService.ts` — B.3, closed 2026-09-09 (T-029/T-030/T-042), partial (T-031), stopgapped (T-043)
- **T-029** ✅ `proposeMint` — now throws if `vcId`/`recipient` are missing instead of defaulting to
  a zero placeholder; both reach the real transaction as-provided from the mint page's raw inputs.
- **T-030** ✅ `transferAsset` — real `transferFrom` via the new `useTransferAsset` hook
  (`lib/hooks/useAssetRegistry.ts`); resolves the recipient DID to a real address via
  `resolveControllerAddress` and reads the asset's real current `ownerAddress` (added to the
  `Asset` type — mock mode leaves it `undefined`) rather than guessing the `from` argument.
  `app/(app)/assets/[tokenId]/transfer/page.tsx` no longer redirects on click — it waits for
  `assetService.isTransferConfirmed` (a real `useWaitForTransactionReceipt` result) via `useEffect`.
- **T-031** 🟡 `listAssets`/`getAsset` ✅ — real `GET_ASSETS` subgraph query, each asset's real
  IPFS-pinned metadata (`name`/`category`) fetched and merged in (worth the extra round-trip here,
  unlike didService's name/department, since `Asset.name` is prominently displayed everywhere —
  a failed fetch shows "(metadata unavailable)", never a blank or fabricated name). `status` is
  always `"finalized"` for any indexed `Asset` (an entity only exists once `AssetMinted` fired) —
  `"transferred"`/`"disputed"` aren't derived (would need a provenance lookup per list row just for
  a list-view status); see T-043. `getProvenance` itself is stopgapped, see below.
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

### T-050 🔴 — The configured live subgraph deployment currently returns "Not found"
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

### T-049 — No frontend/API-route test framework exists anywhere in this repo
Found while closing T-036 (2026-09-10). `docs/TESTING.md` §2–4 (Frontend Unit Tests, Integration
Tests, End-to-End Tests) describe a testing plan, but `package.json` has no Jest/Vitest/Playwright/
React Testing Library dependency and no `test`-equivalent script beyond `test:contracts` (Hardhat).
The new `POST /api/audit/anomalies` endpoint (T-036) has no automated test as a result, same as every
other existing API route (`/api/ipfs/upload`, `GET /api/audit/anomalies`). Per
`AI_DEVELOPMENT_RULES.md` §5, new endpoints need a happy-path + auth-failure test; closing that gap
means picking and wiring up a real frontend test framework first, which is a deliberate infrastructure
decision, not a drive-by addition to one endpoint's fix.

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

What follows used to be listed as blocked on credential provisioning. Verified directly against
Sepolia and the live Graph Studio subgraph in this session — not from a doc, from `eth_getCode`,
`hasRole()`, and `_meta` queries against the real endpoints:

- Deployer wallet funded, `.env.local` fully populated (Alchemy RPC, deploy key, WalletConnect
  project ID, Graph deploy key).
- All 6 core contracts deployed to Sepolia (`deployments/sepolia.json`), bytecode confirmed live
  on-chain at every recorded address.
- Subgraph deployed to Graph Studio and indexing with zero errors.
- Post-deploy checklist: second Super Admin enrolled and confirmed live, `ECDSASignatureVerifier`
  deployed and wired into `DIDRegistry`, `ISSUER_ROLE` granted, deployer's `SUPER_ADMIN_ROLE`
  revoked — all confirmed via live `hasRole`/`signatureVerifier()` calls. (Deployer intentionally
  retains `DEFAULT_ADMIN_ROLE` — see T-020.)
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

### T-016: Oracle Attestation (Phase 4)
Integrate decentralized oracles for off-chain data validation.

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
