import { type CollectionEntry, getCollection } from "astro:content";
import { normalizeMappingKey } from "@utils/normalize";
import { getCategoryUrl } from "@utils/url-utils.ts";
import { filterPostsByLang, getPostLang, getPostTranslationGroupKey, normalizeLangCode } from "./i18n-utils";

// Cache for all blog posts to avoid repeated getCollection calls
let cachedPosts: CollectionEntry<"posts">[] | null = null;
let cachedDisplayNameMappings: DisplayNameMappings | null = null;

export type DisplayNameMappings = {
	tags: Record<string, string>;
	categories: Record<string, string>;
};



function applyDisplayMapping(
	targetMap: Record<string, string>,
	rawKey: string,
	rawLabel: string,
	context?: { type: "tag" | "category"; source: string },
): void {
	const key = normalizeMappingKey(rawKey);
	const label = rawLabel.trim();
	if (!key || !label) {
		return;
	}

	// 冲突检测：同一 slug 已存在不同 label
	if (targetMap[key] && targetMap[key] !== label) {
		console.warn(
			`[DisplayName Conflict] ${context?.type ?? "unknown"} "${key}": ` +
				`existing="${targetMap[key]}" vs new="${label}" ` +
				`(source: ${context?.source ?? "unknown"})`,
		);
	}

	targetMap[key] = label;
}

async function getAllPosts(): Promise<CollectionEntry<"posts">[]> {
	if (cachedPosts !== null) {
		return cachedPosts;
	}
	cachedPosts = await getCollection("posts", ({ data }) => {
		return import.meta.env.PROD ? data.draft !== true : true;
	});
	return cachedPosts;
}

async function buildDisplayNameMappings(): Promise<DisplayNameMappings> {
	if (cachedDisplayNameMappings !== null) {
		return cachedDisplayNameMappings;
	}

	const allBlogPosts = await getAllPosts();
	const mappings: DisplayNameMappings = {
		tags: {},
		categories: {},
	};

	for (const post of allBlogPosts) {
		const tagLabels = post.data.tagLabels ?? {};
		for (const [rawKey, rawLabel] of Object.entries(tagLabels)) {
			if (typeof rawLabel !== "string") {
				continue;
			}
			applyDisplayMapping(mappings.tags, rawKey, rawLabel, {
				type: "tag",
				source: post.id,
			});
		}

		if (post.data.category && post.data.categoryLabel) {
			applyDisplayMapping(
				mappings.categories,
				post.data.category,
				post.data.categoryLabel,
				{ type: "category", source: post.id },
			);
		}
	}

	cachedDisplayNameMappings = mappings;
	return cachedDisplayNameMappings;
}

export async function getTaxonomyDisplayMappings(lang?: string): Promise<DisplayNameMappings> {
	if (!lang) return buildDisplayNameMappings();

	const targetLang = normalizeLangCode(lang);
	const allBlogPosts = filterPostsByLang(await getAllPosts(), targetLang);
	const mappings: DisplayNameMappings = {
		tags: {},
		categories: {},
	};

	for (const post of allBlogPosts) {
		const tagLabels = post.data.tagLabels ?? {};
		for (const [rawKey, rawLabel] of Object.entries(tagLabels)) {
			if (typeof rawLabel !== "string") continue;
			applyDisplayMapping(mappings.tags, rawKey, rawLabel, {
				type: "tag",
				source: post.id,
			});
		}
		if (post.data.category && post.data.categoryLabel) {
			applyDisplayMapping(mappings.categories, post.data.category, post.data.categoryLabel, {
				type: "category",
				source: post.id,
			});
		}
	}

	return mappings;
}

// // Retrieve posts and sort them by publication date
async function getRawSortedPosts() {
	const allBlogPosts = await getAllPosts();

	const sorted = allBlogPosts.sort((a, b) => {
		const dateA = new Date(a.data.published);
		const dateB = new Date(b.data.published);
		return dateA > dateB ? -1 : 1;
	});
	return sorted;
}

export async function getSortedPosts(lang?: string): Promise<CollectionEntry<"posts">[]> {
	const sorted = lang
		? filterPostsByLang(await getRawSortedPosts(), lang)
		: await getRawSortedPosts();

	for (const post of sorted) {
		post.data.nextSlug = "";
		post.data.nextTitle = "";
		post.data.prevSlug = "";
		post.data.prevTitle = "";
	}

	for (let i = 1; i < sorted.length; i++) {
		sorted[i].data.nextSlug = sorted[i - 1].id;
		sorted[i].data.nextTitle = sorted[i - 1].data.title;
	}
	for (let i = 0; i < sorted.length - 1; i++) {
		sorted[i].data.prevSlug = sorted[i + 1].id;
		sorted[i].data.prevTitle = sorted[i + 1].data.title;
	}

	return sorted;
}
export type PostForList = {
	id: string;
	data: CollectionEntry<"posts">["data"];
};
export async function getSortedPostsList(lang?: string): Promise<PostForList[]> {
	const sortedFullPosts = lang
		? filterPostsByLang(await getRawSortedPosts(), lang)
		: await getRawSortedPosts();

	const sortedPostsList = sortedFullPosts.map((post) => ({
		id: post.id,
		data: post.data,
	}));

	return sortedPostsList;
}
export type Tag = {
	name: string;
	count: number;
};

export async function getTagList(lang?: string): Promise<Tag[]> {
	const allBlogPosts = lang
		? filterPostsByLang(await getAllPosts(), lang)
		: await getAllPosts();

	const countMap: { [key: string]: number } = {};
	allBlogPosts.forEach((post: { data: { tags: string[] } }) => {
		post.data.tags.forEach((tag: string) => {
			const normalizedKey = normalizeMappingKey(tag);
			if (!countMap[normalizedKey]) countMap[normalizedKey] = 0;
			countMap[normalizedKey]++;
		});
	});

	const keys: string[] = Object.keys(countMap).sort((a, b) => {
		return a.localeCompare(b);
	});

	return keys.map((key) => ({ name: key, count: countMap[key] }));
}

export type Category = {
	name: string;
	count: number;
	url: string;
};

export async function getCategoryList(lang?: string): Promise<Category[]> {
	const allBlogPosts = lang
		? filterPostsByLang(await getAllPosts(), lang)
		: await getAllPosts();
	const count: { [key: string]: number } = {};
	allBlogPosts.forEach((post: { data: { category: string | null } }) => {
		if (!post.data.category) {
			const ucKey = "uncategorized";
			count[ucKey] = count[ucKey] ? count[ucKey] + 1 : 1;
			return;
		}

		const normalizedKey = normalizeMappingKey(String(post.data.category));

		count[normalizedKey] = count[normalizedKey] ? count[normalizedKey] + 1 : 1;
	});

	const lst = Object.keys(count).sort((a, b) => {
		return a.localeCompare(b);
	});

	const ret: Category[] = [];
	for (const c of lst) {
		ret.push({
			name: c,
			count: count[c],
			url: getCategoryUrl(c, lang),
		});
	}
	return ret;
}

export async function getPostTranslations(
	post: CollectionEntry<"posts">,
): Promise<CollectionEntry<"posts">[]> {
	const key = getPostTranslationGroupKey(post);
	const posts = await getAllPosts();
	return posts.filter((item) => getPostTranslationGroupKey(item) === key);
}

export async function getPostTranslationMap(
	post: CollectionEntry<"posts">,
): Promise<Record<string, CollectionEntry<"posts">>> {
	const translations = await getPostTranslations(post);
	const map: Record<string, CollectionEntry<"posts">> = {};
	for (const translation of translations) {
		map[getPostLang(translation)] = translation;
	}
	return map;
}

export async function getPostTranslationLinks(
	post: CollectionEntry<"posts">,
	currentLang?: string,
) {
	const current = normalizeLangCode(currentLang || getPostLang(post));
	const translations = await getPostTranslations(post);
	return translations
		.map((translation) => ({
			post: translation,
			lang: getPostLang(translation),
		}))
		.filter((item) => item.lang !== current);
}
