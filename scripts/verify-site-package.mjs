#!/usr/bin/env node

import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { verifySitePackage } from "./site-artifact.mjs";

function main() {
	const [rootArg, targetName = "kirari-test", sourceRunSha] = process.argv.slice(2);
	if (!rootArg) throw new Error("Usage: node scripts/verify-site-package.mjs <package-root> [target-name] [source-run-sha]");
	const verified = verifySitePackage({ packageRoot: resolve(rootArg), targetName, sourceRunSha });
	console.log(JSON.stringify({
		result: "PASS",
		project: targetName,
		target: verified.manifest.target.environment,
		coreSha: verified.provenance.core.resolved_sha,
		siteRepository: verified.provenance.site.repository,
		siteSha: verified.provenance.site.resolved_sha,
		sourceArtifact: verified.provenance.artifact.id,
		sourceArtifactDigest: verified.provenance.artifact.digest,
		outputDigest: verified.outputDigest,
		functionsClassification: verified.manifest.functions_classification,
	}, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
	try {
		main();
	} catch (error) {
		const message = String(error?.message ?? "verification failed").replace(/[\r\n\x00-\x1f]/g, " ").slice(0, 500);
		console.error(`[site-package-verify] ERROR ${message}`);
		process.exitCode = 1;
	}
}
