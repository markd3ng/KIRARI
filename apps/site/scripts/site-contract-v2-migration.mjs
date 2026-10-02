import {
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
import { parse as parseToml, stringify as stringifyToml } from "smol-toml";
import {
	LEGACY_ROUTE_ALIASES,
	SITE_LOCALES,
	parseFrontmatter,
	transformFrontmatter,
} from "./site-contract-v2.mjs";

const LEGACY_TO_CANONICAL = Object.freeze(Object.fromEntries(Object.entries(LEGACY_ROUTE_ALIASES).map(([legacy, canonical]) => [legacy, canonical])));
const CANONICAL_TO_LEGACY = Object.freeze({ en: "en-US", "zh-Hans": "zh-CN", "zh-Hant": "zh-TW", ja: "ja-JP" });
const V1_FIELDS = new Set([
	"title", "slug", "published", "updated", "draft", "toc", "description", "image", "og", "tags",
	"tagLabels", "category", "categoryLabel", "lang", "locale", "translationKey", "mermaid", "notbyai", "comments",
]);
const GENERATED_DIRECTORIES = new Set([".astro", ".cache", ".next", "coverage", "dist", "node_modules", "target"]);
const SECRET_FILE = /^(?:\.env(?:\..*)?|credentials?(?:\..*)?|secrets?(?:\..*)?|id_(?:rsa|ed25519))$|\.(?:key|pem|p12|pfx)$/i;
const EXECUTABLE_FILE = /\.(?:astro|cjs|js|jsx|mjs|php|py|sh|ts|tsx)$/i;
const ALLOWED_ROOTS = new Set([
	"AI_SETUP.md", "README.md", "assets", "content", "data", "kirari.config.toml", "public", "snippets", "scripts", ".github",
]);

export function createSiteProfileMigrationPlan(profileRoot, targetRoot, {
	coreRepository = "markd3ng/KIRARI",
	coreSha,
} = {}) {
	const sourceDir = canonicalDirectory(profileRoot, "Profile source");
	const targetDir = canonicalProspectivePath(targetRoot, "Migration target");
	assertDisjoint(sourceDir, targetDir);
	const blockers = [];
	const targetStat = lstatMaybe(targetDir);
	if (targetStat && (targetStat.isSymbolicLink() || !targetStat.isDirectory() || readdirSync(targetDir).length > 0)) {
		blockers.push({ path: targetDir, reason: "Target must be a new or empty regular directory." });
	}
	if (typeof coreSha !== "string" || !/^[a-f0-9]{40}$/.test(coreSha)) {
		blockers.push({ path: ".kirari/site.toml", reason: "A full lowercase --core-sha is required to write Site Contract metadata." });
	}
	if (typeof coreRepository !== "string" || !coreRepository.trim()) {
		blockers.push({ path: ".kirari/site.toml", reason: "A non-empty --core-repository is required." });
	}

	const configPath = join(sourceDir, "kirari.config.toml");
	let config;
	try { config = parseToml(readFileSync(configPath, "utf8")); }
	catch (error) { blockers.push({ path: "kirari.config.toml", reason: `Cannot parse legacy TOML: ${error.message}` }); }
	const defaultLocale = config ? canonicalLocale(
		config["default-language"] ?? config.site?.["default-language"] ?? config.site?.lang ?? config.i18n?.["default-language"] ?? config.i18n?.defaultLanguage ?? "en-US",
		"kirari.config.toml default locale",
		blockers,
	) : "en";

	const sourceFiles = walkFiles(sourceDir, blockers);
	const entries = [];
	const outputOwners = new Map();
	for (const file of sourceFiles) {
		const source = relative(sourceDir, file).split(sep).join("/");
		const classification = classifyPath(source);
		if (classification.disposition !== "copy") {
			entries.push({ source, disposition: classification.disposition, reason: classification.reason });
			if (classification.blocking) blockers.push({ path: source, reason: classification.reason });
			continue;
		}
		const targets = legacyTargets(source);
		if (!targets.length) {
			const root = source.split("/")[0];
			const reason = !ALLOWED_ROOTS.has(root)
				? "Unsupported Profile-root input; classify it before migrating."
				: "Input has no Site Contract v2 mapping. Classify it before migrating.";
			entries.push({ source, disposition: "unmapped", reason });
			blockers.push({ path: source, reason });
			continue;
		}
		const stat = lstatSync(file);
		if (!stat.isFile()) {
			entries.push({ source, disposition: "unsupported-type", reason: "Only regular files can be migrated." });
			blockers.push({ path: source, reason: "Only regular files can be migrated." });
			continue;
		}
		if (EXECUTABLE_FILE.test(source) && !source.startsWith("snippets/") && source !== "scripts/site-setup.sh") {
			const reason = "Unapproved executable input is excluded; move reviewed trusted snippets under snippets/ or resolve it manually.";
			entries.push({ source, disposition: "excluded-unapproved-executable", reason });
			blockers.push({ path: source, reason });
			continue;
		}
		const mappedTargets = targets.map((target) => canonicalizeLocalePath(target));
		for (const target of mappedTargets) {
			const previous = outputOwners.get(target);
			if (previous && previous !== source) blockers.push({ path: target, reason: `Output path collision between ${previous} and ${source}.` });
			else outputOwners.set(target, source);
		}
		entries.push({
			source,
			targets: mappedTargets,
			disposition: source === "kirari.config.toml" ? "transform-config" : isPostMarkdown(source) ? "transform-content" : "copy",
			sha256: sha256File(file),
		});
	}

	let taxonomy = { version: 1, tags: [], categories: [] };
	if (config) {
		taxonomy = collectTaxonomy(sourceDir, defaultLocale, blockers);
		try { transformLegacyConfig(readFileSync(configPath, "utf8")); }
		catch (error) { blockers.push({ path: "kirari.config.toml", reason: `Configuration cannot be transformed losslessly: ${error.message}` }); }
		for (const entry of entries.filter((item) => item.disposition === "transform-content")) {
			try {
				transformLegacyPost(readFileSync(join(sourceDir, entry.source), "utf8"), entry.source, taxonomy, defaultLocale);
			} catch (error) {
				blockers.push({ path: entry.source, reason: `Frontmatter cannot be transformed losslessly: ${error.message}` });
			}
		}
	}
	for (const generatedPath of ["data/taxonomy.json", "data/route-aliases.json", ".kirari/site.toml"]) {
		if (outputOwners.has(generatedPath)) blockers.push({ path: generatedPath, reason: `Legacy input conflicts with generated migration output from ${outputOwners.get(generatedPath)}.` });
	}
	const generated = [
		{ target: "data/taxonomy.json", reason: "Stable IDs/slugs and localized labels/aliases derived from legacy post taxonomy." },
		{ target: "data/route-aliases.json", reason: "Preserves the accepted legacy locale route mapping." },
		{ target: ".kirari/site.toml", reason: "Core repository/pin metadata; setup-state remains core-init-required until the Git submodule is installed." },
		{ target: "content/pages/", reason: "Preserves content/spec/ under the generic v2 pages owner; an empty directory is valid." },
	];
	const exclusions = entries.filter((entry) => entry.disposition.startsWith("excluded") || entry.disposition === "metadata");
	return {
		version: 1,
		migration: "site-profile-v1-to-site-contract-v2",
		sourceRoot: sourceDir,
		targetRoot: targetDir,
		core: { repository: coreRepository, commit: coreSha ?? null },
		setup: { requiredBeforeBuild: ["create or preserve the repository-root .gitmodules entry", "initialize .kirari/core at the declared Core commit", "set setup-state to ready"] },
		defaultLocale,
		legacyRouteAliases: { ...LEGACY_ROUTE_ALIASES },
		entries: entries.sort((left, right) => left.source.localeCompare(right.source)),
		generated,
		exclusions,
		blockers: deduplicateBlockers(blockers),
		decisions: [
			"Profile package metadata and .DS_Store files are non-content and excluded.",
			"Generated output, secrets, Core files, and unapproved executable code are excluded and reported.",
			"Legacy route aliases map to canonical locale identities; zh-HK remains an explicit zh-Hant alias.",
			"TOML is serialized deterministically after moving the default locale to [site] and normalizing language tables; TOML comments are not copied.",
			"Source files are re-hashed after writes; migration never modifies its source tree.",
		],
	};
}

export function migrateSiteProfileToV2(profileRoot, targetRoot, {
	reportPath,
	apply = false,
	coreRepository = "markd3ng/KIRARI",
	coreSha,
} = {}) {
	const plan = createSiteProfileMigrationPlan(profileRoot, targetRoot, { coreRepository, coreSha });
	if (!reportPath) throw new Error("A reportPath is required; write the inventory report before any migration output.");
	const report = canonicalProspectivePath(reportPath, "Migration report");
	assertDisjoint(plan.sourceRoot, report);
	assertDisjoint(plan.targetRoot, report);
	const reportStat = lstatMaybe(report);
	if (reportStat) throw new Error(`Migration report already exists: ${report}`);
	if (plan.blockers.length > 0) {
		mkdirSync(dirname(report), { recursive: true });
		writeFileSync(report, `${JSON.stringify(plan, null, 2)}\n`, { flag: "wx" });
		return { plan, report, applied: false };
	}
	mkdirSync(dirname(report), { recursive: true });
	writeFileSync(report, `${JSON.stringify(plan, null, 2)}\n`, { flag: "wx" });
	if (!apply) return { plan, report, applied: false };
	assertSourceUnchanged(plan);
	writeMigrationTree(plan);
	assertSourceUnchanged(plan);
	return { plan, report, applied: true };
}

function classifyPath(path) {
	const parts = path.split("/");
	const basename = parts.at(-1);
	if (basename === ".DS_Store") return { disposition: "metadata", reason: "macOS Finder metadata is non-content and excluded." };
	if (["package.json", "package-lock.json", "pnpm-lock.yaml", "yarn.lock"].includes(basename)) {
		return { disposition: "metadata", reason: "Profile package/tooling metadata is non-content and excluded." };
	}
	if (SECRET_FILE.test(basename)) return { disposition: "excluded-secret", reason: "Secret-like input is excluded from migration and requires manual handling.", blocking: true };
	if (parts.some((part) => GENERATED_DIRECTORIES.has(part))) return { disposition: "excluded-generated", reason: "Generated/build output is excluded from Site content." };
	if (parts[0] === ".git" || path === ".kirari/core" || path.startsWith(".kirari/core/")) return { disposition: "excluded-core", reason: "Git/Core metadata is not Site-owned migration content." };
	if (path.startsWith("scripts/") && path !== "scripts/site-setup.sh") return { disposition: "excluded-unapproved-executable", reason: "Only scripts/site-setup.sh is an approved bootstrap input.", blocking: true };
	if (path.startsWith(".github/") && path !== ".github/workflows/site-ci.yml") return { disposition: "excluded-unapproved-executable", reason: "Only .github/workflows/site-ci.yml is an approved workflow input.", blocking: true };
	if (path === "kirari.config.toml" || path === "ads.txt" || ALLOWED_ROOTS.has(parts[0])) return { disposition: "copy" };
	if (path.startsWith(".")) return { disposition: "unmapped", reason: "Unknown root metadata must be classified before migration.", blocking: true };
	return { disposition: "copy" };
}

function legacyTargets(path) {
	if (path === "kirari.config.toml") return [path];
	if (path === "ads.txt") return ["public/ads.txt"];
	if (path.startsWith("content/spec/")) return [path.replace(/^content\/spec\//, "content/pages/")];
	if (["content/posts", "content/spec"].includes(path)) return [path.replace("content/spec", "content/pages")];
	if (path.startsWith("assets/images/devices/")) return [path];
	if (["assets/images", "assets/favicon", "assets/og", "snippets", "public", "data", "content/posts", "content/pages", "assets/branding"].some((root) => path === root || path.startsWith(`${root}/`))) {
		return [path];
	}
	if (path === "AI_SETUP.md" || path === "README.md" || path === "scripts/site-setup.sh" || path === ".github/workflows/site-ci.yml") return [path];
	return [];
}

function canonicalizeLocalePath(path) {
	for (const root of ["content/posts/", "content/pages/"]) {
		if (!path.startsWith(root)) continue;
		const remainder = path.slice(root.length);
		const slash = remainder.indexOf("/");
		const first = slash < 0 ? remainder : remainder.slice(0, slash);
		const locale = canonicalLocaleOrUndefined(first);
		if (locale && slash >= 0) return `${root}${locale}${remainder.slice(slash)}`;
	}
	return path;
}

function collectTaxonomy(sourceDir, defaultLocale, blockers) {
	const groups = { tags: new Map(), categories: new Map() };
	const postsRoot = join(sourceDir, "content/posts");
	for (const file of walkMarkdown(postsRoot)) {
		const relativePath = relative(sourceDir, file).split(sep).join("/");
		let parsed;
		try { parsed = parseFrontmatter(readFileSync(file, "utf8"), relativePath); }
		catch (error) { blockers.push({ path: relativePath, reason: error.message }); continue; }
		if (parsed.end < 0) {
			blockers.push({ path: relativePath, reason: "Legacy post has no YAML frontmatter; semantic fields cannot be migrated losslessly." });
			continue;
		}
		for (const field of parsed.fields.keys()) if (!V1_FIELDS.has(field)) blockers.push({ path: relativePath, reason: `Unsupported legacy frontmatter field ${field}.` });
		const fields = parsed.fields;
		const localeValue = fields.get("locale")?.value ?? fields.get("lang")?.value ?? defaultLocale;
		const locale = canonicalLocale(localeValue, `${relativePath} locale`, blockers);
		const tags = fields.get("tags")?.value ?? [];
		if (!Array.isArray(tags)) {
			blockers.push({ path: relativePath, reason: "Legacy tags must be a supported YAML list." });
			continue;
		}
		const tagLabels = fields.get("tagLabels")?.value ?? {};
		if (!isRecord(tagLabels)) blockers.push({ path: relativePath, reason: "Legacy tagLabels must be a simple YAML mapping." });
		if (isRecord(tagLabels)) {
			for (const [rawTag, label] of Object.entries(tagLabels)) addTaxonomyTerm(groups.tags, "tag", rawTag, locale, label, relativePath, blockers);
		}
		for (const rawTag of tags) addTaxonomyTerm(groups.tags, "tag", rawTag, locale, undefined, relativePath, blockers);
		const category = fields.get("category")?.value;
		const categoryLabel = fields.get("categoryLabel")?.value;
		if (category !== undefined && category !== null && category !== "") addTaxonomyTerm(groups.categories, "category", category, locale, categoryLabel, relativePath, blockers);
		else if (categoryLabel !== undefined && categoryLabel !== "") blockers.push({ path: relativePath, reason: "categoryLabel has no category ID to attach to." });
	}
	return {
		version: 1,
		tags: [...groups.tags.values()].map(finalizeTerm).sort((a, b) => a.slug.localeCompare(b.slug)),
		categories: [...groups.categories.values()].map(finalizeTerm).sort((a, b) => a.slug.localeCompare(b.slug)),
	};
}

function addTaxonomyTerm(group, kind, rawValue, locale, label, source, blockers) {
	if (typeof rawValue !== "string" || !rawValue.trim()) {
		blockers.push({ path: source, reason: `Legacy ${kind} values must be non-empty strings.` });
		return;
	}
	const raw = rawValue.trim();
	const slug = raw.normalize("NFKC").toLowerCase();
	const allowed = kind === "category" ? /^[a-z0-9]+(?:[-_/][a-z0-9]+)*$/ : /^[a-z0-9]+(?:[-_][a-z0-9]+)*$/;
	if (!allowed.test(slug)) {
		blockers.push({ path: source, reason: `Legacy ${kind} ${JSON.stringify(raw)} has no lossless ASCII URL slug; assign one before migration.` });
		return;
	}
	const idSuffix = slug.replaceAll("/", ".").replaceAll("_", "-");
	const id = `${kind === "tag" ? "tag" : "category"}:${idSuffix}`;
	const term = group.get(slug) ?? { id, slug, labels: {}, aliases: {} };
	term.aliases[locale] ??= new Set();
	term.aliases[locale].add(raw);
	if (label !== null && label !== undefined) {
		if (typeof label !== "string" || !label.trim()) {
			blockers.push({ path: source, reason: `Legacy ${kind} label for ${raw} must be a non-empty string.` });
		} else {
			setLocalizedLabel(term, locale, label.trim(), source, kind, blockers);
		}
	} else if (!term.labels[locale]) {
		term.labels[locale] = raw;
	}
	group.set(slug, term);
}

function setLocalizedLabel(term, locale, label, source, kind, blockers) {
	const old = term.labels[locale];
	if (old && old !== label) blockers.push({ path: source, reason: `Conflicting ${kind} label for ${term.slug} in ${locale}: ${JSON.stringify(old)} vs ${JSON.stringify(label)}.` });
	else term.labels[locale] = label;
}

function finalizeTerm(term) {
	if (!Object.keys(term.labels).length) term.labels.en = term.slug;
	return {
		id: term.id,
		slug: term.slug,
		labels: sortObject(term.labels),
		descriptions: {},
		aliases: sortObject(Object.fromEntries(Object.entries(term.aliases).map(([locale, values]) => [locale, [...values].sort()]))),
	};
}

function transformLegacyConfig(source) {
	const config = parseToml(source);
	const rootDefaultLocale = config["default-language"];
	config.site ??= {};
	config.i18n ??= {};
	const defaultLocale = canonicalLocale(
		rootDefaultLocale ?? config.site["default-language"] ?? config.site.lang ?? config.i18n["default-language"] ?? config.i18n.defaultLanguage ?? "en-US",
		"kirari.config.toml default locale",
		[],
	);
	config.site["default-language"] = defaultLocale;
	delete config["default-language"];
	delete config.site.lang;
	delete config.i18n["default-language"];
	delete config.i18n.defaultLanguage;
	delete config.i18n.defaultLang;
	const sourceLanguages = isRecord(config.i18n.languages) ? config.i18n.languages : {};
	const languages = {};
	for (const [key, value] of Object.entries(sourceLanguages)) {
		if (key === "zh-HK") continue;
		const canonical = canonicalLocaleOrUndefined(key);
		if (canonical) {
			if (languages[canonical]) throw new Error(`Two legacy language entries map to canonical locale ${canonical}.`);
			languages[canonical] = withoutCoreImplementationPaths({ ...value, locale: canonical });
		} else if (Object.hasOwn(LEGACY_ROUTE_ALIASES, key)) {
			throw new Error(`Unsupported legacy language entry ${key}.`);
		} else {
			throw new Error(`Unsupported legacy language entry ${key}.`);
		}
	}
	const defaults = {
		"zh-Hans": { label: "简体中文", direction: "ltr", weight: 2 },
		"zh-Hant": { label: "繁體中文", direction: "ltr", weight: 3 },
		en: { label: "English", direction: "ltr", weight: 1 },
		ja: { label: "日本語", direction: "ltr", weight: 4 },
	};
	for (const locale of SITE_LOCALES) {
		languages[locale] ??= { ...defaults[locale], locale, disabled: locale !== defaultLocale };
		languages[locale] = withoutCoreImplementationPaths(languages[locale]);
		languages[locale].locale = locale;
		if (locale === defaultLocale) languages[locale].disabled = false;
	}
	config.i18n.languages = sortObject(languages);
	return stringifyToml(config);
}

function transformLegacyPost(source, relativePath, taxonomy, defaultLocale) {
	const tagIds = new Map(taxonomy.tags.flatMap((item) => item.aliases ? Object.entries(item.aliases).flatMap(([, aliases]) => aliases.map((alias) => [alias, item.id])) : []));
	const categoryIds = new Map(taxonomy.categories.flatMap((item) => Object.entries(item.aliases ?? {}).flatMap(([, aliases]) => aliases.map((alias) => [alias, item.id]))));
	const canonicalTags = new Map(taxonomy.tags.map((item) => [item.slug, item.id]));
	const canonicalCategories = new Map(taxonomy.categories.map((item) => [item.slug, item.id]));
	return transformFrontmatter(source, relativePath, (fields) => {
		const oldLocale = fields.get("locale")?.value ?? fields.get("lang")?.value ?? defaultLocale;
		const locale = canonicalLocale(oldLocale, `${relativePath} locale`, []);
		const tags = fields.get("tags")?.value ?? [];
		const category = fields.get("category")?.value;
		return {
			tags: fields.has("tags") ? tags.map((tag) => canonicalTags.get(normalizeTermKey(tag)) ?? tagIds.get(tag) ?? `tag:${normalizeTermKey(tag)}`) : undefined,
			category: category ? canonicalCategories.get(normalizeTermKey(category)) ?? categoryIds.get(category) ?? `category:${normalizeTermKey(category)}` : undefined,
			lang: undefined,
			tagLabels: undefined,
			categoryLabel: undefined,
			locale,
		};
	});
}

function withoutCoreImplementationPaths(language) {
	const result = { ...language };
	delete result.contentDir;
	delete result["content-dir"];
	return result;
}

function writeMigrationTree(plan) {
	mkdirSync(plan.targetRoot, { recursive: true });
	const sourceDir = plan.sourceRoot;
	const taxonomy = collectTaxonomy(sourceDir, plan.defaultLocale, []);
	for (const entry of plan.entries) {
		if (!entry.targets || !["copy", "transform-config", "transform-content"].includes(entry.disposition)) continue;
		const source = join(sourceDir, entry.source);
		const content = entry.disposition === "transform-config"
			? transformLegacyConfig(readFileSync(source, "utf8"))
			: entry.disposition === "transform-content"
				? transformLegacyPost(readFileSync(source, "utf8"), entry.source, taxonomy, plan.defaultLocale)
				: readFileSync(source);
		for (const target of entry.targets) {
			const output = join(plan.targetRoot, target);
			mkdirSync(dirname(output), { recursive: true });
			writeFileSync(output, content, { flag: "wx" });
		}
	}
	mkdirSync(join(plan.targetRoot, "content/pages"), { recursive: true });
	mkdirSync(join(plan.targetRoot, "content/posts"), { recursive: true });
	mkdirSync(join(plan.targetRoot, "data"), { recursive: true });
	writeFileSync(join(plan.targetRoot, "data/taxonomy.json"), `${JSON.stringify(taxonomy, null, 2)}\n`, { flag: "wx" });
	writeFileSync(join(plan.targetRoot, "data/route-aliases.json"), `${JSON.stringify({ version: 1, legacyRouteAliases: LEGACY_ROUTE_ALIASES }, null, 2)}\n`, { flag: "wx" });
	mkdirSync(join(plan.targetRoot, ".kirari"), { recursive: true });
	writeFileSync(join(plan.targetRoot, ".kirari/site.toml"), [
		"schema-version = 2",
		"setup-state = \"core-init-required\"",
		"",
		"[core]",
		`repository = ${JSON.stringify(plan.core.repository)}`,
		`commit = ${JSON.stringify(plan.core.commit)}`,
		"",
	].join("\n"), { flag: "wx" });
}

function canonicalLocale(value, label, blockers) {
	if (typeof value !== "string" || !value.trim()) {
		blockers.push({ path: label, reason: "Legacy locale is missing or not a string." });
		return "en";
	}
	const canonical = LEGACY_ROUTE_ALIASES[value] ?? (SITE_LOCALES.includes(value) ? value : undefined);
	if (!canonical) {
		blockers.push({ path: label, reason: `Unsupported legacy locale ${value}; preserve it through an accepted route alias before migration.` });
		return "en";
	}
	return canonical;
}

function canonicalLocaleOrUndefined(value) {
	return LEGACY_ROUTE_ALIASES[value] ?? (SITE_LOCALES.includes(value) ? value : undefined);
}

function normalizeTermKey(value) {
	return typeof value === "string" ? value.trim().normalize("NFKC").toLowerCase() : "";
}

function isPostMarkdown(path) {
	return path.startsWith("content/posts/") && /\.(?:md|mdx)$/i.test(path);
}

function walkMarkdown(path) {
	if (!existsSync(path)) return [];
	return walkFiles(path, []).filter((file) => /\.(?:md|mdx)$/i.test(file));
}

function walkFiles(root, blockers) {
	if (!existsSync(root)) return [];
	const files = [];
	const visit = (path) => {
		for (const name of readdirSync(path).sort()) {
			const child = join(path, name);
			const stat = lstatSync(child);
			const rel = relative(root, child).split(sep).join("/");
			if (stat.isSymbolicLink()) {
				blockers.push({ path: rel, reason: "Symbolic links are not supported in the migration inventory." });
				continue;
			}
			if (stat.isDirectory()) {
				if (GENERATED_DIRECTORIES.has(name) || name === ".git" || rel === ".kirari/core") {
					files.push(child);
					continue;
				}
				visit(child);
			} else if (stat.isFile()) files.push(child);
			else blockers.push({ path: rel, reason: "Special files are not supported in the migration inventory." });
		}
	};
	visit(root);
	return files.sort((left, right) => left.localeCompare(right));
}

function assertSourceUnchanged(plan) {
	const current = walkFiles(plan.sourceRoot, []);
	const expected = plan.entries.filter((entry) => entry.sha256).map((entry) => [entry.source, entry.sha256]).sort((a, b) => a[0].localeCompare(b[0]));
	const actual = current.flatMap((file) => {
		const source = relative(plan.sourceRoot, file).split(sep).join("/");
		if (classifyPath(source).disposition !== "copy") return [];
		return [[source, sha256File(file)]];
	}).sort((a, b) => a[0].localeCompare(b[0]));
	if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error("Profile source changed during migration; no source files were modified by the migrator.");
}

function assertDisjoint(first, second) {
	const left = resolve(first);
	const right = resolve(second);
	const rightToLeft = relative(left, right);
	const leftToRight = relative(right, left);
	if (rightToLeft === "" || (rightToLeft !== ".." && !rightToLeft.startsWith(`..${sep}`) && !isAbsolute(rightToLeft))
		|| leftToRight === "" || (leftToRight !== ".." && !leftToRight.startsWith(`..${sep}`) && !isAbsolute(leftToRight))) {
		throw new Error("Migration source, target, and report paths must be disjoint.");
	}
}

function canonicalDirectory(path, label) {
	if (!path) throw new Error(`${label} path is required.`);
	try {
		const canonical = realpathSync(resolve(path));
		if (!lstatSync(canonical).isDirectory()) throw new Error();
		return canonical;
	} catch { throw new Error(`${label} does not exist or is not a directory: ${path}`); }
}

function canonicalProspectivePath(path, label) {
	if (!path) throw new Error(`${label} path is required.`);
	const absolute = resolve(path);
	for (let current = absolute; ; current = dirname(current)) {
		const stat = lstatMaybe(current);
		const macOSSystemAlias = process.platform === "darwin" && [resolve("/tmp"), resolve("/var")].includes(current);
		if (stat?.isSymbolicLink() && !macOSSystemAlias) throw new Error(`${label} path must not traverse a symlink: ${current}`);
		if (current === dirname(current)) break;
	}
	let current = absolute;
	const missing = [];
	while (!lstatMaybe(current)) {
		const parent = dirname(current);
		if (parent === current) throw new Error(`Cannot resolve ${label} path: ${path}`);
		missing.unshift(current.slice(parent.length + 1));
		current = parent;
	}
	const realCurrent = realpathSync(current);
	if (missing.length && !lstatSync(realCurrent).isDirectory()) throw new Error(`${label} parent must be a directory: ${current}`);
	return resolve(realCurrent, ...missing);
}

function sha256File(path) {
	return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function sortObject(value) {
	return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)));
}

function deduplicateBlockers(blockers) {
	const byKey = new Map();
	for (const blocker of blockers) byKey.set(`${blocker.path}\0${blocker.reason}`, blocker);
	return [...byKey.values()].sort((a, b) => a.path.localeCompare(b.path) || a.reason.localeCompare(b.reason));
}

function isRecord(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function lstatMaybe(path) {
	try { return lstatSync(path); } catch (error) { if (error.code === "ENOENT") return undefined; throw error; }
}
