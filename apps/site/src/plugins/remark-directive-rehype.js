import { h } from "hastscript";
import { visit } from "unist-util-visit";
import { createGithubCardSourceId } from "./github-card-api-base.mjs";

export function parseDirectiveNode() {
	return (tree, file) => {
		visit(tree, (node) => {
			if (
				node.type === "containerDirective" ||
				node.type === "leafDirective" ||
				node.type === "textDirective"
			) {
				// biome-ignore lint/suspicious/noAssignInExpressions: <check later>
				const data = node.data || (node.data = {});
				node.attributes = node.attributes || {};
				if (
					node.children.length > 0 &&
					node.children[0].data &&
					node.children[0].data.directiveLabel
				) {
					// Add a flag to the node to indicate that it has a directive label
					node.attributes["has-directive-label"] = true;
				}
				const hast = h(node.name, node.attributes);
				if (
					process.env.KIRARI_DETERMINISTIC_BUILD_CLOCK === "true" &&
					(node.name === "github" || node.name === "githubfile")
				) {
					hast.properties.kirariCardId = createGithubCardSourceId(node.name, file, node.position);
				}

				data.hName = hast.tagName;
				data.hProperties = hast.properties;
			}
		});
	};
}
