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
	return getLanguageConfig(lang).locale;
}

export function fromLangSlug(slug?: string): LangCode {
	return normalizeLangCode(slug);
}

export function getEnabledLanguages(): LangCode[] {
	if (!Config.i18n.enable) return [normalizeLangCode(Config.i18n.defaultLang)];
	const languages = Config.i18n.languages.map(normalizeLangCode);
	return Array.from(new Set(languages));
}

export function getLanguageConfig(lang?: string) {
	const normalized = normalizeLangCode(lang);
	return Config.i18n.languageMap[normalized] || {
		code: normalized,
		label: languageLabels[normalized],
		locale: normalized,
		direction: "ltr",
		weight: 100,
		disabled: false,
		contentDir: `src/content/posts/${normalized}`,
	};
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
	const frontmatterLang = post.data.lang?.trim();
	if (frontmatterLang) return normalizeLangCode(frontmatterLang);
	return inferLangFromContentId(post.id);
}

function trimPostContentDir(contentDir: string): string {
	return contentDir
		.replace(/\\/g, "/")
		.replace(/^\.?\//, "")
		.replace(/^src\/content\/posts\/?/, "")
		.replace(/^content\/posts\/?/, "")
		.replace(/^posts\/?/, "")
		.replace(/\/$/, "");
}

export function inferLangFromContentId(id: string): LangCode {
	for (const lang of getEnabledLanguages()) {
		const suffixPattern = new RegExp(`(^|/)${lang.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i");
		if (suffixPattern.test(id)) return lang;
		if (id.toLowerCase().endsWith(`.${lang.toLowerCase()}`)) return lang;

		const dir = trimPostContentDir(getLanguageConfig(lang).contentDir);
		if (dir && (id === dir || id.startsWith(`${dir}/`))) return lang;
	}
	return normalizeLangCode(Config.i18n.defaultLang);
}

export function getPostTranslationGroupKey(post: CollectionEntry<"posts">): string {
	const explicitKey = post.data.translationKey?.trim();
	if (explicitKey) return `key:${explicitKey}`;
	return `auto:${getLanguageNeutralPostId(post.id)}`;
}

export function getLanguageNeutralPostId(id: string): string {
	let neutral = id;
	for (const lang of getEnabledLanguages()) {
		const dir = trimPostContentDir(getLanguageConfig(lang).contentDir);
		if (dir && neutral.startsWith(`${dir}/`)) neutral = neutral.slice(dir.length + 1);
		if (neutral.toLowerCase().startsWith(`${lang.toLowerCase()}/`)) neutral = neutral.slice(lang.length + 1);
		const suffix = `.${lang}`;
		if (neutral.toLowerCase().endsWith(suffix.toLowerCase())) neutral = neutral.slice(0, -suffix.length);
	}
	return neutral.replace(/\/index$/, "");
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
		hreflang: getLanguageConfig(lang).locale,
		label: getLanguageConfig(lang).label,
		url: getLangHomeUrl(lang),
	}));
}

export function getPathAlternates(pathBuilder: (lang: LangCode) => string): AlternateLink[] {
	return getEnabledLanguages().map((lang) => ({
		lang,
		hreflang: getLanguageConfig(lang).locale,
		label: getLanguageConfig(lang).label,
		url: pathBuilder(lang),
	}));
}
