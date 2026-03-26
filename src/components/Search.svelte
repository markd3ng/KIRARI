<script lang="ts">
import I18nKey from "@i18n/i18nKey";
import { i18n } from "@i18n/translation";
import Icon, { addIcon } from "@iconify/svelte";
import fa6Icons from "@iconify-json/fa6-solid/icons.json";
import materialIcons from "@iconify-json/material-symbols/icons.json";

// Preload icons to avoid CDN requests
if (materialIcons.icons.search) {
	addIcon("material-symbols:search", {
		body: materialIcons.icons.search.body,
		width: materialIcons.width,
		height: materialIcons.height,
	});
}
if (fa6Icons.icons["chevron-right"]) {
	addIcon("fa6-solid:chevron-right", {
		body: fa6Icons.icons["chevron-right"].body,
		width: fa6Icons.width,
		height: fa6Icons.height,
	});
}

import { url } from "@utils/url-utils.ts";
import { onMount } from "svelte";
import type { SearchResult } from "@/global";

let keywordDesktop = "";
let keywordMobile = "";
let result: SearchResult[] = [];
let isSearching = false;
let pagefindLoaded = false;
let initialized = false;

// Debounce and concurrency control
let searchTimeout: ReturnType<typeof setTimeout> | null = null;
let searchId = 0; // Used to prevent stale results from concurrent searches
const DEBOUNCE_DELAY = 300; // ms

const fakeResult: SearchResult[] = [
	{
		url: url("/"),
		meta: {
			title: "This Is a Fake Search Result",
		},
		excerpt:
			"Because the search cannot work in the <mark>dev</mark> environment.",
	},
	{
		url: url("/"),
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
			const response = await window.pagefind.search(keyword);
			// Check if this search is still relevant (not superseded by newer search)
			if (currentSearchId !== searchId) {
				return; // Abandon stale search
			}
			searchResults = await Promise.all(
				response.results.map((item) => item.data()),
			);
		} else if (import.meta.env.DEV) {
			searchResults = fakeResult;
		} else {
			searchResults = [];
			console.error("Pagefind is not available in production environment.");
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
	const initializeSearch = () => {
		initialized = true;
		pagefindLoaded =
			typeof window !== "undefined" &&
			!!window.pagefind &&
			typeof window.pagefind.search === "function";

		if (keywordDesktop) search(keywordDesktop, true);
		if (keywordMobile) search(keywordMobile, false);
	};

	if (import.meta.env.DEV) {
		initializeSearch();
	} else {
		document.addEventListener("pagefindready", () => {
			initializeSearch();
		});
		document.addEventListener("pagefindloaderror", () => {
			initializeSearch(); // Initialize with pagefindLoaded as false
		});

		// Fallback in case events are not caught or pagefind is already loaded by the time this script runs
		setTimeout(() => {
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

	if (desktopInput) {
		desktopInput.addEventListener("input", (e) => {
			keywordDesktop = (e.target as HTMLInputElement).value;
		});
		desktopInput.addEventListener("focus", () => {
			search(keywordDesktop, true);
		});
	}

	if (mobileButton) {
		setSearchExpanded(false);
		mobileButton.onclick = togglePanel;
	}
});

$: if (initialized && keywordDesktop) {
	debouncedSearch(keywordDesktop, true);
}

$: if (initialized && keywordMobile) {
	debouncedSearch(keywordMobile, false);
}
</script>

<!-- search panel -->
<div id="search-panel" class="float-panel float-panel-closed search-panel absolute md:w-[30rem]
top-20 left-4 md:left-[unset] right-4 shadow-2xl rounded-2xl p-2">

    <!-- search bar inside panel for phone/tablet -->
    <div id="search-bar-inside" class="flex relative lg:hidden transition-all items-center h-11 rounded-xl
      bg-black/[0.04] hover:bg-black/[0.06] focus-within:bg-black/[0.06]
      dark:bg-white/5 dark:hover:bg-white/10 dark:focus-within:bg-white/10
  ">
        <Icon icon="material-symbols:search" class="absolute text-[1.25rem] pointer-events-none ml-3 transition my-auto text-black/30 dark:text-white/30"></Icon>
        <input placeholder="Search" bind:value={keywordMobile}
               class="pl-10 absolute inset-0 text-sm bg-transparent outline-0
               focus:w-60 text-black/50 dark:text-white/50"
        >
    </div>

    <!-- search results -->
    {#each result as item}
        <a href={item.url}
           class="transition first-of-type:mt-2 lg:first-of-type:mt-0 group block
       rounded-xl text-lg px-3 py-2 hover:bg-[var(--btn-plain-bg-hover)] active:bg-[var(--btn-plain-bg-active)]">
            <div class="transition text-90 inline-flex font-bold group-hover:text-[var(--primary)]">
                {item.meta.title}<Icon icon="fa6-solid:chevron-right" class="transition text-[0.75rem] translate-x-1 my-auto text-[var(--primary)]"></Icon>
            </div>
            <div class="transition text-sm text-50">
                {@html item.excerpt}
            </div>
        </a>
    {/each}
</div>

<style>
  input:focus {
    outline: 0;
  }
  .search-panel {
    max-height: calc(100vh - 100px);
    overflow-y: auto;
  }
</style>
