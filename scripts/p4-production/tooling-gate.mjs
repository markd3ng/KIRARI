#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { arch, platform, release } from "node:os";
import { join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createAdvisoryInventory, evaluateToolingAcceptance, fingerprintInstalledTree, toolingManifestDigest, TOOLING_MATERIAL_SOURCE_PATHS, TOOLING_TREE_FINGERPRINT_ALGORITHM } from "./tooling-acceptance.mjs";
import { credentialManifestDigest, validateCredentialContract } from "./credential-contract.mjs";
import { readConcreteOwnerDecision } from "./owner-decision.mjs";

import { npmRuntime, spawnNpm } from "./npm-runtime.mjs";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const TOOLING = "scripts/p4-production/tooling";
const EVIDENCE = ".trellis/tasks/10-04-p4-authorized-production/evidence/t1-c1";
const PLAIN_ARGS = ["audit", "--prefix", TOOLING, "--audit-level", "moderate"];
const JSON_ARGS = [...PLAIN_ARGS, "--json"];
const TARGET = { team_id: "team_NsBZHGUVnyygP7veiROKLuUx", project_id: "prj_QNMVdxTkPOad4ynN4fwFCYEST8Jk", project: "kirari-main" };
const sha256 = (bytes) => `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
function json(path) { return JSON.parse(readFileSync(path, "utf8")); }
function optionalJson(path) { return existsSync(path) ? json(path) : null; }
function distro() {
	if (platform() !== "linux") return `${platform() === "darwin" ? "Darwin" : platform()} ${release()}`;
	return /^PRETTY_NAME="([^"]+)"/m.exec(readFileSync("/etc/os-release", "utf8"))?.[1] ?? "UNKNOWN";
}
function npmEnvironment(env) {
	return Object.fromEntries(["PATH", "LANG", "LC_ALL", "CI", "NO_COLOR", "FORCE_COLOR", "HOME", "TMPDIR"].flatMap(key => typeof env[key] === "string" ? [[key, env[key]]] : []));
}

/** Both complete audits run, even if the first one fails or Owner approval is absent. */
export function collectFullToolingAudit({ env = process.env, spawn = spawnSync, outputDirectory }) {
	mkdirSync(outputDirectory, { recursive: true });
	const options = { cwd: ROOT, env: npmEnvironment(env), encoding: "utf8", timeout: 120_000, maxBuffer: 16 * 1024 * 1024 };
	const plain = spawnNpm(spawn, PLAIN_ARGS, options);
	const full = spawnNpm(spawn, JSON_ARGS, options);
	writeFileSync(join(outputDirectory, "npm-audit.txt"), `${plain.stdout ?? ""}${plain.stderr ?? ""}`);
	writeFileSync(join(outputDirectory, "npm-audit.json"), full.stdout ?? "");
	writeFileSync(join(outputDirectory, "npm-audit-json-stderr.txt"), full.stderr ?? "");
	const result = { plain_command: `npm ${PLAIN_ARGS.join(" ")}`, json_command: `npm ${JSON_ARGS.join(" ")}`, plain_executed: !plain.error && !plain.signal, json_executed: !full.error && !full.signal, plain_exit_code: plain.status, json_exit_code: full.status };
	writeFileSync(join(outputDirectory, "audit-execution.json"), `${JSON.stringify(result, null, 2)}\n`);
	return { execution: result, auditJson: full.stdout ?? "", auditExitCode: plain.status };
}

async function tarballIdentity(lock) {
	const pkg = lock.packages?.["node_modules/vercel"];
	const url = `https://registry.npmjs.org/vercel/-/vercel-${pkg?.version}.tgz`;
	if (pkg?.resolved !== url || !/^sha512-[A-Za-z0-9+/=]+$/.test(pkg?.integrity ?? "")) throw new Error("TOOLING_REGISTRY_INTEGRITY_UNAVAILABLE");
	const response = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(60_000) });
	if (!response.ok) throw new Error("TOOLING_TARBALL_READBACK_FAILED");
	const bytes = Buffer.from(await response.arrayBuffer());
	if (bytes.length > 100 * 1024 * 1024 || `sha512-${createHash("sha512").update(bytes).digest("base64")}` !== pkg.integrity) throw new Error("TOOLING_TARBALL_INTEGRITY_MISMATCH");
	return { integrity: pkg.integrity, sha256: sha256(bytes) };
}

/** Runtime/runner/tree are measured; expected values are never copied from a manifest. */
export async function collectToolingObservation({ env = process.env, audit, outputDirectory, verifiedTarball = null }) {
	const lockBytes = readFileSync(join(ROOT, TOOLING, "package-lock.json"));
	const lock = JSON.parse(lockBytes);
	const pkg = json(join(ROOT, TOOLING, "node_modules/vercel/package.json"));
	if (pkg.name !== "vercel" || pkg.version !== lock.packages?.["node_modules/vercel"]?.version || pkg.version !== lock.packages?.[""]?.dependencies?.vercel) throw new Error("TOOLING_INSTALLED_LOCK_IDENTITY_MISMATCH");
	const artifact = verifiedTarball ?? await tarballIdentity(lock);
	const npm = spawnNpm(spawnSync, ["--version"], { env: npmEnvironment(env), encoding: "utf8", timeout: 15_000 });
	if (npm.status !== 0) throw new Error("TOOLING_NPM_IDENTITY_UNAVAILABLE");
	const receipt = json(join(outputDirectory, "install-receipt.json"));
	const captured = Date.parse(receipt.captured_at);
	if (receipt.completed !== true || receipt.exit_code !== 0 || receipt.node_version !== process.version || receipt.npm_cli_sha256 !== npmRuntime().sha256 || receipt.npm_tree_sha256 !== fingerprintInstalledTree(npmRuntime().packageRoot) || receipt.npm_version !== String(npm.stdout).trim() || !Number.isFinite(captured) || captured > Date.now() || Date.now() - captured > 60 * 60_000) throw new Error("TOOLING_INSTALL_RECEIPT_INVALID_OR_STALE");
	const entrypoint = `${TOOLING}/node_modules/.bin/vercel`;
	const source = readFileSync(join(ROOT, "scripts/deploy-vercel-production.mjs"), "utf8");
	const controls = source.includes('runtimeEnv.VERCEL_CLI_USE_NATIVE_BINARY = "0";') && source.includes('runtimeEnv.NO_UPDATE_NOTIFIER = "1";') && source.includes("runtimeEnv.HOME = isolatedHome;");
	return {
		candidate: { cli_package: pkg.name, cli_version: pkg.version, package_lock_sha256: sha256(lockBytes), tarball_integrity: artifact.integrity, tarball_sha256: artifact.sha256 },
		runtime: { node_version: process.version, npm_cli_sha256: npmRuntime().sha256, npm_tree_sha256: fingerprintInstalledTree(npmRuntime().packageRoot), npm_version: String(npm.stdout).trim(), runner: { os: platform() === "linux" ? "Linux" : platform() === "darwin" ? "Darwin" : platform(), arch: arch(), image: env.ImageOS === "ubuntu24" ? "ubuntu-24.04" : env.ImageOS ?? "UNKNOWN", image_version: env.ImageVersion ?? "UNKNOWN", os_release: distro() } },
		install: receipt.install,
		execution: { entrypoint, resolved_entrypoint: relative(ROOT, realpathSync(join(ROOT, entrypoint))), args: ["deploy", "--prebuilt", "--prod", "--skip-domain", "--yes"], metadata_fields: ["githubCommitOrg", "githubCommitRef", "githubCommitRepo", "githubCommitSha", "githubDeployment", "githubOrg", "githubRepo"], temporary_home: controls, auto_update_disabled: controls, native_fallback_disabled: controls, env_flags: { VERCEL_CLI_USE_NATIVE_BINARY: controls ? "0" : "UNKNOWN", NO_UPDATE_NOTIFIER: controls ? "1" : "UNKNOWN" }, material_source_sha256: sha256(source), material_source_hashes: Object.fromEntries(TOOLING_MATERIAL_SOURCE_PATHS.map(path => [path, sha256(readFileSync(join(ROOT, path)))])) },
		target: TARGET,
		installed_tree: { sha256: fingerprintInstalledTree(join(ROOT, TOOLING, "node_modules")), fingerprint_algorithm: TOOLING_TREE_FINGERPRINT_ALGORITHM, platform_scope: `${platform() === "linux" ? "Linux" : platform() === "darwin" ? "Darwin" : platform()}/${arch()}` },
		audit,
	};
}

async function decision(kind, digest, prefix, env, fetchImpl) {
	try { return await readConcreteOwnerDecision({ kind, manifestDigest: digest, reference: json(join(ROOT, EVIDENCE, `${prefix}-owner-decision-reference.json`)), token: env.GH_TOKEN, fetchImpl }); }
	catch { return null; }
}

export async function evaluateCurrentTooling({ outputDirectory, observed, auditJson, auditExitCode, env = process.env, fetchImpl = fetch }) {
	const manifest = optionalJson(join(ROOT, EVIDENCE, "t1-concrete-tooling-manifest.json"));
	const reviewPath = join(ROOT, EVIDENCE, "independent-security-review.json");
	const independentReview = existsSync(reviewPath) ? readFileSync(reviewPath, "utf8") : null;
	const ownerApproval = manifest ? await decision("T1_CONCRETE_TOOLING_MANIFEST", toolingManifestDigest(manifest), "t1", env, fetchImpl) : null;
	const result = evaluateToolingAcceptance({ auditExitCode, auditJson, manifest, ownerApproval, independentReview, observed });
	if (outputDirectory) writeFileSync(join(outputDirectory, "tooling-acceptance.json"), `${JSON.stringify(result, null, 2)}\n`);
	return result;
}

export async function evaluateCurrentCredential({ env = process.env, fetchImpl = fetch, readProviderObservation } = {}) {
	const manifest = optionalJson(join(ROOT, EVIDENCE, "c1-concrete-credential-manifest.json"));
	// A checked-in flag cannot attest current provider roles or token scope. Until
	// an authenticated complete reader is available, admission remains unavailable.
	const observed = typeof readProviderObservation === "function" ? await readProviderObservation() : null;
	const ownerDecision = manifest ? await decision("C1_CONCRETE_CREDENTIAL_MANIFEST", credentialManifestDigest(manifest), "c1", env, fetchImpl) : null;
	return validateCredentialContract({ manifest, observed, ownerDecision });
}

/** Recheck digest, expiry, revocation and installed identity before each write. */
export async function assertConcreteProductionContracts({ env = process.env, fetchImpl = fetch } = {}) {
	if (!env.PRODUCTION_TOOLING_EVIDENCE_DIR) throw new Error("TOOLING_EVIDENCE_MISSING");
	if (!env.VERCEL_CLI_PATH || resolve(env.VERCEL_CLI_PATH) !== join(ROOT, TOOLING, "node_modules/.bin/vercel")) throw new Error("TOOLING_COMMAND_PATH_MISMATCH");
	const outputDirectory = resolve(env.PRODUCTION_TOOLING_EVIDENCE_DIR);
	const prior = json(join(outputDirectory, "observed.json"));
	const audit = json(join(outputDirectory, "audit-execution.json"));
	const observed = await collectToolingObservation({ env, audit, outputDirectory, verifiedTarball: { integrity: prior.candidate.tarball_integrity, sha256: prior.candidate.tarball_sha256 } });
	const result = await evaluateCurrentTooling({ observed, auditJson: readFileSync(join(outputDirectory, "npm-audit.json"), "utf8"), auditExitCode: audit.plain_exit_code, env, fetchImpl });
	if (result.p4AcceptanceResult !== "PASS" || (await evaluateCurrentCredential({ env, fetchImpl })).result !== "PASS") throw new Error("CONCRETE_T1_C1_ADMISSION_FAILED");
}

async function main() {
	const outputDirectory = resolve(process.argv[2] ?? join(process.env.RUNNER_TEMP ?? ROOT, "kirari-tooling-evidence"));
	const audit = collectFullToolingAudit({ outputDirectory });
	let observed = null;
	try { observed = await collectToolingObservation({ audit: audit.execution, outputDirectory }); }
	catch { /* Missing identity evidence stays fail-closed; raw audit remains retained. */ }
	writeFileSync(join(outputDirectory, "observed.json"), `${JSON.stringify(observed, null, 2)}\n`);
	try { writeFileSync(join(outputDirectory, "advisory-inventory.md"), createAdvisoryInventory(audit.auditJson).text); }
	catch { /* Invalid audit JSON cannot produce accepted inventory. */ }
	const result = await evaluateCurrentTooling({ outputDirectory, observed, auditJson: audit.auditJson, auditExitCode: audit.auditExitCode });
	process.stdout.write(`${JSON.stringify({ TOOLING_RAW_AUDIT_RESULT: result.rawAuditResult, TOOLING_P4_ACCEPTANCE_RESULT: result.p4AcceptanceResult, failureCodes: result.failureCodes })}\n`);
	if (result.p4AcceptanceResult !== "PASS") process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
	try { await main(); } catch { process.stderr.write("CONCRETE_MANIFEST_GATE_FAILED\n"); process.exitCode = 1; }
}
