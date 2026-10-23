# Production route-transition reproduction

Date: 2026-10-23. Target: `https://kirari-main.vercel.app/blog/`, production deployment at `12a95a12023eac707cb2e6211e121459cc9df4eb`. Browser viewport: 1512×838 CSS px.

## Explore selection

1. Load `/blog/`, hover Explore, and select Categories in the dropdown.
2. The new `/categories/` page is visible while the outgoing `navbar` view-transition snapshot still contains the open, translucent Explore menu at about 80ms. This visually matches the user's attached screenshot.
3. The menu ghost is gone by about 140ms. Captures: `evidence/production-blog-explore-30ms.png`, `evidence/production-blog-explore-80ms.png`, and `evidence/production-blog-explore-140ms.png`.
4. The dropdown is CSS-only (`:hover` / `:focus-within`); it has no independent transition name. The shared navbar transition fades the complete old navbar snapshot, so the old hovered menu is captured and briefly overlays the next route.

## Blog direct load and progress indicator

A cold direct load of `/blog/` completed with `document.fonts.status=loaded`; the first sampled ready state showed `#top-row` at `(156,0)`, `1200×472.7`, and `#main-grid` at `(156,237.3)`, `1200×2029`. No LayoutShift entries were reported by the browser PerformanceObserver for that direct load. The top progress bar was absent/hidden (`opacity:0`, width 0) on direct load.

On SPA navigation, `#swup-progress-bar` is the intended fixed 3px progress indicator. It advances during the swap and returns to `opacity:0` after completion; it did not remain stuck. The route change produced a small input-associated CLS of 0.004 around the content wrapper/top row; the main grid top remained at 237.3px in the sampled transition frames.

The exact viewport and route-family matrix is recorded below after the fix. Do not interpret the short outgoing-menu snapshot as a persistent layout shift.

## Local verification after the fix

The local production preview was rebuilt from the default Demo Site profile after the external-Site integration test intentionally replaced `dist/` with its POC fixture.

- Desktop: the dropdown now has its own `navbar-explore-menu` transition identity; its old snapshot is hidden. Blog → Explore → Categories at 1512×838 showed no dropdown at the 80ms frame; the progress bar was in its completion fade and reached opacity 0 by 700ms.
- Mobile: the menu panel now has its own `navbar-mobile-menu` identity and the old snapshot is hidden. Selecting a non-hash route link closes the mobile menu and resets `aria-expanded` before navigation. Blog → mobile menu → Categories at 390×844 showed a closed, transparent panel at 80ms and a hidden progress bar by 700ms.
- Keyboard: focusing Explore still opens the dropdown through `:focus-within`.
- Cold direct loads: sampled 20 routes in each viewport. Every route had loaded fonts, no horizontal overflow, no non-input LayoutShift entries, and a hidden top progress bar. The recorded geometries and route data are in `evidence/local-direct-route-matrix.json`.
- Screenshots: `evidence/local-desktop-explore-categories-80ms.png` and `evidence/local-mobile-explore-categories-80ms.png`.

The sample covers representative shared-layout families, not every generated content URL. Production was used to confirm the original ghost before editing; post-fix visual verification is against the local production build and is not a production deployment check.
