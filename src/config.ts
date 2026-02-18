import { Config } from "./constants";
import type {
	ExpressiveCodeConfig,
	LicenseConfig,
	LLMsConfig,
	MermaidConfig,
	NavBarConfig,
	ProfileConfig,
	SiteConfig,
} from "./types/config";

// Export individual configs for backward compatibility with the theme
// Site configuration
export const siteConfig: SiteConfig = Config.site as SiteConfig;

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

// Tag mapping (slug -> display name)
export const tagMapping: Record<string, string> = Config.mappings.tags;

// Category mapping (slug -> display name)
export const categoryMapping: Record<string, string> =
	Config.mappings.categories;

export const llmsConfig: LLMsConfig = Config.llms as LLMsConfig;
