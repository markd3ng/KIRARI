# Shared Thinking Guides

These guides cover verified cross-package risks:

| Guide | Use when |
|---|---|
| [Code Reuse And Generated Copies](./code-reuse-thinking-guide.md) | Changing duplicated values, helpers, config, or materialized files |
| [Cross-Layer Data Flow](./cross-layer-thinking-guide.md) | Changing config, content, edge routes, build outputs, or payloads |
| [Repository Workflow](./repository-workflow.md) | Validating, committing, updating docs, or preparing releases |

Before changing a value, search its current source and consumers. Prefer
Codegraph for source symbols and call paths; use direct inspection for TOML,
JSON, workflow, and deployment files.

Treat `tmp/`, historical plans, audits, and materialized copies as evidence to
classify, not implementation authority.

For repository-level verifier changes, read the
[Root Audit Input Contract](../repository/root-audit-inputs.md).

For pinned-pnpm audit parsing, read the
[Root Audit Format Contract](../repository/root-audit-format.md).

[Root Audit Continuing Eligibility Contract](../repository/root-audit-authorization.md) covers fail-closed publisher conclusions, revocation limits, and activation prerequisites.
