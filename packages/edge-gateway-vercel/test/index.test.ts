import assert from "node:assert/strict";
import { test } from "node:test";

import { createVercelGatewayHandler } from "../src/index.ts";

const apiBase = "https://kirari.example/api/_kirari/edge";
const repositoryPath = "/github/repository/octo/demo";

function repositoryResponse(): Response {
	return new Response(JSON.stringify({
		owner: { login: "octo", avatar_url: "https://avatars.githubusercontent.com/u/1" },
	}), { headers: { "content-type": "application/json; charset=utf-8" } });
}

function environment(overrides: Record<string, string | undefined> = {}) {
	return {
		KIRARI_GATEWAY_ENABLED: "true",
		VERCEL_PROJECT_ID: "prj_gateway_test",
		...overrides,
	};
}

test("the adapter is disabled by default and disabled health requests never fetch", async () => {
	let fetchCalls = 0;
	const handler = createVercelGatewayHandler({ fetch: async () => {
		fetchCalls += 1;
		return repositoryResponse();
	} });
	const response = await handler(new Request(`${apiBase}/healthz`));
	assert.equal(response.status, 404);
	assert.equal(response.headers.get("cache-control"), "no-store");
	assert.equal(fetchCalls, 0);
});

test("the mounted function path normalizes to the Core prefix and health remains local", async () => {
	let fetchCalls = 0;
	const handler = createVercelGatewayHandler({
		environment: environment(),
		fetch: async () => {
			fetchCalls += 1;
			return repositoryResponse();
		},
	});
	const response = await handler(new Request(`${apiBase}/healthz`));
	assert.equal(response.status, 200);
	assert.equal(await response.text(), "ok");
	assert.equal(response.headers.get("cache-control"), "no-store");
	assert.equal(fetchCalls, 0);
});

test("normal repository requests reach only the fixed GitHub upstream and do not forward browser secrets", async () => {
	let fetchedUrl = "";
	const upstreamAuthorizations: Array<string | null> = [];
	let upstreamCookie: string | null = null;
	const handler = createVercelGatewayHandler({
		environment: environment({
			KIRARI_GATEWAY_GITHUB_TOKEN: "vercel-secret",
			KIRARI_GATEWAY_GITHUB_PUBLIC_REPOSITORIES: "octo/demo",
		}),
		fetch: async (input, init) => {
			fetchedUrl = String(input);
			const headers = new Headers(init?.headers);
			upstreamAuthorizations.push(headers.get("authorization"));
			upstreamCookie = headers.get("cookie");
			return repositoryResponse();
		},
	});
	const response = await handler(new Request(`${apiBase}${repositoryPath}`, {
		headers: { Authorization: "Bearer browser-secret", Cookie: "session=private" },
	}));
	const body = await response.text();
	assert.equal(response.status, 200);
	assert.equal(fetchedUrl, "https://api.github.com/repos/octo/demo");
	assert.equal(upstreamAuthorizations[0], "Bearer vercel-secret");
	assert.equal(upstreamCookie, null);
	assert.doesNotMatch(body, /vercel-secret|browser-secret|session=private/);

	await handler(new Request(`${apiBase}/github/repository/octo/other`));
	assert.equal(upstreamAuthorizations[1], null);
});

test("a configured token without an explicit repository allowlist is never attached", async () => {
	let upstreamAuthorization: string | null = null;
	const handler = createVercelGatewayHandler({
		environment: environment({ KIRARI_GATEWAY_GITHUB_TOKEN: "vercel-secret" }),
		fetch: async (_input, init) => {
			upstreamAuthorization = new Headers(init?.headers).get("authorization");
			return repositoryResponse();
		},
	});
	await handler(new Request(`${apiBase}${repositoryPath}`));
	assert.equal(upstreamAuthorization, null);
});

test("unsupported paths, methods, and query parameters fail before upstream fetch", async () => {
	let fetchCalls = 0;
	const handler = createVercelGatewayHandler({
		environment: environment(),
		fetch: async () => {
			fetchCalls += 1;
			return repositoryResponse();
		},
	});
	const responses = await Promise.all([
		handler(new Request(`${apiBase}/arbitrary/upstream/path`)),
		handler(new Request(`${apiBase}${repositoryPath}`, { method: "POST" })),
		handler(new Request(`${apiBase}${repositoryPath}?url=https://evil.example`)),
	]);
	assert.deepEqual(responses.map((response) => response.status), [404, 405, 400]);
	assert.equal(fetchCalls, 0);
});

test("CACHE_EDGE sets a short Vercel-only CDN policy only for anonymous successful responses", async () => {
	const handler = createVercelGatewayHandler({
		environment: environment({ KIRARI_GATEWAY_CACHE_LEVEL: "CACHE_EDGE" }),
		fetch: async () => repositoryResponse(),
	});
	const anonymous = await handler(new Request(`${apiBase}${repositoryPath}`));
	assert.equal(anonymous.headers.get("vercel-cdn-cache-control"), "public, s-maxage=60, stale-while-revalidate=30");
	assert.equal(anonymous.headers.get("cache-control"), "no-store");
	assert.equal(anonymous.headers.get("x-kirari-cache-level"), "CACHE_EDGE");

	const health = await handler(new Request(`${apiBase}/healthz`));
	assert.equal(health.status, 200);
	assert.equal(health.headers.has("vercel-cdn-cache-control"), false);
	assert.equal(health.headers.get("x-kirari-cache-level"), "CACHE_NONE");

	const sensitiveHeaders: HeadersInit[] = [
		{ Origin: "https://kirari.example" },
		{ Cookie: "session=private" },
		{ Authorization: "Bearer browser-secret" },
	];
	for (const headers of sensitiveHeaders) {
		const response = await handler(new Request(`${apiBase}${repositoryPath}`, { headers }));
		assert.equal(response.headers.has("vercel-cdn-cache-control"), false);
		assert.equal(response.headers.get("x-kirari-cache-level"), "CACHE_NONE");
	}
});

test("CACHE_PERSISTENT stores Core timestamps, hashes environment and branch into the key, and serves a cache hit", async () => {
	const records = new Map<string, unknown>();
	const keys: string[] = [];
	const ttls: number[] = [];
	let fetchCalls = 0;
	let now = 1_800_000_000_000;
	const runtimeCache = {
		async get(key: string) {
			keys.push(key);
			return records.get(key) ?? null;
		},
		async set(key: string, value: unknown, options?: { ttl?: number }) {
			keys.push(key);
			if (options?.ttl) ttls.push(options.ttl);
			assert.ok(Buffer.byteLength(JSON.stringify(value), "utf8") < 1_900_000);
			records.set(key, value);
		},
	};
	const handler = createVercelGatewayHandler({
		environment: environment({
			KIRARI_GATEWAY_CACHE_LEVEL: "CACHE_PERSISTENT",
			VERCEL_ENV: "preview",
			VERCEL_GIT_COMMIT_REF: "feature/cache-isolation",
		}),
		now: () => now,
		getRuntimeCache: () => runtimeCache,
		fetch: async () => {
			fetchCalls += 1;
			return repositoryResponse();
		},
	});

	const first = await handler(new Request(`${apiBase}${repositoryPath}`));
	assert.equal(first.headers.get("x-kirari-cache-level"), "CACHE_PERSISTENT");
	assert.equal(first.headers.get("x-kirari-cache"), "MISS");
	assert.equal(fetchCalls, 1);
	assert.ok(ttls[0] > 0);

	now += 1_000;
	const second = await handler(new Request(`${apiBase}${repositoryPath}`));
	assert.equal(second.headers.get("x-kirari-cache"), "HIT");
	assert.equal(fetchCalls, 1);
	assert.equal(keys[0], keys[1]);
	assert.match(keys[0], /^kirari-gateway:v1:[a-f0-9]{24}:[a-f0-9]{64}$/);
});

test("CACHE_PERSISTENT isolates project, Production and Preview branch records", async () => {
	const records = new Map<string, unknown>();
	const cache = {
		async get(key: string) { return records.get(key) ?? null; },
		async set(key: string, value: unknown) { records.set(key, value); },
	};
	let fetchCalls = 0;
	const createHandler = (environmentOverrides: Record<string, string>) => createVercelGatewayHandler({
		environment: environment({
			KIRARI_GATEWAY_CACHE_LEVEL: "CACHE_PERSISTENT",
			...environmentOverrides,
		}),
		getRuntimeCache: () => cache,
		fetch: async () => {
			fetchCalls += 1;
			return repositoryResponse();
		},
	});

	await createHandler({ VERCEL_ENV: "preview", VERCEL_GIT_COMMIT_REF: "feature/cache" })(new Request(`${apiBase}${repositoryPath}`));
	await createHandler({ VERCEL_ENV: "production", VERCEL_GIT_COMMIT_REF: "main" })(new Request(`${apiBase}${repositoryPath}`));
	await createHandler({ VERCEL_ENV: "preview", VERCEL_GIT_COMMIT_REF: "other-branch" })(new Request(`${apiBase}${repositoryPath}`));
	await createHandler({ VERCEL_PROJECT_ID: "prj_other_project", VERCEL_ENV: "preview", VERCEL_GIT_COMMIT_REF: "feature/cache" })(new Request(`${apiBase}${repositoryPath}`));
	assert.equal(fetchCalls, 4);
	assert.equal(records.size, 4);
});

test("unavailable, malformed, oversized, and failing Runtime Cache paths downgrade safely", async (context) => {
	const cases = [
		{ name: "local process without a provider cache binding", getRuntimeCache: undefined },
		{ name: "unavailable", getRuntimeCache: () => { throw new Error("not in Vercel"); } },
		{ name: "read failure", getRuntimeCache: () => ({ async get() { throw new Error("cache unavailable"); }, async set() {} }) },
		{ name: "malformed record", getRuntimeCache: () => ({ async get() { return { bodyBase64: "!" }; }, async set() {} }) },
		{ name: "write failure", getRuntimeCache: () => ({ async get() { return null; }, async set() { throw new Error("cache unavailable"); } }) },
		{
			name: "oversized cached record",
			getRuntimeCache: () => ({ async get() {
				return {
					status: 200,
					headers: Object.fromEntries(Array.from({ length: 260 }, (_, index) => [`x-${index}`, "x".repeat(8_000)])),
					bodyBase64: "",
					freshUntil: 1_900_000_000_000,
					staleUntil: 1_900_000_010_000,
				};
			}, async set() {} }),
		},
	];

	for (const testCase of cases) {
		await context.test(testCase.name, async () => {
			let fetchCalls = 0;
			const handler = createVercelGatewayHandler({
				environment: environment({ KIRARI_GATEWAY_CACHE_LEVEL: "CACHE_PERSISTENT" }),
				getRuntimeCache: testCase.getRuntimeCache,
				fetch: async () => {
					fetchCalls += 1;
					return repositoryResponse();
				},
			});
			const response = await handler(new Request(`${apiBase}${repositoryPath}`));
			assert.equal(response.status, 200);
			assert.equal(response.headers.get("x-kirari-cache-level"), "CACHE_NONE");
			assert.equal(response.headers.get("cache-control"), "no-store");
			assert.equal(fetchCalls, 1);
		});
	}
});

test("invalid cache-level values fail safe to CACHE_NONE", async () => {
	const handler = createVercelGatewayHandler({
		environment: environment({ KIRARI_GATEWAY_CACHE_LEVEL: "CACHE_ANYTHING" }),
		fetch: async () => repositoryResponse(),
	});
	const response = await handler(new Request(`${apiBase}${repositoryPath}`));
	assert.equal(response.headers.get("x-kirari-cache-level"), "CACHE_NONE");
	assert.equal(response.headers.get("cache-control"), "no-store");
});

test("CACHE_EDGE never caches health responses at either supported route prefix", async () => {
	const handler = createVercelGatewayHandler({
		environment: environment({ KIRARI_GATEWAY_CACHE_LEVEL: "CACHE_EDGE" }),
		fetch: async () => { throw new Error("health must not reach upstream"); },
	});
	for (const prefix of ["/_kirari/edge", "/api/_kirari/edge"]) {
		for (const method of ["GET", "HEAD"]) {
			const response = await handler(new Request(`https://kirari.example${prefix}/healthz`, { method }));
			assert.equal(response.status, 200);
			assert.equal(response.headers.has("vercel-cdn-cache-control"), false);
			assert.equal(response.headers.get("x-kirari-cache-level"), "CACHE_NONE");
		}
	}
});

test("unexpected configuration errors log only a fixed event and safe error category", async (context) => {
	const log = context.mock.method(console, "error", () => {});
	const handler = createVercelGatewayHandler({
		environment: environment({
			KIRARI_GATEWAY_MODE: "standalone",
			KIRARI_GATEWAY_ALLOWED_ORIGINS: "secret-do-not-log",
		}),
	});
	const response = await handler(new Request(`${apiBase}${repositoryPath}`));
	assert.equal(response.status, 503);
	assert.equal(response.headers.get("cache-control"), "no-store");
	assert.deepEqual(await response.json(), { error: "gateway_unavailable" });
	assert.equal(log.mock.calls.length, 1);
	assert.deepEqual(JSON.parse(String(log.mock.calls[0].arguments[0])), {
		event: "kirari_gateway_request_failure",
		errorType: "TypeError",
	});
});

test("Preview without a Git branch identity bypasses Runtime Cache without accessing storage", async () => {
	for (const gitRef of [undefined, "", "   "]) {
		let cacheCalls = 0;
		let fetchCalls = 0;
		const handler = createVercelGatewayHandler({
			environment: environment({
				KIRARI_GATEWAY_CACHE_LEVEL: "CACHE_PERSISTENT",
				VERCEL_ENV: "preview",
				VERCEL_GIT_COMMIT_REF: gitRef,
			}),
			getRuntimeCache: () => {
				cacheCalls += 1;
				return { async get() { cacheCalls += 1; return null; }, async set() { cacheCalls += 1; } };
			},
			fetch: async () => { fetchCalls += 1; return repositoryResponse(); },
		});
		for (let request = 0; request < 2; request += 1) {
			const response = await handler(new Request(`${apiBase}${repositoryPath}`));
			assert.equal(response.status, 200);
			assert.equal(response.headers.get("x-kirari-cache-level"), "CACHE_NONE");
		}
		assert.equal(cacheCalls, 0);
		assert.equal(fetchCalls, 2);
	}
});

test("missing project identity bypasses Runtime Cache without accessing storage", async () => {
	for (const projectId of [undefined, "", "   "]) {
		let cacheCalls = 0;
		let fetchCalls = 0;
		const handler = createVercelGatewayHandler({
			environment: environment({
				KIRARI_GATEWAY_CACHE_LEVEL: "CACHE_PERSISTENT",
				VERCEL_PROJECT_ID: projectId,
				VERCEL_ENV: "production",
				VERCEL_GIT_COMMIT_REF: "main",
			}),
			getRuntimeCache: () => {
				cacheCalls += 1;
				return { async get() { cacheCalls += 1; return null; }, async set() { cacheCalls += 1; } };
			},
			fetch: async () => { fetchCalls += 1; return repositoryResponse(); },
		});
		for (let request = 0; request < 2; request += 1) {
			const response = await handler(new Request(`${apiBase}${repositoryPath}`));
			assert.equal(response.status, 200);
			assert.equal(response.headers.get("x-kirari-cache-level"), "CACHE_NONE");
		}
		assert.equal(cacheCalls, 0);
		assert.equal(fetchCalls, 2);
	}
});
