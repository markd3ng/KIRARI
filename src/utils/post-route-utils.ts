import type { CollectionEntry } from "astro:content";
import { Config } from "../constants";
import { withLangPrefix } from "./i18n-utils";
import { url } from "./url-utils";

function crc32(input: string): string {
	let crc = 0xffffffff;
	for (const byte of new TextEncoder().encode(input)) {
		crc ^= byte;
		for (let bit = 0; bit < 8; bit++) {
			crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
		}
	}
	return ((crc ^ 0xffffffff) >>> 0).toString(16).padStart(8, "0");
}

function normalizeRouteSlug(slug: string): string {
	return slug
		.trim()
		.replace(/\\/g, "/")
		.replace(/^\/+|\/+$/g, "")
		.replace(/^posts\//, "")
		.replace(/\.html?$/i, "");
}

function fileSlug(id: string): string {
	return normalizeRouteSlug(id);
}

export function getPostRouteSlug(post: CollectionEntry<"posts">): string {
	const explicitSlug = normalizeRouteSlug(post.data.slug || "");
	if (explicitSlug) return explicitSlug;

	if (post.data.routeSlug) return post.data.routeSlug;
	if (Config.posts.slugStrategy === "crc32") return crc32(post.id);
	return fileSlug(post.id);
}

export function applyPostRouteSlug(post: CollectionEntry<"posts">): void {
	post.data.routeSlug = getPostRouteSlug(post);
}

export function getPostUrl(post: CollectionEntry<"posts">, lang?: string): string {
	return getPostUrlBySlug(getPostRouteSlug(post), lang);
}

export function getPostUrlBySlug(slug: string, lang?: string): string {
	const routeSlug = normalizeRouteSlug(slug);
	if (lang) return withLangPrefix(`/posts/${routeSlug}/`, lang);
	return url(`/posts/${routeSlug}/`);
}
