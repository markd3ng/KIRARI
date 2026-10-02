
import {
	copyFileSync,
	existsSync,
	lstatSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	realpathSync,
	writeFileSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { spawnSync } from "node:child_process";
import { parse as parseToml, stringify as stringifyToml } from "smol-toml";

export const SITE_CONTRACT_VERSION = 2;
export const TAXONOMY_VERSION = 1;
export const SITE_LOCALES = Object.freeze(["zh-Hans", "zh-Hant", "en", "ja"]);
export const LEGACY_ROUTE_ALIASES = Object.freeze({
	"en-US": "en",
	"zh-CN": "zh-Hans",
	"zh-TW": "zh-Hant",
	"zh-HK": "zh-Hant",
	"ja-JP": "ja",
});

const FAVICONS = [
	"favicon-light-32.png",
	"favicon-light-128.png",
	"favicon-light-180.png",
	"favicon-light-192.png",
	"favicon-dark-32.png",
	"favicon-dark-128.png",
	"favicon-dark-180.png",
	"favicon-dark-192.png",
];
const INPUTS = [
	{ source: "kirari.config.toml", target: "kirari.config.toml", kind: "file", required: true },
	{ source: "content/posts", target: "content/posts", kind: "directory", required: false, emptyWhenMissing: true },
	{ source: "content/pages", target: "content/pages", kind: "directory", required: true },
	{ source: "data/friends.json", target: "data/friends.json", kind: "file", required: true, validate: "friends" },
	{ source: "data/devices.json", target: "data/devices.json", kind: "file", required: false, validate: "devices" },
	{ source: "data/taxonomy.json", target: "transform:frontmatter-taxonomy", kind: "file", required: true, validate: "taxonomy" },
	{ source: "data/route-aliases.json", target: "transform:legacy-routes", kind: "file", required: false, validate: "route-aliases" },
	{ source: "assets/images", target: "assets/images", kind: "directory", required: true, requiredFiles: ["demo-avatar.png", "demo-banner.png"], exclude: ["devices"] },
	{ source: "assets/images/devices", target: "public/images/devices", kind: "directory", required: false, emptyWhenMissing: true },
	{ source: "assets/branding", target: "public/branding", kind: "directory", required: false, emptyWhenMissing: true },
	{ source: "assets/favicon", target: "public/favicon", kind: "directory", required: true, requiredFiles: FAVICONS },
	{ source: "assets/og", target: "public/og", kind: "directory", required: true, requiredFiles: ["default.png"] },
	{ source: "public", target: "public", kind: "directory", required: false, emptyWhenMissing: true },
	{ source: "snippets", target: "snippets", kind: "directory", required: false, emptyWhenMissing: true },
];
const ROOT_ENTRIES = new Set([
	".git",
	".gitignore",
	".gitattributes",
	".gitmodules",
	".github",
	".kirari",
	".DS_Store",
	"package.json",
	"package-lock.json",
	"pnpm-lock.yaml",
	"yarn.lock",
	"README.md",
	"AI_SETUP.md",
	"scripts",
	"kirari.config.toml",
	"content",
	"data",
	"assets",
	"public",
	"snippets",
]);
const APPROVED_WORKFLOW = ".github/workflows/site-ci.yml";
const ROUTE_TOKEN = /^[a-z0-9]+(?:[-_][a-z0-9]+)*$/;
const ID = /^[a-z][a-z0-9._:-]*$/;
const BLOCKED_EXECUTABLE = /\.(?:astro|cjs|js|jsx|mjs|php|py|sh|ts|tsx)$/i;
const SECRET_FILE = /^(?:\.env(?:\..*)?|credentials?(?:\..*)?|secrets?(?:\..*)?|id_(?:rsa|ed25519))$|\.(?:key|pem|p12|pfx)$/i;
const CORE_LOCALES = Object.freeze({ en: "en-US", "zh-Hans": "zh-CN", "zh-Hant": "zh-TW", ja: "ja-JP" });
const V2_FRONTMATTER_FIELDS = new Set([
	"title", "slug", "published", "updated", "draft", "toc", "description", "image", "og",
	"tags", "category", "locale", "translationKey", "mermaid", "notbyai", "comments",
]);
const V1_FRONTMATTER_FIELDS = new Set([
	...V2_FRONTMATTER_FIELDS, "lang", "tagLabels", "categoryLabel",
]);

export function isSiteContractV2(siteRoot) {
	try {
		lstatSync(join(resolve(siteRoot), ".kirari", "site.toml"));
		return true;
	} catch (error) {
		if (error.code === "ENOENT" || error.code === "ENOTDIR") return false;
		throw error;
	}
}

export function validateSiteContractV2(siteRoot, { selectedCoreSha } = {}) {
	const siteDir = canonicalDirectory(siteRoot, "Site root");
	const metadataPath = join(siteDir, ".kirari", "site.toml");
	assertRegularFile(metadataPath, ".kirari/site.toml");
	assertDirectory(join(siteDir, ".kirari"), ".kirari");
	const metadata = parseToml(readFileSync(metadataPath, "utf8"));
	if (metadata["schema-version"] !== SITE_CONTRACT_VERSION) {
		throw new Error(`.kirari/site.toml: schema-version must be ${SITE_CONTRACT_VERSION}.`);
	}
	if (metadata["setup-state"] !== "ready") {
		throw new Error('.kirari/site.toml: setup-state must be "ready" before validation or build.');
	}
	const core = metadata.core;
	if (!isRecord(core) || typeof core.repository !== "string" || !core.repository.trim()) {
		throw new Error(".kirari/site.toml: [core].repository is required.");
	}
	if (typeof core.commit !== "string" || !/^[a-f0-9]{40}$/.test(core.commit)) {
		throw new Error(".kirari/site.toml: [core].commit must be a full lowercase 40-character commit SHA.");
	}

	const git = validateCoreGitlink(siteDir, core.repository, core.commit);
	if (selectedCoreSha !== undefined) {
		if (typeof selectedCoreSha !== "string" || !/^[a-f0-9]{40}$/.test(selectedCoreSha)) {
			throw new Error("Selected Core SHA must be a full lowercase 40-character commit SHA.");
		}
		for (const [label, sha] of [
			["Site Core pin", core.commit],
			["Site .kirari/core gitlink", git.gitlinkSha],
			["initialized .kirari/core checkout", git.coreCheckoutSha],
		]) {
			if (sha !== selectedCoreSha) throw new Error(`${label} ${sha} does not match selected Core SHA ${selectedCoreSha}.`);
		}
	}

	const routeAliases = validateInputs(siteDir);
	const configPath = join(siteDir, "kirari.config.toml");
	let config;
	try {
		config = parseToml(readFileSync(configPath, "utf8"));
	} catch (error) {
		throw new Error(`kirari.config.toml: invalid TOML: ${error.message}`);
	}
	validateSemanticConfig(config, siteDir);
	validateLocaleConfig(config, routeAliases);
	const taxonomy = JSON.parse(readFileSync(join(siteDir, "data/taxonomy.json"), "utf8"));
	const routeInventory = validateContent(siteDir, taxonomy, routeAliases, config);
	validateInputTree(siteDir);

	return {
		schemaVersion: SITE_CONTRACT_VERSION,
		siteDir,
		core: { repository: core.repository, commit: core.commit },
		gitlinkSha: git.gitlinkSha,
		coreCheckoutSha: git.coreCheckoutSha,
		legacyRouteAliases: { ...routeAliases },
		routeInventory,
		mappings: INPUTS.map(({ source, target, kind, required, exclude }) => ({ source, target, kind, required, ...(exclude ? { exclude } : {}) })),
		inventory: inventoryInputs(siteDir),
	};
}

export function materializeSiteContractV2(siteRoot, targetDir, { selectedCoreSha } = {}) {
	const contract = validateSiteContractV2(siteRoot, { selectedCoreSha });
	const destination = resolve(targetDir);
	const sourceRelation = relative(contract.siteDir, destination);
	if (sourceRelation === "" || (sourceRelation !== ".." && !sourceRelation.startsWith(`..${sep}`) && !isAbsolute(sourceRelation))) {
		throw new Error("Site v2 materialization target must be outside the Site input tree.");
	}
	const destinationStat = lstatMaybe(destination);
	if (destinationStat && (destinationStat.isSymbolicLink() || !destinationStat.isDirectory() || readdirSync(destination).length > 0)) {
		throw new Error(`Site v2 materialization target must be new or an empty regular directory: ${destination}`);
	}
	mkdirSync(destination, { recursive: true });
	const siteDir = contract.siteDir;
	const sourceConfig = parseToml(readFileSync(join(siteDir, "kirari.config.toml"), "utf8"));
	const defaultLocale = sourceConfig.site["default-language"];
	const copyMapped = (source, target, copyFile = false) => {
		const input = join(siteDir, source);
		if (!existsSync(input)) return;
		const output = join(destination, target);
		if (copyFile) {
			mkdirSync(dirname(output), { recursive: true });
			copyFileSync(input, output);
			return;
		}
		copyTree(input, output);
	};

	copyWithLegacyLocalePaths(join(siteDir, "content/posts"), join(destination, "content/posts"), defaultLocale);
	copyWithLegacyLocalePaths(join(siteDir, "content/pages"), join(destination, "content/spec"), defaultLocale);
	ensureCorePageEntries(join(destination, "content/spec"));
	if (existsSync(join(siteDir, "data/friends.json"))) copyMapped("data/friends.json", "data/friends.json", true);
	else writeFileSync(join(destination, "data/friends.json"), "[]\n", { flag: "wx" });
	copyMapped("data/devices.json", "data/devices.json", true);
	copyMapped("public", "public");
	copyMapped("assets/branding", "public/branding");
	copyTreeExcept(join(siteDir, "assets/images"), join(destination, "assets/images"), new Set(["devices"]));
	copyMapped("assets/images/devices", "assets/images/devices");
	copyMapped("assets/favicon", "assets/favicon");
	copyMapped("assets/og", "assets/og");
	copyMapped("snippets", "snippets");
	const taxonomy = JSON.parse(readFileSync(join(siteDir, "data/taxonomy.json"), "utf8"));
	const aliases = loadRouteAliases(siteDir);
	const configText = readFileSync(join(siteDir, "kirari.config.toml"), "utf8");
	writeFileSync(join(destination, "kirari.config.toml"), toLegacyCoreConfig(configText, aliases), { flag: "w" });
	transformPosts(join(siteDir, "content/posts"), join(destination, "content/posts"), taxonomy, aliases, "v2-to-core");
	return { ...contract, materializedDir: destination, publicDir: existsSync(join(destination, "public")) ? join(destination, "public") : null };
}

export function validateTaxonomy(taxonomy, filePath = "data/taxonomy.json") {
	if (!isRecord(taxonomy) || taxonomy.version !== TAXONOMY_VERSION) {
		throw new Error(`${filePath}: expected an object with version ${TAXONOMY_VERSION}.`);
	}
	const normalized = { tags: validateTaxonomyGroup(taxonomy.tags, "tags", filePath), categories: validateTaxonomyGroup(taxonomy.categories, "categories", filePath) };
	return normalized;
}

export function parseFrontmatter(source, filePath = "content") {
	const eol = source.includes("\r\n") ? "\r\n" : "\n";
	const lines = source.replace(/^\uFEFF/, "").split(/\r?\n/);
	if (lines[0]?.trim() !== "---") return { lines, eol, end: -1, fields: new Map() };
	const end = lines.findIndex((line, index) => index > 0 && line.trim() === "---");
	if (end < 0) throw new Error(`${filePath}: opening frontmatter delimiter has no closing --- line.`);
	const fields = new Map();
	let previousField = null;
	for (let index = 1; index < end; index += 1) {
		if (!lines[index].trim() || /^\s*#/.test(lines[index])) continue;
		const match = /^(?!\s)([A-Za-z0-9_-]+):(?:\s*(.*))?$/.exec(lines[index]);
		if (!match) {
			const supportedNested = previousField === "tags" && /^\s+-\s+/.test(lines[index])
				|| previousField === "tagLabels" && /^\s+[^-\s][^:]*:\s*/.test(lines[index]);
			if (supportedNested) continue;
			throw new Error(`${filePath}: unsupported YAML frontmatter syntax on line ${index + 1}.`);
		}
		if (fields.has(match[1])) throw new Error(`${filePath}: duplicate frontmatter field ${match[1]}.`);
		previousField = match[1];
		fields.set(match[1], { line: index, raw: match[2] ?? "", value: parseKnownField(match[1], lines, index, end, filePath) });
	}
	return { lines, eol, end, fields };
}

export function transformFrontmatter(source, filePath, transform) {
	const frontmatter = parseFrontmatter(source, filePath);
	if (frontmatter.end < 0) return source;
	const replacements = transform(frontmatter.fields);
	const output = [];
	for (let index = 0; index < frontmatter.lines.length; index += 1) {
		if (index === frontmatter.end) {
			for (const [key, value] of Object.entries(replacements)) {
				if (!frontmatter.fields.has(key) && value !== undefined) output.push(`${key}: ${yamlScalar(value)}`);
			}
			output.push(frontmatter.lines[index]);
			continue;
		}
		if (index > 0 && index < frontmatter.end) {
			const match = /^(?!\s)([A-Za-z0-9_-]+):(?:\s*(.*))?$/.exec(frontmatter.lines[index]);
			if (match && Object.hasOwn(replacements, match[1])) {
				const value = replacements[match[1]];
				if (value !== undefined) output.push(`${match[1]}: ${yamlScalar(value)}`);
				const next = match[2]?.trim() ? index + 1 : findNextTopLevel(frontmatter.lines, index + 1, frontmatter.end);
				index = next - 1;
				continue;
			}
		}
		output.push(frontmatter.lines[index]);
	}
	return output.join(frontmatter.eol);
}

function validateInputs(siteDir) {
	const validated = [];
	for (const input of INPUTS) {
		const path = join(siteDir, input.source);
		const stat = lstatMaybe(path);
		if (!stat) {
			if (input.required) throw new Error(`${input.source}: required Site input is missing.`);
			validated.push({ ...input, present: false });
			continue;
		}
		if (input.kind === "directory" ? !stat.isDirectory() : !stat.isFile()) {
			throw new Error(`${input.source}: expected a regular ${input.kind}.`);
		}
		if (stat.isSymbolicLink()) throw new Error(`${input.source}: symbolic links are not allowed.`);
		if (input.kind === "directory") {
			validateTree(path, siteDir, input.source);
			validateRequiredFiles(path, input);
		}
		if (input.validate) validateData(path, input.validate, input.source);
		validated.push({ ...input, present: true });
	}
	const publicRoot = join(siteDir, "public");
	for (const reserved of ["favicon", "og", "images/devices", "branding"]) {
		if (lstatMaybe(join(publicRoot, reserved))) throw new Error(`public/${reserved}: reserved for assets/ mappings and must be omitted.`);
	}
	validateSnippetNames(join(siteDir, "snippets"));
	return loadRouteAliases(siteDir);
}

function validateData(path, kind, relativePath) {
	let value;
	try {
		const text = readFileSync(path, "utf8");
		if (kind === "toml") value = parseToml(text);
		else value = JSON.parse(text);
	} catch (error) {
		throw new Error(`${relativePath}: invalid ${kind === "toml" ? "TOML" : "JSON"}: ${error.message}`);
	}
	if (kind === "toml") {
		if (!isRecord(value)) throw new Error(`${relativePath}: expected a TOML table.`);
	} else if (kind === "friends") {
		if (!Array.isArray(value)) throw new Error(`${relativePath}: expected a JSON array.`);
		for (const [index, friend] of value.entries()) {
			if (!isRecord(friend) || ["siteTitle", "siteDesc", "siteUrl", "siteIcon"].some((key) => typeof friend[key] !== "string")) {
				throw new Error(`${relativePath}: entry ${index + 1} must contain string siteTitle, siteDesc, siteUrl, and siteIcon fields.`);
			}
		}
	} else if (kind === "devices") {
		if (!isRecord(value) || (value.brands !== undefined && !Array.isArray(value.brands))) {
			throw new Error(`${relativePath}: expected an object with an optional brands array.`);
		}
	} else if (kind === "taxonomy") {
		validateTaxonomy(value, relativePath);
	} else if (kind === "route-aliases") {
		validateRouteAliases(value, relativePath);
	}
}

function validateRouteAliases(value, filePath) {
	if (!isRecord(value) || value.version !== 1 || !isRecord(value.legacyRouteAliases)) {
		throw new Error(`${filePath}: expected { version: 1, legacyRouteAliases: { oldLocale: canonicalLocale } }.`);
	}
	const seen = new Set();
	for (const [legacy, canonical] of Object.entries(value.legacyRouteAliases)) {
		if (!Object.hasOwn(LEGACY_ROUTE_ALIASES, legacy)) throw new Error(`${filePath}: unsupported legacy route alias ${legacy}.`);
		if (canonical !== LEGACY_ROUTE_ALIASES[legacy]) throw new Error(`${filePath}: ${legacy} must map to ${LEGACY_ROUTE_ALIASES[legacy]}.`);
		if (seen.has(legacy)) throw new Error(`${filePath}: duplicate legacy route alias ${legacy}.`);
		seen.add(legacy);
	}
	return value.legacyRouteAliases;
}

function loadRouteAliases(siteDir) {
	const path = join(siteDir, "data/route-aliases.json");
	if (!existsSync(path)) return {};
	try {
		return validateRouteAliases(JSON.parse(readFileSync(path, "utf8")));
	} catch (error) {
		throw new Error(`data/route-aliases.json: ${error.message}`);
	}
}

function validateLocaleConfig(config, routeAliases) {
	const i18n = config.i18n;
	if (!isRecord(i18n)) throw new Error("kirari.config.toml: [i18n] is required for Site Contract v2.");
	if (i18n.enable !== undefined && typeof i18n.enable !== "boolean") throw new Error("kirari.config.toml: i18n.enable must be a boolean when present.");
	if (i18n["default-language"] !== undefined || i18n.defaultLanguage !== undefined || i18n.defaultLang !== undefined) {
		throw new Error("kirari.config.toml: Site Contract v2 owns the default locale at [site].default-language.");
	}
	const defaultLocale = config.site?.["default-language"];
	if (!SITE_LOCALES.includes(defaultLocale)) throw new Error("kirari.config.toml: site.default-language must be one of zh-Hans, zh-Hant, en, or ja.");
	const languages = i18n.languages;
	if (!isRecord(languages)) throw new Error("kirari.config.toml: [i18n.languages] must define the Site Contract v2 locales.");
	for (const locale of Object.keys(languages)) {
		if (!SITE_LOCALES.includes(locale)) throw new Error(`kirari.config.toml: unsupported [i18n.languages.${locale}]; legacy routes belong in data/route-aliases.json.`);
	}
	for (const locale of SITE_LOCALES) {
		if (!isRecord(languages[locale])) throw new Error(`kirari.config.toml: [i18n.languages.${locale}] is required.`);
		if (!SITE_LOCALES.includes(languages[locale].locale)) {
			throw new Error(`kirari.config.toml: [i18n.languages.${locale}].locale must use a canonical Site Contract v2 locale.`);
		}
		if (languages[locale].disabled !== undefined && typeof languages[locale].disabled !== "boolean") {
			throw new Error(`kirari.config.toml: [i18n.languages.${locale}].disabled must be a boolean when present.`);
		}
	}
	if (languages[defaultLocale].disabled === true) throw new Error(`kirari.config.toml: default locale ${defaultLocale} must be enabled.`);
	void routeAliases;
}

function validateContent(siteDir, taxonomyInput, routeAliases, config) {
	const taxonomy = validateTaxonomy(taxonomyInput);
	const tags = new Map(taxonomy.tags.map((item) => [item.id, item]));
	const categories = new Map(taxonomy.categories.map((item) => [item.id, item]));
	const posts = collectMarkdown(join(siteDir, "content/posts"));
	const defaultLocale = config.site["default-language"];
	const routes = new Map();
	const translations = new Map();
	const routeInventory = [];
	for (const postPath of posts) {
		const rel = relative(siteDir, postPath).split(sep).join("/");
		const post = parseFrontmatter(readFileSync(postPath, "utf8"), rel);
		if (post.end < 0) throw new Error(`${rel}: Markdown post must have YAML frontmatter.`);
		for (const field of post.fields.keys()) {
			if (!V2_FRONTMATTER_FIELDS.has(field)) throw new Error(`${rel}: frontmatter field ${field} is not supported by Site Contract v2.`);
		}
		for (const field of ["title", "published"]) {
			const value = post.fields.get(field)?.value;
			if (typeof value !== "string" || !value.trim()) throw new Error(`${rel}: frontmatter ${field} is required and must be a non-empty string.`);
		}
		for (const field of ["slug", "updated", "description", "image", "og", "translationKey"]) {
			const value = post.fields.get(field)?.value;
			if (value !== undefined && value !== null && typeof value !== "string") throw new Error(`${rel}: frontmatter ${field} must be a string.`);
		}
		for (const field of ["draft", "toc", "mermaid", "notbyai", "comments"]) {
			const value = post.fields.get(field)?.value;
			if (value !== undefined && typeof value !== "boolean") throw new Error(`${rel}: frontmatter ${field} must be a boolean.`);
		}
		for (const field of ["published", "updated"]) {
			const value = post.fields.get(field)?.value;
			if (value !== undefined && !Number.isFinite(Date.parse(value))) throw new Error(`${rel}: frontmatter ${field} must be a valid date.`);
		}
		if (post.fields.has("lang")) throw new Error(`${rel}: v2 content uses frontmatter locale, not legacy lang.`);
		const contentPath = rel.replace(/^content\/posts\//, "");
		const pathParts = contentPath.split("/");
		const pathLocale = SITE_LOCALES.includes(pathParts[0]) ? pathParts[0] : undefined;
		const locale = post.fields.get("locale")?.value ?? pathLocale ?? defaultLocale;
		if (typeof locale !== "string" || !SITE_LOCALES.includes(locale)) {
			throw new Error(`${rel}: frontmatter locale must be one of zh-Hans, zh-Hant, en, or ja.`);
		}
		if (pathLocale && pathLocale !== locale) throw new Error(`${rel}: locale ${locale} conflicts with canonical locale directory ${pathLocale}.`);
		if (post.fields.has("tagLabels") || post.fields.has("categoryLabel")) {
			throw new Error(`${rel}: v2 content references taxonomy IDs; move localized labels to data/taxonomy.json.`);
		}
		const rawTags = post.fields.get("tags")?.value ?? [];
		if (!Array.isArray(rawTags)) throw new Error(`${rel}: frontmatter tags must be a list of taxonomy IDs.`);
		const seenTags = new Set();
		for (const id of rawTags) {
			if (typeof id !== "string" || !tags.has(id)) throw new Error(`${rel}: unknown tag taxonomy ID ${JSON.stringify(id)}.`);
			if (seenTags.has(id)) throw new Error(`${rel}: duplicate tag taxonomy ID ${id}.`);
			seenTags.add(id);
		}
		const category = post.fields.get("category")?.value;
		if (category !== undefined && category !== null && category !== "" && (typeof category !== "string" || !categories.has(category))) {
			throw new Error(`${rel}: unknown category taxonomy ID ${JSON.stringify(category)}.`);
		}
		for (const field of ["image", "og"]) validateLocalAssetReference(siteDir, rel, post.fields.get(field)?.value);
		const explicitSlug = post.fields.get("slug")?.value;
		const relativeRoute = pathLocale ? pathParts.slice(1).join("/") : contentPath;
		const routeSlug = (explicitSlug || relativeRoute.replace(/\.mdx?$/i, "").replace(/\/index$/i, ""))
			.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
		if (!routeSlug || routeSlug.split("/").some((part) => !part || part === "." || part === "..") || /[\u0000-\u001f?#]/.test(routeSlug)) {
			throw new Error(`${rel}: frontmatter slug or content path must resolve to a safe relative route.`);
		}
		const routeKey = `${locale}:${routeSlug}`;
		if (routes.has(routeKey)) throw new Error(`${rel}: duplicate post route ${routeKey} also used by ${routes.get(routeKey)}.`);
		routes.set(routeKey, rel);
		const translationKey = post.fields.get("translationKey")?.value;
		if (translationKey) {
			const translationRoute = `${locale}:${translationKey}`;
			if (translations.has(translationRoute)) throw new Error(`${rel}: duplicate translationKey ${translationKey} for locale ${locale} also used by ${translations.get(translationRoute)}.`);
			translations.set(translationRoute, rel);
		}
		routeInventory.push({
			locale,
			slug: routeSlug,
			source: rel,
			...(translationKey ? { translationKey } : {}),
		});
	}
	void routeAliases;
	return routeInventory.sort((left, right) => left.locale.localeCompare(right.locale) || left.slug.localeCompare(right.slug));
}

function validateSemanticConfig(config, siteDir) {
	if (Object.hasOwn(config, "default-language")) throw new Error("kirari.config.toml: move root default-language to [site].default-language.");
	const site = config.site;
	if (site !== undefined && !isRecord(site)) throw new Error("kirari.config.toml: [site] must be a table when present.");
	if (!SITE_LOCALES.includes(site?.["default-language"])) {
		throw new Error("kirari.config.toml: site.default-language must be one of zh-Hans, zh-Hant, en, or ja.");
	}
	if (site?.lang !== undefined) throw new Error("kirari.config.toml: [site].lang duplicates the canonical [site].default-language; it is synthesized for Core compatibility.");
	for (const field of ["title", "subtitle"]) {
		if (site?.[field] !== undefined && (typeof site[field] !== "string" || !site[field].trim())) {
			throw new Error(`kirari.config.toml: [site].${field} must be a non-empty string when present.`);
		}
	}
	if (site?.url !== undefined) {
		if (typeof site.url !== "string" || !site.url.trim()) throw new Error("kirari.config.toml: [site].url must be an absolute canonical HTTP(S) origin.");
		let siteUrl;
		try { siteUrl = new URL(site.url); } catch { throw new Error("kirari.config.toml: [site].url must be an absolute canonical HTTP(S) origin."); }
		if (!/^https?:$/.test(siteUrl.protocol) || !siteUrl.hostname || siteUrl.username || siteUrl.password || siteUrl.search || siteUrl.hash || siteUrl.pathname !== "/") {
			throw new Error("kirari.config.toml: [site].url must contain only an HTTP(S) origin; configure a path in [site].base.");
		}
	}
	if (site?.base !== undefined && (typeof site.base !== "string" || !site.base.startsWith("/") || site.base.includes("\\") || /[?#\u0000-\u001f]/.test(site.base) || site.base.split("/").some((part) => part === "." || part === ".."))) {
		throw new Error("kirari.config.toml: [site].base must be a safe absolute path such as / or /blog/.");
	}
	if (config.profile !== undefined && !isRecord(config.profile)) throw new Error("kirari.config.toml: [profile] must be a table when present.");
	if (config.profile?.name !== undefined && (typeof config.profile.name !== "string" || !config.profile.name.trim())) {
		throw new Error("kirari.config.toml: [profile].name must be a non-empty string when present.");
	}
	if (config.og !== undefined && !isRecord(config.og)) throw new Error("kirari.config.toml: [og] must be a table when present.");
	if (config.og?.defaultImage !== undefined) {
		if (typeof config.og.defaultImage !== "string" || !config.og.defaultImage.trim()) throw new Error("kirari.config.toml: [og].defaultImage must be a non-empty path when present.");
		validateLocalAssetReference(siteDir, "kirari.config.toml", config.og.defaultImage);
	}
	if (config.seo !== undefined && !isRecord(config.seo)) throw new Error("kirari.config.toml: [seo] must be a table when present.");
	if (config.seo?.indexNow !== undefined && typeof config.seo.indexNow !== "boolean") throw new Error("kirari.config.toml: [seo].indexNow must be a boolean.");
	if (config.seo?.google?.indexingApi !== undefined && typeof config.seo.google.indexingApi !== "boolean") {
		throw new Error("kirari.config.toml: [seo.google].indexingApi must be a boolean.");
	}
}

function toLegacyCoreConfig(source, routeAliases) {
	const config = parseToml(source);
	const defaultLocale = config.site["default-language"];
	config.site.lang = CORE_LOCALES[defaultLocale];
	delete config.site["default-language"];
	config.i18n["default-language"] = CORE_LOCALES[defaultLocale];
	const v2Languages = config.i18n.languages;
	const legacyLanguages = {};
	for (const locale of SITE_LOCALES) {
		const language = { ...v2Languages[locale], locale: CORE_LOCALES[locale] };
		delete language["contentDir"];
		delete language["content-dir"];
		language.contentDir = locale === defaultLocale
			? "src/content/posts"
			: `src/content/posts/${CORE_LOCALES[locale]}`;
		legacyLanguages[CORE_LOCALES[locale]] = language;
	}
	if (routeAliases["zh-HK"] === "zh-Hant") {
		const canonical = legacyLanguages[CORE_LOCALES["zh-Hant"]];
		legacyLanguages["zh-HK"] = {
			...canonical,
			locale: "zh-Hant",
			contentDir: `src/content/posts/${CORE_LOCALES["zh-Hant"]}`,
			disabled: false,
		};
		legacyLanguages["zh-HK"].weight = Number(canonical.weight ?? 0) + 1;
	}
	config.i18n.languages = legacyLanguages;
	return stringifyToml(config);
}

function transformPosts(sourceRoot, targetRoot, taxonomyInput, routeAliases, direction) {
	if (!existsSync(targetRoot)) return;
	const taxonomy = validateTaxonomy(taxonomyInput);
	const tags = new Map(taxonomy.tags.map((item) => [item.id, item]));
	const categories = new Map(taxonomy.categories.map((item) => [item.id, item]));
	const sourceConfig = parseToml(readFileSync(join(dirname(sourceRoot), "../kirari.config.toml"), "utf8"));
	const defaultLocale = sourceConfig.site["default-language"];
	for (const file of collectMarkdown(targetRoot)) {
		const rel = relative(targetRoot, file).split(sep).join("/");
		const source = readFileSync(file, "utf8");
		const output = transformFrontmatter(source, rel, (fields) => {
			const legacyPathLocale = Object.entries(CORE_LOCALES).find(([, legacy]) => rel === legacy || rel.startsWith(`${legacy}/`))?.[0];
			const locale = fields.get("locale")?.value ?? legacyPathLocale ?? defaultLocale;
			if (direction === "v2-to-core") {
				const rawTags = fields.get("tags")?.value ?? [];
				const transformedTags = rawTags.map((id) => tags.get(id)?.slug ?? id);
				const tagLabels = Object.fromEntries(rawTags.flatMap((id) => {
					const item = tags.get(id);
					const label = item?.labels?.[locale];
					return item && typeof label === "string" ? [[item.slug, label]] : [];
				}));
				const categoryId = fields.get("category")?.value;
				const category = categories.get(categoryId);
				return {
					tags: fields.has("tags") ? transformedTags : undefined,
					category: category ? category.slug : categoryId,
					locale: undefined,
					lang: CORE_LOCALES[locale] ?? locale,
					tagLabels: Object.keys(tagLabels).length > 0 ? tagLabels : undefined,
					categoryLabel: category?.labels?.[locale],
				};
			}
			return {};
		});
		if (output !== source) writeFileSync(file, output);
	}
	void sourceRoot;
	void routeAliases;
}

function copyWithLegacyLocalePaths(source, target, defaultLocale) {
	if (!existsSync(source)) return;
	const copy = (from, to, depth = 0, allowDirectoryMerge = false) => {
		const stat = lstatSync(from);
		if (stat.isSymbolicLink()) throw new Error(`Site input became a symlink while copying: ${from}`);
		if (stat.isDirectory()) {
			const existing = lstatMaybe(to);
			if (existing && (!existing.isDirectory() || existing.isSymbolicLink() || !allowDirectoryMerge)) {
				throw new Error(`Locale directory mapping collides at ${relative(target, to)}.`);
			}
			mkdirSync(to, { recursive: true });
			for (const name of readdirSync(from).sort()) {
				if (isExcludedMetadata(name)) continue;
				const flattenDefaultLocale = depth === 0 && name === defaultLocale;
				const mappedName = depth === 0 ? CORE_LOCALES[name] ?? name : name;
				const childDestination = flattenDefaultLocale ? to : join(to, mappedName);
				copy(join(from, name), childDestination, depth + 1, flattenDefaultLocale);
			}
			return;
		}
		if (!stat.isFile()) throw new Error(`Site input has an unsupported file type: ${from}`);
		if (lstatMaybe(to)) throw new Error(`Locale directory mapping collides at ${relative(target, to)}.`);
		mkdirSync(dirname(to), { recursive: true });
		copyFileSync(from, to);
	};
	copy(source, target);
}

function ensureCorePageEntries(path) {
	mkdirSync(path, { recursive: true });
	for (const [name, content] of [
		["about.md", "This Site has not added an About page yet.\n"],
		["friends.md", "Friend links are managed in the Site data folder.\n"],
		["projects.md", "This Site has not added a Projects page yet.\n"],
	]) {
		const target = join(path, name);
		if (!existsSync(target)) writeFileSync(target, content, { flag: "wx" });
	}
}

function validateTaxonomyGroup(value, name, filePath) {
	if (!Array.isArray(value)) throw new Error(`${filePath}: ${name} must be an array.`);
	const ids = new Set();
	const slugs = new Map();
	const aliases = new Map();
	return value.map((item, index) => {
		const where = `${filePath}: ${name}[${index}]`;
		if (!isRecord(item)) throw new Error(`${where} must be an object.`);
		const { id, slug, labels, descriptions = {}, aliases: localizedAliases = {} } = item;
		if (typeof id !== "string" || !ID.test(id)) throw new Error(`${where}.id must be a stable lowercase ID.`);
		if (ids.has(id)) throw new Error(`${where}.id duplicates ${id}.`);
		ids.add(id);
		if (typeof slug !== "string" || !validTaxonomySlug(slug, name)) throw new Error(`${where}.slug is not a valid ${name === "tags" ? "tag" : "category"} URL slug.`);
		if (slugs.has(slug)) throw new Error(`${where}.slug conflicts with ${slugs.get(slug)}.`);
		slugs.set(slug, id);
		validateLocalizedRecord(labels, `${where}.labels`, "string", true);
		validateLocalizedRecord(descriptions, `${where}.descriptions`, "string", false);
		validateLocalizedRecord(localizedAliases, `${where}.aliases`, "array", false);
		for (const [locale, values] of Object.entries(localizedAliases)) {
			for (const alias of values) {
				const key = `${locale}:${alias.normalize("NFKC").trim().toLowerCase()}`;
				const previous = aliases.get(key);
				if (previous && previous !== id) throw new Error(`${where}.aliases conflicts with taxonomy ID ${previous} for ${locale} alias ${JSON.stringify(alias)}.`);
				aliases.set(key, id);
			}
		}
		return item;
	});
}

function validateLocalizedRecord(value, label, kind, required) {
	if (!isRecord(value) || (required && Object.keys(value).length === 0)) {
		throw new Error(`${label} must be a${required ? " non-empty" : "n"} locale-keyed object.`);
	}
	for (const [locale, entry] of Object.entries(value)) {
		if (!SITE_LOCALES.includes(locale)) throw new Error(`${label}: unsupported locale ${locale}.`);
		if (kind === "array") {
			if (!Array.isArray(entry) || entry.some((item) => typeof item !== "string" || !item.trim())) {
				throw new Error(`${label}.${locale} must be an array of non-empty strings.`);
			}
		} else if (typeof entry !== "string" || !entry.trim()) {
			throw new Error(`${label}.${locale} must be a non-empty string.`);
		}
	}
}

function validTaxonomySlug(slug, group) {
	const parts = slug.split("/");
	return (group === "categories" || parts.length === 1) && parts.every((part) => ROUTE_TOKEN.test(part));
}

function validateInputTree(siteDir) {
	for (const name of readdirSync(siteDir)) {
		if (name === ".DS_Store") {
			assertRegularFile(join(siteDir, name), name);
			continue;
		}
		if (!ROOT_ENTRIES.has(name)) throw new Error(`${name}: unsupported Site-root input; keep Core/build code in the pinned .kirari/core submodule.`);
		if ([".DS_Store", "package.json", "package-lock.json", "pnpm-lock.yaml", "yarn.lock"].includes(name)) {
			assertRegularFile(join(siteDir, name), name);
			continue;
		}
		if (name === ".git") continue;
		const path = join(siteDir, name);
		const stat = lstatSync(path);
		if (stat.isSymbolicLink()) throw new Error(`${name}: symbolic links are not allowed in Site inputs.`);
		if (name === ".github") {
			validateApprovedWorkflow(path, siteDir);
			continue;
		}
		if (name === "data") validateDirectoryEntries(path, new Set(["friends.json", "devices.json", "taxonomy.json", "route-aliases.json"]), "data");
		if (name === "content") validateDirectoryEntries(path, new Set(["posts", "pages"]), "content");
		if (name === "assets") validateDirectoryEntries(path, new Set(["images", "favicon", "og", "branding"]), "assets");
		if (name === ".kirari") {
			for (const item of readdirSync(path)) if (item !== "site.toml" && item !== "core") throw new Error(`.kirari/${item}: unsupported bootstrap input.`);
			continue;
		}
		if (name === "scripts") {
			const entries = readdirSync(path);
			if (entries.some((entry) => entry !== "site-setup.sh")) throw new Error("scripts/: only the approved site-setup.sh bootstrap script is allowed.");
			assertRegularFile(join(path, "site-setup.sh"), "scripts/site-setup.sh");
			continue;
		}
		if (stat.isDirectory()) validateTree(path, siteDir, name);
		else if (name !== ".gitmodules" && !stat.isFile()) throw new Error(`${name}: unsupported special file type.`);
	}
}

function validateApprovedWorkflow(path, siteDir) {
	if (!lstatSync(path).isDirectory()) throw new Error(".github/: only .github/workflows/site-ci.yml is allowed.");
	const workflows = join(path, "workflows");
	if (readdirSync(path).some((name) => name !== "workflows")) throw new Error(".github/: only .github/workflows/site-ci.yml is allowed.");
	assertDirectory(workflows, ".github/workflows");
	if (readdirSync(workflows).some((name) => name !== "site-ci.yml")) throw new Error(".github/workflows/: only site-ci.yml is allowed.");
	const workflow = join(workflows, "site-ci.yml");
	assertRegularFile(workflow, APPROVED_WORKFLOW);
	validateTree(workflow, siteDir, APPROVED_WORKFLOW);
}

function validateTree(path, siteDir, relativeRoot) {
	const stat = lstatSync(path);
	if (stat.isSymbolicLink()) throw new Error(`${relative(siteDir, path).split(sep).join("/")}: symbolic links are not allowed.`);
	if (stat.isDirectory()) {
		for (const name of readdirSync(path)) {
			const child = join(path, name);
			const childRel = relative(siteDir, child).split(sep).join("/");
			const childStat = lstatSync(child);
			if (childStat.isSymbolicLink()) throw new Error(`${childRel}: symbolic links are not allowed.`);
			if (childStat.isDirectory()) validateTree(child, siteDir, relativeRoot);
			else if (!childStat.isFile()) throw new Error(`${childRel}: special files are not allowed.`);
			if (SECRET_FILE.test(name)) throw new Error(`${childRel}: secret-like files are not allowed in Site inputs.`);
			if (BLOCKED_EXECUTABLE.test(name) && !childRel.startsWith("snippets/") && childRel !== "scripts/site-setup.sh") {
				throw new Error(`${childRel}: executable source is not ordinary Site data; trusted code belongs in snippets/.`);
			}
		}
	} else if (!stat.isFile()) throw new Error(`${relative(siteDir, path).split(sep).join("/")}: special files are not allowed.`);
}

function validateSnippetNames(path) {
	if (!existsSync(path)) return;
	for (const name of readdirSync(path)) {
		const stat = lstatSync(join(path, name));
		if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`snippets/${name}: only regular top-level trusted snippet files are allowed.`);
		if (name !== "README.md" && !/^[A-Za-z0-9][A-Za-z0-9._-]*\.(?:html|js)$/.test(name)) {
			throw new Error(`snippets/${name}: trusted snippets must be top-level .html or .js files.`);
		}
	}
}

function validateCoreGitlink(siteDir, declaredRepository, declaredSha) {
	const gitRoot = git(siteDir, ["rev-parse", "--show-toplevel"], "Site Git checkout");
	const repositoryRoot = realpathSync(gitRoot);
	const siteSubdirectory = relative(repositoryRoot, siteDir).split(sep).join("/");
	if (siteSubdirectory === ".." || siteSubdirectory.startsWith("../") || isAbsolute(siteSubdirectory)) {
		throw new Error("Site Contract v2 root must be inside its Git checkout.");
	}
	const gitlinkPath = `${siteSubdirectory && siteSubdirectory !== "." ? `${siteSubdirectory}/` : ""}.kirari/core`;
	const modulesPath = join(repositoryRoot, ".gitmodules");
	assertRegularFile(modulesPath, ".gitmodules");
	const configLines = git(repositoryRoot, ["config", "-f", ".gitmodules", "--get-regexp", "^submodule\\..*\\.(path|url|branch)$"], ".gitmodules submodule configuration", true);
	const sectionByPath = new Map();
	for (const line of configLines.split("\n").filter(Boolean)) {
		const match = /^(submodule\.(.+)\.(path|url|branch))\s+(.+)$/.exec(line);
		if (!match) continue;
		const [, , name, key, value] = match;
		const current = sectionByPath.get(name) ?? {};
		current[key] = value;
		sectionByPath.set(name, current);
	}
	const coreSection = [...sectionByPath.values()].find((section) => section.path === gitlinkPath);
	if (!coreSection) throw new Error(`.gitmodules: ${gitlinkPath} must be a Git submodule.`);
	if (coreSection.branch) throw new Error(".gitmodules: .kirari/core must pin a gitlink and must not track a branch.");
	if (!coreSection.url || normalizeGitRepository(coreSection.url) !== normalizeGitRepository(declaredRepository)) {
		throw new Error(".gitmodules: .kirari/core URL must match .kirari/site.toml [core].repository.");
	}
	const staged = git(repositoryRoot, ["ls-files", "--stage", "--", gitlinkPath], "Site .kirari/core gitlink");
	const match = /^160000 ([a-f0-9]{40}) 0\s+(.+)$/.exec(staged.trim());
	if (!match) throw new Error(".kirari/core: Git index must contain one full-SHA mode-160000 submodule gitlink.");
	const gitlinkSha = match[1];
	if (match[2] !== gitlinkPath) throw new Error(`Git index path ${match[2]} does not match expected .kirari/core path ${gitlinkPath}.`);
	if (gitlinkSha !== declaredSha) throw new Error(`.kirari/site.toml Core pin ${declaredSha} does not match .kirari/core gitlink ${gitlinkSha}.`);
	const corePath = join(siteDir, ".kirari/core");
	assertDirectory(corePath, ".kirari/core");
	const coreCheckoutSha = git(corePath, ["rev-parse", "--verify", "HEAD^{commit}"], "Initialized .kirari/core checkout");
	if (coreCheckoutSha !== gitlinkSha) throw new Error(`Initialized .kirari/core checkout ${coreCheckoutSha} does not match gitlink ${gitlinkSha}.`);
	return { gitlinkSha, coreCheckoutSha };
}

function validateRequiredFiles(root, input) {
	for (const name of input.requiredFiles ?? []) {
		const path = join(root, name);
		const stat = lstatMaybe(path);
		if (!stat || !stat.isFile() || stat.isSymbolicLink()) throw new Error(`${input.source}/${name}: required regular file is missing.`);
	}
}

function validateLocalAssetReference(siteDir, sourceFile, value) {
	if (typeof value !== "string" || !value || /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(value)) return;
	const base = dirname(join(siteDir, sourceFile));
	const candidates = value.startsWith("/")
		? [join(siteDir, "public", value.slice(1)), join(siteDir, "assets", value.slice(1))]
		: [resolve(base, value)];
	for (const candidate of candidates) {
		const rel = relative(siteDir, candidate);
		if (rel === ".." || rel.startsWith(`..${sep}`) || isAbsolute(rel)) continue;
		const stat = lstatMaybe(candidate);
		if (stat?.isFile() && !stat.isSymbolicLink()) return;
	}
	throw new Error(`${sourceFile}: local asset reference ${JSON.stringify(value)} does not resolve to a Site input file.`);
}

function collectMarkdown(path) {
	if (!existsSync(path)) return [];
	return readdirSync(path, { withFileTypes: true }).flatMap((entry) => {
		const child = join(path, entry.name);
		if (entry.isDirectory()) return collectMarkdown(child);
		return /\.(?:md|mdx)$/i.test(entry.name) ? [child] : [];
	}).sort();
}

function parseKnownField(key, lines, line, end, filePath) {
	const raw = /^(?:tags|tagLabels):\s*$/.test(lines[line].trim()) ? "" : /^\S[^:]*:\s*(.*)$/.exec(lines[line])?.[1] ?? "";
	if (key === "tags") {
		if (raw.trim()) return parseYamlArray(raw, filePath, key);
		const values = [];
		for (let index = line + 1; index < end && /^\s+-\s+/.test(lines[index]); index += 1) values.push(parseYamlScalar(lines[index].replace(/^\s+-\s+/, ""), filePath, key));
		return values;
	}
	if (key === "tagLabels") {
		if (raw.trim() === "{}") return {};
		if (!raw.trim()) {
			const labels = {};
			for (let index = line + 1; index < end && /^\s+[^-\s][^:]*:\s*/.test(lines[index]); index += 1) {
				const match = /^\s+(.+?):\s*(.*)$/.exec(lines[index]);
				if (!match) throw new Error(`${filePath}: unsupported YAML under tagLabels.`);
				labels[parseYamlScalar(match[1], filePath, key)] = parseYamlScalar(match[2], filePath, key);
			}
			return labels;
		}
		throw new Error(`${filePath}: tagLabels must be a YAML mapping.`);
	}
	return raw.trim() ? parseYamlScalar(raw, filePath, key) : "";
}

function parseYamlArray(raw, filePath, key) {
	const value = stripYamlComment(raw).trim();
	if (!value.startsWith("[") || !value.endsWith("]")) throw new Error(`${filePath}: frontmatter ${key} must use a YAML list.`);
	const inner = value.slice(1, -1).trim();
	if (!inner) return [];
	return splitYamlList(inner, filePath, key).map((item) => parseYamlScalar(item, filePath, key));
}

function splitYamlList(value, filePath, key) {
	const items = [];
	let current = "";
	let quote = "";
	for (let index = 0; index < value.length; index += 1) {
		const char = value[index];
		if (quote) {
			current += char;
			if (char === quote && value[index - 1] !== "\\") quote = "";
		} else if (char === "'" || char === '"') {
			quote = char;
			current += char;
		} else if (char === ",") {
			items.push(current.trim());
			current = "";
		} else current += char;
	}
	if (quote) throw new Error(`${filePath}: unterminated quote in frontmatter ${key}.`);
	items.push(current.trim());
	return items;
}

function parseYamlScalar(raw, filePath, key) {
	const value = stripYamlComment(raw).trim();
	if (!value) return "";
	if (value.startsWith('"')) {
		try { return JSON.parse(value); } catch { throw new Error(`${filePath}: invalid quoted YAML scalar in ${key}.`); }
	}
	if (value.startsWith("'")) {
		if (!value.endsWith("'")) throw new Error(`${filePath}: invalid quoted YAML scalar in ${key}.`);
		return value.slice(1, -1).replaceAll("''", "'");
	}
	if (value === "true") return true;
	if (value === "false") return false;
	if (value === "null" || value === "~") return null;
	return value;
}

function stripYamlComment(value) {
	let quote = "";
	for (let index = 0; index < value.length; index += 1) {
		const char = value[index];
		if (quote) {
			if (char === quote && value[index - 1] !== "\\") quote = "";
		} else if (char === '"' || char === "'") quote = char;
		else if (char === "#" && (index === 0 || /\s/.test(value[index - 1]))) return value.slice(0, index);
	}
	return value;
}

function findNextTopLevel(lines, start, end) {
	for (let index = start; index < end; index += 1) if (/^(?!\s)[A-Za-z0-9_-]+:/.test(lines[index])) return index;
	return end;
}

function yamlScalar(value) {
	return Array.isArray(value) ? `[${value.map((item) => JSON.stringify(item)).join(", ")}]` : JSON.stringify(value);
}

function assertDirectory(path, label) {
	const stat = lstatMaybe(path);
	if (!stat || stat.isSymbolicLink() || !stat.isDirectory()) throw new Error(`${label}: expected a regular directory.`);
}

function assertRegularFile(path, label) {
	const stat = lstatMaybe(path);
	if (!stat || stat.isSymbolicLink() || !stat.isFile()) throw new Error(`${label}: expected a regular file.`);
}

function canonicalDirectory(path, label) {
	if (!path) throw new Error(`${label} path is required.`);
	let canonical;
	try { canonical = realpathSync(resolve(path)); } catch { throw new Error(`${label} does not exist: ${path}`); }
	if (!lstatSync(canonical).isDirectory()) throw new Error(`${label} must be a directory: ${path}`);
	return canonical;
}

function normalizeGitRepository(value) {
	let normalized = value.trim();
	if (/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(?:\.git)?$/.test(normalized)) normalized = `https://github.com/${normalized}`;
	return normalized
		.replace(/^git@([^:]+):/, "https://$1/")
		.replace(/^ssh:\/\//, "https://")
		.replace(/\.git\/?$/, "")
		.replace(/\/$/, "")
		.toLowerCase();
}

function git(cwd, args, label, allowEmpty = false) {
	const result = spawnSync("git", ["-C", cwd, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
	if (result.error || result.status !== 0) {
		if (allowEmpty && result.status === 1 && !result.stdout.trim()) return "";
		throw new Error(`${label}: ${result.stderr?.trim() || result.error?.message || `git exited ${result.status}`}.`);
	}
	return result.stdout.trim();
}

function inventoryInputs(siteDir) {
	const mappings = INPUTS.flatMap((input) => {
		const path = join(siteDir, input.source);
		const stat = lstatMaybe(path);
		return [{ source: input.source, target: input.target, kind: input.kind, present: Boolean(stat), required: input.required, ...(input.exclude ? { excludes: input.exclude } : {}) }];
	});
	const excluded = [];
	const inputs = [];
	const visit = (path) => {
		for (const name of readdirSync(path)) {
			const child = join(path, name);
			const rel = relative(siteDir, child).split(sep).join("/");
			const stat = lstatSync(child);
			if (stat.isSymbolicLink()) continue;
			if (stat.isDirectory()) {
				if (rel === ".git" || rel === ".kirari/core") continue;
				visit(child);
			} else if ([".DS_Store", "package.json", "package-lock.json", "pnpm-lock.yaml", "yarn.lock"].includes(name)) {
				excluded.push({ source: rel, disposition: "excluded-metadata", reason: "OS and package-manager metadata is non-content and is not copied." });
			} else if (stat.isFile()) {
				inputs.push({
					source: rel,
					disposition: "input",
					sha256: createHash("sha256").update(readFileSync(child)).digest("hex"),
				});
			}
		}
	};
	visit(siteDir);
	return [...mappings, ...inputs, ...excluded].sort((left, right) => left.source < right.source ? -1 : left.source > right.source ? 1 : 0);
}

function copyTree(source, target) {
	const stat = lstatSync(source);
	if (stat.isSymbolicLink()) throw new Error(`Site input became a symlink while copying: ${source}`);
	if (stat.isDirectory()) {
		mkdirSync(target, { recursive: true });
		for (const name of readdirSync(source).sort()) if (!isExcludedMetadata(name)) copyTree(join(source, name), join(target, name));
		return;
	}
	if (!stat.isFile()) throw new Error(`Site input has an unsupported file type: ${source}`);
	mkdirSync(dirname(target), { recursive: true });
	copyFileSync(source, target);
}

function copyTreeExcept(source, target, excludedChildren) {
	if (!existsSync(source)) return;
	const stat = lstatSync(source);
	if (stat.isSymbolicLink()) throw new Error(`Site input became a symlink while copying: ${source}`);
	if (!stat.isDirectory()) throw new Error(`Site input must be a directory: ${source}`);
	mkdirSync(target, { recursive: true });
	for (const name of readdirSync(source).sort()) {
		if (excludedChildren.has(name) || isExcludedMetadata(name)) continue;
		copyTree(join(source, name), join(target, name));
	}
}

function validateDirectoryEntries(path, allowed, label) {
	for (const name of readdirSync(path)) {
		if (isExcludedMetadata(name)) continue;
		if (!allowed.has(name)) throw new Error(`${label}/${name}: no Site Contract v2 mapping is defined.`);
	}
}

function isExcludedMetadata(name) {
	return [".DS_Store", "package.json", "package-lock.json", "pnpm-lock.yaml", "yarn.lock"].includes(name);
}

function lstatMaybe(path) {
	try { return lstatSync(path); } catch (error) { if (error.code === "ENOENT") return undefined; throw error; }
}

function isRecord(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
