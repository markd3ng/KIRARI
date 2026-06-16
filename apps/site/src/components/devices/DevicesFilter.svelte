<script lang="ts">
import DeviceCard from "./DeviceCard.svelte";

type Device = {
	name: string;
	image?: string;
	specs: string;
	description: string;
	link: string;
};

type Brand = {
	name: string;
	devices: Device[];
};

let {
	brands = [] as Brand[],
	lang = undefined as string | undefined,
}: {
	brands: Brand[];
	lang?: string;
} = $props();

let selectedBrand = $state(brands.length > 0 ? brands[0].name : "");
</script>

<div class="devices-filter">
	{#if brands.length > 1}
		<div class="mb-6 flex flex-wrap gap-2" role="tablist" aria-label="Device brands">
			{#each brands as brand}
				<button
					role="tab"
					aria-selected={selectedBrand === brand.name}
					class="rounded-full px-4 py-2 text-sm font-medium transition-all duration-200
						{selectedBrand === brand.name
							? 'bg-[var(--primary)] text-white shadow-sm'
							: 'bg-black/5 text-70 hover:bg-black/10 dark:bg-white/10 dark:hover:bg-white/20'}"
					onclick={() => (selectedBrand = brand.name)}
				>
					{brand.name}
				</button>
			{/each}
		</div>
	{/if}

	{#each brands as brand (brand.name)}
		{#if brand.name === selectedBrand}
			<div
				class="grid gap-5 sm:grid-cols-2 lg:grid-cols-3"
				role="tabpanel"
				aria-label={brand.name}
			>
				{#each brand.devices as device, i}
					<DeviceCard {device} index={i} {lang} />
				{/each}
			</div>
		{/if}
	{/each}
</div>
