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
};
