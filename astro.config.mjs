import sitemap from "@astrojs/sitemap";
import svelte from "@astrojs/svelte";
import tailwindcss from "@tailwindcss/vite";
import { pluginCollapsibleSections } from "@expressive-code/plugin-collapsible-sections";
import { pluginLineNumbers } from "@expressive-code/plugin-line-numbers";
// @swup/astro removed, using Astro's native ClientRouter with Swup as dynamic fallback
// See src/utils/transition-manager.ts for the unified transition system
import expressiveCode from "astro-expressive-code";
import icon from "astro-icon";
import { defineConfig } from "astro/config";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import { fileURLToPath } from "url";
import rehypeComponents from "rehype-components"; /* Render the custom directive content */
import rehypeKatex from "rehype-katex";
import rehypeSlug from "rehype-slug";
import remarkDirective from "remark-directive"; /* Handle directives */
import remarkGithubAdmonitionsToDirectives from "remark-github-admonitions-to-directives";
import remarkMath from "remark-math";
import remarkSectionize from "remark-sectionize";
import { expressiveCodeConfig } from "./src/config.ts";
import { pluginLanguageBadge } from "./src/plugins/expressive-code/language-badge.ts";
import { AdmonitionComponent } from "./src/plugins/rehype-component-admonition.mjs";
import { GithubCardComponent } from "./src/plugins/rehype-component-github-card.mjs";
import { parseDirectiveNode } from "./src/plugins/remark-directive-rehype.js";
import { remarkExcerpt } from "./src/plugins/remark-excerpt.js";
import { remarkReadingTime } from "./src/plugins/remark-reading-time.mjs";
import { pluginCustomCopyButton } from "./src/plugins/expressive-code/custom-copy-button.js";
import { rehypeLazyLoadImage } from "./src/plugins/rehype-lazy-load-image.mjs";

// https://astro.build/config
export default defineConfig({
	site: "https://markd3ng.github.io",
	base: "/KIRARI",
	trailingSlash: "always",
	build: {
		inlineStylesheets: 'auto',
	},
	integrations: [
		// Swup integration removed, using Astro's native ClientRouter
		// with dynamic Swup fallback for browsers without View Transitions API
		icon({
			include: {
				"material-symbols": [
					"keyboard-arrow-up-rounded",
					"home-outline-rounded",
					"palette-outline",
					"menu-rounded",
					"calendar-today-outline-rounded",
					"edit-calendar-outline-rounded",
					"book-2-outline-rounded",
					"tag-rounded",
					"chevron-right-rounded",
					"chevron-left-rounded",
					"more-horiz",
					"copyright-outline-rounded",
					"notes-rounded",
					"schedule-outline-rounded",
					"search",
					"wb-sunny-outline-rounded",
					"dark-mode-outline-rounded",
					"radio-button-partial-outline"
				],
				"fa6-brands": [
					"creative-commons"
				],
				"fa6-regular": [
					"address-card"
				],
				"fa6-solid": [
					"arrow-up-right-from-square",
					"arrow-rotate-left",
					"chevron-right"
				],
			},
		}),
		expressiveCode({
			// themes: [expressiveCodeConfig.theme, expressiveCodeConfig.theme],
			themes: expressiveCodeConfig.themes,
			plugins: [
				pluginCollapsibleSections(),
				pluginLineNumbers(),
				pluginLanguageBadge(),
				pluginCustomCopyButton()
			],
			defaultProps: {
				wrap: true,
				overridesByLang: {
					'shellsession': {
						showLineNumbers: false,
					},
				},
			},
			styleOverrides: {
				codeBackground: "var(--codeblock-bg)",
				borderRadius: "0.75rem",
				borderColor: "none",
				codeFontSize: "0.875rem",
				codeFontFamily: "'JetBrains Mono Variable', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
				codeLineHeight: "1.5rem",
				frames: {
					editorBackground: "var(--codeblock-bg)",
					terminalBackground: "var(--codeblock-bg)",
					terminalTitlebarBackground: "var(--codeblock-topbar-bg)",
					editorTabBarBackground: "var(--codeblock-topbar-bg)",
					editorActiveTabBackground: "none",
					editorActiveTabIndicatorBottomColor: "var(--primary)",
					editorActiveTabIndicatorTopColor: "none",
					editorTabBarBorderBottomColor: "var(--codeblock-topbar-bg)",
					terminalTitlebarBorderBottomColor: "none"
				},
				textMarkers: {
					delHue: 0,
					insHue: 180,
					markHue: 250
				}
			},
			frames: {
				showCopyToClipboardButton: false,
			}
		}),
		svelte(),
		sitemap(),
	],
	markdown: {
		remarkPlugins: [
			remarkMath,
			remarkReadingTime,
			remarkExcerpt,
			remarkGithubAdmonitionsToDirectives,
			remarkDirective,
			remarkSectionize,
			parseDirectiveNode,
		],
		rehypePlugins: [
			rehypeKatex,
			rehypeSlug,
			rehypeLazyLoadImage,
			[
				rehypeComponents,
				{
					components: {
						github: GithubCardComponent,
						note: (x, y) => AdmonitionComponent(x, y, "note"),
						tip: (x, y) => AdmonitionComponent(x, y, "tip"),
						important: (x, y) => AdmonitionComponent(x, y, "important"),
						caution: (x, y) => AdmonitionComponent(x, y, "caution"),
						warning: (x, y) => AdmonitionComponent(x, y, "warning"),
					},
				},
			],
			[
				rehypeAutolinkHeadings,
				{
					behavior: "append",
					properties: {
						className: ["anchor"],
					},
					content: {
						type: "element",
						tagName: "span",
						properties: {
							className: ["anchor-icon"],
							"data-pagefind-ignore": true,
						},
						children: [
							{
								type: "text",
								value: "#",
							},
						],
					},
				},
			],
		],
	},
	vite: {
		plugins: [
			tailwindcss(),
			{
				name: 'block-iconify-json-imports',
				enforce: 'pre', // Run before vite:json plugin
				load(id) {
					// Block ALL @iconify-json imports since manual addIcon() is used in preload-icons.ts
					// This prevents bundling large JSON files and forces dynamic icons to use CDN
					if (id.includes('@iconify-json')) {
						if (id.endsWith('/icons.json')) {
							return JSON.stringify({
								prefix: "",
								icons: {},
								width: 24,
								height: 24
							});
						}
						if (id.endsWith('/info.json')) {
							return JSON.stringify({
								name: "",
								total: 0,
								version: "1.0.0"
							});
						}
					}
				}
			}
		],
		build: {
			minify: 'esbuild',
			cssCodeSplit: true,
			rollupOptions: {
				onwarn(warning, warn) {
					// temporarily suppress this warning
					if (
						warning.message.includes("is dynamically imported by") &&
						warning.message.includes("but also statically imported by")
					) {
						return;
					}
					warn(warning);
				},
			},
			// Enable aggressive tree-shaking
			target: 'esnext',
		},
		optimizeDeps: {
			exclude: [
				'@iconify-json/material-symbols',
				'@iconify-json/fa6-brands',
				'@iconify-json/fa6-regular',
				'@iconify-json/fa6-solid'
			]
		},
	},
});