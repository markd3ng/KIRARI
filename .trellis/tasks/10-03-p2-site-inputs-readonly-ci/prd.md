# P2 Site inputs and read-only CI

## Goal

Deliver only P2: make the Site-owned input contract usable as a thin starter and loss-checkable migration, and automatically produce read-only, provenance-bearing artifacts from the accepted config ref. GitHub Project #1 and Issues #96/#97 remain the formal execution queue; this Trellis task is an implementation/evidence record.

## Confirmed facts

- P1 / Issue #95 is complete. Remote `main` is `9a9c496c191ba541d3882bd00e831e5fbc1d8721`.
- The current `ci.yml` retains manual composition inputs and only runs composition on `workflow_dispatch`; auto push filters are `main` and `dev`.
- The remote `config` branch does not exist. The prompt authorizes creating it from validated `main`.
- Issues #96/#97 are attached to Project #1 and are Todo / Next Executable Phase. Their original contracts omit accepted Site Contract v2 and OCR details.
- Issues #110–#112 are in the Project. Duplicate RM-13 #108 is closed; #107 is the active Project item.
- Current repo secrets include `OCR_LLM_MODEL`; no repository variable of that name exists. The secret value cannot be read or safely copied by this task.
- `KIRARI-Site-Template` is public and currently contains only `README.md`.
- `vercel.json` keeps `git.deploymentEnabled.main=false`.

## Requirements

- Reconcile the Project and Issue contracts before implementation; preserve future work in existing issues and do not start P3/P5/P6/P7/P8.
- Accept `CONFIG_SITE_REPOSITORY=markd3ng/KIRARI`, `CONFIG_REF=config`, creation from validated `main`, and push plus PR read-only triggers.
- Define Site Contract v2 with `.kirari/site.toml` for bootstrap/schema/Core pin and ordinary Site config for product settings. Pin Core with a full immutable submodule SHA; initialize with `git submodule update --init --recursive`, never `--remote`.
- Keep the external Site thin and support public/private repositories with one contract. Include `content/posts/`, `content/pages/`, `data/`, `assets/`, `public/`, and trusted `snippets/`.
- Define stable taxonomy IDs and URL slugs with localized labels/descriptions/aliases; support `zh-Hans`, `zh-Hant`, `en`, and `ja`.
- Provide a deterministic AI-assisted setup protocol and one-time loss-checked migration from `packages/site-profile`, with a mapping/report and minimal, full-feature, and legacy fixtures.
- Include only SEO/GEO semantic inputs with real consumers. Do not implement or claim rendered/browser validation.
- Reconcile current manual CI and make config push/PR builds read-only, no-indexing, no-production-credentials, path-safe, and provenance-bearing. Preserve manual composition.
- Add separate advisory Alibaba Open Code Review workflow with the accepted pin, events, guards, permissions, and configuration.
- Preserve build input immutability, symlink/traversal boundaries, stale-output safety, zero indexing requests, and the main deployment guard.

## Acceptance criteria

- [ ] Project scope, dependencies, status, and accepted P2 constants match Issues #96/#97; no P2 executable work remains outside Project.
- [ ] Gate 1 reconciles manual, config-push, and config-PR event/ref semantics in `ci.yml` and relevant issue contracts.
- [ ] Gate 2 validates a separate advisory OCR workflow against pinned action metadata; it is not a required check.
- [ ] Site Contract v2, starter, immutable Core pin, setup protocol, taxonomy, i18n, SEO/GEO semantic inputs, and migration are implemented and tested.
- [ ] Minimal, full-feature, and legacy-migration fixtures pass schema, route/asset, no-loss, no-writeback, provenance, and meaningful repeatability checks.
- [ ] Config push, config PR, and manual composition paths produce inspectable artifacts with full Core/Site SHAs, schema/toolchain, and artifact identity.
- [ ] Full deterministic repo checks and security gate pass or have explicit blocking evidence.
- [ ] Independent GitHub-Project-to-code Phase Exit Audit passes with no scope drift.
- [ ] No P3/P5/P6/P7/P8 implementation, deployment, production credential use, indexing submission, release/tag, or DNS change occurs.

## Out of scope

P3 staging/browser validation; P4 production promotion; P5 Edge Gateway or other hardening issues; P6 LLM discovery; P7 indexing lifecycle; P8 analytics/ads; deployments, releases/tags, DNS, secret exposure/rotation, and environment promotion.

## Open operational prerequisite

The OCR action must use `${{ vars.OCR_LLM_MODEL }}` per the accepted contract. The current encrypted secret cannot be read or copied without exposing it. Continue work with the prescribed variable reference; runtime OCR validation remains blocked until the owner sets the repository variable.
