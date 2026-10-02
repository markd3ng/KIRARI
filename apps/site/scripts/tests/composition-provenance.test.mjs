import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { chmodSync, mkdtempSync, mkdirSync, readFileSync, realpathSync, rmSync, utimesSync, writeFileSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import {
	createProvenanceManifest,
	digestArtifactTree,
	digestBuildEnvironment,
	digestFileTree,
	resolveGitInput,
	resolveSiteInput,
	selectBuildEnvironment,
	validateProvenanceManifest,
} from "../../../../scripts/composition-provenance.mjs";
import { SITE_SCHEMA_VERSION } from "../profile-manifest.mjs";

function tempDirectory(t) {
	const root = mkdtempSync(join(tmpdir(), "kirari-composition-"));
	t.after(() => rmSync(root, { recursive: true, force: true }));
	return root;
}

function git(root, ...args) {
	return execFileSync("git", ["-C", root, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

function initRepo(root, files = { "README.md": "initial\n" }) {
	mkdirSync(root, { recursive: true });
	execFileSync("git", ["init", "--quiet", "--initial-branch=main", root]);
	git(root, "config", "user.name", "Composition Test");
	git(root, "config", "user.email", "composition-test@example.invalid");
	for (const [path, contents] of Object.entries(files)) {
		const absolute = join(root, path);
		mkdirSync(dirname(absolute), { recursive: true });
		writeFileSync(absolute, contents);
	}
	git(root, "add", "--all");
	git(root, "commit", "--quiet", "-m", "initial");
	return git(root, "rev-parse", "HEAD");
}

function commitFile(root, path, contents, message) {
	const absolute = join(root, path);
	mkdirSync(dirname(absolute), { recursive: true });
	writeFileSync(absolute, contents);
	git(root, "add", "--all");
	git(root, "commit", "--quiet", "-m", message);
	return git(root, "rev-parse", "HEAD");
}

test("resolves full, branch, tag, and abbreviated commit refs to the clean checked-out SHA", (t) => {
	const root = tempDirectory(t);
	const sha = initRepo(join(root, "core"));
	const repository = join(root, "core");
	git(repository, "remote", "add", "origin", "https://github.com/example/core.git");
	git(repository, "tag", "release-1");

	for (const requestedRef of [sha, "main", "release-1", sha.slice(0, 8)]) {
		const identity = resolveGitInput({ directory: repository, requestedRef, label: "Core" });
		assert.equal(identity.kind, "git");
		assert.equal(identity.repository, "https://github.com/example/core.git");
		assert.equal(identity.requested_ref, requestedRef);
		assert.equal(identity.resolved_sha, sha);
		assert.equal(identity.checkout_root, realpathSync(repository));
	}
});

test("rejects missing refs, mismatched refs, and dirty checkouts with stage-specific diagnostics", (t) => {
	const root = tempDirectory(t);
	const repository = join(root, "core");
	const firstSha = initRepo(repository, { "tracked.txt": "first\n" });
	const secondSha = commitFile(repository, "tracked.txt", "second\n", "second commit");
	git(repository, "branch", "other", secondSha);
	git(repository, "checkout", "--quiet", firstSha);

	assert.throws(
		() => resolveGitInput({ directory: repository, requestedRef: "does-not-exist", label: "Core" }),
		/Core ref.*does-not-exist.*Git could not resolve/i,
	);
	assert.throws(
		() => resolveGitInput({ directory: join(root, "missing"), requestedRef: "main", label: "Core" }),
		/Core path.*directory does not exist/i,
	);
	assert.throws(
		() => resolveGitInput({ directory: repository, requestedRef: "other", label: "Site" }),
		/Site ref.*resolves to .*checkout HEAD/i,
	);
	writeFileSync(join(repository, "tracked.txt"), "modified\n");
	assert.throws(() => resolveGitInput({ directory: repository, requestedRef: firstSha, label: "Core" }), /Core checkout is dirty.*tracked\.txt/i);
	git(repository, "checkout", "--quiet", "--", "tracked.txt");
	writeFileSync(join(repository, "tracked.txt"), "staged\n");
	git(repository, "add", "tracked.txt");
	assert.throws(() => resolveGitInput({ directory: repository, requestedRef: firstSha, label: "Core" }), /Core checkout is dirty.*tracked\.txt/i);
	git(repository, "reset", "--quiet", "--", "tracked.txt");
	git(repository, "checkout", "--quiet", "--", "tracked.txt");
	writeFileSync(join(repository, "untracked.txt"), "untracked\n");
	assert.throws(() => resolveGitInput({ directory: repository, requestedRef: firstSha, label: "Core" }), /Core checkout is dirty.*untracked\.txt/i);
});

test("resolves Core and Site checkouts independently and records a nested Site source", (t) => {
	const root = tempDirectory(t);
	const coreRoot = join(root, "core");
	const siteRoot = join(root, "site");
	const coreSha = initRepo(coreRoot, { "core.txt": "core\n" });
	const siteSha = initRepo(siteRoot, { "profile/kirari.config.toml": "site\n" });
	const core = resolveGitInput({ directory: coreRoot, requestedRef: "main", label: "Core" });
	const site = resolveSiteInput({ directory: join(siteRoot, "profile"), requestedRef: siteSha.slice(0, 9) });

	assert.notEqual(core.resolved_sha, site.resolved_sha);
	assert.equal(core.resolved_sha, coreSha);
	assert.equal(site.resolved_sha, siteSha);
	assert.equal(site.checkout_root, realpathSync(siteRoot));
	assert.equal(site.source_subdirectory, "profile");
});

test("uses a content identity for non-Git Site input without inventing a commit SHA", (t) => {
	const root = tempDirectory(t);
	const siteRoot = join(root, "standalone-site");
	mkdirSync(join(siteRoot, "content"), { recursive: true });
	writeFileSync(join(siteRoot, "content", "post.md"), "hello\n");
	const site = resolveSiteInput({ directory: siteRoot });

	assert.deepEqual(site, {
		kind: "content",
		repository: null,
		requested_ref: null,
		resolved_sha: null,
		source_subdirectory: ".",
		content_digest: digestFileTree(siteRoot),
	});
	assert.throws(() => resolveSiteInput({ directory: siteRoot, requestedRef: "main" }), /non-Git Site directory/i);
	assert.throws(() => resolveSiteInput({ directory: siteRoot, requestedRef: " " }), /non-Git Site directory/i);
});

test("tree digest ignores metadata, changes with file bytes, and rejects symlinks and special files", (t) => {
	const root = tempDirectory(t);
	const tree = join(root, "tree");
	mkdirSync(join(tree, "nested"), { recursive: true });
	const file = join(tree, "nested", "item.txt");
	writeFileSync(file, "same bytes\n");
	const first = digestFileTree(tree);
	chmodSync(file, 0o755);
	utimesSync(file, new Date(1), new Date(1));
	assert.equal(digestFileTree(tree), first);

	writeFileSync(file, "changed bytes\n");
	assert.notEqual(digestFileTree(tree), first);
	symlinkSync(file, join(tree, "link.txt"));
	assert.throws(() => digestFileTree(tree), /symlink/i);
	rmSync(join(tree, "link.txt"));

	if (process.platform !== "win32") {
		const fifo = join(tree, "pipe");
		execFileSync("mkfifo", [fifo]);
		assert.throws(() => digestFileTree(tree), /special file/i);
	}
});

test("artifact digest normalizes only the bare Astro UID and Pagefind language ordering", (t) => {
	const root = tempDirectory(t);
	const pagefind = join(root, "pagefind");
	mkdirSync(pagefind);
	writeFileSync(join(root, "index.html"), '<astro-island uid="build-one" data-uid="data-one" aria-uid="aria-one"><p>static</p></astro-island>');
	writeFileSync(join(pagefind, "pagefind-entry.json"), JSON.stringify({
		version: "1.5.2",
		languages: { "zh-cn": { hash: "zh-cn_1", page_count: 1 }, "en-us": { hash: "en-us_1", page_count: 1 } },
	}));
	const first = digestArtifactTree(root);

	writeFileSync(join(root, "index.html"), '<astro-island uid="build-two" data-uid="data-one" aria-uid="aria-one"><p>static</p></astro-island>');
	writeFileSync(join(pagefind, "pagefind-entry.json"), JSON.stringify({
		version: "1.5.2",
		languages: { "en-us": { hash: "en-us_1", page_count: 1 }, "zh-cn": { hash: "zh-cn_1", page_count: 1 } },
	}));
	assert.equal(digestArtifactTree(root), first);
	writeFileSync(join(pagefind, "pagefind-entry.json"), JSON.stringify({
		version: "1.5.2",
		languages: { "en-us": { hash: "en-us_1", page_count: 1 }, "zh-cn": { hash: "zh-cn_1", page_count: 1 } },
	}, null, 2));
	assert.equal(digestArtifactTree(root), first, "Pagefind JSON formatting is reserialized");
	writeFileSync(join(root, "index.html"), '<astro-island uid="build-two" data-uid="data-two" aria-uid="aria-one"><p>static</p></astro-island>');
	assert.notEqual(digestArtifactTree(root), first, "data-uid remains significant");
	writeFileSync(join(root, "index.html"), '<astro-island uid="build-two" data-uid="data-one" aria-uid="aria-two"><p>static</p></astro-island>');
	assert.notEqual(digestArtifactTree(root), first, "aria-uid remains significant");
	writeFileSync(join(root, "index.html"), '<astro-island uid="build-two" data-uid="data-one" aria-uid="aria-one"><p>static</p></astro-island>');

	writeFileSync(join(pagefind, "pagefind-entry.json"), JSON.stringify({
		version: "1.5.2",
		languages: { "zh-cn": { hash: "zh-cn_1", page_count: 1 }, "en-us": { hash: "en-us_2", page_count: 1 } },
	}));
	assert.notEqual(digestArtifactTree(root), first, "nested Pagefind values remain significant");
	writeFileSync(join(pagefind, "pagefind-entry.json"), JSON.stringify({
		version: "1.5.2",
		languages: { "en-us": { hash: "en-us_1", page_count: 1 }, "zh-cn": { hash: "zh-cn_1", page_count: 1 } },
	}));

	writeFileSync(join(root, "index.html"), '<astro-island uid="build-two" data-uid="data-one" aria-uid="aria-one"><p>changed</p></astro-island>');
	assert.notEqual(digestArtifactTree(root), first);
});

test("Astro-looking text in quoted attributes, comments, raw text, and templates remains significant", (t) => {
	const root = tempDirectory(t);
	const htmlPath = join(root, "index.html");
	const html = (label, uid) => [
		`<!-- <astro-island uid="comment-${label}"> -->`,
		`<script><!--<script><astro-island uid="script-${label}"></script><astro-island uid="script-double-${label}"></astro-island>--></script>`,
		`<style>.example::after { content: '<astro-island uid="style-${label}">'; }</style>`,
		`<textarea><astro-island uid="textarea-${label}"></textarea>`,
		`<title><astro-island uid="title-${label}"></title>`,
		`<template><astro-island uid="template-${label}"></astro-island></template>`,
		`<svg><astro-island uid="svg-${label}"></astro-island></svg>`,
		`<math><astro-island uid="math-${label}"></astro-island></math>`,
		`<astro-island data-note='literal <astro-island uid="quoted-${label}"> > remains data' uid="${uid}" data-tail="tail-${label}"><p>static</p></astro-island>`,
	].join("");
	writeFileSync(htmlPath, html("one", "build-one"));
	const first = digestArtifactTree(root);

	writeFileSync(htmlPath, html("two", "build-one"));
	assert.notEqual(digestArtifactTree(root), first, "fake UIDs and surrounding tag metadata remain significant");

	writeFileSync(htmlPath, html("one", "build-two"));
	assert.equal(digestArtifactTree(root), first, "only the actual UID value is normalized");

	writeFileSync(htmlPath, '<astro-island data-note=\'unfinished uid="fake-one\'');
	const malformed = digestArtifactTree(root);
	writeFileSync(htmlPath, '<astro-island data-note=\'unfinished uid="fake-two\'');
	assert.notEqual(digestArtifactTree(root), malformed, "an unterminated tag is left unchanged");
});

test("HTML UID spans preserve UTF-8 bytes and invalid UTF-8 fails closed", (t) => {
	const root = tempDirectory(t);
	const htmlPath = join(root, "index.html");
	writeFileSync(htmlPath, '<p>雪🦥</p><astro-island title="雪" uid="build-one"></astro-island>');
	const first = digestArtifactTree(root);
	writeFileSync(htmlPath, '<p>雪🦥</p><astro-island title="雪" uid="build-two"></astro-island>');
	assert.equal(digestArtifactTree(root), first);

	writeFileSync(htmlPath, Buffer.concat([Buffer.from('<astro-island uid="build-one">'), Buffer.from([0xff])]));
	const invalidUtf8 = digestArtifactTree(root);
	writeFileSync(htmlPath, Buffer.concat([Buffer.from('<astro-island uid="build-two">'), Buffer.from([0xff])]));
	assert.notEqual(digestArtifactTree(root), invalidUtf8, "invalid UTF-8 bytes remain untouched");
});

test("build environment identity hashes only the inherited allowlist and public overrides", () => {
	const selected = selectBuildEnvironment({
		PUBLIC_SITE_TITLE: "private-looking-but-public",
		VERCEL: "1",
		PRIVATE_TOKEN: "never inherit",
		UNRELATED: "not part of the child environment",
	});
	assert.deepEqual(selected, { PUBLIC_SITE_TITLE: "private-looking-but-public", VERCEL: "1" });
	const digest = digestBuildEnvironment({ NODE_ENV: "production", PUBLIC_SITE_TITLE: "Original title" });
	assert.match(digest, /^sha256:[a-f0-9]{64}$/);
	assert.notEqual(digest, digestBuildEnvironment({ NODE_ENV: "production", PUBLIC_SITE_TITLE: "Changed title" }));
	assert.equal(digest, digestBuildEnvironment({ PUBLIC_SITE_TITLE: "Original title", NODE_ENV: "production" }));
	assert.doesNotMatch(digest, /Original title/);
});

test("creates and validates versioned provenance, rejecting invalid schema and mismatched inputs", (t) => {
	const root = tempDirectory(t);
	const coreRoot = join(root, "core");
	const coreSha = initRepo(coreRoot, { "core.txt": "core\n" });
	const core = resolveGitInput({ directory: coreRoot, requestedRef: coreSha, label: "Core" });
	const siteRoot = join(root, "site");
	mkdirSync(siteRoot);
	writeFileSync(join(siteRoot, "post.md"), "site content\n");
	const site = resolveSiteInput({ directory: siteRoot });
	const artifactDigest = digestFileTree(siteRoot);
	const manifest = createProvenanceManifest({
		core,
		site,
		siteSchemaVersion: SITE_SCHEMA_VERSION,
		toolchain: {
			node: "v22.12.0",
			pnpm: "9.14.4",
			platform: "linux",
			architecture: "x64",
			lockfile: { path: "pnpm-lock.yaml", digest: `sha256:${"1".repeat(64)}` },
		},
		configuration: {
			entrypoint: "./build.sh --compose",
			build_mode: "external-site",
			output: "dist/",
			build_only: true,
			indexing_submissions: false,
			inherited_environment_digest: digestBuildEnvironment({ PUBLIC_SITE_TITLE: "safe-to-hash" }),
			build_clock: { source: "max-input-commit-time", source_date_epoch: 1_793_524_800, timezone: "UTC" },
		},
		artifactId: "kirari-composition-test",
		artifactDigest,
	});

	assert.equal(manifest.schema_version, 2);
	assert.equal(manifest.artifact.id, "kirari-composition-test");
	assert.equal(manifest.site_schema_version, SITE_SCHEMA_VERSION);
	assert.equal(manifest.site.resolved_sha, null);
	assert.equal("checkout_root" in manifest.core, false);
	assert.equal(validateProvenanceManifest(manifest, { core, site, artifactId: "kirari-composition-test", artifactDigest }), true);
	assert.throws(() => validateProvenanceManifest({ ...manifest, schema_version: 1 }), /schema_version must be 2/i);
	assert.throws(() => validateProvenanceManifest({ ...manifest, artifact: { ...manifest.artifact, id: "" } }), /artifact\.id/i);
	assert.throws(() => validateProvenanceManifest({ ...manifest, build: { toolchain: {}, configuration: {} } }), /build\.toolchain must contain exactly/i);
	assert.throws(() => validateProvenanceManifest({
		...manifest,
		build: { ...manifest.build, configuration: { ...manifest.build.configuration, build_clock: { source: "unknown", source_date_epoch: 1, timezone: "UTC" } } },
	}), /build\.configuration\.build_clock\.source/i);
	assert.throws(() => validateProvenanceManifest({
		...manifest,
		build: { ...manifest.build, configuration: { ...manifest.build.configuration, build_clock: { source: "max-input-commit-time", source_date_epoch: -1, timezone: "UTC" } } },
	}), /build\.configuration\.build_clock\.source_date_epoch/i);
	assert.throws(() => validateProvenanceManifest({
		...manifest,
		build: { ...manifest.build, configuration: { ...manifest.build.configuration, build_clock: { source: "max-input-commit-time", source_date_epoch: 8_640_000_000_000_001, timezone: "UTC" } } },
	}), /build\.configuration\.build_clock\.source_date_epoch/i);
	assert.throws(
		() => validateProvenanceManifest(manifest, { core: { ...core, resolved_sha: "0".repeat(40) } }),
		/Provenance mismatch: core\.resolved_sha/i,
	);
	assert.throws(() => validateProvenanceManifest(manifest, { artifactDigest: `sha256:${"0".repeat(64)}` }), /artifact digest/i);
	assert.throws(() => createProvenanceManifest({
		core,
		site,
		siteSchemaVersion: SITE_SCHEMA_VERSION,
		toolchain: manifest.build.toolchain,
		configuration: manifest.build.configuration,
		artifactId: "kirari-composition-test",
		artifactDigest: "not-a-digest",
	}), /artifact\.digest/i);
	assert.equal(readFileSync(join(siteRoot, "post.md"), "utf8"), "site content\n");
});
