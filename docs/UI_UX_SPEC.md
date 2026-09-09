# UI/UX Specification — Praman Setu

## 0. Design Concept

**Subject:** a defense-sector cryptographic control system, not a consumer Web3 app. The audience is
security leadership, IT admins, and auditors who need to trust the interface. As of the 2026-09 visual
system revision (superseding the original dark-first "signal-ops console" concept below the token/layout
level), the language is a warm, rounded ed-tech-admin aesthetic — cream surfaces, soft shadows instead of
hairline borders as the primary card separator, pill-shaped buttons/badges/nav, and three decorative
accent colors (terracotta, sage, near-black charcoal) — deliberately chosen for approachability over the
former "instrument panel" austerity. What did **not** change: the shell IA (icon+label sidebar, top bar
with a search/⌘K trigger, right-hand slide-in detail panel), the live event ledger as the spine of the
home screen, and monospace treatment for anything that is a hash, address, or DID — those remain because
the product truth ("everything is an immutable event," "exact characters matter") is independent of the
skin on top of it.

## 1. Design Tokens

### Color (light-first; dark is a deliberately re-tuned mirror, not a CSS invert)

| Token | Light hex | Use |
|---|---|---|
| `graphite-950` | `#F7F5F1` | App background — warm cream, never pure white/cold gray |
| `graphite-900` / `graphite-850` | `#FFFFFF` | Panel / card surface |
| `graphite-800` | `#ECE8E1` | Hairline border — secondary to the card's soft drop shadow, not the primary divider |
| `graphite-700` | `#F1EDE6` | Hover surface |
| `ink-50` | `#1C1F1B` | Primary text — near-black charcoal |
| `ink-400` | `#746F64` | Secondary text |
| `ink-600` | `#A39D8F` | Disabled / tertiary text |
| `signal-500` | `#E0785A` | **Primary accent — terracotta/coral.** Active nav pill, primary stat-card icon badges, primary chart series, CTAs |
| `sage-500` | `#4F7A5D` | **Secondary accent — sage green.** Secondary icon badges, second chart series, secondary progress bars |
| `charcoal-500` | `#1C1F1B` (constant — not redefined in dark mode) | **Tertiary accent.** Third data category, primary filled CTA buttons |
| `verified-500` | `#16A34A` | Verified / active / success — **status-semantic only**, kept a distinct green from `sage` so decoration and status never get confused on the same screen |
| `alert-500` | `#D97706` | Pending / expiring / warning states |
| `danger-500` | `#DC2626` | Revoked / paused / critical states |

Unlike the prior single-accent rule, `signal`/`sage`/`charcoal` are now freely decorative (icon badges,
chart series, progress bars) — but `verified`/`alert`/`danger` remain status-semantic only, never used for
decoration, so a status badge is never misread as a styling choice.

### Typography

- **UI/Display:** Plus Jakarta Sans (rounded geometric sans, weights 400–800) — used for all headings, nav
  labels, buttons, body copy. Chosen for the warm/approachable read the reference design calls for.
- **Data/mono:** IBM Plex Mono — used exclusively for DIDs, wallet addresses, transaction hashes, CIDs,
  timestamps, and role-expiry countdowns. Unchanged by the visual revision: the monospace block is how a
  user visually distinguishes "an exact machine value I could verify myself" from "prose the UI is
  telling me."
- **Scale:** 12 / 13 / 15 / 17 / 21 / 28 / 40 px, weights 400/500/650. Hierarchy comes from weight + size
  + the ink-50/ink-400 split, never from color alone.

### Shape & Elevation

- **Cards:** `rounded-3xl` (24px), white/near-black surface, a soft diffused shadow (`--shadow-panel`) as
  the primary visual separator in light mode; dark mode swaps the shadow for a 1px border + faint inner
  highlight (shadows read poorly on dark surfaces).
- **Buttons & badges:** fully pill-shaped (`rounded-full`), never a rounded rectangle.
- **Icon badges:** small solid-fill circles (32–48px) in `signal`/`sage`/`charcoal`, white icon centered —
  the recurring context-icon pattern on every stat card, list row, and settings row.

### Motion (additive to the original list below)

- Stat-card numeric values count up on mount/route entry (`components/ui/StatCard.tsx`).
- Chart lines/areas draw in left-to-right on mount (recharts `isAnimationActive`); the peak-value badge is
  a custom dark pill rendered via a `ReferenceDot` label, connected to the axis with a dotted
  `ReferenceLine` (`components/ui/AreaChartCard.tsx`).
- Sidebar's active-nav pill slides/morphs between items via a shared `layoutId` (Framer Motion), not a
  hard cut (`components/shell/Sidebar.tsx`).
- Cards passed `interactive` lift slightly (`translateY` + shadow) on hover.
- Progress bars (`components/ui/ProgressList.tsx`) animate their fill width in on mount.
- Theme toggle is a circular icon button with a ~200ms sun/moon cross-fade, not the prior track/thumb
  switch (`components/shell/ThemeToggle.tsx`). Default theme is **light**, regardless of system
  preference, persisted via `next-themes`/`localStorage`.

### Layout Shape

No sidebar-with-labels + topbar-with-search combo. Instead:

```
┌──┬────────────────────────────────────────────────┬──────────┐
│  │  Context bar: current module · role badge · ⌘K   │          │
│R │──────────────────────────────────────────────────│  Detail  │
│a │                                                    │  panel   │
│i │        Primary content (module-specific)          │ (slides  │
│l │                                                    │  in on   │
│  │                                                    │  select) │
└──┴────────────────────────────────────────────────┴──────────┘
```

- **Sidebar (left, collapsible 216px ↔ 64px icon-only):** module switcher with icon + label per row
  (`components/shell/Sidebar.tsx`) — this corrects an earlier version of this doc that specified a fixed
  64px icon-only rail; the shipped shell has always been the labeled, user-collapsible version. The active
  row gets a soft filled pill in `signal-500` at ~15% opacity (was: a 2px left-edge indicator).
- **Top bar:** shows current page title + a live-status subtitle, a pill-shaped search/⌘K trigger — still
  the primary way to *act* (grant role, propose mint, raise dispute) rather than hunting through menus —
  circular icon-buttons (theme toggle, notifications), and a role/identity chip.
- **Detail panel:** a right-hand slide-in (not a modal overlay) for inspecting a single DID, asset, or
  transaction — keeps the primary list/stream visible underneath for context, reinforcing "nothing here
  is ever the only copy of the truth."

### Motion

One orchestrated moment per screen, not scattered hover fades everywhere:
- **Ledger stream (Overview):** new on-chain events enter with a single upward slide + fade, ~220ms,
  spring (`stiffness: 300, damping: 30`) — this is the one animation that matters because it *is* the
  product's core promise (things happen, you see them happen).
- **Role expiry ring:** a circular countdown that visibly depletes in real time (CSS conic-gradient +
  Framer Motion), not a static progress bar — makes "time-bound" tangible.
- **Multisig approval:** each signer's avatar chip fills solid as their signature lands; the action button
  only becomes enabled with a satisfying single "unlock" spring when the threshold is met.
- Hover states are quiet: 1px border color shift + 80ms opacity change. No scale-up hover on cards.

## 2. Screens

### 2.1 Overview (`/`)
- Live ledger stream (center): every `DIDCreated / RoleGranted / AssetMinted / DisputeRaised /
  EmergencyPaused` event, newest at top, monospace hash + human label + relative time.
- Left-of-stream: system health strip — active DIDs, roles expiring in 24h, pending multisig actions,
  paused/unpaused status.
- Right detail panel: click any event → full decoded payload + link to the module.

### 2.2 Identity (`/identity`)
- Table of DIDs: identifier (mono, truncated with copy affordance), linked role, credential status
  (verified/pending/revoked chip), guardian count.
- "Register Guardians" flow: 3–5 guardian DID picker + time-lock window setting.
- "Recover Identity" flow: shows M-of-N guardian signature collection progress live.

### 2.3 Access Control (`/access-control`)
- Role matrix: rows = DIDs, columns = roles, cell = expiry ring (green >7d, amber <48h, red expired/none).
- "Grant Timed Role" command (via ⌘K or button): role, target DID, validity window, requires 2-of-3
  Admin co-sign shown as a live signer-chip row.
- Emergency section (Super Admin only): single high-contrast `Pause All` control with a confirmation
  step that names exactly what will freeze.

### 2.4 Assets (`/assets`)
- Grid of asset cards (image/doc preview from IPFS, CID shown in mono, owner DID, legal-reference chip
  if present).
- Mint flow: 3-step — upload to IPFS → propose (Admin) → co-sign (Manager) — shown as a horizontal
  stepper with the two required signatures as named chips, not generic "step 2 of 3."

### 2.5 Governance (`/governance`)
- Two lanes: **Multisig Queue** (Super Admin actions awaiting signatures) and **Timelock Queue**
  (high-value transfers in their cooling-off window, with a visible countdown and a `Raise Dispute`
  action for Auditor-role viewers).

### 2.6 Audit (`/audit`)
- Full filterable/exportable event log (same data as Overview stream, but table form + filters by actor,
  module, date range).
- Anomaly alerts panel: risk-scored flags (mint velocity, off-hours role change, mass transfer) with a
  one-line rule explanation — never a black-box score alone.

## 3. Component Inventory (all custom-styled on a shadcn/ui base — see FEATURES.md for behavior)

Card · Button (primary/secondary/danger/ghost) · Input · Select · Table · Tabs · Modal (used sparingly —
prefer slide-in panel) · Toast/Notification · Tooltip · Badge (status-semantic colors only) · Progress
ring · Command Palette (`cmdk`) · Signer-chip row · Countdown/expiry ring · Empty states (each screen has
a bespoke empty state illustration built from the mono-grid motif, not a generic "no data" icon).

## 4. Accessibility

WCAG AA contrast minimum on all text/background pairs (validated token pairs only — no ad hoc grays).
Full keyboard path for every action including multisig co-sign and dispute raise. Visible focus ring =
2px `signal-500` offset 2px. `prefers-reduced-motion` disables the ledger-stream slide-in (falls back to
instant fade) and the pulse-ring animation.
