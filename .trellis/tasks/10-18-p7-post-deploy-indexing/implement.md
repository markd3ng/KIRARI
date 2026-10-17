# Implementation plan — P7

- [x] Verify the event sender and payload contract against official Vercel/GitHub documentation and repository records; pin the approved project ID and document the event's missing Team ID.
- [x] Implement build-only key-file preparation; remove build network calls.
- [x] Implement fail-closed event, canonical commit, sitemap and opt-in IndexNow handler with bounded limits and a three-attempt replay cap.
- [x] Keep Google API fail-closed; update current user docs and site quality spec.
- [x] Add regression tests for no-network build, event rejection, canonical commit checks, sitemap boundaries, provider errors and replay limits.
- [x] Run focused tests, `pnpm check`, site build, release checks, diff checks and full standard CI on the candidate tree; exact PR head `0fa8d34f92e5e1ab4cd724dcede8a0c280d3770a` also passed GitHub CI run `39051460922`.
- [x] Independent code review and repair confirmed findings; prepare a scoped PR. Do not enable providers or change Production configuration.
- [x] Push candidate and open scoped PR #152; keep Issue #100 open pending resolution/acceptance of the documented live Team ID/provider validation boundary.
- [x] Re-run exact-head CI after this evidence-only update; GitHub CI run `39051786484` passed on `9796006ff369973cf009610eb14563c02d8b0951`. Do not enable providers or change Production configuration.
