import { spawnSync } from "node:child_process";

const isCI = process.env.CI === "true" || process.env.VERCEL === "1";

if (isCI) {
	process.exit(0);
}

const check = spawnSync("skilld", ["--version"], { stdio: "ignore" });

if (check.status !== 0) {
	process.exit(0);
}

const result = spawnSync("skilld", ["prepare"], { stdio: "inherit" });
process.exit(result.status ?? 0);
