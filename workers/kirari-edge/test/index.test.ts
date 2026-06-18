import assert from "node:assert/strict";
import { test } from "node:test";

import worker, { type Env } from "../src/index.ts";

const enabledEnv: Env = {
	KIRARI_EDGE_ENABLED: "true",
	KIRARI_GHCARD_ENABLED: "true",
	KIRARI_AVATAR_PROXY_ENABLED: "true",
	KIRARI_BANGUMI_API_PROXY_ENABLED: "true",
	KIRARI_BANGUMI_IMAGE_PROXY_ENABLED: "true",
};

async function withMockFetch(
	handler: (request: Request) => Response | Promise<Response>,
	run: () => Promise<void>,
) {
	const originalFetch = globalThis.fetch;
	globalThis.fetch = async (input, init) => handler(new Request(input, init));
	try {
		await run();
	} finally {
		globalThis.fetch = originalFetch;
	}
}

test("returns 404 when the edge runtime is disabled", async () => {
	const response = await worker.fetch(new Request("https://edge.example.test/api/github/repos/foo/bar"), {
		KIRARI_EDGE_ENABLED: "false",
	});

	assert.equal(response.status, 404);
	assert.equal(await response.text(), "Edge disabled");
});

test("returns 404 when enabled but no feature route matches", async () => {
	const response = await worker.fetch(new Request("https://edge.example.test/nope"), {
		KIRARI_EDGE_ENABLED: "true",
	});

	assert.equal(response.status, 404);
	assert.equal(await response.text(), "Not found");
});

test("returns 404 when a matching proxy feature is disabled", async () => {
	const response = await worker.fetch(
		new Request("https://edge.example.test/api/bangumi/v0/users/1/collections"),
		{ KIRARI_EDGE_ENABLED: "true" },
	);

	assert.equal(response.status, 404);
});

test("answers OPTIONS preflight without contacting upstream", async () => {
	let fetchCalls = 0;
	await withMockFetch(
		() => {
			fetchCalls += 1;
			return new Response("unexpected");
		},
		async () => {
			const response = await worker.fetch(
				new Request("https://edge.example.test/api/github/repos/foo/bar", {
					method: "OPTIONS",
					headers: { Origin: "https://site.example" },
				}),
				enabledEnv,
			);

			assert.equal(response.status, 204);
			assert.equal(response.headers.get("access-control-allow-origin"), "*");
			assert.equal(response.headers.get("access-control-allow-methods"), "GET, HEAD, OPTIONS");
			assert.equal(fetchCalls, 0);
		},
	);
});

test("rejects unsupported methods with 405", async () => {
	const response = await worker.fetch(
		new Request("https://edge.example.test/avatar/avatar/hash", { method: "POST" }),
		enabledEnv,
	);

	assert.equal(response.status, 405);
	assert.equal(response.headers.get("allow"), "GET, HEAD, OPTIONS");
	assert.equal(response.headers.get("access-control-allow-origin"), "*");
});

test("proxyGitHubCard strips its local prefix and client credentials", async () => {
	await withMockFetch(
		(request) => {
			assert.equal(request.url, "https://api.github.com/repos/foo/bar?ref=main");
			assert.equal(request.method, "GET");
			assert.equal(request.headers.get("cookie"), null);
			assert.equal(request.headers.get("authorization"), "Bearer worker-secret");
			assert.equal(request.headers.get("accept"), "application/vnd.github+json");
			return new Response("github", { headers: { ETag: '"abc"' } });
		},
		async () => {
			const response = await worker.fetch(
				new Request("https://edge.example.test/api/github/repos/foo/bar?ref=main", {
					headers: {
						Accept: "application/vnd.github+json",
						Authorization: "Bearer client-token",
						Cookie: "session=private",
					},
				}),
				{ ...enabledEnv, KIRARI_GITHUB_TOKEN: "worker-secret" },
			);

			assert.equal(await response.text(), "github");
			assert.equal(response.headers.get("access-control-allow-origin"), "*");
			assert.match(response.headers.get("cache-control") || "", /max-age=300/);
		},
	);
});

test("proxyAvatar strips its local prefix and preserves query parameters", async () => {
	await withMockFetch(
		(request) => {
			assert.equal(request.url, "https://cravatar.cn/avatar/hash?s=160&d=retro");
			return new Response("avatar");
		},
		async () => {
			const response = await worker.fetch(
				new Request("https://edge.example.test/avatar/avatar/hash?s=160&d=retro"),
				enabledEnv,
			);

			assert.equal(await response.text(), "avatar");
			assert.match(response.headers.get("cache-control") || "", /max-age=86400/);
		},
	);
});

test("proxyBangumiApi strips its local prefix and preserves query parameters", async () => {
	await withMockFetch(
		(request) => {
			assert.equal(
				request.url,
				"https://api.bgm.tv/v0/users/905494/collections?subject_type=2&type=2",
			);
			assert.equal(request.headers.get("authorization"), null);
			return new Response("bangumi-api");
		},
		async () => {
			const response = await worker.fetch(
				new Request(
					"https://edge.example.test/api/bangumi/v0/users/905494/collections?subject_type=2&type=2",
					{ headers: { Authorization: "Bearer client-token" } },
				),
				enabledEnv,
			);

			assert.equal(await response.text(), "bangumi-api");
			assert.match(response.headers.get("cache-control") || "", /max-age=300/);
		},
	);
});

test("proxyBangumiImage strips its local prefix and preserves query parameters", async () => {
	await withMockFetch(
		(request) => {
			assert.equal(request.url, "https://lain.bgm.tv/pic/cover/l/example.jpg?quality=85");
			return new Response("bangumi-image");
		},
		async () => {
			const response = await worker.fetch(
				new Request(
					"https://edge.example.test/images/bangumi/pic/cover/l/example.jpg?quality=85",
				),
				enabledEnv,
			);

			assert.equal(await response.text(), "bangumi-image");
			assert.match(response.headers.get("cache-control") || "", /max-age=86400/);
		},
	);
});

test("returns a CORS-safe 502 when an upstream request fails", async () => {
	const originalConsoleError = console.error;
	console.error = () => {};
	try {
		await withMockFetch(
			() => {
				throw new Error("network unavailable");
			},
			async () => {
				const response = await worker.fetch(
					new Request("https://edge.example.test/api/github/repos/foo/bar"),
					enabledEnv,
				);

				assert.equal(response.status, 502);
				assert.equal(response.headers.get("access-control-allow-origin"), "*");
				assert.deepEqual(await response.json(), { error: "Upstream request failed" });
			},
		);
	} finally {
		console.error = originalConsoleError;
	}
});
