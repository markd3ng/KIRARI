# Type Safety

## Configuration

User config flows through:

`packages/site-profile/kirari.config.toml` → materialized TOML →
`src/utils/config-loader.ts` → `Config` in `src/constants.ts` → section exports
in `src/config.ts`.

For a new field, update the profile TOML, `src/types/config.ts`, the `TomlConfig`
shape, runtime validation/defaulting in `loadConfig`, and affected docs. Raw
TOML fields are `unknown`; validate them before constructing `Config`.

Use the existing primitives (`getString`, `getBoolean`, `getNumber`,
`getStringArray`, `getStringRecord`) or a focused validator for structured
arrays/unions. Do not cast raw TOML or remote JSON directly to a final type.

## Content And Props

`src/content.config.ts` defines the authoritative post schema with Astro/Zod.
Keep nullable frontmatter normalization there when all consumers need it.
Astro components declare typed props; Svelte components type `$props()`.

External APIs remain trust boundaries even when TypeScript types exist.
Validate fields used for URLs, HTML, or security decisions at runtime.
