#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { digestArtifactTree, validateProvenanceManifest } from "./composition-provenance.mjs";

function main() {
	const [rootArg, targetName = "kirari-test", sourceRunSha] = process.argv.slice(2);
	if (!rootArg) throw new Error("Usage: node scripts/verify-site-package.mjs <package-root> [target-name] [source-run-sha]");
	if (sourceRunSha !== undefined && !/^[a-f0-9]{40}$/.test(sourceRunSha)) throw new Error("Source CI run SHA must be a full lowercase commit SHA");
	const root = resolve(rootArg);
	const manifest = JSON.parse(readFileSync(join(root, "site-package-manifest.json"), "utf8"));
	const provenanceBytes = readFileSync(join(root, "provenance.json"));
	const provenance = JSON.parse(provenanceBytes);
	validateProvenanceManifest(provenance);
	if (sourceRunSha && provenance.core.resolved_sha !== sourceRunSha) throw new Error("Package Core SHA does not match the verified source CI run SHA");
	if (manifest.schema_version !== 1 || manifest.package_format !== "vercel-build-output-api-v3") throw new Error("Unsupported Site package manifest");
	if (manifest.target?.platform !== "vercel" || manifest.target?.project !== targetName || manifest.target?.environment !== "preview" || manifest.target?.deploy_mode !== "prebuilt") {
		throw new Error(`Package target does not match ${targetName} Preview prebuilt deployment`);
	}
	if (manifest.functions_classification !== "STATIC_ONLY_NO_FUNCTIONS_REQUIRED") throw new Error("Package does not have the accepted static-only Functions classification");
	const upstream = manifest.upstream_github_artifact;
	if (!/^\d+$/.test(upstream?.id ?? "") || !/^\d+$/.test(upstream?.run_id ?? "") || !/^\d+$/.test(upstream?.run_attempt ?? "")) {
		throw new Error("Package is missing the upstream GitHub artifact/run identity");
	}
	if (upstream.name !== `kirari-composition-${upstream.run_id}-${upstream.run_attempt}` || upstream.name !== provenance.artifact.id || !/^sha256:[a-f0-9]{64}$/.test(upstream.digest ?? "")) {
		throw new Error("Package upstream GitHub artifact identity does not match P2 provenance");
	}
	const provenanceDigest = `sha256:${createHash("sha256").update(provenanceBytes).digest("hex")}`;
	if (manifest.source_provenance_sha256 !== provenanceDigest) throw new Error("Site package provenance fingerprint does not match");
	if (JSON.stringify(manifest.source_artifact) !== JSON.stringify(provenance.artifact)) throw new Error("Package source artifact identity does not match provenance");
	if (JSON.stringify(manifest.core) !== JSON.stringify(provenance.core) || JSON.stringify(manifest.site) !== JSON.stringify(provenance.site)) throw new Error("Package Core/Site identity does not match provenance");
	const outputRoot = join(root, ".vercel/output");
	const actualDigest = digestArtifactTree(outputRoot);
	if (manifest.output_digest !== actualDigest) throw new Error(`Vercel output digest mismatch: ${actualDigest}`);
	const outputEntries = readdirSync(outputRoot).sort();
	if (JSON.stringify(outputEntries) !== JSON.stringify(["config.json", "static"])) throw new Error(`Unexpected Vercel output primitives: ${outputEntries.join(", ")}`);
	const config = JSON.parse(readFileSync(join(outputRoot, "config.json"), "utf8"));
	if (config.version !== 3 || !Array.isArray(config.routes)) throw new Error("Invalid Build Output API v3 routing config");
	if (!Array.isArray(manifest.browser_contract?.routes) || manifest.browser_contract.routes.length < 1 || !manifest.browser_contract?.assets?.stylesheets?.length || !manifest.browser_contract?.navigation) {
		throw new Error("Package is missing the required browser route/content/asset/navigation contract");
	}
	console.log(JSON.stringify({
		result: "PASS",
		project: targetName,
		target: "preview",
		coreSha: provenance.core.resolved_sha,
		siteRepository: provenance.site.repository,
		siteSha: provenance.site.resolved_sha,
		sourceArtifact: provenance.artifact.id,
		sourceArtifactDigest: provenance.artifact.digest,
		outputDigest: actualDigest,
		functionsClassification: manifest.functions_classification,
	}, null, 2));
}

try {
	main();
} catch (error) {
	console.error(`[site-package-verify] ERROR ${error.message}`);
	process.exitCode = 1;
}
