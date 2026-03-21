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
