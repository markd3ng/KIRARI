# `@kirari/edge-gateway-core` Backend Guidelines

This package owns the provider-independent, named-operation Gateway handler. It uses Web APIs and injected capabilities only; platform route packaging, bindings, caches, and deployment belong to the later adapters.

## Guides

| Guide | Use for |
| --- | --- |
| [Directory Structure](./directory-structure.md) | Core source, tests, and public package boundary |
| [Operation Contract](./operation-contract.md) | Route parsing, upstreams, input/output limits, and token boundary |
| [Cache Contract](./cache-contract.md) | Cache levels, staleness, and consistency honesty |

## Pre-Development Checklist

- Read all three guides before changing Gateway operations, cache ports, or tests.
- Trace any proposed operation to an active Site caller or an explicit Issue #102 requirement.
- Keep the core free of Node and provider-specific imports.
- Add Node built-in regression tests for changed request, response, auth, or cache behavior.

## Quality Check

```bash
pnpm gateway:type-check
pnpm gateway:test
pnpm check
pnpm build
git diff --check
```
