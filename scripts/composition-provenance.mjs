import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { lstatSync, readFileSync, readdirSync, realpathSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { parse } from "parse5";

const SHA1 = /^[a-f0-9]{40}$/;
const SHA256 = /^sha256:[a-f0-9]{64}$/;
const MANIFEST_KEYS = ["schema_version", "core", "site", "site_schema_version", "build", "artifact"];
const GIT_IDENTITY_KEYS = ["kind", "repository", "requested_ref", "resolved_sha"];
const ARTIFACT_KEYS = ["id", "format", "digest_algorithm", "scope", "digest"];
const BUILD_KEYS = ["toolchain", "configuration"];
const TOOLCHAIN_KEYS = ["node", "pnpm", "platform", "architecture", "lockfile"];
const LOCKFILE_KEYS = ["path", "digest"];
const CONFIGURATION_KEYS = ["entrypoint", "build_mode", "output", "build_only", "indexing_submissions", "inherited_environment_digest", "build_clock"];
const BUILD_CLOCK_KEYS = ["source", "source_date_epoch", "timezone"];
const ARTIFACT_FORMAT = "static-site-tree";
const ARTIFACT_SCOPE = "dist-tree-excluding-provenance.json+bare-astro-island-uid+pagefind-language-order-and-json-reserialization";
const NORMALIZED_UID = Buffer.from("normalized");
const HTML_NAMESPACE = "http://www.w3.org/1999/xhtml";
const BUILD_ENVIRONMENT_ALLOWLIST = new Set([
	"PATH", "HOME", "TMPDIR", "TMP", "TEMP", "LANG", "LC_ALL", "LC_CTYPE",
	"CI", "FORCE_COLOR", "NO_COLOR", "NODE_OPTIONS", "NODE_ENV", "VERCEL", "CF_PAGES", "PAGES",
]);

export function selectBuildEnvironment(environment = process.env) {
	return Object.fromEntries(
		Object.entries(environment)
			.filter(([name]) => BUILD_ENVIRONMENT_ALLOWLIST.has(name) || name.startsWith("PUBLIC_"))
			.sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0)),
	);
}

export function digestBuildEnvironment(environment = process.env) {
	return `sha256:${createHash("sha256").update(JSON.stringify(selectBuildEnvironment(environment))).digest("hex")}`;
}

export function resolveGitInput({ directory, requestedRef, label = "Git input" } = {}) {
	const inputDirectory = canonicalDirectory(directory, `${label} path`);
	const checkoutRoot = gitOutput(inputDirectory, ["rev-parse", "--show-toplevel"], `${label} repository`);
	const canonicalRoot = canonicalDirectory(checkoutRoot, `${label} checkout`);
	if (typeof requestedRef !== "string" || !requestedRef.trim()) {
		throw new Error(`${label} ref: a local branch, tag, or commit ref is required.`);
	}
	if (requestedRef !== requestedRef.trim() || /[\0\r\n]/.test(requestedRef)) {
		throw new Error(`${label} ref: ${JSON.stringify(requestedRef)} is not a valid ref string.`);
	}
	const status = gitOutput(
		canonicalRoot,
		["status", "--porcelain=v1", "--untracked-files=all", "--ignore-submodules=none"],
		`${label} checkout status`,
	);
	if (status) {
		const lines = status.split("\n");
		const changedPaths = lines.slice(0, 5).map((line) => line.slice(3));
		const more = lines.length > changedPaths.length ? ` and ${lines.length - changedPaths.length} more` : "";
		throw new Error(`${label} checkout is dirty; commit or remove changes before building: ${changedPaths.join(", ")}${more}`);
	}

	const resolvedSha = gitOutput(
		canonicalRoot,
		["rev-parse", "--verify", "--end-of-options", `${requestedRef}^{commit}`],
		`${label} ref ${JSON.stringify(requestedRef)}`,
	);
	const headSha = gitOutput(canonicalRoot, ["rev-parse", "--verify", "HEAD^{commit}"], `${label} checkout HEAD`);
	if (!SHA1.test(resolvedSha) || !SHA1.test(headSha)) {
		throw new Error(`${label} ref: Git did not return a full 40-character commit SHA for ${JSON.stringify(requestedRef)}.`);
	}
	if (resolvedSha !== headSha) {
		throw new Error(
			`${label} ref: ${JSON.stringify(requestedRef)} resolves to ${resolvedSha}, but checkout HEAD is ${headSha}. Check out the requested commit before building.`,
		);
	}

	return {
		kind: "git",
		repository: gitRepository(canonicalRoot),
		requested_ref: requestedRef,
		resolved_sha: resolvedSha,
		checkout_root: canonicalRoot,
	};
}

export function resolveSiteInput({ directory, requestedRef } = {}) {
	const siteDirectory = canonicalDirectory(directory, "Site input path");
	if (requestedRef !== undefined && requestedRef !== null && typeof requestedRef !== "string") {
		throw new Error("Site ref: requested ref must be a string when supplied.");
	}
	let checkoutRoot;
	try {
		checkoutRoot = gitOutput(siteDirectory, ["rev-parse", "--show-toplevel"], "Site repository");
	} catch (error) {
		if (error.cause?.code === "ENOENT") throw error;
		if (hasGitMarker(siteDirectory) || isBareRepository(siteDirectory)) {
			throw new Error(`Site repository: Git metadata is present, but this directory is not a usable checkout: ${error.message}`, { cause: error });
		}
		if (typeof requestedRef === "string" && requestedRef.length > 0) {
			throw new Error(`Site ref: ${JSON.stringify(requestedRef)} was supplied for a non-Git Site directory. Omit --site-ref or provide a Git checkout.`);
		}
		return {
			kind: "content",
			repository: null,
			requested_ref: null,
			resolved_sha: null,
			source_subdirectory: ".",
			content_digest: digestFileTree(siteDirectory),
		};
	}

	const gitIdentity = resolveGitInput({ directory: siteDirectory, requestedRef, label: "Site" });
	const sourceSubdirectory = relative(gitIdentity.checkout_root, siteDirectory).split(sep).join("/") || ".";
	return { ...gitIdentity, source_subdirectory: sourceSubdirectory };
}

export function digestFileTree(directory) {
	return digestTree(directory, "kirari-file-tree-v1", (relativePath, contents) => contents);
}

export function digestArtifactTree(directory) {
	return digestTree(directory, "kirari-artifact-tree-v1", normalizeArtifactContent);
}

function digestTree(directory, domain, normalizeContent) {
	const root = canonicalDirectory(directory, "Content tree path");
	const files = [];
	const walk = (current) => {
		for (const name of readdirSync(current).sort()) {
			const absolutePath = join(current, name);
			const stat = lstatSync(absolutePath);
			const relativePath = relative(root, absolutePath).split(sep).join("/");
			if (stat.isSymbolicLink()) throw new Error(`Content tree contains a symlink: ${relativePath}`);
			if (stat.isDirectory()) walk(absolutePath);
			else if (stat.isFile()) files.push({ absolutePath, relativePath });
			else throw new Error(`Content tree contains a special file: ${relativePath}`);
		}
	};
	walk(root);
	files.sort((left, right) => (left.relativePath < right.relativePath ? -1 : left.relativePath > right.relativePath ? 1 : 0));

	const hash = createHash("sha256");
	hash.update(`${domain}\0`);
	for (const file of files) {
		const pathBytes = Buffer.from(file.relativePath, "utf8");
		const contents = normalizeContent(file.relativePath, readFileSync(file.absolutePath));
		hash.update(uint64(pathBytes.length));
		hash.update(pathBytes);
		hash.update(uint64(contents.length));
		hash.update(contents);
	}
	return `sha256:${hash.digest("hex")}`;
}

function normalizeArtifactContent(relativePath, contents) {
	if (relativePath.endsWith(".html")) {
		return normalizeAstroIslandUids(contents);
	}
	if (relativePath === "pagefind/pagefind-entry.json") {
		const entry = JSON.parse(contents.toString("utf8"));
		entry.languages = Object.fromEntries(Object.entries(entry.languages).sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0));
		return Buffer.from(JSON.stringify(entry));
	}
	return contents;
}

function normalizeAstroIslandUids(contents) {
	const source = contents.toString("utf8");
	if (!Buffer.from(source).equals(contents)) return contents;

	const parseErrors = [];
	const document = parse(source, { sourceCodeLocationInfo: true, onParseError: (error) => parseErrors.push(error) });
	const uidRanges = [];
	const visit = (node) => {
		if (node.namespaceURI === HTML_NAMESPACE && node.tagName === "astro-island") {
			const startTag = node.sourceCodeLocation?.startTag;
			const uidLocation = startTag?.attrs?.uid;
			const malformed = startTag && parseErrors.some((error) => error.code !== "missing-doctype" && error.startOffset >= startTag.startOffset && error.startOffset < startTag.endOffset);
			const range = malformed ? null : quotedAttributeValueRange(source, uidLocation);
			if (range) uidRanges.push(range);
		}
		for (const child of node.childNodes ?? []) visit(child);
		// Template contents can be cloned and inspected by Site JavaScript.
	};
	visit(document);
	if (uidRanges.length === 0) return contents;
	uidRanges.sort((left, right) => left.start - right.start);

	const offsets = utf16OffsetsToBytes(source, uidRanges.flatMap(({ start, end }) => [start, end]));
	if (!offsets) return contents;
	const parts = [];
	let cursor = 0;
	for (const { start, end } of uidRanges) {
		const byteStart = offsets.get(start);
		const byteEnd = offsets.get(end);
		parts.push(contents.subarray(cursor, byteStart), NORMALIZED_UID);
		cursor = byteEnd;
	}
	parts.push(contents.subarray(cursor));
	return Buffer.concat(parts);
}

function quotedAttributeValueRange(source, location) {
	if (!location) return null;
	const attribute = source.slice(location.startOffset, location.endOffset);
	const equals = attribute.indexOf("=");
	if (equals === -1) return null;
	let index = equals + 1;
	while (/\s/.test(attribute[index] ?? "")) index++;
	const quote = attribute[index];
	if (quote !== '"' && quote !== "'") return null;
	const end = attribute.lastIndexOf(quote);
	if (end <= index || end !== attribute.length - 1) return null;
	return { start: location.startOffset + index + 1, end: location.startOffset + end };
}

function utf16OffsetsToBytes(source, offsets) {
	const result = new Map();
	let sourceOffset = 0;
	let byteOffset = 0;
	for (const targetOffset of [...new Set(offsets)].sort((left, right) => left - right)) {
		while (sourceOffset < targetOffset) {
			const codePoint = source.codePointAt(sourceOffset);
			const codeUnits = codePoint > 0xffff ? 2 : 1;
			if (sourceOffset + codeUnits > targetOffset) return null;
			sourceOffset += codeUnits;
			byteOffset += codePoint <= 0x7f ? 1 : codePoint <= 0x7ff ? 2 : codePoint <= 0xffff ? 3 : 4;
		}
		result.set(targetOffset, byteOffset);
	}
	return result;
}

export function createProvenanceManifest({ core, site, siteSchemaVersion, toolchain, configuration, artifactId, artifactDigest } = {}) {
	const manifest = {
		schema_version: 2,
		core: manifestGitIdentity(core, "Core"),
		site: manifestSiteIdentity(site),
		site_schema_version: siteSchemaVersion,
		build: { toolchain: cloneJsonObject(toolchain, "build.toolchain"), configuration: cloneJsonObject(configuration, "build.configuration") },
		artifact: {
			id: artifactId,
			format: ARTIFACT_FORMAT,
			digest_algorithm: "sha256",
			scope: ARTIFACT_SCOPE,
			digest: artifactDigest,
		},
	};
	validateProvenanceManifest(manifest);
	return manifest;
}

export function validateProvenanceManifest(manifest, expected) {
	assertRecord(manifest, "manifest");
	assertExactKeys(manifest, MANIFEST_KEYS, "manifest");
	if (manifest.schema_version !== 2) invalid("schema_version must be 2");
	validateGitIdentity(manifest.core, "core");
	validateSiteIdentity(manifest.site);
	if (!Number.isInteger(manifest.site_schema_version) || manifest.site_schema_version < 1) {
		invalid("site_schema_version must be a positive integer");
	}
	assertRecord(manifest.build, "build");
	assertExactKeys(manifest.build, BUILD_KEYS, "build");
	validateToolchain(manifest.build.toolchain);
	validateBuildConfiguration(manifest.build.configuration);
	assertRecord(manifest.artifact, "artifact");
	assertExactKeys(manifest.artifact, ARTIFACT_KEYS, "artifact");
	validateArtifactId(manifest.artifact.id);
	if (manifest.artifact.format !== ARTIFACT_FORMAT) invalid(`artifact.format must be ${JSON.stringify(ARTIFACT_FORMAT)}`);
	if (manifest.artifact.digest_algorithm !== "sha256") invalid('artifact.digest_algorithm must be "sha256"');
	if (manifest.artifact.scope !== ARTIFACT_SCOPE) invalid(`artifact.scope must be ${JSON.stringify(ARTIFACT_SCOPE)}`);
	if (typeof manifest.artifact.digest !== "string" || !SHA256.test(manifest.artifact.digest)) {
		invalid("artifact.digest must be sha256 followed by 64 lowercase hexadecimal characters");
	}

	if (expected !== undefined) validateExpected(manifest, expected);
	return true;
}

function validateArtifactId(value) {
	if (typeof value !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(value)) {
		invalid("artifact.id must start with a letter or digit and contain only letters, digits, dots, underscores, or hyphens");
	}
}

function canonicalDirectory(directory, label) {
	if (typeof directory !== "string" || !directory.trim()) throw new Error(`${label}: a directory path is required.`);
	const absolute = resolve(directory);
	let stat;
	try {
		stat = lstatSync(absolute);
	} catch {
		throw new Error(`${label}: directory does not exist: ${directory}`);
	}
	if (stat.isSymbolicLink()) throw new Error(`${label}: directory must not be a symlink: ${directory}`);
	if (!stat.isDirectory()) throw new Error(`${label}: path is not a directory: ${directory}`);
	try {
		return realpathSync(absolute);
	} catch (error) {
		throw new Error(`${label}: cannot resolve directory ${directory}: ${error.message}`, { cause: error });
	}
}

function gitOutput(directory, args, stage) {
	try {
		const output = execFileSync("git", ["-C", directory, ...args], {
			encoding: "utf8",
			stdio: ["ignore", "pipe", "pipe"],
		});
		return output.replace(/\r?\n$/, "");
	} catch (error) {
		const detail = error.stderr?.toString().trim() || error.message;
		throw new Error(`${stage}: Git could not resolve the requested input at ${directory}: ${detail}`, { cause: error });
	}
}

function gitRepository(checkoutRoot) {
	try {
		const remote = execFileSync("git", ["-C", checkoutRoot, "config", "--get", "remote.origin.url"], {
			encoding: "utf8",
			stdio: ["ignore", "pipe", "pipe"],
		}).trim();
		return normalizeRepository(remote);
	} catch {
		return null;
	}
}

function normalizeRepository(remote) {
	if (!remote || isAbsolute(remote)) return null;
	try {
		const url = new URL(remote);
		if (url.protocol === "file:") return null;
		url.username = "";
		url.password = "";
		url.search = "";
		url.hash = "";
		return url.toString().replace(/\/$/, "");
	} catch {
		return remote.replace(/^[^@/]+@([^:]+):/, "$1:");
	}
}

function hasGitMarker(directory) {
	for (let current = directory; ; current = dirname(current)) {
		try {
			lstatSync(join(current, ".git"));
			return true;
		} catch {
			if (dirname(current) === current) return false;
		}
	}
}

function isBareRepository(directory) {
	try {
		return gitOutput(directory, ["rev-parse", "--is-bare-repository"], "Site repository") === "true";
	} catch {
		return false;
	}
}

function uint64(value) {
	const buffer = Buffer.alloc(8);
	buffer.writeBigUInt64BE(BigInt(value));
	return buffer;
}

function manifestGitIdentity(identity, label) {
	assertRecord(identity, label);
	const result = {
		kind: identity.kind,
		repository: identity.repository,
		requested_ref: identity.requested_ref,
		resolved_sha: identity.resolved_sha,
	};
	validateGitIdentity(result, label.toLowerCase());
	return result;
}

function manifestSiteIdentity(identity) {
	assertRecord(identity, "Site identity");
	if (identity.kind === "git") {
		const result = {
			kind: identity.kind,
			repository: identity.repository,
			requested_ref: identity.requested_ref,
			resolved_sha: identity.resolved_sha,
			source_subdirectory: identity.source_subdirectory,
		};
		validateSiteIdentity(result);
		return result;
	}
	const result = {
		kind: identity.kind,
		repository: identity.repository,
		requested_ref: identity.requested_ref,
		resolved_sha: identity.resolved_sha,
		source_subdirectory: identity.source_subdirectory,
		content_digest: identity.content_digest,
	};
	validateSiteIdentity(result);
	return result;
}

function validateGitIdentity(identity, label) {
	assertRecord(identity, label);
	assertExactKeys(identity, GIT_IDENTITY_KEYS, label);
	if (identity.kind !== "git") invalid(`${label}.kind must be "git"`);
	validateRepository(identity.repository, `${label}.repository`);
	if (typeof identity.requested_ref !== "string" || !identity.requested_ref.trim()) {
		invalid(`${label}.requested_ref must be a nonempty string`);
	}
	if (typeof identity.resolved_sha !== "string" || !SHA1.test(identity.resolved_sha)) {
		invalid(`${label}.resolved_sha must be a full 40-character commit SHA`);
	}
}

function validateSiteIdentity(identity) {
	assertRecord(identity, "site");
	if (identity.kind === "git") {
		assertExactKeys(identity, [...GIT_IDENTITY_KEYS, "source_subdirectory"], "site");
		validateGitIdentity(
			{ kind: identity.kind, repository: identity.repository, requested_ref: identity.requested_ref, resolved_sha: identity.resolved_sha },
			"site",
		);
		validateSubdirectory(identity.source_subdirectory);
		return;
	}
	assertExactKeys(identity, [
		"kind",
		"repository",
		"requested_ref",
		"resolved_sha",
		"source_subdirectory",
		"content_digest",
	], "site");
	if (identity.kind !== "content") invalid('site.kind must be "git" or "content"');
	if (identity.repository !== null || identity.requested_ref !== null || identity.resolved_sha !== null) {
		invalid("content Site identity must not claim a Git repository, requested ref, or resolved SHA");
	}
	validateSubdirectory(identity.source_subdirectory);
	if (typeof identity.content_digest !== "string" || !SHA256.test(identity.content_digest)) {
		invalid("site.content_digest must be sha256 followed by 64 lowercase hexadecimal characters");
	}
}

function validateSubdirectory(value) {
	if (typeof value !== "string" || !value || value.startsWith("/") || value.includes("\\")) {
		invalid("site.source_subdirectory must be a relative POSIX path");
	}
	if (value !== "." && value.split("/").some((part) => !part || part === "." || part === "..")) {
		invalid("site.source_subdirectory must not contain empty, dot, or parent path segments");
	}
}

function validateRepository(value, label) {
	if (value !== null && (typeof value !== "string" || !value.trim())) invalid(`${label} must be a nonempty string or null`);
}

function cloneJsonObject(value, label) {
	assertRecord(value, label);
	try {
		const json = JSON.stringify(value);
		if (json === undefined) invalid(`${label} must be JSON serializable`);
		return JSON.parse(json);
	} catch (error) {
		if (error.message.startsWith("Invalid provenance manifest:")) throw error;
		invalid(`${label} must be JSON serializable`);
	}
}

function validateExpected(manifest, expected) {
	assertRecord(expected, "expected values");
	for (const [key, expectedIdentity] of [["core", expected.core], ["site", expected.site]]) {
		if (expectedIdentity === undefined) continue;
		assertRecord(expectedIdentity, `expected.${key}`);
		const fields = new Set([
			"kind",
			"repository",
			"requested_ref",
			"resolved_sha",
			"source_subdirectory",
			"content_digest",
			"checkout_root",
		]);
		for (const field of Object.keys(expectedIdentity)) {
			if (!fields.has(field)) invalid(`expected.${key}.${field} is not a supported identity field`);
			if (field === "checkout_root") continue;
			if (manifest[key][field] !== expectedIdentity[field]) {
				throw new Error(`Provenance mismatch: ${key}.${field} does not match the expected input.`);
			}
		}
	}
	for (const key of Object.keys(expected)) {
		if (!["core", "site", "artifactId", "artifactDigest"].includes(key)) invalid(`expected.${key} is not a supported expectation`);
	}
	if (expected.artifactId !== undefined && expected.artifactId !== manifest.artifact.id) {
		throw new Error("Provenance mismatch: artifact.id does not match the expected identity.");
	}
	if (expected.artifactDigest !== undefined && expected.artifactDigest !== manifest.artifact.digest) {
		throw new Error("Provenance mismatch: artifact digest does not match the expected output.");
	}
}

function validateToolchain(toolchain) {
	assertRecord(toolchain, "build.toolchain");
	assertExactKeys(toolchain, TOOLCHAIN_KEYS, "build.toolchain");
	for (const key of ["node", "pnpm", "platform", "architecture"]) {
		if (typeof toolchain[key] !== "string" || !toolchain[key].trim()) invalid(`build.toolchain.${key} must be a nonempty string`);
	}
	assertRecord(toolchain.lockfile, "build.toolchain.lockfile");
	assertExactKeys(toolchain.lockfile, LOCKFILE_KEYS, "build.toolchain.lockfile");
	if (toolchain.lockfile.path !== "pnpm-lock.yaml") invalid('build.toolchain.lockfile.path must be "pnpm-lock.yaml"');
	if (typeof toolchain.lockfile.digest !== "string" || !SHA256.test(toolchain.lockfile.digest)) {
		invalid("build.toolchain.lockfile.digest must be a SHA-256 digest");
	}
}

function validateBuildConfiguration(configuration) {
	assertRecord(configuration, "build.configuration");
	assertExactKeys(configuration, CONFIGURATION_KEYS, "build.configuration");
	for (const key of ["entrypoint", "build_mode", "output"]) {
		if (typeof configuration[key] !== "string" || !configuration[key].trim()) {
			invalid(`build.configuration.${key} must be a nonempty string`);
		}
	}
	if (configuration.build_only !== true) invalid("build.configuration.build_only must be true");
	if (configuration.indexing_submissions !== false) invalid("build.configuration.indexing_submissions must be false");
	if (typeof configuration.inherited_environment_digest !== "string" || !SHA256.test(configuration.inherited_environment_digest)) {
		invalid("build.configuration.inherited_environment_digest must be a SHA-256 digest");
	}
	const clock = configuration.build_clock;
	assertRecord(clock, "build.configuration.build_clock");
	assertExactKeys(clock, BUILD_CLOCK_KEYS, "build.configuration.build_clock");
	if (clock.source !== "max-input-commit-time") invalid('build.configuration.build_clock.source must be "max-input-commit-time"');
	if (!Number.isSafeInteger(clock.source_date_epoch) || clock.source_date_epoch < 0 || Number.isNaN(new Date(clock.source_date_epoch).getTime())) {
		invalid("build.configuration.build_clock.source_date_epoch must be a nonnegative safe integer in the valid Date range");
	}
	if (clock.timezone !== "UTC") invalid('build.configuration.build_clock.timezone must be "UTC"');
}

function assertRecord(value, label) {
	if (!value || typeof value !== "object" || Array.isArray(value)) invalid(`${label} must be an object`);
}

function assertExactKeys(value, expectedKeys, label) {
	const actual = Object.keys(value).sort();
	const expected = [...expectedKeys].sort();
	if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
		invalid(`${label} must contain exactly these fields: ${expected.join(", ")}`);
	}
}

function invalid(message) {
	throw new Error(`Invalid provenance manifest: ${message}`);
}
