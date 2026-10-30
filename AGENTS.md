# KIRARI Agent Entry Point

KIRARI is managed by Trellis. Treat `.trellis/spec/` as the verified coding
guidance and `.trellis/tasks/` as the task record.

Before editing:

1. Run `python3 ./.trellis/scripts/get_context.py`.
2. If injected session state disagrees with the repository task state, prefer
   the repository.
3. Run `python3 ./.trellis/scripts/get_context.py --mode packages`.
4. Read the relevant package/layer `index.md` files and the shared guides.
5. Follow the active task artifacts under `.trellis/tasks/<task-id>/`.

Current package boundaries:

| Package | Path | Verified specs |
|---|---|---|
| `@kirari/site` | `apps/site/` | `.trellis/spec/site/frontend/` |
| `@kirari/edge` | `workers/kirari-edge/` | `.trellis/spec/edge/backend/`, `.trellis/spec/edge/frontend/` |
| `@kirari/edge-gateway-core` | `packages/edge-gateway-core/` | `.trellis/spec/edge-gateway-core/backend/` |
| `@kirari/site-profile` | `packages/site-profile/` | `.trellis/spec/site-profile/frontend/` |

Use this evidence priority when docs disagree:

1. Codegraph findings from the current package paths
2. Current source code
3. Manifests, lockfiles, and framework configuration
4. CI/CD and deployment configuration
5. Tests and verification scripts
6. Environment examples
7. Markdown as historical evidence

Do not infer current behavior from `tmp/`, old plans, audits, or generated
materialized copies. Do not modify runtime behavior during documentation-only
tasks.

## Deployment architecture

KIRARI uses the hosting provider's native deployment mechanism. GitHub Actions
validates source and produces optional portable artifacts, but does not duplicate
the provider's native release controller.

Keep Core/Site source pinning, reproducible builds, provenance, ordinary security
controls and CI tests when they serve an independent product requirement. Edge
Gateway adapters are optional application capabilities, separate from Site hosting.
Do not rebuild custom OIDC deploy orchestration, runtime Trusted Sources gates,
per-release approval bindings or redundant staging/promotion pipelines unless the
Owner explicitly adopts a new deployment architecture. Production completion
requires an actual provider deployment with matching project, environment, commit
and canonical domain plus browser verification; green source CI is insufficient.

## ADS v0.5.0 Lite — pinned guidance

The project pins ADS release `v0.5.0` at `.ads` (commit `9bd8b115fa7a3bff19c0d69c22c0423c7141e63f`). On authorized hosts, materialize it with `git submodule update --init -- .ads`; do not use `--remote`. Read `.ads/STANDARD.md`, `.ads/SAFETY.md`, `.ads/QUALITY.md` and `.ads/docs/lite-adoption.md` as relevant. The host adapter `.agents/skills/ads-adopt/SKILL.md` points to the canonical pinned adoption Skill.

No optional ADS Strict Git, CodeGraph/RTK developer-toolchain or Strict Lifecycle profile is activated here. Reuse KIRARI's existing Trellis task/spec workflow, project-local safety, product tests and Vercel-native delivery; do not copy optional ADS scripts or duplicate these facilities. KIRARI's existing Codegraph evidence preference does not by itself enable a mandatory toolchain preflight.

The default branch is `main`; merging there may trigger provider-native Vercel deployment. This ADS pin upgrade targets `dev` via a reviewable PR and does not authorize production publication. Relevant existing commands: `pnpm build`, `pnpm site:type-check`, `pnpm site:astro-check`, `pnpm site:test`, and `pnpm check`.

<!-- TRELLIS:START -->
# Trellis Instructions

The working knowledge for this repository lives under `.trellis/`:

- `.trellis/workflow.md` — workflow phases and task lifecycle
- `.trellis/spec/` — verified package and layer guidance
- `.trellis/tasks/` — active and archived task artifacts
- `.trellis/workspace/` — developer journals and session traces

Project-local Trellis skills live in `.agents/skills/`.

<!-- TRELLIS:END -->
