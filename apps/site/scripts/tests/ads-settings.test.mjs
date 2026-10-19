import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveAdsSettings } from "../../src/utils/ads-settings.mjs";

test("AdSense configuration stays disabled and empty unless valid identifiers are supplied", () => {
	assert.deepEqual(resolveAdsSettings(), { enable: false, publisherId: "", slots: { articleBottom: "" } });
	assert.deepEqual(resolveAdsSettings({ enable: true, publisherId: "bad", slots: { articleBottom: "javascript:1" } }), {
		enable: true,
		publisherId: "",
		slots: { articleBottom: "" },
	});
	assert.deepEqual(resolveAdsSettings({ enable: true, publisherId: "ca-pub-1234567890123456", slots: { articleBottom: "9876543210" } }), {
		enable: true,
		publisherId: "ca-pub-1234567890123456",
		slots: { articleBottom: "9876543210" },
	});
});

test("public Ads environment overrides use the same identifier validation", () => {
	const readString = (key, fallback = "") => ({
		PUBLIC_ADS_PUBLISHER_ID: "ca-pub-1234567890123456",
		PUBLIC_ADS_SLOT_ARTICLE_BOTTOM: "9876543210",
	})[key] || fallback;
	const readBoolean = (key, fallback) => key === "PUBLIC_ADS_ENABLE" ? true : fallback;
	assert.deepEqual(resolveAdsSettings({}, readString, readBoolean), {
		enable: true,
		publisherId: "ca-pub-1234567890123456",
		slots: { articleBottom: "9876543210" },
	});
});
