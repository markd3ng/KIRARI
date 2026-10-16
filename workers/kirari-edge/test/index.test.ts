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

test("proxyGitHubCard legacy route stays anonymous even when the Worker has a token", async () => {
	await withMockFetch(
		(request) => {
			assert.equal(request.url, "https://api.github.com/repos/foo/bar?ref=main");
			assert.equal(request.method, "GET");
			assert.equal(request.headers.get("cookie"), null);
			assert.equal(request.headers.get("authorization"), null);
			assert.equal(request.headers.get("accept"), "application/vnd.github+json");
			assert.equal(request.headers.get("x-github-api-version"), "2022-11-28");
			return new Response("github", { headers: { ETag: '"abc"' } });
		},
		async () => {
			const response = await worker.fetch(
				new Request("https://edge.example.test/api/github/repos/foo/bar?ref=main", {
					headers: { Authorization: "Bearer client-token", Cookie: "session=private" },
				}),
				{ ...enabledEnv, KIRARI_GITHUB_TOKEN: "worker-secret" },
			);

			assert.equal(await response.text(), "github");
			assert.equal(response.headers.get("access-control-allow-origin"), "*");
			assert.match(response.headers.get("cache-control") || "", /max-age=300/);
		},
	);
});

test("Cloudflare Gateway route delegates valid requests to the fixed Core operation", async () => {
	await withMockFetch(
		(request) => {
			assert.equal(request.url, "https://api.github.com/repos/octo/demo");
			assert.equal(request.headers.get("authorization"), null);
			return Response.json({ full_name: "octo/demo", owner: { login: "octo" } });
		},
		async () => {
			const response = await worker.fetch(
				new Request("https://site.example/_kirari/edge/github/repository/octo/demo", {
					headers: { Origin: "https://site.example" },
				}),
				{ ...enabledEnv, KIRARI_GITHUB_TOKEN: "unused-secret" },
			);

			assert.equal(response.status, 200);
			assert.equal(response.headers.get("access-control-allow-origin"), "https://site.example");
			assert.equal(response.headers.get("x-content-type-options"), "nosniff");
			assert.doesNotMatch(await response.text(), /unused-secret/);
		},
	);
});

test("Cloudflare Gateway attaches a token only to an explicitly allowlisted public repository", async () => {
	const authorizations: Array<string | null> = [];
	await withMockFetch(
		(request) => {
			authorizations.push(request.headers.get("authorization"));
			return Response.json({ full_name: new URL(request.url).pathname });
		},
		async () => {
			const env = {
				...enabledEnv,
				KIRARI_GITHUB_TOKEN: "worker-secret",
				KIRARI_GITHUB_TOKEN_PUBLIC_REPOSITORIES: "octo/public",
			};
			for (const repo of ["public", "other"]) {
				await worker.fetch(
					new Request(`https://site.example/_kirari/edge/github/repository/octo/${repo}`),
					env,
				);
			}
		},
	);

	assert.deepEqual(authorizations, ["Bearer worker-secret", null]);
});

test("Cloudflare Gateway rejects unapproved routes before any upstream fetch", async () => {
	let fetchCalls = 0;
	await withMockFetch(
		() => {
			fetchCalls += 1;
			return Response.json({ unexpected: true });
		},
		async () => {
			const response = await worker.fetch(
				new Request("https://site.example/_kirari/edge/github/admin/octo/demo"),
				{ ...enabledEnv, KIRARI_GITHUB_TOKEN: "worker-secret" },
			);
			assert.equal(response.status, 404);
			assert.equal(response.headers.get("access-control-allow-origin"), null);
		},
	);
	assert.equal(fetchCalls, 0);
});

test("Cloudflare Gateway enforces the Core same-origin CORS boundary", async () => {
	let fetchCalls = 0;
	await withMockFetch(
		() => {
			fetchCalls += 1;
			return Response.json({ unexpected: true });
		},
		async () => {
			const response = await worker.fetch(
				new Request("https://site.example/_kirari/edge/github/repository/octo/demo", {
					headers: { Origin: "https://attacker.example" },
				}),
				enabledEnv,
			);
			assert.equal(response.status, 403);
			assert.equal(response.headers.get("access-control-allow-origin"), null);
		},
	);
	assert.equal(fetchCalls, 0);
});

test("Cloudflare Gateway fails closed on invalid cache-level configuration", async () => {
	const originalError = console.error;
	const logs: string[] = [];
	console.error = (message?: unknown) => logs.push(String(message));
	try {
		const response = await worker.fetch(
			new Request("https://site.example/_kirari/edge/github/repository/octo/demo"),
			{
				...enabledEnv,
				KIRARI_GATEWAY_CACHE_LEVEL: "CACHE_REMOTE",
				KIRARI_GITHUB_TOKEN: "must-not-appear-in-logs",
			},
		);
		assert.equal(response.status, 503);
		assert.deepEqual(await response.json(), { error: "gateway_configuration_error" });
		assert.equal(response.headers.get("cache-control"), "no-store");
	} finally {
		console.error = originalError;
	}
	assert.equal(logs.length, 1);
	assert.match(logs[0], /kirari_edge_gateway_configuration_failure/);
	assert.match(logs[0], /TypeError/);
	assert.doesNotMatch(logs[0], /must-not-appear-in-logs|CACHE_REMOTE/);
});

test("Cloudflare Gateway turns unexpected Core failures into a generic logged 500", async () => {
	const originalError = console.error;
	const originalNow = Date.now;
	const logs: string[] = [];
	console.error = (message?: unknown) => logs.push(String(message));
	Date.now = () => {
		throw new Error("sensitive runtime detail");
	};
	try {
		const response = await worker.fetch(
			new Request("https://site.example/_kirari/edge/github/repository/octo/demo"),
			enabledEnv,
		);
		assert.equal(response.status, 500);
		assert.deepEqual(await response.json(), { error: "gateway_internal_error" });
		assert.equal(response.headers.get("cache-control"), "no-store");
		assert.equal(response.headers.get("x-content-type-options"), "nosniff");
	} finally {
		console.error = originalError;
		Date.now = originalNow;
	}
	assert.equal(logs.length, 1);
	assert.match(logs[0], /kirari_edge_gateway_failure/);
	assert.match(logs[0], /Error/);
	assert.doesNotMatch(logs[0], /sensitive runtime detail/);
});

test("rejects authority-changing GitHub suffixes before sending the Worker token", async () => {
	let fetchCalls = 0;
	await withMockFetch(
		() => {
			fetchCalls += 1;
			return new Response("unexpected");
		},
		async () => {
			for (const suffix of ["//attacker.example/private", "///attacker.example/private", "/\\attacker.example/private"]) {
				const response = await worker.fetch(
					new Request(`https://edge.example.test/api/github${suffix}`),
					{ ...enabledEnv, KIRARI_GITHUB_TOKEN: "worker-secret" },
				);

				assert.equal(response.status, 400);
				assert.equal(response.headers.get("cache-control"), "no-store");
				assert.equal(response.headers.get("access-control-allow-origin"), "*");
				assert.deepEqual(await response.json(), { error: "Invalid upstream path" });
			}

			assert.equal(fetchCalls, 0);
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
