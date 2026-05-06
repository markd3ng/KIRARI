declare global {
	interface Window {
		swup?: {
			hooks?: {
				on: (event: string, callback: (...args: any[]) => void, options?: unknown) => void;
			};
		};
		stripOnloadAnimations?: () => void;
		pagefind: {
			search: (query: string) => Promise<{
				results: Array<{
					data: () => Promise<SearchResult>;
				}>;
			}>;
			options?: (options: Record<string, unknown>) => Promise<void>;
		};
	}
}

export {};

interface SearchResult {
	url: string;
	meta: {
		title: string;
	};
	excerpt: string;
	content?: string;
	word_count?: number;
	filters?: Record<string, unknown>;
	anchors?: Array<{
		element: string;
		id: string;
		text: string;
		location: number;
	}>;
	weighted_locations?: Array<{
		weight: number;
		balanced_score: number;
		location: number;
	}>;
	locations?: number[];
	raw_content?: string;
	raw_url?: string;
	sub_results?: SearchResult[];
}
