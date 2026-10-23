import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { createMarkdownProcessor } from "@astrojs/markdown-remark";
import { rehypeMermaidPreProcess } from "../../src/plugins/rehype-mermaid-pre.mjs";

test("Mermaid conversion retains semantic keyboard-accessible source for disabled rendering", async () => {
	const processor = await createMarkdownProcessor({ rehypePlugins: [rehypeMermaidPreProcess], syntaxHighlight: false });
	const { code } = await processor.render('```mermaid\ngraph TD; A["<example>"]-->B\n```\n\n```js\nconst x = 1;\n```');
	assert.match(code, /<pre class="mermaid" tabindex="0" aria-label="Mermaid diagram source">/);
	assert.match(code, /&#x3C;example>/);
	assert.match(code, /<pre><code class="language-js">/);
});

test("both post routes use the explicit two-gate policy and shared runtime; frontmatter remains opt-in", () => {
	for (const path of ["../../src/pages/posts/[...slug].astro", "../../src/pages/[lang]/posts/[...slug].astro"]) {
		const source = readFileSync(new URL(path, import.meta.url), "utf8");
		assert.match(source, /data-mermaid-enabled=\{mermaidConfig.enable && entry.data.mermaid \? "true" : "false"\}/);
		assert.match(source, /installMermaid\(transitionManager\)/);
		assert.doesNotMatch(source, /import mermaid from/);
	}
	assert.match(readFileSync(new URL("../../src/content.config.ts", import.meta.url), "utf8"), /mermaid: z.boolean\(\).optional\(\).default\(false\)/);
});
