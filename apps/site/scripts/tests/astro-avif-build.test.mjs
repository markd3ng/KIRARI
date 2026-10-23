import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { cpSync, existsSync, mkdtempSync, mkdirSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { after, test } from "node:test";

const siteRoot = new URL("../../", import.meta.url).pathname;
const fixturePath = join(siteRoot, "scripts/tests/fixtures/site-avif-cover.avif");
const siteRequire = createRequire(join(siteRoot, "package.json"));
const temporaryRoots = [];

after(() => {
	for (const root of temporaryRoots) rmSync(root, { recursive: true, force: true });
});

function makeTemporaryProject() {
	const root = mkdtempSync(join(tmpdir(), "kirari astro avif "));
	temporaryRoots.push(root);
	mkdirSync(join(root, "src/pages"), { recursive: true });
	mkdirSync(join(root, "src/assets"), { recursive: true });
	symlinkSync(realpathSync(join(siteRoot, "node_modules")), join(root, "node_modules"), "dir");
	cpSync(fixturePath, join(root, "src/assets/site-avif-cover.avif"));
	writeFileSync(join(root, "astro.config.mjs"), 'import { defineConfig } from "astro/config";\nexport default defineConfig({ output: "static" });\n');
	writeFileSync(join(root, "src/pages/index.astro"), `---
import { Image } from "astro:assets";
import cover from "../assets/site-avif-cover.avif";
---
<html lang="en"><body><Image src={cover} alt="AVIF decoder fixture" format="webp" /></body></html>
`);
	return root;
}

function versionAtLeast(actual, minimum) {
	const actualParts = actual.split(".").map(Number);
	const minimumParts = minimum.split(".").map(Number);
	for (let index = 0; index < Math.max(actualParts.length, minimumParts.length); index += 1) {
		const difference = (actualParts[index] ?? 0) - (minimumParts[index] ?? 0);
		if (difference !== 0) return difference > 0;
	}
	return true;
}

test("Astro's resolved Sharp/libheif stack builds an AVIF source into WebP", () => {
	const astroSharpRequire = createRequire(realpathSync(join(siteRoot, "node_modules/astro/package.json")));
	const sharpPaths = [siteRequire.resolve("sharp"), astroSharpRequire.resolve("sharp")];
	for (const sharpPath of sharpPaths) {
		const sharp = siteRequire(sharpPath);
		assert.ok(versionAtLeast(sharp.versions.sharp, "0.35.4"), `Sharp ${sharp.versions.sharp} is below the fixed minimum`);
		assert.ok(versionAtLeast(sharp.versions.heif, "1.23.5"), `libheif ${sharp.versions.heif} is below the fixed minimum`);
	}

	const projectRoot = makeTemporaryProject();
	const build = spawnSync(join(siteRoot, "node_modules/.bin/astro"), ["build", "--root", projectRoot], {
		cwd: siteRoot,
		encoding: "utf8",
		maxBuffer: 10 * 1024 * 1024,
	});
	assert.equal(build.error, undefined, build.error?.message);
	assert.equal(build.status, 0, `${build.stdout}\n${build.stderr}`);

	const distRoot = join(projectRoot, "dist");
	const html = readFileSync(join(distRoot, "index.html"), "utf8");
	const webpUrl = html.match(/src="([^"]+\.webp)"/)?.[1];
	assert.ok(webpUrl, `Expected Astro to emit a WebP image from the AVIF fixture. HTML: ${html}`);
	const webpPath = join(distRoot, webpUrl.replace(/^\//, ""));
	assert.ok(existsSync(webpPath), `Astro HTML references missing output ${relative(distRoot, webpPath)}`);
	const webp = readFileSync(webpPath);
	assert.equal(webp.toString("ascii", 0, 4), "RIFF");
	assert.equal(webp.toString("ascii", 8, 12), "WEBP");
	assert.notDeepEqual(webp, readFileSync(fixturePath), "Astro must decode and transform the AVIF source");
});
