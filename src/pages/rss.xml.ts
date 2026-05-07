import rss from "@astrojs/rss";
import { getSortedPosts } from "@utils/content-utils";
import { getPostUrl } from "@utils/post-route-utils";
import type { APIContext } from "astro";
import MarkdownIt from "markdown-it";
import sanitizeHtml from "sanitize-html";
import { siteConfig } from "@/config";
import { Config } from "../constants";

const parser = new MarkdownIt();

function stripInvalidXmlChars(str: string): string {
	return str.replace(
		// biome-ignore lint/suspicious/noControlCharactersInRegex: https://www.w3.org/TR/xml/#charsets
		/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F\uFDD0-\uFDEF\uFFFE\uFFFF]/g,
		"",
	);
}

export async function GET(context: APIContext): Promise<Response> {
	const lang = Config.i18n.defaultLang;
	const blog = await getSortedPosts(lang);

	return rss({
		title: siteConfig.title,
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
				link: getPostUrl(post, lang),
				content: sanitizeHtml(parser.render(cleanedContent), {
					allowedTags: sanitizeHtml.defaults.allowedTags.concat(["img"]),
				}),
			};
		}),
		customData: `<language>${lang.replace("_", "-")}</language>`,
	});
}
