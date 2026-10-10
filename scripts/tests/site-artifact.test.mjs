import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { downloadVerifiedArtifact, readSiteArtifactZipMember, verifySitePackageArchive } from "../site-artifact.mjs";
import { createSiteArtifactFetchMock, createSiteArtifactFixture, sha256Digest } from "./helpers/site-artifact-fixture.mjs";

function makeZip(directory, entries) {
	const zipPath = join(directory, "fixture.zip");
	execFileSync("python3", ["-c", "import json,sys,zipfile\nwith zipfile.ZipFile(sys.argv[1], 'w', compression=zipfile.ZIP_DEFLATED) as z:\n for name,value in json.loads(sys.argv[2]): z.writestr(name,value)\n", zipPath, JSON.stringify(entries)]);
	return readFileSync(zipPath);
}

function artifactRecord({ archiveDigest, now = Date.now(), headSha = "a".repeat(40), headBranch = "main" } = {}) {
	return {
		id: 42,
		name: "kirari-p4-production-10-1",
		digest: archiveDigest,
		expired: false,
		expires_at: new Date(now + 60_000).toISOString(),
		archive_download_url: "https://api.github.com/repos/markd3ng/KIRARI/actions/artifacts/42/zip",
		workflow_run: { id: 10, head_sha: headSha, head_branch: headBranch },
	};
}

test("bounded ZIP member reader returns the exact release-record member", () => {
	const directory = mkdtempSync(join(tmpdir(), "kirari-site-artifact-test-"));
	try {
		const record = Buffer.from('{"result":"PASS"}\n');
		const archive = makeZip(directory, [["production-record.json", record.toString("utf8")], ["nested/extra.txt", "safe"]]);
		assert.deepEqual(readSiteArtifactZipMember(archive, "production-record.json"), record);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});

test("bounded ZIP member reader rejects path traversal and missing members", () => {
	const directory = mkdtempSync(join(tmpdir(), "kirari-site-artifact-test-"));
	try {
		const archive = makeZip(directory, [["../outside.txt", "not-safe"]]);
		assert.throws(() => readSiteArtifactZipMember(archive, "outside.txt"), /does not safely contain/);
		assert.throws(() => readSiteArtifactZipMember(archive, "missing.json"), /does not safely contain/);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});

test("generic GitHub artifact download binds repository, metadata, source SHA, expiry and archive bytes", async () => {
	const directory = mkdtempSync(join(tmpdir(), "kirari-site-artifact-test-"));
	const archivePath = join(directory, "release.zip");
	const archiveBytes = Buffer.from("zip bytes with no secrets");
	const archiveDigest = `sha256:${createHash("sha256").update(archiveBytes).digest("hex")}`;
	const calls = [];
	const fetchImpl = async (input, options = {}) => {
		const url = new URL(input);
		calls.push({ url, options });
		if (url.hostname === "api.github.com" && url.pathname.endsWith("/42")) return new Response(JSON.stringify(artifactRecord({ archiveDigest })));
		if (url.hostname === "api.github.com" && url.pathname.endsWith("/42/zip")) return new Response(null, { status: 302, headers: { location: "https://downloads.example.test/signed/archive.zip" } });
		if (url.hostname === "downloads.example.test") return new Response(archiveBytes);
		throw new Error("unexpected fetch");
	};
	try {
		const result = await downloadVerifiedArtifact({
			repository: "markd3ng/KIRARI",
			artifactId: "42",
			expectedName: "kirari-p4-production-10-1",
			expectedDigest: archiveDigest,
			expectedRun: { id: "10", attempt: "1", head_sha: "a".repeat(40), head_branch: "main" },
			token: "test-github-token",
			destination: archivePath,
			fetchImpl,
		});
		assert.equal(result.archivePath, archivePath);
		assert.equal(result.digest, archiveDigest);
		assert.equal(createHash("sha256").update(readFileSync(archivePath)).digest("hex"), archiveDigest.slice("sha256:".length));
		assert.equal(calls.length, 3);
		assert.equal(calls[0].url.pathname, "/repos/markd3ng/KIRARI/actions/artifacts/42");
		assert.equal(calls[1].options.headers.Authorization, "Bearer test-github-token");
		assert.equal(calls[2].options.headers?.Authorization, undefined, "signed download host must not receive GitHub credentials");
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});

test("generic GitHub artifact download rejects source substitution and expired metadata", async () => {
	const directory = mkdtempSync(join(tmpdir(), "kirari-site-artifact-test-"));
	const archiveBytes = Buffer.from("archive");
	const archiveDigest = `sha256:${createHash("sha256").update(archiveBytes).digest("hex")}`;
	try {
		for (const record of [artifactRecord({ archiveDigest, headSha: "b".repeat(40) }), { ...artifactRecord({ archiveDigest }), expires_at: new Date(Date.now() - 60_000).toISOString() }]) {
			const fetchImpl = async () => new Response(JSON.stringify(record));
			await assert.rejects(downloadVerifiedArtifact({ repository: "markd3ng/KIRARI", artifactId: "42", expectedName: record.name, expectedDigest: archiveDigest, expectedRun: { id: "10", attempt: "1", head_sha: "a".repeat(40), head_branch: "main" }, token: "test-github-token", destination: join(directory, `rejected-${Math.random()}.zip`), fetchImpl }), /verified source run|expired/);
		}
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});

test("shared verifier proves a complete immutable package and retains original ZIP bytes", async () => {
	const fixture = createSiteArtifactFixture();
	try {
		const outputDirectory = join(fixture.root, "verified-package");
		const retainArchiveDirectory = join(fixture.root, "retained-archives");
		const result = await verifySitePackageArchive({
			expected: fixture.expected,
			repository: "markd3ng/KIRARI",
			token: "test-github-token",
			fetchImpl: createSiteArtifactFetchMock(fixture),
			outputDirectory,
			retainArchiveDirectory,
		});
		assert.equal(result.result, "PASS");
		assert.equal(result.packageArchiveSha256, fixture.expected.package.digest);
		assert.equal(result.upstreamArchiveSha256, fixture.upstreamDigest);
		assert.equal(result.upstream.run_id, fixture.expected.source.run_id);
		assert.equal(result.upstream.run_attempt, fixture.expected.source.run_attempt);
		assert.equal(result.manifest.target.project, "kirari-test");
		assert.equal(result.manifest.target.environment, "preview");
		assert.ok(result.deploymentFiles.length > 0);
		assert.equal(readFileSync(result.retainedArchives.packageZipPath).equals(fixture.packageZipBytes), true);
		assert.equal(readFileSync(result.retainedArchives.upstreamZipPath).equals(fixture.compositionZipBytes), true);
		assert.equal(result.retainedArchives.packageArchiveSha256, sha256Digest(fixture.packageZipBytes));
	} finally {
		fixture.cleanup();
	}
});

test("shared verifier rejects substituted upstream composition bytes", async () => {
	const fixture = createSiteArtifactFixture();
	try {
		const fetchImpl = createSiteArtifactFetchMock({ ...fixture, compositionZipBytes: Buffer.from("unrelated composition") });
		await assert.rejects(verifySitePackageArchive({
			expected: fixture.expected,
			repository: "markd3ng/KIRARI",
			token: "test-github-token",
			fetchImpl,
			outputDirectory: join(fixture.root, "rejected-package"),
		}), /digest does not match/);
	} finally {
		fixture.cleanup();
	}
});
