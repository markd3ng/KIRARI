import assert from "node:assert/strict";
import { test } from "node:test";

import worker from "../src/index.ts";

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
