# Current EdgeOne Makers capability evidence

Verified **2026-10-17**, using current official Makers pages, their explicitly linked runtime references, and Context7 `/websites/pages_edgeone_ai_zh_document`. Context7 resolved the product and corroborated handler, routing, limits and configuration; it supplied no additional proof of abort behavior. Some English URLs timed out in the web extractor; their Chinese equivalents and direct official HTML were readable. No deployment, account linking, credential access or external mutation was performed.

**Supported** means explicitly documented, not live-tested. **Partial** means documented with important gaps or conflicting evidence. **Unverified** means the retrieved sources do not establish the required contract. Node-based execution cannot promote either latter status to supported.

## Handler and routes — supported, with one routing gap

The [Makers Edge Functions contract](https://pages.edgeone.ai/zh/document/edge-functions) documents:

```ts
export function onRequest(context: EventContext): Response | Promise<Response>
```

`context`: `request`, `params`, `env`, `waitUntil(task: Promise<any>): void`. A default export and method-specific named exports also appear. Use the all-method handler for Core validation.

Paths are case-sensitive. `index.js` maps to its directory; `[[default]].js` matches descendants; `[id].js` matches one segment. Static assets win conflicts. Global request registration via `addEventListener` is unsupported.

Recommended emitted files:

```text
edge-functions/_kirari/edge/index.js
edge-functions/_kirari/edge/[[path]].js
```

An empty catchall suffix, trailing-slash normalization and encoded-segment handling are unverified. Include `index.js` for the base route; validate URLs in Core. Avoid static route collisions.

## Packaging and local tooling — partial

The [CLI documentation](https://pages.edgeone.ai/document/edgeone-cli) requires Makers Functions directories **and `package.json` inside a manually built output directory**. It documents `edgeone makers dev`, default port 8088, and a development command resolved from `edgeone.json` then `package.json`. A dev command must not recursively invoke the Makers dev command. Linking a project enables KV and console environment synchronization. Development service startup has an unspecified count limit.

The [build guide](https://pages.edgeone.ai/document/build-guide) allows root, build command, output directory and install command customization; output paths are relative to the configured root. The [configuration reference](https://pages.edgeone.ai/document/edgeone-json) documents `buildCommand`, `installCommand`, `outputDirectory` and build-time `nodeVersion`. These are build settings; they do not establish Node.js support inside Edge Functions.

Recommendation: generate a separate, dependency-free ESM package root with the two bundled JavaScript handlers, `package.json`, and a static `public/404.html`; use `outputDirectory: "public"`. Bundle Core locally with the existing esbuild toolchain and browser/Web API targeting. This bundler choice is a project implementation decision, not an official Makers bundler requirement. No retrieved source specifies an Edge Functions-specific esbuild flag, external dependency resolution contract, or import-extension policy; standalone bundles avoid relying on them. Local package generation must not call deploy/link/auth/env commands.

## Web APIs and Node differences — partial

Makers explicitly delegates most runtime details through links in its [runtime section](https://pages.edgeone.ai/document/edge-functions). The following Tencent references are used **only because Makers links them**; unrelated classic EdgeOne and Cloudflare behavior is not imported.

| Requirement | Status | Exact evidence / gap |
| --- | --- | --- |
| Request URL, method, headers; Response | Supported | [Request](https://cloud.tencent.com/document/product/1552/81902) and Makers API table describe them. |
| `Request.signal`, `RequestInit.signal` | **Unverified** | Linked Request member/initializer lists omit both. Absence from documentation does not prove absence at runtime. Node's Request does provide them, so a Node test alone can hide this gap. |
| `AbortController`, `AbortSignal`, EventTarget, timers | Supported | [Web Standards](https://cloud.tencent.com/document/product/1552/84091) explicitly lists these and `setTimeout`/`clearTimeout`. Makers' restriction on global request registration does not establish a restriction on EventTarget listeners. |
| Fetch cancellation by signal | **Unverified** | Linked [Fetch](https://cloud.tencent.com/document/product/1552/81897) does not document signal consumption or transport cancellation. An available controller alone is insufficient proof. |
| Manual redirects | Supported | Linked Fetch documents `redirect: 'manual'`. Default is follow. |
| Reader / stream cancellation | Supported, with constructor difference | Linked [ReadableStream](https://cloud.tencent.com/document/product/1552/81914) documents `getReader()` and `cancel()`. It prohibits directly constructing ReadableStream; use TransformStream for construction. Node allows construction. |
| Custom TransformStream transformer / controller | **Unsupported in the delegated contract** | [TransformStream](https://cloud.tencent.com/document/product/1552/81923), updated 2025-01-08, explicitly says the `transformer` argument is unsupported and silently ignored. A `start(controller)` callback and resulting `controller.error()` cannot implement the deadline bridge. Use identity `new TransformStream()`, exposing `readable` and `writable`. |
| Writer operations for identity bridge | Supported | [WritableStream](https://cloud.tencent.com/document/product/1552/81922) documents `getWriter()`. [WritableStreamDefaultWriter](https://cloud.tencent.com/document/product/1552/81927) documents `closed`, sequential `write`, `close`, `abort(reason?: string)` and `releaseLock`. Abort with a sanitized string and observe rejections; an Error-valued reason is not established by this narrower signature. |
| Reader chunk types | Partial | [ReadableStreamDefaultReader](https://cloud.tencent.com/document/product/1552/81924) documents sequential `read`, `cancel`, and `releaseLock`; a chunk may be `string`, `ArrayBuffer` or `ArrayBufferView`. Guaranteed Uint8Array chunks are unverified. Normalize or explicitly reject other representations at the adapter boundary before Core's byte-bound reader. |
| Text decoding | Supported | Linked [Encoding](https://cloud.tencent.com/document/product/1552/81896) documents TextDecoder. |

Normalize missing inbound signals at the adapter boundary using its own controller without modifying Core. Preserve a genuine signal when available. Do not claim a synthetic signal detects client disconnection. A bounded Promise race can preserve application response deadlines even if fetch ignores signals; it cannot prove the underlying network request was cancelled. Test that distinction explicitly and retain it as a live-runtime limitation.

## Cache — partial, disabled in this adapter

The Makers-linked [Cache reference](https://cloud.tencent.com/document/product/1552/81893) states that cache contents exist only on the current data node and are not automatically replicated. It documents `caches.default`, `caches.open(namespace)`, `match`, `put` and `delete`. No project/account isolation scope or globally coordinated invalidation guarantee is established.

Only GET requests are accepted for writes. TTL uses response Cache-Control (`s-maxage`, `max-age`); `no-store`, `no-cache`, or `private` makes put fail with 413. Expired match may throw 504 instead of behaving like a normal miss. Put resolves undefined regardless of whether storage succeeds. Delete's boolean indicates network outcome, not evidence of global purge. These semantics need a dedicated adapter, explicit key isolation, expiry validation and error treatment before satisfying Core cache capabilities.

The [Makers runtime note](https://pages.edgeone.ai/zh/document/edge-functions) states CLI fetch cannot exercise EdgeOne node cache/origin behavior. Node mocks cannot verify replication, eviction, persistence or invalidation. Recommendation: pass `CACHE_NONE`; never advertise persistent cache.

## KV — partial, disabled in this adapter

[Makers KV](https://pages.edgeone.ai/document/kv-storage) is persistent, namespace-isolated storage bound many-to-many to projects. It uses central storage plus edge caching: updates/deletes are immediately visible on the initiating node, while other nodes can retain stale values for up to 60 seconds. This is unsuitable for immediate revocation or global purge guarantees.

Documented operations are `put(key, value)`, `get`, `delete` and `list`. The `put` signature has no expiration/TTL parameter. Therefore automatic TTL and expiry metadata are unverified; do not infer Cloudflare KV options. Keys are at most 512 B and restricted to letters, numbers and underscore. Its API page allows 25 MB values, while [current limits](https://pages.edgeone.ai/document/limits-and-quotas) says KV maximum value is **1 MB**: an unresolved official conflict. Namespace binding environment separation is also unverified. KV is not a proved replacement for Core cache or protected Secrets.

## Environment variables and protected Secrets — unverified for privileged tokens

The [build guide](https://pages.edgeone.ai/document/build-guide) describes separate Production/Preview environment variables with selectable scope and says changes affect new deployments only. Conversely, the current [SDK environment-variable reference](https://pages.edgeone.ai/document/environment-variable) explicitly says variables apply project-wide and are **not split between production and preview**; its data model is key/value/comment.

This contradiction cannot be resolved without product confirmation or authorized platform verification. Neither reference establishes a distinct protected Secret type, write-only retrieval, encryption policy, build-versus-runtime exposure isolation, or preview exclusion strong enough for GitHub credentials. A generic server-side env claim is insufficient. This adapter must not inspect `context.env`, global variables or KV for a token and must not elevate capability from client headers. Public profile/origin configuration can be compiled into the bundle because it contains no credential.

## Runtime limits — documented versus unverified

| Item | Status and evidence |
| --- | --- |
| Function package / request body | Supported: **5 MB per function**, **1 MB incoming body**, [Makers Edge Functions](https://pages.edgeone.ai/zh/document/edge-functions). |
| CPU | Supported: **200 ms per invocation excluding I/O wait**, same source. |
| Language | Supported: JavaScript ES2023+, same source. Emit JavaScript rather than assuming a TS runtime. |
| Monthly free quota | Supported: **3 million executions / 3 million ms CPU**, [limits](https://pages.edgeone.ai/document/limits-and-quotas); quota policy may change. |
| Wall-clock lifetime | **Unverified for Edge Functions.** Makers limits documents Cloud Functions' 30–120 seconds separately; do not transfer that limit to this runtime. |
| Outbound fetch | Delegated Fetch reference documents **64 total calls**, **8 simultaneous**, **15-second default timeout / 300-second maximum**. These are fetch limits, not a function wall-clock guarantee. |

## Decision and verification boundary

Ship the minimal **anonymous, `CACHE_NONE` adapter**. Keep public routes, validation, response bounds, policy and errors in accepted Core; keep platform shape, signal normalization and packaging in this package. No secrets or persistent caches are enabled by documentation existence alone.

Local checks can prove bundle self-containment, route-file presence, handler export, Core delegation, request/error limits, missing-signal handling, and response deadlines under a deliberately signal-ignoring fetch mock. They cannot prove actual Makers route dispatch, JS engine compatibility, client disconnect delivery, transport abort, CPU/wall enforcement, edge cache/KV behavior or secret isolation. An authorized later preview would be needed for those live properties; this research does not require deployment to complete code review.
