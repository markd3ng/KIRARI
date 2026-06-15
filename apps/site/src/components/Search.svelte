<script lang="ts">
import I18nKey from "@i18n/i18nKey";
import { i18n } from "@i18n/translation";
import Icon from "@iconify/svelte";
import "@utils/preload-icons";

import { getLangHomeUrl, toHreflang } from "@utils/i18n-utils";
import { url } from "@utils/url-utils.ts";
import { onMount } from "svelte";
import type { GoogleSearchResult, SearchResult } from "@/global";

type DocSearchConfig = {
	enable: boolean;
	appId: string;
	apiKey: string;
	indexName: string;
	filterByLanguage: boolean;
};

type GoogleSearchConfig = {
	cx: string;
	adsense: boolean;
	resultSetSize: string;
	safeSearch: "active" | "off";
};

type SearchConfig = {
	provider: "pagefind" | "docsearch" | "google";
	docsearch: DocSearchConfig;
	google: GoogleSearchConfig;
};

let {
	lang = undefined,
	search = undefined,
}: {
	lang?: string;
	search?: SearchConfig;
} = $props();

const homeUrl = $derived(lang ? getLangHomeUrl(lang) : url("/"));
const searchLabel = $derived(i18n(I18nKey.search, lang));
const searchLang = $derived(toHreflang(lang));
const searchProvider = $derived(search?.provider || "pagefind");
const docsearch = $derived(search?.docsearch);
const googleSearch = $derived(search?.google);
const docsearchEnabled = $derived(
	Boolean(
		searchProvider === "docsearch" &&
		docsearch?.enable &&
			docsearch.appId &&
			docsearch.apiKey &&
			docsearch.indexName,
	),
);
const googleEnabled = $derived(
	Boolean(searchProvider === "google" && googleSearch?.cx),
);
const googleAdsenseMode = $derived(Boolean(googleEnabled && googleSearch?.adsense));

let keywordDesktop = $state("");
let keywordMobile = $state("");
let result = $state<SearchResult[]>([]);
let isSearching = $state(false);
let pagefindLoaded = $state(false);
let initialized = $state(false);
let docsearchLoaded = $state(false);
let googleLoaded = $state(false);
let googleElementReady = $state(false);

// Debounce and concurrency control
let searchTimeout: ReturnType<typeof setTimeout> | null = null;
let searchId = 0; // Used to prevent stale results from concurrent searches
const DEBOUNCE_DELAY = 300; // ms

const getFakeResults = (): SearchResult[] => [
	{
		url: homeUrl,
		meta: {
			title: "This Is a Fake Search Result",
		},
		excerpt:
			"Because the search cannot work in the <mark>dev</mark> environment.",
	},
	{
		url: homeUrl,
		meta: {
			title: "If You Want to Test the Search",
		},
		excerpt: "Try running <mark>npm build && npm preview</mark> instead.",
	},
];

const setSearchExpanded = (expanded: boolean): void => {
	const trigger = document.getElementById("search-switch");
	if (trigger) {
		trigger.setAttribute("aria-expanded", String(expanded));
	}
};

const togglePanel = () => {
	if (docsearchEnabled) {
		openDocSearch();
		return;
	}
	const panel = document.getElementById("search-panel");
	if (!panel) return;
	panel.classList.toggle("float-panel-closed");
	setSearchExpanded(!panel.classList.contains("float-panel-closed"));
	if (!panel.classList.contains("float-panel-closed") && googleEnabled) {
		initializeGoogleSearch();
	}
};

const setPanelVisibility = (show: boolean, isDesktop: boolean): void => {
	const panel = document.getElementById("search-panel");
	if (!panel || !isDesktop) return;

	if (show) {
		panel.classList.remove("float-panel-closed");
	} else {
		panel.classList.add("float-panel-closed");
	}
	setSearchExpanded(show);
};

const openSearchPanel = (): void => {
	const panel = document.getElementById("search-panel");
	if (!panel) return;
	panel.classList.remove("float-panel-closed");
	setSearchExpanded(true);
};

const performSearch = async (keyword: string, isDesktop: boolean): Promise<void> => {
	if (docsearchEnabled) {
		if (keyword) openDocSearch(keyword);
		return;
	}

	if (!keyword) {
		setPanelVisibility(false, isDesktop && !googleEnabled);
		result = [];
		return;
	}

	if (!initialized) {
		return;
	}

	// Increment search ID to invalidate any previous pending searches
	const currentSearchId = ++searchId;

	isSearching = true;

	try {
		let searchResults: SearchResult[] = [];

		if (googleEnabled) {
			setPanelVisibility(true, isDesktop);
			await runGoogleSearch(keyword);
			return;
		}

		if (import.meta.env.PROD && pagefindLoaded && window.pagefind) {
			const response = await window.pagefind.search(keyword, {
				filters: { lang: searchLang },
			});
			// Check if this search is still relevant (not superseded by newer search)
			if (currentSearchId !== searchId) {
				return; // Abandon stale search
			}
			searchResults = await Promise.all(
				response.results.map((item) => item.data()),
			);
		} else if (import.meta.env.DEV) {
			searchResults = getFakeResults();
		} else {
			searchResults = [];
		}

		// Final check before updating results
		if (currentSearchId !== searchId) {
			return;
		}

		result = searchResults;
		setPanelVisibility(result.length > 0, isDesktop);
	} catch (error) {
		// Only update if this search is still relevant
		if (currentSearchId === searchId) {
			console.error("Search error:", error);
			result = [];
			setPanelVisibility(false, isDesktop);
		}
	} finally {
		if (currentSearchId === searchId) {
			isSearching = false;
		}
	}
};

const openDocSearch = (initialQuery = ""): void => {
	const button = document.querySelector<HTMLButtonElement>(
		"#docsearch-container .DocSearch-Button",
	);
	if (!button) return;
	if (initialQuery) {
		const input = document.querySelector<HTMLInputElement>("#search-input-desktop");
		if (input) input.value = "";
	}
	button.click();
};

// Debounced search wrapper
const debouncedSearch = (keyword: string, isDesktop: boolean): void => {
	if (searchTimeout) {
		clearTimeout(searchTimeout);
	}
	searchTimeout = setTimeout(() => {
		performSearch(keyword, isDesktop);
	}, DEBOUNCE_DELAY);
};

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const highlightQuery = (text: string, query: string): string => {
	if (!query.trim()) return text;
	return text.replace(new RegExp(`(${escapeRegExp(query.trim())})`, "gi"), "<mark>$1</mark>");
};

const runCurrentSearch = (keyword: string, isDesktop: boolean): void => {
	if (searchTimeout) {
		clearTimeout(searchTimeout);
		searchTimeout = null;
	}
		performSearch(keyword, isDesktop);
};

const mapGoogleResult = (item: GoogleSearchResult, query: string): SearchResult => ({
	url: item.unescapedUrl || item.url || homeUrl,
	raw_url: item.unescapedUrl || item.url,
	meta: {
		title: item.titleNoFormatting || item.title || item.visibleUrl || homeUrl,
	},
	excerpt: highlightQuery(item.content || item.visibleUrl || "", query),
	content: item.content || "",
});

const renderGoogleElement = (container: HTMLElement, gname: string): void => {
	window.google?.search?.cse?.element?.render({
		div: container,
		tag: "searchresults-only",
		gname,
		attributes: {
			linkTarget: "_self",
			webSearchResultSetSize: googleSearch?.resultSetSize || "filtered_cse",
			webSearchSafesearch: googleSearch?.safeSearch || "active",
		},
	});
};

const loadGoogleScript = (): Promise<void> => {
	if (!googleSearch?.cx) return Promise.reject(new Error("Missing Google Programmable Search cx."));
	if (window.google?.search?.cse?.element) return Promise.resolve();

	return new Promise((resolve, reject) => {
		const existing = document.querySelector<HTMLScriptElement>("script[data-kirari-google-cse]");
		if (existing) {
			existing.addEventListener("load", () => resolve(), { once: true });
			existing.addEventListener("error", () => reject(new Error("Failed to load Google Programmable Search.")), { once: true });
			return;
		}

		const script = document.createElement("script");
		script.async = true;
		script.dataset.kirariGoogleCse = "true";
		script.src = `https://cse.google.com/cse.js?cx=${encodeURIComponent(googleSearch.cx)}`;
		script.addEventListener("load", () => resolve(), { once: true });
		script.addEventListener("error", () => reject(new Error("Failed to load Google Programmable Search.")), { once: true });
		document.head.appendChild(script);
	});
};

function initializeGoogleSearch(): Promise<void> {
	if (!googleEnabled || googleLoaded) return Promise.resolve();

	const elementName = googleAdsenseMode ? "kirari-google-adsense" : "kirari-google-results";
	const container = document.getElementById(
		googleAdsenseMode ? "google-search-official" : "google-search-results",
	);
	if (!container) return Promise.resolve();

	window.__gcse = {
		parsetags: "explicit",
		searchCallbacks: googleAdsenseMode
			? undefined
			: {
					web: {
						ready: (_name, query, promotions, results) => {
							result = [...promotions, ...results].map((item) => mapGoogleResult(item, query));
							isSearching = false;
							return true;
						},
					},
				},
	};

	return loadGoogleScript()
		.then(() => {
			if (!window.google?.search?.cse?.element) {
				throw new Error("Google Programmable Search element is unavailable.");
			}
			renderGoogleElement(container, elementName);
			googleLoaded = true;
			googleElementReady = true;
			initialized = true;
		})
		.catch((error) => {
			console.error(error);
			initialized = true;
			isSearching = false;
		});
}

const runGoogleSearch = async (keyword: string): Promise<void> => {
	await initializeGoogleSearch();
	if (!googleElementReady) {
		result = [];
		isSearching = false;
		return;
	}
	const elementName = googleAdsenseMode ? "kirari-google-adsense" : "kirari-google-results";
	const element = window.google?.search?.cse?.element?.getElement(elementName);
	if (!element?.execute) {
		result = [];
		isSearching = false;
		return;
	}
	element.execute(keyword);
};

onMount(() => {
	let mounted = true;
	let pagefindFallbackTimer: ReturnType<typeof setTimeout> | undefined;

	const initializeDocSearch = async () => {
		if (!docsearchEnabled || docsearchLoaded || !docsearch) return;

		const container = document.getElementById("docsearch-container");
		if (!container) return;

		try {
			const [{ default: docsearchInit }] = await Promise.all([
				import("@docsearch/js"),
				import("@docsearch/css"),
			]);

			if (!mounted) return;

			docsearchInit({
				container,
				appId: docsearch.appId,
				apiKey: docsearch.apiKey,
				indices: [
					{
						name: docsearch.indexName,
						searchParameters: docsearch.filterByLanguage
							? {
									facetFilters: [`language:${searchLang}`],
								}
							: undefined,
					},
				],
				placeholder: searchLabel,
			});

			docsearchLoaded = true;
		} catch (error) {
			console.error("Failed to load DocSearch:", error);
		}
	};

	const initializeSearch = () => {
		if (!mounted) return;
		initialized = true;
		pagefindLoaded =
			typeof window !== "undefined" &&
			!!window.pagefind &&
			typeof window.pagefind.search === "function";
	};

	const handlePagefindReady = () => {
		initializeSearch();
	};

	const handlePagefindLoadError = () => {
		initializeSearch();
	};

	if (docsearchEnabled) {
		initialized = true;
		initializeDocSearch();
	} else if (googleEnabled) {
		initialized = true;
	} else if (import.meta.env.DEV) {
		initializeSearch();
	} else {
		document.addEventListener("pagefindready", handlePagefindReady);
		document.addEventListener("pagefindloaderror", handlePagefindLoadError);

		// Fallback in case events are not caught or pagefind is already loaded by the time this script runs
		pagefindFallbackTimer = setTimeout(() => {
			if (!initialized) {
				initializeSearch();
			}
		}, 2000); // Adjust timeout as needed
	}

	// Wire up the search elements rendered in Navbar.astro
	const desktopInput = document.getElementById(
		"search-input-desktop",
	) as HTMLInputElement;
	const mobileButton = document.getElementById("search-switch");

	const handleDesktopInput = (e: Event) => {
		keywordDesktop = (e.target as HTMLInputElement).value;
	};

	const handleDesktopFocus = () => {
		if (docsearchEnabled) {
			openDocSearch(keywordDesktop);
			desktopInput?.blur();
		} else if (googleEnabled) {
			openSearchPanel();
			initializeGoogleSearch();
			if (keywordDesktop) {
				runCurrentSearch(keywordDesktop, true);
			}
		} else {
			performSearch(keywordDesktop, true);
		}
	};

	if (desktopInput) {
		desktopInput.addEventListener("input", handleDesktopInput);
		desktopInput.addEventListener("focus", handleDesktopFocus);
	}

	if (mobileButton) {
		setSearchExpanded(false);
		mobileButton.addEventListener("click", togglePanel);
	}

	return () => {
		mounted = false;
		if (searchTimeout) {
			clearTimeout(searchTimeout);
			searchTimeout = null;
		}
		if (pagefindFallbackTimer) {
			clearTimeout(pagefindFallbackTimer);
		}
		document.removeEventListener("pagefindready", handlePagefindReady);
		document.removeEventListener("pagefindloaderror", handlePagefindLoadError);
		desktopInput?.removeEventListener("input", handleDesktopInput);
		desktopInput?.removeEventListener("focus", handleDesktopFocus);
		mobileButton?.removeEventListener("click", togglePanel);
	};
});

$effect(() => {
	if (initialized && keywordDesktop && !googleAdsenseMode) {
		debouncedSearch(keywordDesktop, true);
	}
});

$effect(() => {
	if (initialized && keywordMobile && !googleAdsenseMode) {
		debouncedSearch(keywordMobile, false);
	}
});
</script>

<!-- search panel -->
<div id="search-panel" class="float-panel float-panel-closed search-panel absolute md:w-search-panel
top-20 left-4 md:left-[unset] right-4 shadow-2xl rounded-2xl p-2">
	<div id="docsearch-container" class="docsearch-container" aria-hidden={!docsearchEnabled}></div>

    <!-- search bar inside panel for phone/tablet -->
    {#if !docsearchEnabled}
    <div id="search-bar-inside" class="flex relative lg:hidden transition-all items-center h-11 rounded-xl
      bg-black/[0.04] hover:bg-black/[0.06] focus-within:bg-black/[0.06]
      dark:bg-white/5 dark:hover:bg-white/10 dark:focus-within:bg-white/10
  ">
        <Icon icon="material-symbols:search" class="absolute text-icon-lg pointer-events-none ml-3 transition my-auto text-black/30 dark:text-white/30"></Icon>
        <input placeholder={searchLabel} aria-label={searchLabel} bind:value={keywordMobile}
			   on:change={() => googleAdsenseMode && runCurrentSearch(keywordMobile, false)}
			   on:keydown={(event) => {
				   if (googleAdsenseMode && event.key === "Enter") runCurrentSearch(keywordMobile, false);
			   }}
               class="pl-10 absolute inset-0 text-sm bg-transparent outline-0
               focus:w-60 text-black/50 dark:text-white/50"
        >
    </div>
    {/if}

    <!-- search results -->
    {#if !docsearchEnabled}
		{#if googleAdsenseMode}
			<div id="google-search-official" class="google-search-official" aria-live="polite"></div>
		{:else}
			<div id="google-search-results" class="google-search-hidden" aria-hidden="true"></div>
			{#if isSearching}
				<div class="transition first-of-type:mt-2 lg:first-of-type:mt-0 block rounded-xl text-sm px-3 py-2 text-50">
					{searchLabel}...
				</div>
			{/if}
			{#each result as item}
				<a href={item.url}
				   class="transition first-of-type:mt-2 lg:first-of-type:mt-0 group block
			   rounded-xl text-lg px-3 py-2 hover:bg-[var(--btn-plain-bg-hover)] active:bg-[var(--btn-plain-bg-active)]">
					<div class="transition text-90 inline-flex font-bold group-hover:text-[var(--primary)]">
						{item.meta.title}<Icon icon="fa6-solid:chevron-right" class="transition text-icon-xs translate-x-1 my-auto text-[var(--primary)]"></Icon>
					</div>
					<div class="transition text-sm text-50">
						{@html item.excerpt}
					</div>
				</a>
			{/each}
		{/if}
    {/if}
</div>

<style>
  input:focus {
    outline: 0;
  }
  .search-panel {
    max-height: calc(100vh - 100px);
    overflow-y: auto;
  }
  .docsearch-container {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
  }
  :global(.DocSearch-Modal) {
    border-radius: 1rem;
  }
  :global(.DocSearch-Button) {
    margin: 0;
  }
  .google-search-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
  }
  .google-search-official {
    min-height: 8rem;
  }
  .google-search-official :global(.gsc-control-cse) {
    padding: 0;
    border: 0;
    background: transparent;
    font-family: inherit;
  }
  .google-search-official :global(.gsc-result) {
    border: 0;
    padding: 0.5rem 0.75rem;
    border-radius: 0.75rem;
    background: transparent;
  }
  .google-search-official :global(.gsc-result:hover) {
    background: var(--btn-plain-bg-hover);
  }
</style>
