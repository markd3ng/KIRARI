import I18nKey from "@i18n/i18nKey";
import { i18n } from "@i18n/translation";
import {
	LinkPreset,
	type LinkPresetType,
	type NavBarLink,
} from "@/types/config";

export const LinkPresets: { [key in LinkPresetType]: NavBarLink } = {
	[LinkPreset.Home]: {
		name: i18n(I18nKey.home),
		url: "/",
	},
	[LinkPreset.About]: {
		name: i18n(I18nKey.about),
		url: "/about/",
	},
	[LinkPreset.Archive]: {
		name: i18n(I18nKey.archive),
		url: "/archive/",
	},
	[LinkPreset.Friends]: {
		name: i18n(I18nKey.friends),
		url: "/friends/",
	},
};

export function getLinkPreset(preset: LinkPresetType, lang?: string): NavBarLink {
	const link = LinkPresets[preset];
	const keyByPreset: Partial<Record<LinkPresetType, I18nKey>> = {
		[LinkPreset.Home]: I18nKey.home,
		[LinkPreset.About]: I18nKey.about,
		[LinkPreset.Archive]: I18nKey.archive,
		[LinkPreset.Friends]: I18nKey.friends,
	};
	const key = keyByPreset[preset];
	return {
		...link,
		name: key ? i18n(key, lang) : link.name,
	};
}
