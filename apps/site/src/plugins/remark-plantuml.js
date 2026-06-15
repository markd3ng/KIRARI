import { deflateRawSync } from "node:zlib";
import { visit } from "unist-util-visit";

const alphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_";

function append3bytes(b1, b2, b3) {
	const c1 = b1 >> 2;
	const c2 = ((b1 & 0x3) << 4) | (b2 >> 4);
	const c3 = ((b2 & 0xf) << 2) | (b3 >> 6);
	const c4 = b3 & 0x3f;
	return alphabet[c1 & 0x3f] + alphabet[c2 & 0x3f] + alphabet[c3 & 0x3f] + alphabet[c4 & 0x3f];
}

function encodePlantuml(source) {
	const data = deflateRawSync(Buffer.from(source, "utf8"));
	let result = "";
	for (let i = 0; i < data.length; i += 3) {
		result += append3bytes(data[i], data[i + 1] || 0, data[i + 2] || 0);
	}
	return result;
}

function withTheme(source, theme) {
	if (!theme) return source;
	return source.replace("@startuml", `@startuml\n!theme ${theme}`);
}

export function remarkPlantuml(options = {}) {
	const enabled = options.enable === true;
	const server = (options.server || "https://www.plantuml.com/plantuml").replace(/\/+$/, "");
	return (tree) => {
		if (!enabled) return;
		visit(tree, "code", (node) => {
			if (node.lang !== "plantuml") return;
			const lightSource = withTheme(node.value, options.lightTheme || "");
			const darkSource = withTheme(node.value, options.darkTheme || options.lightTheme || "");
			const lightSrc = `${server}/svg/${encodePlantuml(lightSource)}`;
			const darkSrc = `${server}/svg/${encodePlantuml(darkSource)}`;
			node.type = "html";
			node.value = `<div class="plantuml-container"><img class="plantuml-image" src="${lightSrc}" data-light-src="${lightSrc}" data-dark-src="${darkSrc}" alt="PlantUML diagram" loading="lazy" decoding="async"></div>`;
			delete node.lang;
		});
	};
}
