# `@kirari/edge` Backend Guidelines

`workers/kirari-edge` is currently one stateless Cloudflare Worker module. It
provides opt-in GET/HEAD proxy routes for GitHub, avatars, Bangumi API, and
Bangumi images. It has no database, KV namespace, Durable Object, router
framework, or persistence layer.

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
