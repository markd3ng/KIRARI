# Materialization Lifecycle

Profile files are copied before `site:dev`, `site:type-check`,
`site:astro-check`, and `site:build`.

For each mapping, destination directory contents are removed before copying.
Missing source paths are skipped with a warning. A manifest records the copied
top-level mappings.

There is no merge step. A file added directly to a mapped site destination can
be removed by the next materialization. Make persistent customization in this
package.
