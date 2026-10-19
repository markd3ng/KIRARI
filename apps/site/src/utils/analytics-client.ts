import type { AnalyticsConfig } from "../types/config";
import { readPrivacySettings } from "./privacy-settings.mjs";
import { transitionManager } from "./transition-manager";

type QueueFunction = ((...args: unknown[]) => void) & { q?: unknown[][] };
type AmplitudeInstance = { init: (key: string, userId?: undefined, options?: { autocapture: false }) => unknown; track: (name: string, properties?: Record<string, string>) => unknown };

type AnalyticsWindow = Window & {
	dataLayer?: unknown[][];
	gtag?: QueueFunction;
	clarity?: QueueFunction;
	_paq?: unknown[][];
	amplitude?: AmplitudeInstance;
};

let initialized = false;
let lastPageUrl = "";
let lastAmplitudePageUrl = "";

export function initializeAnalytics(): void {
	if (initialized) return;
	initialized = true;
	const node = document.getElementById("kirari-analytics-config");
	const rawConfig = node?.dataset.config;
	if (!rawConfig) return;

	let config: AnalyticsConfig;
	try {
		config = JSON.parse(rawConfig) as AnalyticsConfig;
	} catch {
		return;
	}
	if (!config.enable || !readPrivacySettings().analytics) return;

	initializeGoogleAnalytics(config.googleAnalyticsId);
	initializeUmami(config.umami);
	initializePlausible(config.plausible);
	initializeClarity(config.clarityProjectId);
	initializeFathom(config.fathomSiteId);
	initializeSimpleAnalytics(config.simpleAnalyticsDomain);
	initializeMatomo(config.matomo);
	initializeAmplitude(config.amplitudeApiKey);

	trackPageView();
	transitionManager.on("transition:after-swap", trackPageView);
}

function initializeGoogleAnalytics(id?: string): void {
	if (!id) return;
	const target = window as AnalyticsWindow;
	target.dataLayer = target.dataLayer || [];
	target.gtag = target.gtag || function (...args) { target.dataLayer?.push(args); };
	target.gtag("js", new Date());
	target.gtag("config", id, { send_page_view: false });
	loadScript(`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`);
}

function initializeUmami(config?: AnalyticsConfig["umami"]): void {
	if (!config?.id) return;
	loadScript(config.src || "https://analytics.umami.is/script.js", {
		"data-website-id": config.id,
		"data-auto-track": "true",
	}, config.integrity);
}

function initializePlausible(config?: AnalyticsConfig["plausible"]): void {
	if (!config?.domain) return;
	loadScript(config.src || "https://plausible.io/js/script.js", {
		"data-domain": config.domain,
	}, config.integrity);
}

function initializeClarity(projectId?: string): void {
	if (!projectId) return;
	const target = window as AnalyticsWindow;
	const clarity = target.clarity || Object.assign((...args: unknown[]) => {
		clarity.q?.push(args);
	}, { q: [] as unknown[][] });
	target.clarity = clarity;
	clarity("consentv2", { ad_Storage: "granted", analytics_Storage: "granted" });
	loadScript(`https://www.clarity.ms/tag/${encodeURIComponent(projectId)}`);
}

function initializeFathom(siteId?: string): void {
	if (!siteId) return;
	loadScript("https://cdn.usefathom.com/script.js", { "data-site": siteId, "data-spa": "auto" });
}

function initializeSimpleAnalytics(domain?: string): void {
	if (!domain) return;
	loadScript(`https://${domain}/latest.js`);
}

function initializeMatomo(config?: AnalyticsConfig["matomo"]): void {
	if (!config?.siteId || !config.src) return;
	const target = window as AnalyticsWindow;
	const queue = target._paq = target._paq || [];
	const base = config.src.endsWith("/") ? config.src : config.src.replace(/\/?matomo\.js$/, "/");
	queue.push(["setTrackerUrl", `${base}matomo.php`]);
	queue.push(["setSiteId", config.siteId]);
	queue.push(["enableLinkTracking"]);
	loadScript(config.src, {}, config.integrity);
}

function initializeAmplitude(apiKey?: string): void {
	if (!apiKey) return;
	const script = loadScript("https://cdn.amplitude.com/libs/analytics-browser-2.11.1-min.js.gz");
	if (!script) return;
	script.addEventListener("load", () => {
		const amplitude = (window as AnalyticsWindow).amplitude;
		if (!amplitude) return;
		amplitude.init(apiKey, undefined, { autocapture: false });
		trackAmplitudePageView();
	}, { once: true });
}

function trackPageView(): void {
	if (!readPrivacySettings().analytics) return;
	const url = window.location.href;
	if (url === lastPageUrl) return;
	lastPageUrl = url;
	const target = window as AnalyticsWindow;
	target.gtag?.("event", "page_view", {
		page_location: url,
		page_path: `${window.location.pathname}${window.location.search}`,
		page_title: document.title,
	});
	target._paq?.push(["setCustomUrl", url]);
	target._paq?.push(["setDocumentTitle", document.title]);
	target._paq?.push(["trackPageView"]);
	trackAmplitudePageView();
}

function trackAmplitudePageView(): void {
	const url = window.location.href;
	const amplitude = (window as AnalyticsWindow).amplitude;
	if (!amplitude || url === lastAmplitudePageUrl) return;
	lastAmplitudePageUrl = url;
	amplitude.track("Page Viewed", {
		url,
		path: window.location.pathname,
		title: document.title,
	});
}

function loadScript(src: string, attributes: Record<string, string> = {}, integrity?: string): HTMLScriptElement | null {
	let safeUrl: URL;
	try {
		safeUrl = new URL(src, window.location.href);
	} catch {
		return null;
	}
	if (safeUrl.origin !== window.location.origin && safeUrl.protocol !== "https:") return null;
	if (safeUrl.username || safeUrl.password) return null;
	const existing = Array.from(document.querySelectorAll<HTMLScriptElement>("script[data-kirari-analytics-src]"))
		.find((script) => script.dataset.kirariAnalyticsSrc === safeUrl.href);
	if (existing) return existing;
	const script = document.createElement("script");
	script.async = true;
	script.dataset.kirariAnalyticsSrc = safeUrl.href;
	script.src = safeUrl.href;
	script.referrerPolicy = "strict-origin-when-cross-origin";
	for (const [name, value] of Object.entries(attributes)) script.setAttribute(name, value);
	if (integrity) {
		script.integrity = integrity;
		script.crossOrigin = "anonymous";
	}
	document.head.appendChild(script);
	return script;
}
