# Materialization Lifecycle

Default Profile files are validated, staged, and copied before `site:dev`,
`site:type-check`, `site:astro-check`, and `site:build`. The external
`./build.sh --site` path validates and stages the mapped inputs, builds in a
disposable copy of `apps/site`, and installs only successful static output into
`apps/site/dist`. Materialization does not use the original Site Source as a
write target.

All mapped outputs and the ownership manifest are staged before installation.
An absent required input fails validation before mapped outputs are replaced.
An absent optional directory such as `content/posts/` becomes an empty target;
an absent optional file such as `ads.txt` or `data/devices.json` is removed
from generated output. Present mapped targets are replaced from the staged
copy. The manifest records copied and omitted optional mappings. Installation
failure rolls back replaced paths; if rollback is incomplete, recovery files
are preserved and named in the error.

There is no merge step. A file added directly to a mapped site destination can
be removed by the next materialization. Make persistent customization in this
package.
