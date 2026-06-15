# Site Profile

The default site profile at `packages/site-profile/` contains the content,
configuration, and assets that a fresh fork ships with.

## Mapping

| Profile (src) | Site (dest) |
|---|---|
| `kirari.config.toml` | `apps/site/kirari.config.toml` |
| `content/posts/` | `apps/site/src/content/posts/` |
| `content/spec/` | `apps/site/src/content/spec/` |
| `data/friends.json` | `apps/site/src/_data/friends.json` |
| `assets/favicon/` | `apps/site/public/favicon/` |
| `assets/og/` | `apps/site/public/og/` |
| `snippets/` | `apps/site/src/snippets/` |

## Customisation

Replace files in `packages/site-profile/` with your own. The next build
materialises them into the site. The materialisation script does not execute
git commands — profile content is copied, not committed, into the site tree.
