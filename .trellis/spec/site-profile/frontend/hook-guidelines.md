# Materialization Lifecycle

Default Profile files are copied before `site:dev`, `site:type-check`,
`site:astro-check`, and `site:build`. The external `./build.sh --site` path
builds in a disposable copy of `apps/site` and installs only successful static
output into `apps/site/dist`.

For each mapping, destination directory contents are removed before copying.
Missing source paths are skipped with a warning. A manifest records the copied
top-level mappings.

There is no merge step. A file added directly to a mapped site destination can
be removed by the next materialization. Make persistent customization in this
package.
