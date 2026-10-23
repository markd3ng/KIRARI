# Design

Keep the existing single Worker module. After stripping the matched route prefix, resolve the candidate against its fixed configured origin and compare the resolved origin to that same fixed origin. If they differ, return CORS-safe `400` with `Cache-Control: no-store` before constructing or issuing the upstream request. Do not include the raw path in the response or logs.

Preserve existing query handling and the successful fixed-host behavior. Extend the current Node built-in Worker test with network-path and backslash-normalized authority cases, a configured Worker token, and an upstream-fetch counter. Retain the existing normal GitHub proxy test as the positive control.
