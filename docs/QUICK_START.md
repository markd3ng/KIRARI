# Quick Start

```bash
git clone https://github.com/your-org/KIRARI
cd KIRARI
pnpm install
pnpm build    # Full build (materialize → astro → postbuild)
pnpm check    # Site + edge validation
pnpm site:dev # Local dev server
```

## Default Content

The first build materializes the default profile from `packages/site-profile/`
into `apps/site/`. You can replace profile-owned files to customize.

## Deploy

- **Cloudflare Pages** (default): set root `Build command` to `pnpm build`,
  `Output directory` to `apps/site/dist`.
- **Vercel**: same build command, same output directory.

No Worker configuration needed. Edge features are opt-in.
