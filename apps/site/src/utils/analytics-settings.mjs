// Shared by the rendered analytics settings and both static CSP outputs.
export const UMAMI_SCRIPT = "https://analytics.umami.is/script.js";
export const PLAUSIBLE_SCRIPT = "https://plausible.io/js/script.js";

export function resolveAnalyticsSettings(raw = {}, readString = envString, readBoolean = envBoolean) {
	const text = (value) => typeof value === "string" ? value : "";
	const field = (key, value) => readString(key, text(value));
	const umamiId = readString("PUBLIC_UMAMI_ID", "");
	const plausibleDomain = readString("PUBLIC_PLAUSIBLE_DOMAIN", "");
	const matomoId = readString("PUBLIC_MATOMO_SITE_ID", "");
	const matomoSrc = readString("PUBLIC_MATOMO_SRC", "");
	return {
		enable: readBoolean("PUBLIC_ANALYTICS_ENABLE", raw.enable === true),
		googleAnalyticsId: field("PUBLIC_GOOGLE_ANALYTICS_ID", raw.googleAnalyticsId),
		clarityProjectId: readString("PUBLIC_CLARITY_PROJECT_ID", readString("PUBLIC_CLARITY_ID", text(raw.clarityProjectId))),
		fathomSiteId: field("PUBLIC_FATHOM_SITE_ID", raw.fathomSiteId),
		simpleAnalyticsDomain: field("PUBLIC_SIMPLE_ANALYTICS_DOMAIN", raw.simpleAnalyticsDomain),
		amplitudeApiKey: field("PUBLIC_AMPLITUDE_API_KEY", raw.amplitudeApiKey),
		umami: raw.umami?.id || umamiId ? {
			id: field("PUBLIC_UMAMI_ID", raw.umami?.id),
			src: field("PUBLIC_UMAMI_SRC", raw.umami?.src),
			integrity: field("PUBLIC_UMAMI_INTEGRITY", raw.umami?.integrity),
		} : undefined,
		plausible: raw.plausible?.domain || plausibleDomain ? {
			domain: field("PUBLIC_PLAUSIBLE_DOMAIN", raw.plausible?.domain),
			src: field("PUBLIC_PLAUSIBLE_SRC", raw.plausible?.src),
			integrity: field("PUBLIC_PLAUSIBLE_INTEGRITY", raw.plausible?.integrity),
		} : undefined,
		matomo: (raw.matomo?.siteId && raw.matomo?.src) || (matomoId && matomoSrc) ? {
			siteId: field("PUBLIC_MATOMO_SITE_ID", raw.matomo?.siteId),
			src: field("PUBLIC_MATOMO_SRC", raw.matomo?.src),
			integrity: field("PUBLIC_MATOMO_INTEGRITY", raw.matomo?.integrity),
		} : undefined,
	};
}

function envString(key, fallback = "") {
	const value = process.env[key]?.trim();
	return value || fallback;
}
function envBoolean(key, fallback) {
	const value = envString(key).toLowerCase();
	if (["true", "1", "yes", "on"].includes(value)) return true;
	if (["false", "0", "no", "off"].includes(value)) return false;
	return fallback;
}
