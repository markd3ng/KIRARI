# `@kirari/edge` Backend Guidelines

`workers/kirari-edge` provides opt-in legacy proxy routes plus the
`/_kirari/edge/*` Cloudflare adapter for `@kirari/edge-gateway-core`. The Core
owns named operation and upstream semantics. Cloudflare Cache API and optional
KV adapter ports are implemented, but no cache or KV binding is configured by
default.

## Guides

| Guide | Use for |
|---|---|
| [Directory Structure](./directory-structure.md) | Current single-module shape |
| [Database Guidelines](./database-guidelines.md) | Explicit absence of storage |
| [Error Handling](./error-handling.md) | HTTP and upstream failures |
| [Logging Guidelines](./logging-guidelines.md) | Worker logs and secrets |
| [Quality Guidelines](./quality-guidelines.md) | Proxy/security/test rules |

## Pre-Development Checklist

Read all five guides before changing `src/index.ts`, bindings, routes, or tests,
then read `.trellis/spec/guides/index.md`.

## Portable Gateway packages

The legacy Worker rules above describe `workers/kirari-edge` only. New named-operation Gateway work lives in `packages/edge-gateway-core`; platform packaging remains separate. Read [Gateway Adapter Boundaries](./gateway-adapters.md) before changing an adapter.
