# Monorepo Architecture

```
KIRARI/
├── apps/
│   └── site/          # Astro site program
├── packages/
│   ├── site-profile/  # Default content & config
│   ├── edge-gateway-core/     # Portable named-operation contract
│   └── edge-gateway-edgeone/  # Optional Makers route package
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
| `packages/edge-gateway-core` | Web API named operations, upstream bounds and cache ports | Gateway developer |
| `packages/edge-gateway-edgeone` | Anonymous CACHE_NONE Makers file-route packaging; no deployment or Site mutation | Gateway developer |
| `workers/kirari-edge` | Cloudflare Worker proxy/cache/API enhancement | Edge developer |

## Materialization

`apps/site/scripts/materialize-profile.mjs` copies profile-owned files into
the site package before every build. This ensures a fresh fork always has
default content without committing duplicated files.

See [Site Profile](SITE_PROFILE.md) for the mapping table.

Optional Gateway packages do not make the static Site depend on a Gateway. The [Makers adapter](../packages/edge-gateway-edgeone/README.md) generates a separate local package; integrating its same-origin routes into Site output remains coordinated with #98. Public package policy is bundled source, never a secret binding.
