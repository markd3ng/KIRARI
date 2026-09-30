import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { after, test } from "node:test";
import { submitIndexingNotifications } from "../indexing.mjs";

const tempRoots = [];
const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const dummyCredentials = JSON.stringify({
	client_email: "indexer@example.test",
	private_key: privateKey.export({ type: "pkcs8", format: "pem" }),
});
const config = {
	seo: {
		indexNow: true,
		indexNowKey: "dummy-indexnow-key",
		google: {
			indexingApi: true,
			serviceAccountJsonEnv: "GOOGLE_INDEXING_SERVICE_ACCOUNT_JSON",
		},
	},
};

after(() => {
	for (const root of tempRoots) rmSync(root, { recursive: true, force: true });
});

function makeDist() {
	const root = mkdtempSync(join(tmpdir(), "kirari-indexing-test-"));
	tempRoots.push(root);
	mkdirSync(join(root, "sitemaps"));
	writeFileSync(
		join(root, "sitemaps", "sitemap-0.xml"),
		"<urlset><url><loc>https://example.test/post/</loc></url></urlset>",
	);
	return root;
}

function stubIndexingFetch() {
	const originalFetch = globalThis.fetch;
	const attemptedUrls = [];
	globalThis.fetch = async (input) => {
		const url = new URL(input instanceof Request ? input.url : String(input));
		attemptedUrls.push(url.href);
		if (url.hostname === "oauth2.googleapis.com") {
			return new Response(JSON.stringify({ access_token: "dummy-access-token" }), {
				status: 200,
				headers: { "content-type": "application/json" },
			});
		}
		if (["api.indexnow.org", "indexing.googleapis.com"].includes(url.hostname)) {
			return new Response(null, { status: 200 });
		}
		throw new Error(`Test blocked unexpected network request: ${url.href}`);
	};
	return { attemptedUrls, restore: () => { globalThis.fetch = originalFetch; } };
}

async function attempt(env) {
	const distDir = makeDist();
	const fetchStub = stubIndexingFetch();
	try {
		const authorized = await submitIndexingNotifications({
			config,
			distDir,
			siteUrl: "https://example.test",
			basePath: "/",
			env: { ...env, GOOGLE_INDEXING_SERVICE_ACCOUNT_JSON: dummyCredentials },
		});
		return { authorized, attemptedUrls: fetchStub.attemptedUrls, distDir };
	} finally {
		fetchStub.restore();
	}
}

test("build-only and test environments veto both indexing integrations before side effects", async (t) => {
	for (const [name, env] of [
		["external Site source", { KIRARI_SITE_SOURCE: "/tmp/external-site", NODE_ENV: "production", KIRARI_ALLOW_INDEXING_SUBMISSIONS: "true" }],
		["build-only", { KIRARI_BUILD_ONLY: "true", NODE_ENV: "production", KIRARI_ALLOW_INDEXING_SUBMISSIONS: "true" }],
		["test", { NODE_ENV: "test", KIRARI_ALLOW_INDEXING_SUBMISSIONS: "true" }],
	]) {
		await t.test(name, async () => {
			const result = await attempt(env);
			assert.equal(result.authorized, false);
			assert.deepEqual(result.attemptedUrls, []);
			assert.equal(existsSync(join(result.distDir, "dummy-indexnow-key.txt")), false);
		});
	}
});

test("normal builds require explicit authorization before either submitter runs", async () => {
	const result = await attempt({ NODE_ENV: "production" });
	assert.equal(result.authorized, false);
	assert.deepEqual(result.attemptedUrls, []);
});

test("explicitly authorized production submissions use only the stubbed fetch", async () => {
	const result = await attempt({ NODE_ENV: "production", KIRARI_ALLOW_INDEXING_SUBMISSIONS: "true" });
	assert.equal(result.authorized, true);
	assert.deepEqual(result.attemptedUrls, [
		"https://api.indexnow.org/indexnow",
		"https://oauth2.googleapis.com/token",
		"https://indexing.googleapis.com/v3/urlNotifications:publish",
	]);
	assert.equal(readFileSync(join(result.distDir, "dummy-indexnow-key.txt"), "utf8"), "dummy-indexnow-key");
});
