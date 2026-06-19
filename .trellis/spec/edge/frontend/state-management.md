# Consumer State

The `[edge]` section contains a master flag, API base, and per-feature flags.
The Worker separately requires `KIRARI_EDGE_ENABLED` and route-specific
environment flags.

Document and verify both sides when enabling a feature. Do not assume the TOML
flag deploys or configures Worker bindings automatically.

Keep loading/error/data state local to the consuming component. Static output
and direct-provider fallback behavior must remain explicit.
