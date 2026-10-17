import assert from "node:assert/strict";
import { test } from "node:test";
import { llmMarkdownPath, rewriteLlmUrl } from "../../src/utils/llm-url-utils.mjs";

const options = {
	canonicalUrl: "https://example.test/docs/en-US/posts/custom/slug/",
	basePath: "/docs/",
	sourcePath: "src/content/posts/en-US/guide/index.md",
	findContentUrl: (path) => path === "src/content/posts/en-US/other.md" ? "https://example.test/docs/en-US/posts/explicit/" : undefined,
	resolveAsset: async (path) => path === "src/content/posts/en-US/guide/cover.png" ? "/docs/_astro/cover.hash.webp" : undefined,
};

test("directory Markdown identity follows canonical nested paths", () => {
	assert.equal(llmMarkdownPath("/docs/en-US/posts/custom/slug/"), "/docs/en-US/posts/custom/slug/index.md");
	assert.equal(llmMarkdownPath("/about/"), "/about/index.md");
});

test("source-relative content and emitted image URLs survive custom slug and query/fragment", async () => {
	assert.equal(await rewriteLlmUrl("../other.md?mode=raw#heading", options), "https://example.test/docs/en-US/posts/explicit/?mode=raw#heading");
	assert.equal(await rewriteLlmUrl("./cover.png?download=1#view", options), "https://example.test/docs/_astro/cover.hash.webp?download=1#view");
	assert.equal(await rewriteLlmUrl("/images/public.png?v=1#view", options), "https://example.test/docs/images/public.png?v=1#view");
	assert.equal(await rewriteLlmUrl("/docs/images/public.png", options), "https://example.test/docs/images/public.png");
});

test("unpublished content and source paths lose their destination", async () => {
	assert.equal(await rewriteLlmUrl("../draft.md#secret", options), null);
	assert.equal(await rewriteLlmUrl("../missing.mdx", options), null);
	assert.equal(await rewriteLlmUrl("/src/content/posts/private.md", options), null);
	assert.equal(await rewriteLlmUrl("https://example.test/src/content/posts/private.md", options), null);
	assert.equal(await rewriteLlmUrl("https://example.test/docs/src/content/posts/private.md", options), null);
	assert.equal(await rewriteLlmUrl("/docs/%73rc/content/posts/private.md", options), null);
	assert.equal(await rewriteLlmUrl("%broken.md", options), null);
});

test("external URLs, local fragments, and normal relative HTML links preserve meaning", async () => {
	for (const value of ["#heading", "https://external.test/a.md?q=1#x", "//cdn.test/image.png", "mailto:person@example.test"]) {
		assert.equal(await rewriteLlmUrl(value, options), value);
	}
	assert.equal(await rewriteLlmUrl("../related/?q=1#x", options), "https://example.test/docs/en-US/posts/custom/related/?q=1#x");
	assert.equal(await rewriteLlmUrl("?q=1#x", options), "https://example.test/docs/en-US/posts/custom/slug/?q=1#x");
	await assert.rejects(rewriteLlmUrl("missing.png", options), /LLM Markdown asset is unavailable/);
	await assert.rejects(rewriteLlmUrl("../private.zip", options), /relative attachment is unsupported/);
});
