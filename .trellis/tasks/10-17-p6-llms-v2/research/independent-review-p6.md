# Independent P6 source and output review — 2026-10-17

Reviewer: independent `p5_merge_integration_review` agent. Reviewed the expanded
working-tree implementation after PR151's first-batch commit `718777f`, including
the final parse5 HTML renderer enhancement. This report does not claim a final
commit, merge, deployment, or completion of Issue #101.

VERDICT: PASS. No actionable correctness or security finding remains in the
reviewed source-backed views, discovery, index generation, or retained-full policy.

## Evidence and boundaries

- New `llms-build.test.mjs` executes the actual staged external Site/Astro build,
  without replacing shared workspace output. All three scenarios passed on
  Node 22: enabled `/docs/` with default-language prefixes, enabled `/docs/` with
  the default language at root, and disabled LLM export. A final rerun of both
  enabled scenarios also passed after requiring every advertised Markdown view
  and covering-index target in generated HTML to exist.
- These builds verify canonical nested-slug endpoints, localized/default-route
  selection without duplicate Markdown aliases, source-relative document links,
  real local-image emission and public assets, query/fragment retention, draft
  content exclusion, math/code/Mermaid/PlantUML/table/footnote fidelity, supported
  MDX video fallback, import/expression omission, unsafe-URL removal, optional
  sitemap inclusion without retired output or Markdown-view pollution, and
  retained `llms-full.txt` output.
- The final parse5 HTML enhancement followed the fixture runs. Fresh independent
  focused tests against that final renderer and URL resolver passed 12/12,
  including HTML anchor/image/embed conversion, inline/block script/style
  omission, executable attributes, protocol obfuscation, MDX implementation
  omission, unpublished targets, and encoded source paths. The root agent owns
  the final complete Site-suite/build rerun after the frozen install.
- The staged builds exposed the real pnpm `.bin/astro` lexical-path failure.
  The separately owned package build script now invokes the same Astro CLI
  through `node node_modules/astro/bin/astro.mjs`; all fixture builds passed
  after that fix. No test-only launcher workaround was introduced.

## Reviewed contracts

Published descriptors reuse the existing public post selection and localized
spec fallback. Static paths come only from that inventory, and discovery uses the
same canonical identity. The source resolver never enumerates arbitrary files:
document targets must match published entries, image imports come from a bounded
Astro glob, missing images and unsupported local attachments fail explicitly,
and unpublished source-document targets lose their link while retaining text.

Markdown and MDX are parsed without executing imports or expressions in the export
renderer. Code/math/diagram spans remain literal; supported static destinations
are rewritten, and unsafe schemes are checked before and after rewriting. HTML
uses a parsed tree; script/style/template content and event attributes do not
become executable output. Ordinary Site MDX remains trusted build-time code under
the existing repository model.

Postbuild locale writes require a same-origin, query/fragment-free, direct locale
`llms.txt` path under the configured base. They cannot derive traversal targets
from arbitrary discovery. Legacy cleanup remains one fixed nonrecursive filename.
The full aggregation remains public and retained; robots and no-store paths now
follow the deployment base, with no access-control claim. Include/exclude patterns
curate indexes rather than changing publication/privacy semantics.

`git diff --check` passed. No runtime or peer-owned source was edited during review;
the reviewer owns only the new build fixture and this review record. Live serving
headers, browser navigation, provider state, and final-head CI remain root-owned
validation and are not inferred from these local results.

## Concurrent-cache follow-up

The root agent's complete Site suite subsequently reproduced a real shared-cache
failure: an ordinary default build saw the fixture's `guide/asset.png` collection
entry from another staging root. The previous conditional Astro `cacheDir` left
nondeterministic stages using a cache beneath shared `node_modules`.

Reviewed the fix to always use project-local `cacheDir: "./.astro"`. Each external
stage has its own project root, so both collection and generated-asset cache state
are isolated while dependency files remain shared. The already-supported
deterministic build cache location now applies consistently to ordinary builds.

Added and independently ran an explicit concurrent regression on Node 22: two
actual staged builds share dependencies and identical content IDs but have
different title/body/base sentinels and local image dimensions/content. Both
processes close before cleanup, including failures. Each emitted HTML, Markdown
view and index contains its own sentinel/base and excludes the other; emitted
image metadata matches its own source and image identities differ. PASS (10.6 s).
This supplements the observed failing full-suite case without mutating the root
configuration back to the broken setting. The original three fixture scenarios
now await the same asynchronous builder helper; the root owns their full-suite
rerun after this cache fix.

## Final review follow-up

Independent review of the final five-file correction PASS: plain description text cannot forge Markdown links; unused reference definitions cause no URL resolution; referenced definitions preserve first-definition and identifier behavior; shared root URL and contextual errors preserve export behavior. Cache/CLI allegations do not match the supported staged-build path; missing referenced attachments deliberately fail closed. Root ran all 25 current LLM tests, including four actual build scenarios, with no failures after these corrections. The earlier complete standard CI passed at 2512adb; a new exact-head CI is required for the final commit.
