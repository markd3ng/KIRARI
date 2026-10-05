const API = "https://api.github.com/repos/markd3ng/KIRARI/issues/comments/";
const KINDS = { T1_CONCRETE_TOOLING_MANIFEST: 130, C1_CONCRETE_CREDENTIAL_MANIFEST: 129 };

/** Read the current Owner decision, rather than trusting a local approval flag. */
export async function readConcreteOwnerDecision({ kind, manifestDigest, reference, token, fetchImpl = fetch, now = Date.now() }) {
	if (!Object.hasOwn(KINDS, kind) || !/^sha256:[a-f0-9]{64}$/.test(manifestDigest ?? "")) throw new Error("CONCRETE_DECISION_IDENTITY_INVALID");
	if (!reference || reference.status !== "APPROVED" || reference.issue_number !== KINDS[kind] || !Number.isSafeInteger(reference.comment_id) || reference.comment_id <= 0) throw new Error("CONCRETE_OWNER_APPROVAL_PENDING");
	if (typeof token !== "string" || !token) throw new Error("CONCRETE_OWNER_DECISION_READBACK_UNAVAILABLE");
	const response = await fetchImpl(`${API}${reference.comment_id}`, {
		headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${token}`, "X-GitHub-Api-Version": "2022-11-28" },
		redirect: "error", signal: AbortSignal.timeout(15_000),
	});
	if (!response.ok) throw new Error("CONCRETE_OWNER_DECISION_READBACK_FAILED");
	const text = await response.text();
	if (text.length > 65_536) throw new Error("CONCRETE_OWNER_DECISION_TOO_LARGE");
	const comment = JSON.parse(text);
	if (comment.id !== reference.comment_id || comment.user?.login !== "markd3ng" || comment.user?.type !== "User" || comment.author_association !== "OWNER" || comment.is_minimized === true || comment.issue_url !== `https://api.github.com/repos/markd3ng/KIRARI/issues/${KINDS[kind]}` || comment.html_url !== `https://github.com/markd3ng/KIRARI/issues/${KINDS[kind]}#issuecomment-${comment.id}`) throw new Error("CONCRETE_OWNER_DECISION_AUTHOR_OR_ISSUE_INVALID");
	// The entire comment is this decision JSON. Prose mentioning a digest is not approval.
	const decision = JSON.parse(comment.body);
	const keys = ["schema_version", "kind", "decision", "manifest_sha256", "expires_at"];
	if (!decision || Object.keys(decision).sort().join() !== keys.sort().join() || decision.schema_version !== 1 || decision.kind !== kind || decision.decision !== "APPROVED" || decision.manifest_sha256 !== manifestDigest) throw new Error("CONCRETE_OWNER_DECISION_BINDING_INVALID");
	const expires = Date.parse(decision.expires_at);
	if (typeof decision.expires_at !== "string" || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/.test(decision.expires_at) || !Number.isFinite(expires) || expires <= now) throw new Error("CONCRETE_OWNER_DECISION_EXPIRED_OR_UNBOUNDED");
	const issued = Date.parse(comment.created_at);
	if (!Number.isFinite(issued) || issued > now) throw new Error("CONCRETE_OWNER_DECISION_TIMESTAMP_INVALID");
	if (comment.updated_at !== comment.created_at) throw new Error("CONCRETE_OWNER_DECISION_EDITED_RE_REVIEW_REQUIRED");
	// Any later Owner statement requires re-review. This also catches prose revocation
	// without guessing its meaning, and never inherits an old risk acceptance.
	let complete = false;
	for (let page = 1; page <= 20; page++) {
		const url = new URL(`https://api.github.com/repos/markd3ng/KIRARI/issues/${KINDS[kind]}/comments`);
		url.searchParams.set("per_page", "100"); url.searchParams.set("page", String(page));
		const scan = await fetchImpl(url, { headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${token}`, "X-GitHub-Api-Version": "2022-11-28" }, redirect: "error", signal: AbortSignal.timeout(15_000) });
		if (!scan.ok) throw new Error("CONCRETE_OWNER_REVOCATION_READBACK_FAILED");
		const bytes = await scan.text();
		if (bytes.length > 4 * 1024 * 1024) throw new Error("CONCRETE_OWNER_REVOCATION_SCAN_TOO_LARGE");
		const comments = JSON.parse(bytes);
		if (!Array.isArray(comments)) throw new Error("CONCRETE_OWNER_REVOCATION_SCAN_INVALID");
		for (const later of comments) {
			if (later.id !== comment.id && later.user?.login === "markd3ng" && later.user?.type === "User") {
				const changed = Date.parse(later.updated_at ?? later.created_at);
				if (!Number.isFinite(changed) || changed >= issued) throw new Error("CONCRETE_OWNER_DECISION_RE_REVIEW_REQUIRED");
			}
		}
		if (comments.length < 100) { complete = true; break; }
	}
	if (!complete) throw new Error("CONCRETE_OWNER_REVOCATION_SCAN_INCOMPLETE");
	return { ...decision, owner: "markd3ng", comment_id: comment.id, issue_number: KINDS[kind], comment_url: comment.html_url, authenticated: true, revocation_status: "CLEAR", revocation_checked_at: new Date(now).toISOString() };
}
