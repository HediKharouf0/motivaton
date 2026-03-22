# AGENTS.md

## Purpose

This file is the quickest project-state briefing for engineers and LLM agents working in this repository.

Read this file first, then cross-check:

1. [README.md](/Users/antoinebastide/Documents/Github/Perso/motivaton/README.md) for what is implemented now.
2. [plan.md](/Users/antoinebastide/Documents/Github/Perso/motivaton/plan.md) for the intended product direction.

## Current State

As of March 21, 2026:

- The repository code still matches the TON x402 hackathon starter.
- The intended product has pivoted to `Motivaton`, a Telegram Mini App for productivity escrow on TON.
- The pivot is documented in `plan.md`, but the implementation has not yet replaced the starter codebase.

In practical terms:

- `packages/core` contains shared x402 protocol types and utilities.
- `packages/client` contains the x402 payment-aware fetch client.
- `packages/middleware` contains the payment gate wrapper for Next.js routes.
- `packages/facilitator` contains verify/settle handlers for TON payment settlement.
- `examples/nextjs-server` is the main runnable example app.
- `examples/client-script` contains local scripts for end-to-end payment tests.

## Source Of Truth

Use these rules when reasoning about the repo:

- If a behavior is implemented in code, trust the code and README over the product plan.
- If a feature only appears in `plan.md`, treat it as planned, not implemented.
- If the README and code disagree, trust the code, then fix the docs.

## Working Rules For Agents

- Before substantial work, read `README.md`, `plan.md`, and this file.
- Keep documentation aligned with the real repo state.
- Do not present planned features as if they already exist.
- When repo direction changes, update this file first so the next agent gets context quickly.

## Documentation Rule For Completed Work

Once a substantial task is finished, this file must gain a dedicated section for it under `Completed Substantial Tasks`.

A task is substantial if it changes project understanding in a meaningful way, including:

- a new feature or end-to-end flow
- a major refactor or architecture change
- a new contract, backend, or frontend milestone
- a deployment or environment milestone
- a meaningful project-docs restructuring

Each completed-task section should include:

- date
- title
- summary of what changed
- why it matters now
- key files or directories touched
- follow-up gaps, if any

## Completed Substantial Tasks

### 2026-03-21 - Documentation State Alignment

Summary:
- Added a fast project-state explanation to `README.md`.
- Created this `AGENTS.md` file to clarify the mismatch between implemented code and planned product direction.
- Added an explicit rule that every substantial completed task must be documented here in its own section.

Why it matters now:
- New engineers and LLM agents can quickly distinguish between the starter implementation and the future `Motivaton` roadmap.
- The repo now has a durable place to record meaningful progress as the pivot gets implemented.

Key files:
- `README.md`
- `plan.md`
- `AGENTS.md`

Follow-up gaps:
- Future substantial implementation work should extend this section history instead of replacing it.

### 2026-03-21 - Miniapp UI Refinement Pass

Summary:
- Refined the visual system of the Telegram miniapp in `apps/miniapp` with a stronger typography, color, spacing, and surface hierarchy.
- Reworked the `Home`, `CreateChallenge`, and `ChallengeDetail` screens to feel more structured and legible while keeping the same core flows.
- Added shared challenge-display helpers for cleaner labels and more consistent presentation.

Why it matters now:
- New contributors can treat the miniapp as having an intentional UI baseline rather than a raw scaffold.
- Future work on verification, contract integration, and product polish can build on clearer screen structure instead of redoing the entire presentation layer.

Key files:
- `apps/miniapp/src/index.css`
- `apps/miniapp/src/pages/Home.tsx`
- `apps/miniapp/src/pages/CreateChallenge.tsx`
- `apps/miniapp/src/pages/ChallengeDetail.tsx`
- `apps/miniapp/src/types/challenge.ts`

Follow-up gaps:
- The UI is improved, but some review-reported contract and verification correctness issues still need implementation fixes outside this design pass.

### 2026-03-21 - Miniapp Mobile-First Layout Pass

Summary:
- Reworked the miniapp layout defaults to be mobile-first instead of desktop-like rows compressed onto small screens.
- Stacked headers, action rows, summary rows, challenge cards, and detail sections vertically by default, then reintroduced denser multi-column layouts only at larger breakpoints.
- Improved touch ergonomics by making primary controls full-width on small screens and increasing safe-area-aware page padding.

Why it matters now:
- The miniapp now behaves more naturally in the Telegram mobile context, which is the primary usage environment for the product.
- Future UI work can assume the base layout is designed for phones first, then expanded for larger viewports.

Key files:
- `apps/miniapp/src/index.css`

Follow-up gaps:
- The responsive foundation is better, but it should still be checked on real Telegram mobile devices to validate spacing, keyboard behavior, and TonConnect interactions.

### 2026-03-21 - Miniapp Contract UI Alignment For Unlisted And Add-Funds

Summary:
- Updated the miniapp create flow to support `unlisted` challenges and reflect visibility in the summary panel.
- Added unlisted indicators in the home challenge cards and in the challenge detail header.
- Extended the challenge detail page with add-funds UI, per-wallet contribution loading, a `Your stake` stat, and creator/backer context based on on-chain contribution data.

Why it matters now:
- The frontend now exposes the new contract capabilities around private listings and pooled backing instead of leaving them inaccessible from the UI.
- Future work on browse visibility, contributor UX, and backer-specific flows can build on actual on-chain contribution data already present in the detail page.

Key files:
- `apps/miniapp/src/contract.ts`
- `apps/miniapp/src/pages/CreateChallenge.tsx`
- `apps/miniapp/src/pages/Home.tsx`
- `apps/miniapp/src/pages/ChallengeDetail.tsx`
- `apps/miniapp/src/index.css`

Follow-up gaps:
- The home screen currently remains participant-only and does not reintroduce a public browse section yet.
- Real-device testing is still needed for the add-funds flow and unlisted challenge UX inside Telegram.

### 2026-03-21 - Getter Parsing Fix For Contract Challenge Loading

Summary:
- Fixed the raw TON getter parsing used by both the miniapp and backend chain helpers.
- Replaced the previous fragile assumptions about Toncenter stack JSON shape with normalization helpers that accept both object-style and array-style stack items.
- Restored challenge loading for the home screen and detail flows after the contract data shape changed and the old parser started throwing at runtime.

Why it matters now:
- The miniapp can load on-chain challenges again instead of failing with `Cannot read properties of undefined (reading 'number')`.
- Backend routes that read challenge data from chain now use the same more robust decoding path instead of carrying the same breakage.

Key files:
- `apps/miniapp/src/contract.ts`
- `apps/backend/src/chain.ts`

Follow-up gaps:
- This fixes the getter JSON decoding issue, but the broader contract and verification correctness issues previously identified in review still need separate implementation work.

### 2026-03-21 - Challenge Ownership Normalization In Miniapp

Summary:
- Hardened the miniapp ownership checks so wallet addresses and on-chain addresses are compared in normalized raw form instead of raw string equality.
- Extended the getter boolean decoding to accept non-numeric boolean-shaped stack items as well as numeric encodings.
- This specifically addresses the case where a freshly created challenge loaded from chain but still failed to appear in `Your challenges`.

Why it matters now:
- The home screen and detail page no longer depend on TonConnect and RPC responses using the exact same user-friendly address formatting.
- Newly created challenges have a much better chance of showing up immediately once the chain getter returns them.

Key files:
- `apps/miniapp/src/contract.ts`
- `apps/miniapp/src/pages/Home.tsx`
- `apps/miniapp/src/pages/ChallengeDetail.tsx`
- `apps/backend/src/chain.ts`

Follow-up gaps:
- Creation still navigates back immediately after wallet submission, so there can still be a short indexing delay before a new challenge appears from chain.

### 2026-03-21 - Create Flow Waits For Challenge Indexing

Summary:
- Updated the miniapp create flow to wait for the newly submitted challenge to appear through the chain getter before navigating back home.
- Added a transient status message during wallet confirmation and indexing wait.
- Adjusted the home section heading so the challenge count bubble sits inline with the `Your challenges` title.

Why it matters now:
- Users no longer bounce back to an empty list immediately after creating a challenge just because the getter has not caught up yet.
- The home header now presents the list title and count in a more compact, predictable layout.

Key files:
- `apps/miniapp/src/pages/CreateChallenge.tsx`
- `apps/miniapp/src/pages/Home.tsx`
- `apps/miniapp/src/index.css`

Follow-up gaps:
- The wait is polling-based and still depends on the challenge becoming visible from the contract getter within the timeout window.

### 2026-03-21 - Create Flow Navigates Directly To New Challenge

Summary:
- Adjusted the create flow so that, once the new challenge becomes visible from the chain getter, the miniapp navigates directly to that challenge detail page instead of returning to the home list.

Why it matters now:
- Users land on the challenge they just created immediately, which is more reliable than expecting them to spot it in the list after indexing completes.

Key files:
- `apps/miniapp/src/pages/CreateChallenge.tsx`

Follow-up gaps:
- This still depends on polling the chain getter and therefore inherits the same timeout behavior as the indexing wait flow.

### 2026-03-21 - Strava Added To API Test Dashboard

Summary:
- Extended the standalone `test_api_calls` sandbox with an additive Strava integration alongside the existing GitHub and LeetCode flows.
- Added Strava OAuth configuration and callback handling, session-backed athlete storage, stats and recent-activity routes, and matching browser UI in the dashboard and admin setup page.
- Documented the new Strava environment variables and local endpoints for future contributors.

Why it matters now:
- The repo now has a runnable official-API Strava path for experimenting with productivity verification sources without removing the earlier GitHub or LeetCode work.
- Contributors evaluating supported integrations can use the sandbox to validate Strava auth and activity data before wiring it into the main product surfaces.

Key files:
- `test_api_calls/server.js`
- `test_api_calls/public/index.html`
- `test_api_calls/public/admin.html`
- `test_api_calls/.env.example`
- `test_api_calls/README.md`
- `AGENTS.md`

Follow-up gaps:
- Chess.com is still only documented in `apis.md` and is not yet exposed in the same dashboard UI.
- The Strava flow currently focuses on recent activities and totals; webhook handling and challenge-specific verification logic are still future work.

### 2026-03-21 - Public Browse Section Restored In Home Screen

Summary:
- Added a separate `Browse challenges` section to the home screen.
- The home screen now derives three useful counts from the fetched challenge set: total fetched, user-specific, and public browseable challenges.
- The browse section excludes unlisted challenges and excludes challenges already shown in `Your challenges`.

Why it matters now:
- The miniapp once again has a public discovery surface while preserving the private participant-focused list for the connected wallet.
- Users can browse public challenges without mixing them into the personal list.

Key files:
- `apps/miniapp/src/pages/Home.tsx`

Follow-up gaps:
- The browse section still depends entirely on the contract getter data and therefore inherits any chain/RPC visibility delays.

### 2026-03-21 - Beneficiary App Connection And Verification Prompts

Summary:
- Refined the challenge detail screen so beneficiary-only prompts now follow explicit per-app states instead of ad hoc conditional blocks.
- OAuth-style apps such as `GitHub` now show a connect CTA while active and unlinked, a passive connected confirmation once linked, and an ended-without-connection warning instead of a connect button after expiry.
- Manual-input apps such as `Duolingo` now show their verification input in the ended-challenge state above the checkpoint board.

Why it matters now:
- The challenge detail page now matches the intended verification UX more closely and avoids showing connect or verification prompts to sponsors or spectators.
- Future OAuth integrations have a clearer frontend extension point through app-key-based auth status lookup and connect handling.

Key files:
- `apps/miniapp/src/pages/ChallengeDetail.tsx`
- `apps/miniapp/src/api.ts`
- `apps/miniapp/src/index.css`

Follow-up gaps:
- Additional OAuth apps will still need matching backend auth routes and a new case in `handleConnectApp`.
- The beneficiary claim flow still inherits the broader verification-model correctness risks already called out in prior review comments.

### 2026-03-21 - Early Full-Completion Claims Enabled

Summary:
- Removed the hard deadline gate from on-chain checkpoint claims so a fully completed challenge can be redeemed before its end date.
- Updated the backend proof-signing route to allow early signatures only when all checkpoints are already completed, while keeping partial in-progress claims blocked until expiry.
- Adjusted the challenge detail screen to expose the claim section as soon as the backend reports full completion instead of waiting strictly for the deadline.

Why it matters now:
- Beneficiaries no longer have to wait for the calendar deadline when they finish the entire challenge early.
- The frontend, backend, and contract now agree on the same early-redemption rule instead of the UI hiding a flow the product wants to permit.

Key files:
- `contracts/productivity-escrow/src/productivity_escrow.tact`
- `apps/backend/src/routes/verify.ts`
- `apps/miniapp/src/pages/ChallengeDetail.tsx`

Follow-up gaps:
- Early redemption currently depends on backend progress reaching the full checkpoint target, so manual-input integrations still need a clearer early-completion UX if they are expected to support the same behavior.

### 2026-03-21 - Shared Miniapp Challenge Cache

Summary:
- Moved the miniapp challenge list and backend progress map into a shared provider mounted above the route tree instead of keeping them only inside the home page component.
- Updated the home screen to render from the shared cache immediately after route navigation while still issuing its normal refresh request on mount.
- Wired the create and challenge-detail flows to seed and update the shared cache so navigation back to home no longer starts from an empty list.

Why it matters now:
- Returning from a challenge page to the home page no longer wipes the visible challenge list before the refresh completes.
- The miniapp now has a clearer place to centralize fetched challenge data as more screens start reusing the same chain/backend state.

Key files:
- `apps/miniapp/src/challenge-cache.tsx`
- `apps/miniapp/src/main.tsx`
- `apps/miniapp/src/pages/Home.tsx`
- `apps/miniapp/src/pages/CreateChallenge.tsx`
- `apps/miniapp/src/pages/ChallengeDetail.tsx`

Follow-up gaps:
- The shared cache is still in-memory only, so a full browser reload still starts cold.
- Cache invalidation remains simple refresh-overwrite logic rather than a more formal query/cache layer.

### 2026-03-21 - Miniapp Visual Redesign Without Flow Changes

Summary:
- Rebuilt the miniapp presentation layer with a much stronger visual direction while keeping the same challenge flows, actions, and data surfaces intact.
- Reworked the home, create, and challenge detail screens around a new editorial-style palette, sharper hierarchy, dark accent hero panels, more distinctive cards, and a stronger desktop/mobile composition.
- Kept the task strictly UI-scoped: no new user capabilities were introduced and no existing product functionality was removed.

Why it matters now:
- The miniapp now reads as an intentional product instead of a lightly styled prototype, which materially improves first impression and usability without forcing backend or contract changes.
- Future contributors can iterate on a more opinionated and cohesive baseline rather than layering more tweaks onto the older neutral visual system.

Key files:
- `apps/miniapp/src/index.css`
- `apps/miniapp/src/pages/Home.tsx`
- `apps/miniapp/src/pages/CreateChallenge.tsx`
- `apps/miniapp/src/pages/ChallengeDetail.tsx`
- `AGENTS.md`

Follow-up gaps:
- The redesign passes typecheck and build, but it still needs a real Telegram-device review to tune contrast, density, and TonConnect appearance against the new visual system.

### 2026-03-22 - Mockup-Aligned Telegram Miniapp Rebuild

Summary:
- Reworked the miniapp shell, typography, color system, and component styling to align much more closely with the premium dark mobile reference direction shared by the product owner.
- Rebuilt the `Home`, `CreateChallenge`, and `ChallengeDetail` screens around a tighter Telegram-first layout with stronger top bars, clearer money-first hierarchy, guided builder steps, and a route-style checkpoint presentation.
- Preserved the existing challenge logic and merged provider scope, including the newer `LeetCode` support and the current funding / claim / refund / connection flows.

Why it matters now:
- The miniapp now communicates the product loop faster and presents progression as the emotional center instead of relying on scattered cards and explanatory copy.
- Future UI work can iterate from a more opinionated mobile baseline that already reflects the desired visual direction instead of repeatedly restyling the older layout.

Key files:
- `apps/miniapp/src/index.css`
- `apps/miniapp/src/pages/Home.tsx`
- `apps/miniapp/src/pages/CreateChallenge.tsx`
- `apps/miniapp/src/pages/ChallengeDetail.tsx`
- `AGENTS.md`

Follow-up gaps:
- The redesign passes miniapp typecheck and build, but it still needs real Telegram-device review for safe-area feel, TonConnect modal ergonomics, and dense checkpoint lists on smaller phones.
- Repo-wide typing still depends on unrelated backend state outside this UI pass.

### 2026-03-22 - Cocoon Added As Veto-Only Achievement Inspector

Summary:
- Added a backend Cocoon / TON-AI inspection layer for GitHub and Strava that runs only after the normal verifier already says an achievement has been matched.
- The new inspection never approves rewards on its own; it can only block suspicious achievements and return a very short reason.
- Updated the challenge detail screen and shared API types so blocked achievements surface as a short veto message instead of a generic failure or AI approval state.

Why it matters now:
- Reward eligibility still comes from the ordinary challenge verification flow, which keeps AI out of the role of payout authority.
- The product now has a last-layer anti-bullshit screen for obviously fishy commits or weak Strava activities before claim proof signing proceeds.

Key files:
- `apps/backend/src/cocoon.ts`
- `apps/backend/src/routes/verify.ts`
- `apps/backend/src/verifiers/types.ts`
- `apps/backend/src/better-sqlite3.d.ts`
- `apps/miniapp/src/api.ts`
- `apps/miniapp/src/pages/ChallengeDetail.tsx`
- `apps/miniapp/src/index.css`

Follow-up gaps:
- The veto-only inspection currently applies to GitHub and Strava evidence only.
- Cocoon only activates when `COCOON_API_URL` and `COCOON_MODEL` are configured for the backend; otherwise the inspection layer stays effectively inactive except for lightweight heuristics.
