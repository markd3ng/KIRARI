import assert from "node:assert/strict";
import { test } from "node:test";
import { C1_TARGET } from "../p4-production/credential-contract.mjs";
import { credentialFingerprint, readVercelCredentialObservation } from "../p4-production/credential-provider.mjs";

// Synthetic fixture only; never use a real credential in tests.
const token = "vcp_SYNTHETIC_TEST_VALUE_NOT_A_REAL_TOKEN";
const project = () => ({ id: C1_TARGET.project_id, name: C1_TARGET.project, accountId: C1_TARGET.team_id, env: [{ value: token }] });
const page = (projects = [project()], next = null) => ({ projects, pagination: { count: projects.length, next, prev: null } });
const response = data => new Response(JSON.stringify(data), { status: 200 });
function fetcher(pages = [page()], single = project()) {
 const calls = [];
 return { calls, fetchImpl: async (url, options) => {
  const u = new URL(url); calls.push({ url: u, options });
  if (u.pathname === "/v10/projects") return response(pages.shift());
  assert.equal(u.pathname, `/v9/projects/${C1_TARGET.project_id}`);
  return response(single);
 } };
}

test("scoped reader authenticates only unfiltered project resources and retains no raw environment/token data", async () => {
 const f = fetcher(); const observed = await readVercelCredentialObservation({ token, ...f });
 assert.equal(observed.authenticated, true); assert.equal(observed.pagination_complete, true);
 assert.equal(observed.credential_sha256, credentialFingerprint(token));
 assert.deepEqual(observed.projects, [{ id: C1_TARGET.project_id, name: C1_TARGET.project, account_id: C1_TARGET.team_id }]);
 assert.equal(JSON.stringify(observed).includes(token), false);
 assert.equal(JSON.stringify(observed).includes('"env"'), false);
 assert.equal(f.calls.length, 2);
 for (const { url, options } of f.calls) {
  assert.equal(options.method, "GET"); assert.equal(options.redirect, "error");
  assert.equal(options.headers.Authorization, `Bearer ${token}`);
  assert.equal(url.searchParams.has("teamId"), false); assert.equal(url.searchParams.has("search"), false);
 }
});

for (const cursor of [10, "JBSWY3DPEHPK3PXP"]) test(`scope readback completes pages with ${typeof cursor} cursors and rejects a hidden later project`, async () => {
 const scoped = fetcher([page([], cursor), page([project()])]);
 const observed = await readVercelCredentialObservation({ token, ...scoped });
 assert.equal(observed.pagination_complete, true);
 assert.equal(observed.projects.length, 1);
 assert.equal(scoped.calls[1].url.searchParams.get("from"), String(cursor));
 const broad = fetcher([page([project()], cursor), page([{ ...project(), id: "prj_unrelated" }])]);
 await assert.rejects(readVercelCredentialObservation({ token, ...broad }), /SCOPE_NOT_SINGLE_PROJECT/);
 assert.equal(broad.calls[1].url.searchParams.get("from"), String(cursor));
 assert.equal(broad.calls.length, 2);
});

for (const [name, pages, single, code] of [
 ["two projects", [page([project(), { ...project(), id: "prj_other" }])], project(), "SCOPE_NOT_SINGLE_PROJECT"],
 ["missing pagination", [{ projects: [project()] }], project(), "PROJECT_LIST_INVALID"],
 ["missing completion marker", [{ projects: [project()], pagination: { count: 1 } }], project(), "PROJECT_LIST_INVALID"],
 ["wrong count", [{ projects: [project()], pagination: { count: 0, next: null } }], project(), "PROJECT_LIST_INVALID"],
 ["malformed project", [page([{}])], project(), "PROJECT_INVALID"],
 ["malformed cursor", [page([], "invalid/cursor")], project(), "PAGINATION_INVALID"],
 ["empty cursor", [page([], "")], project(), "PAGINATION_INVALID"],
 ["oversized cursor", [page([], "A".repeat(4097))], project(), "PAGINATION_INVALID"],
 ["repeated cursor", [page([], 10), page([], 10)], project(), "PAGINATION_INVALID"],
 ["repeated continuation token", [page([], "JBSWY3DPEHPK3PXP"), page([], "JBSWY3DPEHPK3PXP")], project(), "PAGINATION_INVALID"],
 ["unbounded pages", Array.from({ length: 10 }, (_, i) => page([], i + 1)), project(), "READBACK_INCOMPLETE"],
 ["malformed project read", [page()], null, "PROJECT_INVALID"],
]) test(`reader fails closed for ${name}`, async () => {
 await assert.rejects(readVercelCredentialObservation({ token, ...fetcher(pages, single) }), new RegExp(code));
});

for (const status of [401, 403, 404, 429, 500]) test(`provider rejection ${status}, including revoked/expired token, is sanitized failure`, async () => {
 let calls = 0;
 await assert.rejects(readVercelCredentialObservation({ token, fetchImpl: async () => { calls++; return new Response(token, { status }); } }), error => error.message === "C1_PROVIDER_READBACK_FAILED" && !error.message.includes(token));
 assert.equal(calls, 1);
});

test("invalid JSON, redirect/network failures and oversized responses are rejected without raw errors", async () => {
 for (const fetchImpl of [
  async () => new Response("{broken"),
  async () => { throw new Error(token); },
  async () => new Response("x".repeat(2 * 1024 * 1024 + 1)),
 ]) await assert.rejects(readVercelCredentialObservation({ token, fetchImpl }), /C1_PROVIDER_READBACK_FAILED/);
});
