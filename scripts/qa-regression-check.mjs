#!/usr/bin/env node

/**
 * Root-level QA regression check wrapper.
 * Delegates to the site package's QA checks in a monorepo context.
 */

import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const siteCheckPath = join(scriptDir, "..", "apps", "site", "scripts", "qa-regression-check.mjs");

const result = spawnSync(process.execPath, [siteCheckPath], {
	stdio: "inherit",
	cwd: join(scriptDir, ".."),
});

process.exit(result.status ?? 1);
