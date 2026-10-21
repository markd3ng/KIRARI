# Design

## Boundaries

All runtime behavior remains in `@kirari/site`. Profile TOML is the source of
owner settings; `config-loader.ts` validates it; the Astro layout exposes a
persisted Privacy Settings control; a small client utility owns visitor choices
and provider lifecycle. Static CSP generation consumes the same validated
configuration as rendered markup.

## Visitor settings

Store versioned `{ analytics: boolean, ads: boolean }` opt-outs in the existing
first-party `localStorage` pattern. Missing state means the visitor has not
opted out. Expose independent, accessible Analytics and Ads controls through a
global Privacy Settings dialog. Saving persists the choice and reloads the
current document so already-running vendor scripts are torn down; the next
document load reads preferences before injecting any vendor script. Handle
unavailable or malformed storage without throwing and report save failure to
the visitor.

The owner-level switches remain authoritative: Analytics requires
`analytics.enable` and a configured provider; Ads requires `ads.enable`, a
valid publisher/slot configuration, and `VERCEL_ENV=production`. Visitor opt-out
can only further suppress those requests.

## Analytics lifecycle

Replace static vendor `<script src>` tags with a local bundled bootstrap. It
reads preferences synchronously, injects only configured provider scripts, and
initializes each provider once. Astro `transition:after-swap` is the shared
route signal. Keep automatic SPA tracking for providers whose supported
trackers already handle History API changes (Umami, Plausible, Fathom, and
Simple Analytics); do not add a second manual page view for them. Use one
explicit route event for Matomo and Amplitude. Configure GA4 to suppress its
initial automatic view and send one explicit page view on initial and Astro
route loads; document that GA4 Enhanced Measurement's history-based page view
setting must be disabled to avoid account-side duplicates. Clarity initializes
once and uses its supported consent API state; no KIRARI duplicate page-view
event is emitted.

Initial document load and SPA navigation use one shared de-duplicating route
dispatcher. Keep existing vendor IDs, custom script URLs, SRI values, and CSP
source resolution. Amplitude autocapture remains disabled so KIRARI sends only
the defined page-view event and does not silently capture form/click events.

## AdSense slots

Add a disabled-by-default `[ads]` owner config with a publisher ID and validated
named slots. Each slot has a stable name, AdSense slot ID, and bounded minimum
height used to reserve layout space. Add one explicit article-bottom placement
to each localized and default post route; render nothing when configuration is
missing or Ads are suppressed. Keep the existing static Advertisement widget
and root `ads.txt` source unchanged.

Only a Vercel Production build may add AdSense markup, CSP sources, or runtime
requests. Pass the build environment from Astro server components rather than
exposing platform variables to client code. Google Search AdSense mode is
likewise selected only in Production and when the visitor's Ads setting allows
it; ordinary Google search remains available.

## CSP and failure behavior

The shared CSP builder adds AdSense origins only when Production Ads are
enabled and at least one valid named slot exists. Configured Analytics origins
continue to come from the shared settings resolver. Runtime script failure is
non-fatal to the page; malformed or unavailable local storage does not crash
the layout or prevent non-analytics content from working.

## Verification limits

Browser tests intercept all vendor requests and validate routing, request
counts, CSP, opt-out persistence, slot initialization, and reserved layout.
They prove KIRARI's emitted behavior, not the visitor's live vendor account
settings. GA4 account-side history measurement remains documented as an owner
configuration requirement.
