import { visit } from "unist-util-visit";

/**
 * A lightweight rehype plugin that converts mermaid code blocks
 * into `<pre class="mermaid">` elements for client-side rendering.
 *
 * This replaces `<pre><code class="language-mermaid">...</code></pre>`
 * with `<pre class="mermaid">...</pre>`, which Mermaid.js can render on the client.
 *
 * This avoids the heavy `rehype-mermaid` package which requires Playwright even
 * for the `pre-mermaid` strategy.
 */
export function rehypeMermaidPreProcess() {
	return (tree) => {
		visit(tree, "element", (node) => {
			// Match <pre><code class="language-mermaid">...</code></pre>
			if (
				node.tagName === "pre" &&
				node.children?.length === 1 &&
				node.children[0].type === "element" &&
				node.children[0].tagName === "code"
			) {
				const codeNode = node.children[0];
				const classes = codeNode.properties?.className || [];

				if (Array.isArray(classes) && classes.includes("language-mermaid")) {
					// Extract the text content from the code block
					const textContent = codeNode.children
						?.filter((child) => child.type === "text")
						.map((child) => child.value)
						.join("");

					// Replace with <pre class="mermaid">textContent</pre>
					node.properties = { className: ["mermaid"] };
					node.children = [{ type: "text", value: textContent }];
				}
			}
		});
	};
}
