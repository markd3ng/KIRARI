# Content Separation

KIRARI separates the site program from its default content. This allows:

- **Clean upstream syncs**: profile-owned files stay in `packages/site-profile/`,
  making it easy to merge upstream changes to `apps/site/` without content
  conflicts.
- **Profile customisation**: fork users replace `packages/site-profile/` with
  their own content while keeping `apps/site/` untouched.
- **Build-time materialisation**: the materialisation script copies profile
  content into the site package before each build.

## What Goes Where

| What | Location |
|---|---|
| Astro components, pages, styles, plugins | `apps/site/src/` |
| Astro config, site config | materialised from profile |
| Content (posts, spec pages) | `packages/site-profile/content/` |
| Friends data | `packages/site-profile/data/` |
| Favicon, OG images | `packages/site-profile/assets/` |
| Snippets | `packages/site-profile/snippets/` |

## Upstream Sync

See [Upstream Sync](UPSTREAM_SYNC.md) for the recommended workflow when
syncing with the upstream KIRARI repository.
