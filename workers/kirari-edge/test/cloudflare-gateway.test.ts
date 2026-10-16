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
	const cache = createCloudflareEdgeCache(backingCache, () => 1_000);
	assert.equal(cache.consistency, "edge-local");
	await cache.put("kirari-edge:test", entry());

	const result = await cache.get("kirari-edge:test");
	assert.deepEqual(result, entry());
	assert.equal(backingCache.entries.size, 1);
	const stored = [...backingCache.entries.values()][0];
	assert.equal(stored.status, 200);
	assert.equal(stored.headers.get("cache-control"), "public, max-age=60");
});

test("Cloudflare Cache API declines and read failures propagate for Core downgrade", async () => {
	const decline = createCloudflareEdgeCache(new MemoryCacheWithDeclinedWrites(), () => 1_000);
	await assert.rejects(decline.put("cache-key", entry()), /did not retain/);

	const failingCache = new MemoryCache();
	failingCache.failMatch = true;
	await assert.rejects(createCloudflareEdgeCache(failingCache).get("cache-key"), /cache read failed/);
});

test("Cloudflare Cache API refuses expired and oversized entries", async () => {
	const cache = createCloudflareEdgeCache(new MemoryCache(), () => 25_000);
	await assert.rejects(cache.put("expired", entry()), /already stale/);
	await assert.rejects(cache.put("oversized", entry({ body: new Uint8Array(1_000_001) })), /body exceeds/);
});

test("Cloudflare Cache API ignores an oversized stored record", async () => {
	const backingCache = new MemoryCache();
	const cache = createCloudflareEdgeCache(backingCache, () => 1_000);
	await cache.put("oversized", entry());
	const [key, cachedResponse] = [...backingCache.entries.entries()][0];
	const headers = new Headers(cachedResponse.headers);
	headers.set("content-length", "1000001");
	backingCache.entries.set(key, new Response(new Uint8Array(1_000_001), { headers }));
	assert.equal(await cache.get("oversized"), null);
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
	await assert.rejects(cache.put("expired", entry({ staleUntil: 500 })), /already stale/);
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
