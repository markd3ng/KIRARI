import type { APIContext, ImageMetadata } from "astro";
import { getImage } from "astro:assets";
import type { CollectionEntry } from "astro:content";
import I18nKey from "@i18n/i18nKey";
import { i18n } from "@i18n/translation";
import { Config } from "../constants";
import { getSortedPosts } from "./content-utils";
import { getEnabledLanguages, getLangHomeUrl, withLangPrefix } from "./i18n-utils";
import { getPostUrl } from "./post-route-utils";
import { getLocalizedSpecEntry } from "./spec-content";
import { url } from "./url-utils";
import { renderLlmMarkdown } from "./llm-markdown.mjs";
import { llmMarkdownPath, rewriteLlmUrl } from "./llm-url-utils.mjs";

type ContentEntry = CollectionEntry<"posts"> | CollectionEntry<"spec">;
type LlmContent = {
	entry: ContentEntry;
	lang: string;
	title: string;
	canonicalPath: string;
	sourcePath: string;
};

const images = import.meta.glob<ImageMetadata>("/src/**/*.{avif,gif,heic,heif,jpeg,jpg,png,svg,tif,tiff,webp}", { import: "default" });
let contentPromise: Promise<LlmContent[]> | undefined;

export function getLlmViewPath(canonicalPath: string): string | undefined {
	return Config.llms.enable ? llmMarkdownPath(canonicalPath) : undefined;
}

export function getPostLlmViewPath(entry: CollectionEntry<"posts">, lang: string): string | undefined {
	return entry.data.draft ? undefined : getLlmViewPath(getPostUrl(entry, lang));
}

function describe(entry: ContentEntry, lang: string, title: string, canonicalPath: string): LlmContent {
	if (!entry.filePath) throw new Error(`LLM source path missing for ${entry.collection}:${entry.id}`);
	return {
		entry,
		lang,
		title,
		canonicalPath,
		sourcePath: entry.filePath.replace(/\\/g, "/").replace(/^\.\//, ""),
	};
}

export async function getLlmContent(): Promise<LlmContent[]> {
	if (!Config.llms.enable) return [];
	contentPromise ??= (async () => {
		const byCanonical = new Map<string, LlmContent>();
		for (const lang of getEnabledLanguages()) {
			for (const entry of await getSortedPosts(lang)) {
				if (entry.data.draft) continue;
				const content = describe(entry, lang, entry.data.title, getPostUrl(entry, lang));
				byCanonical.set(content.canonicalPath, content);
			}
			for (const page of ["about", "friends", "projects"] as const) {
				const entry = await getLocalizedSpecEntry(page, lang);
				if (!entry) continue;
				const content = describe(entry, lang, i18n(I18nKey[page], lang), withLangPrefix(`/${page}/`, lang));
				byCanonical.set(content.canonicalPath, content);
			}
		}
		return [...byCanonical.values()].sort((a, b) => a.canonicalPath.localeCompare(b.canonicalPath));
	})();
	return contentPromise;
}

export async function getLlmStaticPaths() {
	const base = import.meta.env.BASE_URL.replace(/\/$/, "");
	return (await getLlmContent()).map((content) => ({
		params: { path: content.canonicalPath.slice(base.length).replace(/^\/+|\/+$/g, "") },
		props: { content },
	}));
}

export async function serveLlmMarkdown(context: APIContext): Promise<Response> {
	const { content } = context.props as { content: LlmContent };
	const site = context.site ?? Config.site.url;
	const absoluteUrl = (value: string) => new URL(value, site).href;
	const published = await getLlmContent();
	const sourceUrls = new Map<string, string>();
	for (const entry of published) {
		if (!sourceUrls.has(entry.sourcePath) || entry.lang === content.lang) {
			sourceUrls.set(entry.sourcePath, absoluteUrl(entry.canonicalPath));
		}
	}
	const canonicalUrl = absoluteUrl(content.canonicalPath);
	const markdown = await renderLlmMarkdown({
		body: content.entry.body ?? "",
		title: content.title,
		canonicalUrl,
		sourcePath: content.sourcePath,
		rewriteUrl: (value: string) => rewriteLlmUrl(value, {
			canonicalUrl,
			basePath: import.meta.env.BASE_URL,
			sourcePath: content.sourcePath,
			findContentUrl: (path: string) => sourceUrls.get(path),
			resolveAsset: async (path: string) => {
				const load = images[`/${path}`];
				if (!load) return undefined;
				return (await getImage({ src: await load() })).src;
			},
		}),
	}).catch((cause: unknown) => {
		throw new Error(`Failed to generate LLM Markdown for ${content.canonicalPath}`, { cause });
	});
	return new Response(markdown, {
		headers: {
			"Content-Type": "text/markdown; charset=utf-8",
			"Link": `<${absoluteUrl(`${Config.llms.i18n ? getLangHomeUrl(content.lang) : url("/")}llms.txt`)}>; rel="describedby"; type="text/plain"`,
		},
	});
}
