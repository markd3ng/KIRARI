import { Config } from "./constants";
import type {
	AnalyticsConfig,
	ExpressiveCodeConfig,
	FooterConfig,
	HeadConfig,
	I18nConfig,
	LandingPageConfig,

	LicenseConfig,
	LLMsConfig,
	MermaidConfig,
	NavBarConfig,
	PostsConfig,
	ProfileConfig,
	SearchConfig,
	SiteConfig,
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

// Head configuration
export const headConfig: HeadConfig = Config.head as HeadConfig;

// Footer configuration
export const footerConfig: FooterConfig = Config.footer as FooterConfig;

export const analyticsConfig: AnalyticsConfig =
	Config.analytics as AnalyticsConfig;

export const llmsConfig: LLMsConfig = Config.llms as LLMsConfig;

export const i18nConfig: I18nConfig = Config.i18n as I18nConfig;

export const searchConfig: SearchConfig = Config.search as SearchConfig;

export const landingPageConfig: LandingPageConfig =
	Config.landingPage as LandingPageConfig;
