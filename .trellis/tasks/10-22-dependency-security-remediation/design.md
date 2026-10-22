# Design: Dependency Security Remediation

## Scope and evidence

The authoritative input is the `main` lockfile and a fresh `pnpm audit --json` from `3f86df5fe5a320373aa51aa58a29ff494e9354b4`. The reported total is 17 advisories: 3 high, 7 moderate, and 7 low, with no critical advisories. The older `dev` scan and archived P1 audit are historical context only; main already includes Astro 7.3.5 and sharp 0.35.5, and the prior Astro/tar findings are absent.

## Change strategy

- Prefer patch/minor updates already permitted by the current manifest ranges.
- Use existing root `pnpm.overrides` only where transitive dependency ranges prevent a patched resolution; test consumers, especially Astro plugins and Markdown/rendering.
- Avoid unrelated framework upgrades and lockfile-wide refreshes.
- For advisories with no vendor-designated patched release, inspect package source/upstream status and application reachability. Keep the advisory visible as residual risk unless evidence supports a safe, truthful disposition.

## Compatibility and validation

Runtime source should remain unchanged unless testing demonstrates a necessary compatibility fix. The dependency manifests, lockfile, and this task's evidence record track the update and residual findings. Site test, type-check, Astro check, build, the repository `check` and `release:check` scripts, and a fresh audit validate the resulting graph. Preserve static generation behavior and existing Mermaid/KaTeX/Markdown output.

## Rollback

Revert only the dependency manifest/lockfile changes on this branch if a tested update breaks the site or violates an upstream peer range. Do not alter the main checkout or Production settings.
