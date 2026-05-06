import rss from "@astrojs/rss";
import { getSortedPosts } from "@utils/content-utils";
import { getPostUrlBySlug } from "@utils/url-utils";
import type { APIContext, GetStaticPaths } from "astro";
import MarkdownIt from "markdown-it";
import sanitizeHtml from "sanitize-html";
import { siteConfig } from "@/config";
import { fromLangSlug, getEnabledLanguages, toLangSlug } from "../../utils/i18n-utils";

const parser = new MarkdownIt();

function stripInvalidXmlChars(str: string): string {
	return str.replace(
		// biome-ignore lint/suspicious/noControlCharactersInRegex: https://www.w3.org/TR/xml/#charsets
		/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F\uFDD0-\uFDEF\uFFFE\uFFFF]/g,
		"",
	);
}

export const getStaticPaths = (() =>
	getEnabledLanguages().map((lang) => ({
		params: { lang: toLangSlug(lang) },
		props: { lang },
	}))) satisfies GetStaticPaths;

export async function GET(context: APIContext): Promise<Response> {
	const lang = fromLangSlug(context.params.lang);
	const blog = await getSortedPosts(lang);

	return rss({
		title: `${siteConfig.title} (${toLangSlug(lang)})`,
		description: siteConfig.subtitle || "No description",
		site: context.site ?? "https://fuwari.vercel.app",
		items: blog.map((post) => {
			const content =
				typeof post.body === "string" ? post.body : String(post.body || "");
			const cleanedContent = stripInvalidXmlChars(content);
			return {
				title: post.data.title,
				pubDate: post.data.published,
				description: post.data.description || "",
				link: getPostUrlBySlug(post.id, lang),
				content: sanitizeHtml(parser.render(cleanedContent), {
					allowedTags: sanitizeHtml.defaults.allowedTags.concat(["img"]),
				}),
			};
		}),
		customData: `<language>${toLangSlug(lang)}</language>`,
	});
}
