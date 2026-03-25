type EnvRecord = Record<string, string | undefined>;

const processEnv: EnvRecord | undefined =
	typeof process !== "undefined" ? (process.env as EnvRecord) : undefined;

const importMetaEnv: EnvRecord | undefined =
	typeof import.meta !== "undefined"
		? (import.meta.env as unknown as EnvRecord)
		: undefined;

const readEnv = (key: string): string | undefined => {
	const value = processEnv?.[key] ?? importMetaEnv?.[key];
	if (value === undefined) return undefined;
	const normalized = value.trim();
	return normalized === "" ? undefined : normalized;
};

export const getEnvString = (key: string, fallback = ""): string => {
	return readEnv(key) ?? fallback;
};

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
