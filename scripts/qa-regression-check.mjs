import { readFileSync } from "node:fs";

const checks = [];

function addCheck(name, passed, detail) {
	checks.push({ name, passed, detail });
}

const configLoader = readFileSync(new URL("../src/utils/config-loader.ts", import.meta.url), "utf8");
const configTypes = readFileSync(new URL("../src/types/config.ts", import.meta.url), "utf8");
const kirariConfig = readFileSync(new URL("../kirari.config.toml", import.meta.url), "utf8");
const markdownCss = readFileSync(new URL("../src/styles/markdown.css", import.meta.url), "utf8");
const layout = readFileSync(new URL("../src/layouts/Layout.astro", import.meta.url), "utf8");
const profileWidget = readFileSync(new URL("../src/components/widget/Profile.astro", import.meta.url), "utf8");

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

const failed = checks.filter((check) => !check.passed);
for (const check of checks) {
	console.log(`${check.passed ? "PASS" : "FAIL"} ${check.name}`);
	if (!check.passed) console.log(`  ${check.detail}`);
}

if (failed.length > 0) {
	console.error(`\n${failed.length} regression check(s) failed.`);
	process.exit(1);
}
