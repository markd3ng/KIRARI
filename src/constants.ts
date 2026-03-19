import { LinkPreset } from "./types/config";

export const Config = {
	site: {
		url: "https://kirari-psi.vercel.app", // Your site's URL. Used for sitemap and SEO.
		base: "/", // The base path of your site. Useful if you are hosting your site in a subdirectory.
		title: "KIRARI", // The title of your site.
		subtitle: "Demo Site", // The subtitle of your site.
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
				enable: true, // Display the credit text of the banner image
				text: "TEST", // Credit text to be displayed
				url: "https://google.com", // (Optional) URL link to the original artwork or artist's page
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
		customScript: "", // Custom inline JS injected into <head> (third-party SDK, early init scripts, etc.)
	},
	footer: {
		customHtml: "", // Custom HTML rendered in footer (ICP filing, public security filing, badges, etc.)
		customScript: `<script type="text/javascript">
    (function(c,l,a,r,i,t,y){
        c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
        t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
        y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
    })(window, document, "clarity", "script", "vxldercjz3");
</script>`, // Custom inline JS injected in footer (analytics: Umami / Plausible / GA, etc.)
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

};
