import { siteConfig } from "../config";
import type I18nKey from "./i18nKey";
import { en } from "./languages/en";
import { es } from "./languages/es";
import { id } from "./languages/id";
import { ja } from "./languages/ja";
import { ko } from "./languages/ko";
import { th } from "./languages/th";
import { tr } from "./languages/tr";
import { vi } from "./languages/vi";
import { zhCN } from "./languages/zh-CN";
import { zhTW } from "./languages/zh-TW";

export type Translation = {
	[K in I18nKey]: string;
};

const defaultTranslation = en;

const map: { [key: string]: Translation } = {
	["es-ES".toLowerCase()]: es,
	["en-US".toLowerCase()]: en,
	["zh-CN".toLowerCase()]: zhCN,
	["zh-TW".toLowerCase()]: zhTW,
	["zh-HK".toLowerCase()]: zhTW,
	["ja-JP".toLowerCase()]: ja,
	["ko-KR".toLowerCase()]: ko,
	["th-TH".toLowerCase()]: th,
	["vi-VN".toLowerCase()]: vi,
	["id-ID".toLowerCase()]: id,
	["tr-TR".toLowerCase()]: tr,
};

export function getTranslation(lang: string): Translation {
	return map[lang.toLowerCase()] || defaultTranslation;
}

export function i18n(key: I18nKey, lang?: string): string {
	lang = lang || siteConfig.lang || "en-US";
	return getTranslation(lang)[key];
}
