# Ownership And Configuration State

The profile is the editable default state; the copies under `apps/site` are
materialized state.

Configuration priority inside the site is environment override, then TOML,
then loader default. This does not mean every TOML field has an environment
override. Environment variables are for implemented deploy overrides,
credentials, and secrets.

Keep current implementation separate from intended options. For example, the
profile's `[edge]` flags describe site integration, while Worker deployment
still requires separate environment variables.
