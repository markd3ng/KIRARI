# Local verification — Node 22.12.0 / pnpm 9.14.4

- Fresh main/ancestor verification: exact `1d8997d647c17d448be906108b510f75c24e0efa`.
- Frozen-lockfile install and separate locked Playwright install: PASS; no dependency upgrades.
- Site test suite: 90/90 at the initial complete run; added dotenv suite separately 4/4. Final focused first-batch run 34/34, zero skips (includes the added four).
- Root CI regression list: 58/58. Site contract 7/7. Edge tests 10/10.
- Site TypeScript, Astro check, QA, profile materialization, Trellis checker, Edge TypeScript + local Wrangler dry build, deployment config synchronization, release and version checks: PASS. Wrangler dry build is local packaging, not a deployment.
- Full static build: PASS, 112 pages. Indexing submissions skipped; default output preserved. `git diff --check`: PASS.
- Actual TOC Chromium fixture: four viewport/layout variants, 16 no-reload swaps, real keyboard focus, accessibility/current-location and capture cleanup/reconnect: PASS.
- Actual Astro + Expressive Code Mermaid Chromium fixture: all gates/default false, direct load, swaps/back, duplicate events, themes/error fallback and disabled network gate: PASS.
- Actual Analytics component + intercepted script/collector CSP fixture: 8 scripts / 8 collectors / 0 CSP violations / 0 real vendor requests: PASS.
- Full default-profile static output Chromium: 1600px + 390px, all five Mermaid diagrams, actual sidebar placement, locale route forward/back, 0 analytics requests, 0 page errors, 0 unexpected CSP violations: PASS. The unchanged baseline policy blocks 9 Iconify fallback requests per viewport; these exact existing `connect-src` domains are counted and documented, not claimed absent or globally ignored.

Independent reviewers found and resolved dotenv parity, missing browser CI registration, and translated floating TOC language propagation. Reciprocal ownership avoids an author signing off their own feature. Reports: `research/independent-review.md` (#103/#104/#109) and `research/independent-review-105-104.md` (#105/#104).

Remote PR, CI and advisory OCR evidence is recorded after PR creation. No manual Production deployment, settings, credentials, merge, real analytics event, or indexing notification was performed.
