import { createHash } from "node:crypto";
import { readFileSync, realpathSync } from "node:fs";
import { dirname, resolve } from "node:path";

/** Use the npm installed beside the running Node distribution, never PATH lookup. */
export function npmRuntime() {
	const cli = realpathSync(resolve(dirname(process.execPath), "../lib/node_modules/npm/bin/npm-cli.js"));
	return { executable: process.execPath, cli, packageRoot: dirname(dirname(cli)), sha256: `sha256:${createHash("sha256").update(readFileSync(cli)).digest("hex")}` };
}

export function spawnNpm(spawn, args, options) {
	return spawn(process.execPath, [npmRuntime().cli, ...args], options);
}
