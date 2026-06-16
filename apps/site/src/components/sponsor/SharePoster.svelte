<script lang="ts">
import Icon from "@iconify/svelte";
import { fade } from "svelte/transition";

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
const text = $derived(title);

const links = $derived([
	{
		name: "X",
		icon: "fa6-brands:x-twitter",
		href: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`,
		color: "hover:text-black dark:hover:text-white",
	},
	{
		name: "Facebook",
		icon: "fa6-brands:facebook",
		href: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
		color: "hover:text-[#1877F2]",
	},
	{
		name: "LinkedIn",
		icon: "fa6-brands:linkedin",
		href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
		color: "hover:text-[#0A66C2]",
	},
	{
		name: "Reddit",
		icon: "fa6-brands:reddit",
		href: `https://www.reddit.com/submit?url=${encodedUrl}&title=${encodedTitle}`,
		color: "hover:text-[#FF4500]",
	},
	{
		name: "Telegram",
		icon: "fa6-brands:telegram",
		href: `https://t.me/share/url?url=${encodedUrl}&text=${encodedTitle}`,
		color: "hover:text-[#0088CC]",
	},
	{
		name: "WhatsApp",
		icon: "fa6-brands:whatsapp",
		href: `https://api.whatsapp.com/send?text=${encodedTitle}%20${encodedUrl}`,
		color: "hover:text-[#25D366]",
	},
	{
		name: "LINE",
		icon: "fa6-brands:line",
		href: `https://social-plugins.line.me/lineit/share?url=${encodedUrl}`,
		color: "hover:text-[#06C755]",
	},
	{
		name: "Mail",
		icon: "fa6-solid:envelope",
		href: `mailto:?subject=${encodedTitle}&body=${text}%0A${encodedUrl}`,
		color: "hover:text-70",
	},
]);

function toggleBar() {
	open = !open;
}

function closeBar() {
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

<div class="relative" class:open>
	{#if title}
		<button
			class="inline-flex items-center gap-2 px-6 py-3 bg-[var(--primary)] text-white dark:text-black/70 rounded-lg font-medium hover:bg-[var(--primary)]/80 hover:scale-105 active:scale-95 transition-all whitespace-nowrap"
			onclick={toggleBar}
		>
			<Icon icon="material-symbols:share" />
			Share
		</button>
	{/if}

	{#if open}
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div class="fixed inset-0 z-40" onclick={closeBar}></div>

		<div
			transition:fade={{ duration: 120 }}
			class="absolute right-0 z-50 mt-2 min-w-max rounded-xl bg-[var(--license-block-bg)] p-3 shadow-lg"
			role="menu"
		>
			<div class="flex items-center gap-2">
				{#each links as link}
					<a
						href={link.href}
						target="_blank"
						rel="noopener noreferrer"
						class="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-70 transition-all hover:bg-black/5 dark:hover:bg-white/10 {link.color}"
						role="menuitem"
					>
						<Icon icon={link.icon} class="text-base" />
						{link.name}
					</a>
				{/each}
				<button
					class="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-70 transition-all hover:bg-black/5 dark:hover:bg-white/10"
					onclick={copyLink}
					role="menuitem"
				>
					<Icon icon={copied ? "material-symbols:check" : "material-symbols:link"} class="text-base" />
					{copied ? "Copied!" : "Copy Link"}
				</button>
			</div>
		</div>
	{/if}
</div>
