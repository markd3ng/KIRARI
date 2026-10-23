declare module "*privacy-settings.mjs" {
	export const PRIVACY_SETTINGS_KEY: string;
	export const DEFAULT_PRIVACY_SETTINGS: Readonly<{ analytics: boolean; ads: boolean }>;
	export function parsePrivacySettings(value: string | null | undefined): { analytics: boolean; ads: boolean };
	export function readPrivacySettings(storage?: Pick<Storage, "getItem">): { analytics: boolean; ads: boolean };
	export function savePrivacySettings(settings: { analytics: boolean; ads: boolean }, storage?: Pick<Storage, "setItem">): void;
}
