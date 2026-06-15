# Upstream Sync

When syncing with the upstream KIRARI repository:

## Conflict Separation

Profile-owned files in `packages/site-profile/` are unlikely to conflict with
upstream changes to `apps/site/` and `workers/kirari-edge/`, because the
monorepo structure keeps them in separate directories.

## Recommended Workflow

```bash
# Add upstream if not already configured
git remote add upstream https://github.com/markd3ng/KIRARI.git

# Fetch upstream changes
git fetch upstream

# Merge upstream main
git merge upstream/main

# Resolve any conflicts in apps/site/ or workers/kirari-edge/
# Profile-owned content in packages/site-profile/ is yours to keep
```

## What Stays Yours

`packages/site-profile/` is your domain. Upstream changes to the default
profile are additive — your custom posts, config, and assets remain intact
during merge because `git` sees them as independent files.
