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
