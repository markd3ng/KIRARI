<script lang="ts">
import Icon from "@iconify/svelte";
import { slide } from "svelte/transition";

let {
	title = "",
	url = "",
	lang = "",
}: {
	title?: string;
	url?: string;
	lang?: string;
} = $props();

let open = $state(false);
let copied = $state(false);

const encodedUrl = $derived(encodeURIComponent(url));
const encodedTitle = $derived(encodeURIComponent(title));

const socials = $derived([
	{ name: "X", icon: "fa6-brands:x-twitter", href: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}` },
	{ name: "Facebook", icon: "fa6-brands:facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}` },
	{ name: "LinkedIn", icon: "fa6-brands:linkedin", href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}` },
	{ name: "Reddit", icon: "fa6-brands:reddit", href: `https://www.reddit.com/submit?url=${encodedUrl}&title=${encodedTitle}` },
	{ name: "Telegram", icon: "fa6-brands:telegram", href: `https://t.me/share/url?url=${encodedUrl}&text=${encodedTitle}` },
	{ name: "WhatsApp", icon: "fa6-brands:whatsapp", href: `https://api.whatsapp.com/send?text=${encodedTitle}%20${encodedUrl}` },
	{ name: "LINE", icon: "fa6-brands:line", href: `https://social-plugins.line.me/lineit/share?url=${encodedUrl}` },
	{ name: "Mail", icon: "fa6-solid:envelope", href: `mailto:?subject=${encodedTitle}&body=${title}%0A${encodedUrl}` },
]);

function openSheet() {
	open = true;
}

function closeSheet() {
	open = false;
}

async function copyLink() {
	try {
		await navigator.clipboard.writeText(url);
		copied = true;
		setTimeout(() => (copied = false), 2000);
	} catch {
		// clipboard unavailable
	}
}
</script>

{#if title}
	<button
		class="inline-flex items-center gap-2 px-6 py-3 bg-[var(--primary)] text-white dark:text-black/70 rounded-lg font-medium hover:bg-[var(--primary)]/80 hover:scale-105 active:scale-95 transition-all whitespace-nowrap"
		onclick={openSheet}
	>
		<Icon icon="material-symbols:share" />
		Share
	</button>
{/if}

{#if open}
	<div class="fixed inset-0 z-40 bg-black/60" onclick={closeSheet}></div>

	<div
		transition:slide={{ duration: 250 }}
		class="fixed inset-x-0 bottom-0 z-50 rounded-t-[var(--radius-large)] bg-[var(--float-panel-bg)] shadow-xl dark:shadow-none"
	>
		<div class="flex items-center justify-center pt-3 pb-1">
			<div class="h-1 w-8 rounded-full bg-black/20 dark:bg-white/20"></div>
		</div>

		<div class="px-5 pb-1 text-center text-90 font-bold">Share</div>

		<div class="grid grid-cols-4 gap-y-3 gap-x-2 px-6 py-5">
			<button
				class="flex flex-col items-center gap-1.5 rounded-xl px-2 py-3 text-70 transition hover:bg-black/5 dark:hover:bg-white/10"
				onclick={copyLink}
			>
				<Icon icon={copied ? "material-symbols:check" : "material-symbols:link"} class="text-xl" />
				<span class="text-50 text-xs">{copied ? "Copied!" : "Copy Link"}</span>
			</button>
			{#each socials as item}
				<a
					href={item.href}
					target="_blank"
					rel="noopener noreferrer"
					class="flex flex-col items-center gap-1.5 rounded-xl px-2 py-3 text-70 transition hover:bg-black/5 dark:hover:bg-white/10"
				>
					<Icon icon={item.icon} class="text-xl" />
					<span class="text-50 text-xs">{item.name}</span>
				</a>
			{/each}
		</div>

		<div class="px-4 pb-5">
			<div class="border-t border-black/10 dark:border-white/10"></div>
			<button
				class="btn-regular mt-3 w-full rounded-xl py-3"
				onclick={closeSheet}
			>
				Cancel
			</button>
		</div>
	</div>
{/if}
