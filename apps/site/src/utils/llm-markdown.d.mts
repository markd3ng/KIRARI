export function renderLlmMarkdown(options: {
	body: string | undefined;
	title: string;
	canonicalUrl: string;
	sourcePath: string;
	rewriteUrl: (url: string) => Promise<string | null>;
}): Promise<string>;
