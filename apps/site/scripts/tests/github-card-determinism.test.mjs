import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";
import { GithubCardComponent } from "../../src/plugins/rehype-component-github-card.mjs";
import { GithubFileCardComponent } from "../../src/plugins/rehype-component-github-file-card.mjs";
import { createGithubCardSourceId } from "../../src/plugins/github-card-api-base.mjs";
import { parseDirectiveNode } from "../../src/plugins/remark-directive-rehype.js";

const previousBuildClock = process.env.KIRARI_DETERMINISTIC_BUILD_CLOCK;
process.env.KIRARI_DETERMINISTIC_BUILD_CLOCK = "true";
after(() => {
	if (previousBuildClock === undefined) delete process.env.KIRARI_DETERMINISTIC_BUILD_CLOCK;
	else process.env.KIRARI_DETERMINISTIC_BUILD_CLOCK = previousBuildClock;
});

test("duplicate card directives use distinct source offsets", (t) => {
	const root = tempDirectory(t);
	const tree = {
		type: "root",
		children: [
			directive("github", { start: { offset: 10 }, end: { offset: 32 } }),
			directive("github", { start: { offset: 44 }, end: { offset: 66 } }),
		],
	};
	parseDirectiveNode()(tree, sourceFile(root, "src/content/posts/cards.md"));

	const [first, second] = tree.children.map((node) => node.data.hProperties.kirariCardId);
	assert.match(first, /^[a-f0-9]{20}$/);
	assert.match(second, /^[a-f0-9]{20}$/);
	assert.notEqual(first, second);
});

test("card identity is stable across temporary roots and changes with source path or offset", (t) => {
	const firstRoot = tempDirectory(t);
	const secondRoot = tempDirectory(t);
	const position = { start: { offset: 10 }, end: { offset: 32 } };
	const first = createGithubCardSourceId("github", sourceFile(firstRoot, "src/content/posts/cards.md"), position);
	const relocated = createGithubCardSourceId("github", sourceFile(secondRoot, "src/content/posts/cards.md"), position);
	const anotherFile = createGithubCardSourceId("github", sourceFile(secondRoot, "src/content/posts/other.md"), position);
	const anotherOffset = createGithubCardSourceId("github", sourceFile(secondRoot, "src/content/posts/cards.md"), {
		start: { offset: 11 },
		end: { offset: 33 },
	});

	assert.equal(first, relocated);
	assert.notEqual(first, anotherFile);
	assert.notEqual(first, anotherOffset);
	assert.throws(
		() => createGithubCardSourceId("github", sourceFile(firstRoot, "src/content/posts/cards.md"), undefined),
		/source position offsets are unavailable/i,
	);
	assert.throws(
		() => createGithubCardSourceId("github", { cwd: firstRoot, history: [] }, position),
		/source identity is unavailable/i,
	);
});

test("GitHub card inline scripts reference the deterministic IDs on their elements", (t) => {
	const root = tempDirectory(t);
	const file = sourceFile(root, "src/content/posts/cards.md");
	for (const [name, component, prefix, properties] of [
		["github", GithubCardComponent, "GC", { repo: "owner/repo" }],
		["githubfile", GithubFileCardComponent, "GFC", { repo: "owner/repo", file: "README.md" }],
	]) {
		const node = directive(name, { start: { offset: 10 }, end: { offset: 32 } }, { ...properties, kirariCardId: "0".repeat(20) });
		parseDirectiveNode()({ type: "root", children: [node] }, file);
		const sourceId = node.data.hProperties.kirariCardId;
		assert.notEqual(sourceId, "0".repeat(20), "source identity overrides a user-supplied attribute");

		const rendered = component(node.data.hProperties, [], "https://api.example.test");
		const script = findElement(rendered, "script");
		const scriptText = textContent(script);
		const cardIds = collectIds(rendered).filter((id) => !id.endsWith("-script"));
		assert.equal(rendered.properties.id, `${prefix}${sourceId}-card`);
		assert.ok(cardIds.length > 1);
		assert.ok(cardIds.includes(rendered.properties.id));
		const references = [...scriptText.matchAll(/getElementById\('([^']+)'\)/g)].map(([, id]) => id);
		assert.ok(references.length > 1);
		for (const id of references) assert.ok(cardIds.includes(id), `inline script references rendered ID ${id}`);
	}
});

test("composition cards reject missing or malformed source IDs", () => {
	assert.throws(() => GithubCardComponent({ repo: "owner/repo" }, [], "https://api.example.test"), /deterministic source ID/i);
	assert.throws(() => GithubFileCardComponent({ repo: "owner/repo", file: "README.md", kirariCardId: "bad" }, [], "https://api.example.test"), /deterministic source ID/i);
});

test("ordinary builds still render cards without source metadata", (t) => {
	const previous = process.env.KIRARI_DETERMINISTIC_BUILD_CLOCK;
	delete process.env.KIRARI_DETERMINISTIC_BUILD_CLOCK;
	t.after(() => {
		if (previous === undefined) delete process.env.KIRARI_DETERMINISTIC_BUILD_CLOCK;
		else process.env.KIRARI_DETERMINISTIC_BUILD_CLOCK = previous;
	});
	const card = GithubCardComponent({ repo: "owner/repo" }, [], "https://api.example.test");
	assert.match(card.properties.id, /^GC[a-z0-9]{1,6}-card$/);
});

function tempDirectory(t) {
	const root = mkdtempSync(join(tmpdir(), "kirari-card-id-"));
	t.after(() => rmSync(root, { recursive: true, force: true }));
	return root;
}

function sourceFile(root, path) {
	return { cwd: root, history: [join(root, path)] };
}

function directive(name, position, attributes = { repo: "owner/repo" }) {
	return { type: "leafDirective", name, attributes, children: [], position };
}

function findElement(node, tagName) {
	if (node.tagName === tagName) return node;
	for (const child of node.children ?? []) {
		const found = findElement(child, tagName);
		if (found) return found;
	}
	return undefined;
}

function collectIds(node, ids = []) {
	if (typeof node.properties?.id === "string") ids.push(node.properties.id);
	for (const child of node.children ?? []) collectIds(child, ids);
	return ids;
}

function textContent(node) {
	if (typeof node.value === "string") return node.value;
	return (node.children ?? []).map(textContent).join("");
}
