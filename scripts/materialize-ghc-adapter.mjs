import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parse } from "smol-toml";

const rootDir = process.cwd();
const generatedMarker = "@kirari-generated-ghc-adapter";
const configPath = path.join(rootDir, "kirari.config.toml");
const statCache = new Map();

const config = parse(readFileSync(configPath, "utf8"));
const adapter = config.githubCard?.adapter ?? {};
const enabled = adapter.enabled === true;
const provider = resolveProvider(String(adapter.provider || "none"));
const route = normalizeRoute(String(adapter.route || "/ghc"));
const routeSegment = route.slice(1);
const serviceBinding = normalizeIdentifier(String(adapter.serviceBinding || "GHCARD_CACHE"));

removeGeneratedRoutes(path.join(rootDir, "functions"));
removeGeneratedRoutes(path.join(rootDir, "api"));

if (!enabled) {
	process.exit(0);
}

if (provider === "cloudflare") {
	writeGeneratedFile(
		path.join(rootDir, "adapters/github-card/cloudflare/route.ts.template"),
		path.join(rootDir, "functions", routeSegment, "[[path]].ts"),
	);
} else if (provider === "vercel") {
	writeGeneratedFile(
		path.join(rootDir, "adapters/github-card/vercel/route.ts.template"),
		path.join(rootDir, "api", routeSegment, "[...path].ts"),
	);
} else {
	throw new Error('githubCard.adapter.enabled=true requires provider="cloudflare", provider="vercel", or provider="auto" in a hosted platform build.');
}

function resolveProvider(value) {
	if (value === "auto") {
		if (process.env.VERCEL === "1") return "vercel";
		if (process.env.CF_PAGES === "1" || process.env.PAGES === "1") return "cloudflare";
		return "unknown";
	}

	if (["none", "cloudflare", "vercel"].includes(value)) return value;
	throw new Error('githubCard.adapter.provider must be "none", "cloudflare", "vercel", or "auto".');
}

function normalizeRoute(value) {
	if (!/^\/[A-Za-z0-9_-]+$/.test(value)) {
		throw new Error('githubCard.adapter.route must be a single-segment route such as "/ghc".');
	}
	return value.replace(/\/+$/, "");
}

function normalizeIdentifier(value) {
	if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) {
		throw new Error("githubCard.adapter.serviceBinding must be a valid JavaScript identifier.");
	}
	return value;
}

function writeGeneratedFile(templatePath, targetPath) {
	const source = readFileSync(templatePath, "utf8")
		.replaceAll("__GHC_ROUTE__", route)
		.replaceAll("__GHC_SERVICE_BINDING__", serviceBinding);
	mkdirSync(path.dirname(targetPath), { recursive: true });
	writeFileSync(targetPath, source);
}

function removeGeneratedRoute(routeDir) {
	if (!existsSync(routeDir)) return;

	const files = collectFiles(routeDir);
	if (files.length === 0) {
		rmSync(routeDir, { recursive: true, force: true });
		return;
	}

	const generated = files.some((file) => readFileSync(file, "utf8").includes(generatedMarker));
	if (!generated) {
		throw new Error(`Refusing to remove non-generated route directory: ${path.relative(rootDir, routeDir)}`);
	}

	rmSync(routeDir, { recursive: true, force: true });
}

function removeGeneratedRoutes(baseDir) {
	if (!existsSync(baseDir)) return;
	for (const name of readdir(baseDir)) {
		const routeDir = path.join(baseDir, name);
		if (lstat(routeDir).isDirectory()) {
			removeGeneratedRoute(routeDir);
		}
	}
}

function collectFiles(dir) {
	const entries = [];
	for (const name of readdir(dir)) {
		const fullPath = path.join(dir, name);
		const stat = lstat(fullPath);
		if (stat.isDirectory()) {
			entries.push(...collectFiles(fullPath));
		} else {
			entries.push(fullPath);
		}
	}
	return entries;
}

function readdir(dir) {
	return existsSync(dir) ? Array.from(readdirSync(dir)) : [];
}

function lstat(file) {
	return statCache.get(file) || statCache.set(file, statSync(file)).get(file);
}
