# Design

## Baseline

- Audited range: `408dff70c5aa7b39cbd3df31103b5847dba9751f..d1286c9c65e561fe7ac62501d1ea027bef3be326`.
- Initial HEAD: `d1286c9c65e561fe7ac62501d1ea027bef3be326` on `codex/external-site-build-poc`.
- Initial tracked diff: clean. Existing untracked `kirari-agent-pack-v2/` is user data and must remain untouched.
- Initial context reports no active Trellis task; this task is the local task record for the requested work.

## Ownership and interfaces

- A: F1/F6; `.github/workflows/ci.yml`, root profile check and directly related CI regression coverage.
- B: F2/F4; `apps/site/scripts/postbuild.mjs`, indexing implementation and isolated indexing tests. Must not edit CI or external-build publication.
- C: F5; `scripts/build-external-site.mjs` or actual dist publisher and fault-injection tests. Must not edit CI/indexing.
- D: F8/F9; README variants, `SECURITY_MODEL.md`, and relevant `.trellis/spec` docs only.
- Primary agent: F3/F7 research, cross-task review, integration, full verification, independent audit, and final local commit if every required gate passes.

Shared checkout is used with disjoint file ownership. The runtime allows four concurrent agents total including the primary, so three workers can run at once; dispatch D as soon as a slot opens. Any shared-file need must be coordinated before editing.

## Design constraints

- Preserve fail-closed profile validation and production indexing only behind explicit authorization.
- Tests must stub network calls and use dummy credentials.
- Stage and publish dist on the same filesystem; recovery state must distinguish valid prior output from incomplete candidates/backups.
- Documentation describes what code does today and preserves Trellis. Build-time MDX and build plugins can run with the invoking Node process permissions; snippets are loaded as raw strings and injected for browser execution, so do not describe snippets as Node build code without evidence.
- Dependency findings remain separate from the PR-1 implementation diff.
