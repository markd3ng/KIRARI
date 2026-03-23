import { vitePreprocess } from "@astrojs/svelte";

export default {
	preprocess: [vitePreprocess({ script: true })],
	compilerOptions: {
		// Prevent Svelte from generating code that requires tslib
		generate: "client",
	},
};
