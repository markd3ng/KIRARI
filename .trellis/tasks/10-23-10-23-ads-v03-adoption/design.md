# Design

Use one pinned Git submodule at `.ads` and keep the root `AGENTS.md` as KIRARI's canonical entry point. Expose only the `adopt` skill with a short `.agents/skills/ads-adopt/SKILL.md` pointer to the canonical file in `.ads`; do not copy ADS policy text or add the generic delivery/bootstrap/recovery workflows, which would duplicate or conflict with Trellis. Preserve the existing hosting-provider deployment rules and avoid runtime changes.

The new checkout starts at `origin/main` on a focused adoption branch. Verification covers the immutable gitlink, native discovery through the installed Codex CLI in read-only mode, repository docs checks, and exact-head CI.
