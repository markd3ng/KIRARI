export function resolveAdsSettings(raw = {}, readString = envString, readBoolean = envBoolean) {
	const publisherId = readString("PUBLIC_ADS_PUBLISHER_ID", text(raw.publisherId));
	const articleBottom = readString("PUBLIC_ADS_SLOT_ARTICLE_BOTTOM", text(raw.slots?.articleBottom));
	return {
		enable: readBoolean("PUBLIC_ADS_ENABLE", raw.enable === true),
		publisherId: /^ca-pub-\d{16}$/.test(publisherId) ? publisherId : "",
		slots: {
			articleBottom: /^\d{1,20}$/.test(articleBottom) ? articleBottom : "",
		},
	};
}

function text(value) {
	return typeof value === "string" ? value.trim() : "";
}

function envString(key, fallback = "") {
	const value = process.env[key]?.trim();
	return value || fallback;
}

function envBoolean(key, fallback) {
	const value = process.env[key]?.trim().toLowerCase();
	if (["true", "1", "yes", "on"].includes(value)) return true;
	if (["false", "0", "no", "off"].includes(value)) return false;
	return fallback;
}
