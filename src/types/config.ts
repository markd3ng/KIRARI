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
		layout: "floating" | "sidebar";
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
	Projects: 4,
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
	avatarRounded?: boolean;
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

export type CommentsConfig = {
	provider: "none" | "giscus" | "waline" | "twikoo";
	giscus: {
		repo: string;
		repoId: string;
		category: string;
		categoryId: string;
		mapping: string;
		lang: string;
	};
	waline: {
		serverUrl: string;
		lang: string;
	};
	twikoo: {
		envId: string;
		lang: string;
	};
};

export type SidebarWidgetType =
	| "profile"
	| "toc"
	| "categories"
	| "tags"
	| "announcement"
	| "advertisement"
	| "siteStats"
	| "siteInfo"
	| "calendar";

export type SidebarWidgetPosition = "top" | "sticky";

export type SidebarWidgetConfig = {
	type: SidebarWidgetType;
	enabled: boolean;
	position: SidebarWidgetPosition;
	showTitle?: boolean;
	showOnPostPage?: boolean;
	showOnNonPostPage?: boolean;
};

export type SidebarConfig = {
	enabled: boolean;
	position: "left";
	leftWidgets: SidebarWidgetConfig[];
	rightWidgets: SidebarWidgetConfig[];
	mobileWidgets: SidebarWidgetConfig[];
};

export type WidgetsConfig = {
	announcement: {
		enabled: boolean;
		id: string;
		title: string;
		content: string;
		linkText: string;
		linkUrl: string;
		closable: boolean;
	};
	advertisement: {
		enabled: boolean;
		id: string;
		title: string;
		content: string;
		imageSrc: string;
		imageAlt: string;
		linkText: string;
		linkUrl: string;
		expireDate: string;
		displayCount: number;
		closable: boolean;
	};
	siteStats: {
		enabled: boolean;
		siteStartDate: string;
	};
	siteInfo: {
		enabled: boolean;
	};
	calendar: {
		enabled: boolean;
		showHeatmap: boolean;
	};
};

export type HeadConfig = {
	verification: {
		google: string;
		bing: string;
		yandex: string;
		naver: string;
	};
	customHtml: string;
	customHtmlFile: string;
	customScript: string;
	customScriptFile: string;
};

export type FooterConfig = {
	customHtml: string;
	customHtmlFile: string;
	customScript: string;
	customScriptFile: string;
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
	slug?: string;
	routeSlug?: string;
	tags: string[];
	draft?: boolean;
	image?: string;
	og?: string;
	category?: string;
	prevTitle?: string;
	prevSlug?: string;
	nextTitle?: string;
	nextSlug?: string;
	comments?: boolean;
};

export type PostsConfig = {
	/** How post URLs are generated when frontmatter slug is empty */
	slugStrategy: "file" | "crc32";
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
	google: {
		/** Enable Google Indexing API notifications. Advanced and off by default. */
		indexingApi: boolean;
		/** Environment variable name that stores the service account JSON. */
		serviceAccountJsonEnv: string;
	};
};

export type SearchProvider = "pagefind" | "docsearch" | "google";

export type SearchConfig = {
	/** Active search provider. Pagefind remains the default local search. */
	provider: SearchProvider;
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
	google: {
		/** Google Programmable Search Engine ID. Public ID, not a secret. */
		cx: string;
		/** Use the official Google-rendered result element to preserve AdSense ads. */
		adsense: boolean;
		/** Google webSearchResultSetSize attribute. */
		resultSetSize: string;
		/** Google webSearchSafesearch attribute. */
		safeSearch: "active" | "off";
	};
};

export type GithubCardConfig = {
	/** GitHub REST API base for markdown GitHub cards. Use "/ghc" when a runtime adapter is enabled. */
	apiBase: string;
	/** Optional runtime adapter for same-origin GitHub card proxy routes. Disabled by default. */
	adapter: {
		enabled: boolean;
		provider: "none" | "cloudflare" | "vercel" | "auto";
		route: string;
		serviceBinding: string;
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
		/** Optional Subresource Integrity hash for a pinned/self-hosted Umami script */
		integrity?: string;
	};
	/** Plausible analytics configuration */
	plausible?: {
		/** Domain to track */
		domain: string;
		/** Plausible script URL (default: https://plausible.io/js/script.js) */
		src?: string;
		/** Optional Subresource Integrity hash for a pinned/self-hosted Plausible script */
		integrity?: string;
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
		/** Optional Subresource Integrity hash for a pinned/self-hosted Matomo script */
		integrity?: string;
	};
	/** Amplitude analytics API key */
	amplitudeApiKey?: string;
};

export type LandingPageConfig = {
	/** Show the PRD-style landing page on home routes instead of the classic post list. */
	enable: boolean;
	/** Number of recent posts to show in the Latest Articles section. */
	latestCount: number;
	/** Hero illustration/image path. Relative to src, or public when it starts with /. */
	heroImage: string;
	eyebrow: string;
	title: string;
	highlight: string;
	description: string;
	primaryCtaLabel: string;
	secondaryCtaLabel: string;
	features: LandingPageFeaturesConfig;
};

export type LandingPageFeatureItem = {
	icon: string;
	title: string;
	description: string;
};

export type LandingPageFeaturesConfig = {
	enable: boolean;
	items: LandingPageFeatureItem[];
};

export type Config = {
	site: SiteConfig;
	posts: PostsConfig;
	navBar: NavBarConfig;
	profile: ProfileConfig;
	license: LicenseConfig;
	expressiveCode: ExpressiveCodeConfig;
	mermaid: MermaidConfig;
	comments: CommentsConfig;
	sidebar: SidebarConfig;
	widgets: WidgetsConfig;
	head: HeadConfig;
	footer: FooterConfig;
	analytics: AnalyticsConfig;
	llms: LLMsConfig;
	i18n: I18nConfig;
	og: OGConfig;
	seo: SeoConfig;
	search: SearchConfig;
	githubCard: GithubCardConfig;
	landingPage: LandingPageConfig;
};
