import type { AUTO_MODE, DARK_MODE, LIGHT_MODE } from "@constants/constants";




export type SiteConfig = {
	url: string;
	base: string;
	title: string;
	subtitle: string;

	lang:
		| "en-US"
		| "zh-CN"
		| "zh-TW"
		| "zh-HK"
		| "ja-JP"
		| "ko-KR"
		| "es-ES"
		| "th-TH"
		| "vi-VN"
		| "tr-TR"
		| "id-ID";

	themeColor: {
		hue: number;
		fixed: boolean;
	};
	banner: {
		enable: boolean;
		src: string;
		position?: "top" | "center" | "bottom";
		credit: {
			enable: boolean;
			text: string;
			url?: string;
		};
	};
	toc: {
		enable: boolean;
		depth: 1 | 2 | 3;
	};

	favicon: Favicon[];
	og?: OGConfig;
};

export type Favicon = {
	src: string;
	theme?: "light" | "dark";
	sizes?: string;
};

export const LinkPreset = {
	Home: 0,
	Archive: 1,
	About: 2,
	Friends: 3,
} as const;

export type LinkPresetType = (typeof LinkPreset)[keyof typeof LinkPreset];

export type NavBarLink = {
	name: string;
	url: string;
	external?: boolean;
};

export type NavBarConfig = {
	links: (NavBarLink | LinkPresetType)[];
};

export type ProfileConfig = {
	avatar?: string;
	name: string;
	bio?: string;
	links: {
		name: string;
		url: string;
		icon: string;
	}[];
};

export type LicenseConfig = {
	enable: boolean;
	name: string;
	url: string;
};

export type MermaidConfig = {
	enable: boolean;
};

export type HeadConfig = {
	verification: {
		google: string;
		bing: string;
		yandex: string;
		naver: string;
	};
	customHtml: string;
	customScript: string;
};

export type FooterConfig = {
	customHtml: string;
	customScript: string;
};

export type LIGHT_DARK_MODE =
	| typeof LIGHT_MODE
	| typeof DARK_MODE
	| typeof AUTO_MODE;

export type BlogPostData = {
	body: string;
	title: string;
	published: Date;
	description: string;
	tags: string[];
	draft?: boolean;
	image?: string;
	og?: string;
	category?: string;
	prevTitle?: string;
	prevSlug?: string;
	nextTitle?: string;
	nextSlug?: string;
};

export type ExpressiveCodeConfig = {
	// theme: string;
	themes: string[];
};

export type LLMsConfig = {
	enable: boolean;
	sitemap?: boolean;
	title?: string;
	description?: string;
	includePatterns?: string[];
	excludePatterns?: string[];
	customSeparator?: string;
	i18n?: boolean;
};

export type I18nConfig = {
	enable: boolean;
	defaultLang: SiteConfig["lang"];
	defaultLangInSubdir: boolean;
	disableDefaultLanguageRedirect: boolean;
	languages: SiteConfig["lang"][];
	languageMap: Record<SiteConfig["lang"], I18nLanguageConfig>;
	fallbackToDefault: boolean;
};

export type I18nLanguageConfig = {
	code: SiteConfig["lang"];
	label: string;
	locale: string;
	direction: "ltr" | "rtl" | "auto";
	weight: number;
	disabled: boolean;
	contentDir: string;
};

export type OGConfig = {
	/** Default OG image for all pages and post fallback, e.g. /og/default.png */
	defaultImage: string;
};

export type SeoConfig = {
	/** Enable IndexNow integration for instant search engine indexing. Default: false */
	indexNow?: boolean;
	/** IndexNow API key. Required when indexNow is enabled */
	indexNowKey?: string;
};

export type SearchConfig = {
	docsearch: {
		/** Enable Algolia DocSearch. When true, Pagefind is not loaded or indexed. */
		enable: boolean;
		/** Algolia application ID. */
		appId: string;
		/** Algolia search-only API key. */
		apiKey: string;
		/** Algolia index name. */
		indexName: string;
		/** Apply docsearch:language as a language facet filter. */
		filterByLanguage: boolean;
		/** Extra docsearch:* meta tags, such as version = "latest". */
		metaTags: Record<string, string>;
	};
};

export type AnalyticsConfig = {
	/** Master switch to enable/disable all analytics. Default: false */
	enable?: boolean;
	/** Google Analytics measurement ID (e.g., G-XXXXXXXXXX) */
	googleAnalyticsId?: string;
	/** Umami analytics configuration */
	umami?: {
		/** Umami website ID */
		id: string;
		/** Umami script URL (default: https://analytics.umami.is/script.js) */
		src?: string;
	};
	/** Plausible analytics configuration */
	plausible?: {
		/** Domain to track */
		domain: string;
		/** Plausible script URL (default: https://plausible.io/js/script.js) */
		src?: string;
	};
	/** Microsoft Clarity project ID */
	clarityProjectId?: string;
	/** Fathom analytics site ID */
	fathomSiteId?: string;
	/** Simple Analytics domain */
	simpleAnalyticsDomain?: string;
	/** Matomo analytics configuration */
	matomo?: {
		/** Matomo site ID */
		siteId: string;
		/** Matomo tracker URL */
		src: string;
	};
	/** Amplitude analytics API key */
	amplitudeApiKey?: string;
};

export type Config = {
	site: SiteConfig;
	navBar: NavBarConfig;
	profile: ProfileConfig;
	license: LicenseConfig;
	expressiveCode: ExpressiveCodeConfig;
	mermaid: MermaidConfig;
	head: HeadConfig;
	footer: FooterConfig;
	analytics: AnalyticsConfig;
	llms: LLMsConfig;
	i18n: I18nConfig;
	og: OGConfig;
	seo: SeoConfig;
	search: SearchConfig;
};
