# Directory Structure

## Ownership

- `src/pages/`: Astro SSG routes, including parallel root and `[lang]` routes.
- `src/layouts/`: document shell and shared page layout.
- `src/components/`: static Astro components plus narrowly scoped Svelte
  islands.
- `src/utils/`: config loading, content/routing helpers, settings, and the
  transition manager.
- `src/plugins/`: Remark, Rehype, and Expressive Code extensions.
- `src/styles/`: global/component CSS and Markdown deep-DOM Stylus.
- `scripts/`: materialization, deployment adapters, postbuild, and QA.

## Materialized Paths

The following paths are build inputs copied by
`scripts/materialize-profile.mjs`; their source of ownership is
`packages/site-profile`:

- `kirari.config.toml`
- `src/content/posts/`, `src/content/spec/`
- `src/_data/friends.json`, `src/_data/devices.json`
- `public/images/devices/`, `public/favicon/`, `public/og/`
- `src/snippets/`

The script clears each mapped destination before copying and records
`.kirari-profile-manifest.json`. Do not hand-edit a materialized copy and expect
it to survive the next command.

Generated directories such as `.astro/` and `dist/` are outputs, not source.
The `tmp/Firefly` and `tmp/Mizuki` trees are historical references, not current
package implementations.
