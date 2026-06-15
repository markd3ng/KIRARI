import { parse } from "smol-toml";
import { getEnvBoolean, getEnvString, getEnvStringFromKeys } from "./env";
import { LinkPreset, type Config, type LinkPresetType, type NavBarLink } from "../types/config";

/**
 * Legacy EnvConfig type for backward compatibility
 * 旧版 EnvConfig 类型，用于向后兼容
 * 
 * Prefer Config for new code.
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
	umamiIntegrity: string;
	plausibleDomain: string;
	plausibleSrc: string;
	plausibleIntegrity: string;
	clarityProjectId: string;
	fathomSiteId: string;
	simpleAnalyticsDomain: string;
	matomoSiteId: string;
	matomoSrc: string;
	matomoIntegrity: string;
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
		/** BCP 47 language tag (e.g., "en-US", "zh-CN") / BCP 47 语言标签 */
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
			/** TOC layout ("floating", "sidebar") / 目录布局 */
			layout?: unknown;
		};
		/** Favicon array / 图标数组 */
		favicon?: unknown; // Array type, will be validated at runtime
	};
	/** Posts routing configuration / 文章路由配置 */
	posts?: {
		/** Slug strategy when frontmatter slug is empty / frontmatter slug 为空时的 slug 策略 */
		slugStrategy?: unknown;
		/** TOML key: slug-strategy / TOML 键：slug-strategy */
		"slug-strategy"?: unknown;
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
		/** Display avatar as a circle / 圆形头像 */
		avatarRounded?: unknown;
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
	/** Comments provider configuration / 评论系统配置 */
	comments?: {
		provider?: unknown;
		giscus?: {
			repo?: unknown;
			repoId?: unknown;
			category?: unknown;
			categoryId?: unknown;
			mapping?: unknown;
			lang?: unknown;
		};
		waline?: {
			serverUrl?: unknown;
			lang?: unknown;
		};
		twikoo?: {
			envId?: unknown;
			lang?: unknown;
		};
	};
	/** Sidebar layout and widget configuration / 侧边栏布局与组件配置 */
	sidebar?: {
		/** Enable sidebar / 启用侧边栏 */
		enabled?: unknown;
		/** Sidebar position, currently left / 侧边栏位置，目前为左侧 */
		position?: unknown;
		/** Left sidebar widgets / 左侧栏组件 */
		leftWidgets?: unknown;
		/** Right sidebar widgets / 右侧栏组件 */
		rightWidgets?: unknown;
		/** Mobile bottom widgets / 移动端底部组件 */
		mobileWidgets?: unknown;
	};
	/** Optional sidebar widget content configuration / 可选侧边栏组件内容配置 */
	widgets?: {
		announcement?: {
			enabled?: unknown;
			id?: unknown;
			title?: unknown;
			content?: unknown;
			linkText?: unknown;
			linkUrl?: unknown;
			closable?: unknown;
		};
		advertisement?: {
			enabled?: unknown;
			id?: unknown;
			title?: unknown;
			content?: unknown;
			imageSrc?: unknown;
			imageAlt?: unknown;
			linkText?: unknown;
			linkUrl?: unknown;
			expireDate?: unknown;
			displayCount?: unknown;
			closable?: unknown;
		};
		siteStats?: {
			enabled?: unknown;
			siteStartDate?: unknown;
		};
		siteInfo?: {
			enabled?: unknown;
		};
		calendar?: {
			enabled?: unknown;
			showHeatmap?: unknown;
		};
	};
	sponsor?: {
		enabled?: unknown;
		title?: unknown;
		description?: unknown;
		methods?: unknown;
		supporters?: unknown;
	};
	bangumi?: {
		enabled?: unknown;
		userId?: unknown;
		apiBase?: unknown;
		mode?: unknown;
		categoryOrder?: unknown;
	};
	fonts?: {
		enabled?: unknown;
		links?: unknown;
		fontFamily?: unknown;
	};
	coverImage?: {
		lqip?: unknown;
		fadeIn?: unknown;
	};
	markdown?: {
		plantuml?: {
			enable?: unknown;
			server?: unknown;
			lightTheme?: unknown;
			darkTheme?: unknown;
		};
		admonitions?: {
			theme?: unknown;
		};
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
		/** Trusted HTML snippet file in src/snippets / src/snippets 中的可信 HTML 片段文件 */
		customHtmlFile?: unknown;
		/** Custom JavaScript in <head> / 头部自定义 JavaScript */
		customScript?: unknown;
		/** Trusted JavaScript snippet file in src/snippets / src/snippets 中的可信 JavaScript 片段文件 */
		customScriptFile?: unknown;
	};
	/** Footer configuration / 页脚配置 */
	footer?: {
		/** Custom HTML in footer / 页脚自定义 HTML */
		customHtml?: unknown;
		/** Trusted HTML snippet file in src/snippets / src/snippets 中的可信 HTML 片段文件 */
		customHtmlFile?: unknown;
		/** Custom JavaScript in footer / 页脚自定义 JavaScript */
		customScript?: unknown;
		/** Trusted JavaScript snippet file in src/snippets / src/snippets 中的可信 JavaScript 片段文件 */
		customScriptFile?: unknown;
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
			/** Optional SRI hash / 可选 SRI 哈希 */
			integrity?: unknown;
		};
		/** Plausible analytics / Plausible 分析 */
		plausible?: {
			/** Domain / 域名 */
			domain?: unknown;
			/** Script URL / 脚本 URL */
			src?: unknown;
			/** Optional SRI hash / 可选 SRI 哈希 */
			integrity?: unknown;
		};
		/** Matomo analytics / Matomo 分析 */
		matomo?: {
			/** Site ID / 站点 ID */
			siteId?: unknown;
			/** Tracker URL / 跟踪器 URL */
			src?: unknown;
			/** Optional SRI hash / 可选 SRI 哈希 */
			integrity?: unknown;
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
		/** URL include patterns / URL 包含模式 */
		includePatterns?: unknown;
		/** URL exclude patterns / URL 排除模式 */
		excludePatterns?: unknown;
		/** Enable i18n support / 启用国际化支持 */
		i18n?: unknown;
	};
	/** Internationalization configuration / 国际化配置 */
	i18n?: {
		/** Enable language-prefixed routes / 启用语言前缀路由 */
		enable?: unknown;
		/** Default language / 默认语言 */
		defaultLang?: unknown;
		/** Hugo-style default language key / Hugo 风格默认语言键 */
		defaultLanguage?: unknown;
		/** TOML key: default-language / TOML 键：default-language */
		"default-language"?: unknown;
		/** Put default language under its language subdirectory / 默认语言是否使用语言子目录 */
		defaultLangInSubdir?: unknown;
		/** TOML key: default-language-in-subdir / TOML 键：default-language-in-subdir */
		"default-language-in-subdir"?: unknown;
		/** Disable default language prefix redirects / 禁用默认语言前缀重定向 */
		disableDefaultLanguageRedirect?: unknown;
		/** TOML key: disable-default-language-redirect / TOML 键：disable-default-language-redirect */
		"disable-default-language-redirect"?: unknown;
		/** Enabled languages / 启用语言 */
		languages?: unknown;
		/** Fallback to default language when translation is missing / 缺失翻译时回退默认语言 */
		fallbackToDefault?: unknown;
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
		/** Google indexing configuration / Google 索引配置 */
		google?: {
			/** Enable Google Indexing API / 启用 Google Indexing API */
			indexingApi?: unknown;
			/** Env var name for service account JSON / 服务账号 JSON 的环境变量名 */
			serviceAccountJsonEnv?: unknown;
		};
	};
	/** Search configuration / 搜索配置 */
	search?: {
		/** Active search provider / 当前搜索提供方 */
		provider?: unknown;
		/** Algolia DocSearch configuration / Algolia DocSearch 配置 */
		docsearch?: {
			/** Enable DocSearch and disable Pagefind / 启用 DocSearch 并禁用 Pagefind */
			enable?: unknown;
			/** Algolia application ID / Algolia 应用 ID */
			appId?: unknown;
			/** Algolia search-only API key / Algolia 搜索 API key */
			apiKey?: unknown;
			/** Algolia index name / Algolia 索引名 */
			indexName?: unknown;
			/** Filter DocSearch results by docsearch:language / 按 docsearch:language 过滤 */
			filterByLanguage?: unknown;
			/** Extra docsearch:* meta tags / 额外 docsearch:* meta 标签 */
			metaTags?: unknown;
		};
		/** Google Programmable Search configuration / Google Programmable Search 配置 */
		google?: {
			/** Search engine ID / 搜索引擎 ID */
			cx?: unknown;
			/** Preserve Google-rendered AdSense results / 保留 Google 官方 AdSense 结果渲染 */
			adsense?: unknown;
			/** Result set size / 结果集大小 */
			resultSetSize?: unknown;
			/** SafeSearch mode / SafeSearch 模式 */
			safeSearch?: unknown;
		};
	};
	/** GitHub card configuration / GitHub 卡片配置 */
	githubCard?: {
		/** GitHub REST API base for markdown cards / Markdown GitHub 卡片 API 基础路径 */
		apiBase?: unknown;
		/** Optional runtime adapter / 可选运行时适配器 */
		adapter?: {
			enabled?: unknown;
			provider?: unknown;
			route?: unknown;
			serviceBinding?: unknown;
		};
	};
	/** Landing page configuration / Landing Page 配置 */
	landingPage?: {
		/** Enable PRD-style landing page on home routes / 在首页启用 PRD 风格 Landing Page */
		enable?: unknown;
		/** Number of latest posts to show / 最新文章数量 */
		latestCount?: unknown;
		/** Hero image path / Hero 图片路径 */
		heroImage?: unknown;
		/** Hero eyebrow text / Hero 小标题 */
		eyebrow?: unknown;
		/** Hero title first line / Hero 主标题 */
		title?: unknown;
		/** Hero highlighted line / Hero 高亮标题 */
		highlight?: unknown;
		/** Hero description / Hero 描述 */
		description?: unknown;
		/** Primary CTA label / 主按钮文案 */
		primaryCtaLabel?: unknown;
		/** Secondary CTA label / 副按钮文案 */
		secondaryCtaLabel?: unknown;
		/** Feature cards configuration / 特性卡片配置 */
		features?: {
			/** Show feature cards section / 显示特性卡片模块 */
			enable?: unknown;
			/** Feature card items / 特性卡片列表 */
			items?: unknown;
		};
	};
	/** Edge configuration / Edge 配置 */
	edge?: {
		/** Enable edge runtime / 启用 Edge 运行时 */
		enabled?: unknown;
		/** Edge API base URL / Edge API 基础 URL */
		apiBase?: unknown;
		/** Edge feature flags / Edge 特性开关 */
		features?: {
			/** GitHub Card proxy / GitHub Card 代理 */
			githubCard?: { enabled?: unknown };
			/** Avatar proxy / 头像代理 */
			avatarProxy?: { enabled?: unknown };
			/** Bangumi API proxy / Bangumi API 代理 */
			bangumiApiProxy?: { enabled?: unknown };
			/** Bangumi image proxy / Bangumi 图片代理 */
			bangumiImageProxy?: { enabled?: unknown };
		};
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
		lang: "en-US",
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
			layout: "floating",
		},
		favicon: [],
	},
	navBar: {
		links: [
			LinkPreset.Home,
			LinkPreset.Archive,
			LinkPreset.About,
			LinkPreset.Friends,
			LinkPreset.Projects,
		],
	},
	profile: {
		avatar: "assets/images/demo-avatar.png",
		avatarRounded: false,
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
	comments: {
		provider: "none",
		giscus: {
			repo: "",
			repoId: "",
			category: "General",
			categoryId: "",
			mapping: "pathname",
			lang: "en",
		},
		waline: {
			serverUrl: "",
			lang: "en",
		},
		twikoo: {
			envId: "",
			lang: "en",
		},
	},
	sidebar: {
		enabled: true,
		position: "left",
		leftWidgets: [
			{
				type: "profile",
				enabled: true,
				position: "top",
				showOnPostPage: true,
				showOnNonPostPage: true,
			},
			{
				type: "toc",
				enabled: true,
				position: "sticky",
				showOnPostPage: true,
				showOnNonPostPage: false,
			},
			{
				type: "categories",
				enabled: true,
				position: "sticky",
				showOnPostPage: true,
				showOnNonPostPage: true,
			},
			{
				type: "tags",
				enabled: true,
				position: "sticky",
				showOnPostPage: true,
				showOnNonPostPage: true,
			},
		],
		rightWidgets: [],
		mobileWidgets: [],
	},
	widgets: {
		announcement: {
			enabled: false,
			id: "announcement",
			title: "Announcement",
			content: "",
			linkText: "",
			linkUrl: "",
			closable: true,
		},
		advertisement: {
			enabled: false,
			id: "advertisement",
			title: "Advertisement",
			content: "",
			imageSrc: "",
			imageAlt: "Advertisement",
			linkText: "",
			linkUrl: "",
			expireDate: "",
			displayCount: -1,
			closable: true,
		},
		siteStats: {
			enabled: true,
			siteStartDate: "2025-01-01",
		},
		siteInfo: {
			enabled: true,
		},
		calendar: {
			enabled: true,
			showHeatmap: true,
		},
	},
	sponsor: {
		enabled: false,
		title: "Sponsor",
		description: "",
		methods: [],
		supporters: [],
	},
	bangumi: {
		enabled: false,
		userId: "",
		apiBase: "https://api.bgm.tv",
		mode: "dynamic",
		categoryOrder: ["anime", "book", "music", "game"],
	},
	fonts: {
		enabled: false,
		links: [],
		fontFamily: "",
	},
	coverImage: {
		lqip: true,
		fadeIn: true,
	},
	markdown: {
		plantuml: {
			enable: false,
			server: "https://www.plantuml.com/plantuml",
			lightTheme: "",
			darkTheme: "",
		},
		admonitions: {
			theme: "kirari",
		},
	},
	head: {
		verification: {
			google: "",
			bing: "",
			yandex: "",
			naver: "",
		},
		customHtml: "",
		customHtmlFile: "",
		customScript: "",
		customScriptFile: "",
	},
	footer: {
		customHtml: "",
		customHtmlFile: "",
		customScript: "",
		customScriptFile: "",
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
		includePatterns: ["*"],
		excludePatterns: ["*/categories/*", "*/tags/*", "*/archive/*", "*/page/*"],
		i18n: true,
	},
	posts: {
		slugStrategy: "file",
	},
	i18n: {
		enable: true,
		defaultLang: "en-US",
		defaultLangInSubdir: false,
		disableDefaultLanguageRedirect: false,
		languages: ["en-US", "zh-CN", "zh-TW", "zh-HK"],
		languageMap: {
			"en-US": {
				code: "en-US",
				label: "English",
				locale: "en-US",
				direction: "ltr",
				weight: 1,
				disabled: false,
				contentDir: "src/content/posts",
			},
			"zh-CN": {
				code: "zh-CN",
				label: "简体中文",
				locale: "zh-CN",
				direction: "ltr",
				weight: 2,
				disabled: false,
				contentDir: "src/content/posts/zh-CN",
			},
			"zh-TW": {
				code: "zh-TW",
				label: "繁體中文",
				locale: "zh-TW",
				direction: "ltr",
				weight: 3,
				disabled: false,
				contentDir: "src/content/posts/zh-TW",
			},
			"zh-HK": {
				code: "zh-HK",
				label: "繁體中文（香港）",
				locale: "zh-HK",
				direction: "ltr",
				weight: 4,
				disabled: false,
				contentDir: "src/content/posts/zh-HK",
			},
			"ja-JP": {
				code: "ja-JP",
				label: "日本語",
				locale: "ja-JP",
				direction: "ltr",
				weight: 5,
				disabled: true,
				contentDir: "src/content/posts/ja-JP",
			},
			"ko-KR": {
				code: "ko-KR",
				label: "한국어",
				locale: "ko-KR",
				direction: "ltr",
				weight: 6,
				disabled: true,
				contentDir: "src/content/posts/ko-KR",
			},
			"es-ES": {
				code: "es-ES",
				label: "Español",
				locale: "es-ES",
				direction: "ltr",
				weight: 7,
				disabled: true,
				contentDir: "src/content/posts/es-ES",
			},
			"th-TH": {
				code: "th-TH",
				label: "ไทย",
				locale: "th-TH",
				direction: "ltr",
				weight: 8,
				disabled: true,
				contentDir: "src/content/posts/th-TH",
			},
			"vi-VN": {
				code: "vi-VN",
				label: "Tiếng Việt",
				locale: "vi-VN",
				direction: "ltr",
				weight: 9,
				disabled: true,
				contentDir: "src/content/posts/vi-VN",
			},
			"tr-TR": {
				code: "tr-TR",
				label: "Türkçe",
				locale: "tr-TR",
				direction: "ltr",
				weight: 10,
				disabled: true,
				contentDir: "src/content/posts/tr-TR",
			},
			"id-ID": {
				code: "id-ID",
				label: "Bahasa Indonesia",
				locale: "id-ID",
				direction: "ltr",
				weight: 11,
				disabled: true,
				contentDir: "src/content/posts/id-ID",
			},
		},
		fallbackToDefault: true,
	},
	og: {
		defaultImage: "/og/default.png",
	},
	seo: {
		indexNow: false,
		indexNowKey: "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6",
		google: {
			indexingApi: false,
			serviceAccountJsonEnv: "GOOGLE_INDEXING_SERVICE_ACCOUNT_JSON",
		},
	},
	search: {
		provider: "pagefind",
		docsearch: {
			enable: false,
			appId: "",
			apiKey: "",
			indexName: "",
			filterByLanguage: true,
			metaTags: {},
		},
		google: {
			cx: "",
			adsense: false,
			resultSetSize: "filtered_cse",
			safeSearch: "active",
		},
	},
	githubCard: {
		apiBase: "https://api.github.com",
		adapter: {
			enabled: false,
			provider: "none",
			route: "/ghc",
			serviceBinding: "GHCARD_CACHE",
		},
	},
	landingPage: {
		enable: false,
		latestCount: 3,
		heroImage: "assets/images/demo-banner.png",
		eyebrow: "WELCOME TO KIRARI",
		title: "Documenting Ideas.",
		highlight: "Sharing Knowledge.",
		description: "A space for notes, tutorials, and thoughts on technology and development.",
		primaryCtaLabel: "Explore Articles",
		secondaryCtaLabel: "Learn More",
		features: {
			enable: true,
			items: [
				{
					icon: "material-symbols:electric-bolt-rounded",
					title: "Technical Articles",
					description: "In-depth guides and tutorials for developers.",
				},
				{
					icon: "material-symbols:menu-book-outline-rounded",
					title: "Learning Notes",
					description: "Record and share the learning journey.",
				},
				{
					icon: "material-symbols:code-rounded",
					title: "Open Source",
					description: "Build with modern web technologies.",
				},
				{
					icon: "material-symbols:favorite-outline-rounded",
					title: "Community",
					description: "Connect and grow together.",
				},
			],
		},
	},
		edge: {
			enabled: false,
			apiBase: "",
			features: {
				githubCard: { enabled: false },
				avatarProxy: { enabled: false },
				bangumiApiProxy: { enabled: false },
				bangumiImageProxy: { enabled: false },
			},
		},
};

/**
 * Legacy default ENV config for backward compatibility
 * 旧版默认 ENV 配置，用于向后兼容
 * 
 * Prefer DEFAULT_CONFIG for new code.
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
	umamiIntegrity: DEFAULT_CONFIG.analytics.umami?.integrity || "",
	plausibleDomain: DEFAULT_CONFIG.analytics.plausible?.domain || "",
	plausibleSrc: DEFAULT_CONFIG.analytics.plausible?.src || "",
	plausibleIntegrity: DEFAULT_CONFIG.analytics.plausible?.integrity || "",
	clarityProjectId: DEFAULT_CONFIG.analytics.clarityProjectId || "",
	fathomSiteId: DEFAULT_CONFIG.analytics.fathomSiteId || "",
	simpleAnalyticsDomain: DEFAULT_CONFIG.analytics.simpleAnalyticsDomain || "",
	matomoSiteId: DEFAULT_CONFIG.analytics.matomo?.siteId || "",
	matomoSrc: DEFAULT_CONFIG.analytics.matomo?.src || "",
	matomoIntegrity: DEFAULT_CONFIG.analytics.matomo?.integrity || "",
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
 * Trusted custom head/footer snippets from src/snippets.
 * 来自 src/snippets 的可信 head/footer 片段。
 */
const snippetModules = import.meta.glob("../snippets/*.{html,js}", {
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

const SAFE_SNIPPET_FILE_RE = /^[A-Za-z0-9][A-Za-z0-9._-]*\.(html|js)$/;

const getSnippetFileName = (value: unknown): string => {
	const fileName = getString(value, "").trim();
	if (!fileName) return "";
	if (!SAFE_SNIPPET_FILE_RE.test(fileName)) {
		console.warn(`[config-loader] Ignored unsafe snippet file name: "${fileName}"`);
		return "";
	}
	return fileName;
};

const getSnippetContent = (fileName: string): string => {
	if (!fileName) return "";
	const content = snippetModules[`../snippets/${fileName}`];
	if (typeof content !== "string") {
		console.warn(`[config-loader] Snippet file not found: "${fileName}"`);
		return "";
	}
	return content;
};

const combineTrustedSnippets = (inlineContent: string, fileName: string): string => {
	const fileContent = getSnippetContent(fileName);
	return [inlineContent, fileContent].filter((item) => item.length > 0).join("\n");
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

const getStringRecord = (
	value: unknown,
	fallback: Record<string, string>,
): Record<string, string> => {
	if (typeof value !== "object" || value === null || Array.isArray(value)) {
		return fallback;
	}

	const result: Record<string, string> = {};
	for (const [key, item] of Object.entries(value)) {
		if (typeof item === "string") result[key] = item;
	}

	return Object.keys(result).length > 0 ? result : fallback;
};

/**
 * Validate navigation bar links array
 * 验证导航栏链接数组
 * 
 * Supports preset links, custom links, and recursive custom children.
 * 支持预设链接、自定义链接和递归自定义子菜单。
 * 
 * @param links - Unknown value to validate
 * @param fallback - Fallback array if validation fails
 * @returns Validated links array
 */
const validateNavBarLinks = (
	links: unknown,
	fallback: Array<NavBarLink | LinkPresetType>,
	depth = 0,
): Array<NavBarLink | LinkPresetType> => {
	if (!Array.isArray(links) || links.length === 0) return fallback;
	
	const result: Array<NavBarLink | LinkPresetType> = [];
	
	for (const link of links) {
		if (typeof link !== "object" || link === null) continue;
		
		// Preset link: { preset: "Home" | "Archive" | "About" | "Friends" | "Projects" }
		if ("preset" in link && typeof link.preset === "string") {
			const presetMap: Record<string, LinkPresetType> = {
				"Home": LinkPreset.Home,
				"Archive": LinkPreset.Archive,
				"About": LinkPreset.About,
				"Friends": LinkPreset.Friends,
				"Projects": LinkPreset.Projects,
			};
			
			const presetValue = presetMap[link.preset];
			if (presetValue !== undefined) {
				result.push(presetValue);
			} else {
				console.warn(`[config-loader] Invalid navBar preset: "${link.preset}"`);
			}
			continue;
		}
		
		// Custom link: { name: string, url: string, external?: boolean, children?: NavBarLink[] }
		if ("name" in link && "url" in link) {
			if (typeof link.name === "string" && typeof link.url === "string") {
				const validated: NavBarLink = {
					name: link.name,
					url: link.url,
				};
				
				if ("external" in link && typeof link.external === "boolean") {
					validated.external = link.external;
				}

				if (depth < 3 && "children" in link && Array.isArray(link.children)) {
					const children = validateNavBarLinks(link.children, [], depth + 1)
						.filter((child): child is NavBarLink => typeof child !== "number");
					if (children.length > 0) validated.children = children;
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
	const comments = toml.comments;
	const head = toml.head;
	const footer = toml.footer;
	const analytics = toml.analytics;
	const llms = toml.llms;
	const sidebar = toml.sidebar;
	const widgets = toml.widgets;
	const sponsor = toml.sponsor;
	const bangumi = toml.bangumi;
	const fonts = toml.fonts;
	const coverImage = toml.coverImage;
	const markdown = toml.markdown;
	const i18n = toml.i18n;
	const og = toml.og;
	const seo = toml.seo;
	const search = toml.search;
	const githubCard = toml.githubCard;
	const landingPage = toml.landingPage;
	const edge = toml.edge;

	// Helper: validate lang field
	const validLangs = ["en-US", "zh-CN", "zh-TW", "zh-HK", "ja-JP", "ko-KR", "es-ES", "th-TH", "vi-VN", "tr-TR", "id-ID"] as const;
	const validateLang = (value: unknown): typeof validLangs[number] => {
		if (typeof value === "string") {
			const match = validLangs.find((lang) => lang.toLowerCase() === value.toLowerCase());
			if (match) {
				return match;
			}
		}
		return DEFAULT_CONFIG.site.lang;
	};
	const validateLangArray = (value: unknown): typeof validLangs[number][] => {
		if (!Array.isArray(value)) return DEFAULT_CONFIG.i18n.languages;
		const languages = value
			.map(validateLang)
			.filter((item): item is typeof validLangs[number] => validLangs.includes(item));
		return languages.length > 0 ? Array.from(new Set(languages)) : DEFAULT_CONFIG.i18n.languages;
	};
	const defaultLanguageLabels: Record<typeof validLangs[number], string> = {
		"en-US": "English",
		"zh-CN": "简体中文",
		"zh-TW": "繁體中文",
		"zh-HK": "繁體中文（香港）",
		"ja-JP": "日本語",
		"ko-KR": "한국어",
		"es-ES": "Español",
		"th-TH": "ไทย",
		"vi-VN": "Tiếng Việt",
		"tr-TR": "Türkçe",
		"id-ID": "Bahasa Indonesia",
	};
	const getLanguageRecord = (value: unknown): Record<string, unknown> => {
		if (!value || Array.isArray(value) || typeof value !== "object") return {};
		return value as Record<string, unknown>;
	};
	const getLanguageConfigMap = (value: unknown) => {
		const record = getLanguageRecord(value);
		const result: Config["i18n"]["languageMap"] = {} as Config["i18n"]["languageMap"];
		const sourceLangs = Array.isArray(value)
			? value.map(validateLang)
			: Object.keys(record).length > 0
			? Object.keys(record).map(validateLang)
			: DEFAULT_CONFIG.i18n.languages;
		for (const lang of Array.from(new Set(sourceLangs))) {
			const raw = getLanguageRecord(record[lang]);
			result[lang] = {
				code: lang,
				label: getString(raw.label, defaultLanguageLabels[lang]),
				locale: getString(raw.locale, lang),
				direction: raw.direction === "rtl" || raw.direction === "auto" ? raw.direction : "ltr",
				weight: getNumber(raw.weight, DEFAULT_CONFIG.i18n.languageMap[lang]?.weight ?? 100),
				disabled: getBoolean(raw.disabled, false),
				contentDir: getString(
					raw.contentDir ?? raw["content-dir"],
					DEFAULT_CONFIG.i18n.languageMap[lang]?.contentDir ?? `src/content/posts/${lang}`,
				),
			};
		}
		return result;
	};
	const getEnabledLangsFromI18n = (value: unknown): typeof validLangs[number][] => {
		if (Array.isArray(value)) return validateLangArray(value);
		const map = getLanguageConfigMap(value);
		const languages = Object.values(map)
			.filter((item) => !item.disabled)
			.sort((a, b) => a.weight - b.weight || a.code.localeCompare(b.code))
			.map((item) => item.code);
		return languages.length > 0 ? languages : DEFAULT_CONFIG.i18n.languages;
	};

	// Helper: validate toc depth (1-3)
	const validateTocDepth = (value: unknown): 1 | 2 | 3 => {
		const num = getNumber(value, DEFAULT_CONFIG.site.toc.depth);
		if (num >= 1 && num <= 3) return num as 1 | 2 | 3;
		return DEFAULT_CONFIG.site.toc.depth;
	};

	const validateTocLayout = (value: unknown): "floating" | "sidebar" => {
		return value === "sidebar" ? "sidebar" : DEFAULT_CONFIG.site.toc.layout;
	};

	// Helper: validate banner position
	const validateBannerPosition = (value: unknown): "top" | "center" | "bottom" => {
		if (value === "top" || value === "center" || value === "bottom") {
			return value;
		}
		return DEFAULT_CONFIG.site.banner.position || "center";
	};

	const envUmamiId = getEnvString("PUBLIC_UMAMI_ID");
	const envPlausibleDomain = getEnvString("PUBLIC_PLAUSIBLE_DOMAIN");
	const envMatomoSiteId = getEnvString("PUBLIC_MATOMO_SITE_ID");
	const envMatomoSrc = getEnvString("PUBLIC_MATOMO_SRC");
	const languageMap = getLanguageConfigMap(i18n?.languages);
	const enabledLanguages = getEnabledLangsFromI18n(i18n?.languages);
	const validatePostSlugStrategy = (value: unknown): "file" | "crc32" => {
		if (value === "file" || value === "crc32") return value;
		return DEFAULT_CONFIG.posts.slugStrategy;
	};
	const validateSearchProvider = (value: unknown): Config["search"]["provider"] => {
		if (value === "pagefind" || value === "docsearch" || value === "google") return value;
		const legacyDocSearchEnabled =
			getBoolean(search?.docsearch?.enable, DEFAULT_CONFIG.search.docsearch.enable) &&
			!!getString(search?.docsearch?.appId, DEFAULT_CONFIG.search.docsearch.appId) &&
			!!getString(search?.docsearch?.apiKey, DEFAULT_CONFIG.search.docsearch.apiKey) &&
			!!getString(search?.docsearch?.indexName, DEFAULT_CONFIG.search.docsearch.indexName);
		return legacyDocSearchEnabled ? "docsearch" : DEFAULT_CONFIG.search.provider;
	};
	const validateGoogleSafeSearch = (value: unknown): Config["search"]["google"]["safeSearch"] => {
		return value === "off" ? "off" : DEFAULT_CONFIG.search.google.safeSearch;
	};
	const validateCommentsProvider = (value: unknown): Config["comments"]["provider"] => {
		if (value === "giscus" || value === "waline" || value === "twikoo") return value;
		return "none";
	};
	const validateSidebarWidgetType = (value: unknown): Config["sidebar"]["leftWidgets"][number]["type"] | undefined => {
		if (
			value === "profile" ||
			value === "toc" ||
			value === "categories" ||
			value === "tags" ||
			value === "announcement" ||
			value === "advertisement" ||
			value === "siteStats" ||
			value === "siteInfo" ||
			value === "calendar"
		) return value;
		return undefined;
	};
	const validateSidebarWidgetPosition = (value: unknown): Config["sidebar"]["leftWidgets"][number]["position"] => {
		return value === "top" ? "top" : "sticky";
	};
	const validateSidebarWidgets = (
		value: unknown,
		fallback: Config["sidebar"]["leftWidgets"],
	): Config["sidebar"]["leftWidgets"] => {
		if (!Array.isArray(value)) return fallback;
		const widgets = value.flatMap((item) => {
			if (!item || Array.isArray(item) || typeof item !== "object") return [];
			const raw = item as Record<string, unknown>;
			const type = validateSidebarWidgetType(raw.type);
			if (!type) return [];
			return [{
				type,
				enabled: getBoolean(raw.enabled, true),
				position: validateSidebarWidgetPosition(raw.position),
				showTitle: getBoolean(raw.showTitle, true),
				showOnPostPage: getBoolean(raw.showOnPostPage, true),
				showOnNonPostPage: getBoolean(raw.showOnNonPostPage, true),
			}];
		});
		return widgets.length > 0 ? widgets : fallback;
	};
	const validateSponsorMethods = (value: unknown): Config["sponsor"]["methods"] => {
		if (!Array.isArray(value)) return DEFAULT_CONFIG.sponsor.methods;
		return value.flatMap((item) => {
			if (!item || Array.isArray(item) || typeof item !== "object") return [];
			const raw = item as Record<string, unknown>;
			const name = getString(raw.name, "").trim();
			const url = getString(raw.url, "").trim();
			if (!name || !url) return [];
			return [{ name, url, description: getString(raw.description, "") }];
		});
	};
	const validateSupporters = (value: unknown): Config["sponsor"]["supporters"] => {
		if (!Array.isArray(value)) return DEFAULT_CONFIG.sponsor.supporters;
		return value.flatMap((item) => {
			if (!item || Array.isArray(item) || typeof item !== "object") return [];
			const raw = item as Record<string, unknown>;
			const name = getString(raw.name, "").trim();
			if (!name) return [];
			return [{
				name,
				amount: getString(raw.amount, ""),
				message: getString(raw.message, ""),
			}];
		});
	};
	const validateAdmonitionTheme = (value: unknown): Config["markdown"]["admonitions"]["theme"] => {
		if (value === "github" || value === "vitepress" || value === "obsidian") return value;
		return DEFAULT_CONFIG.markdown.admonitions.theme;
	};
	const validateLatestCount = (value: unknown): number => {
		const count = Math.trunc(getNumber(value, DEFAULT_CONFIG.landingPage.latestCount));
		if (count < 1) return DEFAULT_CONFIG.landingPage.latestCount;
		return Math.min(count, 12);
	};
	const normalizeApiBase = (value: string): string => {
		const trimmed = value.trim();
		if (!trimmed) return DEFAULT_CONFIG.githubCard.apiBase;
		return trimmed.replace(/\/+$/, "");
	};
	const validateGithubCardAdapterProvider = (value: unknown): Config["githubCard"]["adapter"]["provider"] => {
		if (value === "cloudflare" || value === "vercel" || value === "auto") return value;
		return DEFAULT_CONFIG.githubCard.adapter.provider;
	};
	const validateGithubCardAdapterRoute = (value: unknown): string => {
		const route = getString(value, DEFAULT_CONFIG.githubCard.adapter.route).trim().replace(/\/+$/, "");
		return /^\/[A-Za-z0-9_-]+$/.test(route) ? route : DEFAULT_CONFIG.githubCard.adapter.route;
	};
	const validateLandingFeatures = (value: unknown): Config["landingPage"]["features"] => {
		const fallback = DEFAULT_CONFIG.landingPage.features;

		if (typeof value !== "object" || value === null) {
			return fallback;
		}

		const rawFeatures = value as {
			enable?: unknown;
			items?: unknown;
		};
		const items = Array.isArray(rawFeatures.items)
			? rawFeatures.items.flatMap((item) => {
					if (typeof item !== "object" || item === null) return [];

					const rawItem = item as {
						icon?: unknown;
						title?: unknown;
						description?: unknown;
					};
					const title = getString(rawItem.title, "").trim();
					const description = getString(rawItem.description, "").trim();
					if (!title || !description) return [];

					return [
						{
							icon: getString(rawItem.icon, "material-symbols:star-outline-rounded").trim() || "material-symbols:star-outline-rounded",
							title,
							description,
						},
					];
				})
			: fallback.items;

		return {
			enable: getBoolean(rawFeatures.enable, fallback.enable),
			items: items.length > 0 ? items : fallback.items,
		};
	};
	const headCustomHtmlFile = getSnippetFileName(head?.customHtmlFile);
	const headCustomScriptFile = getSnippetFileName(head?.customScriptFile);
	const footerCustomHtmlFile = getSnippetFileName(footer?.customHtmlFile);
	const footerCustomScriptFile = getSnippetFileName(footer?.customScriptFile);

	// Build config with validation
	const config: Config = {
		site: {
			url: getEnvString("PUBLIC_SITE_URL", getString(site?.url, DEFAULT_CONFIG.site.url)),
			base: getEnvString("PUBLIC_SITE_BASE", getString(site?.base, DEFAULT_CONFIG.site.base)),
			title: getEnvString("PUBLIC_SITE_TITLE", getString(site?.title, DEFAULT_CONFIG.site.title)),
			subtitle: getEnvString("PUBLIC_SITE_SUBTITLE", getString(site?.subtitle, DEFAULT_CONFIG.site.subtitle)),
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
					enable: getEnvBoolean("PUBLIC_BANNER_CREDIT_ENABLE", getBoolean(site?.banner?.credit?.enable, DEFAULT_CONFIG.site.banner.credit.enable)),
					text: getEnvString("PUBLIC_BANNER_CREDIT_TEXT", getString(site?.banner?.credit?.text, DEFAULT_CONFIG.site.banner.credit.text)),
					url: getEnvString("PUBLIC_BANNER_CREDIT_URL", getString(site?.banner?.credit?.url, DEFAULT_CONFIG.site.banner.credit.url || "")),
				},
			},
			toc: {
				enable: getBoolean(site?.toc?.enable, DEFAULT_CONFIG.site.toc.enable),
				depth: validateTocDepth(site?.toc?.depth),
				layout: validateTocLayout(site?.toc?.layout),
			},
			favicon: validateFavicons(site?.favicon),
		},
		posts: {
			slugStrategy: validatePostSlugStrategy(toml.posts?.["slug-strategy"] ?? toml.posts?.slugStrategy),
		},
		navBar: {
			links: validateNavBarLinks(navBar?.links, DEFAULT_CONFIG.navBar.links),
		},
		profile: {
			avatar: getString(profile?.avatar, DEFAULT_CONFIG.profile.avatar || ""),
			avatarRounded: getBoolean(profile?.avatarRounded, DEFAULT_CONFIG.profile.avatarRounded || false),
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
		comments: {
			provider: validateCommentsProvider(comments?.provider),
			giscus: {
				repo: getString(comments?.giscus?.repo, DEFAULT_CONFIG.comments.giscus.repo),
				repoId: getString(comments?.giscus?.repoId, DEFAULT_CONFIG.comments.giscus.repoId),
				category: getString(comments?.giscus?.category, DEFAULT_CONFIG.comments.giscus.category),
				categoryId: getString(comments?.giscus?.categoryId, DEFAULT_CONFIG.comments.giscus.categoryId),
				mapping: getString(comments?.giscus?.mapping, DEFAULT_CONFIG.comments.giscus.mapping),
				lang: getString(comments?.giscus?.lang, DEFAULT_CONFIG.comments.giscus.lang),
			},
			waline: {
				serverUrl: getString(comments?.waline?.serverUrl, DEFAULT_CONFIG.comments.waline.serverUrl),
				lang: getString(comments?.waline?.lang, DEFAULT_CONFIG.comments.waline.lang),
			},
			twikoo: {
				envId: getString(comments?.twikoo?.envId, DEFAULT_CONFIG.comments.twikoo.envId),
				lang: getString(comments?.twikoo?.lang, DEFAULT_CONFIG.comments.twikoo.lang),
			},
		},
		sidebar: {
			enabled: getBoolean(sidebar?.enabled, DEFAULT_CONFIG.sidebar.enabled),
			position: "left",
			leftWidgets: validateSidebarWidgets(sidebar?.leftWidgets, DEFAULT_CONFIG.sidebar.leftWidgets),
			rightWidgets: validateSidebarWidgets(sidebar?.rightWidgets, DEFAULT_CONFIG.sidebar.rightWidgets),
			mobileWidgets: validateSidebarWidgets(sidebar?.mobileWidgets, DEFAULT_CONFIG.sidebar.mobileWidgets),
		},
		widgets: {
			announcement: {
				enabled: getBoolean(widgets?.announcement?.enabled, DEFAULT_CONFIG.widgets.announcement.enabled),
				id: getString(widgets?.announcement?.id, DEFAULT_CONFIG.widgets.announcement.id),
				title: getString(widgets?.announcement?.title, DEFAULT_CONFIG.widgets.announcement.title),
				content: getString(widgets?.announcement?.content, DEFAULT_CONFIG.widgets.announcement.content),
				linkText: getString(widgets?.announcement?.linkText, DEFAULT_CONFIG.widgets.announcement.linkText),
				linkUrl: getString(widgets?.announcement?.linkUrl, DEFAULT_CONFIG.widgets.announcement.linkUrl),
				closable: getBoolean(widgets?.announcement?.closable, DEFAULT_CONFIG.widgets.announcement.closable),
			},
			advertisement: {
				enabled: getBoolean(widgets?.advertisement?.enabled, DEFAULT_CONFIG.widgets.advertisement.enabled),
				id: getString(widgets?.advertisement?.id, DEFAULT_CONFIG.widgets.advertisement.id),
				title: getString(widgets?.advertisement?.title, DEFAULT_CONFIG.widgets.advertisement.title),
				content: getString(widgets?.advertisement?.content, DEFAULT_CONFIG.widgets.advertisement.content),
				imageSrc: getString(widgets?.advertisement?.imageSrc, DEFAULT_CONFIG.widgets.advertisement.imageSrc),
				imageAlt: getString(widgets?.advertisement?.imageAlt, DEFAULT_CONFIG.widgets.advertisement.imageAlt),
				linkText: getString(widgets?.advertisement?.linkText, DEFAULT_CONFIG.widgets.advertisement.linkText),
				linkUrl: getString(widgets?.advertisement?.linkUrl, DEFAULT_CONFIG.widgets.advertisement.linkUrl),
				expireDate: getString(widgets?.advertisement?.expireDate, DEFAULT_CONFIG.widgets.advertisement.expireDate),
				displayCount: getNumber(widgets?.advertisement?.displayCount, DEFAULT_CONFIG.widgets.advertisement.displayCount),
				closable: getBoolean(widgets?.advertisement?.closable, DEFAULT_CONFIG.widgets.advertisement.closable),
			},
			siteStats: {
				enabled: getBoolean(widgets?.siteStats?.enabled, DEFAULT_CONFIG.widgets.siteStats.enabled),
				siteStartDate: getString(widgets?.siteStats?.siteStartDate, DEFAULT_CONFIG.widgets.siteStats.siteStartDate),
			},
			siteInfo: {
				enabled: getBoolean(widgets?.siteInfo?.enabled, DEFAULT_CONFIG.widgets.siteInfo.enabled),
			},
			calendar: {
				enabled: getBoolean(widgets?.calendar?.enabled, DEFAULT_CONFIG.widgets.calendar.enabled),
				showHeatmap: getBoolean(widgets?.calendar?.showHeatmap, DEFAULT_CONFIG.widgets.calendar.showHeatmap),
			},
		},
		sponsor: {
			enabled: getBoolean(sponsor?.enabled, DEFAULT_CONFIG.sponsor.enabled),
			title: getString(sponsor?.title, DEFAULT_CONFIG.sponsor.title),
			description: getString(sponsor?.description, DEFAULT_CONFIG.sponsor.description),
			methods: validateSponsorMethods(sponsor?.methods),
			supporters: validateSupporters(sponsor?.supporters),
		},
		bangumi: {
			enabled: getBoolean(bangumi?.enabled, DEFAULT_CONFIG.bangumi.enabled),
			userId: getString(bangumi?.userId, DEFAULT_CONFIG.bangumi.userId),
			apiBase: getString(bangumi?.apiBase, DEFAULT_CONFIG.bangumi.apiBase).replace(/\/+$/, ""),
			mode: "dynamic",
			categoryOrder: getStringArray(bangumi?.categoryOrder, DEFAULT_CONFIG.bangumi.categoryOrder),
		},
		fonts: {
			enabled: getBoolean(fonts?.enabled, DEFAULT_CONFIG.fonts.enabled),
			links: getStringArray(fonts?.links, DEFAULT_CONFIG.fonts.links),
			fontFamily: getString(fonts?.fontFamily, DEFAULT_CONFIG.fonts.fontFamily),
		},
		coverImage: {
			lqip: getBoolean(coverImage?.lqip, DEFAULT_CONFIG.coverImage.lqip),
			fadeIn: getBoolean(coverImage?.fadeIn, DEFAULT_CONFIG.coverImage.fadeIn),
		},
		markdown: {
			plantuml: {
				enable: getBoolean(markdown?.plantuml?.enable, DEFAULT_CONFIG.markdown.plantuml.enable),
				server: getString(markdown?.plantuml?.server, DEFAULT_CONFIG.markdown.plantuml.server).replace(/\/+$/, ""),
				lightTheme: getString(markdown?.plantuml?.lightTheme, DEFAULT_CONFIG.markdown.plantuml.lightTheme),
				darkTheme: getString(markdown?.plantuml?.darkTheme, DEFAULT_CONFIG.markdown.plantuml.darkTheme),
			},
			admonitions: {
				theme: validateAdmonitionTheme(markdown?.admonitions?.theme),
			},
		},
		head: {
			verification: {
				google: getString(head?.verification?.google, DEFAULT_CONFIG.head.verification.google),
				bing: getString(head?.verification?.bing, DEFAULT_CONFIG.head.verification.bing),
				yandex: getString(head?.verification?.yandex, DEFAULT_CONFIG.head.verification.yandex),
				naver: getString(head?.verification?.naver, DEFAULT_CONFIG.head.verification.naver),
			},
			customHtml: combineTrustedSnippets(getString(head?.customHtml, DEFAULT_CONFIG.head.customHtml), headCustomHtmlFile),
			customHtmlFile: headCustomHtmlFile,
			customScript: combineTrustedSnippets(getString(head?.customScript, DEFAULT_CONFIG.head.customScript), headCustomScriptFile),
			customScriptFile: headCustomScriptFile,
		},
		footer: {
			customHtml: combineTrustedSnippets(getString(footer?.customHtml, DEFAULT_CONFIG.footer.customHtml), footerCustomHtmlFile),
			customHtmlFile: footerCustomHtmlFile,
			customScript: combineTrustedSnippets(getString(footer?.customScript, DEFAULT_CONFIG.footer.customScript), footerCustomScriptFile),
			customScriptFile: footerCustomScriptFile,
		},
		analytics: {
			enable: getEnvBoolean("PUBLIC_ANALYTICS_ENABLE", getBoolean(analytics?.enable, DEFAULT_CONFIG.analytics.enable || false)),
			googleAnalyticsId: getEnvString("PUBLIC_GOOGLE_ANALYTICS_ID", getString(analytics?.googleAnalyticsId, DEFAULT_CONFIG.analytics.googleAnalyticsId || "")),
			clarityProjectId: getEnvStringFromKeys(["PUBLIC_CLARITY_PROJECT_ID", "PUBLIC_CLARITY_ID"], getString(analytics?.clarityProjectId, DEFAULT_CONFIG.analytics.clarityProjectId || "")),
			fathomSiteId: getEnvString("PUBLIC_FATHOM_SITE_ID", getString(analytics?.fathomSiteId, DEFAULT_CONFIG.analytics.fathomSiteId || "")),
			simpleAnalyticsDomain: getEnvString("PUBLIC_SIMPLE_ANALYTICS_DOMAIN", getString(analytics?.simpleAnalyticsDomain, DEFAULT_CONFIG.analytics.simpleAnalyticsDomain || "")),
			amplitudeApiKey: getEnvString("PUBLIC_AMPLITUDE_API_KEY", getString(analytics?.amplitudeApiKey, DEFAULT_CONFIG.analytics.amplitudeApiKey || "")),
			umami: analytics?.umami?.id || envUmamiId ? {
				id: getEnvString("PUBLIC_UMAMI_ID", getString(analytics?.umami?.id, "")),
				src: getEnvString("PUBLIC_UMAMI_SRC", getString(analytics?.umami?.src, "")),
				integrity: getEnvString("PUBLIC_UMAMI_INTEGRITY", getString(analytics?.umami?.integrity, "")),
			} : DEFAULT_CONFIG.analytics.umami,
			plausible: analytics?.plausible?.domain || envPlausibleDomain ? {
				domain: getEnvString("PUBLIC_PLAUSIBLE_DOMAIN", getString(analytics?.plausible?.domain, "")),
				src: getEnvString("PUBLIC_PLAUSIBLE_SRC", getString(analytics?.plausible?.src, "")),
				integrity: getEnvString("PUBLIC_PLAUSIBLE_INTEGRITY", getString(analytics?.plausible?.integrity, "")),
			} : DEFAULT_CONFIG.analytics.plausible,
			matomo: (analytics?.matomo?.siteId && analytics?.matomo?.src) || (envMatomoSiteId && envMatomoSrc) ? {
				siteId: getEnvString("PUBLIC_MATOMO_SITE_ID", getString(analytics?.matomo?.siteId, "")),
				src: getEnvString("PUBLIC_MATOMO_SRC", getString(analytics?.matomo?.src, "")),
				integrity: getEnvString("PUBLIC_MATOMO_INTEGRITY", getString(analytics?.matomo?.integrity, "")),
			} : DEFAULT_CONFIG.analytics.matomo,
		},
		llms: {
			enable: getBoolean(llms?.enable, DEFAULT_CONFIG.llms.enable),
			sitemap: getBoolean(llms?.sitemap, DEFAULT_CONFIG.llms.sitemap || false),
			title: getString(llms?.title, DEFAULT_CONFIG.llms.title || ""),
			description: getString(llms?.description, DEFAULT_CONFIG.llms.description || ""),
			includePatterns: getStringArray(llms?.includePatterns, DEFAULT_CONFIG.llms.includePatterns || ["*"]),
			excludePatterns: getStringArray(llms?.excludePatterns, DEFAULT_CONFIG.llms.excludePatterns || []),
			i18n: getBoolean(llms?.i18n, DEFAULT_CONFIG.llms.i18n || false),
		},
		i18n: {
			enable: getBoolean(i18n?.enable, DEFAULT_CONFIG.i18n.enable),
			defaultLang: validateLang(i18n?.["default-language"] ?? i18n?.defaultLanguage ?? i18n?.defaultLang),
			defaultLangInSubdir: getBoolean(
				i18n?.["default-language-in-subdir"] ?? i18n?.defaultLangInSubdir,
				DEFAULT_CONFIG.i18n.defaultLangInSubdir,
			),
			disableDefaultLanguageRedirect: getBoolean(
				i18n?.["disable-default-language-redirect"] ?? i18n?.disableDefaultLanguageRedirect,
				DEFAULT_CONFIG.i18n.disableDefaultLanguageRedirect,
			),
			languages: enabledLanguages,
			languageMap,
			fallbackToDefault: getBoolean(i18n?.fallbackToDefault, DEFAULT_CONFIG.i18n.fallbackToDefault),
		},
		og: {
			defaultImage: getString(og?.defaultImage, DEFAULT_CONFIG.og.defaultImage),
		},
		seo: {
			indexNow: getEnvBoolean("PUBLIC_INDEXNOW_ENABLE", getBoolean(seo?.indexNow, DEFAULT_CONFIG.seo.indexNow || false)),
			indexNowKey: getEnvString("PUBLIC_INDEXNOW_KEY", getString(seo?.indexNowKey, DEFAULT_CONFIG.seo.indexNowKey || "")),
			google: {
				indexingApi: getBoolean(seo?.google?.indexingApi, DEFAULT_CONFIG.seo.google.indexingApi),
				serviceAccountJsonEnv: getString(
					seo?.google?.serviceAccountJsonEnv,
					DEFAULT_CONFIG.seo.google.serviceAccountJsonEnv,
				),
			},
		},
		search: {
			provider: validateSearchProvider(search?.provider),
			docsearch: {
				enable: getEnvBoolean("PUBLIC_DOCSEARCH_ENABLE", getBoolean(search?.docsearch?.enable, DEFAULT_CONFIG.search.docsearch.enable)),
				appId: getEnvString("PUBLIC_DOCSEARCH_APP_ID", getString(search?.docsearch?.appId, DEFAULT_CONFIG.search.docsearch.appId)),
				apiKey: getEnvString("PUBLIC_DOCSEARCH_API_KEY", getString(search?.docsearch?.apiKey, DEFAULT_CONFIG.search.docsearch.apiKey)),
				indexName: getEnvString("PUBLIC_DOCSEARCH_INDEX_NAME", getString(search?.docsearch?.indexName, DEFAULT_CONFIG.search.docsearch.indexName)),
				filterByLanguage: getEnvBoolean("PUBLIC_DOCSEARCH_FILTER_BY_LANGUAGE", getBoolean(search?.docsearch?.filterByLanguage, DEFAULT_CONFIG.search.docsearch.filterByLanguage)),
				metaTags: getStringRecord(search?.docsearch?.metaTags, DEFAULT_CONFIG.search.docsearch.metaTags),
			},
			google: {
				cx: getString(search?.google?.cx, DEFAULT_CONFIG.search.google.cx),
				adsense: getBoolean(search?.google?.adsense, DEFAULT_CONFIG.search.google.adsense),
				resultSetSize: getString(search?.google?.resultSetSize, DEFAULT_CONFIG.search.google.resultSetSize),
				safeSearch: validateGoogleSafeSearch(search?.google?.safeSearch),
			},
		},
		githubCard: {
			apiBase: normalizeApiBase(
				getEnvString(
					"PUBLIC_GITHUB_CARD_API_BASE",
					getString(githubCard?.apiBase, DEFAULT_CONFIG.githubCard.apiBase),
				),
			),
			adapter: {
				enabled: getBoolean(githubCard?.adapter?.enabled, DEFAULT_CONFIG.githubCard.adapter.enabled),
				provider: validateGithubCardAdapterProvider(githubCard?.adapter?.provider),
				route: validateGithubCardAdapterRoute(githubCard?.adapter?.route),
				serviceBinding: getString(
					githubCard?.adapter?.serviceBinding,
					DEFAULT_CONFIG.githubCard.adapter.serviceBinding,
				),
			},
		},
		landingPage: {
			enable: getBoolean(landingPage?.enable, DEFAULT_CONFIG.landingPage.enable),
			latestCount: validateLatestCount(landingPage?.latestCount),
			heroImage: getString(landingPage?.heroImage, DEFAULT_CONFIG.landingPage.heroImage),
			eyebrow: getString(landingPage?.eyebrow, DEFAULT_CONFIG.landingPage.eyebrow),
			title: getString(landingPage?.title, DEFAULT_CONFIG.landingPage.title),
			highlight: getString(landingPage?.highlight, DEFAULT_CONFIG.landingPage.highlight),
			description: getString(landingPage?.description, DEFAULT_CONFIG.landingPage.description),
			primaryCtaLabel: getString(landingPage?.primaryCtaLabel, DEFAULT_CONFIG.landingPage.primaryCtaLabel),
			secondaryCtaLabel: getString(landingPage?.secondaryCtaLabel, DEFAULT_CONFIG.landingPage.secondaryCtaLabel),
			features: validateLandingFeatures(landingPage?.features),
		},
			edge: {
				enabled: getBoolean(edge?.enabled, DEFAULT_CONFIG.edge.enabled),
				apiBase: getString(edge?.apiBase, DEFAULT_CONFIG.edge.apiBase),
				features: {
					githubCard: { enabled: getBoolean(edge?.features?.githubCard?.enabled, DEFAULT_CONFIG.edge.features.githubCard.enabled) },
					avatarProxy: { enabled: getBoolean(edge?.features?.avatarProxy?.enabled, DEFAULT_CONFIG.edge.features.avatarProxy.enabled) },
					bangumiApiProxy: { enabled: getBoolean(edge?.features?.bangumiApiProxy?.enabled, DEFAULT_CONFIG.edge.features.bangumiApiProxy.enabled) },
					bangumiImageProxy: { enabled: getBoolean(edge?.features?.bangumiImageProxy?.enabled, DEFAULT_CONFIG.edge.features.bangumiImageProxy.enabled) },
				},
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
		umamiIntegrity: getEnvString(
			"PUBLIC_UMAMI_INTEGRITY",
			getString(analytics?.umami?.integrity, DEFAULT_ENV_CONFIG.umamiIntegrity),
		),
		plausibleDomain: getEnvString(
			"PUBLIC_PLAUSIBLE_DOMAIN",
			getString(analytics?.plausible?.domain, DEFAULT_ENV_CONFIG.plausibleDomain),
		),
		plausibleSrc: getEnvString(
			"PUBLIC_PLAUSIBLE_SRC",
			getString(analytics?.plausible?.src, DEFAULT_ENV_CONFIG.plausibleSrc),
		),
		plausibleIntegrity: getEnvString(
			"PUBLIC_PLAUSIBLE_INTEGRITY",
			getString(analytics?.plausible?.integrity, DEFAULT_ENV_CONFIG.plausibleIntegrity),
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
		matomoIntegrity: getEnvString(
			"PUBLIC_MATOMO_INTEGRITY",
			getString(analytics?.matomo?.integrity, DEFAULT_ENV_CONFIG.matomoIntegrity),
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
