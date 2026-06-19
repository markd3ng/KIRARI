# Cross-Layer Data Flow

Trace changes through the whole implemented path.

## Config

Profile TOML → materialization → raw TOML import → runtime validation →
`Config` singleton → section exports → Astro/Svelte/build-script consumers.

## Content

Profile Markdown/MDX → materialization → Astro collection schema →
Remark/Rehype pipeline → routes/layouts → postbuild indexing and LLM output.

## Edge

Profile `[edge]` config → site consumer URL/feature choice, while Worker env
bindings independently gate routes → allow-listed upstream request → CORS/cache
response → safe site rendering.

## Deployment

Profile config may influence generated platform policy → root build command →
materialization/adapters/Astro/postbuild → `apps/site/dist`.

For each changed field or payload, verify producer, runtime validator, every
consumer, fallback behavior, generated output, tests, and docs. Do not document
future architecture (KV, D1, automatic binding propagation, extra providers)
as current behavior.
