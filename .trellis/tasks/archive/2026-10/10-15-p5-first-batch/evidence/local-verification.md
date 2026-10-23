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

Final-head OCR on `ecf70becf6817699b17a7785939fc7562bbc483f` reported 40 opinions (9 inline, 29 summary, 2 overlaps). All 29 summary opinions were low severity. The single high label was a maintainability opinion about the browser scripts loading Playwright from the P3 test package; the exact-head CI installed that package before the P5 browser checks and passed. Remaining opinions were classified as low-risk maintenance/test-hardening suggestions or false positives after checking the actual trigger. In particular, the static smoke server returns 404 for a missing extensionless route because the missing `index.html` read reaches its 404 handler; it does not fall back to the site root. No unresolved blocking review or true high-risk finding remained.

PR #144 merged by regular merge commit `4a139d18dc8449e4dbaaf2136e3aeba63842b835` from the exact approved head. PR CI `38706448903`, advisory OCR `38706448914`, and post-merge main CI `38707600185` all passed. Issues #103/#104/#105/#109 were closed after acceptance; their GitHub Project status is Done. #102/#110/#111/#112 remain Open/Todo. Four of eight P5 issues are accepted. No Vercel settings, credentials, or deployment controller were modified, and no manual deployment command was run. Worker forwarding risk remains isolated to #102.
