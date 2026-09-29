# Quality Guidelines

After default Profile changes:

```bash
node apps/site/scripts/materialize-profile.mjs
pnpm site:type-check
pnpm site:astro-check
pnpm build
git diff --check
```

Review the materialized diff. Exact equality between source and destination is
expected for mapped files after materialization.

External Site contract checks are separate:

```bash
pnpm site:profile:check -- --site /absolute/path/to/site
./build.sh --site /absolute/path/to/site
```

Use `pnpm site:test` for the external build and materializer contracts. The
default `profile:check` only compares `packages/site-profile`. See the site
frontend quality guide for the required/optional path manifest and safety
behavior.

Keep bilingual comments in `kirari.config.toml`. Do not commit secrets,
private tokens, service-account JSON, or write-capable credentials.
