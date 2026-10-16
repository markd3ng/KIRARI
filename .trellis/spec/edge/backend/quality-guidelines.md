# Quality Guidelines

Route prefixes and upstreams are fixed in `src/index.ts`:

- `/api/github` → `https://api.github.com`
- `/avatar` → `https://cravatar.cn`
- `/api/bangumi` → `https://api.bgm.tv`
- `/images/bangumi` → `https://lain.bgm.tv`

`/_kirari/edge/*` is delegated to `@kirari/edge-gateway-core`; do not add
operation parsing, upstream selection, or cache policy to the Worker. The
legacy `/api/github/*` route is anonymous because its free-form suffix cannot
enforce the Gateway's named-operation and public-repository allowlist. Gateway
GitHub credentials require both `KIRARI_GITHUB_TOKEN` and an explicit comma-separated
`KIRARI_GITHUB_TOKEN_PUBLIC_REPOSITORIES` allowlist; never attach the token to a
legacy suffix-proxy request.

Forward only the allow-listed request headers. Never forward client cookies or
authorization. The legacy routes do not use a GitHub token. The new Gateway
Core attaches a token only to allowlisted named GitHub REST operations. Legacy
proxy behavior may preserve query strings and strip the local prefix.

Every new route or changed method/header/cache contract needs a Node built-in
test. Follow `withMockFetch` in `test/index.test.ts`; avoid adding a test
framework for this package.

For legacy proxy routes, after stripping a route prefix and resolving a suffix,
require the URL origin to equal that route's fixed upstream origin. Reject
authority-changing network-path or backslash forms before `fetch`. The new
Gateway route delegates named-operation validation and fixed upstream
construction to the Core; do not add arbitrary suffix forwarding there.

Verify:

```bash
pnpm edge:type-check
pnpm edge:test
pnpm edge:deploy:dry
```
