# Independent adapter review

Reviewed 2026-10-17 against baseline `d7b72b0360f9b1c312fc1fa476a78ad62454c374` and the current uncommitted task implementation, including the final TransformStream bridge and stalled rejected-response cancellation regression.

## Result

No actionable correctness or security findings in the reviewed change. No runtime source was edited by this reviewer.

## Scope and evidence

- Read `check.jsonl`, PRD, design, implementation plan, accepted Core contract/source, relevant adapter/security/workflow guidance, and the research agent's current Makers capability matrix.
- Reviewed adapter `src/`, package generator, package manifest, TypeScript configuration, README and all adapter tests; reviewed root package scripts, lockfile importer, CI additions and boundary documentation.
- Core remains unchanged. The adapter passes only public mode/origin policy, an abort-aware fetch port, and the fixed `CACHE_NONE` capability. It does not read context env, Secrets, KV, caches, token options or caller forwarding headers. Existing fixed upstream/path/query/method/redirect/size/error decisions remain Core-owned.
- The missing inbound signal fallback preserves Core access to the original request properties. The fetch bridge rejects a missing-header deadline, errors a stalled streaming body, cancels a late response, and cancels the source when Core rejects status/headers without consuming a body. TransformStream construction follows the documented runtime constraint. Writer/pump promise failures are consumed and do not expose provider exception details.
- Standalone origins use Core's exact HTTPS validation and CORS behavior; the documentation correctly states that originless clients remain allowed and CORS is not authentication.
- Packaging uses a fixed dedicated output directory, no recursive deletion or user-selected destination, preflights symlinks before writes, bundles without runtime imports, emits ESM package metadata, and emits both base and descendant function route files. No deploy/auth/link/env command is added.
- New type-check, test and package generation commands run in the existing blocking CI verify job. Root check includes adapter type-check/tests. No cache or secret capability is enabled by CI.

## Executed checks

Using Node 22 from `/opt/homebrew/opt/node@22/bin` and corepack pnpm 9.14.4:

- `pnpm gateway:edgeone:type-check` — passed after final source changes.
- `pnpm gateway:edgeone:test` — all 17 tests passed, including emitted ESM invocation, no-secret access, origin policy, deadline/stream cancellation and symlink safety.
- `pnpm gateway:edgeone:package` — passed; five expected output files, self-contained 30,579-byte function bundle.
- `git diff --check` — passed.

The root agent owns the full repository checks and exact-HEAD remote CI; those were not redundantly rerun by this reviewer.

## Explicit limits

No live Makers deployment, account settings, credential access or external write was performed. Node simulation does not prove provider routing/encoded-path behavior, live JavaScript/stream implementation, CPU or wall-clock enforcement, client disconnect delivery, transport abort, cache scope or secret isolation. These remain accurately documented platform verification limits, not a claim that the current local checks exercised them. The underlying native fetch may continue after the application deadline if Makers ignores AbortSignal; the adapter still bounds its response and attempts to cancel any later body.
