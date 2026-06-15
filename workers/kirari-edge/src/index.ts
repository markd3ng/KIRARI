/**
 * KIRARI Edge worker entry point.
 *
 * Feature flags are controlled via `kirari.config.toml` [edge] section.
 * All features default to disabled — the worker is inert until explicitly enabled.
 */

export interface Env {
	KIRARI_EDGE_ENABLED?: string;
	KIRARI_GHCARD_ENABLED?: string;
	KIRARI_AVATAR_PROXY_ENABLED?: string;
	KIRARI_BANGUMI_API_PROXY_ENABLED?: string;
	KIRARI_BANGUMI_IMAGE_PROXY_ENABLED?: string;
}

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		if (env.KIRARI_EDGE_ENABLED !== "true") {
			return new Response("Edge disabled", { status: 404 });
		}

		const url = new URL(request.url);

		if (env.KIRARI_GHCARD_ENABLED === "true" && url.pathname.startsWith("/api/github")) {
			return proxyGitHubCard(request, url);
		}

		if (env.KIRARI_AVATAR_PROXY_ENABLED === "true" && url.pathname.startsWith("/avatar")) {
			return proxyAvatar(url);
		}

		if (env.KIRARI_BANGUMI_API_PROXY_ENABLED === "true" && url.pathname.startsWith("/api/bangumi")) {
			return proxyBangumiApi(request, url);
		}

		if (env.KIRARI_BANGUMI_IMAGE_PROXY_ENABLED === "true" && url.pathname.startsWith("/images/bangumi")) {
			return proxyBangumiImage(url);
		}

		return new Response("Not found", { status: 404 });
	},
};

async function proxyGitHubCard(request: Request, url: URL): Promise<Response> {
	const upstream = new URL(url.pathname.replace("/api/github", "/api/github"), "https://api.github.com");
	upstream.search = url.search;
	const headers = new Headers(request.headers);
	headers.delete("host");
	return fetch(new Request(upstream, { method: request.method, headers, body: request.body }));
}

async function proxyAvatar(url: URL): Promise<Response> {
	const upstream = new URL(url.pathname.replace("/avatar", ""), "https://cravatar.cn");
	return fetch(upstream);
}

async function proxyBangumiApi(request: Request, url: URL): Promise<Response> {
	const upstream = new URL(url.pathname + url.search, "https://api.bgm.tv");
	const headers = new Headers(request.headers);
	headers.delete("host");
	return fetch(new Request(upstream, { method: request.method, headers, body: request.body }));
}

async function proxyBangumiImage(url: URL): Promise<Response> {
	const upstream = new URL(url.pathname, "https://lain.bgm.tv");
	return fetch(upstream);
}
