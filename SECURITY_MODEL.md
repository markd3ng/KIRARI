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

## Public Environment Variables

Only `PUBLIC_*` environment variables are exposed to browser/build-visible
configuration. Treat every `PUBLIC_*` value as non-secret. Do not store private
tokens, database URLs, or write-capable API keys in public config.

## IndexNow

`seo.indexNowKey` can be supplied by `PUBLIC_INDEXNOW_KEY`. It is used during the
postbuild submission step and should be rotated if accidentally committed as a
real private value.

## GitHub Card Adapter

The generated GitHub card runtime adapter must not expose private GitHub tokens
to the client. If a token is needed by a platform runtime, keep it in provider
secrets and avoid adding it to TOML, `PUBLIC_*`, snippets, or committed files.

## Dependency Governance

Run the audit chain after dependency changes:

```bash
pnpm install --frozen-lockfile
pnpm audit --audit-level moderate
```

Security overrides in `package.json` are allowed when the affected transitive
dependency is compatible and the upstream package has not released a patched
dependency tree yet.
