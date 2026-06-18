import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse } from "smol-toml";
import { createVercelConfig } from "./security-policy.mjs";

const siteRoot = resolve(new URL("..", import.meta.url).pathname);
const repoRoot = resolve(siteRoot, "../..");
const profileConfigPath = resolve(repoRoot, "packages/site-profile/kirari.config.toml");
const materializedConfigPath = resolve(siteRoot, "kirari.config.toml");
const sourcePath = existsSync(profileConfigPath) ? profileConfigPath : materializedConfigPath;
const targetPath = resolve(repoRoot, "vercel.json");
const config = parse(readFileSync(sourcePath, "utf8"));
const output = `${JSON.stringify(createVercelConfig(config), null, 2)}\n`;

if (process.argv.includes("--check")) {
	if (!existsSync(targetPath) || readFileSync(targetPath, "utf8") !== output) {
		console.error("vercel.json is out of sync. Run: node apps/site/scripts/generate-vercel-config.mjs");
		process.exit(1);
	}
	process.exit(0);
}

writeFileSync(targetPath, output);
