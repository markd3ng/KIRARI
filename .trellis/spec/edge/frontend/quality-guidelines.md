# Consumer Quality

When site integration changes, verify both packages:

```bash
pnpm site:type-check
pnpm site:astro-check
pnpm edge:type-check
pnpm edge:test
pnpm build
```

Check disabled, enabled, upstream failure, and CORS behavior. Keep Node builtins
out of browser and Worker runtime code.
