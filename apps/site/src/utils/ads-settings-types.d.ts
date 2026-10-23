declare module "*ads-settings.mjs" {
	type AdsConfig = import("../types/config.js").AdsConfig;
	export function resolveAdsSettings(
		raw?: { enable?: unknown; publisherId?: unknown; slots?: { articleBottom?: unknown } },
		readString?: (key: string, fallback?: string) => string,
		readBoolean?: (key: string, fallback: boolean) => boolean,
	): AdsConfig;
}
