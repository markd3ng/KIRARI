# Implementation and verification record

1. **Done:** created local branch `codex/external-site-build-poc`; preserved and updated only the requested handoff-pack documents.
2. **Done:** added one required/optional source-to-target manifest, canonical containment and type/symlink checks, staged replacement with rollback, generic images and `ads.txt`; moved the two demo images to the default Site source.
3. **Done:** aligned the default equality checker with the shared map, added external contract validation, and made demo QA refuse external-source mode.
4. **Done:** added `./build.sh` default/external modes. External builds use a temporary Site project and replace only static `apps/site/dist` after a successful build.
5. **Done:** `KIRARI_BUILD_ONLY=true` skips both indexing submitters before network/credential work.
6. **Done:** Node built-in tests cover input validation, symlinks, wrong/missing types, path safety, transactional rollback, Unicode/spaces, source immutability, stale-output replacement, QA separation, output parity/custom content, and blocked indexing requests.
7. **Done:** updated site/site-profile Trellis specs, README/README_CN, DEPLOY, SECURITY_MODEL, and the relevant `kirari-agent-pack-v2` status/roadmap docs. Root `AGENTS.md` was preserved.
8. **Done:** local checks are recorded below. No deployment, workflow write, `gh` mutation, push, or PR was created. The implementation is committed locally in the PR-1 commit.

## Validation order

| Command | Result |
|---|---|
| `pnpm site:test` | PASS, 15 tests; includes default/equivalent external build, distinct external Site, indexing fetch suppression, source immutability, materializer rollback/stale cleanup, and failed-build output preservation |
| `pnpm site:profile:check -- --site packages/site-profile` | PASS |
| `pnpm profile:check` | PASS; default generated Profile matches source |
| `node apps/site/scripts/qa-regression-check.mjs` | PASS |
| `pnpm site:type-check` | PASS |
| `pnpm site:astro-check` | PASS; 118 files, 0 errors/warnings/hints |
| `pnpm build` | PASS; default Profile built 112 static pages and Pagefind indexes |
| `pnpm check` | PASS; site checks, edge type-check, 10 edge tests, profile check, Trellis adapter check |
| `pnpm release:check` / `pnpm release:version-check` | PASS |
| `pnpm deploy:config:check` | PASS |
| `node --check` for new JS, `bash -n build.sh`, package JSON parse | PASS |
| `git diff --check` | PASS |
| `pnpm audit` | FAIL, 61 findings: 3 low, 24 moderate, 32 high, 2 critical. No dependencies changed; track remediation separately. |

The current `pnpm-lock.yaml` is unchanged from base and `package.json` changes only scripts; no PR-1 dependency introduced these audit findings. The current report spans 20 packages/60 advisory records: direct packages `@astrojs/rss`, `astro`, `mermaid`, `sanitize-html`, `sharp`, and `smol-toml`; remaining affected packages are transitive. This is an audit snapshot, not an assertion about later lockfile states.

Build/output tests verify routes, page metadata, selected asset hashes, custom article presence, demo-post absence, blocked indexing fetches, and preservation of existing `dist` after an external build fails. This is not an OS sandbox: MDX/snippets from the Site can execute with the invoking user's filesystem/network permissions, so use trusted, reviewed input only. No browser/visual comparison, Cloudflare Functions packaging, CI ref behavior, deployment, or production configuration was tested. See `docs/EXTERNAL_SITE_BUILD.md` for the durable workflow-independent contract. `pnpm build` was run last so `apps/site/dist` contains default Profile output.

## Rollback points

- New external entry is opt-in; reverting root `build.sh`/builder and external-only postbuild guard restores existing build behavior.
- New generic asset mapping owns only `apps/site/src/assets/images`; revert its source move and `.gitignore` entry together if default equality or build checks fail.
- Do not remove any existing indexing behavior from default mode.
