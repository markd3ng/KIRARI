# Code Reuse And Generated Copies

Before adding a helper or changing a repeated value:

1. Locate the current source symbol and its callers with Codegraph.
2. Check whether repetition is generated/materialized rather than authored.
3. Update the owning source, not every copy.
4. Re-run the generator/materializer and inspect the diff.

Important ownership examples:

- Profile TOML/content/data/assets/snippets own their materialized site copies.
- `apps/site/scripts/security-policy.mjs` owns generated deployment policy;
  `generate-vercel-config.mjs --check` detects drift in `vercel.json`.
- `astro.config.mjs` owns Markdown plugin order.
- `config-loader.ts` owns runtime config normalization; `config.ts` is a
  compatibility export layer.

Do not extract an abstraction merely because two short branches look alike.
Prefer the existing direct implementation until there are multiple active
consumers with the same contract.
