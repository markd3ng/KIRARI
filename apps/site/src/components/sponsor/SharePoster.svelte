<script lang="ts">
import Icon from "@iconify/svelte";

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

const items = $derived([
	{ name: "Copy Link", icon: copied ? "material-symbols:check" : "material-symbols:link", action: "clipboard" as const, href: "" },
	{ name: "X", icon: "fa6-brands:x-twitter", action: "link" as const, href: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}` },
	{ name: "Facebook", icon: "fa6-brands:facebook", action: "link" as const, href: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}` },
	{ name: "LinkedIn", icon: "fa6-brands:linkedin", action: "link" as const, href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}` },
	{ name: "Reddit", icon: "fa6-brands:reddit", action: "link" as const, href: `https://www.reddit.com/submit?url=${encodedUrl}&title=${encodedTitle}` },
	{ name: "Telegram", icon: "fa6-brands:telegram", action: "link" as const, href: `https://t.me/share/url?url=${encodedUrl}&text=${encodedTitle}` },
	{ name: "WhatsApp", icon: "fa6-brands:whatsapp", action: "link" as const, href: `https://api.whatsapp.com/send?text=${encodedTitle}%20${encodedUrl}` },
	{ name: "LINE", icon: "fa6-brands:line", action: "link" as const, href: `https://social-plugins.line.me/lineit/share?url=${encodedUrl}` },
	{ name: "Mail", icon: "fa6-solid:envelope", action: "link" as const, href: `mailto:?subject=${encodedTitle}&body=${title}%0A${encodedUrl}` },
]);

function openSheet() { open = true; }
function closeSheet() { open = false; }

async function handleClipboard() {
	try {
		await navigator.clipboard.writeText(url);
		copied = true;
		setTimeout(() => (copied = false), 2000);
	} catch {}
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
		class="fixed inset-x-0 bottom-0 z-50 bg-[var(--float-panel-bg)] shadow-xl dark:shadow-none"
	>
		<div class="flex gap-1 overflow-x-auto px-4 py-3">
			{#each items as item}
				{#if item.action === "clipboard"}
					<button
						class="flex shrink-0 flex-col items-center gap-1 rounded-xl px-3 py-2 text-70 transition hover:bg-black/5 dark:hover:bg-white/10"
						onclick={handleClipboard}
					>
						<Icon icon={item.icon} class="text-lg" />
						<span class="text-50 text-[10px] leading-tight">{item.name}</span>
					</button>
				{:else}
					<a
						href={item.href}
						target="_blank"
						rel="noopener noreferrer"
						class="flex shrink-0 flex-col items-center gap-1 rounded-xl px-3 py-2 text-70 transition hover:bg-black/5 dark:hover:bg-white/10"
					>
						<Icon icon={item.icon} class="text-lg" />
						<span class="text-50 text-[10px] leading-tight">{item.name}</span>
					</a>
				{/if}
			{/each}
		</div>
	</div>
{/if}
