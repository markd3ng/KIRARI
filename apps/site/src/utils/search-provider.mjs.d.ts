export type SearchProvider = "pagefind" | "docsearch" | "google";

export function resolveSearchProvider(config?: unknown): SearchProvider;
