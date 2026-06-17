import {
	AUTO_MODE,
	DARK_MODE,
	DEFAULT_THEME,
	LIGHT_MODE,
} from "@constants/constants.ts";
import { expressiveCodeConfig } from "@/config";
import type { LIGHT_DARK_MODE } from "@/types/config";

export function getDefaultHue(): number {
	const fallback = "250";
	const configCarrier = document.getElementById("config-carrier");
	const parsed = Number.parseInt(configCarrier?.dataset.hue || fallback, 10);
	return Number.isFinite(parsed) ? parsed : 250;
}

export function getHue(): number {
	const stored = localStorage.getItem("hue");
	return stored ? Number.parseInt(stored, 10) : getDefaultHue();
}

export function setHue(hue: number): void {
	localStorage.setItem("hue", String(hue));
	applyHueToDocument(hue);
}

export function applyHueToDocument(
	hue: number | string,
	targetDocument: Document = document,
): void {
	targetDocument.documentElement.style.setProperty("--hue", String(hue));
}

export function applyThemeToDocument(
	theme: LIGHT_DARK_MODE,
	targetDocument: Document = document,
): void {
	const root = targetDocument.documentElement;
	root.setAttribute("data-theme-mode", theme);
	let effectiveTheme: typeof LIGHT_MODE | typeof DARK_MODE = LIGHT_MODE;

	switch (theme) {
		case LIGHT_MODE:
			root.classList.remove("dark");
			effectiveTheme = LIGHT_MODE;
			break;
		case DARK_MODE:
			root.classList.add("dark");
			effectiveTheme = DARK_MODE;
			break;
		case AUTO_MODE:
			if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
				root.classList.add("dark");
				effectiveTheme = DARK_MODE;
			} else {
				root.classList.remove("dark");
				effectiveTheme = LIGHT_MODE;
			}
			break;
	}
	root.setAttribute("data-theme-effective", effectiveTheme);

	// Set the theme for Expressive Code (auto switch)
	const themes = expressiveCodeConfig.themes || [];
	const lightTheme = themes[0];
	const darkTheme = themes.length > 1 ? themes[1] : themes[0];

	const isDarkNow = root.classList.contains("dark");
	const autoTheme = isDarkNow ? darkTheme : lightTheme;
	if (autoTheme) {
		root.setAttribute("data-theme", autoTheme);
	}
}

export function setTheme(theme: LIGHT_DARK_MODE): void {
	localStorage.setItem("theme", theme);
	applyThemeToDocument(theme);
}

export function getStoredTheme(): LIGHT_DARK_MODE {
	return (localStorage.getItem("theme") as LIGHT_DARK_MODE) || DEFAULT_THEME;
}
