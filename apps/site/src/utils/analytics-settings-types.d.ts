declare module "*analytics-settings.mjs" {
 import type { AnalyticsConfig } from "../types/config";
 export const UMAMI_SCRIPT: string;
 export const PLAUSIBLE_SCRIPT: string;
 export function resolveAnalyticsSettings(
 raw?: { [K in keyof AnalyticsConfig]?: AnalyticsConfig[K] extends object | undefined ? { [P in keyof NonNullable<AnalyticsConfig[K]>]?: unknown } : unknown },
 readString?: (key: string, fallback?: string) => string,
 readBoolean?: (key: string, fallback: boolean) => boolean,
 ): AnalyticsConfig;
}
