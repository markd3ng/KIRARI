import { DEFAULT_ROUTE_PREFIX } from "@kirari/edge-gateway-core";
import { createCloudflareGatewayHandler, type CloudflareGatewayEnv } from "./cloudflare-gateway.ts";

/**
 * KIRARI Edge worker entry point.
 *
 * Feature flags are controlled via `kirari.config.toml` [edge] section.
 * All features default to disabled — the worker is inert until explicitly enabled.
 */

export interface Env extends CloudflareGatewayEnv {
	KIRARI_EDGE_ENABLED?: string;
	KIRARI_GHCARD_ENABLED?: string;
	KIRARI_AVATAR_PROXY_ENABLED?: string;
	KIRARI_BANGUMI_API_PROXY_ENABLED?: string;
	KIRARI_BANGUMI_IMAGE_PROXY_ENABLED?: string;
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
	configureHeaders?: (headers: Headers, request: Request) => void;
};

const PROXY_ROUTES: ProxyRouteConfig[] = [
	{
		name: "github",
		flag: "KIRARI_GHCARD_ENABLED",
		prefix: "/api/github",
		origin: "https://api.github.com",
		cacheControl: "public, max-age=300, stale-while-revalidate=3600",
		configureHeaders(headers, request) {
			// This legacy suffix proxy stays anonymous; only named Gateway
			// operations can attach a token under the public-repository allowlist.
			headers.set("Accept", request.headers.get("accept") || "application/vnd.github+json");
			headers.set("X-GitHub-Api-Version", "2022-11-28");
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
		if (isGatewayPath(url.pathname)) {
			let gatewayHandler: ReturnType<typeof createCloudflareGatewayHandler>;
			try {
				// Use the platform-supplied request URL, never Origin/Host forwarding headers,
				// as the zone-owned origin for Cache API keys.
				gatewayHandler = createCloudflareGatewayHandler(env, { cacheKeyOrigin: url.origin });
			} catch (error) {
				console.error(
					JSON.stringify({
						event: "kirari_edge_gateway_configuration_failure",
						error_name: error instanceof Error ? error.name : "UnknownError",
					}),
				);
				return Response.json(
					{ error: "gateway_configuration_error" },
					{ status: 503, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } },
				);
			}
			// This is a same-origin Core route. Keep its exact-origin CORS decision;
			// the legacy wildcard CORS wrapper would weaken that boundary.
			try {
				return await gatewayHandler(request);
			} catch (error) {
				console.error(
					JSON.stringify({
						event: "kirari_edge_gateway_failure",
						error_name: error instanceof Error ? error.name : "UnknownError",
					}),
				);
				return Response.json(
					{ error: "gateway_internal_error" },
					{ status: 500, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } },
				);
			}
		}

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
			return await proxyRoute(route, request, url);
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

function isGatewayPath(pathname: string) {
	return pathname === DEFAULT_ROUTE_PREFIX || pathname.startsWith(`${DEFAULT_ROUTE_PREFIX}/`);
}

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
): Promise<Response> {
	const upstreamUrl = createUpstreamUrl(url, route.prefix, route.origin);
	if (!upstreamUrl) {
		return withCors(
			Response.json(
				{ error: "Invalid upstream path" },
				{ status: 400, headers: { "Cache-Control": "no-store" } },
			),
		);
	}
	const headers = createUpstreamHeaders(request);
	route.configureHeaders?.(headers, request);
	return proxyRequest(
		request,
		upstreamUrl,
		headers,
		route.cacheControl,
	);
}

function createUpstreamUrl(url: URL, prefix: string, origin: string): URL | null {
	const pathname = url.pathname.slice(prefix.length) || "/";
	const upstream = new URL(pathname, origin);
	if (upstream.origin !== new URL(origin).origin) return null;
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
