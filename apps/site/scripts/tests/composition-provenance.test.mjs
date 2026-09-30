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

test("artifact digest normalizes Astro hydration ids and Pagefind language key order", (t) => {
	const root = tempDirectory(t);
	const pagefind = join(root, "pagefind");
	mkdirSync(pagefind);
	writeFileSync(join(root, "index.html"), '<astro-island uid="build-one"><p>static</p></astro-island>');
	writeFileSync(join(pagefind, "pagefind-entry.json"), JSON.stringify({
		version: "1.5.2",
		languages: { "zh-cn": { hash: "zh-cn_1", page_count: 1 }, "en-us": { hash: "en-us_1", page_count: 1 } },
	}));
	const first = digestArtifactTree(root);

	writeFileSync(join(root, "index.html"), '<astro-island uid="build-two"><p>static</p></astro-island>');
	writeFileSync(join(pagefind, "pagefind-entry.json"), JSON.stringify({
		version: "1.5.2",
		languages: { "en-us": { hash: "en-us_1", page_count: 1 }, "zh-cn": { hash: "zh-cn_1", page_count: 1 } },
	}));
	assert.equal(digestArtifactTree(root), first);

	writeFileSync(join(root, "index.html"), '<astro-island uid="build-two"><p>changed</p></astro-island>');
	assert.notEqual(digestArtifactTree(root), first);
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
		},
		artifactDigest,
	});

	assert.equal(manifest.schema_version, 1);
	assert.equal(manifest.site_schema_version, SITE_SCHEMA_VERSION);
	assert.equal(manifest.site.resolved_sha, null);
	assert.equal("checkout_root" in manifest.core, false);
	assert.equal(validateProvenanceManifest(manifest, { core, site, artifactDigest }), true);
	assert.throws(() => validateProvenanceManifest({ ...manifest, schema_version: 2 }), /schema_version must be 1/i);
	assert.throws(() => validateProvenanceManifest({ ...manifest, build: { toolchain: {}, configuration: {} } }), /build\.toolchain must contain exactly/i);
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
		artifactDigest: "not-a-digest",
	}), /artifact\.digest/i);
	assert.equal(readFileSync(join(siteRoot, "post.md"), "utf8"), "site content\n");
});
