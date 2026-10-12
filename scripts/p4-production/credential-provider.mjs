import { createHash } from "node:crypto";
import { C1_TARGET } from "./credential-contract.mjs";

const API = "https://api.vercel.com";
export const C1_PROVIDER_SOURCES = Object.freeze({
	project_list: `${API}/v10/projects`,
	project: `${API}/v9/projects/${C1_TARGET.project_id}`,
});
const MAX_BYTES = 2 * 1024 * 1024;

export function credentialFingerprint(token) {
	if (typeof token !== "string" || token.length < 20 || /[\u0000-\u0020\u007f]/.test(token)) throw new Error("C1_CREDENTIAL_UNAVAILABLE");
	return `sha256:${createHash("sha256").update(token).digest("hex")}`;
}

async function providerJson(path, token, fetchImpl) {
	try {
		const response = await fetchImpl(`${API}${path}`, {
			method: "GET", redirect: "error", signal: AbortSignal.timeout(15_000),
			headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
		});
		if (!response.ok) { await response.body?.cancel(); throw new Error("provider rejected credential"); }
		const reader = response.body.getReader();
		let size = 0;
		const chunks = [];
		try {
			while (true) {
				const { done, value } = await reader.read();
				if (done) break;
				size += value.byteLength;
				if (size > MAX_BYTES) { await reader.cancel(); throw new Error("provider response too large"); }
				chunks.push(Buffer.from(value));
			}
		} finally { reader.releaseLock(); }
		return JSON.parse(Buffer.concat(chunks).toString("utf8"));
	} catch { throw new Error("C1_PROVIDER_READBACK_FAILED"); }
}

function projectIdentity(value) {
	if (!value || typeof value !== "object" || Array.isArray(value)
		|| !/^prj_[A-Za-z0-9]+$/.test(value.id ?? "")
		|| !/^[a-z0-9][a-z0-9-]*$/.test(value.name ?? "")
		|| !/^team_[A-Za-z0-9]+$/.test(value.accountId ?? "")) throw new Error("C1_PROVIDER_PROJECT_INVALID");
	// Never retain the full project response: it may contain environment metadata.
	return { id: value.id, name: value.name, account_id: value.accountId };
}

/** Only project resources: scoped PATs cannot read user/team/token metadata. */
export async function readVercelCredentialObservation({ token, fetchImpl = fetch, nowMs = Date.now() } = {}) {
	const fingerprint = credentialFingerprint(token);
	const projects = [];
	const cursors = new Set();
	let cursor = null;
	let complete = false;
	for (let page = 0; page < 10; page++) {
		const query = new URLSearchParams({ limit: "100" });
		if (cursor !== null) query.set("from", String(cursor));
		// A team/search/project filter could hide access to unrelated projects.
		const data = await providerJson(`/v10/projects?${query}`, token, fetchImpl);
		if (!data || !Array.isArray(data.projects) || !data.pagination
			|| data.pagination.count !== data.projects.length || data.projects.length > 100
			|| !Object.hasOwn(data.pagination, "next")) throw new Error("C1_PROVIDER_PROJECT_LIST_INVALID");
		projects.push(...data.projects.map(projectIdentity));
		if (projects.length > 1) throw new Error("C1_PROVIDER_SCOPE_NOT_SINGLE_PROJECT");
		cursor = data.pagination.next;
		if (cursor === null) { complete = true; break; }
		// Vercel returns either a timestamp or an opaque Base32 continuation token.
		const validCursor = typeof cursor === "number" ? Number.isSafeInteger(cursor) && cursor > 0
			: typeof cursor === "string" && cursor.length <= 4096 && /^[A-Z2-7]+={0,6}$/i.test(cursor);
		if (!validCursor || cursors.has(String(cursor))) throw new Error("C1_PROVIDER_PAGINATION_INVALID");
		cursors.add(String(cursor));
	}
	if (!complete) throw new Error("C1_PROVIDER_SCOPE_READBACK_INCOMPLETE");
	const project = projectIdentity(await providerJson(`/v9/projects/${C1_TARGET.project_id}`, token, fetchImpl));
	return {
		authenticated: true, observed_at: new Date(nowMs).toISOString(),
		sources: { ...C1_PROVIDER_SOURCES }, credential_sha256: fingerprint,
		pagination_complete: true, projects, project,
	};
}
