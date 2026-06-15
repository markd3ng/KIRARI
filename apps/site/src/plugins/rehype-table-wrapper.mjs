import { visit } from "unist-util-visit";

/**
 * Wrap Markdown tables in a scroll container while preserving native table
 * layout, so header and body columns are measured together.
 */
export function rehypeTableWrapper() {
	return (tree) => {
		visit(tree, "element", (node, index, parent) => {
			if (!parent || typeof index !== "number" || node.tagName !== "table") return;

			const className = node.properties?.className;
			const classes = Array.isArray(className) ? className : [];
			if (classes.includes("markdown-table")) return;

			node.properties = {
				...(node.properties || {}),
				className: [...classes, "markdown-table"],
			};

			parent.children[index] = {
				type: "element",
				tagName: "div",
				properties: {
					className: ["markdown-table-wrapper"],
				},
				children: [node],
			};
		});
	};
}
