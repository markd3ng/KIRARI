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

type ProxyRouteName = "github" | "avatar" | "bangumi-api" | "bangumi-image";
type ProxyRouteConfig = {
	name: ProxyRouteName;
	flag: keyof Env;
	prefix: string;
	origin: string;
	cacheControl: string;
	configureHeaders?: (headers: Headers, request: Request, env: Env) => void;
};

const PROXY_ROUTES: ProxyRouteConfig[] = [
	{
		name: "github",
		flag: "KIRARI_GHCARD_ENABLED",
		prefix: "/api/github",
		origin: "https://api.github.com",
		cacheControl: "public, max-age=300, stale-while-revalidate=3600",
		configureHeaders(headers, request, env) {
			headers.set("Accept", request.headers.get("accept") || "application/vnd.github+json");
			headers.set("X-GitHub-Api-Version", "2022-11-28");
			if (env.KIRARI_GITHUB_TOKEN) {
				headers.set("Authorization", `Bearer ${env.KIRARI_GITHUB_TOKEN}`);
			}
		},
	},
	{
		name: "avatar",
		flag: "KIRARI_AVATAR_PROXY_ENABLED",
		prefix: "/avatar",
		origin: "https://cravatar.cn",
		cacheControl: "public, max-age=86400, stale-while-revalidate=604800",
	},
	{
		name: "bangumi-api",
		flag: "KIRARI_BANGUMI_API_PROXY_ENABLED",
		prefix: "/api/bangumi",
		origin: "https://api.bgm.tv",
		cacheControl: "public, max-age=300, stale-while-revalidate=3600",
	},
	{
		name: "bangumi-image",
		flag: "KIRARI_BANGUMI_IMAGE_PROXY_ENABLED",
		prefix: "/images/bangumi",
		origin: "https://lain.bgm.tv",
		cacheControl: "public, max-age=86400, stale-while-revalidate=604800",
	},
];

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
			return await proxyRoute(route, request, url, env);
		} catch (error) {
			console.error(
				JSON.stringify({
					event: "kirari_edge_upstream_failure",
					route: route.name,
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

function resolveRoute(pathname: string, env: Env): ProxyRouteConfig | null {
	return PROXY_ROUTES.find((route) => env[route.flag] === "true" && matchesPrefix(pathname, route.prefix)) || null;
}

function matchesPrefix(pathname: string, prefix: string) {
	return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

async function proxyRoute(
	route: ProxyRouteConfig,
	request: Request,
	url: URL,
	env: Env,
): Promise<Response> {
	const headers = createUpstreamHeaders(request);
	route.configureHeaders?.(headers, request, env);
	return proxyRequest(
		request,
		createUpstreamUrl(url, route.prefix, route.origin),
		headers,
		route.cacheControl,
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
