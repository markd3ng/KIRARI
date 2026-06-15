# Migration Guide

Migrate from the old single-package KIRARI to the monorepo structure.

## If You Have a Fork

### 1. Update to Latest Layout

```bash
# Backup your custom content
cp -r src/content/posts ~/backup-posts
cp -r src/content/spec ~/backup-spec
cp src/_data/friends.json ~/backup-friends.json
cp kirari.config.toml ~/backup-config.toml
cp -r public/favicon ~/backup-favicon
cp -r public/og ~/backup-og
cp -r src/snippets ~/backup-snippets

# Update to the monorepo commit
git pull upstream main
```

### 2. Restore Custom Content

Replace files in `packages/site-profile/` with your backed-up content:

```bash
cp ~/backup-posts/* packages/site-profile/content/posts/
cp ~/backup-spec/* packages/site-profile/content/spec/
cp ~/backup-friends.json packages/site-profile/data/
cp ~/backup-config.toml packages/site-profile/
cp -r ~/backup-favicon/* packages/site-profile/assets/favicon/
cp -r ~/backup-og/* packages/site-profile/assets/og/
cp -r ~/backup-snippets/* packages/site-profile/snippets/
```

### 3. Verify

```bash
pnpm install
pnpm build
pnpm check
```

## If You Start Fresh

Just clone, `pnpm install`, `pnpm build`, and deploy. The default profile
provides demo content.

## Pages-Only Deployment

Your existing Cloudflare Pages or Vercel deployment continues to work. Update
the build command if needed:

- **Build command**: `pnpm build`
- **Output directory**: `apps/site/dist`
