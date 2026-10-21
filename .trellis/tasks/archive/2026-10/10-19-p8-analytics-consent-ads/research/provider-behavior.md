# Provider behavior research

Checked 2026-10-19 against official vendor documentation. These references
guide KIRARI's own single-page route behavior; vendor configuration remains
outside this code change.

| Provider | Official behavior relevant to KIRARI | KIRARI handling |
|---|---|---|
| GA4 | `gtag('config')` sends an initial page view by default. Enhanced Measurement can separately send views on history changes, even when `send_page_view` is false. | Disable initial automatic view, send one KIRARI route view, document disabling account-side history views. |
| Umami | Tracker detects History API changes and tracks SPA views automatically. `data-auto-pageview` can disable automatic views in supported versions. | Keep vendor automatic SPA views; do not send manual views. |
| Plausible | `pushState` SPAs are tracked automatically. | Keep vendor automatic SPA views; do not send manual views. |
| Clarity | Consent V2 supports independent analytics/ad storage states. Clarity initializes its own page/session tracking. | Send current preference state on initialization; do not add a second manual page-view event. |
| Fathom | `data-spa="auto"` tracks pushState/popstate navigation. | Enable auto SPA mode; do not send manual views. |
| Simple Analytics | Script detects SPA navigation by observing History API methods. | Keep vendor automatic SPA views; do not send manual views. |
| Matomo | A manually installed SPA must call `trackPageView` and update URL/title on virtual navigation. | One initial and one per-route `trackPageView` through the shared dispatcher. |
| Amplitude | The current Browser SDK 2.11.1 line enables autocapture by default from 2.10; page-view events can be configured separately. | Turn autocapture off and send only one explicit route event. |

## Primary references

- Google GA4 SPA: <https://developers.google.com/analytics/devguides/collection/ga4/single-page-applications>
- Google GA4 page views: <https://developers.google.com/analytics/devguides/collection/ga4/views>
- Umami SPA: <https://docs.umami.is/docs/guides/track-single-page-apps>
- Umami tracker configuration: <https://docs.umami.is/docs/tracker-configuration>
- Plausible SPA: <https://plausible.io/docs/spa-support>
- Clarity Consent V2: <https://learn.microsoft.com/en-us/clarity/setup-and-installation/clarity-consent-api-v2>
- Fathom SPA: <https://usefathom.com/docs/integrations/spas>
- Simple Analytics custom page views: <https://docs.simpleanalytics.com/trigger-custom-page-views>
- Matomo SPA tracking: <https://developer.matomo.org/guides/spa-tracking>
- Amplitude Browser SDK migration: <https://amplitude.com/docs/sdks/analytics/browser/migrate-from-browser-sdk-1-0-to-2-0>
- AdSense responsive ad code: <https://support.google.com/adsense/answer/9183460>
