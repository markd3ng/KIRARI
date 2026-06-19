# Logging

The current Worker logs only unexpected upstream failures with one JSON string:

```json
{"event":"kirari_edge_upstream_failure","route":"github","message":"..."}
```

Keep logs sparse and machine-searchable. Include the route class and safe error
message; do not log authorization headers, `KIRARI_GITHUB_TOKEN`, cookies,
query secrets, or full request headers.

Expected 404, preflight, and method-rejection paths do not need logs.
