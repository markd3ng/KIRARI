# Local verification — Node 26.10.0 / pnpm 9.14.4

GitHub Actions remains pinned by `.nvmrc` to Node 22.12.0. Local checks below ran with the installed Node 26.10.0; exact-head GitHub CI is the merge gate.

- `pnpm check`: PASS — Site TypeScript/Astro checks, Edge TypeScript/tests, profile materialization and Trellis adapter sync.
- `REQUIRE_SITE_BROWSER=true pnpm site:test`: **98/98 PASS, zero skips**, including actual Mermaid Chromium retry and CSP URI classification regressions.
- CI root regression list: **58/58 PASS**. Site contract: 7/7. Edge tests: 10/10.
- Site QA, Vercel config synchronization, release/version checks, Wrangler local dry build and `git diff --check`: PASS.
- Full static build: PASS, 112 pages. Indexing submissions were skipped by the existing fail-closed policy; no deployment was run.
- Actual TOC Astro/ClientRouter Chromium fixture: four viewport/layout combinations, four real route swaps each, keyboard focus, named landmark, active location, reconnect and detached-listener cleanup: PASS; zero page errors.
- Actual Astro + Expressive Code Mermaid fixture: all gates, disabled initial routes, injected transient render failure, same-theme retry, malformed-source fallback, SVG accessible name, theme redraw, route/back behavior and disabled destination: PASS.
- Analytics/CSP browser fixture: 8 observed script hosts, 8 controlled collectors, 0 CSP violations, 16 provider requests intercepted locally.
- Full-profile static-site smoke: desktop 1600px and mobile 390px; 5/5 diagrams rendered, 2 counted route swaps, sidebar placement intact, 0 default analytics requests, 0 page errors, 0 unexpected CSP violations. The existing policy blocked 9 Iconify fallback requests per viewport; those exact baseline domains were counted.
- CSP blocked-URI regression covers absolute URL, `inline`, `eval`, `data:`, `blob:`, relative and malformed values; non-URL tokens remain visible as unexpected violations rather than throwing.
- Analytics mode is explicit across Astro production build and both CSP writers; page/policy environment booleans share one parser. Simple Analytics host and HTTPS-origin forms resolve identically; malformed HTTP/path inputs disable both script and CSP entries.

OCR triage for pre-fix PR head `f53b2e5ea901ff3caa7ac6e14b8eeefafcfc29f5`: 13 inline items, 30 summary items, and one overlapping item. Duplicate Mermaid retry reports were merged. The actionable retry, wait timeout, CSP URI, evidence-counting, environment-isolation and Analytics configuration findings were fixed and regression-tested. All 30 summary items were low severity. The SVG warning has no untrusted runtime Markdown input path in this static repository; article Markdown is repository-owned and Mermaid rendering remains `securityLevel: "strict"`, so no sanitizer dependency was added. No human blocking review was present on that inspected head.

The standard GitHub checks are read separately from these local results before the approved merge decision. No Vercel project settings, credentials, deployment controller or Production workflow was modified or invoked. Worker forwarding risk remains isolated to #102.
