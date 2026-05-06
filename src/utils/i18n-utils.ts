import type { CollectionEntry } from "astro:content";
import { Config } from "../constants";
import type { SiteConfig } from "../types/config";

export type LangCode = SiteConfig["lang"];

export const languageLabels: Record<LangCode, string> = {
	en: "English",
	zh_CN: "简体中文",
	zh_TW: "繁體中文",
	ja: "日本語",
	ko: "한국어",
	es: "Español",
	th: "ไทย",
	vi: "Tiếng Việt",
	tr: "Türkçe",
	id: "Bahasa Indonesia",
};

const supportedLangs: LangCode[] = [
	"en",
	"zh_CN",
	"zh_TW",
	"ja",
	"ko",
	"es",
	"th",
	"vi",
	"tr",
	"id",
];

export function normalizeLangCode(lang?: string): LangCode {
	const normalized = (lang || Config.i18n.defaultLang || "en").replace("-", "_");
	const lower = normalized.toLowerCase();
	const match = supportedLangs.find((item) => item.toLowerCase() === lower);
	return match || Config.i18n.defaultLang || "en";
}

export function toLangSlug(lang?: string): string {
	return normalizeLangCode(lang).replace("_", "-").toLowerCase();
}

export function fromLangSlug(slug?: string): LangCode {
	return normalizeLangCode((slug || "").replace("-", "_"));
}

export function getEnabledLanguages(): LangCode[] {
	if (!Config.i18n.enable) return [normalizeLangCode(Config.i18n.defaultLang)];
	const languages = Config.i18n.languages.map(normalizeLangCode);
	return Array.from(new Set(languages));
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
		hreflang: toLangSlug(lang),
		label: languageLabels[lang],
		url: getLangHomeUrl(lang),
	}));
}

export function getPathAlternates(pathBuilder: (lang: LangCode) => string): AlternateLink[] {
	return getEnabledLanguages().map((lang) => ({
		lang,
		hreflang: toLangSlug(lang),
		label: languageLabels[lang],
		url: pathBuilder(lang),
	}));
}
