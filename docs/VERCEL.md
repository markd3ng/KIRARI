# Vercel Deployment

## When To Use This

You want to deploy KIRARI as a static site on Vercel. No Edge Function
required.

## Prerequisites

- Vercel account
- Vercel CLI or Git integration
- Node.js 22.12.0 or newer

## One-Click Path

1. Import your Git repository in Vercel.
2. Set:
   - **Framework preset**: Astro
   - **Build command**: `pnpm build`
   - **Output directory**: `apps/site/dist`
3. Deploy.

## Manual Path

```bash
pnpm build
npx vercel --prod
```

## Environment Variables

None required.

## Verification

Visit your deployed site. Confirm all routes work, including search and RSS.

## Notes

- The repository-root `vercel.json` sets `apps/site/dist`, search rewrites,
  immutable asset caching, and security headers.
- Run `node apps/site/scripts/generate-vercel-config.mjs --check` after changing
  provider URLs or security-sensitive feature configuration.
