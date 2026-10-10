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

## External Site Build and Composition

`./build.sh --site <directory>` treats mapped Site files as trusted owner input.
`./build.sh --compose` pins separate Core and Site inputs, requires clean Git
checkouts for Git-backed inputs, and writes static output with a provenance
manifest. Both validate paths/types and reject symlinks before copying mapped
files into a disposable site workspace. Materialization stages the mapped
inputs and does not write to the original Site Source; the source is not
enforced as read-only. MDX and other build-time code can execute during the
build with the invoking user's filesystem and network permissions. Snippets are
loaded as raw text and injected into generated HTML/JavaScript for browser
execution; they are trusted owner code, but current code does not execute
snippet JavaScript in the Node build process. The temporary workspace and
child-environment allowlist are not an OS sandbox. Do not build unreviewed Site
input where build-time code could access sensitive files. `PUBLIC_*` values are
still public and must not contain secrets. The manual composition CI workflow
uses read-only repository permissions, publishes only a downloadable static
artifact, and does not package Pages Functions or deploy.

Postbuild indexing submissions require
`KIRARI_ALLOW_INDEXING_SUBMISSIONS=true`; `KIRARI_BUILD_ONLY=true` and
`NODE_ENV=test` each veto both IndexNow and Google Indexing API submissions.
The external builder always sets build-only mode and does not forward the
authorization variable to its child process.

The complete mapping, composition identity, and verification contract is
documented in [`docs/EXTERNAL_SITE_BUILD.md`](./docs/EXTERNAL_SITE_BUILD.md).

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

Dependency audit is a non-blocking informational CI report with no advisory
suppression. The moderate-level human report, full JSON inventory (all severities),
exit statuses and audit-service errors remain visible in the raw artifact and logs. Upgrade
through compatible upstream fixes; do not force unsupported versions to silence
advisories. KIRARI does not require a custom dependency exception consumer, GitHub
App trust root or atomic merge admission system.

Build, tests, typechecks, QA, credential isolation and deployment-policy checks
remain strict. Production deployment still requires separate Owner authorization.

## Edge Proxy Trust Boundary

The optional KIRARI Edge runtime (`workers/kirari-edge`) is an opt-in
Cloudflare Worker that proxies requests to third-party APIs (GitHub, Bangumi,
avatar services).

When the Edge runtime is disabled (`[edge] enabled = false`), the site behaves
identically to the static Pages-only deployment — no proxy routes are active
and no additional trust boundaries exist.

When `[edge] enabled = true` and individual features are enabled:

- **GitHub Card proxy**: Requests are forwarded to api.github.com. The proxy
  applies the same URL allow-listing as the legacy adapter.
- **Avatar proxy**: Rewrites avatar image URLs via the configured proxy
  service.
- **Bangumi proxy**: Rewrites Bangumi API and image URLs via the proxy.

All edge-proxied responses are rendered through the same `set:html` trust
boundary as the rest of the site. Visitor-supplied or third-party API data
must still traverse text/attribute-safe rendering paths. The edge proxy is an
additional trust boundary between the visitor and the upstream API — it does
not relax the rendering model.
