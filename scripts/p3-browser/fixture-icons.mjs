import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { expectedExternalOrigins } from "./request-routing.mjs";

const siteRequire = createRequire(new URL("../../apps/site/package.json", import.meta.url));
const packages = new Map([
	["material-symbols", "@iconify-json/material-symbols"],
	["fa6-brands", "@iconify-json/fa6-brands"],
	["fa6-regular", "@iconify-json/fa6-regular"],
	["fa6-solid", "@iconify-json/fa6-solid"],
]);

function reject() {
	const error = new Error("Local fixture icon request is outside the installed icon contract");
	error.code = "FIXTURE_ICON_REQUEST_REJECTED";
	throw error;
}

// Local fixtures use the locked application icon data, never a public fallback API.
export function createFixtureIconResolver() {
	const loaded = new Map();
	const resolved = new Set();
	let requests = 0;
	const resolveIcons = (value, method = "GET") => {
		const url = new URL(value);
		const prefix = /^\/([a-z0-9]+(?:-[a-z0-9]+)*)\.json$/.exec(url.pathname)?.[1];
		if (method !== "GET" || !expectedExternalOrigins.has(url.origin) || url.username || url.password || url.hash || !packages.has(prefix) || url.searchParams.size !== 1 || !url.searchParams.has("icons")) reject();
		const names = url.searchParams.get("icons").split(",");
		if (!names.length || names.length > 128 || new Set(names).size !== names.length || names.some((name) => !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name))) reject();
		if (!loaded.has(prefix)) {
			const name = packages.get(prefix);
			const bytes = readFileSync(siteRequire.resolve(`${name}/icons.json`));
			loaded.set(prefix, {
				data: JSON.parse(bytes),
				provenance: { package: name, version: siteRequire(`${name}/package.json`).version, sha256: createHash("sha256").update(bytes).digest("hex") },
			});
		}
		const { data } = loaded.get(prefix);
		const icons = {};
		const aliases = {};
		const include = (name, parents = new Set()) => {
			if (parents.has(name)) reject();
			if (Object.hasOwn(data.icons, name)) icons[name] = data.icons[name];
			else if (Object.hasOwn(data.aliases ?? {}, name)) {
				aliases[name] = data.aliases[name];
				include(aliases[name].parent, new Set([...parents, name]));
			} else reject();
		};
		for (const name of names) include(name);
		requests += 1;
		for (const name of names) resolved.add(`${prefix}:${name}`);
		return { prefix, icons, ...(Object.keys(aliases).length ? { aliases } : {}), ...(data.width ? { width: data.width } : {}), ...(data.height ? { height: data.height } : {}) };
	};
	resolveIcons.provenance = () => ({ requests, resolvedIcons: resolved.size, sets: [...loaded.values()].map(({ provenance }) => provenance).sort((a, b) => a.package.localeCompare(b.package)) });
	return resolveIcons;
}
