# Directory Structure

Current profile inputs:

- `kirari.config.toml`
- `content/posts/`, `content/spec/`
- `data/friends.json`, `data/devices.json`
- `assets/images/` (requires `demo-avatar.png` and `demo-banner.png` for the current site contract)
- `assets/images/devices/` (optional), `assets/favicon/` (8 required fallback files), `assets/og/` (`default.png` required)
- `snippets/` (optional, trusted owner code), `ads.txt` (optional)

`apps/site/scripts/profile-manifest.mjs` is the authoritative mapping and input
validator for the default Profile and external Site source. Update it when
adding a profile-owned path; do not rely on documentation alone. External input
requirements and build-only behavior are specified in the site quality guide.

`package.json` contains metadata only. There is no runtime export, build output,
or package API. `.DS_Store` files are repository hygiene issues, not profile
features.
