# KIRARI Site Starter

A Site-owned input tree for KIRARI. Core belongs in the pinned recursive submodule at `.kirari/core`; do not copy Core source into this repository.

Public and private Sites use the same tree and schema. Keep credentials and production settings out of this starter; configure required secrets in the build or hosting environment.

## Inputs

- `.kirari/site.toml` — Site Contract version, setup state, and immutable Core pin.
- `kirari.config.toml` — ordinary product settings such as Site identity and canonical origin.
- `data/taxonomy.json` — stable tag/category IDs and slugs with localized labels and descriptions.
- `data/route-aliases.json` — explicit aliases for legacy locale route identities.
- `content/posts/` and `content/pages/` — posts and generic pages.
- `assets/` — Site-owned source assets; `public/` — files copied to the public root.
- `snippets/` — trusted Site code only. Review every file placed here.

## Local setup and build

Run `./scripts/site-setup.sh` to initialize the committed Core submodule recursively. `.kirari/site.toml` and the `.kirari/core` gitlink identify one immutable Core commit. The read-only build writes its artifact outside this Site checkout and leaves all Site inputs unchanged. See [AI_SETUP.md](AI_SETUP.md) for clean setup, migration, validation, and local build commands.
