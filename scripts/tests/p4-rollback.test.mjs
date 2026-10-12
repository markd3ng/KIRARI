import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { verifyRollbackRelease, releaseRecordDigest, restoreApprovedRelease, loadApprovedRollback } from "../p4-production/rollback.mjs";
import { verifySitePackage } from "../site-artifact.mjs";
import { createSiteArtifactFixture, zipDirectory, sha256Digest } from "./helpers/site-artifact-fixture.mjs";

const d = (c) => `sha256:${c.repeat(64)}`;
function fixture() {
	const target = { platform: "vercel", team_id: "team_approved", project: "site", project_id: "prj_approved", environment: "production", domains: ["site.vercel.app"], canonical_origin: "https://site.vercel.app", deployment_id: "dpl_prior", url: "https://site-immutable.vercel.app", deployment_target: "production", operation: "deploy", previous_deployment_id: null };
	const record = { schema_version: 1, kind: "kirari-production-release", result: "PASS", authorization: { actor: "owner", repository: "owner/repo", binding_digest: d("a") }, target,
		source_run: { id: "10", attempt: "1", sha: "a".repeat(40) }, package_artifact: { id: "11", name: "kirari-site-package-10-1", archive_digest: d("b") }, upstream_artifact: { id: "12", name: "kirari-composition-10-1", run_id: "10", run_attempt: "1", digest: d("c") }, core: {kind: "git", repository: "https://github.com/owner/repo", requested_ref: "main", resolved_sha: "a".repeat(40) }, site: {kind: "git", repository: "https://github.com/owner/repo", requested_ref: "site-source", source_subdirectory: "site", resolved_sha: "b".repeat(40) }, output_digest: d("d"), byte_output_digest: d("e"), inventory_digest: d("f"),
		browser: { result: "PASS", mode: "production", phase: "live", baseUrl: target.canonical_origin, canonicalOrigin: target.canonical_origin, indexable: true, canonicalDocuments: 1, robotsSitemapCount: 1, routes: 1, assets: {required: 1,loaded: 1}, expectedExternalCalls: 0, browserConsoleErrors: 0, pageErrors: 0, failedBrowserRequests: 0, badResponses: 0, unexpectedExternalCalls: 0, byteEquality: "PASS", artifactBytesVerified: true, byteOutputDigest: d("e"), inventoryDigest: d("f"), fileCount: 1, totalBytes: 1 },
		workflow: { id: "20", attempt: "1", sha: "c".repeat(40), main_sha: "c".repeat(40), path: ".github/workflows/site-production.yml", actor: "owner", triggering_actor: "owner", created_at: "2026-10-01T00:00:00.000Z" }, production_action: true, indexing_action: false, dns_action: false, release_action: false };
	const archiveBytes = execFileSync("python3", ["-c", "import io,sys,zipfile; b=io.BytesIO(); z=zipfile.ZipFile(b,'w'); z.writestr('production-record.json',sys.stdin.buffer.read()); z.close(); sys.stdout.buffer.write(b.getvalue())"], { input: JSON.stringify(record) });
	const archiveDigest = `sha256:${createHash("sha256").update(archiveBytes).digest("hex")}`;
	const approved = { run_id: "20", run_attempt: "1", workflow_sha: "c".repeat(40), artifact_id: "21", archive_digest: archiveDigest, record_digest: releaseRecordDigest(record), deployment_id: "dpl_prior" };
	const run = { id: 20, run_attempt: 1, head_sha: approved.workflow_sha, repository: { full_name: "owner/repo" }, head_repository: { full_name: "owner/repo" }, event: "workflow_dispatch", path: record.workflow.path, head_branch: "main", status: "completed", conclusion: "success", actor: { login: "owner" }, triggering_actor: { login: "owner" } };
	const artifact = { id: 21, name: "kirari-p4-production-20-1", expired: false, digest: archiveDigest, expires_at: "2026-12-01T00:00:00Z", workflow_run: { id: 20, head_sha: approved.workflow_sha, head_branch: "main" } };
	return { record, archiveBytes, artifact, run, approved, repository: "owner/repo", owner: "owner", trustedWorkflowSha: approved.workflow_sha, target, now: Date.parse("2026-10-04T00:00:00Z") };
}

test("rollback requires a successful approved immutable release and authentic archive", () => {
	assert.equal(verifyRollbackRelease(fixture()).target.deployment_id, "dpl_prior");
});

for (const [name, change] of [
	["record substitution", (x) => { x.record.target.deployment_id = "dpl_attacker"; }],
	["archive substitution", (x) => { x.archiveBytes = Buffer.from("other archive"); }],
	["artifact producer substitution", (x) => { x.artifact.workflow_run.id = 99; }],
	["expired archive", (x) => { x.artifact.expires_at = "2026-01-01T00:00:00Z"; }],
	["unreviewed workflow", (x) => { x.trustedWorkflowSha = "d".repeat(40); }],
	["fork producer", (x) => { x.run.head_repository.full_name = "attacker/repo"; }],
	["rerun producer", (x) => { x.run.run_attempt = 2; }],
	["wrong triggering actor", (x) => { x.run.triggering_actor.login = "attacker"; }],
	["failed release run", (x) => { x.run.conclusion = "failure"; }],
	["Preview release", (x) => { x.record.target.deployment_target = null; x.approved.record_digest = releaseRecordDigest(x.record); }],
	["wrong team", (x) => { x.target = { ...x.target, team_id: "team_wrong" }; }],
	["domain substitution", (x) => { x.target = { ...x.target, domains: ["evil.example"] }; }],
	["upstream substitution", (x) => { x.record.upstream_artifact.run_id = "99"; x.approved.record_digest = releaseRecordDigest(x.record); }],
	["health failure", (x) => { x.record.browser.unexpectedExternalCalls = 1; x.approved.record_digest = releaseRecordDigest(x.record); }],
]) test(`rollback denies ${name}`, () => {
	const x = fixture(); change(x); assert.throws(() => verifyRollbackRelease(x));
});

for (const [name, change] of [
	["authentic but Preview", (record) => { record.target.environment = "preview"; }],
	["authentic but unhealthy", (record) => { record.browser.pageErrors = 1; }],
	["authentic but upstream mismatch", (record) => { record.upstream_artifact.run_id = "99"; }],
]) test(`rollback rejects ${name} record after archive authentication`, () => {
	const x = fixture();
	change(x.record);
	x.archiveBytes = execFileSync("python3", ["-c", "import io,sys,zipfile; b=io.BytesIO(); z=zipfile.ZipFile(b,'w'); z.writestr('production-record.json',sys.stdin.buffer.read()); z.close(); sys.stdout.buffer.write(b.getvalue())"], {input:JSON.stringify(x.record)});
	x.approved.archive_digest = x.artifact.digest = `sha256:${createHash("sha256").update(x.archiveBytes).digest("hex")}`;
	x.approved.record_digest = releaseRecordDigest(x.record);
	assert.throws(() => verifyRollbackRelease(x));
});

function simulatedApi(candidate, { wrongBefore = false, wrongAfter = false, failedHealth = false } = {}) {
	let current = "dpl_current";
	const calls = [];
	const target = candidate.target;
	return {
		calls,
		api: {
			getProject: async () => ({ id: target.project_id, name: target.project, accountId: target.team_id }),
			getDeployment: async () => ({ id: target.deployment_id, projectId: target.project_id, target: "production", readyState: "READY", url: new URL(target.url).hostname }),
			getAliases: async () => [{ alias: target.domains[0], projectId: target.project_id, deploymentId: wrongBefore || (wrongAfter && current === target.deployment_id) ? "dpl_wrong" : current }],
			promoteExisting: async (id) => { calls.push({ operation: "point-existing-production-traffic", deploymentId: id }); current = id; },
		},
		verifyBytes: async () => ({ result: "PASS", byte_output_digest: candidate.record.byte_output_digest, inventory_digest: candidate.record.inventory_digest }),
		validateProduction: async () => ({ ...candidate.record.browser, phase: "restore", result: failedHealth ? "FAIL" : "PASS", baseUrl: target.canonical_origin }),
	};
}

test("simulation restores only the approved existing deployment, with no build", async () => {
	const candidate = verifyRollbackRelease(fixture());
	const simulated = simulatedApi(candidate);
	const evidence = await restoreApprovedRelease({ candidate, currentDeploymentId: "dpl_current", ...simulated });
	assert.equal(evidence.result, "PASS");
	assert.equal(evidence.no_rebuild, true);
	assert.deepEqual(simulated.calls, [{ operation: "point-existing-production-traffic", deploymentId: "dpl_prior" }]);
});

test("pre-rollback drift denies all writes", async () => {
	const candidate = verifyRollbackRelease(fixture());
	const simulated = simulatedApi(candidate, { wrongBefore: true });
	await assert.rejects(restoreApprovedRelease({ candidate, currentDeploymentId: "dpl_current", ...simulated }));
	assert.deepEqual(simulated.calls, []);
});

for (const options of [{ wrongAfter: true }, { failedHealth: true }]) test("post-write rollback failure remains INCOMPLETE", async () => {
	const candidate = verifyRollbackRelease(fixture());
	const result = await restoreApprovedRelease({ candidate, currentDeploymentId: "dpl_current", ...simulatedApi(candidate, options) });
	assert.equal(result.result, "INCOMPLETE");
	assert.equal(result.production_action, true);
});

test("rollback materializes exact retained ZIPs without needing expired original CI artifacts", async (t) => {
	const files = createSiteArtifactFixture(); t.after(files.cleanup);
	const x = fixture();
	const verified = verifySitePackage({packageRoot:files.packageRoot,upstreamRoot:files.compositionRoot});
	const record = x.record;
	record.authorization.actor = record.workflow.actor = record.workflow.triggering_actor = "markd3ng";
	record.authorization.repository = "markd3ng/KIRARI";
	record.source_run = {id:files.expected.source.run_id,attempt:files.expected.source.run_attempt,sha:files.expected.source.head_sha};
	record.package_artifact = {id:files.expected.package.id,name:files.expected.package.name,archive_digest:files.expected.package.digest};
	record.upstream_artifact = verified.upstreamArtifact;
	record.core = verified.manifest.core; record.site = verified.manifest.site; record.output_digest = verified.outputDigest;
	const evidence = join(files.root,"prior-release"); mkdirSync(join(evidence,"retained"),{recursive:true});
	writeFileSync(join(evidence,"production-record.json"),JSON.stringify(record));
	writeFileSync(join(evidence,"retained/site-package.zip"),files.packageZipBytes);
	writeFileSync(join(evidence,"retained/composition.zip"),files.compositionZipBytes);
	let archive = zipDirectory(evidence,join(files.root,"release.zip"));
	const approved = {...x.approved,run_attempt:1,archive_digest:sha256Digest(archive),record_digest:releaseRecordDigest(record)};
	const rollbackTarget = Object.fromEntries(["team_id","project","project_id","environment","domains","canonical_origin"].map(key=>[key,record.target[key]]));
	const binding = {schema_version:1,repository:"markd3ng/KIRARI",workflow_path:record.workflow.path,workflow_sha:record.workflow.sha,main_sha:record.workflow.sha,issued_at:1791072000,nonce:"a".repeat(32),source:{run_id:record.source_run.id,run_attempt:1,sha:record.source_run.sha},package:{artifact_id:record.package_artifact.id,archive_digest:record.package_artifact.archive_digest},composition:{core_sha:record.core.resolved_sha,site_sha:record.site.resolved_sha},target:{...rollbackTarget,operation:"rollback",current_deployment_id:"dpl_current"},rollback_record:approved};
	const run = {...x.run,repository:{full_name:binding.repository},head_repository:{full_name:binding.repository},actor:{login:"markd3ng"},triggering_actor:{login:"markd3ng"}};
	const artifact = {...x.artifact,digest:approved.archive_digest,expires_at:"2030-01-01T00:00:00.000Z",archive_download_url:`https://api.github.com/repos/${binding.repository}/actions/artifacts/21/zip`};
	const reads=[];
	const fetchImpl = async (input) => {
		const url = new URL(input); reads.push(url.pathname);
		if(url.hostname==="downloads.example.test")return new Response(archive);
		if(url.pathname.endsWith("/actions/runs/20"))return Response.json(run);
		if(url.pathname.endsWith("/actions/artifacts/21"))return Response.json(artifact);
		if(url.pathname.endsWith("/actions/artifacts/21/zip"))return new Response(null,{status:302,headers:{location:"https://downloads.example.test/release.zip"}});
		if(url.pathname.includes("/compare/")){const base=url.pathname.split("/compare/")[1].split("...")[0];return Response.json({status:base===binding.main_sha?"identical":"ahead",base_commit:{sha:base},merge_base_commit:{sha:base}});}
		if(url.pathname.endsWith(`/actions/runs/${record.source_run.id}/attempts/1`))return Response.json({...run,id:Number(record.source_run.id),head_sha:record.source_run.sha,path:".github/workflows/ci.yml"});
		throw new Error("Original CI artifacts are expired/unavailable in this simulation");
	};
	const result = await loadApprovedRollback({binding,token:"fake-read-token",outputDirectory:join(files.root,"restored"),fetchImpl});
	assert.equal(result.packageVerification.result,"PASS");
	assert.equal(result.packageVerification.packageArchiveSha256,files.expected.package.digest);
	assert.equal(result.candidate.target.deployment_id,"dpl_prior");
	assert.deepEqual(readFileSync(join(result.packageVerification.staticRoot,"index.html")),readFileSync(join(files.packageRoot,".vercel/output/static/index.html")));
	assert.ok(!reads.some((path)=>path.endsWith("/actions/artifacts/300")||path.endsWith("/actions/artifacts/200")));
	writeFileSync(join(evidence,"retained/composition.zip"),"substituted bytes");
	archive = zipDirectory(evidence,join(files.root,"substituted-release.zip"));
	approved.archive_digest = artifact.digest = sha256Digest(archive);
	await assert.rejects(loadApprovedRollback({binding,token:"fake-read-token",outputDirectory:join(files.root,"rejected"),fetchImpl}),/Retained rollback archive substitution/);
});
