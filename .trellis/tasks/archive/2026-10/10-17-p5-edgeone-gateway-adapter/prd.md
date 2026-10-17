# P5 EdgeOne Makers Gateway Adapter — #112

## Goal
Package the accepted #102 Core for current EdgeOne Makers Edge Functions, without deploying or changing Site configuration.

## Requirements
- Only Core named operations; Web Request/Response/fetch. Same-origin default and explicit standalone origins.
- Current official Makers handler/routing contract and capability matrix, with source URLs and verification date.
- CACHE_NONE and no token access until platform cache/secret evidence is sufficient. Do not assume Cloudflare APIs.
- No production configuration, credentials, deployments, Core public-contract changes, or unrelated adapter changes.

## Acceptance
- Reproducible package/layout with route, method, query, size, error and no-secret-leak regression tests.
- Type-check, package smoke, full standard local checks and CI on exact PR HEAD; independent review.
- #112 and Project accurately In Review when code accepted, never Done before merge. #110/#111 remain In Review.
- Live Makers runtime limits clearly distinguished from executable simulation; no deployment required for code review.

## Baseline
Main d7b72b0360f9b1c312fc1fa476a78ad62454c374. #147 and #148 remain open. Their branch-local Trellis reconciliation is pending merge; old main task statuses do not override fresh GitHub state. P4 remains completed.
