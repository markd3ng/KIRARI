import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { resolveAnalyticsSettings } from "../src/utils/analytics-settings.mjs";

// Use Astro's own Vite version and dotenv semantics, not a second env parser.
const astroRequire = createRequire(import.meta.resolve("astro/package.json"));
const { loadEnv } = await import(astroRequire.resolve("vite"));
export function resolveBuildAnalytics(raw, { mode = "production", envDir = fileURLToPath(new URL("../", import.meta.url)) } = {}) {
	const env = loadEnv(mode, envDir, "PUBLIC_");
	const string = (key, fallback = "") => (process.env[key] ?? env[key])?.trim() || fallback;
	const boolean = (key, fallback) => {
		const value = string(key).toLowerCase();
		if (["true", "1", "yes", "on"].includes(value)) return true;
		if (["false", "0", "no", "off"].includes(value)) return false;
		return fallback;
	};
	return resolveAnalyticsSettings(raw, string, boolean);
}
