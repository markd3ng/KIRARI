import {
	createGatewayHandler,
	type CacheEntry,
	type CacheLevel,
	type EdgeCache,
	type GatewayFetch,
	type PersistentCache,
} from "@kirari/edge-gateway-core";

const CACHE_KEY_ORIGIN = "https://kirari-edge-cache.invalid/v1/";
const MAX_CACHE_BODY_BYTES = 1_000_000;
const MAX_CACHE_METADATA_BYTES = 16_384;
const CACHE_RECORD_HEADER_BYTES = 4;
// KV requires a 60-second minimum expiration; Core's absolute timestamps still
// stop serving the entry at its real staleUntil value.
const MIN_CACHE_TTL_SECONDS = 60;
const CACHEABLE_HEADERS = [
	"content-type",
	"etag",
	"last-modified",
	"x-upstream-ratelimit-limit",
	"x-upstream-ratelimit-remaining",
	"x-upstream-ratelimit-reset",
] as const;

type CachePort = Pick<Cache, "match" | "put">;
type KvBinding = {
	get(key: string, type: "arrayBuffer"): Promise<ArrayBuffer | null>;
	put(key: string, value: ArrayBuffer, options?: { expirationTtl?: number }): Promise<void>;
};

export interface CloudflareGatewayEnv {
	KIRARI_GATEWAY_CACHE_LEVEL?: string;
	KIRARI_EDGE_KV?: KvBinding;
	KIRARI_GITHUB_TOKEN?: string;
	KIRARI_GITHUB_TOKEN_PUBLIC_REPOSITORIES?: string;
}

export type CloudflareGatewayRuntime = {
	cache?: CachePort;
	fetch?: GatewayFetch;
	now?: () => number;
};

/** Adapt Cloudflare's per-datacenter Cache API to the Core's edge-cache port. */
export function createCloudflareEdgeCache(cache: CachePort, now: () => number = Date.now): EdgeCache {
	return {
		consistency: "edge-local",
		async get(key) {
			const cacheKey = await createCacheKey(key);
			const response = await cache.match(cacheKey);
			if (!response || response.status !== 200) return null;

			const metadata = readResponseMetadata(response.headers);
			if (!metadata) return null;
			const body = await readBoundedResponseBody(response, MAX_CACHE_BODY_BYTES);
			if (!body) return null;
			return { ...metadata, body };
		},
		async put(key, entry) {
			assertCacheEntrySize(entry);
			const ttlSeconds = getTtlSeconds(entry.staleUntil, now());
			const cacheKey = await createCacheKey(key);
			const headers = writeResponseMetadata(entry);
			headers.set("Cache-Control", `public, max-age=${ttlSeconds}`);
			const cacheResponse = new Response(toArrayBuffer(entry.body), { status: 200, headers });

			await cache.put(cacheKey, cacheResponse);
			// Cloudflare Cache API put() resolves even when it declines to cache.
			// Verify the local write so the Core can honestly report CACHE_NONE.
			const stored = await cache.match(cacheKey);
			if (!stored) throw new Error("Cloudflare Cache API did not retain the Gateway entry.");
			void stored.body?.cancel().catch(() => undefined);
		},
	};
}

/** Adapt an optional Workers KV binding to the Core's persistent-cache port. */
export function createCloudflarePersistentCache(kv: KvBinding, now: () => number = Date.now): PersistentCache {
	return {
		consistency: "eventual",
		async get(key) {
			const record = await kv.get(await hashKey(key), "arrayBuffer");
			if (!record || record.byteLength < CACHE_RECORD_HEADER_BYTES || record.byteLength > maxCacheRecordBytes()) {
				return null;
			}

			const view = new DataView(record);
			const metadataLength = view.getUint32(0);
			const bodyOffset = CACHE_RECORD_HEADER_BYTES + metadataLength;
			if (metadataLength === 0 || metadataLength > MAX_CACHE_METADATA_BYTES || bodyOffset > record.byteLength) {
				return null;
			}

			let metadata: unknown;
			try {
				metadata = JSON.parse(new TextDecoder().decode(new Uint8Array(record, CACHE_RECORD_HEADER_BYTES, metadataLength)));
			} catch {
				return null;
			}
			if (!isCacheMetadata(metadata)) return null;
			const body = new Uint8Array(record.slice(bodyOffset));
			if (body.byteLength > MAX_CACHE_BODY_BYTES) return null;
			return { ...metadata, body };
		},
		async put(key, entry) {
			assertCacheEntrySize(entry);
			const metadata = new TextEncoder().encode(JSON.stringify({
				status: entry.status,
				headers: entry.headers,
				freshUntil: entry.freshUntil,
				staleUntil: entry.staleUntil,
			}));
			if (metadata.byteLength > MAX_CACHE_METADATA_BYTES) {
				throw new Error("Gateway cache metadata exceeds the KV record bound.");
			}

			const record = new Uint8Array(CACHE_RECORD_HEADER_BYTES + metadata.byteLength + entry.body.byteLength);
			new DataView(record.buffer).setUint32(0, metadata.byteLength);
			record.set(metadata, CACHE_RECORD_HEADER_BYTES);
			record.set(entry.body, CACHE_RECORD_HEADER_BYTES + metadata.byteLength);
			await kv.put(await hashKey(key), record.buffer, {
				expirationTtl: getTtlSeconds(entry.staleUntil, now()),
			});
		},
	};
}

/** Build a Core handler from Worker bindings and optional runtime capabilities. */
export function createCloudflareGatewayHandler(
	env: CloudflareGatewayEnv,
	runtime: CloudflareGatewayRuntime = {},
) {
	const cacheLevel = env.KIRARI_GATEWAY_CACHE_LEVEL as CacheLevel | undefined;
	const publicRepositories = (env.KIRARI_GITHUB_TOKEN_PUBLIC_REPOSITORIES ?? "")
		.split(",")
		.map((repository) => repository.trim())
		.filter(Boolean);
	const canUseToken = Boolean(env.KIRARI_GITHUB_TOKEN && publicRepositories.length > 0);
	const selectedCache = runtime.cache ?? (typeof caches === "undefined" ? undefined : caches.default);

	return createGatewayHandler({
		mode: "integrated",
		cacheLevel,
		fetch: runtime.fetch,
		now: runtime.now,
		edgeCache: cacheLevel === "CACHE_EDGE" && selectedCache
			? createCloudflareEdgeCache(selectedCache, runtime.now)
			: undefined,
		persistentCache: cacheLevel === "CACHE_PERSISTENT" && env.KIRARI_EDGE_KV
			? createCloudflarePersistentCache(env.KIRARI_EDGE_KV, runtime.now)
			: undefined,
		getGitHubToken: canUseToken ? () => env.KIRARI_GITHUB_TOKEN : undefined,
		githubTokenPublicRepositories: publicRepositories,
	});
}

function readResponseMetadata(headers: Headers): Omit<CacheEntry, "body"> | null {
	const status = headers.get("x-kirari-cache-status");
	const freshUntil = Number(headers.get("x-kirari-cache-fresh-until"));
	const staleUntil = Number(headers.get("x-kirari-cache-stale-until"));
	if ((status !== "200" && status !== "404") || !Number.isFinite(freshUntil) || !Number.isFinite(staleUntil)) {
		return null;
	}

	const safeHeaders: Record<string, string> = {};
	for (const name of CACHEABLE_HEADERS) {
		const value = headers.get(`x-kirari-cache-header-${name}`);
		if (value !== null) safeHeaders[name] = value;
	}
	return { status: Number(status) as CacheEntry["status"], headers: safeHeaders, freshUntil, staleUntil };
}

function writeResponseMetadata(entry: CacheEntry): Headers {
	const headers = new Headers({
		"x-kirari-cache-status": String(entry.status),
		"x-kirari-cache-fresh-until": String(entry.freshUntil),
		"x-kirari-cache-stale-until": String(entry.staleUntil),
	});
	for (const name of CACHEABLE_HEADERS) {
		const value = entry.headers[name];
		if (value !== undefined) headers.set(`x-kirari-cache-header-${name}`, value);
	}
	return headers;
}

async function readBoundedResponseBody(response: Response, maximumBytes: number): Promise<Uint8Array | null> {
	const contentLength = response.headers.get("content-length");
	if (contentLength && /^\d+$/.test(contentLength) && Number(contentLength) > maximumBytes) {
		void response.body?.cancel().catch(() => undefined);
		return null;
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
			if (byteLength > maximumBytes) {
				void reader.cancel().catch(() => undefined);
				return null;
			}
			chunks.push(value);
		}
	} finally {
		reader.releaseLock();
	}

	const body = new Uint8Array(byteLength);
	let offset = 0;
	for (const chunk of chunks) {
		body.set(chunk, offset);
		offset += chunk.byteLength;
	}
	return body;
}

function isCacheMetadata(value: unknown): value is Omit<CacheEntry, "body"> {
	if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
	const metadata = value as Record<string, unknown>;
	if (!(
		(metadata.status === 200 || metadata.status === 404) &&
		typeof metadata.headers === "object" && metadata.headers !== null && !Array.isArray(metadata.headers) &&
		typeof metadata.freshUntil === "number" && Number.isFinite(metadata.freshUntil) &&
		typeof metadata.staleUntil === "number" && Number.isFinite(metadata.staleUntil)
	)) return false;
	return Object.values(metadata.headers as Record<string, unknown>).every((header) => typeof header === "string");
}

function assertCacheEntrySize(entry: CacheEntry) {
	if (!(entry.body instanceof Uint8Array) || entry.body.byteLength > MAX_CACHE_BODY_BYTES) {
		throw new Error("Gateway cache body exceeds the adapter bound.");
	}
}

function maxCacheRecordBytes() {
	return CACHE_RECORD_HEADER_BYTES + MAX_CACHE_METADATA_BYTES + MAX_CACHE_BODY_BYTES;
}

function getTtlSeconds(staleUntil: number, now: number) {
	if (!Number.isFinite(staleUntil) || staleUntil <= now) throw new Error("Gateway cache entry is already stale.");
	return Math.max(MIN_CACHE_TTL_SECONDS, Math.ceil((staleUntil - now) / 1_000));
}

async function createCacheKey(key: string): Promise<Request> {
	return new Request(`${CACHE_KEY_ORIGIN}${await hashKey(key)}`);
}

async function hashKey(key: string): Promise<string> {
	const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(key));
	return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
	const copy = new Uint8Array(bytes.byteLength);
	copy.set(bytes);
	return copy.buffer;
}
