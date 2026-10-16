export const DEFAULT_ROUTE_PREFIX = "/_kirari/edge";

const GITHUB_API_ORIGIN = "https://api.github.com";
const GITHUB_AVATAR_ORIGIN = "https://github.com";
const GITHUB_AVATAR_REDIRECT_ORIGIN = "https://avatars.githubusercontent.com";
const BANGUMI_API_ORIGIN = "https://api.bgm.tv";
const GITHUB_API_VERSION = "2022-11-28";
const USER_AGENT = "KIRARI-Edge-Gateway";
const UPSTREAM_TIMEOUT_MS = 8_000;
const DEFAULT_AVATAR_SIZE = 96;
const MAX_REQUEST_URL_LENGTH = 4_096;
const MAX_JSON_RESPONSE_BYTES = 1_000_000;
const MAX_AVATAR_RESPONSE_BYTES = 512_000;
const MAX_PATH_LENGTH = 512;
const MAX_PATH_SEGMENTS = 64;
const MAX_NAME_LENGTH = 100;
const MAX_REF_LENGTH = 256;
const MAX_TOKEN_LENGTH = 4_096;

export type CacheLevel = "CACHE_NONE" | "CACHE_EDGE" | "CACHE_PERSISTENT";
export type GatewayMode = "integrated" | "standalone";
export type GatewayCacheState = "BYPASS" | "MISS" | "HIT" | "STALE";

export type GatewayOperation =
	| { kind: "github.repository"; owner: string; repo: string }
	| { kind: "github.contents"; owner: string; repo: string; path: string; ref?: string }
	| { kind: "github.latestCommit"; owner: string; repo: string; path: string; sha?: string }
	| { kind: "github.avatar"; owner: string; size: number }
	| { kind: "bangumi.userCollections"; userId: string }
	| { kind: "health" };

export type CacheEntry = {
	status: 200 | 404;
	headers: Readonly<Record<string, string>>;
	body: Uint8Array;
	freshUntil: number;
	staleUntil: number;
};

export interface EdgeCache {
	/** Edge cache scope is adapter-defined and may be local to a PoP or region. */
	readonly consistency: "edge-local" | "provider-defined";
	get(key: string): Promise<CacheEntry | null>;
	put(key: string, entry: CacheEntry): Promise<void>;
}

export interface PersistentCache {
	/** Persistent adapters must expose their real consistency model. */
	readonly consistency: "strong" | "eventual" | "provider-defined";
	get(key: string): Promise<CacheEntry | null>;
	put(key: string, entry: CacheEntry): Promise<void>;
}

export type GatewayFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export type GatewayOptions = {
	mode?: GatewayMode;
	routePrefix?: string;
	allowedOrigins?: readonly string[];
	fetch?: GatewayFetch;
	getGitHubToken?: () => string | undefined;
	/** Only repositories confirmed public and intentionally allowed may use the token. */
	githubTokenPublicRepositories?: readonly string[];
	cacheLevel?: CacheLevel;
	edgeCache?: EdgeCache;
	persistentCache?: PersistentCache;
	now?: () => number;
};

type RouteResult =
	| { ok: true; operation: GatewayOperation }
	| { ok: false; status: 400 | 404; error: "invalid_request" | "not_found" };

type CorsDecision = { allowed: true; headers: Headers } | { allowed: false };
type CachePolicy = { freshSeconds: number; staleSeconds: number };
type TimedResponse = { response: Response; timedOut: () => boolean; cleanup: () => void };
type UpstreamResult =
	| { ok: true; entry: CacheEntry }
	| { ok: false; status: number; error: string; headers: Record<string, string> };

class BodyTooLargeError extends Error {}
class InvalidUpstreamContentError extends Error {}
class UnsafeRedirectError extends Error {}
class UpstreamTimeoutError extends Error {}

/**
 * Creates a provider-neutral Gateway handler. Adapters supply Web-compatible
 * fetch, secret access, and explicitly named cache capabilities.
 */
export function createGatewayHandler(options: GatewayOptions = {}) {
	const mode = options.mode ?? "integrated";
	const routePrefix = options.routePrefix ?? DEFAULT_ROUTE_PREFIX;
	const cacheLevel = options.cacheLevel ?? "CACHE_NONE";
	const fetcher = options.fetch ?? globalThis.fetch.bind(globalThis);
	const now = options.now ?? Date.now;
	const publicRepositories = new Set(
		(options.githubTokenPublicRepositories ?? []).map((repository) => repository.toLowerCase()),
	);
	const allowedOrigins = normalizeAllowedOrigins(options.allowedOrigins ?? []);

	if (mode !== "integrated" && mode !== "standalone") {
		throw new TypeError("Unsupported Gateway mode.");
	}
	if (!/^\/[A-Za-z0-9/_-]+$/.test(routePrefix) || routePrefix.startsWith("//") || routePrefix.endsWith("/")) {
		throw new TypeError("Gateway route prefix must be a fixed absolute path without a trailing slash.");
	}
	if (cacheLevel !== "CACHE_NONE" && cacheLevel !== "CACHE_EDGE" && cacheLevel !== "CACHE_PERSISTENT") {
		throw new TypeError("Unsupported Gateway cache level.");
	}
	if (typeof fetcher !== "function") throw new TypeError("Gateway fetch must be a function.");
	if (options.getGitHubToken && publicRepositories.size === 0) {
		throw new TypeError("A GitHub token getter requires an explicit public repository allowlist.");
	}
	if (mode === "standalone" && allowedOrigins.size === 0) {
		throw new TypeError("Standalone mode requires at least one exact allowed origin.");
	}

	return async function handleGatewayRequest(request: Request): Promise<Response> {
		let url: URL;
		try {
			if (request.url.length > MAX_REQUEST_URL_LENGTH) {
				return errorResponse(400, "invalid_request", new Headers());
			}
			url = new URL(request.url);
		} catch {
			return errorResponse(400, "invalid_request", new Headers());
		}

		const cors = getCorsDecision(request, url, mode, allowedOrigins);
		if (!cors.allowed) return errorResponse(403, "origin_not_allowed", new Headers());

		const parsed = parseOperation(url, routePrefix);
		if (!parsed.ok) return errorResponse(parsed.status, parsed.error, cors.headers);

		if (request.method === "OPTIONS") {
			const requestedMethod = request.headers.get("access-control-request-method");
			if (requestedMethod && requestedMethod !== "GET" && requestedMethod !== "HEAD") {
				return errorResponse(405, "method_not_allowed", cors.headers, "BYPASS");
			}
			const headers = new Headers(cors.headers);
			headers.set("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
			headers.set("Access-Control-Allow-Headers", "Accept");
			headers.set("Access-Control-Max-Age", "86400");
			headers.set("Cache-Control", "no-store");
			headers.set("X-Kirari-Cache-Level", "CACHE_NONE");
			return new Response(null, { status: 204, headers });
		}

		if (request.method !== "GET" && request.method !== "HEAD") {
			return errorResponse(405, "method_not_allowed", cors.headers, "BYPASS", {
				Allow: "GET, HEAD, OPTIONS",
			});
		}
		if (request.body !== null) return errorResponse(400, "request_body_not_allowed", cors.headers);

		if (parsed.operation.kind === "health") {
			const response = new Response("ok", {
				status: 200,
				headers: baseResponseHeaders(cors.headers, "CACHE_NONE", "BYPASS", "text/plain; charset=utf-8"),
			});
			return request.method === "HEAD" ? headResponse(response) : response;
		}

		const response = await handleOperation(request, url, parsed.operation, {
			fetcher,
			getGitHubToken: options.getGitHubToken,
			publicRepositories,
			cacheLevel,
			edgeCache: options.edgeCache,
			persistentCache: options.persistentCache,
			routePrefix,
			now,
			corsHeaders: cors.headers,
		});
		return request.method === "HEAD" ? headResponse(response) : response;
	};
}

async function handleOperation(
	request: Request,
	requestUrl: URL,
	operation: Exclude<GatewayOperation, { kind: "health" }>,
	context: {
		fetcher: GatewayFetch;
		getGitHubToken?: () => string | undefined;
		publicRepositories: Set<string>;
		cacheLevel: CacheLevel;
		edgeCache?: EdgeCache;
		persistentCache?: PersistentCache;
		routePrefix: string;
		now: () => number;
		corsHeaders: Headers;
	},
): Promise<Response> {
	const key = buildCacheKey(operation, requestUrl.origin, context.routePrefix);
	let store: EdgeCache | PersistentCache | undefined;
	let effectiveCacheLevel: CacheLevel = "CACHE_NONE";
	if (context.cacheLevel === "CACHE_EDGE" && context.edgeCache) {
		store = context.edgeCache;
		effectiveCacheLevel = "CACHE_EDGE";
	} else if (context.cacheLevel === "CACHE_PERSISTENT" && context.persistentCache) {
		store = context.persistentCache;
		effectiveCacheLevel = "CACHE_PERSISTENT";
	}

	let cached: CacheEntry | null = null;
	if (store) {
		try {
			const candidate = await store.get(key);
			if (isValidCacheEntry(candidate, operation, context.now())) cached = candidate;
		} catch {
			store = undefined;
			effectiveCacheLevel = "CACHE_NONE";
		}
	}

	const currentTime = context.now();
	if (cached && cached.freshUntil > currentTime) {
		return entryResponse(cached, context.corsHeaders, effectiveCacheLevel, "HIT");
	}
	const stale = cached && cached.staleUntil > currentTime ? cached : null;

	let upstream: UpstreamResult;
	try {
		upstream = await fetchUpstream(request, requestUrl, operation, context);
	} catch {
		upstream = { ok: false, status: 502, error: "upstream_unavailable", headers: {} };
	}

	if (!upstream.ok) {
		if (stale) return entryResponse(stale, context.corsHeaders, effectiveCacheLevel, "STALE");
		return errorResponse(upstream.status, upstream.error, context.corsHeaders, "BYPASS", upstream.headers, effectiveCacheLevel);
	}

	const policy = getCachePolicy(operation, upstream.entry.status);
	const entry: CacheEntry = {
		...upstream.entry,
		freshUntil: context.now() + policy.freshSeconds * 1_000,
		staleUntil: context.now() + (policy.freshSeconds + policy.staleSeconds) * 1_000,
	};

	if (store) {
		try {
			await store.put(key, cloneCacheEntry(entry));
		} catch {
			store = undefined;
			effectiveCacheLevel = "CACHE_NONE";
		}
	}

	return entryResponse(
		entry,
		context.corsHeaders,
		effectiveCacheLevel,
		effectiveCacheLevel === "CACHE_NONE" ? "BYPASS" : "MISS",
	);
}

async function fetchUpstream(
	request: Request,
	requestUrl: URL,
	operation: Exclude<GatewayOperation, { kind: "health" }>,
	context: {
		fetcher: GatewayFetch;
		getGitHubToken?: () => string | undefined;
		publicRepositories: Set<string>;
		routePrefix: string;
	},
): Promise<UpstreamResult> {
	let upstreamUrl = buildUpstreamUrl(operation);
	const headers = buildUpstreamHeaders(operation);
	if (isGitHubRestOperation(operation) && context.getGitHubToken && isTokenAllowed(operation, context.publicRepositories)) {
		let token: string | undefined;
		try {
			token = context.getGitHubToken();
		} catch {
			return { ok: false, status: 503, error: "gateway_configuration_error", headers: {} };
		}
		if (token) {
			if (token.length > MAX_TOKEN_LENGTH || /[\r\n\u0000]/.test(token)) {
				return { ok: false, status: 503, error: "gateway_configuration_error", headers: {} };
			}
			headers.set("Authorization", `Bearer ${token}`);
		}
	}

	let timedResponse: TimedResponse;
	try {
		timedResponse = await fetchWithTimeout(context.fetcher, upstreamUrl, headers, request.signal);
	} catch (error) {
		return error instanceof UpstreamTimeoutError
			? { ok: false, status: 504, error: "upstream_timeout", headers: {} }
			: { ok: false, status: 502, error: "upstream_unavailable", headers: {} };
	}

	try {
		let upstream = timedResponse.response;
		if (isRedirect(upstream.status)) {
			if (operation.kind !== "github.avatar" || upstream.status === 304) {
				return { ok: false, status: 502, error: "upstream_redirect_rejected", headers: safeUpstreamHeaders(upstream.headers) };
			}
			const location = upstream.headers.get("location");
			if (!location) return { ok: false, status: 502, error: "upstream_redirect_rejected", headers: {} };
			let redirectUrl: URL;
			try {
				redirectUrl = new URL(location, upstreamUrl);
			} catch {
				return { ok: false, status: 502, error: "upstream_redirect_rejected", headers: {} };
			}
			if (!isAllowedAvatarRedirect(redirectUrl)) {
				return { ok: false, status: 502, error: "upstream_redirect_rejected", headers: {} };
			}
			await upstream.body?.cancel();
			timedResponse.cleanup();
			upstreamUrl = redirectUrl;
			try {
				timedResponse = await fetchWithTimeout(context.fetcher, upstreamUrl, buildUpstreamHeaders(operation), request.signal);
			} catch (error) {
				return error instanceof UpstreamTimeoutError
					? { ok: false, status: 504, error: "upstream_timeout", headers: {} }
					: { ok: false, status: 502, error: "upstream_unavailable", headers: {} };
			}
			upstream = timedResponse.response;
			if (isRedirect(upstream.status)) {
				return { ok: false, status: 502, error: "upstream_redirect_rejected", headers: {} };
			}
		}

		const safeHeaders = safeUpstreamHeaders(upstream.headers);
		if (upstream.status === 404) {
			return {
				ok: true,
				entry: {
					status: 404,
					headers: { "content-type": "application/json; charset=utf-8", ...safeHeaders },
					body: new TextEncoder().encode(JSON.stringify({ error: "not_found" })),
					freshUntil: 0,
					staleUntil: 0,
				},
			};
		}
		if (upstream.status !== 200) {
			if (upstream.status === 403 || upstream.status === 429) {
				return { ok: false, status: 429, error: "upstream_rate_limited", headers: safeHeaders };
			}
			if (upstream.status >= 500) return { ok: false, status: 502, error: "upstream_unavailable", headers: safeHeaders };
			return { ok: false, status: 502, error: "upstream_rejected", headers: safeHeaders };
		}

		const contentType = upstream.headers.get("content-type");
		if (!contentType || !isExpectedContentType(operation, contentType)) {
			return { ok: false, status: 502, error: "upstream_invalid_response", headers: safeHeaders };
		}

		let body: Uint8Array;
		const maxBodyBytes = operation.kind === "github.avatar" ? MAX_AVATAR_RESPONSE_BYTES : MAX_JSON_RESPONSE_BYTES;
		try {
			body = await readBoundedBody(upstream, maxBodyBytes);
			if (operation.kind === "github.repository") {
				body = rewriteRepositoryAvatar(body, requestUrl.origin, context.routePrefix);
			} else if (operation.kind !== "github.avatar") {
				try {
					JSON.parse(new TextDecoder().decode(body));
				} catch {
					throw new InvalidUpstreamContentError();
				}
			}
		} catch (error) {
			if (timedResponse.timedOut()) {
				return { ok: false, status: 504, error: "upstream_timeout", headers: safeHeaders };
			}
			if (error instanceof BodyTooLargeError || error instanceof InvalidUpstreamContentError) {
				return { ok: false, status: 502, error: "upstream_invalid_response", headers: safeHeaders };
			}
			return { ok: false, status: 502, error: "upstream_unavailable", headers: safeHeaders };
		}

		// Repository avatar rewriting can enlarge an otherwise bounded upstream JSON body.
		if (body.byteLength > maxBodyBytes) {
			return { ok: false, status: 502, error: "upstream_invalid_response", headers: safeHeaders };
		}

		return {
			ok: true,
			entry: {
				status: 200,
				headers: { "content-type": contentType, ...safeHeaders },
				body,
				freshUntil: 0,
				staleUntil: 0,
			},
		};
	} finally {
		cancelResponseBody(timedResponse.response);
		timedResponse.cleanup();
	}
}

async function fetchWithTimeout(
	fetcher: GatewayFetch,
	url: URL,
	headers: Headers,
	requestSignal: AbortSignal,
): Promise<TimedResponse> {
	const controller = new AbortController();
	let timedOut = false;
	const abortFromRequest = () => controller.abort(requestSignal.reason);
	if (requestSignal.aborted) abortFromRequest();
	else requestSignal.addEventListener("abort", abortFromRequest, { once: true });
	const timeout = setTimeout(() => {
		timedOut = true;
		controller.abort();
	}, UPSTREAM_TIMEOUT_MS);
	const cleanup = () => {
		clearTimeout(timeout);
		requestSignal.removeEventListener("abort", abortFromRequest);
	};
	try {
		const response = await fetcher(url, {
			method: "GET",
			headers,
			redirect: "manual",
			signal: controller.signal,
		});
		return { response, timedOut: () => timedOut, cleanup };
	} catch (error) {
		cleanup();
		if (timedOut) throw new UpstreamTimeoutError();
		throw error;
	}
}

function cancelResponseBody(response: Response) {
	try {
		void response.body?.cancel().catch(() => undefined);
	} catch {
		// The body may already be consumed or locked by the bounded reader.
	}
}

function buildUpstreamUrl(operation: Exclude<GatewayOperation, { kind: "health" }>): URL {
	if (operation.kind === "github.repository") {
		return new URL(`/repos/${encodeURIComponent(operation.owner)}/${encodeURIComponent(operation.repo)}`, GITHUB_API_ORIGIN);
	}
	if (operation.kind === "github.contents") {
		const path = operation.path.split("/").map(encodeURIComponent).join("/");
		const url = new URL(
			`/repos/${encodeURIComponent(operation.owner)}/${encodeURIComponent(operation.repo)}/contents/${path}`,
			GITHUB_API_ORIGIN,
		);
		if (operation.ref) url.searchParams.set("ref", operation.ref);
		return url;
	}
	if (operation.kind === "github.latestCommit") {
		const url = new URL(
			`/repos/${encodeURIComponent(operation.owner)}/${encodeURIComponent(operation.repo)}/commits`,
			GITHUB_API_ORIGIN,
		);
		url.searchParams.set("path", operation.path);
		url.searchParams.set("per_page", "1");
		if (operation.sha) url.searchParams.set("sha", operation.sha);
		return url;
	}
	if (operation.kind === "github.avatar") {
		const url = new URL(`/${encodeURIComponent(operation.owner)}.png`, GITHUB_AVATAR_ORIGIN);
		url.searchParams.set("size", String(operation.size));
		return url;
	}
	const url = new URL(
		`/v0/users/${encodeURIComponent(operation.userId)}/collections`,
		BANGUMI_API_ORIGIN,
	);
	url.searchParams.set("limit", "24");
	return url;
}

function buildUpstreamHeaders(operation: Exclude<GatewayOperation, { kind: "health" }>): Headers {
	const headers = new Headers({ "User-Agent": USER_AGENT });
	if (operation.kind === "github.avatar") {
		headers.set("Accept", "image/png,image/*;q=0.8,*/*;q=0.5");
	} else if (operation.kind === "bangumi.userCollections") {
		headers.set("Accept", "application/json");
	} else {
		headers.set("Accept", "application/vnd.github+json");
		headers.set("X-GitHub-Api-Version", GITHUB_API_VERSION);
	}
	return headers;
}

function parseOperation(url: URL, routePrefix: string): RouteResult {
	if (url.pathname === `${routePrefix}/healthz`) {
		if (url.search) return invalidRequest();
		return { ok: true, operation: { kind: "health" } };
	}
	if (!url.pathname.startsWith(`${routePrefix}/`)) return { ok: false, status: 404, error: "not_found" };

	const rawSegments = url.pathname.slice(routePrefix.length + 1).split("/");
	const segments: string[] = [];
	try {
		for (const segment of rawSegments) segments.push(decodeURIComponent(segment));
	} catch {
		return invalidRequest();
	}
	if (segments.some((segment) => segment.includes("/") || segment.includes("\\") || /[\u0000-\u001f\u007f]/.test(segment))) {
		return invalidRequest();
	}

	const [provider, operation, ...args] = segments;
	if (provider === "github" && operation === "repository") {
		if (args.length !== 2 || !noQuery(url)) return invalidRequestOrNotFound(args.length === 2);
		if (!isValidName(args[0]) || !isValidName(args[1])) return invalidRequest();
		return { ok: true, operation: { kind: "github.repository", owner: args[0], repo: args[1] } };
	}
	if (provider === "github" && operation === "contents") {
		if (args.length < 3 || args.length > MAX_PATH_SEGMENTS + 2) return invalidRequestOrNotFound(args.length >= 3);
		if (!hasOnlyQuery(url, ["ref"])) return invalidRequest();
		const [owner, repo, ...pathSegments] = args;
		const path = pathSegments.join("/");
		if (!isValidName(owner) || !isValidName(repo) || !isValidPath(path)) return invalidRequest();
		const ref = url.searchParams.get("ref") ?? undefined;
		if (ref !== undefined && !isValidRef(ref)) return invalidRequest();
		return { ok: true, operation: ref ? { kind: "github.contents", owner, repo, path, ref } : { kind: "github.contents", owner, repo, path } };
	}
	if (provider === "github" && operation === "latest-commit") {
		if (args.length !== 2) return { ok: false, status: 404, error: "not_found" };
		if (!hasOnlyQuery(url, ["path", "sha"])) return invalidRequest();
		const [owner, repo] = args;
		const path = url.searchParams.get("path") ?? "";
		const sha = url.searchParams.get("sha") ?? undefined;
		if (!isValidName(owner) || !isValidName(repo) || !isValidPath(path) || (sha !== undefined && !isValidRef(sha))) {
			return invalidRequest();
		}
		return { ok: true, operation: sha ? { kind: "github.latestCommit", owner, repo, path, sha } : { kind: "github.latestCommit", owner, repo, path } };
	}
	if (provider === "github" && operation === "avatar") {
		if (args.length !== 1) return invalidRequestOrNotFound(args.length === 1);
		if (!hasOnlyQuery(url, ["size"])) return invalidRequest();
		const sizeText = url.searchParams.get("size") ?? String(DEFAULT_AVATAR_SIZE);
		const size = /^\d{1,3}$/.test(sizeText) ? Number(sizeText) : Number.NaN;
		if (!isValidName(args[0]) || !Number.isInteger(size) || size < 16 || size > 256) return invalidRequest();
		return { ok: true, operation: { kind: "github.avatar", owner: args[0], size } };
	}
	if (provider === "bangumi" && operation === "user-collections") {
		if (args.length !== 1) return invalidRequestOrNotFound(args.length === 1);
		if (!noQuery(url) || !/^[A-Za-z0-9_-]{1,64}$/.test(args[0])) return invalidRequest();
		return { ok: true, operation: { kind: "bangumi.userCollections", userId: args[0] } };
	}
	return { ok: false, status: 404, error: "not_found" };
}

function noQuery(url: URL) {
	return url.search === "";
}

function hasOnlyQuery(url: URL, allowed: readonly string[]): boolean {
	const allowedSet = new Set(allowed);
	const seen = new Set<string>();
	for (const key of url.searchParams.keys()) {
		if (!allowedSet.has(key) || seen.has(key) || url.searchParams.getAll(key).length !== 1) return false;
		seen.add(key);
	}
	return true;
}

function invalidRequest(): RouteResult {
	return { ok: false, status: 400, error: "invalid_request" };
}

function invalidRequestOrNotFound(isKnownOperation: boolean): RouteResult {
	return isKnownOperation ? invalidRequest() : { ok: false, status: 404, error: "not_found" };
}

function isValidName(value: string | undefined): value is string {
	return (
		typeof value === "string" &&
		value.length > 0 &&
		value.length <= MAX_NAME_LENGTH &&
		value !== "." &&
		value !== ".." &&
		/^[A-Za-z0-9_.-]+$/.test(value)
	);
}

function isValidPath(path: string): boolean {
	if (!path || path.length > MAX_PATH_LENGTH || /[\u0000-\u001f\u007f\\%]/.test(path)) return false;
	const segments = path.split("/");
	return (
		segments.length <= MAX_PATH_SEGMENTS &&
		segments.every((segment) => segment.length > 0 && segment !== "." && segment !== ".." && segment.length <= 255)
	);
}

function isValidRef(value: string): boolean {
	return value.length > 0 && value.length <= MAX_REF_LENGTH && /^[A-Za-z0-9._/+@~-]+$/.test(value);
}

function isGitHubRestOperation(
	operation: Exclude<GatewayOperation, { kind: "health" }>,
): operation is Extract<GatewayOperation, { kind: "github.repository" | "github.contents" | "github.latestCommit" }> {
	return operation.kind === "github.repository" || operation.kind === "github.contents" || operation.kind === "github.latestCommit";
}

function isTokenAllowed(
	operation: Extract<GatewayOperation, { kind: "github.repository" | "github.contents" | "github.latestCommit" }>,
	publicRepositories: Set<string>,
) {
	return publicRepositories.has(`${operation.owner}/${operation.repo}`.toLowerCase());
}

function isRedirect(status: number) {
	return status >= 300 && status < 400;
}

function isAllowedAvatarRedirect(url: URL) {
	return (
		url.protocol === "https:" &&
		url.origin === GITHUB_AVATAR_REDIRECT_ORIGIN &&
		!url.username &&
		!url.password &&
		url.port === "" &&
		url.pathname.startsWith("/u/") &&
		url.href.length <= MAX_REQUEST_URL_LENGTH
	);
}

function safeUpstreamHeaders(headers: Headers): Record<string, string> {
	const result: Record<string, string> = {};
	for (const key of ["etag", "last-modified"] as const) {
		const value = headers.get(key);
		if (value && value.length <= 1_024 && !/[\r\n\u0000]/.test(value)) result[key] = value;
	}
	for (const [source, target] of [
		["x-ratelimit-limit", "x-upstream-ratelimit-limit"],
		["x-ratelimit-remaining", "x-upstream-ratelimit-remaining"],
		["x-ratelimit-reset", "x-upstream-ratelimit-reset"],
	] as const) {
		const value = headers.get(source);
		if (value && /^\d{1,12}$/.test(value)) result[target] = value;
	}
	return result;
}

function isExpectedContentType(operation: Exclude<GatewayOperation, { kind: "health" }>, contentType: string) {
	const normalized = contentType.toLowerCase();
	if (operation.kind === "github.avatar") return /^image\/(png|jpeg|gif|webp|avif)(;|$)/.test(normalized);
	return isJsonContentType(normalized);
}

function isJsonContentType(contentType: string) {
	return /^application\/(json|[a-z0-9.+-]+\+json)(;|$)/i.test(contentType);
}

async function readBoundedBody(response: Response, maxBytes: number): Promise<Uint8Array> {
	const contentLength = response.headers.get("content-length");
	if (contentLength && /^\d+$/.test(contentLength) && Number(contentLength) > maxBytes) {
		await response.body?.cancel();
		throw new BodyTooLargeError();
	}
	if (!response.body) return new Uint8Array();

	const reader = response.body.getReader();
	const chunks: Uint8Array[] = [];
	let byteLength = 0;
	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			byteLength += value.byteLength;
			if (byteLength > maxBytes) {
				await reader.cancel();
				throw new BodyTooLargeError();
			}
			chunks.push(value);
		}
	} finally {
		reader.releaseLock();
	}

	const result = new Uint8Array(byteLength);
	let offset = 0;
	for (const chunk of chunks) {
		result.set(chunk, offset);
		offset += chunk.byteLength;
	}
	return result;
}

function rewriteRepositoryAvatar(body: Uint8Array, requestOrigin: string, routePrefix: string): Uint8Array {
	let parsed: unknown;
	try {
		parsed = JSON.parse(new TextDecoder().decode(body));
	} catch {
		throw new InvalidUpstreamContentError();
	}
	if (!isRecord(parsed) || !isRecord(parsed.owner) || typeof parsed.owner.login !== "string") return body;
	const owner = parsed.owner.login;
	if (!isValidName(owner)) return body;
	parsed.owner.avatar_url = `${requestOrigin}${routePrefix}/github/avatar/${encodeURIComponent(owner)}?size=${DEFAULT_AVATAR_SIZE}`;
	return new TextEncoder().encode(JSON.stringify(parsed));
}

function getCachePolicy(operation: Exclude<GatewayOperation, { kind: "health" }>, status: 200 | 404): CachePolicy {
	if (status === 404) return { freshSeconds: 600, staleSeconds: 86_400 };
	if (operation.kind === "github.repository") return { freshSeconds: 21_600, staleSeconds: 604_800 };
	if (operation.kind === "github.contents") return { freshSeconds: 86_400, staleSeconds: 1_209_600 };
	if (operation.kind === "github.latestCommit") return { freshSeconds: 3_600, staleSeconds: 604_800 };
	if (operation.kind === "github.avatar") return { freshSeconds: 604_800, staleSeconds: 2_592_000 };
	return { freshSeconds: 300, staleSeconds: 3_600 };
}

function buildCacheKey(
	operation: Exclude<GatewayOperation, { kind: "health" }>,
	requestOrigin: string,
	routePrefix: string,
) {
	const cacheIdentity = operation.kind === "github.repository"
		? { ...operation, requestOrigin, routePrefix }
		: operation;
	return `kirari-edge:v1:${encodeURIComponent(JSON.stringify(cacheIdentity))}`;
}

function isValidCacheEntry(
	entry: CacheEntry | null,
	operation: Exclude<GatewayOperation, { kind: "health" }>,
	now: number,
): entry is CacheEntry {
	if (!entry || (entry.status !== 200 && entry.status !== 404) || !(entry.body instanceof Uint8Array)) return false;
	const maxBytes = operation.kind === "github.avatar" ? MAX_AVATAR_RESPONSE_BYTES : MAX_JSON_RESPONSE_BYTES;
	if (entry.body.byteLength > maxBytes || !Number.isFinite(entry.freshUntil) || !Number.isFinite(entry.staleUntil)) return false;
	if (entry.staleUntil < entry.freshUntil || entry.staleUntil <= now || !isRecord(entry.headers)) return false;
	for (const [key, value] of Object.entries(entry.headers)) {
		if (!/^(content-type|etag|last-modified|x-upstream-ratelimit-(limit|remaining|reset))$/.test(key)) return false;
		if (typeof value !== "string" || value.length > 1_024 || /[\r\n\u0000]/.test(value)) return false;
	}
	const contentType = entry.headers["content-type"];
	if (typeof contentType !== "string") return false;
	if (entry.status === 404 ? !isJsonContentType(contentType) : !isExpectedContentType(operation, contentType)) return false;
	if (operation.kind !== "github.avatar" || entry.status === 404) {
		try {
			JSON.parse(new TextDecoder().decode(entry.body));
		} catch {
			return false;
		}
	}
	return true;
}

function cloneCacheEntry(entry: CacheEntry): CacheEntry {
	return {
		status: entry.status,
		headers: { ...entry.headers },
		body: entry.body.slice(),
		freshUntil: entry.freshUntil,
		staleUntil: entry.staleUntil,
	};
}

function entryResponse(entry: CacheEntry, corsHeaders: Headers, cacheLevel: CacheLevel, state: GatewayCacheState) {
	const headers = baseResponseHeaders(corsHeaders, cacheLevel, state, entry.headers["content-type"]);
	for (const key of ["etag", "last-modified", "x-upstream-ratelimit-limit", "x-upstream-ratelimit-remaining", "x-upstream-ratelimit-reset"]) {
		const value = entry.headers[key];
		if (value) headers.set(key, value);
	}
	return new Response(toArrayBuffer(entry.body), { status: entry.status, headers });
}

function errorResponse(
	status: number,
	error: string,
	corsHeaders: Headers,
	cacheState: GatewayCacheState = "BYPASS",
	additionalHeaders: HeadersInit = {},
	cacheLevel: CacheLevel = "CACHE_NONE",
) {
	const headers = baseResponseHeaders(corsHeaders, cacheLevel, cacheState, "application/json; charset=utf-8");
	for (const [key, value] of new Headers(additionalHeaders)) headers.set(key, value);
	return Response.json({ error }, { status, headers });
}

function baseResponseHeaders(
	corsHeaders: Headers,
	cacheLevel: CacheLevel,
	cacheState: GatewayCacheState,
	contentType = "application/json; charset=utf-8",
) {
	const headers = new Headers(corsHeaders);
	headers.set("Content-Type", contentType);
	headers.set("X-Content-Type-Options", "nosniff");
	headers.set("Cache-Control", "no-store");
	headers.set("X-Kirari-Cache-Level", cacheLevel);
	headers.set("X-Kirari-Cache", cacheState);
	return headers;
}

function headResponse(response: Response) {
	return new Response(null, { status: response.status, statusText: response.statusText, headers: response.headers });
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
	const copy = new Uint8Array(bytes.byteLength);
	copy.set(bytes);
	return copy.buffer;
}

function getCorsDecision(request: Request, url: URL, mode: GatewayMode, allowedOrigins: Set<string>): CorsDecision {
	const origin = request.headers.get("origin");
	if (!origin) return { allowed: true, headers: new Headers() };
	const allowed = mode === "integrated" ? origin === url.origin : allowedOrigins.has(origin);
	if (!allowed) return { allowed: false };
	const headers = new Headers({ "Access-Control-Allow-Origin": origin, Vary: "Origin" });
	return { allowed: true, headers };
}

function normalizeAllowedOrigins(origins: readonly string[]): Set<string> {
	const normalized = new Set<string>();
	for (const origin of origins) {
		let url: URL;
		try {
			url = new URL(origin);
		} catch {
			throw new TypeError("Standalone allowed origins must be exact HTTPS origins.");
		}
		if (
			url.protocol !== "https:" ||
			url.origin !== origin ||
			url.username ||
			url.password ||
			url.pathname !== "/" ||
			url.search ||
			url.hash ||
			origin === "*"
		) {
			throw new TypeError("Standalone allowed origins must be exact HTTPS origins without paths or credentials.");
		}
		normalized.add(url.origin);
	}
	return normalized;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
