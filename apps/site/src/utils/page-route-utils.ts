import { Config } from "../constants";
import {
	fromLangSlug,
	getPathAlternates,
	getPrefixedLanguages,
	normalizeLangCode,
	toLangSlug,
	withLangPrefix,
	type LangCode,
} from "./i18n-utils";

export function getPrefixedStaticPaths() {
	return getPrefixedLanguages().map((lang) => ({
		params: { lang: toLangSlug(lang) },
		props: { lang },
	}));
}

export function getDefaultRouteContext(path: string) {
	const lang = normalizeLangCode(Config.i18n.defaultLang);
	return getRouteContext(path, lang);
}

export function getLocalizedRouteContext(path: string, slug?: string) {
	return getRouteContext(path, fromLangSlug(slug));
}

function getRouteContext(path: string, lang: LangCode) {
	return {
		lang,
		currentUrl: withLangPrefix(path, lang),
		alternates: getPathAlternates((itemLang) => withLangPrefix(path, itemLang)),
	};
}
