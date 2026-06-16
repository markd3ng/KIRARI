<script lang="ts">
import I18nKey from "@i18n/i18nKey";
import { i18n } from "@i18n/translation";

let {
	device,
	index,
	lang = undefined,
}: {
	device: { name: string; image?: string; specs: string; description: string; link: string };
	index: number;
	lang?: string;
} = $props();

const viewDetailsText = $derived(i18n(I18nKey.devicesViewDetails, lang));
const imgSrc = $derived(device.image || "");
const hasImage = $derived(!!imgSrc);
const bgColors = [
	"from-indigo-500 to-purple-600",
	"from-cyan-500 to-blue-600",
	"from-amber-500 to-red-500",
	"from-emerald-500 to-teal-600",
	"from-pink-500 to-rose-600",
	"from-sky-500 to-indigo-600",
	"from-orange-500 to-pink-500",
	"from-lime-500 to-emerald-600",
];
const gradient = $derived(bgColors[index % bgColors.length]);
</script>

<a
	href={device.link}
	target="_blank"
	rel="noopener noreferrer"
	class="group card-base flex flex-col overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
>
	<div class="aspect-[4/3] overflow-hidden bg-black/5 dark:bg-white/5">
		{#if hasImage}
			<img
				src={imgSrc}
				alt={device.name}
				class="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
				loading="lazy"
			/>
		{:else}
			<div
				class="flex h-full w-full items-center justify-center bg-gradient-br {gradient}"
			>
				<span class="text-center text-lg font-bold text-white/80">{device.name}</span>
			</div>
		{/if}
	</div>
	<div class="flex flex-1 flex-col gap-2 px-5 py-4">
		<h3 class="text-lg font-bold text-90">{device.name}</h3>
		<span class="self-start rounded-full bg-[var(--primary)]/10 px-2.5 py-0.5 text-xs font-medium text-[var(--primary)]">
			{device.specs}
		</span>
		<p class="mt-1 line-clamp-2 text-sm leading-relaxed text-50">{device.description}</p>
		<span class="mt-auto inline-flex items-center gap-1 pt-2 text-sm font-medium text-[var(--primary)] opacity-0 transition-opacity duration-200 group-hover:opacity-100">
			{viewDetailsText}
			<span class="text-base">→</span>
		</span>
	</div>
</a>
