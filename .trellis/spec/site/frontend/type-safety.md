# Type Safety

## Configuration

User config flows through:

`packages/site-profile/kirari.config.toml` → materialized TOML →
`src/utils/config-loader.ts` → `Config` in `src/constants.ts` → section exports
in `src/config.ts`.

Do not hardcode user-configurable behavior or content in components. Add it to
the TOML pipeline when a maintainer is expected to customize it. Fixed protocol
values, accessibility labels, and implementation constants do not become
configuration merely because they are literals.

For a new field, update the profile TOML, `src/types/config.ts`, the `TomlConfig`
shape, runtime validation/defaulting in `loadConfig`, and affected docs. Raw
TOML fields are `unknown`; validate them before constructing `Config`.

Use the existing primitives (`getString`, `getBoolean`, `getNumber`,
`getStringArray`, `getStringRecord`) or a focused validator for structured
arrays/unions. Do not cast raw TOML or remote JSON directly to a final type.

The materialized TOML is loaded at build time as raw text with:

```ts
import.meta.glob("../../kirari.config.toml", {
  eager: true,
  query: "?raw",
  import: "default",
});
```

Trusted Head/Footer files use the separate eager raw glob
`../snippets/*.{html,js}`. A configured filename must match
`^[A-Za-z0-9][A-Za-z0-9._-]*\.(html|js)$`; absolute paths, subdirectories, and
traversal are rejected. The loader combines inline maintainer content with the
selected file content.

## Content And Props

`src/content.config.ts` defines the authoritative post schema with Astro/Zod.
Keep nullable frontmatter normalization there when all consumers need it.
Astro components declare typed props; Svelte components type `$props()`.

External APIs remain trust boundaries even when TypeScript types exist.
Validate fields used for URLs, HTML, or security decisions at runtime.
