# Repository Workflow

Run workspace commands from the repository root with pnpm. CI installs with:

```bash
pnpm install --frozen-lockfile
```

The full pre-merge baseline is:

```bash
pnpm site:type-check
pnpm site:astro-check
pnpm edge:type-check
pnpm edge:test
pnpm build
pnpm audit --audit-level moderate
git diff --check
```

Run focused checks while iterating, then the affected full-scope checks before
completion. CI also runs site QA, edge dry deploy, generated Vercel config
verification, and release regression/version checks.

## Commits And Changelog

Use Conventional Commits with the repository's allowed types:
`feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `chore`, `test`.
Keep one logical change per commit; do not mix unrelated behavior, styling, and
documentation cleanup.

Conventional Commit messages are the normal per-commit record. Update
`CHANGELOG.md` for releases/tags, explicit release notes, breaking changes,
migrations, or cohesive user-facing feature batches—not every commit.

## Documentation Sync

Documentation sync is blocking when a change alters a documented contract:

| Change | Required sync |
|---|---|
| Config field | Profile TOML bilingual comments, `README.md`, `README_CN.md`, types and loader |
| Astro/Svelte dependency | `README.md` tech stack |
| Transition lifecycle | `.trellis/spec/site/frontend/hook-guidelines.md` and affected user docs |
| Build/materialization pipeline | `.trellis/spec/site/frontend/quality-guidelines.md` and README build section |
| Head/Footer snippet trust boundary | `SECURITY_MODEL.md`, snippet docs, and component/type-safety specs |
| Search/SEO provider | Profile TOML, `README.md`, `README_CN.md`, `SECURITY_MODEL.md`, and site state/quality specs |
| Package boundary or generated ownership | Relevant package specs and architecture/profile docs |

Do not update documentation mechanically when behavior did not change. Do not
leave a changed public or security contract documented only in source comments.
