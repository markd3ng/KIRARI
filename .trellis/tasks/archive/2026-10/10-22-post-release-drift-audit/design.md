# Design

## Boundaries

This is an evidence and documentation audit of the released KIRARI tree. The
repository source of truth is current `main`; GitHub Project #1 supplies live
roadmap state; each Issue supplies acceptance criteria; merged PRs and current
source/tests supply delivery evidence. Vercel's read-only deployment record
supplies current Production identity and the tag supplies version identity.

The report is the durable audit artifact. README repairs are limited to facts
that can be generated from `apps/site/package.json` and current `.astro`
`client:*` directives. A small existing `node:test`-style check will compare
those facts with both README files. No runtime behavior changes.

Project #1 currently has an outdated top checkpoint. Update only its README
checkpoint from the same verified baseline, retaining the existing roadmap
items, custom field values, dependency links, and historical entries. Do not
edit Project item statuses or issue states unless the audit finds a factual
state mismatch that the current authorization clearly covers; none has been
observed so far.

## Evidence model

For every roadmap row, preserve separate labels for implementation,
verification, acceptance, deployment, supersession, applicability, and
unverified evidence. Historical Trellis records can explain past acceptance,
but current source, CI, Project, and deployment readbacks establish current
state. Failed advisory OCR and empty GitHub review records remain explicit
coverage gaps, not zero-finding passes or release blockers by themselves.

The `main` / `v0.5.0` difference is reported by exact commit and diff: release
content is tagged at the release commit; subsequent Trellis bookkeeping is
explained without treating it as application drift.

## Compatibility and operations

- No source behavior, public interface, build setting, credential, domain,
  deployment, release record, or Git tag is modified.
- Current Cloudflare/EdgeOne runtime capabilities not proven by packaged tests
  remain explicit platform-verification limits where the accepted plan does
  not require live deployment.
- The PR targets `main`, receives normal CI, and remains open for Owner review.
- GitHub Project README update is an independent low-risk documentation write;
  report its readback separately from the repository PR.
