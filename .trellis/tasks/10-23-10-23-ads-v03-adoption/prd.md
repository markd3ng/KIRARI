# Adopt ADS v0.3

## Goal

Adopt the published ADS v0.3 guidance in KIRARI without displacing the repository's verified Trellis workflow, package boundaries, or provider-native Vercel deployment architecture.

## Requirements

- Pin `.ads` to published release commit `1e07d6c4bbd296b7d37dcd31934cfc70426f73ac`.
- Point root `AGENTS.md` to `.ads/STANDARD.md`, `.ads/SAFETY.md`, `.ads/QUALITY.md`, and the selected adoption skill, while retaining KIRARI-specific facts.
- Make the selected ADS adoption skill discoverable through the documented Codex project skill path.
- Keep the change to submodule metadata and guidance; do not alter runtime or deployment behavior.
- Verify the gitlink and checked-out SHA, links, host skill discovery, and repository documentation checks.

## Acceptance

- `.gitmodules` uses the public ADS URL without credentials and `.ads` records the exact approved SHA.
- Codex can discover `ads-adopt` and report the skill's purpose from a harmless read-only prompt.
- Root instructions preserve Trellis and native Vercel deployment constraints.
- Required PR checks pass; merge remains subject to repository policy and gates.
