# Implement P8 analytics opt-out and AdSense slots

## Goal

Complete GitHub Issues #106 and #107 with the Owner-selected default-on visitor
policy, persistent visitor opt-out controls, and Production-only named AdSense
slots.

## Owner decisions

- Analytics coverage: all eight currently supported providers (GA4, Umami,
  Plausible, Clarity, Fathom, Simple Analytics, Matomo, and Amplitude).
- Visitor policy: load enabled Analytics and Ads by default; let visitors turn
  either category off in Privacy Settings. Remember opt-outs across visits until
  visitors turn the category back on.
- Ads provider: AdSense named/manual slots only. Ads remain disabled by default
  in Site configuration and run only in Vercel Production. Local and Preview
  builds make no ad-network requests, including Google Search AdSense mode.

## Requirements

- Keep the existing Site owner Analytics master switch disabled by default.
- Add independent, persistent visitor controls for Analytics and Ads; do not
  load configured third-party providers after the corresponding visitor opt-out.
- Keep the settings control accessible on every route and usable after Astro
  client navigation.
- Load only the existing configured Analytics providers. Preserve one initial
  page view per provider and avoid duplicate provider-managed SPA page views.
- Add AdSense publisher and named slot configuration to the Site profile. A
  missing, invalid, or disabled ad configuration must render safely and make no
  ad-network request.
- Reserve the configured slot height, preserve existing static sponsor content
  and ads.txt handling, and initialize new slots once after Astro navigation.
- Suppress AdSense display and search ads outside Vercel Production. Do not add
  production credentials, mutate deployment settings, or deploy.
- Synchronize the config, bilingual profile comments, CSP output, user docs,
  locale strings, tests, and generated Vercel configuration.

## Acceptance criteria

- [ ] Default Analytics and Ads configuration makes zero third-party requests.
- [ ] With the relevant Site feature enabled in Production, each category loads
      by default and its visitor opt-out prevents requests on subsequent loads.
- [ ] Visitor choices persist across refresh, direct navigation, Astro client
      navigation, back/forward, and browser restart; settings can restore them.
- [ ] All eight Analytics providers have an evidence-backed initialization and
      SPA page-view/CSP matrix; route changes do not create duplicate events.
- [ ] AdSense renders only configured named slots in Production, reserves space,
      and initializes each slot once. Local, Preview, missing-config, and
      visitor-opted-out fixtures make no ad-network requests.
- [ ] Google Search AdSense mode is suppressed locally, in Preview, and after
      the visitor opts out of Ads; ordinary configured search remains usable.
- [ ] Focused browser/network tests, Site type checks, Astro checks, build, QA,
      generated Vercel config parity, release checks, Edge checks, and diff
      checks pass.

## Constraints

- The Site owner master switches remain off by default. Visitor default-on
  applies only after an owner enables a feature and configures its provider.
- Do not add providers, secrets, new deployment platforms, or a new consent
  framework dependency.
- Do not change Production configuration or claim live provider-account
  verification; use intercepted browser fixtures.
- Google Analytics history-based page views are controlled partly in the GA4
  property. Document the required setting when using KIRARI's manual SPA page
  view integration; do not claim the account setting was changed or verified.
