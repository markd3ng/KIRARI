# P7 local validation — 2026-10-18

Candidate base: `cabb90e0c1b0eea1e40544a8dc6c84c0ced9e5c8` (`main` at implementation start).

- Node `22.12.0`, pnpm `9.14.4`; frozen install and profile checks passed.
- Focused event/notification tests passed: 9/9.
- Full repository CI-equivalent sequence passed on the candidate tree: workflow/artifact contracts (58), Site and contract suites, Trellis and QA checks, type checks, Edge/Gateway tests, EdgeOne package checks, edge dry-run, Vercel config validation, static build (112 pages), release/version checks, and `git diff --check`.
- Independent source/security review found no remaining actionable code findings after fixing the workflow pnpm setup, exact canonical build marker, complete bounded GitHub status history, and non-production runtime vetoes.
- GitHub PR #152 exact-head CI run `39051460922` passed on `0fa8d34f92e5e1ab4cd724dcede8a0c280d3770a`: `verify`, `dependency-audit`, `site-browser-validation`, and `browser-fixtures` succeeded; `composition` was skipped by workflow conditions. All Vercel PR Preview checks also succeeded; no Production deployment was performed.
- After the evidence-only update, exact-head GitHub CI run `39051786484` also passed on `9796006ff369973cf009610eb14563c02d8b0951`.
- Final pre-readback PR head `bdb307c24f01036fca2d0d4e2762e6fe74472806` passed exact-head GitHub CI run `39052060347`.
- Advisory OCR run `39051460920` failed before reviewing any file: 0/13 completed, with HTTP 402 from the configured OpenRouter provider for insufficient credits. It produced no findings. Independent source/security review is the completed review evidence.
- Read-only Vercel project GET on 2026-10-18 through the connected Vercel API returned `id=prj_QNMVdxTkPOad4ynN4fwFCYEST8Jk`, `name=kirari-main`, `accountId=team_NsBZHGUVnyygP7veiROKLuUx`; all three match the approved Production binding. The local Vercel CLI is not installed; no CLI authentication was changed.
- Vercel's GitHub dispatch does not include Team ID. Runtime validation pins the approved globally unique Production project ID and checks the served commit; it does not carry Vercel credentials. Keep #100 open until the Owner decides whether to enable IndexNow and authorize a real post-deployment provider validation.
- No Vercel credential, provider setting, Production configuration, or deployment was changed. IndexNow and Google submissions remain disabled; no live dispatch or provider request was exercised.
