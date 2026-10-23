export function llmMarkdownPath(canonicalPath: string): string;
export function rewriteLlmUrl(value: string, options: {
	canonicalUrl: string;
	basePath: string;
	sourcePath: string;
	findContentUrl: (sourcePath: string) => string | undefined;
	resolveAsset: (sourcePath: string) => Promise<string | undefined>;
}): Promise<string | null>;
