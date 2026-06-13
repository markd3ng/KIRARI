import { readFileSync } from "node:fs";

const checks = [];

function readOptional(path) {
	try {
		return readFileSync(new URL(path, import.meta.url), "utf8");
	} catch {
		return "";
	}
}

function addCheck(name, passed, detail) {
	checks.push({ name, passed, detail });
}

const configLoader = readFileSync(new URL("../src/utils/config-loader.ts", import.meta.url), "utf8");
const configTypes = readFileSync(new URL("../src/types/config.ts", import.meta.url), "utf8");
const kirariConfig = readFileSync(new URL("../kirari.config.toml", import.meta.url), "utf8");
const markdownCss = readFileSync(new URL("../src/styles/markdown.css", import.meta.url), "utf8");
const layout = readFileSync(new URL("../src/layouts/Layout.astro", import.meta.url), "utf8");
const mainGridLayout = readFileSync(new URL("../src/layouts/MainGridLayout.astro", import.meta.url), "utf8");
const sidebarWidget = readFileSync(new URL("../src/components/widget/SideBar.astro", import.meta.url), "utf8");
const tocWidget = readFileSync(new URL("../src/components/widget/TOC.astro", import.meta.url), "utf8");
const i18nKey = readFileSync(new URL("../src/i18n/i18nKey.ts", import.meta.url), "utf8");
const contentUtils = readFileSync(new URL("../src/utils/content-utils.ts", import.meta.url), "utf8");
const categoryPage = readOptional("../src/pages/categories/[...category].astro");
const localizedCategoryPage = readOptional("../src/pages/[lang]/categories/[...category].astro");
const profileWidget = readFileSync(new URL("../src/components/widget/Profile.astro", import.meta.url), "utf8");
const creditsDoc = readOptional("../CREDITS.md");
const readme = readOptional("../README.md");
const readmeCn = readOptional("../README_CN.md");
const searchPage = readOptional("../src/pages/search.astro");
const localizedSearchPage = readOptional("../src/pages/[lang]/search.astro");
const guestbookPage = readOptional("../src/pages/guestbook.astro");
const sponsorPage = readOptional("../src/pages/sponsor.astro");
const bangumiPage = readOptional("../src/pages/bangumi.astro");
const sidebarRegistry = readOptional("../src/components/widget/sidebar-registry.ts");
const announcementWidget = readOptional("../src/components/widget/Announcement.astro");
const advertisementWidget = readOptional("../src/components/widget/Advertisement.astro");
const siteStatsWidget = readOptional("../src/components/widget/SiteStats.astro");
const siteInfoWidget = readOptional("../src/components/widget/SiteInfo.astro");
const calendarWidget = readOptional("../src/components/widget/Calendar.astro");
const commentsWidget = readOptional("../src/components/comments/Comments.astro");
const plantumlPlugin = readOptional("../src/plugins/remark-plantuml.js") + readOptional("../src/plugins/rehype-plantuml.mjs");

const llmsTypeBlock = configLoader.match(/llms\?: \{[\s\S]*?\n\t\t\};/)?.[0] || "";
addCheck(
	"TomlConfig llms declares includePatterns",
	/includePatterns\?: unknown/.test(llmsTypeBlock),
	"src/utils/config-loader.ts TomlConfig.llms must include includePatterns?: unknown",
);
addCheck(
	"TomlConfig llms declares excludePatterns",
	/excludePatterns\?: unknown/.test(llmsTypeBlock),
	"src/utils/config-loader.ts TomlConfig.llms must include excludePatterns?: unknown",
);

addCheck(
	"sectionized markdown tables use content-visibility",
	/section\s*>\s*\.markdown-table-wrapper/.test(markdownCss),
	"src/styles/markdown.css must target section > .markdown-table-wrapper",
);
addCheck(
	"cv-force-visible covers sectionized markdown tables",
	/&\.cv-force-visible[\s\S]*section\s*>\s*\.markdown-table-wrapper/.test(markdownCss),
	"src/styles/markdown.css .cv-force-visible must cover section > .markdown-table-wrapper",
);

addCheck(
	"navbar scroll logic tracks previous scroll position",
	/lastScrollTop/.test(layout) && /scrollTop\s*<\s*lastScrollTop/.test(layout),
	"src/layouts/Layout.astro scrollFunction must show navbar when scrolling up",
);

const tomlProfileBlock = configLoader.match(/profile\?: \{[\s\S]*?\n\t\};/)?.[0] || "";
const defaultProfileBlock = configLoader.match(/profile: \{[\s\S]*?\n\t\},/)?.[0] || "";
const profileConfigBlock = kirariConfig.match(/\[profile\][\s\S]*?(?=\n\[|\n# License Configuration)/)?.[0] || "";
const profileTypeBlock = configTypes.match(/export type ProfileConfig = \{[\s\S]*?\n\};/)?.[0] || "";

addCheck(
	"profile config documents avatarRounded",
	/avatarRounded\s*=\s*false/.test(profileConfigBlock) && /Round avatar/.test(profileConfigBlock) && /圆形头像/.test(profileConfigBlock),
	"kirari.config.toml [profile] must document avatarRounded with bilingual comments",
);
addCheck(
	"ProfileConfig declares avatarRounded",
	/avatarRounded\?: boolean/.test(profileTypeBlock),
	"src/types/config.ts ProfileConfig must include avatarRounded?: boolean",
);
addCheck(
	"TomlConfig profile declares avatarRounded",
	/avatarRounded\?: unknown/.test(tomlProfileBlock),
	"src/utils/config-loader.ts TomlConfig.profile must include avatarRounded?: unknown",
);
addCheck(
	"default profile keeps avatarRounded disabled",
	/avatarRounded:\s*false/.test(defaultProfileBlock),
	"src/utils/config-loader.ts DEFAULT_CONFIG.profile must set avatarRounded: false",
);
addCheck(
	"profile loader parses avatarRounded as boolean",
	/avatarRounded:\s*getBoolean\(profile\?\.avatarRounded,\s*DEFAULT_CONFIG\.profile\.avatarRounded\s*\|\|\s*false\)/.test(configLoader),
	"src/utils/config-loader.ts must parse profile.avatarRounded with getBoolean",
);
addCheck(
	"profile widget switches rounded avatar classes",
	/avatarRounded/.test(profileWidget) && /rounded-full/.test(profileWidget) && /object-cover/.test(profileWidget),
	"src/components/widget/Profile.astro must use avatarRounded to apply rounded-full and object-cover",
);

const tocTypeBlock = configTypes.match(/toc: \{[\s\S]*?\n\t\};/)?.[0] || "";
const tomlTocBlock = configLoader.match(/toc\?: \{[\s\S]*?\n\t\t\};/)?.[0] || "";
const defaultTocBlock = configLoader.match(/toc: \{[\s\S]*?\n\t\t\},/)?.[0] || "";
const tocConfigBlock = kirariConfig.match(/\[site\.toc\][\s\S]*?(?=\n\[|\n# Favicon Configuration)/)?.[0] || "";

addCheck(
	"TOC config documents floating layout",
	/layout\s*=\s*"floating"/.test(tocConfigBlock) && /floating/.test(tocConfigBlock) && /sidebar/.test(tocConfigBlock),
	"kirari.config.toml [site.toc] must document layout = \"floating\" with floating/sidebar options",
);
addCheck(
	"SiteConfig toc declares layout union",
	/layout:\s*"floating"\s*\|\s*"sidebar"/.test(tocTypeBlock),
	"src/types/config.ts SiteConfig.toc must include layout: \"floating\" | \"sidebar\"",
);
addCheck(
	"TomlConfig toc declares layout",
	/layout\?: unknown/.test(tomlTocBlock),
	"src/utils/config-loader.ts TomlConfig.site.toc must include layout?: unknown",
);
addCheck(
	"default TOC layout stays floating",
	/layout:\s*"floating"/.test(defaultTocBlock),
	"src/utils/config-loader.ts DEFAULT_CONFIG.site.toc must set layout: \"floating\"",
);
addCheck(
	"TOC loader validates layout",
	/validateTocLayout/.test(configLoader) && /layout:\s*validateTocLayout\(site\?\.toc\?\.layout\)/.test(configLoader),
	"src/utils/config-loader.ts must validate site.toc.layout",
);
addCheck(
	"floating TOC only renders for floating layout",
	/useFloatingToc\s*=\s*siteConfig\.toc\.enable\s*&&\s*toc\s*&&\s*tocLayout\s*===\s*"floating"/.test(mainGridLayout) &&
		/<TOC[^>]+layout="floating"/.test(mainGridLayout),
	"src/layouts/MainGridLayout.astro must gate right-side TOC on toc=true and layout=\"floating\"",
);
addCheck(
	"sidebar TOC renders in sidebar layout",
	/useSidebarToc\s*=\s*siteConfig\.toc\.enable\s*&&\s*toc\s*&&\s*tocLayout\s*===\s*"sidebar"/.test(mainGridLayout) &&
		/<SideBar[^>]+toc=\{useSidebarToc\}/.test(mainGridLayout) &&
		/toc\s*&&\s*tocLayout\s*===\s*"sidebar"/.test(sidebarWidget) &&
		/<TOC[^>]+layout="sidebar"/.test(sidebarWidget),
	"src/components/widget/SideBar.astro must render TOC only when toc=true in sidebar mode",
);
addCheck(
	"TOC widget supports sidebar layout title",
	/layout/.test(tocWidget) && /WidgetLayout/.test(tocWidget) && /I18nKey\.toc/.test(tocWidget),
	"src/components/widget/TOC.astro must support layout=\"sidebar\" with WidgetLayout and i18n title",
);
addCheck(
	"TOC i18n key exists",
	/toc\s*=\s*"toc"/.test(i18nKey),
	"src/i18n/i18nKey.ts must include toc",
);

addCheck(
	"nested category node type exists",
	/export interface CategoryNode/.test(contentUtils) && /children:\s*CategoryNode\[\]/.test(contentUtils),
	"src/utils/content-utils.ts must export CategoryNode with children",
);
addCheck(
	"nested category list builder exists",
	/export async function getNestedCategoryList/.test(contentUtils) && /buildCategoryTree/.test(contentUtils),
	"src/utils/content-utils.ts must export getNestedCategoryList and build a category tree",
);
addCheck(
	"category routes use rest parameters",
	/params:\s*\{\s*category:\s*categorySegments/.test(categoryPage) &&
		/Astro\.params\.category/.test(categoryPage) &&
		/addCategoryAndParents/.test(categoryPage) &&
		/slice\(0,\s*index \+ 1\)\.join\("\/"\)/.test(categoryPage),
	"src/pages/categories/[...category].astro must use rest category routes and generate parent category paths",
);
addCheck(
	"localized category routes use rest parameters",
	/params:\s*\{\s*lang:\s*toLangSlug\(lang\),\s*category:\s*categorySegments/.test(localizedCategoryPage) &&
		/addCategoryAndParents/.test(localizedCategoryPage) &&
		/slice\(0,\s*index \+ 1\)\.join\("\/"\)/.test(localizedCategoryPage),
	"src/pages/[lang]/categories/[...category].astro must use rest category routes and generate parent category paths",
);
addCheck(
	"category page includes child category posts",
	/isPostInCategoryTree/.test(categoryPage) && /startsWith\(normalizedCategory \+ ["']\/["']\)/.test(categoryPage),
	"category detail pages must include child categories for parent category routes",
);
addCheck(
	"category widgets use nested category list",
	/getNestedCategoryList/.test(readFileSync(new URL("../src/components/widget/Categories.astro", import.meta.url), "utf8")) &&
		/getNestedCategoryList/.test(readFileSync(new URL("../src/pages/categories.astro", import.meta.url), "utf8")),
	"category widget and category index page must use getNestedCategoryList",
);

const sidebarTypeBlock = configTypes.match(/export type SidebarConfig = \{[\s\S]*?\n\};/)?.[0] || "";
const tomlSidebarBlock = configLoader.match(/sidebar\?: \{[\s\S]*?\n\t\};/)?.[0] || "";
const sidebarConfigBlock = kirariConfig.match(/\[sidebar\][\s\S]*?(?=\n\[|\n#)/)?.[0] || "";

addCheck(
	"Firefly-inspired sidebar config exists",
	/sidebar:\s*SidebarConfig/.test(configTypes) &&
		/enabled:\s*boolean/.test(sidebarTypeBlock) &&
		/leftWidgets:\s*SidebarWidgetConfig\[\]/.test(configTypes) &&
		/rightWidgets:\s*SidebarWidgetConfig\[\]/.test(configTypes) &&
		/mobileWidgets:\s*SidebarWidgetConfig\[\]/.test(configTypes) &&
		/sidebar\?:/.test(configLoader) &&
		/\[sidebar\]/.test(kirariConfig),
	"sidebar config must flow through TOML, config types, and config-loader",
);
addCheck(
	"sidebar widget registry exists",
	/sidebarWidgetRegistry/.test(sidebarRegistry) &&
		/profile/.test(sidebarRegistry) &&
		/categories/.test(sidebarRegistry) &&
		/tags/.test(sidebarRegistry) &&
		/toc/.test(sidebarRegistry),
	"src/components/widget/sidebar-registry.ts must register profile/categories/tags/toc widgets",
);
addCheck(
	"mobile widget area exists",
	/mobileWidgets/.test(sidebarConfigBlock + tomlSidebarBlock + sidebarWidget) &&
		/mobile-sidebar-widgets/.test(sidebarWidget) &&
		/showOnPostPage/.test(configTypes) &&
		/showOnNonPostPage/.test(configTypes),
	"sidebar must support independently configured mobile widgets and visibility controls",
);

addCheck(
	"low-risk widgets exist",
	/Announcement/.test(announcementWidget) &&
		/Advertisement/.test(advertisementWidget) &&
		/SiteStats/.test(siteStatsWidget) &&
		/SiteInfo/.test(siteInfoWidget) &&
		/Calendar/.test(calendarWidget),
	"announcement, advertisement, site stats, site info, and calendar widgets must exist",
);
addCheck(
	"SiteInfo avoids unknown commit in normal builds",
	/buildCommit/.test(siteInfoWidget) &&
		!/unknown/i.test(siteInfoWidget),
	"SiteInfo widget must render build commit metadata without normal unknown fallback text",
);

addCheck(
	"dedicated search pages exist",
	/searchParams/.test(searchPage) &&
		/URLSearchParams/.test(searchPage) &&
		/location\.search/.test(searchPage) &&
		/pagefind/.test(searchPage) &&
		/docsearch/.test(searchPage) &&
		/google/.test(searchPage) &&
		/searchParams/.test(localizedSearchPage) &&
		/URLSearchParams/.test(localizedSearchPage) &&
		/location\.search/.test(localizedSearchPage),
	"root and localized /search/ pages must read runtime ?q= and respect active search provider",
);

addCheck(
	"comments config and guestbook exist",
	/comments:\s*CommentsConfig/.test(configTypes) &&
		/comments\?:/.test(configLoader) &&
		/\[comments\]/.test(kirariConfig) &&
		/giscus/.test(commentsWidget) &&
		/waline/.test(commentsWidget) &&
		/twikoo/.test(commentsWidget) &&
		/transitionManager/.test(commentsWidget) &&
		/guestbook/.test(guestbookPage),
	"comments must be configurable, lazy initialized, and reused by guestbook",
);

addCheck(
	"sponsor and bangumi pages exist",
	/sponsor:\s*SponsorConfig/.test(configTypes) &&
		/bangumi:\s*BangumiConfig/.test(configTypes) &&
		/\[sponsor\]/.test(kirariConfig) &&
		/\[bangumi\]/.test(kirariConfig) &&
		/Sponsor/.test(sponsorPage) &&
		/Bangumi/.test(bangumiPage),
	"sponsor and bangumi must have config chains and pages",
);

addCheck(
	"fonts and cover LQIP config exist",
	/fonts:\s*FontsConfig/.test(configTypes) &&
		/coverImage:\s*CoverImageConfig/.test(configTypes) &&
		/\[fonts\]/.test(kirariConfig) &&
		/\[coverImage\]/.test(kirariConfig) &&
		/fonts\?:/.test(configLoader) &&
		/coverImage\?:/.test(configLoader),
	"fonts and cover image/LQIP configuration must flow through config",
);

addCheck(
	"markdown enhancements are configured",
	/plantuml/.test(plantumlPlugin) &&
		/plantuml:\s*PlantUMLConfig/.test(configTypes) &&
		/admonitions:\s*AdmonitionsConfig/.test(configTypes) &&
		/\[markdown\.plantuml\]/.test(kirariConfig) &&
		/\[markdown\.admonitions\]/.test(kirariConfig),
	"PlantUML and admonition theme options must be configured",
);
addCheck(
	"Mermaid auto-render no longer depends on frontmatter only",
	/rehypeMermaidPreProcess/.test(readFileSync(new URL("../astro.config.mjs", import.meta.url), "utf8")) &&
		/mermaid/.test(readFileSync(new URL("../src/plugins/rehype-mermaid-pre.mjs", import.meta.url), "utf8")) &&
		!/frontmatter-only/i.test(readFileSync(new URL("../src/plugins/rehype-mermaid-pre.mjs", import.meta.url), "utf8")),
	"Mermaid fenced blocks must be auto-detected by the markdown plugin chain",
);

const requiredCreditTerms = [
	"Firefly",
	"Firefly-Docs",
	"Fuwari",
	"sidebar",
	"TOC",
	"comments",
	"Sponsor",
	"Guestbook",
	"Bangumi",
	"PlantUML",
];
addCheck(
	"credits document covers borrowed feature ideas",
	requiredCreditTerms.every((term) => creditsDoc.includes(term)) &&
		/CREDITS\.md/.test(readme) &&
		/CREDITS\.md/.test(readmeCn),
	"CREDITS.md must credit Firefly/Firefly-Docs/Fuwari and README files must link to it",
);

const failed = checks.filter((check) => !check.passed);
for (const check of checks) {
	console.log(`${check.passed ? "PASS" : "FAIL"} ${check.name}`);
	if (!check.passed) console.log(`  ${check.detail}`);
}

if (failed.length > 0) {
	console.error(`\n${failed.length} regression check(s) failed.`);
	process.exit(1);
}
