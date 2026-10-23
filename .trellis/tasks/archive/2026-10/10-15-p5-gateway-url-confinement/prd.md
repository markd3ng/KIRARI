# P5 #102 Gateway URL confinement

## Goal

Stop the existing opt-in Worker proxy from resolving a path suffix to a different upstream authority before broader portable Gateway work.

## Requirements

- Preserve the current fixed upstreams, route flags, GET/HEAD behavior, forwarded headers, and query handling for ordinary paths.
- Resolve the stripped path and reject it if URL parsing changes the configured upstream origin.
- Return a safe client error before calling `fetch`; do not log attacker-controlled path data or expose the Worker token.
- Add a regression that exercises network-path and backslash authority forms with a configured GitHub token and proves no upstream call occurs.
- Keep the change limited to Worker URL construction, its tests, and the verified edge quality guide. Do not build the Gateway core or change platform configuration in this task.

## Acceptance Criteria

- `//host/path`, `///host/path`, and backslash-normalized authority forms under `/api/github` are rejected before upstream fetch.
- A normal GitHub suffix remains fixed to `https://api.github.com`, preserves its query, and uses only the Worker token.
- `pnpm edge:type-check`, `pnpm edge:test`, and `pnpm edge:deploy:dry` pass.
- No Worker deploy, binding, secret, route configuration, or production setting is changed.

## Notes

- This is a narrow security repair under Issue #102, not completion of the portable Gateway acceptance criteria.
- Confirmed trigger: `new URL("//attacker.example/path", "https://api.github.com")` selects the attacker origin; current code attaches `KIRARI_GITHUB_TOKEN` before the fetch.
