# Vercel Deployment

## When To Use This

You want to deploy KIRARI as a static site on Vercel. No Edge Function
required.

## Prerequisites

- Vercel account
- Vercel CLI or Git integration

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
npx vercel deploy apps/site/dist --prod
```

## Environment Variables

None required.

## Verification

Visit your deployed site. Confirm all routes work, including search and RSS.

## Notes

- Vercel automatically detects Astro and applies the correct configuration.
- The root `vercel.json` at `apps/site/vercel.json` sets caching and security
  headers for the static output.
