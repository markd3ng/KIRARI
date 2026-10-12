import assert from "node:assert/strict";
import { test } from "node:test";
import { readConcreteOwnerDecision } from "../p4-production/owner-decision.mjs";

const digest = `sha256:${"a".repeat(64)}`;
const now = Date.parse("2026-10-05T15:00:00Z");
function fixture() {
	const decision = { schema_version: 1, kind: "C1_CONCRETE_CREDENTIAL_MANIFEST", decision: "APPROVED", manifest_sha256: digest, expires_at: "2026-10-07T15:00:00Z" };
	const comment = { id: 10, user: { login: "markd3ng", type: "User" }, author_association: "OWNER", issue_url: "https://api.github.com/repos/markd3ng/KIRARI/issues/129", html_url: "https://github.com/markd3ng/KIRARI/issues/129#issuecomment-10", created_at: "2026-10-05T14:50:00Z", updated_at: "2026-10-05T14:50:00Z", body: JSON.stringify(decision) };
	return { decision, comment, args: { kind: decision.kind, manifestDigest: digest, reference: { status: "APPROVED", issue_number: 129, comment_id: 10 }, token: "test-only", now, fetchImpl: async url => new Response(JSON.stringify(String(url).includes("/issues/comments/") ? comment : [comment])) } };
}

test("a concrete decision requires current authenticated exact Owner JSON and digest", async () => {
	const { args } = fixture();
	assert.equal((await readConcreteOwnerDecision(args)).authenticated, true);
});

for (const [label, mutate] of [
	["policy approval cannot approve a concrete digest", f => { f.comment.body = "C1_POLICY_FRAMEWORK=APPROVED"; }],
	["local approval does not survive revoked remote decision", f => { f.decision.decision = "REVOKED"; }],
	["wrong manifest", f => { f.decision.manifest_sha256 = `sha256:${"b".repeat(64)}`; }],
	["expired", f => { f.decision.expires_at = "2026-10-05T14:59:59Z"; }],
	["no expiry", f => { delete f.decision.expires_at; }],
	["unknown actor", f => { f.comment.user.login = "other"; }],
	["wrong issue", f => { f.comment.issue_url = "https://api.github.com/repos/markd3ng/KIRARI/issues/130"; }],
	["unexpected approval field", f => { f.decision.production_authorization = true; }],
	["redirect or API read failure", f => { f.args.fetchImpl = async () => new Response("", { status: 403 }); }],
]) test(`Owner decision rejects ${label}`, async () => {
	const f = fixture(); mutate(f);
	if (!label.startsWith("policy")) f.comment.body = JSON.stringify(f.decision);
	await assert.rejects(readConcreteOwnerDecision(f.args));
});

test("PENDING concrete approval fails without calling remote API", async () => {
	const f = fixture(); let calls = 0;
	f.args.reference.status = "PENDING";
	f.args.fetchImpl = async () => { calls++; throw new Error("unexpected request"); };
	await assert.rejects(readConcreteOwnerDecision(f.args), /PENDING/);
	assert.equal(calls, 0);
});


test("a later Owner comment invalidates a concrete decision, including on the next page", async () => {
	const f = fixture();
	f.args.fetchImpl = async url => {
		const u = String(url);
		if (u.includes("/issues/comments/")) return new Response(JSON.stringify(f.comment));
		if (new URL(u).searchParams.get("page") === "1") return new Response(JSON.stringify(Array.from({length:100},(_,i)=>({id:100+i,user:{login:"reviewer",type:"User"}}))));
		return new Response(JSON.stringify([{id:999,user:{login:"markd3ng",type:"User"},created_at:"2026-10-05T14:55:00Z",body:"Re-review this before use"}]));
	};
	await assert.rejects(readConcreteOwnerDecision(f.args), /RE_REVIEW_REQUIRED/);
});

test("an unreadable revocation scan fails closed", async () => {
	const f = fixture();
	f.args.fetchImpl = async url => String(url).includes("/issues/comments/") ? new Response(JSON.stringify(f.comment)) : new Response("",{status:403});
	await assert.rejects(readConcreteOwnerDecision(f.args), /REVOCATION_READBACK_FAILED/);
});


test("edited then restored approval requires a new decision", async () => {
	const f = fixture();f.comment.updated_at="2026-10-05T14:55:00Z";
	await assert.rejects(readConcreteOwnerDecision(f.args),/EDITED_RE_REVIEW_REQUIRED/);
});
