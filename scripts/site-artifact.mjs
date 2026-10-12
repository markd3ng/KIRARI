#!/usr/bin/env node

import { createHash } from "node:crypto";
import { copyFileSync, createReadStream, createWriteStream, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Readable } from "node:stream";
import { digestArtifactTree, validateProvenanceManifest } from "./composition-provenance.mjs";
import { parseHeaders, parseRedirects } from "./package-vercel-site.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const extractorPath = join(repoRoot, "scripts/extract-site-artifact.py");
const GITHUB_API = "https://api.github.com";
const VERCEL_API = "https://api.vercel.com";
const SHA1 = /^[a-f0-9]{40}$/;
const SHA256 = /^sha256:[a-f0-9]{64}$/;
const MAX_ARCHIVE_BYTES = 1_073_741_824;
const MAX_ARCHIVE_MEMBER_BYTES = 1_073_741_824;
const MAX_API_JSON_BYTES = 1_048_576;
const DEFAULT_PACKAGE_TARGET = Object.freeze({ platform: "vercel", project: "kirari-test", environment: "preview", deploy_mode: "prebuilt" });
const EXPECTED_SOURCE_KEYS = ["run_id", "run_attempt", "head_sha", "ref", "event", "conclusion", "workflow_path"];
const EXPECTED_PACKAGE_KEYS = ["id", "name", "digest"];
const EXPECTED_ROOT_KEYS = ["schema_version", "source", "package"];

function assertRecord(value, label) {
	if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object`);
}

function assertExactKeys(value, expected, label) {
	const actual = Object.keys(value).sort();
	const sortedExpected = [...expected].sort();
	if (JSON.stringify(actual) !== JSON.stringify(sortedExpected)) throw new Error(`${label} has missing or unexpected fields`);
}

function assertNumericString(value, label) {
	if (typeof value !== "string" || !/^[1-9][0-9]*$/.test(value)) throw new Error(`${label} must be a positive numeric string`);
}

function assertSha256(value, label) {
	if (typeof value !== "string" || !SHA256.test(value)) throw new Error(`${label} must be a lowercase SHA-256 digest`);
}

function validateExpected(expected) {
	assertRecord(expected, "Expected verification input");
	assertExactKeys(expected, EXPECTED_ROOT_KEYS, "Expected verification input");
	if (expected.schema_version !== 1) throw new Error("Expected verification schema_version must be 1");
	assertRecord(expected.source, "Expected source");
	assertExactKeys(expected.source, EXPECTED_SOURCE_KEYS, "Expected source");
	assertNumericString(expected.source.run_id, "Expected source run_id");
	assertNumericString(expected.source.run_attempt, "Expected source run_attempt");
	if (typeof expected.source.head_sha !== "string" || !/^[a-f0-9]{40}$/.test(expected.source.head_sha)) throw new Error("Expected source head_sha must be a full lowercase commit SHA");
	if (expected.source.ref !== "refs/heads/main" || expected.source.event !== "workflow_dispatch" || expected.source.conclusion !== "success" || expected.source.workflow_path !== ".github/workflows/ci.yml") {
		throw new Error("Expected source must be a successful main CI workflow_dispatch run");
	}
	assertRecord(expected.package, "Expected package artifact");
	assertExactKeys(expected.package, EXPECTED_PACKAGE_KEYS, "Expected package artifact");
	assertNumericString(String(expected.package.id), "Expected package artifact id");
	if (typeof expected.package.id !== "string") throw new Error("Expected package artifact id must be a string");
	if (expected.package.name !== `kirari-site-package-${expected.source.run_id}-${expected.source.run_attempt}`) throw new Error("Expected package artifact name does not match its source run and attempt");
	assertSha256(expected.package.digest, "Expected package artifact digest");
	return expected;
}

function safeArtifactPath(value, label = "artifact path") {
	if (typeof value !== "string" || !value || value.includes("\0") || value.includes("\\") || value.startsWith("/")) throw new Error(`${label} is unsafe`);
	if (value.normalize("NFC") !== value || Buffer.byteLength(value, "utf8") > 4096) throw new Error(`${label} is unsafe`);
	const parts = value.split("/");
	if (parts.length > 64 || parts.some((part) => !part || part === "." || part === ".." || part.includes(":"))) throw new Error(`${label} is unsafe`);
	return value;
}

function canonicalDirectory(directory, label) {
	if (typeof directory !== "string" || !directory.trim()) throw new Error(`${label} is required`);
	const absolute = resolve(directory);
	let stat;
	try {
		stat = lstatSync(absolute);
	} catch {
		throw new Error(`${label} does not exist`);
	}
	if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error(`${label} must be a real directory`);
	return resolve(absolute);
}

function walkRegularFiles(root, { label = "artifact tree" } = {}) {
	const canonicalRoot = canonicalDirectory(root, label);
	const files = [];
	const visit = (directory) => {
		for (const name of readdirSync(directory).sort()) {
			const absolutePath = join(directory, name);
			const info = lstatSync(absolutePath);
			const relativePath = relative(canonicalRoot, absolutePath).split(sep).join("/");
			safeArtifactPath(relativePath, label);
			if (info.isSymbolicLink()) throw new Error(`${label} contains a symlink`);
			if (info.isDirectory()) visit(absolutePath);
			else if (info.isFile()) files.push({ absolutePath, relativePath });
			else throw new Error(`${label} contains a special file`);
		}
	};
	visit(canonicalRoot);
	return files.sort((left, right) => compareStrings(left.relativePath, right.relativePath));
}

function compareStrings(left, right) {
	return left < right ? -1 : left > right ? 1 : 0;
}

function sha1(buffer) {
	return createHash("sha1").update(buffer).digest("hex");
}

function sha256(buffer) {
	return `sha256:${createHash("sha256").update(buffer).digest("hex")}`;
}

export function fileInventory(directory) {
	return walkRegularFiles(directory).map(({ absolutePath, relativePath }) => {
		const contents = readFileSync(absolutePath);
		return { path: relativePath, sha256: sha256(contents), size: contents.length };
	});
}

export function deploymentFiles(packageRoot) {
	const root = canonicalDirectory(packageRoot, "Site package root");
	const outputRoot = join(root, ".vercel/output");
	const configPath = join(outputRoot, "config.json");
	let config;
	try {
		config = JSON.parse(readFileSync(configPath, "utf8"));
	} catch {
		throw new Error("Site package is missing a valid Build Output API config.json");
	}
	if (config.version !== 3 || !Array.isArray(config.routes)) throw new Error("Expected a Build Output API v3 config.json");
	const files = walkRegularFiles(outputRoot, { label: "Vercel output" }).map(({ absolutePath, relativePath }) => {
		const content = readFileSync(absolutePath);
		const file = safeArtifactPath(`.vercel/output/${relativePath}`, "Vercel output path");
		return { file, sha: sha1(content), size: content.length };
	});
	if (!files.some((file) => file.file === ".vercel/output/static/index.html")) throw new Error("Vercel output is missing static/index.html");
	return files;
}

export function uniqueUploads(files, packageRoot) {
	const root = canonicalDirectory(packageRoot, "Site package root");
	const byDigest = new Map();
	for (const file of files) {
		if (!SHA1.test(file.sha) || !Number.isSafeInteger(file.size) || file.size < 0) throw new Error("Vercel output upload entry is invalid");
		const localPath = safeArtifactPath(file.localPath ?? file.file, "Vercel output path");
		const previous = byDigest.get(file.sha);
		if (previous) {
			const previousBytes = readFileSync(join(root, previous.localPath));
			const currentBytes = readFileSync(join(root, localPath));
			if (previous.size !== file.size || !previousBytes.equals(currentBytes)) throw new Error(`SHA-1 collision in Vercel output: ${file.sha}`);
		} else {
			byDigest.set(file.sha, { ...file, localPath });
		}
	}
	return [...byDigest.values()];
}

export function compareRemoteFileInventory(remoteTree, expectedFiles) {
	if (!Array.isArray(remoteTree) || !Array.isArray(expectedFiles)) throw new Error("Remote deployment file inventory is invalid");
	const remote = [];
	const visit = (nodes, prefix = "") => {
		for (const node of nodes) {
			assertRecord(node, "Remote deployment file entry");
			if (typeof node.name !== "string" || (node.type !== "file" && node.type !== "directory")) throw new Error("Remote deployment file entry is invalid");
			const path = safeArtifactPath(prefix ? `${prefix}/${node.name}` : node.name, "Remote deployment path");
			if (node.type === "directory") {
				if (!Array.isArray(node.children)) throw new Error("Remote deployment directory listing is incomplete");
				visit(node.children, path);
			} else {
				if (typeof node.uid !== "string" || !SHA1.test(node.uid)) throw new Error("Remote deployment file digest is invalid");
				remote.push({ file: path, sha: node.uid });
			}
		}
	};
	// Vercel's deployment-file API can expose the uploaded source under one
	// synthetic `src` directory. Strip only that exact single-root wrapper;
	// every actual file path and digest still has to match the package.
	if (remoteTree.length === 1 && remoteTree[0]?.name === "src" && remoteTree[0]?.type === "directory" && Array.isArray(remoteTree[0]?.children)) {
		visit(remoteTree[0].children);
	} else {
		visit(remoteTree);
	}
	remote.sort((left, right) => compareStrings(left.file, right.file));
	const expected = expectedFiles.map(({ file, sha }) => ({ file, sha })).sort((left, right) => compareStrings(left.file, right.file));
	if (JSON.stringify(remote) !== JSON.stringify(expected)) throw new Error("Vercel deployment file inventory does not match the verified artifact");
	return { fileCount: remote.length, inventorySha256: sha256(Buffer.from(JSON.stringify(remote))) };
}

function parseJsonFile(filePath, label) {
	try {
		return JSON.parse(readFileSync(filePath, "utf8"));
	} catch {
		throw new Error(`${label} is missing or invalid JSON`);
	}
}

function listExpectedTarget(targetName) {
	if (typeof targetName !== "string" || !/^[a-z0-9][a-z0-9-]{0,62}$/.test(targetName)) throw new Error("Site package Preview target is invalid");
	return { ...DEFAULT_PACKAGE_TARGET, project: targetName };
}

function compareJsonValue(left, right) {
	return JSON.stringify(left) === JSON.stringify(right);
}

function verifyUpstreamComposition({ packageRoot, upstreamRoot, manifest, provenanceBytes, provenance }) {
	const root = canonicalDirectory(upstreamRoot, "Upstream artifact root");
	const entries = readdirSync(root).sort();
	if (!compareJsonValue(entries, ["dist", "provenance.json"])) throw new Error("Upstream composition artifact has unexpected files");
	const upstreamProvenancePath = join(root, "provenance.json");
	const upstreamProvenanceBytes = readFileSync(upstreamProvenancePath);
	if (!upstreamProvenanceBytes.equals(provenanceBytes)) throw new Error("Composition archive provenance does not match the package");
	const upstreamProvenance = parseJsonFile(upstreamProvenancePath, "Composition provenance");
	const distRoot = join(root, "dist");
	const distDigest = digestArtifactTree(distRoot);
	validateProvenanceManifest(upstreamProvenance, { artifactDigest: distDigest });
	if (!compareJsonValue(upstreamProvenance, provenance) || upstreamProvenance.artifact.digest !== manifest.source_artifact.digest) {
		throw new Error("Composition archive identity does not match the Site package");
	}

	const distFiles = walkRegularFiles(distRoot, { label: "Composition output" });
	const staticRoot = join(packageRoot, ".vercel/output/static");
	const staticFiles = walkRegularFiles(staticRoot, { label: "Vercel static output" });
	const expectedStatic = distFiles.filter(({ relativePath }) => relativePath !== "_headers" && relativePath !== "_redirects");
	if (expectedStatic.length !== staticFiles.length) throw new Error("Vercel static files do not match the composition archive");
	for (let index = 0; index < expectedStatic.length; index += 1) {
		const expected = expectedStatic[index];
		const actual = staticFiles[index];
		if (expected.relativePath !== actual.relativePath || !readFileSync(expected.absolutePath).equals(readFileSync(actual.absolutePath))) {
			throw new Error("Vercel static files do not match the composition archive");
		}
	}

	const distHeaders = join(distRoot, "_headers");
	const distRedirects = join(distRoot, "_redirects");
	const expectedRoutes = JSON.parse(JSON.stringify([
		...parseRedirects(distRedirects),
		...parseHeaders(distHeaders),
	]));
	const config = parseJsonFile(join(packageRoot, ".vercel/output/config.json"), "Build Output API config");
	if (!compareJsonValue(config.routes, expectedRoutes)) throw new Error("Build Output API routes do not match the composition archive");
	return { compositionDigest: distDigest, fileCount: distFiles.length };
}

export function verifySitePackage({ packageRoot, targetName = "kirari-test", sourceRunSha, sourceRun, upstreamRoot } = {}) {
	const root = canonicalDirectory(packageRoot, "Site package root");
	const packageEntries = readdirSync(root).sort();
	if (!compareJsonValue(packageEntries, [".vercel", "provenance.json", "site-package-manifest.json"])) throw new Error("Site package root contains unexpected files");
	walkRegularFiles(root, { label: "Site package root" });
	if (sourceRunSha !== undefined && (typeof sourceRunSha !== "string" || !/^[a-f0-9]{40}$/.test(sourceRunSha))) throw new Error("Source CI run SHA must be a full lowercase commit SHA");
	const manifest = parseJsonFile(join(root, "site-package-manifest.json"), "Site package manifest");
	const provenanceBytes = readFileSync(join(root, "provenance.json"));
	const provenance = parseJsonFile(join(root, "provenance.json"), "Site package provenance");
	validateProvenanceManifest(provenance);
	const expectedSourceSha = sourceRun?.head_sha ?? sourceRunSha;
	if (expectedSourceSha && provenance.core.resolved_sha !== expectedSourceSha) throw new Error("Package Core SHA does not match the verified source CI run SHA");
	if (manifest.schema_version !== 1 || manifest.package_format !== "vercel-build-output-api-v3") throw new Error("Unsupported Site package manifest");
	if (!compareJsonValue(manifest.target, listExpectedTarget(targetName))) throw new Error("Site package target must retain its original kirari-test Preview metadata");
	if (manifest.functions_classification !== "STATIC_ONLY_NO_FUNCTIONS_REQUIRED") throw new Error("Package does not have the accepted static-only Functions classification");
	const upstream = manifest.upstream_github_artifact;
	if (!/^\d+$/.test(upstream?.id ?? "") || !/^\d+$/.test(upstream?.run_id ?? "") || !/^\d+$/.test(upstream?.run_attempt ?? "")) {
		throw new Error("Package is missing the upstream GitHub artifact/run identity");
	}
	if (upstream.name !== `kirari-composition-${upstream.run_id}-${upstream.run_attempt}` || upstream.name !== provenance.artifact.id || !SHA256.test(upstream.digest ?? "")) {
		throw new Error("Package upstream GitHub artifact identity does not match P2 provenance");
	}
	if (sourceRun) {
		if (upstream.run_id !== sourceRun.run_id || upstream.run_attempt !== sourceRun.run_attempt) throw new Error("Upstream artifact run or attempt does not match the verified source CI run");
	}
	const provenanceDigest = sha256(provenanceBytes);
	if (manifest.source_provenance_sha256 !== provenanceDigest) throw new Error("Site package provenance fingerprint does not match");
	if (!compareJsonValue(manifest.source_artifact, provenance.artifact)) throw new Error("Package source artifact identity does not match provenance");
	if (!compareJsonValue(manifest.core, provenance.core) || !compareJsonValue(manifest.site, provenance.site)) throw new Error("Package Core/Site identity does not match provenance");
	const outputRoot = join(root, ".vercel/output");
	const actualDigest = digestArtifactTree(outputRoot);
	if (manifest.output_digest !== actualDigest) throw new Error("Vercel output digest does not match the Site package");
	const outputEntries = readdirSync(outputRoot).sort();
	if (!compareJsonValue(outputEntries, ["config.json", "static"])) throw new Error("Unexpected Vercel output primitives");
	const config = parseJsonFile(join(outputRoot, "config.json"), "Build Output API config");
	if (config.version !== 3 || !Array.isArray(config.routes)) throw new Error("Invalid Build Output API v3 routing config");
	if (!Array.isArray(manifest.browser_contract?.routes) || manifest.browser_contract.routes.length < 1 || !manifest.browser_contract?.assets?.stylesheets?.length || !manifest.browser_contract?.navigation) {
		throw new Error("Package is missing the required browser route/content/asset/navigation contract");
	}
	const inventory = fileInventory(join(outputRoot, "static"));
	const composition = upstreamRoot ? verifyUpstreamComposition({ packageRoot: root, upstreamRoot, manifest, provenanceBytes, provenance }) : null;
	return {
		manifest,
		provenance,
		manifestPath: join(root, "site-package-manifest.json"),
		packageRoot: root,
		outputDirectory: root,
		outputRoot,
		staticRoot: join(outputRoot, "static"),
		outputDigest: actualDigest,
		fileInventory: inventory,
		upstreamArtifact: { ...upstream },
		composition,
	};
}

async function apiJson(url, token, fetchImpl = fetch) {
	let response;
	try {
		response = await fetchImpl(url, {
			redirect: "error",
			signal: AbortSignal.timeout(30_000),
			headers: {
				Authorization: `Bearer ${token}`,
				Accept: "application/vnd.github+json",
				"X-GitHub-Api-Version": "2022-11-28",
			},
		});
	} catch {
		throw new Error("GitHub artifact metadata request failed");
	}
	if (!response.ok) {
		await response.body?.cancel();
		throw new Error(`GitHub artifact metadata request failed with HTTP ${response.status}`);
	}
	const contentLength = Number(response.headers.get("content-length") ?? 0);
	if (contentLength > MAX_API_JSON_BYTES) throw new Error("GitHub artifact metadata response exceeded the size limit");
	const body = Buffer.from(await response.arrayBuffer());
	if (body.length > MAX_API_JSON_BYTES) throw new Error("GitHub artifact metadata response exceeded the size limit");
	try {
		return JSON.parse(body.toString("utf8"));
	} catch {
		throw new Error("GitHub artifact metadata response was invalid JSON");
	}
}

function artifactEndpoint(repository, artifactId) {
	if (typeof repository !== "string" || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)) throw new Error("GitHub repository identity is invalid");
	if (typeof artifactId !== "string" || !/^\d+$/.test(artifactId)) throw new Error("GitHub artifact ID is invalid");
	return `${GITHUB_API}/repos/${repository}/actions/artifacts/${artifactId}`;
}

function validateArtifactRecord(record, expected, source, repository) {
	assertRecord(record, "GitHub artifact metadata");
	const recordId = typeof record.id === "number" && Number.isSafeInteger(record.id) ? String(record.id) : record.id;
	if (recordId !== expected.id || record.name !== expected.name || record.digest !== expected.digest || record.expired !== false) {
		throw new Error("GitHub artifact metadata does not match the approved artifact identity");
	}
	if (String(record.workflow_run?.id) !== source.run_id || record.workflow_run?.head_sha !== source.head_sha || record.workflow_run?.head_branch !== "main" || record.name !== `kirari-${record.name.startsWith("kirari-site-package-") ? "site-package" : "composition"}-${source.run_id}-${source.run_attempt}`) {
		throw new Error("GitHub artifact does not belong to the verified source run and attempt");
	}
	assertSha256(record.digest, "GitHub artifact digest");
	if (typeof record.expires_at !== "string" || !Number.isFinite(Date.parse(record.expires_at)) || Date.parse(record.expires_at) <= Date.now()) throw new Error("GitHub artifact is expired or has invalid expiration metadata");
	const expectedArchiveUrl = `${artifactEndpoint(repository, String(record.id))}/zip`;
	if (record.archive_download_url !== expectedArchiveUrl) throw new Error("GitHub artifact archive URL does not match its metadata endpoint");
	return expectedArchiveUrl;
}

async function downloadArtifactZip(url, token, destination, fetchImpl = fetch) {
	let response;
	try {
		response = await fetchImpl(url, {
			redirect: "manual",
			signal: AbortSignal.timeout(10 * 60_000),
			headers: {
				Authorization: `Bearer ${token}`,
				Accept: "application/vnd.github+json",
				"X-GitHub-Api-Version": "2022-11-28",
			},
		});
	} catch {
		throw new Error("GitHub artifact archive download failed");
	}
	if ([301, 302, 303, 307, 308].includes(response.status)) {
		const location = response.headers.get("location");
		let signedUrl;
		try { signedUrl = new URL(location); } catch { await response.body?.cancel(); throw new Error("GitHub artifact archive redirect is invalid"); }
		await response.body?.cancel();
		if (signedUrl.protocol !== "https:" || signedUrl.username || signedUrl.password) throw new Error("GitHub artifact archive redirect is unsafe");
		try {
			response = await fetchImpl(signedUrl, { redirect: "follow", signal: AbortSignal.timeout(10 * 60_000) });
		} catch {
			throw new Error("GitHub artifact archive download failed");
		}
	}
	if (!response.ok || !response.body) {
		await response.body?.cancel();
		throw new Error(`GitHub artifact archive download failed with HTTP ${response.status}`);
	}
	const contentLengthHeader = response.headers.get("content-length");
	const contentLength = contentLengthHeader === null ? null : Number(contentLengthHeader);
	if (contentLength !== null && (!Number.isSafeInteger(contentLength) || contentLength < 0 || contentLength > MAX_ARCHIVE_BYTES)) {
		await response.body.cancel();
		throw new Error("GitHub artifact archive exceeded the size limit");
	}
	let byteCount = 0;
	const limit = new Transform({
		transform(chunk, _encoding, callback) {
			byteCount += chunk.length;
			if (byteCount > MAX_ARCHIVE_BYTES) callback(new Error("archive-limit"));
			else callback(null, chunk);
		},
	});
	try {
		await pipeline(Readable.fromWeb(response.body), limit, createWriteStream(destination, { flags: "wx", mode: 0o600 }));
	} catch {
		rmSync(destination, { force: true });
		throw new Error("GitHub artifact archive download failed or exceeded the size limit");
	}
	if (contentLength !== null && byteCount !== contentLength) {
		rmSync(destination, { force: true });
		throw new Error("GitHub artifact archive length did not match its response metadata");
	}
}

export async function sha256File(filePath) {
	const hash = createHash("sha256");
	for await (const chunk of createReadStream(filePath)) hash.update(chunk);
	return `sha256:${hash.digest("hex")}`;
}

export function extractSiteArtifactArchive(archivePath, destination) {
	const result = spawnSync("python3", [extractorPath, archivePath, destination], { encoding: "utf8", maxBuffer: 64 * 1024 });
	if (result.error || result.status !== 0) throw new Error("GitHub artifact ZIP failed safe extraction");
}

export function readSiteArtifactZipMember(archiveBytes, memberName, { maxBytes = 1_048_576 } = {}) {
	if (!Buffer.isBuffer(archiveBytes) || archiveBytes.length > MAX_ARCHIVE_BYTES) throw new Error("GitHub artifact ZIP bytes are invalid or exceed the size limit");
	safeArtifactPath(memberName, "ZIP member path");
	if (!Number.isSafeInteger(maxBytes) || maxBytes < 1 || maxBytes > MAX_ARCHIVE_MEMBER_BYTES) throw new Error("ZIP member size limit is invalid");
	const tempRoot = mkdtempSync(join(tmpdir(), "kirari-artifact-member-"));
	const archivePath = join(tempRoot, "artifact.zip");
	const extractedPath = join(tempRoot, "extracted");
	try {
		writeFileSync(archivePath, archiveBytes, { flag: "wx", mode: 0o600 });
		extractSiteArtifactArchive(archivePath, extractedPath);
		const memberPath = join(extractedPath, ...memberName.split("/"));
		const info = lstatSync(memberPath);
		if (info.isSymbolicLink() || !info.isFile() || info.size > maxBytes) throw new Error("ZIP member is missing, unsafe or exceeds the size limit");
		return readFileSync(memberPath);
	} catch {
		throw new Error("GitHub artifact ZIP does not safely contain the requested member");
	} finally {
		rmSync(tempRoot, { recursive: true, force: true });
	}
}

export async function downloadVerifiedArtifact({ repository, artifactId, expectedName, expectedDigest, expectedRun, token = process.env.GH_TOKEN, destination, fetchImpl = fetch } = {}) {
	if (!token || typeof token !== "string") throw new Error("GH_TOKEN is required for artifact verification");
	assertNumericString(String(artifactId), "GitHub artifact ID");
	if (typeof expectedName !== "string" || !/^kirari-[a-z0-9-]+$/.test(expectedName)) throw new Error("Expected GitHub artifact name is invalid");
	assertSha256(expectedDigest, "Expected GitHub artifact digest");
	assertRecord(expectedRun, "Expected GitHub artifact run");
	assertNumericString(String(expectedRun.id), "Expected GitHub artifact run ID");
	assertNumericString(String(expectedRun.attempt), "Expected GitHub artifact run attempt");
	if (!/^[a-f0-9]{40}$/.test(expectedRun.head_sha ?? "") || expectedRun.head_branch !== "main") throw new Error("Expected GitHub artifact run must be a main-branch source");
	if (typeof destination !== "string" || !destination || existsSync(destination) || lstatIfExists(destination)) throw new Error("GitHub artifact destination must be a new path");
	const expected = { id: String(artifactId), name: expectedName, digest: expectedDigest };
	const source = { run_id: String(expectedRun.id), run_attempt: String(expectedRun.attempt), head_sha: expectedRun.head_sha };
	const metadataUrl = artifactEndpoint(repository, expected.id);
	const record = await apiJson(metadataUrl, token, fetchImpl);
	assertRecord(record, "GitHub artifact metadata");
	if (String(record.id) !== expected.id || record.name !== expected.name || record.digest !== expected.digest || record.expired !== false) throw new Error("GitHub artifact metadata does not match the approved artifact identity");
	if (String(record.workflow_run?.id) !== source.run_id || record.workflow_run?.head_sha !== source.head_sha || record.workflow_run?.head_branch !== "main") throw new Error("GitHub artifact does not belong to the verified source run");
	if (typeof record.expires_at !== "string" || !Number.isFinite(Date.parse(record.expires_at)) || Date.parse(record.expires_at) <= Date.now()) throw new Error("GitHub artifact is expired or has invalid expiration metadata");
	const archiveUrl = `${metadataUrl}/zip`;
	if (record.archive_download_url !== archiveUrl) throw new Error("GitHub artifact archive URL does not match its metadata endpoint");
	await downloadArtifactZip(archiveUrl, token, resolve(destination), fetchImpl);
	const actualDigest = await sha256File(destination);
	if (actualDigest !== expectedDigest) {
		rmSync(destination, { force: true });
		throw new Error("Downloaded GitHub artifact digest does not match the approved digest");
	}
	return { id: expected.id, name: expectedName, digest: actualDigest, archivePath: resolve(destination), expiresAt: record.expires_at };
}

export async function verifySitePackageArchive({ expected, outputDirectory, token = process.env.GH_TOKEN, repository = process.env.GITHUB_REPOSITORY, fetchImpl = fetch, retainArchiveDirectory } = {}) {
	validateExpected(expected);
	if (!token || typeof token !== "string") throw new Error("GH_TOKEN is required for artifact verification");
	if (!repository || typeof repository !== "string") throw new Error("GITHUB_REPOSITORY is required for artifact verification");
	const outputPath = resolve(outputDirectory ?? "");
	if (!outputDirectory || existsSync(outputPath) || lstatIfExists(outputPath)) throw new Error("Artifact output directory must be a new path");
	let retainPath = null;
	if (retainArchiveDirectory !== undefined) {
		retainPath = resolve(retainArchiveDirectory);
		if (existsSync(retainPath) || lstatIfExists(retainPath)) throw new Error("Artifact retention directory must be a new path");
	}
	const tempParent = dirname(outputPath);
	mkdirSync(tempParent, { recursive: true });
	const downloadRoot = mkdtempSync(join(tempParent, ".site-artifact-download-"));
	const packageZip = join(downloadRoot, "site-package.zip");
	const upstreamZip = join(downloadRoot, "composition.zip");
	const upstreamRoot = join(downloadRoot, "composition");
	let packageExtracted = false;
	try {
		const packageUrl = artifactEndpoint(repository, expected.package.id);
		const packageRecord = await apiJson(packageUrl, token, fetchImpl);
		const packageArchiveUrl = validateArtifactRecord(packageRecord, expected.package, expected.source, repository);
		await downloadArtifactZip(packageArchiveUrl, token, packageZip, fetchImpl);
		const actualPackageDigest = await sha256File(packageZip);
		if (actualPackageDigest !== expected.package.digest) throw new Error("Downloaded Site package archive digest does not match the approved digest");
		extractSiteArtifactArchive(packageZip, outputPath);
		packageExtracted = true;

		const initial = verifySitePackage({ packageRoot: outputPath, sourceRun: expected.source });
		const upstreamRecordExpected = {
			id: initial.upstreamArtifact.id,
			name: initial.upstreamArtifact.name,
			digest: initial.upstreamArtifact.digest,
		};
		const upstreamApiUrl = artifactEndpoint(repository, upstreamRecordExpected.id);
		const upstreamRecord = await apiJson(upstreamApiUrl, token, fetchImpl);
		const upstreamArchiveUrl = validateArtifactRecord(upstreamRecord, upstreamRecordExpected, expected.source, repository);
		await downloadArtifactZip(upstreamArchiveUrl, token, upstreamZip, fetchImpl);
		const actualUpstreamDigest = await sha256File(upstreamZip);
		if (actualUpstreamDigest !== upstreamRecordExpected.digest) throw new Error("Downloaded composition archive digest does not match the Site package");
		extractSiteArtifactArchive(upstreamZip, upstreamRoot);
		const verified = verifySitePackage({ packageRoot: outputPath, sourceRun: expected.source, upstreamRoot });
		let retainedArchives;
		if (retainPath) {
			mkdirSync(retainPath, { recursive: false, mode: 0o700 });
			copyFileSync(packageZip, join(retainPath, "site-package.zip"));
			copyFileSync(upstreamZip, join(retainPath, "composition.zip"));
			const retainedPackageDigest = await sha256File(join(retainPath, "site-package.zip"));
			const retainedUpstreamDigest = await sha256File(join(retainPath, "composition.zip"));
			if (retainedPackageDigest !== actualPackageDigest || retainedUpstreamDigest !== actualUpstreamDigest) throw new Error("Retained GitHub artifact bytes changed during evidence copy");
			retainedArchives = {
				directory: retainPath,
				packageZipPath: join(retainPath, "site-package.zip"),
				packageArchiveSha256: retainedPackageDigest,
				upstreamZipPath: join(retainPath, "composition.zip"),
				upstreamArchiveSha256: retainedUpstreamDigest,
			};
		}
		return {
			result: "PASS",
			source: { runId: expected.source.run_id, runAttempt: expected.source.run_attempt, headSha: expected.source.head_sha, ref: expected.source.ref },
			packageArtifact: { id: expected.package.id, name: expected.package.name, digest: actualPackageDigest },
			upstreamArtifact: { ...verified.upstreamArtifact },
			upstream: { ...verified.upstreamArtifact },
			packageArchiveSha256: actualPackageDigest,
			upstreamArchiveSha256: actualUpstreamDigest,
			manifest: verified.manifest,
			manifestPath: verified.manifestPath,
			outputDirectory: verified.outputDirectory,
			staticRoot: verified.staticRoot,
			outputDigest: verified.outputDigest,
			deploymentFiles: deploymentFiles(outputPath),
			fileInventory: verified.fileInventory,
			compositionDigest: verified.composition.compositionDigest,
			compositionFileCount: verified.composition.fileCount,
			retainedArchives,
		};
	} catch (error) {
		if (packageExtracted) rmSync(outputPath, { recursive: true, force: true });
		if (retainPath && (existsSync(retainPath) || lstatIfExists(retainPath))) rmSync(retainPath, { recursive: true, force: true });
		throw error;
	} finally {
		rmSync(downloadRoot, { recursive: true, force: true });
	}
}

function lstatIfExists(path) {
	try {
		return lstatSync(path);
	} catch {
		return null;
	}
}

export async function vercelRequest(path, options = {}, retryTransient = false, { token = process.env.VERCEL_TOKEN, teamId = process.env.VERCEL_ORG_ID, fetchImpl = fetch } = {}) {
	if (!token || !teamId) throw new Error("VERCEL_TOKEN and VERCEL_ORG_ID are required");
	if (typeof path !== "string" || !path.startsWith("/") || path.startsWith("//")) throw new Error("Vercel API path is invalid");
	const url = new URL(path, VERCEL_API);
	url.searchParams.set("teamId", teamId);
	for (let attempt = 0; ; attempt += 1) {
		let response;
		try {
			response = await fetchImpl(url, {
				...options,
				redirect: "error",
				signal: AbortSignal.timeout(120_000),
				headers: { ...options.headers, Authorization: `Bearer ${token}` },
			});
		} catch {
			if (!retryTransient || attempt === 4) throw new Error("Vercel API request failed");
			await pause(250 * 2 ** attempt);
			continue;
		}
		if (response.ok) return response;
		await response.body?.cancel();
		if (retryTransient && (response.status >= 500 || response.status === 429) && attempt < 4) {
			await pause(250 * 2 ** attempt);
			continue;
		}
		throw new Error(`Vercel API request failed with HTTP ${response.status}`);
	}
}

function pause(milliseconds) {
	return new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));
}

function mainUsage() {
	return "Usage: node scripts/site-artifact.mjs verify --expected-json <expected.json> --output-dir <new-directory> [--retain-archive-directory <new-directory>]";
}

async function main(args) {
	if (args[0] !== "verify") throw new Error(mainUsage());
	const options = new Map();
	for (let index = 1; index < args.length; index += 1) {
		const name = args[index];
		if (!["--expected-json", "--output-dir", "--retain-archive-directory"].includes(name) || options.has(name)) throw new Error(mainUsage());
		const value = args[++index];
		if (!value || value.startsWith("--")) throw new Error(mainUsage());
		options.set(name, value);
	}
	if (!options.has("--expected-json") || !options.has("--output-dir")) throw new Error(mainUsage());
	const expected = parseJsonFile(resolve(options.get("--expected-json")), "Expected verification JSON");
	const result = await verifySitePackageArchive({ expected, outputDirectory: options.get("--output-dir"), retainArchiveDirectory: options.get("--retain-archive-directory") });
	process.stdout.write(`${JSON.stringify(result)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
	try {
		await main(process.argv.slice(2));
	} catch (error) {
		const message = String(error?.message ?? "verification failed").replace(/[\r\n\x00-\x1f]/g, " ").slice(0, 500);
		console.error(`[site-artifact] ERROR ${message}`);
		process.exitCode = 1;
	}
}

export { DEFAULT_PACKAGE_TARGET };
