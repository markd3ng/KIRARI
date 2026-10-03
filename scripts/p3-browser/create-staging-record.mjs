#!/usr/bin/env node

import { readFileSync, writeFileSync } from "node:fs";

const required = ["SITE_PACKAGE_MANIFEST", "DEPLOYMENT_JSON", "BROWSER_REPORT", "STAGING_RECORD", "SOURCE_RUN_ID", "SOURCE_RUN_SHA", "PACKAGE_ARTIFACT_ID", "PACKAGE_ARCHIVE_DIGEST", "VERCEL_PROJECT_ID"];
for (const name of required) if (!process.env[name]) throw new Error(`Missing ${name}`);

if (!/^\d+$/.test(process.env.SOURCE_RUN_ID) || !/^[a-f0-9]{40}$/.test(process.env.SOURCE_RUN_SHA)) throw new Error("Source CI run identity is invalid");
if (!/^\d+$/.test(process.env.PACKAGE_ARTIFACT_ID) || !/^sha256:[a-f0-9]{64}$/.test(process.env.PACKAGE_ARCHIVE_DIGEST)) throw new Error("Site package artifact identity is invalid");

const manifest = JSON.parse(readFileSync(process.env.SITE_PACKAGE_MANIFEST, "utf8"));
const deployment = JSON.parse(readFileSync(process.env.DEPLOYMENT_JSON, "utf8"));
const browser = JSON.parse(readFileSync(process.env.BROWSER_REPORT, "utf8"));
if (manifest.target?.project !== "kirari-test" || manifest.target?.environment !== "preview") throw new Error("Site package target is not kirari-test Preview");
if (manifest.core?.resolved_sha !== process.env.SOURCE_RUN_SHA) throw new Error("Site package Core SHA does not match the source CI run SHA");
if (!/^dpl_[A-Za-z0-9]+$/.test(deployment.id ?? "") || deployment.projectId !== process.env.VERCEL_PROJECT_ID || deployment.target !== null || deployment.readyState !== "READY") throw new Error("Deployment identity is not a ready Preview in the configured Vercel project");
if (typeof deployment.url !== "string" || !deployment.url || /[/?#@]/.test(deployment.url)) throw new Error("Deployment URL is invalid");
const deploymentUrl = new URL(`https://${deployment.url}`);
if (deploymentUrl.protocol !== "https:" || deploymentUrl.hostname !== deployment.url || !deploymentUrl.hostname.startsWith("kirari-test-") || !deploymentUrl.hostname.endsWith(".vercel.app")) throw new Error("Deployment URL is not a kirari-test Preview host");
if (browser.result !== "PASS") throw new Error("Browser evidence must pass before writing the final staging record");

const record = {
	schema_version: 1,
	result: "PASS",
	target: {
		platform: "vercel",
		project: manifest.target.project,
		project_id: process.env.VERCEL_PROJECT_ID,
		environment: "preview",
		url: deploymentUrl.origin,
		deployment_id: deployment.id,
		deployment_target: deployment.target,
	},
	source_run: { id: process.env.SOURCE_RUN_ID, sha: process.env.SOURCE_RUN_SHA },
	package_artifact: { id: process.env.PACKAGE_ARTIFACT_ID, archive_digest: process.env.PACKAGE_ARCHIVE_DIGEST },
	upstream_artifact: manifest.upstream_github_artifact,
	core: manifest.core,
	site: manifest.site,
	source_artifact: manifest.source_artifact,
	package_format: manifest.package_format,
	output_digest: manifest.output_digest,
	functions_classification: manifest.functions_classification,
	browser,
	production_action: false,
	dns_action: false,
	indexing_action: false,
	release_action: false,
	source_writeback: false,
};

writeFileSync(process.env.STAGING_RECORD, `${JSON.stringify(record, null, 2)}\n`, { flag: "wx" });
console.log(JSON.stringify({ result: record.result, target: record.target, sourceRun: record.source_run, packageArtifact: record.package_artifact }, null, 2));
