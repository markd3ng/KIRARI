import { posix } from "node:path";

export function llmMarkdownPath(canonicalPath) {
	return `${canonicalPath.replace(/\/$/, "")}/index.md`;
}

/** Resolve source links without publishing source files or guessing private routes. */
export async function rewriteLlmUrl(value, { canonicalUrl, basePath, sourcePath, findContentUrl, resolveAsset }) {
	const base = `/${basePath.replace(/^\/+|\/+$/g, "")}/`.replace(/\/+/g, "/");
	const isSourcePath = (pathname) => {
		const path = pathname.startsWith(base) ? `/${pathname.slice(base.length)}` : pathname;
		try {
			return /^\/(?:src|content)\//.test(posix.normalize(decodeURIComponent(path)));
		} catch {
			return true;
		}
	};
	if (!value || value.startsWith("#")) return value;
	if (/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(value)) {
		const absolute = new URL(value, canonicalUrl);
		if (absolute.origin === new URL(canonicalUrl).origin && isSourcePath(absolute.pathname)) return null;
		return value;
	}
	const suffixAt = value.search(/[?#]/);
	const pathname = suffixAt < 0 ? value : value.slice(0, suffixAt);
	const suffix = suffixAt < 0 ? "" : value.slice(suffixAt);
	if (!pathname) return new URL(value, canonicalUrl).href;
	if (pathname.startsWith("/")) {
		const target = pathname.startsWith(base) ? pathname : `${base}${pathname.slice(1)}`;
		const absolute = new URL(`${target}${suffix}`, canonicalUrl);
		return isSourcePath(absolute.pathname) ? null : absolute.href;
	}
	let decoded;
	try {
		decoded = decodeURIComponent(pathname);
	} catch {
		return null;
	}
	const sourceTarget = posix.normalize(posix.join(posix.dirname(sourcePath), decoded));
	if (/\.mdx?$/i.test(sourceTarget)) {
		const target = findContentUrl(sourceTarget);
		return target ? `${target}${suffix}` : null;
	}
	const asset = await resolveAsset(sourceTarget);
	if (asset) return `${new URL(asset, canonicalUrl).href}${suffix}`;
	if (/\.(?:avif|gif|heic|heif|jpe?g|png|svg|tiff?|webp)$/i.test(pathname)) {
		throw new Error(`LLM Markdown asset is unavailable: ${sourceTarget}`);
	}
	if (posix.extname(pathname) && !/\.html?$/i.test(pathname)) {
		throw new Error(`LLM Markdown relative attachment is unsupported; use a public URL: ${sourceTarget}`);
	}
	return new URL(value, canonicalUrl).href;
}
