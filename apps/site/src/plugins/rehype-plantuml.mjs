import { visit } from "unist-util-visit";

export function rehypePlantuml() {
	return (tree) => {
		visit(tree, "element", (node) => {
			if (node.tagName !== "div") return;
			const classes = node.properties?.className || [];
			if (Array.isArray(classes) && classes.includes("plantuml-container")) {
				node.properties.className = ["plantuml-container", "not-prose", "my-5", "overflow-auto", "rounded-xl"];
			}
		});
	};
}
