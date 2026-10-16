# Operation Contract

The default route prefix is `/_kirari/edge`. Expose only the named operations documented in the package README and source-backed by current Site calls: GitHub repository, contents, latest commit by path, avatar fallback, and Bangumi user collections.

- Build upstream URLs from fixed HTTPS origins and validated operation fields. Never accept an upstream URL, arbitrary suffix, host header, or caller-controlled redirect target.
- Permit only GET, HEAD, and a local OPTIONS preflight. Do not accept a request body.
- Give each operation an exact path/query allowlist. Reject duplicates, unknown keys, malformed encoding, decoded `.`/`..` segments that reach the handler, separators hidden inside encoded segments, and out-of-range values before `fetch`. The Fetch URL parser can normalize percent-encoded dot segments before the handler receives a `Request`; treat that normalized path as the named operation requested, while keeping the upstream origin and route fixed.
- Construct upstream headers from scratch. Never forward `Authorization`, cookies, host/forwarding headers, or arbitrary request headers. GitHub tokens may be attached only to GitHub REST requests for an explicit public-repository allowlist; avatar and Bangumi operations are anonymous.
- Use manual redirect handling. Follow only the fixed GitHub avatar redirect origin and path; reject redirects for authenticated API routes.
- Bound URL length, path/ref sizes, fetch time, and streamed response bytes. Do not trust `Content-Length` as the only body bound.
- Return generic errors and selected rate-limit/entity headers. Never return upstream error bodies, tokens, or provider-specific debug headers.
- Integrated mode is the default and only accepts a matching request Origin. Standalone mode requires exact HTTPS origins; wildcard and path-bearing origins are invalid.
