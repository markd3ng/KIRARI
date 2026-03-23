import { LinkPreset } from "./types/config";

// Environment variables with fallback defaults
// Create .env.local file to override these values locally
// Note: Use both process.env (for astro.config.mjs / Node.js context) 
// and import.meta.env (for Astro runtime) to ensure env vars work in all contexts
const env = {
	// Site configuration
	siteUrl:
		(typeof process !== "undefined" && process.env?.PUBLIC_SITE_URL) ||
		(typeof import.meta !== "undefined" && import.meta.env?.PUBLIC_SITE_URL) ||
		"https://kirari-main.vercel.app",
	siteTitle:
		(typeof process !== "undefined" && process.env?.PUBLIC_SITE_TITLE) ||
		(typeof import.meta !== "undefined" && import.meta.env?.PUBLIC_SITE_TITLE) ||
		"KIRARI",
	siteSubtitle:
		(typeof process !== "undefined" && process.env?.PUBLIC_SITE_SUBTITLE) ||
		(typeof import.meta !== "undefined" && import.meta.env?.PUBLIC_SITE_SUBTITLE) ||
		"Demo Site",
	// Banner credit configuration
	bannerCreditEnable:
		(typeof process !== "undefined" && process.env?.PUBLIC_BANNER_CREDIT_ENABLE === "true") ||
		(typeof import.meta !== "undefined" && import.meta.env?.PUBLIC_BANNER_CREDIT_ENABLE === "true") ||
		false,
	bannerCreditText:
		(typeof process !== "undefined" && process.env?.PUBLIC_BANNER_CREDIT_TEXT) ||
		(typeof import.meta !== "undefined" && import.meta.env?.PUBLIC_BANNER_CREDIT_TEXT) ||
		"",
	bannerCreditUrl:
		(typeof process !== "undefined" && process.env?.PUBLIC_BANNER_CREDIT_URL) ||
		(typeof import.meta !== "undefined" && import.meta.env?.PUBLIC_BANNER_CREDIT_URL) ||
		"",
	// Analytics
	clarityProjectId:
		(typeof process !== "undefined" && process.env?.PUBLIC_CLARITY_PROJECT_ID) ||
		(typeof import.meta !== "undefined" && import.meta.env?.PUBLIC_CLARITY_PROJECT_ID) ||
		"",
	// IndexNow
	indexNowKey:
		(typeof process !== "undefined" && process.env?.PUBLIC_INDEXNOW_KEY) ||
		(typeof import.meta !== "undefined" && import.meta.env?.PUBLIC_INDEXNOW_KEY) ||
		"a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6",
};

export const Config = {
	site: {
		url: env.siteUrl, // Your site's URL. Used for sitemap and SEO.
		base: "/", // The base path of your site. Useful if you are hosting your site in a subdirectory.
		title: env.siteTitle, // The title of your site.
		subtitle: env.siteSubtitle, // The subtitle of your site.
		lang: "en", // Language code, e.g. 'en', 'zh_CN', 'ja', etc.
		themeColor: {
			hue: 250, // Default hue for the theme color, from 0 to 360. e.g. red: 0, teal: 200, cyan: 250, pink: 345
			fixed: false, // Hide the theme color picker for visitors
		},
		banner: {
			enable: true,
			src: "assets/images/demo-banner.png", // Relative to the /src directory. Relative to the /public directory if it starts with '/'
			position: "center", // Equivalent to object-position, only supports 'top', 'center', 'bottom'. 'center' by default
			credit: {
				enable: env.bannerCreditEnable, // Display the credit text of the banner image
				text: env.bannerCreditText, // Credit text to be displayed
				url: env.bannerCreditUrl, // (Optional) URL link to the original artwork or artist's page
			},
		},
		toc: {
			enable: true, // Display the table of contents on the right side of the post
			depth: 3, // Maximum heading depth to show in the table, from 1 to 3
		},
		favicon: [
			// Leave this array empty to use the default favicon
			// {
			//   src: '/favicon/icon.png',    // Path of the favicon, relative to the /public directory
			//   theme: 'light',              // (Optional) Either 'light' or 'dark', set only if you have different favicons for light and dark mode
			//   sizes: '32x32',              // (Optional) Size of the favicon, set only if you have favicons of different sizes
			// }
		],
	},
	navBar: {
		links: [
			LinkPreset.Home,
			LinkPreset.Archive,
			LinkPreset.About,
			LinkPreset.Friends,
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
		themes: ["github-dark", "github-dark-dimmed"],
	},

	mermaid: {
		enable: true, // Enable Mermaid diagram rendering (requires per-post `mermaid: true` in frontmatter)
	},
	head: {
		verification: {
			google: "", // Google Search Console verification code
			bing: "", // Bing Webmaster Tools verification code
			yandex: "", // Yandex Webmaster verification code
			naver: "", // Naver Search Advisor verification code
		},
		customHtml: "", // Custom HTML injected into <head> (external CSS/JS, custom meta tags, etc.)
		customScript: "", // Custom JS content (no <script> tags) - auto-offloaded to Web Worker via Partytown
	},
	footer: {
		customHtml: "", // Custom HTML rendered in footer (ICP filing, public security filing, badges, etc.)
		customScript: "", // Custom JS content (no <script> tags) - auto-offloaded to Web Worker via Partytown
	},
	analytics: {
		clarityProjectId: env.clarityProjectId,
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
		indexNow: false, // Enable IndexNow integration for instant search engine indexing
		indexNowKey: env.indexNowKey,
	},

};
