# Profile Contracts

`kirari.config.toml` is parsed as unknown data and normalized by
`apps/site/src/utils/config-loader.ts`. New fields require synchronized type,
validator/default, profile comments, and user documentation changes.

Post frontmatter is validated by `apps/site/src/content.config.ts`. Use valid
dates and the existing field names; do not invent profile-only aliases.

JSON files have no package-local schema. Before changing their shape, inspect
the current site consumers and add a runtime/type boundary if the data becomes
externally supplied.
