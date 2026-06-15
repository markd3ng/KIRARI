import { existsSync, readFileSync } from "node:fs";

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
const sidebarWidgetRenderer = readOptional("../src/components/widget/SidebarWidget.astro");
const tocWidget = readFileSync(new URL("../src/components/widget/TOC.astro", import.meta.url), "utf8");
const i18nKey = readFileSync(new URL("../src/i18n/i18nKey.ts", import.meta.url), "utf8");
const contentUtils = readFileSync(new URL("../src/utils/content-utils.ts", import.meta.url), "utf8");
const categoryPage = readOptional("../src/pages/categories/[...category].astro");
const localizedCategoryPage = readOptional("../src/pages/[lang]/categories/[...category].astro");
const profileWidget = readFileSync(new URL("../src/components/widget/Profile.astro", import.meta.url), "utf8");
const creditsDoc = readOptional("../../../CREDITS.md");
const readme = readOptional("../../../README.md");
const readmeCn = readOptional("../../../README_CN.md");
const searchPage = readOptional("../src/pages/search.astro");
const localizedSearchPage = readOptional("../src/pages/[lang]/search.astro");
const guestbookPage = readOptional("../src/pages/guestbook.astro");
const sponsorPage = readOptional("../src/pages/sponsor.astro");
const bangumiPage = readOptional("../src/pages/bangumi.astro");
const localizedSponsorPage = readOptional("../src/pages/[lang]/sponsor.astro");
const localizedBangumiPage = readOptional("../src/pages/[lang]/bangumi.astro");
const friendsPage = readOptional("../src/pages/friends.astro");
const localizedFriendsPage = readOptional("../src/pages/[lang]/friends.astro");
const friendLinksPanel = readOptional("../src/components/friends/FriendLinksPanel.astro");
const friendsData = readOptional("../src/_data/friends.json");
const tagsPage = readOptional("../src/pages/tags.astro");
const localizedTagsPage = readOptional("../src/pages/[lang]/tags.astro");
const tagTopList = readOptional("../src/components/taxonomy/TagTopList.astro");
const sidebarRegistry = readOptional("../src/components/widget/sidebar-registry.ts");
const announcementWidget = readOptional("../src/components/widget/Announcement.astro");
const advertisementWidget = readOptional("../src/components/widget/Advertisement.astro");
const siteStatsWidget = readOptional("../src/components/widget/SiteStats.astro");
const siteInfoWidget = readOptional("../src/components/widget/SiteInfo.astro");
const calendarWidget = readOptional("../src/components/widget/Calendar.astro");
const commentsWidget = readOptional("../src/components/comments/Comments.astro");
const footerWidget = readOptional("../src/components/Footer.astro");
const buildCommitUtil = readOptional("../src/utils/build-commit.ts");
const plantumlPlugin = readOptional("../src/plugins/remark-plantuml.js") + readOptional("../src/plugins/rehype-plantuml.mjs");
const rootPackageJson = readOptional("../../../package.json");
const edgePackageJson = readOptional("../../../workers/kirari-edge/package.json");
const rootGitignore = readOptional("../../../.gitignore");
const rootReadme = readOptional("../../../README.md");
const rootReadmeCn = readOptional("../../../README_CN.md");
const contributingDoc = readOptional("../../../CONTRIBUTING.md");
const agentsDoc = readOptional("../../../AGENTS.md");
const quickStartDoc = readOptional("../../../docs/QUICK_START.md");
const docsReadme = readOptional("../../../docs/README.md");
const pullRequestTemplate = readOptional("../../../.github/pull_request_template.md");

// ---- Monorepo architecture checks ----
addCheck(
	"pnpm-workspace.yaml exists",
	existsSync(new URL("../../../pnpm-workspace.yaml", import.meta.url)),
	"Monorepo requires pnpm-workspace.yaml at repo root",
);
addCheck(
	"apps/site/package.json exists",
	existsSync(new URL("../package.json", import.meta.url)),
	"Monorepo requires apps/site/package.json",
);
addCheck(
	"packages/site-profile/package.json exists",
	existsSync(new URL("../../../packages/site-profile/package.json", import.meta.url)),
	"Monorepo requires packages/site-profile/package.json",
);
addCheck(
	"workers/kirari-edge/package.json exists",
	existsSync(new URL("../../../workers/kirari-edge/package.json", import.meta.url)),
	"Monorepo requires workers/kirari-edge/package.json",
);
addCheck(
	"monorepo architecture doc exists",
	existsSync(new URL("../../../docs/MONOREPO_ARCHITECTURE.md", import.meta.url)),
	"Monorepo requires docs/MONOREPO_ARCHITECTURE.md",
);
addCheck(
	"deployment matrix doc exists",
	existsSync(new URL("../../../docs/DEPLOYMENT_MATRIX.md", import.meta.url)),
	"Monorepo requires docs/DEPLOYMENT_MATRIX.md",
);
addCheck(
	"root workspace scripts reuse the active pnpm CLI",
	/"site:type-check":\s*"\\"?\$npm_execpath/.test(rootPackageJson) &&
		/"edge:type-check":\s*"\\"?\$npm_execpath/.test(rootPackageJson) &&
		/"build":\s*"\\"?\$npm_execpath\\"? site:build"/.test(rootPackageJson) &&
		/"check":\s*"\\"?\$npm_execpath\\"? site:type-check[\s\S]*edge:test/.test(rootPackageJson) &&
		!/"check":\s*"pnpm site:astro-check"/.test(rootPackageJson),
	"Root package scripts must not recursively call a different pnpm from PATH, and pnpm check must cover site and edge checks",
);
addCheck(
	"generated/local audit artifacts are ignored",
	/KIRARI_CODE_AUDIT_\*\.md/.test(rootGitignore) &&
		/apps\/site\/\.kirari-profile-manifest\.json/.test(rootGitignore),
	"Git must ignore local audit reports and the generated profile materialization manifest",
);
addCheck(
	"root docs use monorepo validation commands",
	!/pnpm type-check/.test(rootReadme + rootReadmeCn + contributingDoc + agentsDoc + pullRequestTemplate) &&
		!/pnpm astro check/.test(rootReadme + rootReadmeCn + contributingDoc + agentsDoc + pullRequestTemplate) &&
		/pnpm site:type-check/.test(rootReadme) &&
		/pnpm site:astro-check/.test(rootReadme) &&
		/pnpm edge:type-check/.test(rootReadme) &&
		/pnpm site:type-check/.test(rootReadmeCn) &&
		/pnpm site:astro-check/.test(rootReadmeCn) &&
		/pnpm edge:type-check/.test(rootReadmeCn),
	"README, README_CN, AGENTS, and PR template must not document removed root pnpm type-check / astro check commands",
);
addCheck(
	"quick start docs describe actual root scripts",
	/pnpm check\s+# Site \+ edge validation/.test(quickStartDoc) &&
		/pnpm site:dev/.test(quickStartDoc) &&
		/pnpm check\s+# site type-check \+ Astro check \+ edge checks/.test(docsReadme),
	"Quick start docs must describe the root scripts that actually exist after monorepo migration",
);
addCheck(
	"edge test script runs real tests",
	/"test":\s*"node --test/.test(edgePackageJson) &&
		/"deploy:dry":\s*"WRANGLER_WRITE_LOGS=false WRANGLER_SEND_METRICS=false wrangler deploy --dry-run --config wrangler\.jsonc"/.test(edgePackageJson) &&
		!/No tests configured yet|Deployment not yet configured/.test(edgePackageJson),
	"workers/kirari-edge test and dry-run deploy scripts must not be passing echo placeholders",
);

const materializeProfileScript = readOptional("../scripts/materialize-profile.mjs");
addCheck(
	"profile materialization script does not execute git commands",
	!/git add|git commit|reset --hard/.test(materializeProfileScript),
	"packages/site-profile must be materialized via copy, not git operations",
);

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
	/hasTocContent\s*=/.test(mainGridLayout) &&
		/useFloatingToc\s*=\s*siteConfig\.toc\.enable\s*&&\s*hasTocContent\s*&&\s*tocLayout\s*===\s*"floating"/.test(mainGridLayout) &&
		/<TOC[^>]+layout="floating"/.test(mainGridLayout),
	"src/layouts/MainGridLayout.astro must gate right-side TOC on actual article headings and layout=\"floating\"",
);
addCheck(
	"sidebar TOC renders in sidebar layout",
		/useSidebarToc\s*=\s*siteConfig\.toc\.enable\s*&&\s*hasTocContent\s*&&\s*tocLayout\s*===\s*"sidebar"/.test(mainGridLayout) &&
		/<SideBar[^>]+toc=\{useSidebarToc\}/.test(mainGridLayout) &&
		/toc\s*&&\s*tocLayout\s*===\s*"sidebar"/.test(sidebarWidget) &&
		/<TOC[^>]+layout="sidebar"/.test(sidebarWidgetRenderer),
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
addCheck(
	"tags pages include top tag ranking",
	/TagTopList/.test(tagsPage) &&
		/TagTopList/.test(localizedTagsPage) &&
		/topTags/.test(tagTopList) &&
		/sort\(\(a,\s*b\)\s*=>\s*b\.count\s*-\s*a\.count/.test(tagTopList) &&
		/slice\(0,\s*10\)/.test(tagTopList) &&
		/aria-label=\{`Top 10/.test(tagTopList) &&
		/width:\s*\$\{/.test(tagTopList),
	"tags index pages must render a Top 10 tag ranking with proportional bars below the tag cloud",
);
addCheck(
	"friends page includes searchable categorized application panel",
	/FriendLinksPanel/.test(friendsPage) &&
		/FriendLinksPanel/.test(localizedFriendsPage) &&
		/friend-filter/.test(friendLinksPanel) &&
		/data-friend-card/.test(friendLinksPanel) &&
		/data-friend-search/.test(friendLinksPanel) &&
		/data-friend-tag/.test(friendLinksPanel) &&
		/data-copy-value/.test(friendLinksPanel) &&
		/FriendFilter/.test(friendLinksPanel) &&
		/connectedCallback/.test(friendLinksPanel) &&
		!/DOMContentLoaded/.test(friendLinksPanel) &&
		/applicationFields/.test(friendLinksPanel) &&
		/applySteps/.test(friendLinksPanel) &&
		/noticeItems/.test(friendLinksPanel) &&
		/"tags"\s*:/.test(friendsData) &&
		/"weight"\s*:/.test(friendsData) &&
		/"enabled"\s*:/.test(friendsData),
	"friends page must render Firefly-inspired search/filter cards and application guidance from KIRARI data",
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
	"search results render untrusted content as text",
	!/a\.innerHTML\s*=/.test(searchPage + localizedSearchPage) &&
		/textContent\s*=/.test(searchPage) &&
		/textContent\s*=/.test(localizedSearchPage),
	"search result title/excerpt must use DOM nodes and textContent, not a.innerHTML",
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
		/I18nKey\.sponsor/.test(sponsorPage) &&
		/I18nKey\.bangumi/.test(bangumiPage),
	"sponsor and bangumi must have config chains and pages",
);
addCheck(
	"bangumi renders external api data without innerHTML",
	!/card\.innerHTML\s*=/.test(bangumiPage + localizedBangumiPage) &&
		/createElement\("img"\)/.test(bangumiPage + localizedBangumiPage) &&
		/textContent\s*=/.test(bangumiPage + localizedBangumiPage),
	"Bangumi external API fields must be rendered with DOM APIs and textContent",
);
addCheck(
	"sponsor and bangumi localized routes exist",
	/GetStaticPaths/.test(localizedSponsorPage) &&
		/GetStaticPaths/.test(localizedBangumiPage) &&
		/withLangPrefix\("\/404\/",\s*lang\)/.test(localizedSponsorPage) &&
		/withLangPrefix\("\/404\/",\s*lang\)/.test(localizedBangumiPage) &&
		/getPathAlternates/.test(localizedSponsorPage) &&
		/getPathAlternates/.test(localizedBangumiPage) &&
		/sponsor\s*=\s*"sponsor"/.test(i18nKey) &&
		/bangumi\s*=\s*"bangumi"/.test(i18nKey),
	"sponsor and bangumi must have localized routes, redirects, alternates, and i18n keys",
);

const widgetBranchCount = (sidebarWidget.match(/widget\.type ===/g) || []).length;
addCheck(
	"sidebar widget rendering is centralized",
	widgetBranchCount <= 9 && /renderWidget/.test(sidebarWidget),
	"SideBar.astro must render each widget type from one shared helper instead of three duplicated blocks",
);
addCheck(
	"advertisement display count has explicit fallback",
	/data-display-count=\{config\.displayCount\s*\?\?\s*-1\}/.test(advertisementWidget),
	"Advertisement widget must render an explicit -1 fallback for displayCount",
);
addCheck(
	"calendar skips disabled build work",
	/config\.enabled\s*\?\s*await getSortedPosts\(lang\)\s*:\s*\[\]/.test(calendarWidget),
	"Calendar widget must not call getSortedPosts when widgets.calendar.enabled is false",
);
addCheck(
	"TOC trailing hash helper is spelled correctly",
	/removeTrailingHash/.test(tocWidget) && !/removeTailingHash/.test(tocWidget),
	"TOC helper must be named removeTrailingHash",
);
addCheck(
	"comment provider scripts are pinned with SRI",
	/loadScript\(src: string,\s*datasetKey: string,\s*integrity: string\)/.test(commentsWidget) &&
		/script\.integrity\s*=\s*integrity/.test(commentsWidget) &&
		/script\.crossOrigin\s*=\s*"anonymous"/.test(commentsWidget) &&
		/@waline\/client@3\.15\.2/.test(commentsWidget) &&
		!/client@v3/.test(commentsWidget) &&
		/twikoo@1\.7\.6/.test(commentsWidget) &&
		/sha384-/.test(commentsWidget),
	"Waline/Twikoo scripts must be version-pinned and loaded with sha384 integrity",
);
addCheck(
	"build commit resolver lives in src utils",
	/resolveBuildCommit/.test(buildCommitUtil) &&
		!/\.\.\/\.\.\/scripts\/build-commit\.mjs/.test(footerWidget) &&
		!/\.\.\/\.\.\/\.\.\/scripts\/build-commit\.mjs/.test(siteInfoWidget) &&
		/build-commit/.test(footerWidget) &&
		/build-commit/.test(siteInfoWidget),
	"Footer and SiteInfo must import resolveBuildCommit from src/utils, not scripts/",
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
