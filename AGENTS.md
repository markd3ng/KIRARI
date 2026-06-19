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

<!-- TRELLIS:START -->
# Trellis Instructions

The working knowledge for this repository lives under `.trellis/`:

- `.trellis/workflow.md` — workflow phases and task lifecycle
- `.trellis/spec/` — verified package and layer guidance
- `.trellis/tasks/` — active and archived task artifacts
- `.trellis/workspace/` — developer journals and session traces

Project-local Trellis skills live in `.agents/skills/`.

<!-- TRELLIS:END -->
