import I18nKey from "@i18n/i18nKey";
import { i18n } from "@i18n/translation";
import { normalizeMappingKey } from "@utils/normalize";
import { withLangPrefix } from "./i18n-utils";

export function pathsEqual(path1: string, path2: string): boolean {
	const normalizedPath1 = path1.replace(/^\/|\/$/g, "").toLowerCase();
	const normalizedPath2 = path2.replace(/^\/|\/$/g, "").toLowerCase();
	return normalizedPath1 === normalizedPath2;
}

function joinUrl(...parts: string[]): string {
	const joined = parts.join("/");
	return joined.replace(/\/+/g, "/");
}

export function url(path: string): string {
	return joinUrl("", import.meta.env.BASE_URL, path);
}

export function getPostUrlBySlug(slug: string, lang?: string): string {
	if (lang) return withLangPrefix(`/posts/${slug}/`, lang);
	return url(`/posts/${slug}/`);
}

export function getTagUrl(tag: string, lang?: string): string {
	if (lang) return withLangPrefix(`/tags/${normalizeMappingKey(tag)}/`, lang);
	return url(`/tags/${normalizeMappingKey(tag)}/`);
}

export function getCategoryUrl(category: string | null, lang?: string): string {
	if (
		!category ||
		normalizeMappingKey(category) === "" ||
		normalizeMappingKey(category) === normalizeMappingKey(i18n(I18nKey.uncategorized))
	)
		return lang
			? withLangPrefix("/categories/uncategorized/", lang)
			: url("/categories/uncategorized/");
	return lang
		? withLangPrefix(`/categories/${normalizeMappingKey(category)}/`, lang)
		: url(`/categories/${normalizeMappingKey(category)}/`);
}

export function getTagName(
	tag: string,
	tagMapping: Record<string, string> = {},
): string {
	const normalizedTag = normalizeMappingKey(tag);
	return tagMapping[normalizedTag] || tag;
}

export function getCategoryName(
	category: string,
	categoryMapping: Record<string, string> = {},
): string {
	const normalizedCategory = normalizeMappingKey(category);
	return categoryMapping[normalizedCategory] || category;
}

export function getDir(path: string): string {
	const lastSlashIndex = path.lastIndexOf("/");
	if (lastSlashIndex < 0) {
		return "/";
	}
	return path.substring(0, lastSlashIndex + 1);
}
