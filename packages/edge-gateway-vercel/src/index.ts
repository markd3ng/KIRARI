import { createHash } from "node:crypto";
import { getCache } from "@vercel/functions";
import {
	createGatewayHandler,
	type CacheEntry,
	type CacheLevel,
	type GatewayFetch,
	type GatewayMode,
	type PersistentCache,
} from "@kirari/edge-gateway-core";

const FUNCTION_PREFIX = "/api/_kirari/edge";
const MAX_CACHE_ENTRY_BYTES = 1_900_000;
const MAX_CACHE_BODY_BYTES = 1_000_000;
const CDN_TTL_SECONDS = 60;
const CDN_STALE_SECONDS = 30;

type Environment = Readonly<Record<string, string | undefined>>;

type RuntimeCacheApi = {
	get(key: string): Promise<unknown>;
	set(key: string, value: unknown, options?: { ttl?: number; name?: string; tags?: string[] }): Promise<void>;
};

export type VercelGatewayOptions = {
	environment?: Environment;
	fetch?: GatewayFetch;
	getRuntimeCache?: () => RuntimeCacheApi | Promise<RuntimeCacheApi>;
	now?: () => number;
};

type AdapterConfig = {
	enabled: boolean;
	mode: GatewayMode;
	allowedOrigins: string[];
	cacheLevel: CacheLevel;
	githubToken?: string;
	githubPublicRepositories: string[];
};

/**
 * Build a Vercel Node.js Functions handler around the portable Gateway Core.
 * Nothing is enabled until KIRARI_GATEWAY_ENABLED is explicitly "true".
 */
export function createVercelGatewayHandler(options: VercelGatewayOptions = {}) {
	const environment = options.environment ?? process.env;
	const config = readAdapterConfig(environment);
	const now = options.now ?? Date.now;
	const getRuntimeCache = options.getRuntimeCache ?? (() => {
		if (
			environment.VERCEL !== "1" ||
			(environment.VERCEL_ENV !== "preview" && environment.VERCEL_ENV !== "production") ||
			!environment.RUNTIME_CACHE_ENDPOINT ||
			!environment.RUNTIME_CACHE_HEADERS
		) {
			throw new Error("Vercel Runtime Cache is unavailable in this environment.");
		}
		return getCache() as RuntimeCacheApi;
	});

	return async function handleVercelGatewayRequest(request: Request): Promise<Response> {
		if (!config.enabled) return errorResponse(404, "not_found");

		let persistentCache: PersistentCache | undefined;
		if (config.cacheLevel === "CACHE_PERSISTENT") {
			persistentCache = createRuntimeCachePort(
				getRuntimeCache,
				getRuntimeCacheScope(environment),
				now,
			);
		}

		try {
			const coreHandler = createGatewayHandler({
				mode: config.mode,
				allowedOrigins: config.allowedOrigins,
				fetch: options.fetch,
				getGitHubToken: config.githubToken ? () => config.githubToken : undefined,
				githubTokenPublicRepositories: config.githubToken
					? config.githubPublicRepositories
					: undefined,
				cacheLevel: config.cacheLevel === "CACHE_PERSISTENT" ? "CACHE_PERSISTENT" : "CACHE_NONE",
				persistentCache,
				now,
			});
			const response = await coreHandler(normalizeFunctionRequest(request));
			return config.cacheLevel === "CACHE_EDGE" ? applyCdnPolicy(request, response) : response;
		} catch {
			return errorResponse(503, "gateway_unavailable");
		}
	};
}

function readAdapterConfig(environment: Environment): AdapterConfig {
	const modeValue = environment.KIRARI_GATEWAY_MODE;
	const mode = modeValue === "standalone" ? "standalone" : "integrated";
	const cacheValue = environment.KIRARI_GATEWAY_CACHE_LEVEL;
	const cacheLevel: CacheLevel =
		cacheValue === "CACHE_EDGE" || cacheValue === "CACHE_PERSISTENT" || cacheValue === "CACHE_NONE"
			? cacheValue
			: "CACHE_NONE";
	const allowedOrigins = parseCsv(environment.KIRARI_GATEWAY_ALLOWED_ORIGINS);
	const githubPublicRepositories = parseCsv(environment.KIRARI_GATEWAY_GITHUB_PUBLIC_REPOSITORIES);
	const token = environment.KIRARI_GATEWAY_GITHUB_TOKEN?.trim();

	return {
		enabled: environment.KIRARI_GATEWAY_ENABLED === "true",
		mode,
		allowedOrigins,
		cacheLevel,
		githubToken: token && githubPublicRepositories.length > 0 ? token : undefined,
		githubPublicRepositories,
	};
}

function parseCsv(value: string | undefined): string[] {
	return [...new Set((value ?? "").split(",").map((item) => item.trim()).filter(Boolean))];
}

function normalizeFunctionRequest(request: Request): Request {
	const url = new URL(request.url);
	if (url.pathname !== FUNCTION_PREFIX && !url.pathname.startsWith(`${FUNCTION_PREFIX}/`)) return request;
	url.pathname = `/_kirari/edge${url.pathname.slice(FUNCTION_PREFIX.length)}`;
	return new Proxy(request, {
		get(target, property) {
			if (property === "url") return url.href;
			return Reflect.get(target, property, target);
		},
	});
}

function createRuntimeCachePort(
	getCacheApi: () => RuntimeCacheApi | Promise<RuntimeCacheApi>,
	scope: string,
	now: () => number,
): PersistentCache {
	return {
		consistency: "provider-defined",
		async get(key) {
			const cache = await getCacheApi();
			const record = await cache.get(runtimeCacheKey(scope, key));
			if (record === null || record === undefined) return null;
			return decodeCacheEntry(record);
		},
		async put(key, entry) {
			const ttl = Math.ceil((entry.staleUntil - now()) / 1_000);
			if (ttl < 1) throw new Error("Cache entry is already expired.");
			const record = encodeCacheEntry(entry);
			await (await getCacheApi()).set(runtimeCacheKey(scope, key), record, { ttl, name: "KIRARI Gateway" });
		},
	};
}

function getRuntimeCacheScope(environment: Environment): string {
	const vercelEnvironment = environment.VERCEL_ENV || "development";
	const gitRef = environment.VERCEL_GIT_COMMIT_REF || vercelEnvironment;
	return `${vercelEnvironment}:${gitRef}`;
}

function runtimeCacheKey(scope: string, coreKey: string): string {
	const scopeDigest = createHash("sha256").update(scope).digest("hex").slice(0, 24);
	const keyDigest = createHash("sha256").update(coreKey).digest("hex");
	return `kirari-gateway:v1:${scopeDigest}:${keyDigest}`;
}

type SerializedCacheEntry = {
	status: 200 | 404;
	headers: Record<string, string>;
	bodyBase64: string;
	freshUntil: number;
	staleUntil: number;
};

function encodeCacheEntry(entry: CacheEntry): SerializedCacheEntry {
	if (entry.body.byteLength > MAX_CACHE_BODY_BYTES) throw new Error("Cache body exceeds adapter limit.");
	const record: SerializedCacheEntry = {
		status: entry.status,
		headers: { ...entry.headers },
		bodyBase64: Buffer.from(entry.body).toString("base64"),
		freshUntil: entry.freshUntil,
		staleUntil: entry.staleUntil,
	};
	if (Buffer.byteLength(JSON.stringify(record), "utf8") > MAX_CACHE_ENTRY_BYTES) {
		throw new Error("Cache entry exceeds Vercel Runtime Cache item limit.");
	}
	return record;
}

function decodeCacheEntry(value: unknown): CacheEntry {
	if (!isSerializedCacheEntry(value)) throw new Error("Invalid Vercel Runtime Cache record.");
	const body = Buffer.from(value.bodyBase64, "base64");
	if (
		body.byteLength > MAX_CACHE_BODY_BYTES ||
		body.toString("base64") !== value.bodyBase64 ||
		Buffer.byteLength(JSON.stringify(value), "utf8") > MAX_CACHE_ENTRY_BYTES
	) {
		throw new Error("Invalid Vercel Runtime Cache record.");
	}
	return {
		status: value.status,
		headers: { ...value.headers },
		body: new Uint8Array(body),
		freshUntil: value.freshUntil,
		staleUntil: value.staleUntil,
	};
}

function isSerializedCacheEntry(value: unknown): value is SerializedCacheEntry {
	if (!value || typeof value !== "object" || Array.isArray(value)) return false;
	const record = value as Record<string, unknown>;
	return (
		(record.status === 200 || record.status === 404) &&
		typeof record.bodyBase64 === "string" &&
		record.bodyBase64.length <= Math.ceil((MAX_CACHE_BODY_BYTES * 4) / 3) + 4 &&
		typeof record.freshUntil === "number" &&
		Number.isFinite(record.freshUntil) &&
		typeof record.staleUntil === "number" &&
		Number.isFinite(record.staleUntil) &&
		!!record.headers &&
		typeof record.headers === "object" &&
		!Array.isArray(record.headers) &&
		Object.entries(record.headers).every(([key, header]) =>
			key.length <= 128 && typeof header === "string" && header.length <= 8_192,
		)
	);
}

function applyCdnPolicy(request: Request, response: Response): Response {
	const requestPath = new URL(request.url).pathname;
	if (
		response.status !== 200 ||
		requestPath === `${FUNCTION_PREFIX}/healthz` ||
		request.headers.has("origin") ||
		request.headers.has("cookie") ||
		request.headers.has("authorization") ||
		response.headers.has("set-cookie")
	) {
		return response;
	}

	const headers = new Headers(response.headers);
	headers.set(
		"Vercel-CDN-Cache-Control",
		`public, s-maxage=${CDN_TTL_SECONDS}, stale-while-revalidate=${CDN_STALE_SECONDS}`,
	);
	headers.set("X-Kirari-Cache-Level", "CACHE_EDGE");
	return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function errorResponse(status: number, error: string): Response {
	return Response.json(
		{ error },
		{ status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } },
	);
}
