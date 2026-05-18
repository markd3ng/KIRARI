<script lang="ts">
import I18nKey from "@i18n/i18nKey";
import { i18n } from "@i18n/translation";
import Icon from "@iconify/svelte";
import "@utils/preload-icons";

import { getLangHomeUrl, toHreflang } from "@utils/i18n-utils";
import { url } from "@utils/url-utils.ts";
import { onMount } from "svelte";
import type { SearchResult } from "@/global";

type DocSearchConfig = {
	enable: boolean;
	appId: string;
	apiKey: string;
	indexName: string;
	filterByLanguage: boolean;
};

let {
	lang = undefined,
	docsearch = undefined,
}: {
	lang?: string;
	docsearch?: DocSearchConfig;
} = $props();

const homeUrl = $derived(lang ? getLangHomeUrl(lang) : url("/"));
const searchLabel = $derived(i18n(I18nKey.search, lang));
const searchLang = $derived(toHreflang(lang));
const docsearchEnabled = $derived(
	Boolean(
		docsearch?.enable &&
			docsearch.appId &&
			docsearch.apiKey &&
			docsearch.indexName,
	),
);

let keywordDesktop = $state("");
let keywordMobile = $state("");
let result = $state<SearchResult[]>([]);
let isSearching = $state(false);
let pagefindLoaded = $state(false);
let initialized = $state(false);
let docsearchLoaded = $state(false);

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

const search = async (keyword: string, isDesktop: boolean): Promise<void> => {
	if (docsearchEnabled) {
		if (keyword) openDocSearch(keyword);
		return;
	}

	if (!keyword) {
		setPanelVisibility(false, isDesktop);
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
		search(keyword, isDesktop);
	}, DEBOUNCE_DELAY);
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
		} else {
			search(keywordDesktop, true);
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
	if (initialized && keywordDesktop) {
		debouncedSearch(keywordDesktop, true);
	}
});

$effect(() => {
	if (initialized && keywordMobile) {
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
               class="pl-10 absolute inset-0 text-sm bg-transparent outline-0
               focus:w-60 text-black/50 dark:text-white/50"
        >
    </div>
    {/if}

    <!-- search results -->
    {#if !docsearchEnabled}
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
</style>
