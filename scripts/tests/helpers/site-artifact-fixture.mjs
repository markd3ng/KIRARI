import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createProvenanceManifest, digestArtifactTree } from "../../composition-provenance.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const runId = "100";
const runAttempt = "1";
const sourceSha = "a".repeat(40);
const compositionArtifactId = "200";
const packageArtifactId = "300";

export function sha256Digest(bytes) {
	return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

export function zipDirectory(directory, archivePath) {
	execFileSync("python3", ["-c", [
		"import os,sys,zipfile",
		"root,archive=sys.argv[1:]",
		"with zipfile.ZipFile(archive,'w',compression=zipfile.ZIP_DEFLATED) as z:",
		"  for base,dirs,files in os.walk(root):",
		"    dirs.sort(); files.sort()",
		"    for name in files:",
		"      path=os.path.join(base,name)",
		"      z.write(path,os.path.relpath(path,root).replace(os.sep,'/'))",
	].join("\n"), directory, archivePath], { cwd: repoRoot, env: process.env, stdio: "ignore", windowsHide: true });
	return readFileSync(archivePath);
}

export function createSiteArtifactFetchMock(fixture) {
	const records = new Map([
		[packageArtifactId, {
			id: Number(packageArtifactId), name: fixture.expected.package.name, digest: fixture.expected.package.digest, expired: false,
			expires_at: new Date(Date.now() + 24 * 60 * 60_000).toISOString(),
			workflow_run: { id: Number(runId), head_sha: sourceSha, head_branch: "main" },
			archive_download_url: `https://api.github.com/repos/markd3ng/KIRARI/actions/artifacts/${packageArtifactId}/zip`,
		}],
		[compositionArtifactId, {
			id: Number(compositionArtifactId), name: `kirari-composition-${runId}-${runAttempt}`, digest: fixture.upstreamDigest, expired: false,
			expires_at: new Date(Date.now() + 24 * 60 * 60_000).toISOString(),
			workflow_run: { id: Number(runId), head_sha: sourceSha, head_branch: "main" },
			archive_download_url: `https://api.github.com/repos/markd3ng/KIRARI/actions/artifacts/${compositionArtifactId}/zip`,
		}],
	]);
	const archives = new Map([
		[packageArtifactId, fixture.packageZipBytes],
		[compositionArtifactId, fixture.compositionZipBytes],
	]);
	return async (input, options = {}) => {
		const url = new URL(input instanceof URL ? input.href : typeof input === "string" ? input : input.url);
		const artifactMatch = /^\/repos\/markd3ng\/KIRARI\/actions\/artifacts\/(\d+)(\/zip)?$/.exec(url.pathname);
		if (url.hostname === "api.github.com" && artifactMatch) {
			const [, id, zip] = artifactMatch;
			const record = records.get(id);
			if (!record) return new Response("missing", { status: 404 });
			if (!zip) return new Response(JSON.stringify(record), { headers: { "content-type": "application/json" } });
			assert.equal(options.redirect, "manual");
			return new Response(null, { status: 302, headers: { location: `https://downloads.example.test/${id}` } });
		}
		if (url.hostname === "downloads.example.test") {
			const bytes = archives.get(url.pathname.slice(1));
			if (!bytes) return new Response("missing", { status: 404 });
			return new Response(bytes, { headers: { "content-length": String(bytes.length) } });
		}
		throw new Error("Unexpected test fetch target");
	};
}

export function createSiteArtifactFixture() {
	const root = mkdtempSync(join(tmpdir(), "kirari-site-artifact-fixture-"));
	const compositionRoot = join(root, "composition");
	const distRoot = join(compositionRoot, "dist");
	const siteRoot = join(root, "site-source");
	const packageRoot = join(root, "site-package");
	const compositionZipPath = join(root, "composition.zip");
	const packageZipPath = join(root, "site-package.zip");
	mkdirSync(join(distRoot, "posts/demo"), { recursive: true });
	mkdirSync(siteRoot);
	writeFileSync(join(distRoot, "index.html"), '<!doctype html><html><head><title>Fixture</title><link rel="stylesheet" href="/styles.css"></head><body><nav><a href="/posts/demo/">Demo</a></nav><h1>Fixture</h1></body></html>\n');
	writeFileSync(join(distRoot, "posts/demo/index.html"), '<!doctype html><html><head><title>Demo</title></head><body><h1>Demo article</h1></body></html>\n');
	writeFileSync(join(distRoot, "styles.css"), "body { color: #123; }\n");
	const provenance = createProvenanceManifest({
		core: { kind: "git", repository: "https://github.com/markd3ng/KIRARI", requested_ref: "main", resolved_sha: sourceSha },
		site: { kind: "git", repository: "https://github.com/markd3ng/KIRARI", requested_ref: "site-fixture", resolved_sha: "b".repeat(40), source_subdirectory: "site" },
		siteSchemaVersion: 2,
		toolchain: { node: "22.0.0", pnpm: "9.14.4", platform: "linux", architecture: "x64", lockfile: { path: "pnpm-lock.yaml", digest: sha256Digest(Buffer.from("fixture lock")) } },
		configuration: {
			entrypoint: "build.sh", build_mode: "static", output: "dist", build_only: true, indexing_submissions: false,
			inherited_environment_digest: sha256Digest(Buffer.from("fixture environment")),
			build_clock: { source: "max-input-commit-time", source_date_epoch: 1_700_000_000, timezone: "UTC" },
		},
		artifactId: `kirari-composition-${runId}-${runAttempt}`,
		artifactDigest: digestArtifactTree(distRoot),
	});
	writeFileSync(join(compositionRoot, "provenance.json"), `${JSON.stringify(provenance, null, 2)}\n`);
	const compositionZipBytes = zipDirectory(compositionRoot, compositionZipPath);
	const upstreamDigest = sha256Digest(compositionZipBytes);
	const packaged = spawnSync(process.execPath, [
		join(repoRoot, "scripts/package-vercel-site.mjs"),
		"--input", compositionRoot, "--output", packageRoot, "--site-root", siteRoot,
		"--source-artifact-id", compositionArtifactId, "--source-artifact-digest", upstreamDigest,
		"--source-artifact-name", `kirari-composition-${runId}-${runAttempt}`,
		"--source-run-id", runId, "--source-run-attempt", runAttempt,
	], { cwd: repoRoot, encoding: "utf8", windowsHide: true });
	assert.equal(packaged.status, 0, `${packaged.stdout}\n${packaged.stderr}`);
	const packageZipBytes = zipDirectory(packageRoot, packageZipPath);
	const expected = {
		schema_version: 1,
		source: { run_id: runId, run_attempt: runAttempt, head_sha: sourceSha, ref: "refs/heads/main", event: "workflow_dispatch", conclusion: "success", workflow_path: ".github/workflows/ci.yml" },
		package: { id: packageArtifactId, name: `kirari-site-package-${runId}-${runAttempt}`, digest: sha256Digest(packageZipBytes) },
	};
	return {
		root, compositionRoot, packageRoot, siteRoot, compositionZipPath, packageZipPath,
		compositionZipBytes, packageZipBytes, upstreamDigest, expected,
		cleanup: () => rmSync(root, { recursive: true, force: true }),
	};
}
