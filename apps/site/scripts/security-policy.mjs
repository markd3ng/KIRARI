const BASE_SCRIPT_SOURCES = [
	"'self'",
	"'unsafe-inline'",
	"'unsafe-eval'",
	"https://www.googletagmanager.com",
	"https://www.google-analytics.com",
	"https://analytics.umami.is",
	"https://plausible.io",
	"https://www.clarity.ms",
	"https://scripts.simpleanalyticscdn.com",
	"https://www.google.com",
	"https://cse.google.com",
	"https://www.gstatic.com",
];

const BASE_CONNECT_SOURCES = [
	"'self'",
	"https://api.github.com",
	"https://github.com",
	"https://www.google-analytics.com",
	"https://analytics.google.com",
	"https://region1.google-analytics.com",
	"https://*.clarity.ms",
	"https://*.algolia.net",
	"https://*.algolianet.com",
	"https://api.indexnow.org",
	"https://indexing.googleapis.com",
];

export const SECURITY_HEADERS = [
	["X-Frame-Options", "DENY"],
	["X-Content-Type-Options", "nosniff"],
	["Referrer-Policy", "strict-origin-when-cross-origin"],
	[
		"Permissions-Policy",
		"camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
	],
];

export function buildContentSecurityPolicy(config = {}) {
	const scriptSources = new Set(BASE_SCRIPT_SOURCES);
	const styleSources = new Set([
		"'self'",
		"'unsafe-inline'",
		"https://fonts.googleapis.com",
		"https://www.google.com",
		"https://www.gstatic.com",
	]);
	const fontSources = new Set(["'self'", "data:", "https://fonts.gstatic.com"]);
	const connectSources = new Set(BASE_CONNECT_SOURCES);
	const frameSources = new Set(["https://www.google.com", "https://cse.google.com"]);

	const comments = asRecord(config.comments);
	const commentsProvider = stringValue(comments.provider);
	if (commentsProvider === "giscus") {
		scriptSources.add("https://giscus.app");
		connectSources.add("https://giscus.app");
		frameSources.add("https://giscus.app");
	}
	if (commentsProvider === "waline") {
		scriptSources.add("https://unpkg.com");
		addOrigin(connectSources, asRecord(comments.waline).serverUrl);
	}
	if (commentsProvider === "twikoo") {
		scriptSources.add("https://cdn.jsdelivr.net");
		addOrigin(connectSources, asRecord(comments.twikoo).envId);
	}

	const bangumi = asRecord(config.bangumi);
	if (bangumi.enabled === true) addOrigin(connectSources, bangumi.apiBase);

	const edge = asRecord(config.edge);
	if (edge.enabled === true) addOrigin(connectSources, edge.apiBase);

	const analytics = asRecord(config.analytics);
	if (analytics.enable === true) {
		for (const section of ["umami", "plausible", "matomo"]) {
			const source = asRecord(analytics[section]).src;
			addOrigin(scriptSources, source);
			addOrigin(connectSources, source);
		}
	}

	const fonts = asRecord(config.fonts);
	if (fonts.enabled === true && Array.isArray(fonts.links)) {
		for (const link of fonts.links) {
			addOrigin(styleSources, link);
			addOrigin(fontSources, link);
		}
	}

	return [
		"default-src 'self'",
		`script-src ${Array.from(scriptSources).join(" ")}`,
		`style-src ${Array.from(styleSources).join(" ")}`,
		"img-src 'self' data: blob: https:",
		`font-src ${Array.from(fontSources).join(" ")}`,
		`connect-src ${Array.from(connectSources).join(" ")}`,
		`frame-src ${Array.from(frameSources).join(" ")}`,
		"object-src 'none'",
		"base-uri 'self'",
		"form-action 'self'",
		"frame-ancestors 'none'",
		"upgrade-insecure-requests",
	].join("; ");
}

export function createVercelConfig(config) {
	const securityHeaders = [
		{ key: "Content-Security-Policy", value: buildContentSecurityPolicy(config) },
		...SECURITY_HEADERS.map(([key, value]) => ({ key, value })),
	];

	return {
		buildCommand: "pnpm build",
		outputDirectory: "apps/site/dist",
		framework: "astro",
		rewrites: [
			{ source: "/search", destination: "/search/" },
			{ source: "/:lang/search", destination: "/:lang/search/" },
		],
		headers: [
			{
				source: "/_astro/(.*)",
				headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
			},
			{
				source: "/pagefind/(.*)",
				headers: [{ key: "Cache-Control", value: "public, max-age=0, must-revalidate" }],
			},
			{
				source: "/favicon/(.*)",
				headers: [{ key: "Cache-Control", value: "public, max-age=86400" }],
			},
			{
				source: "/llms-full.txt",
				headers: [{ key: "Cache-Control", value: "no-store" }],
			},
			{ source: "/(.*)", headers: securityHeaders },
		],
	};
}

function asRecord(value) {
	return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function stringValue(value) {
	return typeof value === "string" ? value : "";
}

function addOrigin(target, value) {
	const raw = stringValue(value);
	if (!raw) return;
	try {
		const url = new URL(raw);
		if (url.protocol === "https:" || url.protocol === "http:") target.add(url.origin);
	} catch {
		// Non-URL provider identifiers do not add a CSP origin.
	}
}
