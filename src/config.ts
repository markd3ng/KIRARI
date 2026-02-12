import type {
	ExpressiveCodeConfig,
	LicenseConfig,
	NavBarConfig,
	ProfileConfig,
	SiteConfig,
} from "./types/config";
import { LinkPreset } from "./types/config";

// Unified Configuration Object
// You can use this object to manage all site settings in one place.
const Config = {
	site: {
		title: "Fuwari",
		subtitle: "Demo Site",
		lang: "en", // Language code, e.g. 'en', 'zh_CN', 'ja', etc.
		themeColor: {
			hue: 250, // Default hue for the theme color, from 0 to 360. e.g. red: 0, teal: 200, cyan: 250, pink: 345
			fixed: false, // Hide the theme color picker for visitors
		},
		banner: {
			enable: false,
			src: "assets/images/demo-banner.png", // Relative to the /src directory. Relative to the /public directory if it starts with '/'
			position: "center", // Equivalent to object-position, only supports 'top', 'center', 'bottom'. 'center' by default
			credit: {
				enable: false, // Display the credit text of the banner image
				text: "", // Credit text to be displayed
				url: "", // (Optional) URL link to the original artwork or artist's page
			},
		},
		toc: {
			enable: true, // Display the table of contents on the right side of the post
			depth: 2, // Maximum heading depth to show in the table, from 1 to 3
		},
		favicon: [
			// Leave this array empty to use the default favicon
			// {
			//   src: '/favicon/icon.png',    // Path of the favicon, relative to the /public directory
			//   theme: 'light',              // (Optional) Either 'light' or 'dark', set only if you have different favicons for light and dark mode
			//   sizes: '32x32',              // (Optional) Size of the favicon, set only if you have favicons of different sizes
			// }
		] as SiteConfig["favicon"],
	},
	navBar: {
		links: [
			LinkPreset.Home,
			LinkPreset.Archive,
			LinkPreset.About,
			{
				name: "GitHub",
				url: "https://github.com/saicaca/fuwari", // Internal links should not include the base path, as it is automatically added
				external: true, // Show an external link icon and will open in a new tab
			},
		],
	},
	profile: {
		avatar: "assets/images/demo-avatar.png", // Relative to the /src directory. Relative to the /public directory if it starts with '/'
		name: "Lorem Ipsum",
		bio: "Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
		links: [
			{
				name: "Twitter",
				icon: "fa6-brands:twitter", // Visit https://icones.js.org/ for icon codes
				// You will need to install the corresponding icon set if it's not already included
				// `pnpm add @iconify-json/<icon-set-name>`
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
		// Note: Some styles (such as background color) are being overridden, see the astro.config.mjs file.
		// Please select a dark theme, as this blog theme currently only supports dark background color
		// theme: "github-dark",
		themes: ["github-dark", "github-dark-dimmed"],
	},
	mappings: {
		tags: {
			demo: "演示",
			example: "示例",
			tutorial: "教程",
		} as Record<string, string>,
		categories: {
			examples: "示例",
			guides: "指南",
		} as Record<string, string>,
	},
};

// Export individual configs for backward compatibility with the theme
// Site configuration
export const siteConfig: SiteConfig = Config.site as SiteConfig;

// Navigation bar configuration
export const navBarConfig: NavBarConfig = Config.navBar;

// Profile configuration
export const profileConfig: ProfileConfig = Config.profile;

// License configuration
export const licenseConfig: LicenseConfig = Config.license;

// Expressive Code configuration
export const expressiveCodeConfig: ExpressiveCodeConfig = Config.expressiveCode;

// Tag mapping (slug -> display name)
export const tagMapping: Record<string, string> = Config.mappings.tags;

// Category mapping (slug -> display name)
export const categoryMapping: Record<string, string> =
	Config.mappings.categories;
