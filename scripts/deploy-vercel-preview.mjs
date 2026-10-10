#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { deploymentFiles, uniqueUploads, vercelRequest } from "./site-artifact.mjs";

const api = "https://api.vercel.com";
const teamId = process.env.VERCEL_ORG_ID;
const projectId = process.env.VERCEL_PROJECT_ID;
const token = process.env.VERCEL_TOKEN;

async function request(path, options = {}, retryTransient = false) {
	return vercelRequest(path, options, retryTransient, { token: process.env.VERCEL_TOKEN, teamId: process.env.VERCEL_ORG_ID });
}

const pause = (milliseconds) => new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));

async function upload(file, packageRoot) {
	const content = readFileSync(join(packageRoot, file.localPath));
	if (content.length !== file.size || createHash("sha1").update(content).digest("hex") !== file.sha) throw new Error(`Vercel output changed after hashing: ${file.localPath}`);
	for (let attempt = 0; ; attempt += 1) {
		let response;
		try {
			response = await fetch(new URL(`/v2/files?teamId=${encodeURIComponent(teamId)}`, api), {
				method: "POST",
				redirect: "error",
				signal: AbortSignal.timeout(120_000),
				headers: {
					Authorization: `Bearer ${token}`,
					"Content-Type": "application/octet-stream",
					"Content-Length": String(file.size),
					"x-vercel-digest": file.sha,
				},
				body: content,
			});
		} catch (error) {
			if (attempt === 4) throw error;
			await pause(250 * 2 ** attempt);
			continue;
		}
		if (response.ok) return;
		await response.body?.cancel();
		if ((response.status < 500 && response.status !== 429) || attempt === 4) throw new Error(`Vercel file upload returned HTTP ${response.status}`);
		await pause(250 * 2 ** attempt);
	}
}

async function main() {
	const args = process.argv.slice(2);
	if (args.length !== 2 || args[0] !== "--site-package") throw new Error("Usage: deploy-vercel-preview.mjs --site-package <package-root>");
	if (!token || !teamId || !projectId) throw new Error("VERCEL_TOKEN, VERCEL_ORG_ID, and VERCEL_PROJECT_ID are required");
	const packageRoot = resolve(args[1]);
	const manifest = JSON.parse(readFileSync(join(packageRoot, "site-package-manifest.json"), "utf8"));
	if (manifest.target?.platform !== "vercel" || manifest.target?.project !== "kirari-test" || manifest.target?.environment !== "preview" || manifest.target?.deploy_mode !== "prebuilt" || manifest.functions_classification !== "STATIC_ONLY_NO_FUNCTIONS_REQUIRED") throw new Error("Site package is not approved for a kirari-test Preview deployment");
	const files = deploymentFiles(packageRoot);
	const uploads = uniqueUploads(files, packageRoot);
	for (let offset = 0; offset < uploads.length; offset += 8) {
		await Promise.all(uploads.slice(offset, offset + 8).map((file) => upload(file, packageRoot)));
	}

	const created = await (await request("/v13/deployments", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ name: "kirari-test", project: projectId, version: 2, source: "cli", files }),
	})).json();
	if (!/^dpl_[A-Za-z0-9]+$/.test(created.id ?? "") || typeof created.url !== "string") throw new Error("Vercel did not return a Preview deployment identity");

	const deadline = Date.now() + 20 * 60_000;
	let deployment = created;
	while (deployment.readyState !== "READY") {
		if (["ERROR", "CANCELED"].includes(deployment.readyState)) throw new Error(`Vercel Preview deployment ended in ${deployment.readyState}`);
		if (Date.now() >= deadline) throw new Error(`Vercel deployment ${deployment.id} did not become ready within 20 minutes`);
		await pause(5000);
		deployment = await (await request(`/v13/deployments/${encodeURIComponent(created.id)}`, {}, true)).json();
	}
	if (deployment.projectId !== projectId || deployment.target !== null) throw new Error("Vercel returned a non-Preview or unexpected-project deployment");
	const url = new URL(`https://${deployment.url}`);
	if (url.protocol !== "https:" || url.username || url.password || url.port || url.pathname !== "/" || url.search || url.hash || !url.hostname.startsWith("kirari-test-") || !url.hostname.endsWith(".vercel.app")) throw new Error(`Unexpected Preview deployment URL: ${deployment.url}`);
	process.stdout.write(`${url.href}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
	try {
		await main();
	} catch (error) {
		console.error(`[vercel-preview] ERROR ${error.message}`);
		process.exitCode = 1;
	}
}

export { deploymentFiles, request, uniqueUploads };
