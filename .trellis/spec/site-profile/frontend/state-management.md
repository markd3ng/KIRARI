# Ownership And Configuration State

The profile is the editable default state; the copies under `apps/site` are
materialized state. `./build.sh --site <directory>` can supply a separate Site
source for one local build; materialization validates and stages it without
using the source as a write target. This does not enforce OS-level read-only
permissions or change default ownership. Build-time MDX/code can still use the
invoking process's filesystem and network permissions.

Configuration priority inside the site is environment override, then TOML,
then loader default. This does not mean every TOML field has an environment
override. Environment variables are for implemented deploy overrides,
credentials, and secrets.

Keep current implementation separate from intended options. For example, the
profile's `[edge]` flags describe site integration, while Worker deployment
still requires separate environment variables.
