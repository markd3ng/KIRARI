import assert from "node:assert/strict";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { createVercelConfig } from "../security-policy.mjs";

const repoRoot = resolve(new URL("../../../../", import.meta.url).pathname);
const materializerPath = join(repoRoot, "apps/site/scripts/materialize-ghc-adapter.mjs");

test("generated Vercel config rewrites only the canonical Gateway prefix to its function route", () => {
	const config = createVercelConfig({});
	assert.deepEqual(config.rewrites[0], {
		source: "/_kirari/edge/:path*",
		destination: "/api/_kirari/edge/:path*",
	});
	assert.deepEqual(config.rewrites.slice(1), [
		{ source: "/search", destination: "/search/" },
		{ source: "/:lang/search", destination: "/:lang/search/" },
	]);

	const checkedInConfig = JSON.parse(readFileSync(new URL("../../../../vercel.json", import.meta.url), "utf8"));
	assert.deepEqual(checkedInConfig.rewrites, config.rewrites);
});

test("the Vercel function entrypoint delegates to the dedicated adapter package", () => {
	const entry = readFileSync(new URL("../../../../api/_kirari/edge/[...path].ts", import.meta.url), "utf8");
	assert.match(entry, /from ["']@kirari\/edge-gateway-vercel["']/);
	assert.match(entry, /createVercelGatewayHandler\(\)/);
});

test("GHCard cleanup preserves unrelated Gateway API routes and removes only its generated route", () => {
	const fixture = mkdtempSync(join(tmpdir(), "kirari-vercel-route-"));
	try {
		const siteRoot = join(fixture, "apps/site");
		const generatedSiteRoute = join(siteRoot, "api/ghc/route.ts");
		const generatedRootRoute = join(fixture, "api/ghc/route.ts");
		const gatewaySiteRoute = join(siteRoot, "api/_kirari/edge/[...path].ts");
		const gatewayRootRoute = join(fixture, "api/_kirari/edge/[...path].ts");
		mkdirSync(join(siteRoot, "api/ghc"), { recursive: true });
		mkdirSync(join(fixture, "api/ghc"), { recursive: true });
		mkdirSync(join(siteRoot, "api/_kirari/edge"), { recursive: true });
		mkdirSync(join(fixture, "api/_kirari/edge"), { recursive: true });
		writeFileSync(join(siteRoot, "kirari.config.toml"), "[githubCard.adapter]\nenabled = false\n");
		writeFileSync(generatedSiteRoute, "// @kirari-generated-ghc-adapter\n");
		writeFileSync(generatedRootRoute, "// @kirari-generated-ghc-adapter\n");
		writeFileSync(gatewaySiteRoute, "// Gateway function\n");
		writeFileSync(gatewayRootRoute, "// Gateway function\n");

		const result = spawnSync(process.execPath, [materializerPath], { cwd: siteRoot, encoding: "utf8" });
		assert.equal(result.status, 0, result.stderr);
		assert.equal(existsSync(generatedSiteRoute), false);
		assert.equal(existsSync(generatedRootRoute), false);
		assert.equal(readFileSync(gatewaySiteRoute, "utf8"), "// Gateway function\n");
		assert.equal(readFileSync(gatewayRootRoute, "utf8"), "// Gateway function\n");
	} finally {
		rmSync(fixture, { recursive: true, force: true });
	}
});

test("GHCard route generation refuses to overwrite an existing route at its exact target", () => {
	const fixture = mkdtempSync(join(tmpdir(), "kirari-ghcard-route-collision-"));
	try {
		const siteRoot = join(fixture, "apps/site");
		const targetDir = join(siteRoot, "api/ghc");
		mkdirSync(targetDir, { recursive: true });
		mkdirSync(join(siteRoot, "adapters/github-card/vercel"), { recursive: true });
		writeFileSync(join(siteRoot, "kirari.config.toml"), "[githubCard.adapter]\nenabled = true\nprovider = \"vercel\"\nroute = \"/ghc\"\n");
		writeFileSync(join(siteRoot, "adapters/github-card/vercel/route.ts.template"), "// @kirari-generated-ghc-adapter\n");
		const existingRoute = join(targetDir, "owner-route.ts");
		writeFileSync(existingRoute, "// owner route\n");

		const result = spawnSync(process.execPath, [materializerPath], { cwd: siteRoot, encoding: "utf8" });
		assert.notEqual(result.status, 0);
		assert.match(result.stderr, /Refusing to overwrite an existing API route/);
		assert.equal(readFileSync(existingRoute, "utf8"), "// owner route\n");
	} finally {
		rmSync(fixture, { recursive: true, force: true });
	}
});

test("GHCard cleanup preserves owner files beside generated files and never follows directory symlinks", () => {
	const fixture = mkdtempSync(join(tmpdir(), "kirari-mixed-route-"));
	try {
		const siteRoot = join(fixture, "apps/site");
		const routeDir = join(siteRoot, "api/ghc");
		const outsideDir = join(fixture, "owner-data");
		mkdirSync(routeDir, { recursive: true });
		mkdirSync(outsideDir);
		writeFileSync(join(siteRoot, "kirari.config.toml"), "[githubCard.adapter]\nenabled = false\n");
		writeFileSync(join(routeDir, "generated.ts"), "// @kirari-generated-ghc-adapter\n");
		writeFileSync(join(routeDir, "owner-route.ts"), "// owner route\n");
		writeFileSync(join(outsideDir, "generated.ts"), "// @kirari-generated-ghc-adapter\n");
		symlinkSync(outsideDir, join(routeDir, "linked-directory"), "dir");

		const result = spawnSync(process.execPath, [materializerPath], { cwd: siteRoot, encoding: "utf8" });
		assert.equal(result.status, 0, result.stderr);
		assert.equal(existsSync(join(routeDir, "generated.ts")), false);
		assert.equal(readFileSync(join(routeDir, "owner-route.ts"), "utf8"), "// owner route\n");
		assert.equal(readFileSync(join(outsideDir, "generated.ts"), "utf8"), "// @kirari-generated-ghc-adapter\n");
		assert.equal(existsSync(join(routeDir, "linked-directory")), true);
	} finally {
		rmSync(fixture, { recursive: true, force: true });
	}
});

test("enabled GHCard route generation is idempotent across repeated builds", () => {
	const fixture = mkdtempSync(join(tmpdir(), "kirari-repeat-route-"));
	try {
		const siteRoot = join(fixture, "apps/site");
		mkdirSync(join(siteRoot, "adapters/github-card/vercel"), { recursive: true });
		writeFileSync(join(siteRoot, "kirari.config.toml"), "[githubCard.adapter]\nenabled = true\nprovider = \"vercel\"\nroute = \"/ghc\"\n");
		const source = "// @kirari-generated-ghc-adapter\n// __GHC_ROUTE__\n";
		writeFileSync(join(siteRoot, "adapters/github-card/vercel/route.ts.template"), source);
		for (let run = 0; run < 2; run += 1) {
			const result = spawnSync(process.execPath, [materializerPath], { cwd: siteRoot, encoding: "utf8" });
			assert.equal(result.status, 0, result.stderr);
			assert.equal(readFileSync(join(siteRoot, "api/ghc/[...path].ts"), "utf8"), source.replace("__GHC_ROUTE__", "/ghc"));
		}
	} finally {
		rmSync(fixture, { recursive: true, force: true });
	}
});

test("GHCard cleanup rejects symlinked API and Functions roots without deleting outside files", () => {
	for (const location of ["site", "deploy"]) {
		for (const base of ["api", "functions"]) {
			const fixture = mkdtempSync(join(tmpdir(), "kirari-symlink-root-"));
			try {
				const siteRoot = join(fixture, "apps/site");
				const outsideDir = join(fixture, "owner-data");
				mkdirSync(siteRoot, { recursive: true });
				mkdirSync(join(outsideDir, "ghc"), { recursive: true });
				writeFileSync(join(siteRoot, "kirari.config.toml"), "[githubCard.adapter]\nenabled = false\n");
				const ownerFile = join(outsideDir, "ghc/owned.ts");
				writeFileSync(ownerFile, "// @kirari-generated-ghc-adapter\n");
				symlinkSync(outsideDir, join(location === "site" ? siteRoot : fixture, base), "dir");
				const result = spawnSync(process.execPath, [materializerPath], { cwd: siteRoot, encoding: "utf8" });
				assert.notEqual(result.status, 0);
				assert.match(result.stderr, /symlink/i);
				assert.equal(readFileSync(ownerFile, "utf8"), "// @kirari-generated-ghc-adapter\n");
			} finally {
				rmSync(fixture, { recursive: true, force: true });
			}
		}
	}
});

test("GHCard generation rejects a symlinked route target for either provider", () => {
	for (const provider of ["vercel", "cloudflare"]) {
		const fixture = mkdtempSync(join(tmpdir(), "kirari-symlink-target-"));
		try {
			const siteRoot = join(fixture, "apps/site");
			const outsideDir = join(fixture, "owner-data");
			const targetBase = provider === "vercel" ? join(siteRoot, "api") : join(fixture, "functions");
			mkdirSync(targetBase, { recursive: true });
			mkdirSync(outsideDir);
			mkdirSync(join(siteRoot, `adapters/github-card/${provider}`), { recursive: true });
			writeFileSync(join(siteRoot, "kirari.config.toml"), `[githubCard.adapter]\nenabled = true\nprovider = "${provider}"\nroute = "/ghc"\n`);
			writeFileSync(join(siteRoot, `adapters/github-card/${provider}/route.ts.template`), "// @kirari-generated-ghc-adapter\n");
			symlinkSync(outsideDir, join(targetBase, "ghc"), "dir");
			const result = spawnSync(process.execPath, [materializerPath], { cwd: siteRoot, encoding: "utf8" });
			assert.notEqual(result.status, 0);
			assert.match(result.stderr, /symlink/i);
			assert.equal(existsSync(join(outsideDir, provider === "vercel" ? "[...path].ts" : "[[path]].ts")), false);
		} finally {
			rmSync(fixture, { recursive: true, force: true });
		}
	}
});
