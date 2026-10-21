<script lang="ts">
	import { onMount } from "svelte";
	import I18nKey from "@i18n/i18nKey";
	import { i18n } from "@i18n/translation";
	import { readPrivacySettings, savePrivacySettings } from "@utils/privacy-settings.mjs";

	let { lang = undefined, idPrefix = "footer" }: { lang?: string; idPrefix?: string } = $props();
	const titleId = `${idPrefix}-privacy-settings-title`;
	let dialog: HTMLDialogElement;
	let analytics = $state(true);
	let advertising = $state(true);
	let error = $state(false);

	onMount(() => {
		const saved = readPrivacySettings();
		analytics = saved.analytics;
		advertising = saved.ads;
	});

	function openSettings() {
		const saved = readPrivacySettings();
		analytics = saved.analytics;
		advertising = saved.ads;
		error = false;
		dialog.showModal();
	}

	function save() {
		try {
			savePrivacySettings({ analytics, ads: advertising });
			window.location.reload();
		} catch {
			error = true;
		}
	}
</script>

<button type="button" class="link text-[var(--primary)] font-medium" onclick={openSettings}>
	{i18n(I18nKey.privacySettings, lang)}
</button>

<dialog bind:this={dialog} aria-labelledby={titleId} class="m-auto w-[min(92vw,32rem)] rounded-2xl border border-black/10 bg-[var(--card-bg)] p-6 text-black dark:border-white/15 dark:text-white shadow-2xl backdrop:bg-black/50">
	<h2 id={titleId} class="mb-3 text-xl font-bold">{i18n(I18nKey.privacySettings, lang)}</h2>
	<p class="mb-5 text-sm leading-relaxed text-black/70 dark:text-white/70">{i18n(I18nKey.privacySettingsDescription, lang)}</p>
	<label class="mb-4 flex cursor-pointer items-center gap-3">
		<input type="checkbox" bind:checked={analytics} />
		<span>{i18n(I18nKey.analytics, lang)}</span>
	</label>
	<label class="mb-5 flex cursor-pointer items-center gap-3">
		<input type="checkbox" bind:checked={advertising} />
		<span>{i18n(I18nKey.advertising, lang)}</span>
	</label>
	<p role="alert" aria-live="polite" class="mb-4 text-sm text-red-700 dark:text-red-300" hidden={!error}>
		{i18n(I18nKey.privacySaveError, lang)}
	</p>
	<div class="flex justify-end gap-3">
		<button type="button" class="btn-regular rounded-lg px-4 py-2" onclick={() => dialog.close()}>
			{i18n(I18nKey.privacyCancel, lang)}
		</button>
		<button type="button" class="btn-regular rounded-lg px-4 py-2" onclick={save}>
			{i18n(I18nKey.privacySave, lang)}
		</button>
	</div>
</dialog>
