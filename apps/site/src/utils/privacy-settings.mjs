export const PRIVACY_SETTINGS_KEY = "kirari:privacy-settings:v1";
export const DEFAULT_PRIVACY_SETTINGS = Object.freeze({ analytics: true, ads: true });

export function parsePrivacySettings(value) {
	if (value === null || value === undefined || value === "") {
		return { ...DEFAULT_PRIVACY_SETTINGS };
	}
	try {
		const parsed = JSON.parse(value);
		if (parsed?.version !== 1 || typeof parsed.analytics !== "boolean" || typeof parsed.ads !== "boolean") {
			return { analytics: false, ads: false };
		}
		return { analytics: parsed.analytics, ads: parsed.ads };
	} catch {
		return { analytics: false, ads: false };
	}
}

export function readPrivacySettings(storage) {
	try {
		return parsePrivacySettings((storage || globalThis.localStorage).getItem(PRIVACY_SETTINGS_KEY));
	} catch {
		return { analytics: false, ads: false };
	}
}

export function savePrivacySettings(settings, storage) {
	if (typeof settings?.analytics !== "boolean" || typeof settings?.ads !== "boolean") {
		throw new TypeError("Privacy settings must contain boolean analytics and ads choices.");
	}
	(storage || globalThis.localStorage).setItem(PRIVACY_SETTINGS_KEY, JSON.stringify({ version: 1, ...settings }));
}
