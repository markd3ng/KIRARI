#!/usr/bin/env node

import { createHash } from "node:crypto";
import { lstatSync, readFileSync, readdirSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";

const api = "https://api.vercel.com";
const teamId = process.env.VERCEL_ORG_ID;
const projectId = process.env.VERCEL_PROJECT_ID;
const token = process.env.VERCEL_TOKEN;

function deploymentFiles(packageRoot) {
	const outputRoot = join(packageRoot, ".vercel/output");
	const config = JSON.parse(readFileSync(join(outputRoot, "config.json"), "utf8"));
	if (config.version !== 3 || !Array.isArray(config.routes)) throw new Error("Expected a Build Output API v3 config.json");

	const files = [];
	function walk(directory) {
		for (const entry of readdirSync(directory, { withFileTypes: true })) {
			const absolutePath = join(directory, entry.name);
			const info = lstatSync(absolutePath);
			if (info.isSymbolicLink()) throw new Error(`Symlink in Vercel output: ${absolutePath}`);
			if (info.isDirectory()) walk(absolutePath);
			else if (info.isFile()) {
				const buffer = readFileSync(absolutePath);
				const name = relative(packageRoot, absolutePath).split(sep).join("/");
				if (name.startsWith("../") || name.includes("\\") || name.startsWith("/")) throw new Error(`Invalid Vercel output path: ${name}`);
				files.push({ file: name, sha: createHash("sha1").update(buffer).digest("hex"), size: buffer.length });
			}
		}
	}
	walk(outputRoot);
	files.sort((left, right) => left.file.localeCompare(right.file));
	if (!files.some((file) => file.file === ".vercel/output/static/index.html")) throw new Error("Vercel output is missing static/index.html");
	return files;
}

function teamUrl(path) {
	const url = new URL(path, api);
	url.searchParams.set("teamId", teamId);
	return url;
}

async function request(path, options = {}) {
	const response = await fetch(teamUrl(path), {
		...options,
		redirect: "error",
		signal: AbortSignal.timeout(120_000),
		headers: { Authorization: `Bearer ${token}`, ...options.headers },
	});
	if (!response.ok) throw new Error(`Vercel API ${options.method ?? "GET"} ${path} returned ${response.status}: ${(await response.text()).slice(0, 2000)}`);
	return response;
}

const pause = (milliseconds) => new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));

async function upload(file, packageRoot) {
	const content = readFileSync(join(packageRoot, file.localPath));
	if (content.length !== file.size || createHash("sha1").update(content).digest("hex") !== file.sha) throw new Error(`Vercel output changed after hashing: ${file.localPath}`);
	for (let attempt = 0; ; attempt += 1) {
		let response;
		try {
			response = await fetch(teamUrl("/v2/files"), {
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
		const message = (await response.text()).slice(0, 2000);
		if ((response.status < 500 && response.status !== 429) || attempt === 4) throw new Error(`Vercel file upload returned ${response.status}: ${message}`);
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
	const uploadsByDigest = new Map();
	for (const file of files) {
		const localPath = file.file;
		const previous = uploadsByDigest.get(file.sha);
		if (previous && previous.size !== file.size) throw new Error(`SHA-1 collision in Vercel output: ${file.sha}`);
		if (!previous) uploadsByDigest.set(file.sha, { ...file, localPath });
	}

	const uploads = [...uploadsByDigest.values()];
	for (let offset = 0; offset < uploads.length; offset += 8) {
		await Promise.all(uploads.slice(offset, offset + 8).map((file) => upload(file, packageRoot)));
	}

	const created = await (await request("/v13/deployments", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ name: "kirari-test", project: projectId, version: 2, source: "cli", files }),
	})).json();
	if (!/^dpl_[A-Za-z0-9]+$/.test(created.id ?? "") || !created.url) throw new Error(`Vercel did not return a deployment ID and URL: ${JSON.stringify(created)}`);

	const deadline = Date.now() + 20 * 60_000;
	let deployment = created;
	while (deployment.readyState !== "READY") {
		if (["ERROR", "CANCELED"].includes(deployment.readyState)) throw new Error(`Vercel deployment ${deployment.id} ended in ${deployment.readyState}: ${deployment.errorMessage ?? deployment.errorCode ?? "unknown error"}`);
		if (Date.now() >= deadline) throw new Error(`Vercel deployment ${deployment.id} did not become ready within 20 minutes`);
		await pause(5000);
		deployment = await (await request(`/v13/deployments/${encodeURIComponent(created.id)}`)).json();
	}
	if (deployment.projectId !== projectId || deployment.target !== null) throw new Error(`Vercel returned a non-Preview or unexpected-project deployment: ${JSON.stringify({ id: deployment.id, projectId: deployment.projectId, target: deployment.target })}`);
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

export { deploymentFiles };
