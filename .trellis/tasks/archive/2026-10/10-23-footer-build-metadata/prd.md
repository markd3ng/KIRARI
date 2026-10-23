# Show version and browser-local build time in footer

## Goal

Add the current release version and build timestamp in each visitor's browser-local time to the shared site footer.

## Requirements

- Keep the existing two-line footer structure and spacing.
- After the linked KIRARI commit, show the current Site package version as a `v`-prefixed tag, then the build date and time.
- Display build time in the visitor's browser-local timezone using `YYYY-MM-DD HH:mm:ss`; do not display `UTC`, an offset, or a timezone name.
- Use the existing build clock and package version as the sources of truth, with one build timestamp shared by all rendered pages and responsive footer copies.
- Keep the value correct on direct loads and client-side page transitions without introducing a visible layout shift.

## Acceptance Criteria

- [x] Every page using the shared footer displays the version immediately after the commit link and a browser-local build timestamp.
- [x] The timestamp has the agreed numeric format and no timezone label.
- [x] Footer timestamp remains present after Astro/Swup navigation and does not produce a layout shift.
- [x] Relevant tests, type checks, and production build pass.
- [x] Change is reviewed, merged through a PR, and verified in the automatic Production deployment.

## Notes

- Keep `prd.md` focused on requirements, constraints, and acceptance criteria.
- Lightweight tasks can remain PRD-only.
- For complex tasks, add `design.md` for technical design and `implement.md` for execution planning before `task.py start`.
