import { Config } from "./constants";
import type {
	AnalyticsConfig,
	CommentsConfig,
	CoverImageConfig,
	DevicesConfig,
	ExpressiveCodeConfig,
	FooterConfig,
	FontsConfig,
	HeadConfig,
	I18nConfig,
	LandingPageConfig,

	LicenseConfig,
	LLMsConfig,
	MermaidConfig,
	MarkdownConfig,
	NavBarConfig,
	PostsConfig,
	ProfileConfig,
	SearchConfig,
	SidebarConfig,
	SiteConfig,
	SponsorConfig,
	BangumiConfig,
	WidgetsConfig,
} from "./types/config";

// Export individual configs for backward compatibility with the theme
// Site configuration
export const siteConfig: SiteConfig = Config.site as SiteConfig;

export const postsConfig: PostsConfig = Config.posts as PostsConfig;

// Navigation bar configuration
export const navBarConfig: NavBarConfig = Config.navBar as NavBarConfig;

// Profile configuration
export const profileConfig: ProfileConfig = Config.profile as ProfileConfig;

// License configuration
export const licenseConfig: LicenseConfig = Config.license as LicenseConfig;

// Expressive Code configuration
export const expressiveCodeConfig: ExpressiveCodeConfig =
	Config.expressiveCode as ExpressiveCodeConfig;

// Mermaid configuration
export const mermaidConfig: MermaidConfig = Config.mermaid as MermaidConfig;

export const commentsConfig: CommentsConfig = Config.comments as CommentsConfig;

export const fontsConfig: FontsConfig = Config.fonts as FontsConfig;

export const coverImageConfig: CoverImageConfig =
	Config.coverImage as CoverImageConfig;

export const markdownConfig: MarkdownConfig = Config.markdown as MarkdownConfig;

export const sidebarConfig: SidebarConfig = Config.sidebar as SidebarConfig;

export const widgetsConfig: WidgetsConfig = Config.widgets as WidgetsConfig;

export const sponsorConfig: SponsorConfig = Config.sponsor as SponsorConfig;

export const bangumiConfig: BangumiConfig = Config.bangumi as BangumiConfig;

// Head configuration
export const headConfig: HeadConfig = Config.head as HeadConfig;

// Footer configuration
export const footerConfig: FooterConfig = Config.footer as FooterConfig;

export const analyticsConfig: AnalyticsConfig =
	Config.analytics as AnalyticsConfig;

export const llmsConfig: LLMsConfig = Config.llms as LLMsConfig;

export const i18nConfig: I18nConfig = Config.i18n as I18nConfig;

export const searchConfig: SearchConfig = Config.search as SearchConfig;

export const landingPageConfig: LandingPageConfig = Config.landingPage as LandingPageConfig;
export const devicesConfig: DevicesConfig = Config.devices as DevicesConfig;
