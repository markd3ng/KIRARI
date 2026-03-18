import type { OGApiConfig } from "@/types/og-config";
import type { OgApiPayload } from "./og-payload";

const DEFAULT_TIMEOUT_MS = 30000;
const DEFAULT_RETRY = 3;

function normalizeTimeout(timeoutMs?: number): number {
	if (!timeoutMs || timeoutMs <= 0) return DEFAULT_TIMEOUT_MS;
	return timeoutMs;
}

function normalizeRetry(retry?: number): number {
	if (retry === undefined || retry === null) return DEFAULT_RETRY;
	if (retry < 0) return 0;
	return Math.floor(retry);
}

async function fetchWithTimeout(
	input: string,
	init: RequestInit,
	timeoutMs: number
): Promise<Response> {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), timeoutMs);

	try {
		return await fetch(input, {
			...init,
			signal: controller.signal,
		});
	} finally {
		clearTimeout(timer);
	}
}

function clipText(value: string, max = 200): string {
	if (value.length <= max) return value;
	return `${value.slice(0, max)}...`;
}

async function parseErrorSnippet(response: Response): Promise<string> {
	try {
		const text = await response.text();
		return clipText(text.replace(/\s+/g, " ").trim());
	} catch {
		return "unable to parse response body";
	}
}

export async function requestOgImageFromApi(
	payload: OgApiPayload,
	apiConfig: OGApiConfig,
	slug: string
): Promise<Buffer> {
	const timeoutMs = normalizeTimeout(apiConfig.timeoutMs);
	const maxRetry = normalizeRetry(apiConfig.retry);
	let lastError: unknown;

	for (let attempt = 0; attempt <= maxRetry; attempt++) {
		try {
			const response = await fetchWithTimeout(
				apiConfig.endpoint,
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Accept: "image/png,image/*;q=0.9",
					},
					body: JSON.stringify(payload),
				},
				timeoutMs
			);

			if (!response.ok) {
				const snippet = await parseErrorSnippet(response);
				throw new Error(
					`OG API returned ${response.status} for slug=${slug}. body=${snippet}`
				);
			}

			const contentType = response.headers.get("content-type") || "";
			if (!contentType.toLowerCase().includes("image")) {
				const snippet = await parseErrorSnippet(response);
				throw new Error(
					`OG API invalid content-type (${contentType || "unknown"}) for slug=${slug}. body=${snippet}`
				);
			}

			const arrayBuffer = await response.arrayBuffer();
			if (arrayBuffer.byteLength === 0) {
				throw new Error(`OG API returned empty image for slug=${slug}`);
			}

			return Buffer.from(arrayBuffer);
		} catch (error) {
			lastError = error;
			if (attempt === maxRetry) break;
		}
	}

	throw lastError instanceof Error
		? lastError
		: new Error(`Unknown OG API error for slug=${slug}`);
}
