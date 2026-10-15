import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { parseEnvBoolean, resolveAnalyticsSettings } from "../src/utils/analytics-settings.mjs";

// Use Astro's own Vite version and dotenv semantics, not a second env parser.
const astroRequire = createRequire(import.meta.resolve("astro/package.json"));
const { loadEnv } = await import(astroRequire.resolve("vite"));
// The checked-in Astro build uses Vite's production mode; policy generation
// must read the same dotenv layer as rendered pages.
export const ANALYTICS_BUILD_MODE = "production";

export function resolveBuildAnalytics(raw, { mode = ANALYTICS_BUILD_MODE, envDir = fileURLToPath(new URL("../", import.meta.url)) } = {}) {
	const env = loadEnv(mode, envDir, "PUBLIC_");
	const string = (key, fallback = "") => (process.env[key] ?? env[key])?.trim() || fallback;
	const boolean = (key, fallback) => parseEnvBoolean(string(key), fallback);
	return resolveAnalyticsSettings(raw, string, boolean);
}
