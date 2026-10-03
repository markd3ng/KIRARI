import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { parse as parseHtml } from "parse5";

function walk(directory) {
	if (!existsSync(directory)) return [];
	return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
		const path = join(directory, entry.name);
		return entry.isDirectory() ? walk(path) : [path];
	});
}

function visit(node, callback) {
	callback(node);
	for (const child of node.childNodes ?? []) visit(child, callback);
}

function elements(root, tagName) {
	const result = [];
	visit(root, (node) => { if (node.tagName === tagName) result.push(node); });
	return result;
}

function textContent(node) {
	if (node.tagName === "script" || node.tagName === "style") return "";
	return node.value ?? (node.childNodes ?? []).map(textContent).join("");
}

function attr(node, name) {
	return node.attrs?.find((item) => item.name === name)?.value ?? "";
}

function routeFor(file, dist) {
	const path = relative(dist, file).split(sep).join("/");
	if (path === "index.html") return "/";
	if (path.endsWith("/index.html")) return `/${path.slice(0, -"index.html".length)}`;
	return `/${path}`;
}

function addLocalAsset(assets, value) {
	if (!value || /^(?:[a-z]+:|\/\/|data:)/i.test(value)) return;
	const path = new URL(value, "https://kirari.invalid/").pathname;
	if (!assets.includes(path)) assets.push(path);
}

function localPath(value, base) {
	if (!value || /^(?:[a-z]+:|\/\/|#|mailto:|tel:)/i.test(value)) return "";
	const url = new URL(value, `https://kirari.invalid${base}`);
	return url.origin === "https://kirari.invalid" ? `${url.pathname}${url.search}${url.hash}` : "";
}

export function browserContract(dist) {
	const files = walk(dist).filter((file) => file.endsWith(".html")).sort();
	const root = files.find((file) => relative(dist, file).split(sep).join("/") === "index.html");
	if (!root) throw new Error("Site output must contain index.html for browser validation");
	const rootDoc = parseHtml(readFileSync(root, "utf8"));
	const refreshMeta = elements(rootDoc, "meta").find((node) => attr(node, "http-equiv").toLowerCase() === "refresh");
	const refresh = refreshMeta ? attr(refreshMeta, "content") : "";
	const refreshPath = /url\s*=\s*([^;\s]+)/i.exec(refresh)?.[1];
	const rootContentFile = refreshPath?.startsWith("/") ? join(dist, refreshPath.replace(/^\/+/, ""), "index.html") : root;
	const rootResolvedFile = existsSync(rootContentFile) ? rootContentFile : root;
	const filesByRoute = new Map(files.map((file) => [routeFor(file, dist), file]));
	const linkedPages = elements(parseHtml(readFileSync(rootResolvedFile, "utf8")), "a")
		.map((anchor) => localPath(attr(anchor, "href"), refreshPath ?? "/"))
		.map((target) => target ? filesByRoute.get(new URL(target, "https://kirari.invalid").pathname) : undefined)
		.filter((file) => file && /\/posts\/|\/pages?\//.test(`/${relative(dist, file).split(sep).join("/")}`));
	const contentPages = files.filter((file) => file !== rootResolvedFile && /\/posts\/|\/pages?\//.test(`/${relative(dist, file).split(sep).join("/")}`));
	const selected = [rootResolvedFile, ...[...new Set([...linkedPages, ...contentPages])].slice(0, 2)];
	const routes = [];
	const assets = { stylesheets: [], scripts: [], images: [] };
	const rootNavigation = [];
	for (const file of selected) {
		const doc = parseHtml(readFileSync(file, "utf8"));
		const title = elements(doc, "title").map(textContent).join(" ").replace(/\s+/g, " ").trim();
		const h1 = elements(doc, "h1").map(textContent).join(" ").replace(/\s+/g, " ").trim();
		const path = file === rootResolvedFile ? (refreshPath?.startsWith("/") ? refreshPath : "/") : routeFor(file, dist);
		if (!title && !h1) continue;
		routes.push({ path, title, content_marker: h1 });
		for (const anchor of elements(doc, "a")) {
			const target = localPath(attr(anchor, "href"), path);
			if (file === rootResolvedFile && target && !rootNavigation.includes(target)) rootNavigation.push(target);
		}
		for (const link of elements(doc, "link")) {
			if (attr(link, "rel").split(/\s+/).includes("stylesheet")) addLocalAsset(assets.stylesheets, attr(link, "href"));
		}
		for (const script of elements(doc, "script")) addLocalAsset(assets.scripts, attr(script, "src"));
		for (const image of elements(doc, "img")) addLocalAsset(assets.images, attr(image, "src"));
	}
	if (!routes.length || !assets.stylesheets.length || !rootNavigation.length) throw new Error("Browser contract requires content, a local stylesheet, and an internal navigation link");
	for (const values of Object.values(assets)) values.sort();
	const rootPath = new URL(routes[0].path, "https://kirari.invalid").pathname;
	const routePaths = new Set(routes.map((route) => new URL(route.path, "https://kirari.invalid").pathname));
	const navigation = rootNavigation.find((target) => {
		const pathname = new URL(target, "https://kirari.invalid").pathname;
		return pathname !== rootPath && routePaths.has(pathname);
	}) ?? rootNavigation[0] ?? "";
	return { routes, assets, navigation };
}
