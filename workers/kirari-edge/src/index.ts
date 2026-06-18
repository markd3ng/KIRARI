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
	KIRARI_GITHUB_TOKEN?: string;
}

const ALLOWED_METHODS = "GET, HEAD, OPTIONS";
const FORWARDED_REQUEST_HEADERS = [
	"accept",
	"accept-language",
	"if-modified-since",
	"if-none-match",
	"range",
] as const;
const CORS_HEADERS = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Methods": ALLOWED_METHODS,
	"Access-Control-Allow-Headers":
		"Accept, Content-Type, If-Modified-Since, If-None-Match, Range",
	"Access-Control-Max-Age": "86400",
};

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		if (env.KIRARI_EDGE_ENABLED !== "true") {
			return new Response("Edge disabled", { status: 404 });
		}

		const url = new URL(request.url);
		const route = resolveRoute(url.pathname, env);
		if (!route) {
			return withCors(new Response("Not found", { status: 404 }));
		}

		if (request.method === "OPTIONS") {
			return new Response(null, { status: 204, headers: CORS_HEADERS });
		}
		if (request.method !== "GET" && request.method !== "HEAD") {
			return withCors(
				new Response("Method not allowed", {
					status: 405,
					headers: { Allow: ALLOWED_METHODS },
				}),
			);
		}

		try {
			switch (route) {
				case "github":
					return await proxyGitHubCard(request, url, env);
				case "avatar":
					return await proxyAvatar(request, url);
				case "bangumi-api":
					return await proxyBangumiApi(request, url);
				case "bangumi-image":
					return await proxyBangumiImage(request, url);
			}
		} catch (error) {
			console.error(
				JSON.stringify({
					event: "kirari_edge_upstream_failure",
					route,
					message: error instanceof Error ? error.message : "Unknown upstream error",
				}),
			);
			return withCors(
				Response.json(
					{ error: "Upstream request failed" },
					{ status: 502, headers: { "Cache-Control": "no-store" } },
				),
			);
		}
	},
};

type ProxyRoute = "github" | "avatar" | "bangumi-api" | "bangumi-image";

function resolveRoute(pathname: string, env: Env): ProxyRoute | null {
	if (env.KIRARI_GHCARD_ENABLED === "true" && matchesPrefix(pathname, "/api/github")) {
		return "github";
	}
	if (env.KIRARI_AVATAR_PROXY_ENABLED === "true" && matchesPrefix(pathname, "/avatar")) {
		return "avatar";
	}
	if (
		env.KIRARI_BANGUMI_API_PROXY_ENABLED === "true" &&
		matchesPrefix(pathname, "/api/bangumi")
	) {
		return "bangumi-api";
	}
	if (
		env.KIRARI_BANGUMI_IMAGE_PROXY_ENABLED === "true" &&
		matchesPrefix(pathname, "/images/bangumi")
	) {
		return "bangumi-image";
	}
	return null;
}

function matchesPrefix(pathname: string, prefix: string) {
	return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

async function proxyGitHubCard(request: Request, url: URL, env: Env): Promise<Response> {
	const headers = createUpstreamHeaders(request);
	headers.set("Accept", request.headers.get("accept") || "application/vnd.github+json");
	headers.set("X-GitHub-Api-Version", "2022-11-28");
	if (env.KIRARI_GITHUB_TOKEN) {
		headers.set("Authorization", `Bearer ${env.KIRARI_GITHUB_TOKEN}`);
	}
	return proxyRequest(
		request,
		createUpstreamUrl(url, "/api/github", "https://api.github.com"),
		headers,
		"public, max-age=300, stale-while-revalidate=3600",
	);
}

async function proxyAvatar(request: Request, url: URL): Promise<Response> {
	return proxyRequest(
		request,
		createUpstreamUrl(url, "/avatar", "https://cravatar.cn"),
		createUpstreamHeaders(request),
		"public, max-age=86400, stale-while-revalidate=604800",
	);
}

async function proxyBangumiApi(request: Request, url: URL): Promise<Response> {
	return proxyRequest(
		request,
		createUpstreamUrl(url, "/api/bangumi", "https://api.bgm.tv"),
		createUpstreamHeaders(request),
		"public, max-age=300, stale-while-revalidate=3600",
	);
}

async function proxyBangumiImage(request: Request, url: URL): Promise<Response> {
	return proxyRequest(
		request,
		createUpstreamUrl(url, "/images/bangumi", "https://lain.bgm.tv"),
		createUpstreamHeaders(request),
		"public, max-age=86400, stale-while-revalidate=604800",
	);
}

function createUpstreamUrl(url: URL, prefix: string, origin: string) {
	const pathname = url.pathname.slice(prefix.length) || "/";
	const upstream = new URL(pathname, origin);
	upstream.search = url.search;
	return upstream;
}

function createUpstreamHeaders(request: Request) {
	const headers = new Headers();
	for (const name of FORWARDED_REQUEST_HEADERS) {
		const value = request.headers.get(name);
		if (value) headers.set(name, value);
	}
	return headers;
}

async function proxyRequest(
	request: Request,
	upstreamUrl: URL,
	headers: Headers,
	cacheControl: string,
) {
	const upstreamResponse = await fetch(
		new Request(upstreamUrl, {
			method: request.method,
			headers,
		}),
	);
	const responseHeaders = new Headers(upstreamResponse.headers);
	responseHeaders.set("Cache-Control", cacheControl);
	for (const [name, value] of Object.entries(CORS_HEADERS)) {
		responseHeaders.set(name, value);
	}
	return new Response(upstreamResponse.body, {
		status: upstreamResponse.status,
		statusText: upstreamResponse.statusText,
		headers: responseHeaders,
	});
}

function withCors(response: Response) {
	const headers = new Headers(response.headers);
	for (const [name, value] of Object.entries(CORS_HEADERS)) {
		headers.set(name, value);
	}
	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers,
	});
}
