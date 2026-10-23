# Advisory OCR triage

Run 38996570621 reviewed e5bade6664535b208c4f1a8db72512218283c8d0. All three opinions were checked against execution paths, tests and current official API evidence; count is not a blocking criterion.

| Opinion | Classification | Evidence / action |
| --- | --- | --- |
| CI timeout should increase from 25 to 35 minutes because local logs were slow | Non-blocking suggestion, no demonstrated CI defect | The actual initial-head standard CI run 38996537987 verify job passed in 132 seconds (02:51:25–02:53:37 UTC), with browser jobs also passing. Local wall times do not establish GitHub runner duration. New adapter tests take under one second. Preserve existing timeout; no split framework/job needed. Final-head CI must still pass. |
| Synthetic signal cannot detect client disconnection | Reasonable documentation hardening | True known platform limitation, already recorded in capability evidence. Source comment now makes it explicit. A genuine signal is preserved; missing-signal fallback supports Core and its separate timeout, without pretending to observe disconnects. |
| Late response branch can leave the outer Promise pending after abort | False positive | Abort handler settles the outer Promise before setting up late-response handling (and the final identity-stream implementation unconditionally rejects on abort). The `aborted` late branch only cancels a body after that settlement. Regression `a response arriving after the upstream deadline has its body cancelled` and stalled header/body deadline tests pass with a fetch implementation ignoring cancellation. Adding a second reject in the late branch is unnecessary. |

Independent current-doc research separately caught unsupported custom TransformStream callbacks and broader reader chunk types. Both real compatibility gaps were fixed with identity TransformStream / writer.abort(string) and byte normalization, with emitted-handler and mixed-chunk regression tests. Final independent re-review passes all 19 tests.
