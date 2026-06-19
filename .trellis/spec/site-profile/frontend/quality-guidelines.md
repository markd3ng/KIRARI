# Quality Guidelines

After profile changes:

```bash
node apps/site/scripts/materialize-profile.mjs
pnpm site:type-check
pnpm site:astro-check
pnpm build
git diff --check
```

Review the materialized diff. Exact equality between source and destination is
expected for mapped files after materialization.

Keep bilingual comments in `kirari.config.toml`. Do not commit secrets,
private tokens, service-account JSON, or write-capable credentials.
