import I18nKey from "@i18n/i18nKey";
import { i18n } from "@i18n/translation";
import { normalizeMappingKey } from "@utils/normalize";

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

export function getPostUrlBySlug(slug: string): string {
	return url(`/posts/${slug}/`);
}

export function getTagUrl(tag: string): string {
	return url(`/tags/${normalizeMappingKey(tag)}/`);
}

export function getCategoryUrl(category: string | null): string {
	if (
		!category ||
		normalizeMappingKey(category) === "" ||
		normalizeMappingKey(category) === normalizeMappingKey(i18n(I18nKey.uncategorized))
	)
		return url("/categories/uncategorized/");
	return url(`/categories/${normalizeMappingKey(category)}/`);
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

