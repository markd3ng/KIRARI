import type { CollectionEntry } from "astro:content";
import { Config } from "../constants";
import type { SiteConfig } from "../types/config";

export type LangCode = SiteConfig["lang"];

export const languageLabels: Record<LangCode, string> = {
	"en-US": "English",
	"zh-CN": "简体中文",
	"zh-TW": "繁體中文",
	"zh-HK": "繁體中文（香港）",
	"ja-JP": "日本語",
	"ko-KR": "한국어",
	"es-ES": "Español",
	"th-TH": "ไทย",
	"vi-VN": "Tiếng Việt",
	"tr-TR": "Türkçe",
	"id-ID": "Bahasa Indonesia",
};

const supportedLangs: LangCode[] = [
	"en-US",
	"zh-CN",
	"zh-TW",
	"zh-HK",
	"ja-JP",
	"ko-KR",
	"es-ES",
	"th-TH",
	"vi-VN",
	"tr-TR",
	"id-ID",
];

export function normalizeLangCode(lang?: string): LangCode {
	const normalized = lang || Config.i18n.defaultLang || "en-US";
	const lower = normalized.toLowerCase();
	const match = supportedLangs.find((item) => item.toLowerCase() === lower);
	return match || Config.i18n.defaultLang || "en-US";
}

export function toLangSlug(lang?: string): string {
	return normalizeLangCode(lang);
}

export function toHreflang(lang?: string): string {
	return normalizeLangCode(lang);
}

export function fromLangSlug(slug?: string): LangCode {
	return normalizeLangCode(slug);
}

export function getEnabledLanguages(): LangCode[] {
	if (!Config.i18n.enable) return [normalizeLangCode(Config.i18n.defaultLang)];
	const languages = Config.i18n.languages.map(normalizeLangCode);
	return Array.from(new Set(languages));
}

export function isDefaultLang(lang?: string): boolean {
	return normalizeLangCode(lang) === normalizeLangCode(Config.i18n.defaultLang);
}

export function shouldUseLangPrefix(lang?: string): boolean {
	return Config.i18n.defaultLangInSubdir || !isDefaultLang(lang);
}

export function getPrefixedLanguages(): LangCode[] {
	const languages = getEnabledLanguages();
	if (Config.i18n.defaultLangInSubdir) return languages;
	return languages.filter((lang) => !isDefaultLang(lang));
}

export function isLangSlug(slug?: string): boolean {
	if (!slug) return false;
	const normalized = toLangSlug(fromLangSlug(slug));
	return getEnabledLanguages().some((lang) => toLangSlug(lang) === normalized);
}

function joinUrl(...parts: string[]): string {
	return parts.join("/").replace(/\/+/g, "/");
}

export function withLangPrefix(path: string, lang?: string): string {
	const cleanPath = path.startsWith("/") ? path : `/${path}`;
	if (!shouldUseLangPrefix(lang)) return joinUrl("/", import.meta.env.BASE_URL, cleanPath);
	return joinUrl("/", import.meta.env.BASE_URL, toLangSlug(lang), cleanPath);
}

export function getLangHomeUrl(lang?: string): string {
	return withLangPrefix("/", lang);
}

export function getPostLang(post: CollectionEntry<"posts">): LangCode {
	return normalizeLangCode(post.data.lang || Config.i18n.defaultLang);
}

export function filterPostsByLang<T extends CollectionEntry<"posts">>(
	posts: T[],
	lang?: string,
): T[] {
	const targetLang = normalizeLangCode(lang);
	return posts.filter((post) => getPostLang(post) === targetLang);
}

export type AlternateLink = {
	lang: LangCode;
	hreflang: string;
	label: string;
	url: string;
};

export function getHomeAlternates(): AlternateLink[] {
	return getEnabledLanguages().map((lang) => ({
		lang,
		hreflang: toHreflang(lang),
		label: languageLabels[lang],
		url: getLangHomeUrl(lang),
	}));
}

export function getPathAlternates(pathBuilder: (lang: LangCode) => string): AlternateLink[] {
	return getEnabledLanguages().map((lang) => ({
		lang,
		hreflang: toHreflang(lang),
		label: languageLabels[lang],
		url: pathBuilder(lang),
	}));
}
