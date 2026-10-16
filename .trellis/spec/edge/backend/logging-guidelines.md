# Logging

The current Worker logs only unexpected upstream failures with one JSON string:

```json
{"event":"kirari_edge_upstream_failure","route":"github","message":"..."}
```

Keep logs sparse and machine-searchable. Include the route class and safe error
message; do not log authorization headers, `KIRARI_GITHUB_TOKEN`, cookies,
query secrets, or full request headers.

Gateway adapter configuration failures use the fixed
`kirari_edge_gateway_configuration_failure` event and may include only the
exception class name. Never log the exception message or environment values.

Expected 404, preflight, and method-rejection paths do not need logs.
