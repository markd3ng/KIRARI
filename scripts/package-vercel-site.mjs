#!/usr/bin/env node

import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { digestArtifactTree, validateProvenanceManifest } from "./composition-provenance.mjs";
import { browserContract } from "./p3-browser/contract.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function parseArgs(args) {
	const values = new Map();
	for (let i = 0; i < args.length; i += 1) {
		const key = args[i];
		if (!["--input", "--output", "--site-root", "--source-artifact-id", "--source-artifact-digest", "--source-artifact-name", "--source-run-id", "--source-run-attempt"].includes(key) || values.has(key)) throw new Error(`Unknown or repeated option: ${key}`);
		const value = args[++i];
		if (!value || value.startsWith("--")) throw new Error(`Missing value for ${key}`);
		values.set(key, ["--input", "--output", "--site-root"].includes(key) ? resolve(value) : value);
	}
	for (const key of ["--input", "--output", "--site-root"]) if (!values.has(key)) throw new Error(`Required option is missing: ${key}`);
	for (const key of ["--source-artifact-id", "--source-artifact-digest", "--source-artifact-name", "--source-run-id", "--source-run-attempt"]) if (!values.has(key)) throw new Error(`Required option is missing: ${key}`);
	if (!["--source-artifact-id", "--source-run-id", "--source-run-attempt"].every((key) => /^\d+$/.test(values.get(key)))) throw new Error("GitHub artifact, run, and attempt IDs must be numeric");
	if (!/^sha256:[a-f0-9]{64}$/.test(values.get("--source-artifact-digest"))) throw new Error("GitHub source artifact digest must be a SHA-256 digest");
	return {
		input: values.get("--input"), output: values.get("--output"), siteRoot: values.get("--site-root"),
		sourceArtifact: {
			id: values.get("--source-artifact-id"),
			digest: values.get("--source-artifact-digest"),
			name: values.get("--source-artifact-name"),
			run_id: values.get("--source-run-id"),
			run_attempt: values.get("--source-run-attempt"),
		},
	};
}

function walk(directory) {
	if (!existsSync(directory)) return [];
	return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
		const path = join(directory, entry.name);
		if (entry.isSymbolicLink()) throw new Error(`Symbolic links are not supported in the Site artifact: ${path}`);
		return entry.isDirectory() ? walk(path) : [path];
	});
}

function assertStaticOnly(siteRoot) {
	const runtimeRoots = [
		join(siteRoot, "api"),
		join(siteRoot, "functions"),
		join(repoRoot, "apps/site/api"),
		join(repoRoot, "apps/site/functions"),
		join(repoRoot, "apps/site/src/pages/api"),
	];
	const runtimeFiles = runtimeRoots.flatMap((root) => walk(root));
	if (runtimeFiles.length) throw new Error(`Selected mode cannot package Site-owned Functions/API routes: ${runtimeFiles.map((path) => relative(repoRoot, path)).join(", ")}`);
}

function globSource(pattern) {
	if (!pattern.startsWith("/") || pattern.startsWith("//") || /[?#]/.test(pattern)) throw new Error(`Unsupported routing pattern: ${pattern}`);
	// ponytail: supports only the exact * glob emitted by Site postbuild; reject richer Cloudflare patterns until they are required.
	return "^" + pattern.split("*").map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("(.*)") + "$";
}

export function parseHeaders(file) {
	if (!existsSync(file)) return [];
	const groups = [];
	let current;
	for (const [index, raw] of readFileSync(file, "utf8").split(/\r?\n/).entries()) {
		if (!raw.trim() || raw.trimStart().startsWith("#")) continue;
		if (!/^\s/.test(raw)) {
			current = { src: globSource(raw.trim()), headers: {}, continue: true };
			groups.push(current);
			continue;
		}
		const match = /^\s+([^:]+):\s*(.*)$/.exec(raw);
		if (!current || !match || !match[1].trim()) throw new Error(`Invalid _headers line ${index + 1}`);
		current.headers[match[1].trim()] = match[2].trim();
	}
	return groups;
}

function parseRedirects(file) {
	if (!existsSync(file)) return [];
	return readFileSync(file, "utf8").split(/\r?\n/).flatMap((raw, index) => {
		const line = raw.trim();
		if (!line || line.startsWith("#")) return [];
		const fields = line.split(/\s+/);
		if (fields.length !== 3 || !/^\d{3}$/.test(fields[2])) throw new Error(`Unsupported _redirects line ${index + 1}: ${line}`);
		const [source, destination, statusText] = fields;
		if ((source.match(/\*/g) ?? []).length > 1) throw new Error(`Unsupported _redirects wildcard count on line ${index + 1}`);
		let dest = destination;
		if (source.includes("*") && dest.includes(":splat")) dest = dest.replaceAll(":splat", "$1");
		if (dest.includes(":splat")) throw new Error(`Unbound splat in _redirects line ${index + 1}`);
		return [{ src: globSource(source), dest, status: Number(statusText) === 200 ? undefined : Number(statusText) }];
	});
}

function main() {
	const { input, output, siteRoot, sourceArtifact } = parseArgs(process.argv.slice(2));
	const dist = join(input, "dist");
	const provenancePath = join(input, "provenance.json");
	if (!existsSync(dist) || !existsSync(provenancePath)) throw new Error("Input must contain dist/ and provenance.json");
	if (existsSync(output)) throw new Error(`Package output already exists: ${output}`);
	assertStaticOnly(siteRoot);

	const provenance = JSON.parse(readFileSync(provenancePath, "utf8"));
	const sourceDigest = digestArtifactTree(dist);
	validateProvenanceManifest(provenance, { artifactDigest: sourceDigest });
	if (sourceArtifact.name !== provenance.artifact.id || sourceArtifact.name !== `kirari-composition-${sourceArtifact.run_id}-${sourceArtifact.run_attempt}`) {
		throw new Error("GitHub upload artifact identity does not match the P2 provenance artifact ID");
	}
	const outputRoot = join(output, ".vercel/output");
	const staticRoot = join(outputRoot, "static");
	mkdirSync(staticRoot, { recursive: true });
	for (const file of walk(dist)) {
		const name = relative(dist, file).split(sep).join("/");
		if (name === "_headers" || name === "_redirects") continue;
		const destination = join(staticRoot, name);
		mkdirSync(dirname(destination), { recursive: true });
		cpSync(file, destination);
	}
	const routes = [
		...parseRedirects(join(dist, "_redirects")),
		...parseHeaders(join(dist, "_headers")),
	];
	writeFileSync(join(outputRoot, "config.json"), `${JSON.stringify({ version: 3, routes }, null, 2)}\n`, { flag: "wx" });
	const outputDigest = digestArtifactTree(outputRoot);
	const provenanceSha = createHash("sha256").update(readFileSync(provenancePath)).digest("hex");
	const browser = browserContract(dist);
	cpSync(provenancePath, join(output, "provenance.json"));
	writeFileSync(join(output, "site-package-manifest.json"), `${JSON.stringify({
		schema_version: 1,
		package_format: "vercel-build-output-api-v3",
		target: { platform: "vercel", project: "kirari-test", environment: "preview", deploy_mode: "prebuilt" },
		functions_classification: "STATIC_ONLY_NO_FUNCTIONS_REQUIRED",
		source_provenance_sha256: `sha256:${provenanceSha}`,
		source_artifact: provenance.artifact,
		upstream_github_artifact: sourceArtifact,
		core: provenance.core,
		site: provenance.site,
		output_digest: outputDigest,
		browser_contract: browser,
	}, null, 2)}\n`, { flag: "wx" });
	console.log(`[site-package] Wrote immutable Vercel package to ${output} (${outputDigest})`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
	try {
		main();
	} catch (error) {
		console.error(`[site-package] ERROR ${error.message}`);
		process.exitCode = 1;
	}
}
