# Directory Structure

Current profile inputs:

- `kirari.config.toml`
- `content/posts/`, `content/spec/`
- `data/friends.json`, `data/devices.json`
- `assets/images/devices/`, `assets/favicon/`, `assets/og/`
- `snippets/`

`apps/site/scripts/materialize-profile.mjs` is the authoritative mapping list.
Update it when adding a profile-owned path; do not rely on documentation alone.

`package.json` contains metadata only. There is no runtime export, build output,
or package API. `.DS_Store` files are repository hygiene issues, not profile
features.
