import type { AdsConfig } from "../types/config";
import { readPrivacySettings } from "./privacy-settings.mjs";
import { transitionManager } from "./transition-manager";

type AdsWindow = Window & { adsbygoogle?: unknown[] };

let initialized = false;
let scriptPromise: Promise<boolean> | undefined;

export function initializeAds(): void {
	if (initialized) return;
	initialized = true;
	const node = document.getElementById("kirari-ads-config");
	const rawConfig = node?.dataset.config;
	if (!rawConfig) return;

	let config: AdsConfig;
	try {
		config = JSON.parse(rawConfig) as AdsConfig;
	} catch {
		return;
	}
	const render = () => renderSlots(config);
	render();
	transitionManager.on("transition:after-swap", render);
}

async function renderSlots(config: AdsConfig): Promise<void> {
	const slots = Array.from(document.querySelectorAll<HTMLElement>("[data-kirari-ad-slot] .adsbygoogle:not([data-kirari-ad-initialized])"));
	if (!config.enable || !config.publisherId || !config.slots.articleBottom || !readPrivacySettings().ads) {
		document.querySelectorAll<HTMLElement>("[data-kirari-ad-slot]").forEach((slot) => { slot.hidden = true; });
		return;
	}
	if (slots.length === 0) return;
	const loaded = await loadAdScript(config.publisherId);
	if (!loaded) {
		document.querySelectorAll<HTMLElement>("[data-kirari-ad-slot]").forEach((slot) => { slot.hidden = true; });
		return;
	}
	const ads = (window as AdsWindow).adsbygoogle || ((window as AdsWindow).adsbygoogle = []);
	for (const slot of slots) {
		slot.dataset.kirariAdInitialized = "true";
		try {
			ads.push({});
		} catch {
			slot.closest<HTMLElement>("[data-kirari-ad-slot]")?.setAttribute("hidden", "");
		}
	}
}

function loadAdScript(publisherId: string): Promise<boolean> {
	if (scriptPromise) return scriptPromise;
	scriptPromise = new Promise((resolve) => {
		const script = document.createElement("script");
		script.async = true;
		script.crossOrigin = "anonymous";
		script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(publisherId)}`;
		script.addEventListener("load", () => resolve(true), { once: true });
		script.addEventListener("error", () => resolve(false), { once: true });
		document.head.appendChild(script);
	});
	return scriptPromise;
}
