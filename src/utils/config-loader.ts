import { parse } from "smol-toml";
import { getEnvBoolean, getEnvString, getEnvStringFromKeys } from "./env";
import { LinkPreset, type Config } from "../types/config";

/**
 * Legacy EnvConfig type for backward compatibility
 * 旧版 EnvConfig 类型，用于向后兼容
 * 
 * @deprecated Use Config type instead. Will be removed in future version.
 */
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
 * 
 * This type mirrors the structure of kirari.config.toml
 * 此类型镜像 kirari.config.toml 的结构
 */
type TomlConfig = {
	/** Site configuration / 站点配置 */
	site?: {
		/** Site URL (e.g., "https://example.com") / 站点 URL */
		url?: unknown;
		/** Site title / 站点标题 */
		title?: unknown;
		/** Site subtitle / 站点副标题 */
		subtitle?: unknown;
		/** Base path (e.g., "/" or "/blog") / 基础路径 */
		base?: unknown;
		/** Language code (e.g., "en", "zh_CN") / 语言代码 */
		lang?: unknown;
		/** Theme color configuration / 主题颜色配置 */
		themeColor?: {
			/** Hue value (0-360) / 色相值 */
			hue?: unknown;
			/** Fixed theme color (hide picker) / 固定主题色（隐藏选择器） */
			fixed?: unknown;
		};
		/** Banner configuration / 横幅配置 */
		banner?: {
			/** Enable banner / 启用横幅 */
			enable?: unknown;
			/** Banner image source path / 横幅图片路径 */
			src?: unknown;
			/** Banner position ("top", "center", "bottom") / 横幅位置 */
			position?: unknown;
			/** Banner credit configuration / 横幅版权信息配置 */
			credit?: {
				/** Enable credit display / 启用版权显示 */
				enable?: unknown;
				/** Credit text / 版权文字 */
				text?: unknown;
				/** Credit link URL / 版权链接 URL */
				url?: unknown;
			};
		};
		/** Table of contents configuration / 目录配置 */
		toc?: {
			/** Enable TOC / 启用目录 */
			enable?: unknown;
			/** TOC depth (1-3) / 目录深度 */
			depth?: unknown;
		};
		/** Favicon array / 图标数组 */
		favicon?: unknown; // Array type, will be validated at runtime
	};
	/** Navigation bar configuration / 导航栏配置 */
	navBar?: {
		/** Navigation links (presets or custom) / 导航链接（预设或自定义） */
		links?: unknown; // Array type, will be validated at runtime
	};
	/** Profile configuration / 个人资料配置 */
	profile?: {
		/** Avatar image path / 头像路径 */
		avatar?: unknown;
		/** Profile name / 名称 */
		name?: unknown;
		/** Profile bio / 简介 */
		bio?: unknown;
		/** Profile links / 个人链接 */
		links?: unknown; // Array type, will be validated at runtime
	};
	/** License configuration / 许可证配置 */
	license?: {
		/** Enable license display / 启用许可证显示 */
		enable?: unknown;
		/** License name / 许可证名称 */
		name?: unknown;
		/** License URL / 许可证链接 */
		url?: unknown;
	};
	/** ExpressiveCode configuration / ExpressiveCode 配置 */
	expressiveCode?: {
		/** Code themes array / 代码主题数组 */
		themes?: unknown; // Array type, will be validated at runtime
	};
	/** Mermaid configuration / Mermaid 配置 */
	mermaid?: {
		/** Enable Mermaid diagrams / 启用 Mermaid 图表 */
		enable?: unknown;
	};
	/** Head configuration / 头部配置 */
	head?: {
		/** Search engine verification codes / 搜索引擎验证码 */
		verification?: {
			/** Google Search Console / Google 搜索控制台 */
			google?: unknown;
			/** Bing Webmaster Tools / Bing 网站管理员工具 */
			bing?: unknown;
			/** Yandex Webmaster / Yandex 网站管理员 */
			yandex?: unknown;
			/** Naver Search Advisor / Naver 搜索顾问 */
			naver?: unknown;
		};
		/** Custom HTML in <head> / 头部自定义 HTML */
		customHtml?: unknown;
		/** Custom JavaScript in <head> / 头部自定义 JavaScript */
		customScript?: unknown;
	};
	/** Footer configuration / 页脚配置 */
	footer?: {
		/** Custom HTML in footer / 页脚自定义 HTML */
		customHtml?: unknown;
		/** Custom JavaScript in footer / 页脚自定义 JavaScript */
		customScript?: unknown;
	};
	/** Analytics configuration / 分析配置 */
	analytics?: {
		/** Enable analytics / 启用分析 */
		enable?: unknown;
		/** Google Analytics ID / Google Analytics ID */
		googleAnalyticsId?: unknown;
		/** Microsoft Clarity project ID / Microsoft Clarity 项目 ID */
		clarityProjectId?: unknown;
		/** Fathom site ID / Fathom 站点 ID */
		fathomSiteId?: unknown;
		/** Simple Analytics domain / Simple Analytics 域名 */
		simpleAnalyticsDomain?: unknown;
		/** Amplitude API key / Amplitude API 密钥 */
		amplitudeApiKey?: unknown;
		/** Umami analytics / Umami 分析 */
		umami?: {
			/** Website ID / 网站 ID */
			id?: unknown;
			/** Script URL / 脚本 URL */
			src?: unknown;
		};
		/** Plausible analytics / Plausible 分析 */
		plausible?: {
			/** Domain / 域名 */
			domain?: unknown;
			/** Script URL / 脚本 URL */
			src?: unknown;
		};
		/** Matomo analytics / Matomo 分析 */
		matomo?: {
			/** Site ID / 站点 ID */
			siteId?: unknown;
			/** Tracker URL / 跟踪器 URL */
			src?: unknown;
		};
	};
	/** LLMs.txt configuration / LLMs.txt 配置 */
	llms?: {
		/** Enable LLMs.txt generation / 启用 LLMs.txt 生成 */
		enable?: unknown;
		/** Enable sitemap / 启用站点地图 */
		sitemap?: unknown;
		/** Document title / 文档标题 */
		title?: unknown;
		/** Document description / 文档描述 */
		description?: unknown;
		/** Enable i18n support / 启用国际化支持 */
		i18n?: unknown;
	};
	/** Open Graph configuration / Open Graph 配置 */
	og?: {
		/** Default OG image path / 默认 OG 图片路径 */
		defaultImage?: unknown;
	};
	/** SEO configuration / SEO 配置 */
	seo?: {
		/** Enable IndexNow / 启用 IndexNow */
		indexNow?: unknown;
		/** IndexNow API key / IndexNow API 密钥 */
		indexNowKey?: unknown;
	};
};

/**
 * Default configuration values
 * 默认配置值
 * 
 * These values are used when a field is not specified in TOML or ENV.
 * 当 TOML 或 ENV 中未指定字段时使用这些值。
 */
const DEFAULT_CONFIG: Config = {
	site: {
		url: "https://kirari-main.vercel.app",
		base: "/",
		title: "KIRARI",
		subtitle: "Demo Site",
		lang: "en",
		themeColor: {
			hue: 250,
			fixed: false,
		},
		banner: {
			enable: true,
			src: "assets/images/demo-banner.png",
			position: "center",
			credit: {
				enable: false,
				text: "",
				url: "",
			},
		},
		toc: {
			enable: true,
			depth: 3,
		},
		favicon: [],
	},
	navBar: {
		links: [
			LinkPreset.Home,
			LinkPreset.Archive,
			LinkPreset.About,
			LinkPreset.Friends,
		],
	},
	profile: {
		avatar: "assets/images/demo-avatar.png",
		name: "Lorem Ipsum",
		bio: "Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
		links: [
			{
				name: "Twitter",
				icon: "fa6-brands:twitter",
				url: "https://twitter.com",
			},
			{
				name: "Steam",
				icon: "fa6-brands:steam",
				url: "https://store.steampowered.com",
			},
			{
				name: "GitHub",
				icon: "fa6-brands:github",
				url: "https://github.com/saicaca/fuwari",
			},
		],
	},
	license: {
		enable: true,
		name: "CC BY-NC-SA 4.0",
		url: "https://creativecommons.org/licenses/by-nc-sa/4.0/",
	},
	expressiveCode: {
		themes: ["github-dark", "github-dark-dimmed"],
	},
	mermaid: {
		enable: true,
	},
	head: {
		verification: {
			google: "",
			bing: "",
			yandex: "",
			naver: "",
		},
		customHtml: "",
		customScript: "",
	},
	footer: {
		customHtml: "",
		customScript: "",
	},
	analytics: {
		enable: false,
		googleAnalyticsId: "",
		umami: undefined,
		plausible: undefined,
		clarityProjectId: "",
		fathomSiteId: "",
		simpleAnalyticsDomain: "",
		matomo: undefined,
		amplitudeApiKey: "",
	},
	llms: {
		enable: true,
		sitemap: true,
		title: "KIRARI",
		description: "Documentation for KIRARI",
		i18n: true,
	},
	og: {
		defaultImage: "/og/default.png",
	},
	seo: {
		indexNow: false,
		indexNowKey: "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6",
	},
};

/**
 * Legacy default ENV config for backward compatibility
 * 旧版默认 ENV 配置，用于向后兼容
 * 
 * @deprecated Use DEFAULT_CONFIG instead. Will be removed in future version.
 */
const DEFAULT_ENV_CONFIG: EnvConfig = {
	siteUrl: DEFAULT_CONFIG.site.url,
	siteTitle: DEFAULT_CONFIG.site.title,
	siteSubtitle: DEFAULT_CONFIG.site.subtitle,
	bannerCreditEnable: DEFAULT_CONFIG.site.banner.credit.enable,
	bannerCreditText: DEFAULT_CONFIG.site.banner.credit.text,
	bannerCreditUrl: DEFAULT_CONFIG.site.banner.credit.url || "",
	analyticsEnable: DEFAULT_CONFIG.analytics.enable || false,
	googleAnalyticsId: DEFAULT_CONFIG.analytics.googleAnalyticsId || "",
	umamiId: DEFAULT_CONFIG.analytics.umami?.id || "",
	umamiSrc: DEFAULT_CONFIG.analytics.umami?.src || "",
	plausibleDomain: DEFAULT_CONFIG.analytics.plausible?.domain || "",
	plausibleSrc: DEFAULT_CONFIG.analytics.plausible?.src || "",
	clarityProjectId: DEFAULT_CONFIG.analytics.clarityProjectId || "",
	fathomSiteId: DEFAULT_CONFIG.analytics.fathomSiteId || "",
	simpleAnalyticsDomain: DEFAULT_CONFIG.analytics.simpleAnalyticsDomain || "",
	matomoSiteId: DEFAULT_CONFIG.analytics.matomo?.siteId || "",
	matomoSrc: DEFAULT_CONFIG.analytics.matomo?.src || "",
	amplitudeApiKey: DEFAULT_CONFIG.analytics.amplitudeApiKey || "",
	indexNowEnable: DEFAULT_CONFIG.seo.indexNow || false,
	indexNowKey: DEFAULT_CONFIG.seo.indexNowKey || "",
};

/**
 * Load TOML configuration file content using Vite's import.meta.glob
 * 使用 Vite 的 import.meta.glob 加载 TOML 配置文件内容
 * 
 * The file is loaded eagerly at build time as raw string.
 * 文件在构建时以原始字符串形式急切加载。
 */
const tomlModules = import.meta.glob("../../kirari.config.toml", {
	eager: true,
	query: "?raw",
	import: "default",
}) as Record<string, string>;

/**
 * Load and parse TOML configuration file
 * 加载并解析 TOML 配置文件
 * 
 * Reads kirari.config.toml from the project root and parses it into a TomlConfig object.
 * 从项目根目录读取 kirari.config.toml 并解析为 TomlConfig 对象。
 * 
 * @returns Parsed TOML configuration or empty object on error
 */
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

/**
 * Type guard for string values
 * 字符串类型守卫
 * 
 * Returns the value if it's a string, otherwise returns fallback.
 * 如果值是字符串则返回该值，否则返回回退值。
 * 
 * @param value - Unknown value to check
 * @param fallback - Fallback value if type mismatch
 * @returns String value or fallback
 */
const getString = (value: unknown, fallback: string): string => {
	return typeof value === "string" ? value : fallback;
};

/**
 * Type guard for boolean values
 * 布尔类型守卫
 * 
 * Returns the value if it's a boolean, otherwise returns fallback.
 * 如果值是布尔值则返回该值，否则返回回退值。
 * 
 * @param value - Unknown value to check
 * @param fallback - Fallback value if type mismatch
 * @returns Boolean value or fallback
 */
const getBoolean = (value: unknown, fallback: boolean): boolean => {
	return typeof value === "boolean" ? value : fallback;
};

/**
 * Type guard for number values
 * 数字类型守卫
 * 
 * Returns the value if it's a number and finite, otherwise returns fallback.
 * 如果值是数字且有限则返回该值，否则返回回退值。
 * 
 * @param value - Unknown value to check
 * @param fallback - Fallback value if type mismatch
 * @returns Number value or fallback
 */
const getNumber = (value: unknown, fallback: number): number => {
	return typeof value === "number" && Number.isFinite(value) ? value : fallback;
};

/**
 * Type guard for string arrays
 * 字符串数组类型守卫
 * 
 * Validates that all elements in the array are strings.
 * 验证数组中的所有元素都是字符串。
 * 
 * @param value - Unknown value to check
 * @param fallback - Fallback array if type mismatch
 * @returns String array or fallback
 */
const getStringArray = (value: unknown, fallback: string[]): string[] => {
	if (!Array.isArray(value)) return fallback;
	
	const result: string[] = [];
	for (const item of value) {
		if (typeof item === "string") {
			result.push(item);
		}
	}
	
	return result.length > 0 ? result : fallback;
};

/**
 * Validate navigation bar links array
 * 验证导航栏链接数组
 * 
 * Supports both preset links (e.g., { preset: "Home" }) and custom links
 * (e.g., { name: "GitHub", url: "...", external: true }).
 * 支持预设链接（如 { preset: "Home" }）和自定义链接（如 { name: "GitHub", url: "...", external: true }）。
 * 
 * @param links - Unknown value to validate
 * @param fallback - Fallback array if validation fails
 * @returns Validated links array
 */
const validateNavBarLinks = (
	links: unknown,
	fallback: Array<{ name: string; url: string; external?: boolean } | number>
): Array<{ name: string; url: string; external?: boolean } | number> => {
	if (!Array.isArray(links) || links.length === 0) return fallback;
	
	const result: Array<{ name: string; url: string; external?: boolean } | number> = [];
	
	for (const link of links) {
		if (typeof link !== "object" || link === null) continue;
		
		// Preset link: { preset: "Home" | "Archive" | "About" | "Friends" }
		if ("preset" in link && typeof link.preset === "string") {
			const presetMap: Record<string, number> = {
				"Home": 0,
				"Archive": 1,
				"About": 2,
				"Friends": 3,
			};
			
			const presetValue = presetMap[link.preset];
			if (presetValue !== undefined) {
				result.push(presetValue);
			} else {
				console.warn(`[config-loader] Invalid navBar preset: "${link.preset}"`);
			}
			continue;
		}
		
		// Custom link: { name: string, url: string, external?: boolean }
		if ("name" in link && "url" in link) {
			if (typeof link.name === "string" && typeof link.url === "string") {
				const validated: { name: string; url: string; external?: boolean } = {
					name: link.name,
					url: link.url,
				};
				
				if ("external" in link && typeof link.external === "boolean") {
					validated.external = link.external;
				}
				
				result.push(validated);
			} else {
				console.warn("[config-loader] Invalid navBar link: name and url must be strings", link);
			}
		} else {
			console.warn("[config-loader] Invalid navBar link: missing name or url", link);
		}
	}
	
	return result.length > 0 ? result : fallback;
};

/**
 * Validate profile links array
 * 验证个人资料链接数组
 * 
 * Each link must have name, icon, and url properties.
 * 每个链接必须有 name、icon 和 url 属性。
 * 
 * @param links - Unknown value to validate
 * @param fallback - Fallback array if validation fails
 * @returns Validated profile links array
 */
const validateProfileLinks = (
	links: unknown,
	fallback: Array<{ name: string; url: string; icon: string }>
): Array<{ name: string; url: string; icon: string }> => {
	if (!Array.isArray(links) || links.length === 0) return fallback;
	
	const result: Array<{ name: string; url: string; icon: string }> = [];
	
	for (const link of links) {
		if (typeof link !== "object" || link === null) continue;
		
		if (
			"name" in link &&
			"icon" in link &&
			"url" in link &&
			typeof link.name === "string" &&
			typeof link.icon === "string" &&
			typeof link.url === "string"
		) {
			result.push({
				name: link.name,
				icon: link.icon,
				url: link.url,
			});
		} else {
			console.warn("[config-loader] Invalid profile link: must have name, icon, and url as strings", link);
		}
	}
	
	return result.length > 0 ? result : fallback;
};

/**
 * Validate favicon configuration array
 * 验证 favicon 配置数组
 * 
 * Each favicon must have a 'src' property. 'theme' and 'sizes' are optional.
 * 每个 favicon 必须有 'src' 属性。'theme' 和 'sizes' 是可选的。
 * 
 * @param favicons - Unknown value to validate
 * @returns Validated favicon array
 */
const validateFavicons = (favicons: unknown): Array<{ src: string; theme?: "light" | "dark"; sizes?: string }> => {
	if (!Array.isArray(favicons) || favicons.length === 0) return [];
	
	const result: Array<{ src: string; theme?: "light" | "dark"; sizes?: string }> = [];
	
	for (const favicon of favicons) {
		if (
			typeof favicon === "object" &&
			favicon !== null &&
			"src" in favicon &&
			typeof favicon.src === "string"
		) {
			const validated: { src: string; theme?: "light" | "dark"; sizes?: string } = {
				src: favicon.src,
			};
			
			// Validate theme
			if (
				"theme" in favicon &&
				(favicon.theme === "light" || favicon.theme === "dark")
			) {
				validated.theme = favicon.theme;
			}
			
			// Validate sizes
			if ("sizes" in favicon && typeof favicon.sizes === "string") {
				validated.sizes = favicon.sizes;
			}
			
			result.push(validated);
		}
	}
	
	return result;
};

/**
 * Load and validate configuration from TOML file
 * 从 TOML 文件加载并验证配置
 * 
 * Priority: ENV variables > TOML config > Default values
 * 优先级：环境变量 > TOML 配置 > 默认值
 * 
 * @returns Complete configuration object
 */
export const loadConfig = (): Config => {
	const toml = loadTomlConfig();
	const site = toml.site;
	const navBar = toml.navBar;
	const profile = toml.profile;
	const license = toml.license;
	const expressiveCode = toml.expressiveCode;
	const mermaid = toml.mermaid;
	const head = toml.head;
	const footer = toml.footer;
	const analytics = toml.analytics;
	const llms = toml.llms;
	const og = toml.og;
	const seo = toml.seo;

	// Helper: validate lang field
	const validLangs = ["en", "zh_CN", "zh_TW", "ja", "ko", "es", "th", "vi", "tr", "id"] as const;
	const validateLang = (value: unknown): typeof validLangs[number] => {
		if (typeof value === "string" && validLangs.includes(value as typeof validLangs[number])) {
			return value as typeof validLangs[number];
		}
		return DEFAULT_CONFIG.site.lang;
	};

	// Helper: validate toc depth (1-3)
	const validateTocDepth = (value: unknown): 1 | 2 | 3 => {
		const num = getNumber(value, DEFAULT_CONFIG.site.toc.depth);
		if (num >= 1 && num <= 3) return num as 1 | 2 | 3;
		return DEFAULT_CONFIG.site.toc.depth;
	};

	// Helper: validate banner position
	const validateBannerPosition = (value: unknown): "top" | "center" | "bottom" => {
		if (value === "top" || value === "center" || value === "bottom") {
			return value;
		}
		return DEFAULT_CONFIG.site.banner.position || "center";
	};

	// Build config with validation
	const config: Config = {
		site: {
			url: getString(site?.url, DEFAULT_CONFIG.site.url),
			base: getString(site?.base, DEFAULT_CONFIG.site.base),
			title: getString(site?.title, DEFAULT_CONFIG.site.title),
			subtitle: getString(site?.subtitle, DEFAULT_CONFIG.site.subtitle),
			lang: validateLang(site?.lang),
			themeColor: {
				hue: getNumber(site?.themeColor?.hue, DEFAULT_CONFIG.site.themeColor.hue),
				fixed: getBoolean(site?.themeColor?.fixed, DEFAULT_CONFIG.site.themeColor.fixed),
			},
			banner: {
				enable: getBoolean(site?.banner?.enable, DEFAULT_CONFIG.site.banner.enable),
				src: getString(site?.banner?.src, DEFAULT_CONFIG.site.banner.src),
				position: validateBannerPosition(site?.banner?.position),
				credit: {
					enable: getBoolean(site?.banner?.credit?.enable, DEFAULT_CONFIG.site.banner.credit.enable),
					text: getString(site?.banner?.credit?.text, DEFAULT_CONFIG.site.banner.credit.text),
					url: getString(site?.banner?.credit?.url, DEFAULT_CONFIG.site.banner.credit.url || ""),
				},
			},
			toc: {
				enable: getBoolean(site?.toc?.enable, DEFAULT_CONFIG.site.toc.enable),
				depth: validateTocDepth(site?.toc?.depth),
			},
			favicon: validateFavicons(site?.favicon),
		},
		navBar: {
			links: validateNavBarLinks(navBar?.links, DEFAULT_CONFIG.navBar.links),
		},
		profile: {
			avatar: getString(profile?.avatar, DEFAULT_CONFIG.profile.avatar || ""),
			name: getString(profile?.name, DEFAULT_CONFIG.profile.name),
			bio: getString(profile?.bio, DEFAULT_CONFIG.profile.bio || ""),
			links: validateProfileLinks(profile?.links, DEFAULT_CONFIG.profile.links),
		},
		license: {
			enable: getBoolean(license?.enable, DEFAULT_CONFIG.license.enable),
			name: getString(license?.name, DEFAULT_CONFIG.license.name),
			url: getString(license?.url, DEFAULT_CONFIG.license.url),
		},
		expressiveCode: {
			themes: getStringArray(expressiveCode?.themes, DEFAULT_CONFIG.expressiveCode.themes),
		},
		mermaid: {
			enable: getBoolean(mermaid?.enable, DEFAULT_CONFIG.mermaid.enable),
		},
		head: {
			verification: {
				google: getString(head?.verification?.google, DEFAULT_CONFIG.head.verification.google),
				bing: getString(head?.verification?.bing, DEFAULT_CONFIG.head.verification.bing),
				yandex: getString(head?.verification?.yandex, DEFAULT_CONFIG.head.verification.yandex),
				naver: getString(head?.verification?.naver, DEFAULT_CONFIG.head.verification.naver),
			},
			customHtml: getString(head?.customHtml, DEFAULT_CONFIG.head.customHtml),
			customScript: getString(head?.customScript, DEFAULT_CONFIG.head.customScript),
		},
		footer: {
			customHtml: getString(footer?.customHtml, DEFAULT_CONFIG.footer.customHtml),
			customScript: getString(footer?.customScript, DEFAULT_CONFIG.footer.customScript),
		},
		analytics: {
			enable: getBoolean(analytics?.enable, DEFAULT_CONFIG.analytics.enable || false),
			googleAnalyticsId: getString(analytics?.googleAnalyticsId, DEFAULT_CONFIG.analytics.googleAnalyticsId || ""),
			clarityProjectId: getString(analytics?.clarityProjectId, DEFAULT_CONFIG.analytics.clarityProjectId || ""),
			fathomSiteId: getString(analytics?.fathomSiteId, DEFAULT_CONFIG.analytics.fathomSiteId || ""),
			simpleAnalyticsDomain: getString(analytics?.simpleAnalyticsDomain, DEFAULT_CONFIG.analytics.simpleAnalyticsDomain || ""),
			amplitudeApiKey: getString(analytics?.amplitudeApiKey, DEFAULT_CONFIG.analytics.amplitudeApiKey || ""),
			umami: analytics?.umami?.id ? {
				id: getString(analytics.umami.id, ""),
				src: getString(analytics.umami.src, undefined),
			} : DEFAULT_CONFIG.analytics.umami,
			plausible: analytics?.plausible?.domain ? {
				domain: getString(analytics.plausible.domain, ""),
				src: getString(analytics.plausible.src, undefined),
			} : DEFAULT_CONFIG.analytics.plausible,
			matomo: analytics?.matomo?.siteId && analytics?.matomo?.src ? {
				siteId: getString(analytics.matomo.siteId, ""),
				src: getString(analytics.matomo.src, ""),
			} : DEFAULT_CONFIG.analytics.matomo,
		},
		llms: {
			enable: getBoolean(llms?.enable, DEFAULT_CONFIG.llms.enable),
			sitemap: getBoolean(llms?.sitemap, DEFAULT_CONFIG.llms.sitemap || false),
			title: getString(llms?.title, DEFAULT_CONFIG.llms.title || ""),
			description: getString(llms?.description, DEFAULT_CONFIG.llms.description || ""),
			i18n: getBoolean(llms?.i18n, DEFAULT_CONFIG.llms.i18n || false),
		},
		og: {
			defaultImage: getString(og?.defaultImage, DEFAULT_CONFIG.og.defaultImage),
		},
		seo: {
			indexNow: getBoolean(seo?.indexNow, DEFAULT_CONFIG.seo.indexNow || false),
			indexNowKey: getString(seo?.indexNowKey, DEFAULT_CONFIG.seo.indexNowKey || ""),
		},
	};

	return config;
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
