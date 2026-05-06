import { getCollection } from "astro:content";
import { Config } from "../constants";
import { normalizeLangCode, toLangSlug } from "./i18n-utils";

export async function getLocalizedSpecEntry(entryId: string, lang?: string) {
	const entries = await getCollection("spec");
	const normalizedLang = normalizeLangCode(lang);
	const defaultLang = normalizeLangCode(Config.i18n.defaultLang);
	const candidates = [
		`${toLangSlug(normalizedLang)}/${entryId}`,
		`${normalizedLang}/${entryId}`,
		`${normalizedLang.replace("_", "-")}/${entryId}`,
		`${normalizedLang.replace("_", "-").toLowerCase()}/${entryId}`,
		`${toLangSlug(defaultLang)}/${entryId}`,
		`${defaultLang}/${entryId}`,
		`${defaultLang.replace("_", "-")}/${entryId}`,
		`${defaultLang.replace("_", "-").toLowerCase()}/${entryId}`,
		entryId,
	];

	for (const candidate of Array.from(new Set(candidates))) {
		const entry = entries.find((item) => item.id === candidate);
		if (entry) return entry;
	}

	return undefined;
}
