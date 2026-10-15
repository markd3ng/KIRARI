# Quality Guidelines

Route prefixes and upstreams are fixed in `src/index.ts`:

- `/api/github` → `https://api.github.com`
- `/avatar` → `https://cravatar.cn`
- `/api/bangumi` → `https://api.bgm.tv`
- `/images/bangumi` → `https://lain.bgm.tv`

Forward only the allow-listed request headers. Never forward client cookies or
authorization; GitHub authorization comes only from `KIRARI_GITHUB_TOKEN`.
Preserve query strings and strip the local prefix.

Every new route or changed method/header/cache contract needs a Node built-in
test. Follow `withMockFetch` in `test/index.test.ts`; avoid adding a test
framework for this package.

After stripping a route prefix and resolving a suffix, require the URL origin
to equal that route's fixed upstream origin. Reject authority-changing
network-path or backslash forms before `fetch`; credentials must never be sent
to a caller-selected host.

Verify:

```bash
pnpm edge:type-check
pnpm edge:test
pnpm edge:deploy:dry
```
