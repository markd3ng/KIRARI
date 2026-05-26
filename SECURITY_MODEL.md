# Security Model

KIRARI is a public static Astro site with optional build-time integrations.
Security decisions should preserve static output, avoid leaking environment
values, and keep trusted maintainer HTML separate from untrusted user input.

## `set:html` Trust Boundary

Allowed `set:html` sources:

- Trusted maintainer-owned `kirari.config.toml` fields.
- Trusted maintainer-owned files in `src/snippets/`.
- Generated structured data where the data is serialized with `JSON.stringify`.
- Sanitized RSS/content paths that already pass through the project sanitizer.

Forbidden `set:html` sources:

- Visitor submissions.
- Comments.
- CMS user fields.
- Remote API payloads that are not explicitly sanitized and schema-validated.

Custom Head/Footer snippets are intentionally not sanitized because they are an
owner-level escape hatch for analytics, verification tags, filing links, and
small scripts. Snippet file names must be basenames such as `head.html` or
`footer.js`; traversal, absolute paths, and subdirectories are ignored.

The default deployment CSP is a first-phase policy that remains compatible with
owner-level inline snippets and Astro inline boot scripts by allowing inline
script/style. Do not treat that CSP as a sanitizer for visitor, comment, or CMS
HTML. Tightening CSP should happen together with moving custom snippets to
nonce/hash-aware or external assets.

## Public Environment Variables

KIRARI is TOML-first for normal public settings. Environment variables are for
secrets, deployment overrides, and provider credentials that should not be
committed. Treat every `PUBLIC_*` value as browser/build-visible and non-secret.
Do not store private tokens, database URLs, or write-capable API keys in public
config.

## Search Providers

`search.google.cx` is a public Google Programmable Search Engine ID, not a
secret. When `search.google.adsense` is enabled, the Google-rendered result area
must not be hidden, rewritten, covered, or styled in a way that obscures ads or
Google labels. The ad inventory and final display are controlled by Google and
AdSense.

## IndexNow

`seo.indexNowKey` can be supplied by `PUBLIC_INDEXNOW_KEY`. It is a public
verification key that is served at `/{key}.txt` during postbuild. Do not reuse
passwords, write-capable tokens, service-account material, or other private
secrets as the IndexNow key.

IndexNow covers participating engines such as Bing, Yandex, Naver, Seznam.cz,
and Yep. Google does not support IndexNow.

## Google Indexing API

Google Indexing API is optional, advanced, and disabled by default. It mainly
targets JobPosting and BroadcastEvent URLs; ordinary blog pages are not
guaranteed to benefit. Service account JSON must be read from the env var named
by `seo.google.serviceAccountJsonEnv`. Never put service account JSON in TOML,
snippets, `PUBLIC_*`, or committed files.

## GitHub Card Adapter

The generated GitHub card runtime adapter must not expose private GitHub tokens
to the client. If a token is needed by a platform runtime, keep it in provider
secrets and avoid adding it to TOML, `PUBLIC_*`, snippets, or committed files.

For the Vercel adapter, set `GHC_ALLOWED_ORIGINS` to comma-separated exact
origins that may call the adapter cross-origin. When it is empty, no-Origin
requests are allowed without `Access-Control-Allow-Origin`, and browser Origin
requests receive no ACAO. Disallowed preflight requests return 403.

## LLM Aggregation Files

`llms-full.txt` is a public aggregation of page text intended for AI/LLM
consumption. It is not an access-controlled archive. Postbuild mitigates broad
crawling and caching by adding `Disallow: /llms-full.txt` to `robots.txt` and
`Cache-Control: no-store` for that file in generated deployment headers.

## Dependency Governance

Run the audit chain after dependency changes:

```bash
pnpm install --frozen-lockfile
pnpm audit --audit-level moderate
```

Security overrides in `package.json` are allowed when the affected transitive
dependency is compatible and the upstream package has not released a patched
dependency tree yet.
