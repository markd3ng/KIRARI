import { parse } from "smol-toml";
import { getEnvBoolean, getEnvString, getEnvStringFromKeys } from "./env";

export type EnvConfig = {
	siteUrl: string;
	siteTitle: string;
	siteSubtitle: string;
	bannerCreditEnable: boolean;
	bannerCreditText: string;
	bannerCreditUrl: string;
	analyticsEnable: boolean;
	googleAnalyticsId: string;
	umamiId: string;
	umamiSrc: string;
	plausibleDomain: string;
	plausibleSrc: string;
	clarityProjectId: string;
	fathomSiteId: string;
	simpleAnalyticsDomain: string;
	matomoSiteId: string;
	matomoSrc: string;
	amplitudeApiKey: string;
	indexNowEnable: boolean;
	indexNowKey: string;
};

/**
 * TOML configuration type definition
 * TOML 配置类型定义
 * 
 * All fields are typed as `unknown` to allow runtime validation
 * 所有字段都使用 `unknown` 类型以支持运行时验证
 */
type TomlConfig = {
	site?: {
		url?: unknown;
		title?: unknown;
		subtitle?: unknown;
		base?: unknown;
		lang?: unknown;
		themeColor?: {
			hue?: unknown;
			fixed?: unknown;
		};
		banner?: {
			enable?: unknown;
			src?: unknown;
			position?: unknown;
			credit?: {
				enable?: unknown;
				text?: unknown;
				url?: unknown;
			};
		};
		toc?: {
			enable?: unknown;
			depth?: unknown;
		};
		favicon?: unknown; // Array type, will be validated at runtime
	};
	navBar?: {
		links?: unknown; // Array type, will be validated at runtime
	};
	profile?: {
		avatar?: unknown;
		name?: unknown;
		bio?: unknown;
		links?: unknown; // Array type, will be validated at runtime
	};
	license?: {
		enable?: unknown;
		name?: unknown;
		url?: unknown;
	};
	expressiveCode?: {
		themes?: unknown; // Array type, will be validated at runtime
	};
	mermaid?: {
		enable?: unknown;
	};
	head?: {
		verification?: {
			google?: unknown;
			bing?: unknown;
			yandex?: unknown;
			naver?: unknown;
		};
		customHtml?: unknown;
		customScript?: unknown;
	};
	footer?: {
		customHtml?: unknown;
		customScript?: unknown;
	};
	analytics?: {
		enable?: unknown;
		googleAnalyticsId?: unknown;
		clarityProjectId?: unknown;
		fathomSiteId?: unknown;
		simpleAnalyticsDomain?: unknown;
		amplitudeApiKey?: unknown;
		umami?: {
			id?: unknown;
			src?: unknown;
		};
		plausible?: {
			domain?: unknown;
			src?: unknown;
		};
		matomo?: {
			siteId?: unknown;
			src?: unknown;
		};
	};
	llms?: {
		enable?: unknown;
		sitemap?: unknown;
		title?: unknown;
		description?: unknown;
		i18n?: unknown;
	};
	og?: {
		defaultImage?: unknown;
	};
	seo?: {
		indexNow?: unknown;
		indexNowKey?: unknown;
	};
};

const DEFAULT_ENV_CONFIG: EnvConfig = {
	siteUrl: "https://kirari-main.vercel.app",
	siteTitle: "KIRARI",
	siteSubtitle: "Demo Site",
	bannerCreditEnable: false,
	bannerCreditText: "",
	bannerCreditUrl: "",
	analyticsEnable: false,
	googleAnalyticsId: "",
	umamiId: "",
	umamiSrc: "",
	plausibleDomain: "",
	plausibleSrc: "",
	clarityProjectId: "",
	fathomSiteId: "",
	simpleAnalyticsDomain: "",
	matomoSiteId: "",
	matomoSrc: "",
	amplitudeApiKey: "",
	indexNowEnable: false,
	indexNowKey: "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6",
};

const tomlModules = import.meta.glob("../../kirari.config.toml", {
	eager: true,
	query: "?raw",
	import: "default",
}) as Record<string, string>;

const getString = (value: unknown, fallback: string): string => {
	return typeof value === "string" ? value : fallback;
};

const getBoolean = (value: unknown, fallback: boolean): boolean => {
	return typeof value === "boolean" ? value : fallback;
};

const loadTomlConfig = (): TomlConfig => {
	const raw = Object.values(tomlModules)[0];
	if (!raw) return {};

	try {
		const parsed = parse(raw);
		return typeof parsed === "object" && parsed !== null
			? (parsed as TomlConfig)
			: {};
	} catch (error) {
		console.warn("[config-loader] Failed to parse kirari.config.toml, fallback to defaults.", error);
		return {};
	}
};


export const loadEnvConfig = (): EnvConfig => {
	const toml = loadTomlConfig();
	const site = toml.site;
	const analytics = toml.analytics;
	const seo = toml.seo;

	return {
		siteUrl: getEnvString(
			"PUBLIC_SITE_URL",
			getString(site?.url, DEFAULT_ENV_CONFIG.siteUrl),
		),
		siteTitle: getEnvString(
			"PUBLIC_SITE_TITLE",
			getString(site?.title, DEFAULT_ENV_CONFIG.siteTitle),
		),
		siteSubtitle: getEnvString(
			"PUBLIC_SITE_SUBTITLE",
			getString(site?.subtitle, DEFAULT_ENV_CONFIG.siteSubtitle),
		),
		bannerCreditEnable: getEnvBoolean(
			"PUBLIC_BANNER_CREDIT_ENABLE",
			getBoolean(
				site?.banner?.credit?.enable,
				DEFAULT_ENV_CONFIG.bannerCreditEnable,
			),
		),
		bannerCreditText: getEnvString(
			"PUBLIC_BANNER_CREDIT_TEXT",
			getString(site?.banner?.credit?.text, DEFAULT_ENV_CONFIG.bannerCreditText),
		),
		bannerCreditUrl: getEnvString(
			"PUBLIC_BANNER_CREDIT_URL",
			getString(site?.banner?.credit?.url, DEFAULT_ENV_CONFIG.bannerCreditUrl),
		),
		analyticsEnable: getEnvBoolean(
			"PUBLIC_ANALYTICS_ENABLE",
			getBoolean(analytics?.enable, DEFAULT_ENV_CONFIG.analyticsEnable),
		),
		googleAnalyticsId: getEnvString(
			"PUBLIC_GOOGLE_ANALYTICS_ID",
			getString(analytics?.googleAnalyticsId, DEFAULT_ENV_CONFIG.googleAnalyticsId),
		),
		umamiId: getEnvString(
			"PUBLIC_UMAMI_ID",
			getString(analytics?.umami?.id, DEFAULT_ENV_CONFIG.umamiId),
		),
		umamiSrc: getEnvString(
			"PUBLIC_UMAMI_SRC",
			getString(analytics?.umami?.src, DEFAULT_ENV_CONFIG.umamiSrc),
		),
		plausibleDomain: getEnvString(
			"PUBLIC_PLAUSIBLE_DOMAIN",
			getString(analytics?.plausible?.domain, DEFAULT_ENV_CONFIG.plausibleDomain),
		),
		plausibleSrc: getEnvString(
			"PUBLIC_PLAUSIBLE_SRC",
			getString(analytics?.plausible?.src, DEFAULT_ENV_CONFIG.plausibleSrc),
		),
		clarityProjectId: getEnvStringFromKeys(
			["PUBLIC_CLARITY_PROJECT_ID", "PUBLIC_CLARITY_ID"],
			getString(analytics?.clarityProjectId, DEFAULT_ENV_CONFIG.clarityProjectId),
		),
		fathomSiteId: getEnvString(
			"PUBLIC_FATHOM_SITE_ID",
			getString(analytics?.fathomSiteId, DEFAULT_ENV_CONFIG.fathomSiteId),
		),
		simpleAnalyticsDomain: getEnvString(
			"PUBLIC_SIMPLE_ANALYTICS_DOMAIN",
			getString(
				analytics?.simpleAnalyticsDomain,
				DEFAULT_ENV_CONFIG.simpleAnalyticsDomain,
			),
		),
		matomoSiteId: getEnvString(
			"PUBLIC_MATOMO_SITE_ID",
			getString(analytics?.matomo?.siteId, DEFAULT_ENV_CONFIG.matomoSiteId),
		),
		matomoSrc: getEnvString(
			"PUBLIC_MATOMO_SRC",
			getString(analytics?.matomo?.src, DEFAULT_ENV_CONFIG.matomoSrc),
		),
		amplitudeApiKey: getEnvString(
			"PUBLIC_AMPLITUDE_API_KEY",
			getString(analytics?.amplitudeApiKey, DEFAULT_ENV_CONFIG.amplitudeApiKey),
		),
		indexNowEnable: getEnvBoolean(
			"PUBLIC_INDEXNOW_ENABLE",
			getBoolean(seo?.indexNow, DEFAULT_ENV_CONFIG.indexNowEnable),
		),
		indexNowKey: getEnvString(
			"PUBLIC_INDEXNOW_KEY",
			getString(seo?.indexNowKey, DEFAULT_ENV_CONFIG.indexNowKey),
		),
	};
};
