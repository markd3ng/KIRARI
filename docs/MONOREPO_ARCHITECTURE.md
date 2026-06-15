# Monorepo Architecture

```
KIRARI/
├── apps/
│   └── site/          # Astro site program
├── packages/
│   └── site-profile/  # Default content & config
├── workers/
│   └── kirari-edge/   # Optional edge runtime
├── docs/              # Documentation
├── package.json       # Workspace orchestrator
└── pnpm-workspace.yaml
```

## Boundaries

| Boundary | Responsibility | Owner |
|---|---|---|
| `apps/site` | Astro config, components, pages, styles, plugins, build pipeline | Site developer |
| `packages/site-profile` | Default TOML config, posts, spec pages, friends data, favicon, OG images, snippets | Fork user |
| `workers/kirari-edge` | Cloudflare Worker proxy/cache/API enhancement | Edge developer |

## Materialization

`apps/site/scripts/materialize-profile.mjs` copies profile-owned files into
the site package before every build. This ensures a fresh fork always has
default content without committing duplicated files.

See [Site Profile](SITE_PROFILE.md) for the mapping table.
