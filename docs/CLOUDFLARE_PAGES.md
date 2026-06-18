# Cloudflare Pages Deployment

## When To Use This

You want to deploy KIRARI as a static site on Cloudflare Pages. No Worker
required.

## Prerequisites

- Cloudflare account
- `cloudflare pages` CLI or GitHub/GitLab integration
- Node.js 22.12.0 or newer

## One-Click Path

1. Connect your Git repository to Cloudflare Pages.
2. Set:
   - **Build command**: `pnpm build`
   - **Output directory**: `apps/site/dist`
3. Deploy.

## Manual Path

```bash
pnpm build
npx wrangler pages deploy apps/site/dist --project-name kirari
```

## Environment Variables

None required. Secrets (API keys) go in Cloudflare Pages environment settings.
If the platform does not infer the runtime, set `NODE_VERSION=22.12.0`.

## Verification

Visit your deployed site. Confirm `/`, `/blog/`, `/search/`, RSS, and sitemap
work.

## Troubleshooting

- **Build fails with pnpm not found**: Cloudflare Pages supports pnpm natively.
  Ensure your project root has `packageManager` in `package.json`.
- **404 on client-side routes**: Ensure `trailingSlash: "always"` is set in
  `astro.config.mjs` (it is by default).
