import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkDirective from "remark-directive";
import remarkMdx from "remark-mdx";
import { parseFragment } from "parse5";

const markdown = unified().use(remarkParse).use(remarkGfm).use(remarkMath).use(remarkDirective);
const mdx = markdown().use(remarkMdx);
const escapeText = (value) => String(value).replace(/[\\`*_[\]<>!]/g, "\\$&");
const destination = (value) => `<${String(value).replace(/[<>\r\n]/g, (char) => encodeURIComponent(char))}>`;
const link = (label, url) => `[${label}](${destination(url)})`;
const omitted = "[Dynamic content omitted from Markdown view.]";

/**
 * Export collection source without executing MDX or running presentation plugins.
 * Source spans keep untouched Markdown (especially code and diagrams) verbatim.
 */
export async function renderLlmMarkdown({ body, title, canonicalUrl, sourcePath, rewriteUrl }) {
	const source = body ?? "";
	const tree = (/\.mdx$/i.test(sourcePath) ? mdx : markdown).parse(source);
	const definitions = new Map();
	const start = (node) => node.position.start.offset;
	const end = (node) => node.position.end.offset;
	const raw = (node) => source.slice(start(node), end(node));
	const isExecutableUrl = (value) => {
		try {
			return ["javascript:", "vbscript:", "data:"].includes(new URL(value, canonicalUrl).protocol);
		} catch {
			return false;
		}
	};
	const safeUrl = async (value) => {
		// Markdown readers must never receive executable URL schemes.
		if (isExecutableUrl(value)) return null;
		const result = await rewriteUrl(value);
		return result && !isExecutableUrl(result) ? result : null;
	};
	const referencedIdentifiers = new Set();
	const collectReferences = (node) => {
		if (node.type === "linkReference" || node.type === "imageReference") {
			referencedIdentifiers.add(node.identifier);
		}
		for (const child of node.children ?? []) collectReferences(child);
	};
	collectReferences(tree);
	const collectDefinitions = async (node) => {
		if (node.type === "definition" && referencedIdentifiers.has(node.identifier) && !definitions.has(node.identifier)) {
			definitions.set(node.identifier, await safeUrl(node.url));
		}
		for (const child of node.children ?? []) await collectDefinitions(child);
	};
	await collectDefinitions(tree);

	const renderChildren = async (node, from = start(node), to = end(node)) => {
		let output = "";
		let cursor = from;
		const children = node.children ?? [];
		for (let index = 0; index < children.length; index++) {
			const child = children[index];
			// CommonMark splits inline HTML tags from their Markdown children.
			if (child.type === "html") {
				const element = parseFragment(source.slice(start(child), to), { sourceCodeLocationInfo: true }).childNodes[0];
				const location = element?.sourceCodeLocation;
				if (["a", "script", "style", "template"].includes(element?.tagName) && location?.startOffset === 0 && (location.endTag || element.tagName !== "a") && (!location.endTag || location.endTag.startOffset >= child.value.length)) {
					const groupEnd = start(child) + location.endOffset;
					let next = index + 1;
					while (next < children.length && end(children[next]) <= groupEnd) next++;
					let replacement = omitted;
					if (element.tagName === "a") {
						const label = await renderChildren({ children: children.slice(index + 1, next - 1) }, end(child), start(child) + location.endTag.startOffset);
						const href = element.attrs.find((attribute) => attribute.name === "href")?.value;
						const url = href ? await safeUrl(href) : null;
						replacement = url ? link(label || escapeText(href), url) : label;
					}
					output += source.slice(cursor, start(child)) + replacement;
					cursor = groupEnd;
					index = next - 1;
					continue;
				}
			}
			output += source.slice(cursor, start(child)) + await render(child);
			cursor = end(child);
		}
		return output + source.slice(cursor, to);
	};
	const content = async (node) => node.children?.length
		? renderChildren(node, start(node.children[0]), end(node.children.at(-1)))
		: "";
	const staticAttributes = (node) => Object.fromEntries((node.attributes ?? [])
		.filter((attribute) => attribute.type === "mdxJsxAttribute" && typeof attribute.value === "string")
		.map((attribute) => [attribute.name, attribute.value]));
	const renderJsx = async (node) => {
		const attributes = staticAttributes(node);
		const name = node.name ?? "";
		if (["script", "style"].includes(name)) return omitted;
		const children = await content(node);
		if (name === "YouTube" && attributes.id) {
			return link(escapeText(attributes.title || "YouTube video"), `https://www.youtube.com/watch?v=${encodeURIComponent(attributes.id)}`);
		}
		if (name === "Bilibili" && attributes.bvid) {
			return link(escapeText(attributes.title || "Bilibili video"), `https://www.bilibili.com/video/${encodeURIComponent(attributes.bvid)}`);
		}
		if (name === "a" && attributes.href) {
			const url = await safeUrl(attributes.href);
			return url ? link(children || escapeText(attributes.href), url) : children;
		}
		if (["img", "Image"].includes(name) && attributes.src) {
			const url = await safeUrl(attributes.src);
			const alt = escapeText(attributes.alt || "Image");
			return url ? `!${link(alt, url)}` : alt;
		}
		if (["iframe", "video", "audio"].includes(name) && attributes.src) {
			const url = await safeUrl(attributes.src);
			const label = escapeText(attributes.title || `${name} embed`);
			return (url ? link(label, url) : label) + (children ? `\n\n${children}` : "");
		}
		if (!name || /^[a-z][\w-]*$/.test(name) && children) return children;
		return omitted + (children ? `\n\n${children}` : "");
	};
	const renderDirective = async (node) => {
		const attributes = node.attributes ?? {};
		const children = await content(node);
		if (["github", "githubfile"].includes(node.name) && /^[\w.-]+\/[\w.-]+$/.test(attributes.repo ?? "")) {
			let url = `https://github.com/${attributes.repo}`;
			const file = attributes.file || attributes.path;
			if (node.name === "githubfile" && file) {
				url += `/blob/${encodeURIComponent(attributes.ref || "HEAD")}/${file.split("/").map(encodeURIComponent).join("/")}`;
			}
			return link(escapeText(attributes.description || (file ? `${attributes.repo}/${file}` : attributes.repo)), url);
		}
		if (["note", "tip", "important", "warning", "caution"].includes(node.name)) {
			return `**${node.name.toUpperCase()}**\n\n${children}`;
		}
		if (node.name === "spoiler") return children;
		return omitted + (children ? `\n\n${children}` : "");
	};
	const renderHtml = async (node) => {
		if (node.nodeName === "#text") return escapeText(node.value);
		if (["script", "style", "template"].includes(node.tagName)) return "[HTML content omitted from Markdown view.]";
		const attributes = Object.fromEntries((node.attrs ?? []).map(({ name, value }) => [name, value]));
		const children = (await Promise.all((node.childNodes ?? []).map(renderHtml))).join("");
		if (node.tagName === "a" && attributes.href) {
			const url = await safeUrl(attributes.href);
			return url ? link(children || escapeText(attributes.href), url) : children;
		}
		if (node.tagName === "img" && attributes.src) {
			const url = await safeUrl(attributes.src);
			const alt = escapeText(attributes.alt || "Image");
			return url ? `!${link(alt, url)}` : alt;
		}
		if (["iframe", "video", "audio", "source"].includes(node.tagName) && attributes.src) {
			const url = await safeUrl(attributes.src);
			const label = escapeText(attributes.title || `${node.tagName} embed`);
			return (url ? link(label, url) : label) + children;
		}
		if (node.tagName === "br") return "\n";
		return children;
	};
	const render = async (node) => {
		switch (node.type) {
			case "code":
			case "inlineCode":
			case "math":
			case "inlineMath":
				return raw(node);
			case "link": {
				const children = await content(node);
				const url = await safeUrl(node.url);
				const title = node.title ? ` "${node.title.replace(/[\\"]/g, "\\$&")}"` : "";
				return url ? `[${children}](${destination(url)}${title})` : children;
			}
			case "image": {
				const url = await safeUrl(node.url);
				const alt = escapeText(node.alt ?? "");
				const title = node.title ? ` "${node.title.replace(/[\\"]/g, "\\$&")}"` : "";
				return url ? `![${alt}](${destination(url)}${title})` : alt;
			}
			case "definition": {
				const url = definitions.get(node.identifier);
				if (!url) return "";
				const title = node.title ? ` "${node.title.replace(/[\\"]/g, "\\$&")}"` : "";
				const label = raw(node).match(/^[ \t]*\[(?:\\[\s\S]|[^\]\\])*\]:/)?.[0] ?? `[${node.identifier}]:`;
				return `${label} ${destination(url)}${title}`;
			}
			case "linkReference":
			case "imageReference":
				return definitions.get(node.identifier) ? renderChildren(node) : node.type === "imageReference" ? escapeText(node.alt ?? "") : content(node);
			case "mdxjsEsm":
				return "";
			case "mdxFlowExpression":
			case "mdxTextExpression":
				return omitted;
			case "mdxJsxFlowElement":
			case "mdxJsxTextElement":
				return renderJsx(node);
			case "containerDirective":
			case "leafDirective":
			case "textDirective":
				return renderDirective(node);
			case "html":
				return renderHtml(parseFragment(node.value));
			default:
				return renderChildren(node);
		}
	};
	const rendered = await renderChildren(tree, 0, source.length);
	return `# ${escapeText(title).replace(/[\r\n]+/g, " ")}\n\n> Canonical: ${link(escapeText(canonicalUrl), canonicalUrl)}\n\n${rendered.trim()}\n`;
}
