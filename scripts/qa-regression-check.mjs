import { readFileSync } from "node:fs";

const checks = [];

function addCheck(name, passed, detail) {
	checks.push({ name, passed, detail });
}

const configLoader = readFileSync(new URL("../src/utils/config-loader.ts", import.meta.url), "utf8");
const markdownCss = readFileSync(new URL("../src/styles/markdown.css", import.meta.url), "utf8");
const layout = readFileSync(new URL("../src/layouts/Layout.astro", import.meta.url), "utf8");

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

const failed = checks.filter((check) => !check.passed);
for (const check of checks) {
	console.log(`${check.passed ? "PASS" : "FAIL"} ${check.name}`);
	if (!check.passed) console.log(`  ${check.detail}`);
}

if (failed.length > 0) {
	console.error(`\n${failed.length} regression check(s) failed.`);
	process.exit(1);
}
