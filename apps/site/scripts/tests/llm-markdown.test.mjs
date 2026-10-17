import assert from "node:assert/strict";
import test from "node:test";
import { unified } from "unified";
import remarkParse from "remark-parse";
import { renderLlmMarkdown } from "../../src/utils/llm-markdown.mjs";

const render = (body, options = {}) => renderLlmMarkdown({
	body,
	title: "A source-backed page",
	canonicalUrl: "https://example.test/docs/posts/nested/page/",
	sourcePath: "src/content/posts/source.md",
	rewriteUrl: async (url) => url,
	...options,
});
const nodesOfType = (source, type) => {
	const found = [];
	const walk = (node) => {
		if (node.type === type) found.push(node);
		for (const child of node.children ?? []) walk(child);
	};
	walk(unified().use(remarkParse).parse(source));
	return found;
};

test("preserves source syntax for code, math, diagrams, tables, footnotes and body hierarchy", async () => {
	const body = [
		"## Heading with **meaning**",
		"",
		"> A quotation.",
		"",
		"- First item",
		"  - Nested item",
		"",
		"Inline `$x$` and $x_{i} + \\alpha$.",
		"",
		"$$",
		"f(x) = \\frac{1}{2} [formula](./not-a-link)",
		"$$",
		"",
		'```js title="demo" {1,3} collapse={2-4}',
		'import Secret from "./implementation";',
		'const fake = "[source](./not-a-link.md)";',
		"<Component secret={implementation} />",
		"```",
		"",
		"```mermaid caption=Graph",
		"graph TD; A-->B",
		"```",
		"",
		"~~~plantuml caption=Sequence",
		"@startuml",
		"Reader -> Site: Read Markdown",
		"@enduml",
		"~~~",
		"",
		"| Feature | Meaning |",
		"| :--- | ---: |",
		"| Tables | Preserved |",
		"",
		"A footnote.[^detail]",
		"",
		"[^detail]: More **detail**.",
	].join("\n");
	const calls = [];
	const result = await render(body, { rewriteUrl: async (url) => { calls.push(url); return url; } });
	assert.ok(result.endsWith(`${body}\n`));
	assert.deepEqual(calls, []);
	assert.match(result, /^# A source-backed page\n\n> Canonical: /);
	assert.doesNotMatch(result, /src\/content/);
});

test("rewrites inline and reference URLs without damaging escaped labels or nested parentheses", async () => {
	const body = String.raw`[a \[literal\] **label**](./sibling_(draft).md?mode=a&b=2#part "A title")

![an \[image\]](./cover_(1).png?size=2#crop)

[Reference \[label\]][reF]

![Reference image][img]

[reF]: ./sibling_(draft).md?view=full#details 'Reference title'
[img]: <./image with spaces.png?size=3#bottom>

Keep \[not a link\](./not-linked.md).
` + "\n`[literal](./code.md)`";
	const calls = [];
	const result = await render(body, { rewriteUrl: async (url) => {
		calls.push(url);
		return `https://cdn.test/resolved/${url.slice(2)}`;
	} });
	assert.deepEqual(calls, [
		"./sibling_(draft).md?view=full#details",
		"./image with spaces.png?size=3#bottom",
		"./sibling_(draft).md?mode=a&b=2#part",
		"./cover_(1).png?size=2#crop",
	]);
	const links = nodesOfType(result, "link");
	assert.equal(links[1].url, "https://cdn.test/resolved/sibling_(draft).md?mode=a&b=2#part");
	assert.equal(links[1].title, "A title");
	assert.equal(links[1].children[0].value, "a [literal] ");
	assert.equal(nodesOfType(result, "image")[0].alt, "an [image]");
	assert.equal(nodesOfType(result, "definition")[0].url, "https://cdn.test/resolved/sibling_(draft).md?view=full#details");
	assert.ok(result.includes(String.raw`Keep \[not a link\](./not-linked.md)`));
});

test("drops unpublished and executable destinations while retaining readable labels and image alt", async () => {
	const body = "[**Unpublished**](./draft.md) and ![Draft cover](./draft.png) and [Reference][draft].\n\n[draft]: ./missing.md\n\n[Unsafe](javascript:alert%281%29) ![Unsafe image](data:image/png;base64,abc)";
	const result = await render(body, { rewriteUrl: async (url) => url.startsWith("./") ? null : url });
	assert.ok(result.includes("**Unpublished** and Draft cover and Reference."));
	assert.ok(result.includes("Unsafe Unsafe image"));
	assert.doesNotMatch(result, /draft\.md|missing\.md|draft\.png|javascript:|data:/);
	const rewrittenUnsafe = await render("[Safe looking](https://example.test/)", { rewriteUrl: async () => "javascript:alert(1)" });
	assert.ok(rewrittenUnsafe.includes("Safe looking"));
	assert.doesNotMatch(rewrittenUnsafe, /javascript:/);
	for (const url of ["java\tscript:alert(1)", "vb\nscript:alert(1)", "da\rta:text/html,test"]) {
		const obfuscated = await render("[Label](https://example.test/)", { rewriteUrl: async () => url });
		assert.equal(nodesOfType(obfuscated, "link").length, 1, "only the canonical link remains");
	}
	const encoded = await render("[Entity](java&#x09;script:alert%281%29)");
	assert.equal(nodesOfType(encoded, "link").length, 1);
});

test("reference identifiers retain their original escapes and punctuation", async () => {
	const body = String.raw`[First][a_b] and [Second][a\_b] and [Third][A!B].

[a_b]: ./one.md
[a\_b]: ./two.md
[A!B]: ./three.md`;
	const result = await render(body, { rewriteUrl: async (url) => `https://example.test/${url.slice(2)}` });
	const references = nodesOfType(result, "linkReference");
	const definitions = nodesOfType(result, "definition");
	assert.equal(references.length, 3);
	assert.equal(definitions.length, 3);
	assert.deepEqual(references.map(({ identifier }) => identifier), definitions.map(({ identifier }) => identifier));
	assert.deepEqual(definitions.map(({ url }) => url), ["https://example.test/one.md", "https://example.test/two.md", "https://example.test/three.md"]);
});

test("unused definitions never resolve or export destinations and referenced definitions keep the first target", async () => {
	const body = String.raw`[Guide][A_B] and ![Cover][a\_b].

[unused-image]: ./missing.png
[unused-page]: ./missing.md
[a_b]: ./guide.md
[A_B]: ./shadowed-missing.png
[a\_b]: ./cover.png`;
	const calls = [];
	const result = await render(body, { rewriteUrl: async (url) => {
		calls.push(url);
		assert.ok(!url.includes("missing"), "unconsumed reference definitions must not resolve missing assets");
		return `https://example.test/${url.slice(2)}`;
	} });
	assert.deepEqual(calls, ["./guide.md", "./cover.png"]);
	assert.doesNotMatch(result, /unused-image|unused-page|missing/);
	const references = nodesOfType(result, "linkReference").concat(nodesOfType(result, "imageReference"));
	assert.deepEqual(references.map(({ identifier }) => identifier), ["a_b", String.raw`a\_b`]);
	const definitions = nodesOfType(result, "definition");
	assert.equal(definitions.find(({ identifier }) => identifier === "a_b").url, "https://example.test/guide.md");
	assert.equal(definitions.find(({ identifier }) => identifier === String.raw`a\_b`).url, "https://example.test/cover.png");
	const unusedOnly = await render("Visible body.\n\n[unused]: ./missing.png", {
		rewriteUrl: async () => { throw new Error("An unused definition must not invoke the URL resolver"); },
	});
	assert.match(unusedOnly, /Visible body\./);
	assert.doesNotMatch(unusedOnly, /unused|missing/);
});

test("renders supported directives as Markdown links and readable admonitions", async () => {
	const body = `::github{repo="owner/repo"}

::githubfile{repo="owner/repo" file="docs/A B.md" ref="feature/test" description="Guide [v2]"}

:::warning[Read this]
Keep **important** text and [the guide](./guide.md).
:::

Hidden :spoiler[**useful** words].

::unknown{secret="DO_NOT_EXPORT"}
`;
	const result = await render(body);
	assert.match(result, /https:\/\/github\.com\/owner\/repo/);
	assert.match(result, /blob\/feature%2Ftest\/docs\/A%20B\.md/);
	assert.match(result, /\*\*WARNING\*\*/);
	assert.match(result, /Read this/);
	assert.match(result, /Keep \*\*important\*\* text and/);
	assert.match(result, /Hidden \*\*useful\*\* words\./);
	assert.match(result, /Dynamic content omitted/);
	assert.doesNotMatch(result, /:::|:spoiler|::github|DO_NOT_EXPORT/);
});

test("MDX is parsed without executing imports, exports, JSX attributes or expressions", async () => {
	const body = `import YouTube from "./PRIVATE_IMPLEMENTATION.astro";
export const secret = "DO_NOT_EXPORT";

## Videos

<YouTube id="abc_123" title="A [video]" />

<Bilibili bvid="BV1example" />

<img src="./cover.png?size=2#detail" alt="Static image" />

<a href="./guide.md">A **guide**</a>

<Unknown secret={secret}>Static **child** prose.</Unknown>

<span>{secret}</span>

<YouTube id={secret} />

{(() => { throw new Error("MUST_NOT_EXECUTE"); })()}

\`\`\`mdx
<Unknown secret={secret} />
\`\`\`
`;
	const result = await render(body, { sourcePath: "src/content/posts/video.mdx", rewriteUrl: async (url) => `https://example.test/${url.slice(2)}` });
	assert.match(result, /youtube\.com\/watch\?v=abc_123/);
	assert.match(result, /bilibili\.com\/video\/BV1example/);
	assert.match(result, /https:\/\/example\.test\/cover\.png\?size=2#detail/);
	assert.match(result, /A \*\*guide\*\*/);
	assert.match(result, /Static \*\*child\*\* prose\./);
	assert.match(result, /Dynamic content omitted/);
	assert.doesNotMatch(result, /PRIVATE_IMPLEMENTATION|DO_NOT_EXPORT|MUST_NOT_EXECUTE|import YouTube|export const/);
	assert.ok(result.includes("```mdx\n<Unknown secret={secret} />\n```"));
	assert.doesNotMatch(result.replace(/```mdx[\s\S]*?```/, ""), /secret|<Unknown|<YouTube|<span>/);
});

test("ordinary Markdown tolerates less-than signs and braces while raw HTML becomes safe static prose", async () => {
	const result = await render("## Formula\n\nIf a < b, use {value}.\n\n<div>Readable <strong>HTML prose</strong><script>PRIVATE_SCRIPT()</script></div>\n\n<script>PRIVATE_ONLY()</script>");
	assert.match(result, /If a < b, use \{value\}\./);
	assert.match(result, /Readable HTML prose/);
	assert.match(result, /HTML content omitted/);
	assert.doesNotMatch(result, /<div>|<strong>|<script>|PRIVATE_/);
});

test("HTML AST preserves anchor/image/embed destinations and drops code and executable attributes", async () => {
	const body = `Before <a href="./guide.md?view=full&amp;mode=1#section" onclick="PRIVATE_EVENT()">the **guide**</a> after.

Inline <script>PRIVATE_INLINE_SCRIPT()</script> and <style>PRIVATE_INLINE_STYLE</style> text.

<div>
<a href="./guide.md#more">Block guide</a>
<img src="./image.png?size=2#crop" alt="A [cover]" onerror="PRIVATE_IMAGE_EVENT()">
<iframe src="https://video.test/embed/123" title="A video"></iframe>
<a href="java&#x09;script:PRIVATE_URL()">Unsafe label</a>
<script>PRIVATE_BLOCK_SCRIPT()</script>
</div>
`;
	const urls = [];
	const result = await render(body, { rewriteUrl: async (url) => {
		urls.push(url);
		return url.startsWith("./") ? `https://assets.test/${url.slice(2)}` : url;
	} });
	assert.ok(result.includes("[the **guide**](<https://assets.test/guide.md?view=full&mode=1#section>)"));
	assert.ok(result.includes("[Block guide](<https://assets.test/guide.md#more>)"));
	assert.equal(nodesOfType(result, "image")[0].url, "https://assets.test/image.png?size=2#crop");
	assert.equal(nodesOfType(result, "image")[0].alt, "A [cover]");
	assert.ok(result.includes("[A video](<https://video.test/embed/123>)"));
	assert.match(result, /Unsafe label/);
	assert.doesNotMatch(result, /PRIVATE_|<a |<img |<iframe|<script>|onclick|onerror/);
	assert.ok(urls.includes("./guide.md?view=full&mode=1#section"));
	assert.ok(!urls.some((url) => url.includes("script:")));
});

test("HTML span boundaries survive leading whitespace, comments and nested matching tags", async () => {
	const cases = [
		{
			name: "leading whitespace and newlines",
			body: "Before   <a href=\"./guide.md\">the **guide**</a> after.\n\n  <div>Block <a href=\"./block.md\">guide</a></div>\n\nTail.",
			expected: "Before   [the **guide**](<https://example.test/guide.md>) after.\n\n  Block [guide](<https://example.test/block.md>)\n\nTail.",
		},
		{
			name: "comment before element",
			body: "Before <!-- comment --> <a href=\"./guide.md\">the **guide**</a> after.\n\n<!-- block comment -->\n<div>Block <a href=\"./block.md\">guide</a></div>\n\nTail.",
			expected: "Before  [the **guide**](<https://example.test/guide.md>) after.\n\n\nBlock [guide](<https://example.test/block.md>)\n\nTail.",
		},
		{
			name: "nested matching tags",
			body: "Before <span>outer <span>inner</span> outer</span> after.\n\n<div>Block <div>nested</div> after</div>\n\nBefore <template>PRIVATE_OUTER<template>PRIVATE_INNER</template>PRIVATE_AFTER</template> after.\n\nTail.",
			expected: "Before outer inner outer after.\n\nBlock nested after\n\nBefore [Dynamic content omitted from Markdown view.] after.\n\nTail.",
		},
	];
	for (const { name, body, expected } of cases) {
		const result = await render(body, { rewriteUrl: async (url) => `https://example.test/${url.slice(2)}` });
		assert.ok(result.endsWith(`${expected}\n`), name);
	}
});

test("MDX math braces and diagram fences remain source-backed", async () => {
	const body = "$x_{i} = \\frac{1}{2}$\n\n$$\nf_{x}(a) = a^{2}\n$$\n\n```mermaid\ngraph TD; A-->B\n```";
	const result = await render(body, { sourcePath: "src/content/posts/math.mdx" });
	assert.ok(result.endsWith(`${body}\n`));
});
