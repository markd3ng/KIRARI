# KIRARI handoff — 2026-10-18 (Asia/Shanghai)

P0–P6 are complete. P5 is **8/8 accepted**; P6 #101 is accepted with
`llms-full.txt` retained. **P7 #100 is in progress** on
`codex/p7-post-deploy-indexing`; its code remains default-off and is not yet
accepted or merged.
GitHub Issues contain acceptance criteria; [Project #1](https://github.com/users/markd3ng/projects/1)
holds current progress. Read those and fresh main before continuing.

## Accepted delivery

Owner approved sequential Squash Merges #150 then #151 and this final GitHub
closeout. The accepted application commit is
`219bd26fa6024876fc8a1ba9b334936d04b844e3`. A later documentation-only commit
publishes this handoff; it does not change the accepted application tree.

| PR | Squash commit | Exact-main CI |
|---|---|---|
| [#150](https://github.com/markd3ng/KIRARI/pull/150), Makers path validation | `2bc7736552b61f15a883c12985221d161f189b3e` | [39018393304 — PASS](https://github.com/markd3ng/KIRARI/actions/runs/39018393304) |
| [#151](https://github.com/markd3ng/KIRARI/pull/151), LLMs v2 | `219bd26fa6024876fc8a1ba9b334936d04b844e3` | [39018555825 — PASS](https://github.com/markd3ng/KIRARI/actions/runs/39018555825) |

PR151's final source HEAD was `f72d50b93c45d5f7cc435b81d472cf7215a6fed5`;
[source CI 39016121224](https://github.com/markd3ng/KIRARI/actions/runs/39016121224)
passed with 129 Site tests passing, no failures, and two expected platform/browser
delegation skips. Both required browser jobs passed. Independent code/security
review passed; all nine OCR threads were classified and replied/resolved.
Integration review verified the merged tree contains both approved changes
without additional source changes. Makers' 22 focused tests passed in the
integrated tree. No confirmed blocking finding remains.

Native Production accepted at that code commit:

- Project `kirari-main` / `prj_QNMVdxTkPOad4ynN4fwFCYEST8Jk`,
  team `team_NsBZHGUVnyygP7veiROKLuUx`.
- Deployment `dpl_94C71SsSMFinNfAUr2hYnxxcdBgU`: `READY`, Production,
  repository `markd3ng/KIRARI`, branch `main`, exact accepted commit.
- [Canonical domain](https://kirari-main.vercel.app/) bound to that deployment;
  browser footer confirms the commit. Navigation, search, assets, Markdown
  views/discovery, language index, robots, canonical and security checks passed.
  HSTS was verified separately through fresh raw HTTP readback.
- `llms-full.txt` returns 200 / `no-store`; robots discourages crawling.
  The retired `llms-small.txt` returns 404 and is absent from the live sitemap.

The [archived task](../.trellis/tasks/archive/2026-10/10-17-p6-llms-v2/)
contains source/build/browser evidence and
[merge acceptance](../.trellis/tasks/archive/2026-10/10-17-p6-llms-v2/evidence/merge-acceptance.json).
The snapshot proves this code deployment at its recorded time; future execution
must read current provider state again. No manual deployment, provider setting,
Secret or credential change was performed.

## What P6 delivers

Published posts and selected about/friends/projects pages have canonical
source-backed `index.md` views. A shared public/language/slug inventory drives
views, HTML alternate/describedby discovery and covering language/path indexes.
Drafts are excluded. AST rendering preserves code, math, diagrams, tables and
footnotes; supported MDX/HTML becomes static Markdown without executing export
imports or expressions. Links resolve only to published document targets and
known emitted assets. Unsupported referenced local attachments fail explicitly.

The legacy condensed output is removed without a shim. Owner explicitly retains
the public `llms-full.txt` aggregation (20,000 characters per page). Index filters,
robots and `no-store` do **not** create access control or a new privacy policy.
Actual staged builds cover nested/base/language paths, disabled cleanup and
concurrent distinct Sites sharing dependencies. Astro caches remain project-local.

## P7 #100 — accepted

P7 is complete on 2026-10-19. The Owner approved IndexNow and a real
post-deployment validation. PR #152 enabled it in the default KIRARI profile
and set `KIRARI_INDEXNOW_ENABLED=true`; Google Indexing API remains disabled.

PR #152 merged as `7863ec7277b829e9be1bf9d48c91bf710010a1fe`; PR #153 fixed a
runtime-discovered concurrency race and merged as
`74eb4ca54e5e53493a197d0a0b2764a8483e0ddb`. Both exact-head and post-merge
standard CI passed. PR #153's native Vercel Production deployment
`dpl_7GaJoMPxtd1nPWYHb9uFXJXoN5th` reached READY for `kirari-main`, team
`team_NsBZHGUVnyygP7veiROKLuUx`, repository `markd3ng/KIRARI`, branch `main`,
exact commit `74eb4ca...`, and alias `kirari-main.vercel.app`. Direct live
checks confirmed the canonical HTML serves that SHA and the public IndexNow
key file matches the configured value.

The authenticated post-deployment workflow run `39213450721` independently
verified the exact canonical commit and submitted 114 Production sitemap URLs.
IndexNow returned HTTP 202 and the GitHub status is successful. Per the
[IndexNow protocol](https://www.indexnow.org/zh_cn/documentation), 202 means
the request was accepted while key validation is pending; it does not prove
search-engine crawling or indexing. No Google request, Vercel credential
change, project-setting change, or manual deployment occurred. Full evidence
is archived under `.trellis/tasks/archive/2026-10/10-18-p7-post-deploy-indexing/`.
Issue #100 is closed and Project #1 marks P7 Done / Completed Phase.

## Next: P8 #106 / #107

Issues [#106](https://github.com/markd3ng/KIRARI/issues/106) and
[#107](https://github.com/markd3ng/KIRARI/issues/107) remain Todo / Backlog.
Before implementation, the Owner must choose the analytics consent basis,
persistence/revocation behavior and provider coverage for #106, and the ad
providers, slot/account model and Preview policy for #107. Analytics and Ads
remain disabled by default; no new third-party request should run before
explicit enablement.

## Working conventions and limits

Use repository `AGENTS.md`, Trellis context and current package specs. The former
root `KIRARI_NEXT_SPEC.md` is absent; historical references are not current scope.
Use Node 22 and the declared pnpm 9.14.4, with a frozen install. Standard CI is
authoritative; run focused tests while editing and complete affected checks.
Do not restore C1, Trusted Sources admission, approval bindings, artifact
promotion or another deployment controller.

P5 adapter code acceptance does not claim live Cloudflare Zone cache behavior,
Vercel Runtime Cache retention or an EdgeOne Makers runtime deployment. Native
Windows execution of the portable packager remains unverified. These are
operational validation limits, not reasons to reopen accepted code tasks.
Dependency advisories remain informational upstream tracking at #122.

This closeout uses the managed `p5-edgeone-adapter/KIRARI` worktree on
`codex/p6-handoff`. Historical dirty worktrees, including the Desktop checkout,
were left untouched. All changes belonging to this closeout must be committed;
do not collect unrelated local edits when starting the next task.
