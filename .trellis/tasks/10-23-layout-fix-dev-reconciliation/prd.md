# Layout fix and valid dev reconciliation

## Goal

After the baseline audit is reviewed, correct the confirmed first-screen layout defect and carry forward only compatible, unsuperseded `dev` changes in focused PRs.

## Requirements

- The baseline audit found stable hero geometry and an intentional 18px/680ms fade-up animation that moves the hero content; the user must confirm whether this is the reported “jump” before any runtime change.
- Implement a UI fix only if the user-confirmed symptom matches defensible runtime evidence and the root cause is established. If it does not match, record the gap and leave runtime code unchanged.
- Add a regression test or browser check that exercises the original defect where technically feasible.
- Baseline ledger dispositions: #159's CI tweak, #157's patch batch, and #158's minor/legacy Worker batch are superseded by current main. Do not merge old `dev` wholesale; any new work starts from current `main` and carries only justified changes.
- Keep bugfix and reconciliation changes separate; ADS v0.3 evidence supports a separate pinned adoption PR if the parent task continues.
- GitHub returned no branch protection or rulesets. The parent requires normal PR merges after exact-HEAD checks and independent review, and forbids bypass if protections are enabled; absence of a rule does not remove those gates.
- Use normal protected-branch PRs, exact-HEAD Actions checks, and independent review; verify post-merge SHA and CI.

## Acceptance

- The fix addresses the observed cause and regression evidence demonstrates the intended behavior, or no fix is claimed and the gate remains blocked.
- Every dev-only entry is resolved with recorded evidence.
- Required checks and independent review pass before merge; post-merge CI passes.
- Only intended changes appear in each PR.


## Follow-up scope: route transitions and shared navigation

The user reported that `/blog/` still appears to re-render when content loads, asked for page-wide review including the top progress bar, and reported a ghost image after selecting an Explore item. Production reproduction confirms the Explore ghost: on Blog → Explore → Categories, the outgoing open dropdown remains as a translucent old-page snapshot around 80ms and is gone by 140ms. The shared navbar View Transition captures the hover-open dropdown because it has no independent transition treatment.

Acceptance for this follow-up:

- Prevent the outgoing Explore dropdown snapshot from appearing over the destination route while preserving the navbar transition and keyboard `:focus-within` behavior.
- Confirm the fixed behavior using a real browser route transition and retain a regression check.
- Review each shared layout route family (home, blog/list, category, tag, post, search, and static/feature pages) on desktop and mobile; record which route families are sampled rather than claiming every content URL was visited.
- Verify the 3px top progress bar starts and settles cleanly on client navigation and is hidden on direct page load.
- Record and classify any visible layout movement; do not claim a general page-wide pass from homepage-only evidence.
