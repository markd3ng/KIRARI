# Baseline, ADS, browser, and branch audit

## Goal

Establish current, reproducible evidence for repository/ADS/deployment state, the first-screen layout jump, and all meaningful `dev` versus `main` differences before any code change.

## Requirements

- Re-fetch branches, tags, PRs, issues, required checks, merge policy, Vercel project/deployment, and relevant GitHub Project state.
- Verify exact ADS release, submodule URL/gitlink/checkout, and Skill discovery; if absent, evaluate adoption under frozen v0.3 guidance without editing yet. The official release record reports v0.3 published at 2026-10-23T07:24:28Z; its tag peels to the requested SHA.
- Inspect installed Ego Lite documentation and capabilities. If unavailable, record and use the available supported CDP fallback.
- Capture Production SHA and read-only browser behavior for clean initial load, hard refresh, homepage/blog/home navigation, and refresh after scrolling at desktop and mobile viewports. Repeat initial/hard-refresh runs at least three times where feasible.
- Capture early CLS/geometry/scroll/font/image/mutation/console evidence; state instrumentation limits and root-cause confidence.
- Classify every unique dev commit and meaningful tip-tree difference with behavior, current-main status, disposition, evidence, and PASS/BLOCKED.
- Write concise task-scoped evidence and the initial difference ledger.

## Acceptance

- All required baseline facts are verified or explicitly marked UNKNOWN/BLOCKED with the missing evidence identified.
- Every meaningful dev-only change has a reasoned disposition.
- Browser results are reproducible enough to support a fix decision, or clearly establish why no fix can yet be justified.
- No runtime/source behavior or remote project state is modified in this task.
