/**
 * Environment variable type definition
 * 环境变量类型定义
 */
type EnvRecord = Record<string, string | undefined>;

/**
 * Node.js process environment
 * Node.js 进程环境变量
 */
const processEnv: EnvRecord | undefined =
	typeof process !== "undefined" ? (process.env as EnvRecord) : undefined;

/**
 * Vite/Astro import.meta environment
 * Vite/Astro import.meta 环境变量
 */
const importMetaEnv: EnvRecord | undefined =
	typeof import.meta !== "undefined"
		? (import.meta.env as unknown as EnvRecord)
		: undefined;

/**
 * Read environment variable from both process.env and import.meta.env
 * 从 process.env 和 import.meta.env 读取环境变量
 * 
 * Priority: process.env > import.meta.env
 * 优先级：process.env > import.meta.env
 * 
 * @param key - Environment variable key
 * @returns Environment variable value or undefined if not set or empty
 */
const readEnv = (key: string): string | undefined => {
	const value = processEnv?.[key] ?? importMetaEnv?.[key];
	if (value === undefined) return undefined;
	const normalized = value.trim();
	return normalized === "" ? undefined : normalized;
};

/**
 * Get string value from environment variable
 * 从环境变量获取字符串值
 * 
 * @param key - Environment variable key (e.g., "PUBLIC_SITE_URL")
 * @param fallback - Fallback value if not set (default: "")
 * @returns Environment variable value or fallback
 * 
 * @example
 * ```ts
 * const siteUrl = getEnvString("PUBLIC_SITE_URL", "https://example.com");
 * ```
 */
export const getEnvString = (key: string, fallback = ""): string => {
	return readEnv(key) ?? fallback;
};

/**
 * Get string value from multiple possible environment variable keys
 * 从多个可能的环境变量键获取字符串值
 * 
 * Returns the first non-empty value from the provided keys.
 * 返回提供的键中第一个非空值。
 * 
 * @param keys - Array of environment variable keys to try (in order)
 * @param fallback - Fallback value if none are set (default: "")
 * @returns First found environment variable value or fallback
 * 
 * @example
 * ```ts
 * // Try both old and new key names for backward compatibility
 * const clarityId = getEnvStringFromKeys(
 *   ["PUBLIC_CLARITY_PROJECT_ID", "PUBLIC_CLARITY_ID"],
 *   ""
 * );
 * ```
 */
export const getEnvStringFromKeys = (
	keys: string[],
	fallback = "",
): string => {
	for (const key of keys) {
		const value = readEnv(key);
		if (value !== undefined) return value;
	}
	return fallback;
};

/**
 * Get boolean value from environment variable
 * 从环境变量获取布尔值
 * 
 * Supports multiple string representations:
 * 支持多种字符串表示：
 * - True: "true", "1", "yes", "on"
 * - False: "false", "0", "no", "off"
 * 
 * @param key - Environment variable key
 * @param fallback - Fallback value if not set or invalid (default: false)
 * @returns Boolean value or fallback
 * 
 * @example
 * ```ts
 * const analyticsEnabled = getEnvBoolean("PUBLIC_ANALYTICS_ENABLE", false);
 * ```
 */
export const getEnvBoolean = (key: string, fallback = false): boolean => {
	const value = readEnv(key);
	if (value === undefined) return fallback;

	switch (value.toLowerCase()) {
		case "true":
		case "1":
		case "yes":
		case "on":
			return true;
		case "false":
		case "0":
		case "no":
		case "off":
			return false;
		default:
			return fallback;
	}
};
