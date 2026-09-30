import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { webcrypto } from "node:crypto";

const crypto = globalThis.crypto || webcrypto;

export function canSubmitIndexingNotifications(env = process.env) {
	// External-source, build-only, and test modes veto even explicit opt-in.
	return !env.KIRARI_SITE_SOURCE &&
		env.KIRARI_BUILD_ONLY !== "true" &&
		env.NODE_ENV !== "test" &&
		env.KIRARI_ALLOW_INDEXING_SUBMISSIONS === "true";
}

export async function submitIndexingNotifications({ config, distDir, siteUrl, basePath, env = process.env }) {
	if (!canSubmitIndexingNotifications(env)) return false;

	await submitIndexNow({ config, distDir, siteUrl, basePath, env });
	await submitGoogleIndexing({ config, distDir, env });
	return true;
}

async function submitIndexNow({ config, distDir, siteUrl, basePath, env }) {
	const enabled = env.PUBLIC_INDEXNOW_ENABLE === "true" || getTomlBool(config, "seo", "indexNow", false);
	const key = env.PUBLIC_INDEXNOW_KEY || getTomlString(config, "seo", "indexNowKey");
	if (!enabled || !key) return;

	writeFileSync(join(distDir, `${key}.txt`), key);
	const urls = sitemapUrls(distDir);
	if (urls.length === 0) return;
	const response = await fetch("https://api.indexnow.org/indexnow", {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({
			host: new URL(siteUrl).host,
			key,
			keyLocation: `${siteUrl}${basePath}${key}.txt`.replace(/([^:]\/)\/+/g, "$1"),
			urlList: urls,
		}),
	});
	if (!response.ok) {
		console.warn(`[postbuild] IndexNow submission failed: ${response.status} ${response.statusText}`);
	}
}

async function createGoogleAccessToken(serviceAccountJson) {
	const header = base64UrlEncode(JSON.stringify({ alg: "RS256", typ: "JWT" }));
	const now = Math.floor(Date.now() / 1000);
	const payload = base64UrlEncode(JSON.stringify({
		iss: serviceAccountJson.client_email,
		scope: "https://www.googleapis.com/auth/indexing",
		aud: "https://oauth2.googleapis.com/token",
		iat: now,
		exp: now + 3600,
	}));
	const key = await crypto.subtle.importKey(
		"pkcs8",
		Buffer.from(serviceAccountJson.private_key.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, ""), "base64"),
		{ name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
		false,
		["sign"],
	);
	const signature = await crypto.subtle.sign(
		"RSASSA-PKCS1-v1_5",
		key,
		new TextEncoder().encode(`${header}.${payload}`),
	);
	const assertion = `${header}.${payload}.${base64UrlEncode(Buffer.from(signature))}`;
	const response = await fetch("https://oauth2.googleapis.com/token", {
		method: "POST",
		headers: { "content-type": "application/x-www-form-urlencoded" },
		body: new URLSearchParams({
			grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
			assertion,
		}),
	});
	if (!response.ok) {
		throw new Error(`Google OAuth token request failed: ${response.status} ${response.statusText}`);
	}
	const data = await response.json();
	if (!data.access_token) throw new Error("Google OAuth token response did not include access_token.");
	return data.access_token;
}

async function submitGoogleIndexing({ config, distDir, env }) {
	if (!getTomlBool(config, "seo.google", "indexingApi", false)) return;

	const envName = getTomlString(config, "seo.google", "serviceAccountJsonEnv", "GOOGLE_INDEXING_SERVICE_ACCOUNT_JSON");
	const rawCredentials = env[envName];
	if (!rawCredentials) {
		console.warn(`[postbuild] Google Indexing API enabled but ${envName} is not set.`);
		return;
	}

	try {
		const serviceAccountJson = JSON.parse(rawCredentials);
		if (!serviceAccountJson.client_email || !serviceAccountJson.private_key) {
			console.warn(`[postbuild] Google Indexing API skipped: ${envName} is missing client_email or private_key.`);
			return;
		}
		const token = await createGoogleAccessToken(serviceAccountJson);
		for (const url of sitemapUrls(distDir)) {
			const response = await fetch("https://indexing.googleapis.com/v3/urlNotifications:publish", {
				method: "POST",
				headers: {
					authorization: `Bearer ${token}`,
					"content-type": "application/json",
				},
				body: JSON.stringify({ url, type: "URL_UPDATED" }),
			});
			if (!response.ok) {
				console.warn(`[postbuild] Google Indexing API submission failed for ${url}: ${response.status} ${response.statusText}`);
			}
		}
	} catch (error) {
		console.warn("[postbuild] Google Indexing API submission skipped:", error);
	}
}

function sitemapUrls(distDir) {
	const urls = [];
	for (const file of walk(distDir).filter((path) => path.endsWith(".xml") && basename(path).includes("sitemap"))) {
		const xml = readFileSync(file, "utf8");
		for (const match of xml.matchAll(/<loc>(.*?)<\/loc>/g)) urls.push(match[1]);
	}
	return Array.from(new Set(urls.filter((url) => !url.endsWith(".xml"))));
}

function walk(dir) {
	if (!existsSync(dir)) return [];
	return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
		const fullPath = join(dir, entry.name);
		return entry.isDirectory() ? walk(fullPath) : [fullPath];
	});
}

function getTomlBool(config, section, key, fallback = false) {
	const value = getTomlValue(config, section, key);
	return typeof value === "boolean" ? value : fallback;
}

function getTomlString(config, section, key, fallback = "") {
	const value = getTomlValue(config, section, key);
	return typeof value === "string" ? value : fallback;
}

function getTomlValue(config, section, key) {
	let current = config;
	for (const part of section.split(".")) {
		if (!current || typeof current !== "object") return undefined;
		current = current[part];
	}
	if (!current || typeof current !== "object") return undefined;
	return current[key];
}

function base64UrlEncode(value) {
	return Buffer.from(value)
		.toString("base64")
		.replace(/=/g, "")
		.replace(/\+/g, "-")
		.replace(/\//g, "_");
}
