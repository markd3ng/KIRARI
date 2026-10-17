import assert from "node:assert/strict";
import { test } from "node:test";

import {
	createCloudflareEdgeCache,
	createCloudflarePersistentCache,
	createCloudflareGatewayHandler,
} from "../src/cloudflare-gateway.ts";
import type { CacheEntry } from "@kirari/edge-gateway-core";

class MemoryCache {
	readonly entries = new Map<string, Response>();
	failMatch = false;
	declineWrites = false;

	async match(request: RequestInfo | URL): Promise<Response | undefined> {
		if (this.failMatch) throw new Error("cache read failed");
		return this.entries.get(new Request(request).url)?.clone();
	}

	async put(request: RequestInfo | URL, response: Response): Promise<void> {
		if (this.declineWrites) return;
		this.entries.set(new Request(request).url, response.clone());
	}
}

class MemoryKv {
	readonly entries = new Map<string, ArrayBuffer>();
	lastExpirationTtl: number | undefined;
	failReads = false;
	failWrites = false;

	async get(key: string, _type: "arrayBuffer"): Promise<ArrayBuffer | null> {
		if (this.failReads) throw new Error("KV read failed");
		return this.entries.get(key)?.slice(0) ?? null;
	}

	async put(key: string, value: ArrayBuffer, options?: { expirationTtl?: number }): Promise<void> {
		if (this.failWrites) throw new Error("KV write failed");
		this.entries.set(key, value.slice(0));
		this.lastExpirationTtl = options?.expirationTtl;
	}
}

function entry(overrides: Partial<CacheEntry> = {}): CacheEntry {
	return {
		status: 200,
		headers: { "content-type": "application/json; charset=utf-8", etag: '"v1"' },
		body: new TextEncoder().encode('{"ok":true}'),
		freshUntil: 10_000,
		staleUntil: 20_000,
		...overrides,
	};
}

test("Cloudflare Cache API round-trips bounded cache entries with edge-local consistency", async () => {
	const backingCache = new MemoryCache();
	const cache = createCloudflareEdgeCache(backingCache, "https://site.example", () => 1_000);
	assert.equal(cache.consistency, "edge-local");
	await cache.put("kirari-edge:test", entry());

	const result = await cache.get("kirari-edge:test");
	assert.deepEqual(result, entry());
	assert.equal(backingCache.entries.size, 1);
	const stored = [...backingCache.entries.values()][0];
	assert.equal(stored.status, 200);
	assert.equal(stored.headers.get("cache-control"), "public, max-age=19");
});

test("Cloudflare Cache API keys use a trusted origin and isolate origins with SHA-256", async () => {
	const backingCache = new MemoryCache();
	const first = createCloudflareEdgeCache(backingCache, "https://tenant-one.example", () => 1_000);
	const second = createCloudflareEdgeCache(backingCache, "https://tenant-two.example", () => 1_000);
	await first.put("same-core-key", entry());
	await second.put("same-core-key", entry());

	const cacheKeys = [...backingCache.entries.keys()].map((value) => new URL(value));
	assert.equal(cacheKeys.length, 2);
	assert.deepEqual(cacheKeys.map((url) => url.origin).sort(), [
		"https://tenant-one.example",
		"https://tenant-two.example",
	]);
	assert.ok(cacheKeys.every((url) => /^\/_kirari_edge_cache\/v1\/[a-f0-9]{64}$/.test(url.pathname)));
	assert.notEqual(cacheKeys[0].pathname, cacheKeys[1].pathname);
	assert.ok(cacheKeys.every((url) => url.search === "" && url.hash === ""));
});

test("Cloudflare Cache API rejects non-origin cache key inputs", async () => {
	const cache = new MemoryCache();
	for (const origin of [
		"https://site.example/path",
		"https://user:password@site.example",
		"file:///tmp/cache",
		"not an origin",
	]) {
		assert.throws(() => createCloudflareEdgeCache(cache, origin), /exact HTTP\(S\) request origin/);
	}
});

test("Cloudflare Cache API declines and read failures propagate for Core downgrade", async () => {
	const decline = createCloudflareEdgeCache(new MemoryCacheWithDeclinedWrites(), "https://site.example", () => 1_000);
	await assert.rejects(decline.put("cache-key", entry()), /did not retain the new/);

	const failingCache = new MemoryCache();
	failingCache.failMatch = true;
	await assert.rejects(createCloudflareEdgeCache(failingCache, "https://site.example").get("cache-key"), /cache read failed/);
});

test("Cloudflare Cache API rejects a declined replacement when an old entry still exists", async () => {
	const backingCache = new MemoryCache();
	const cache = createCloudflareEdgeCache(backingCache, "https://site.example", () => 1_000);
	const oldEntry = entry({ body: new Uint8Array([1]), freshUntil: 5_000, staleUntil: 10_000 });
	await cache.put("replace-me", oldEntry);

	backingCache.declineWrites = true;
	const replacement = entry({ body: new Uint8Array([2]), freshUntil: 15_000, staleUntil: 20_000 });
	await assert.rejects(cache.put("replace-me", replacement), /did not retain the new/);
	assert.deepEqual(await cache.get("replace-me"), oldEntry);
});

test("Cloudflare Cache API signals an entry that expires during the write race", async () => {
	const backingCache = new MemoryCache();
	const cache = createCloudflareEdgeCache(backingCache, "https://site.example", () => 25_000);
	await assert.rejects(cache.put("expired", entry()), /expired before adapter write/);
	assert.equal(backingCache.entries.size, 0);
	await assert.rejects(cache.put("oversized", entry({ body: new Uint8Array(1_000_001) })), /body exceeds/);
});

test("Cloudflare Cache API cancels bodies from invalid cached responses", async () => {
	for (const { status, headers } of [{ status: 200, headers: {} }, { status: 500, headers: {} }]) {
		let cancelled = false;
		const trackedResponse = new Response(new ReadableStream({ cancel() { cancelled = true; } }), {
			status,
			headers,
		});
		const cache = createCloudflareEdgeCache({
			match: async () => trackedResponse,
			put: async () => undefined,
		}, "https://site.example");

		assert.equal(await cache.get("invalid"), null);
		assert.equal(cancelled, true);
	}
});

test("Cloudflare Cache API ignores an oversized stored record", async () => {
	const backingCache = new MemoryCache();
	const cache = createCloudflareEdgeCache(backingCache, "https://site.example", () => 1_000);
	await cache.put("oversized", entry());
	const [key, cachedResponse] = [...backingCache.entries.entries()][0];
	const headers = new Headers(cachedResponse.headers);
	headers.set("content-length", "1000001");
	backingCache.entries.set(key, new Response(new Uint8Array(1_000_001), { headers }));
	assert.equal(await cache.get("oversized"), null);
});

test("Cloudflare Cache API rejects entries with missing freshness metadata", async () => {
	const backingCache = new MemoryCache();
	const cache = createCloudflareEdgeCache(backingCache, "https://site.example", () => 1_000);
	await cache.put("missing-metadata", entry());

	const [key, stored] = [...backingCache.entries.entries()][0];
	const headers = new Headers(stored.headers);
	headers.delete("x-kirari-cache-stale-until");
	backingCache.entries.set(key, new Response(await stored.arrayBuffer(), { headers }));

	assert.equal(await cache.get("missing-metadata"), null);
});

test("KV round-trips binary records, bounds the record, and declares eventual consistency", async () => {
	const kv = new MemoryKv();
	const cache = createCloudflarePersistentCache(kv, () => 1_000);
	assert.equal(cache.consistency, "eventual");
	await cache.put("kirari-edge:test", entry({ body: new Uint8Array([0, 255, 1, 2]) }));

	const [key] = kv.entries.keys();
	assert.match(key, /^[a-f0-9]{64}$/);
	assert.equal(kv.lastExpirationTtl, 60);
	assert.deepEqual(await cache.get("kirari-edge:test"), entry({ body: new Uint8Array([0, 255, 1, 2]) }));
});

test("KV rejects malformed, oversized, and expired records without exposing their contents", async () => {
	const kv = new MemoryKv();
	const cache = createCloudflarePersistentCache(kv, () => 1_000);
	await kv.put("bad", new Uint8Array([0, 0, 0, 8, 123]).buffer);
	assert.equal(await cache.get("bad"), null);
	await assert.rejects(cache.put("expired", entry({ staleUntil: 500 })), /expired before adapter write/);
	assert.equal(kv.lastExpirationTtl, undefined);
	await assert.rejects(cache.put("oversized", entry({ body: new Uint8Array(1_000_001) })), /body exceeds/);
});

test("KV failures propagate so the Core can serve without persistence", async () => {
	const kv = new MemoryKv();
	const cache = createCloudflarePersistentCache(kv, () => 1_000);
	kv.failReads = true;
	await assert.rejects(cache.get("key"), /KV read failed/);
	kv.failReads = false;
	kv.failWrites = true;
	await assert.rejects(cache.put("key", entry()), /KV write failed/);
});

test("Gateway truthfully downgrades declined edge writes and unavailable KV bindings", async () => {
	const noWriteCache = new MemoryCacheWithDeclinedWrites();
	const edgeHandler = createCloudflareGatewayHandler({ KIRARI_GATEWAY_CACHE_LEVEL: "CACHE_EDGE" }, {
		cache: noWriteCache,
		cacheKeyOrigin: "https://site.example",
		now: () => 1_000,
		fetch: async () => Response.json({ ok: true }),
	});
	const edgeResponse = await edgeHandler(new Request("https://site.example/_kirari/edge/github/repository/octo/demo"));
	assert.equal(edgeResponse.headers.get("x-kirari-cache-level"), "CACHE_NONE");
	assert.equal(edgeResponse.headers.get("x-kirari-cache"), "BYPASS");

	const kvHandler = createCloudflareGatewayHandler({ KIRARI_GATEWAY_CACHE_LEVEL: "CACHE_PERSISTENT" }, {
		now: () => 1_000,
		fetch: async () => Response.json({ ok: true }),
	});
	const kvResponse = await kvHandler(new Request("https://site.example/_kirari/edge/github/repository/octo/demo"));
	assert.equal(kvResponse.headers.get("x-kirari-cache-level"), "CACHE_NONE");
});

test("Gateway reports CACHE_NONE when an entry expires before the adapter write", async () => {
	const backingCache = new MemoryCache();
	let nowCalls = 0;
	const handler = createCloudflareGatewayHandler({ KIRARI_GATEWAY_CACHE_LEVEL: "CACHE_EDGE" }, {
		cache: backingCache,
		cacheKeyOrigin: "https://site.example",
		now: () => ++nowCalls <= 4 ? 0 : 8 * 24 * 60 * 60 * 1_000,
		fetch: async () => Response.json({ full_name: "octo/demo", owner: { login: "octo" } }),
	});

	const response = await handler(new Request("https://site.example/_kirari/edge/github/repository/octo/demo"));
	assert.equal(response.status, 200);
	assert.equal(response.headers.get("x-kirari-cache-level"), "CACHE_NONE");
	assert.equal(response.headers.get("x-kirari-cache"), "BYPASS");
	assert.equal(backingCache.entries.size, 0);
});

test("Gateway downgrades to CACHE_NONE when no trusted request origin is available", async () => {
	const backingCache = new MemoryCache();
	const handler = createCloudflareGatewayHandler({ KIRARI_GATEWAY_CACHE_LEVEL: "CACHE_EDGE" }, {
		cache: backingCache,
		fetch: async () => Response.json({ full_name: "octo/demo", owner: { login: "octo" } }),
	});

	const response = await handler(new Request("https://site.example/_kirari/edge/github/repository/octo/demo"));
	assert.equal(response.status, 200);
	assert.equal(response.headers.get("x-kirari-cache-level"), "CACHE_NONE");
	assert.equal(backingCache.entries.size, 0);
});

test("Gateway token binding is inert without an explicit public repository allowlist", async () => {
	const authorizations: Array<string | null> = [];
	const handler = createCloudflareGatewayHandler({ KIRARI_GITHUB_TOKEN: "worker-secret" }, {
		fetch: async (input, init) => {
			authorizations.push(new Headers(init?.headers).get("authorization"));
			return Response.json({ full_name: String(input) });
		},
	});

	await handler(new Request("https://site.example/_kirari/edge/github/repository/octo/demo"));
	assert.deepEqual(authorizations, [null]);
});

class MemoryCacheWithDeclinedWrites extends MemoryCache {
	constructor() {
		super();
		this.declineWrites = true;
	}
}
