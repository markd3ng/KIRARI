# P4 architecture correction

The Owner replaces custom release admission and promotion with hosting-provider native deployment. This task continues RM-05/#99 and #129–132; it does not create a separate roadmap or approval system.

## Requirements

- Vercel's connected Git integration deploys main to Production and feature branches to Preview. Candidate repository configuration must enable main deployment while preserving Astro output, security headers and optional gateway adapters.
- GitHub Actions verifies source and may produce portable Core/Site artifacts. It must not publish/promote a competing Production artifact, create per-release approval bindings or require C1/Trusted Sources admission.
- Preserve immutable Core/Site pins, reproducibility, external Site export/provenance, safe parsing, ordinary security tests, browser checks and advisory OCR configuration.
- Fetch every Project #1 item and field value, open issues and completed dependency contracts. Reconcile P3–P8 and completed P1/P2 references with the actual consumer graph; retain #122 independently.
- Keep issue history traceable and statuses truthful. Production is incomplete until an actual native Production deployment passes commit/domain/browser verification.
- Complete implementation, appropriate checks, independent review and one coherent PR. Provide a cutover/recovery procedure identifying whether merge triggers Production.

## Boundaries

No final PR merge, Production deployment, provider configuration mutation, project deletion or credential revocation. Live credentials/settings with consumers on current main remain pending cutover cleanup. No unrelated Trusted Sources query is an engineering-readiness prerequisite. Indexing stays opt-in; P5–P8 feature implementation is outside this correction.

## Acceptance

Native Git deployment is restored in candidate changes; exactly one intended Production controller remains; Preview and Core/Site capabilities work; CI/OCR and meaningful negative regression tests pass; all Project items/custom values are fetched and affected contracts reconciled; independent review passes; the PR and concrete Owner cutover decision are ready.
