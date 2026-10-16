import assert from "node:assert/strict";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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
