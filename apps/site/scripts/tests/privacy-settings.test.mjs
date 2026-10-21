import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULT_PRIVACY_SETTINGS, PRIVACY_SETTINGS_KEY, parsePrivacySettings, readPrivacySettings, savePrivacySettings } from "../../src/utils/privacy-settings.mjs";

test("missing visitor choice allows configured categories by default", () => {
	assert.deepEqual(parsePrivacySettings(null), DEFAULT_PRIVACY_SETTINGS);
	assert.deepEqual(readPrivacySettings({ getItem: () => null }), DEFAULT_PRIVACY_SETTINGS);
});

test("saved category choices persist independently and malformed choices fail closed", () => {
	const values = new Map();
	const storage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
	savePrivacySettings({ analytics: false, ads: true }, storage);
	assert.deepEqual(JSON.parse(values.get(PRIVACY_SETTINGS_KEY)), { version: 1, analytics: false, ads: true });
	assert.deepEqual(readPrivacySettings(storage), { analytics: false, ads: true });
	assert.deepEqual(parsePrivacySettings("not-json"), { analytics: false, ads: false });
	assert.deepEqual(parsePrivacySettings('{"version":1,"analytics":false}'), { analytics: false, ads: false });
});

test("unavailable storage fails closed and invalid saves are rejected", () => {
	assert.deepEqual(readPrivacySettings({ getItem() { throw new Error("blocked"); } }), { analytics: false, ads: false });
	assert.throws(() => savePrivacySettings({ analytics: "yes", ads: true }, { setItem() {} }), /must contain boolean/);
	assert.throws(() => savePrivacySettings({ analytics: false, ads: true }, { setItem() { throw new Error("blocked"); } }), /blocked/);
});
