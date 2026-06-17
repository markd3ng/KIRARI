<script lang="ts">
import Icon from "@iconify/svelte";
import I18nKey from "@i18n/i18nKey";
import { i18n } from "@i18n/translation";

let {
	title = "",
	url = "",
	lang = "",
}: {
	title?: string;
	url?: string;
	lang?: string;
} = $props();

const encodedUrl = $derived(encodeURIComponent(url));
const encodedTitle = $derived(encodeURIComponent(title));

const items = $derived([
	{ name: i18n(I18nKey.copyLink, lang), icon: "material-symbols:link", href: "" },
	{ name: "X", icon: "fa6-brands:x-twitter", href: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}` },
	{ name: "Facebook", icon: "fa6-brands:facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}` },
	{ name: "LinkedIn", icon: "fa6-brands:linkedin", href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}` },
	{ name: "Reddit", icon: "fa6-brands:reddit", href: `https://www.reddit.com/submit?url=${encodedUrl}&title=${encodedTitle}` },
	{ name: "Telegram", icon: "fa6-brands:telegram", href: `https://t.me/share/url?url=${encodedUrl}&text=${encodedTitle}` },
	{ name: "WhatsApp", icon: "fa6-brands:whatsapp", href: `https://api.whatsapp.com/send?text=${encodedTitle}%20${encodedUrl}` },
	{ name: "LINE", icon: "fa6-brands:line", href: `https://social-plugins.line.me/lineit/share?url=${encodedUrl}` },
	{ name: "Mail", icon: "fa6-solid:envelope", href: `mailto:?subject=${encodedTitle}&body=${encodedTitle}%0A${encodedUrl}` },
]);

let copied = $state(false);

async function copyLink() {
	try {
		await navigator.clipboard.writeText(url);
		copied = true;
		setTimeout(() => (copied = false), 2000);
	} catch (e) {
		console.error("Copy failed:", e);
	}
}
</script>

{#if url}
	<div class="flex flex-wrap items-center gap-1.5">
		{#each items as item}
			{#if !item.href}
				<button
					class="inline-flex items-center gap-1 rounded-lg px-2.5 py-2 text-70 transition hover:bg-black/5 dark:hover:bg-white/10"
					onclick={copyLink}
				>
					<Icon icon={copied ? "material-symbols:check" : item.icon} class="text-base" />
					<span class="text-50 text-xs font-medium">{copied ? i18n(I18nKey.copied, lang) : item.name}</span>
				</button>
			{:else}
				<a
					href={item.href}
					target="_blank"
					rel="noopener noreferrer"
					class="inline-flex items-center gap-1 rounded-lg px-2.5 py-2 text-70 transition hover:bg-black/5 dark:hover:bg-white/10"
				>
					<Icon icon={item.icon} class="text-base" />
					<span class="text-50 text-xs font-medium">{item.name}</span>
				</a>
			{/if}
		{/each}
	</div>
{/if}
