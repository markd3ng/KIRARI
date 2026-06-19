# Error Handling

Current response contract:

- Master switch not `"true"`: plain `404 Edge disabled`.
- No enabled route match: CORS-safe plain `404 Not found`.
- `OPTIONS` on a matched route: `204` with CORS headers, no upstream request.
- Non-GET/HEAD on a matched route: CORS-safe `405` with `Allow`.
- Upstream throw: structured log plus CORS-safe JSON `502` and `no-store`.
- Upstream HTTP statuses: preserved, with project cache/CORS headers applied.

Do not leak upstream exception text, tokens, request credentials, or binding
values in responses. Preserve HEAD semantics by forwarding the method and
passing through the upstream body/status contract.
