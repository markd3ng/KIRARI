import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const source = readFileSync(new URL("../../src/components/landing/LandingPage.astro", import.meta.url), "utf8");

test("landing entrance animation fades without translating content", () => {
	const animation = source.match(/\.landing-fade-in\s*\{([^}]+)\}/)?.[1] ?? "";
	const keyframes = source.match(/@keyframes landing-fade-in\s*\{([^}]+)\}/)?.[1] ?? "";
	const reducedMotion = source.match(/@media \(prefers-reduced-motion: reduce\)\s*\{[\s\S]*?\.landing-fade-in\s*\{([^}]+)\}/)?.[1] ?? "";

	assert.match(animation, /opacity:\s*0/);
	assert.match(animation, /animation:\s*landing-fade-in 680ms/);
	assert.doesNotMatch(animation, /transform\s*:/);
	assert.match(keyframes, /opacity:\s*1/);
	assert.doesNotMatch(keyframes, /transform\s*:/);
	assert.match(reducedMotion, /animation:\s*none/);
	assert.match(reducedMotion, /opacity:\s*1/);
	assert.doesNotMatch(source, /landing-fade-up|translateY\(18px\)/);
});
