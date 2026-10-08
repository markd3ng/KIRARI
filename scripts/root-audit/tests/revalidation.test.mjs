import assert from 'node:assert/strict';
import test from 'node:test';
import { listCandidateHeadsAcrossPages, revokeCachedSuccesses } from '../revalidation.mjs';
import { runRevocation, validateRevocationSource } from '../revalidation-cli.mjs';
import { MERGE_ADMISSION_BLOCKED } from '../publisher-contract.mjs';

const APP_ID = 7654321;
const HEAD = 'a'.repeat(40);
const SECOND_HEAD = 'b'.repeat(40);
const MAIN = 'c'.repeat(40);
const green = (overrides = {}) => ({ id: 1, name: 'KIRARI / R3 trusted verifier', head_sha: HEAD, app: { id: APP_ID }, status: 'completed', conclusion: 'success', ...overrides });

function fixture({ checks = [green()], heads = [HEAD], failure = null } = {}) {
  const state = structuredClone(checks);
  const patches = [];
  const adapter = {
    async listCandidateHeads() { return heads; },
    async listChecks(head) { return state.filter((check) => check.head_sha === head); },
    async updateCheck(id, patch) {
      patches.push({ id, patch });
      if (failure) throw new Error(failure);
      const check = state.find((item) => item.id === id);
      Object.assign(check, patch);
      return check;
    },
  };
  return { state, adapter, patches };
}

test('revocation retires previously green and legacy checks without renewable success', async () => {
  const { adapter, patches, state } = fixture();
  const result = await revokeCachedSuccesses({ appId: APP_ID, adapter });
  assert.equal(result.successesInvalidated, 1);
  assert.equal(result.allObservedSuccessesInvalidated, true);
  assert.equal(result.requiredCheckSuccessAllowed, false);
  assert.equal(state[0].conclusion, 'failure');
  assert.equal(patches[0].patch.output.summary, MERGE_ADMISSION_BLOCKED);
  assert.ok(patches.every(({ patch }) => patch.conclusion === 'failure'));
  const repeat = await revokeCachedSuccesses({ appId: APP_ID, adapter });
  assert.equal(repeat.successesInvalidated, 0);
  assert.equal(patches.length, 1);
});

test('same-name Actions checks, other Apps, and old candidate heads cannot impersonate the configured App', async () => {
  const checks = [green({ id: 1, app: { id: 15368 } }), green({ id: 2, app: { id: APP_ID + 1 } }), green({ id: 3, head_sha: SECOND_HEAD })];
  const { adapter, patches } = fixture({ checks });
  await revokeCachedSuccesses({ appId: APP_ID, adapter });
  assert.equal(patches.length, 0);
});

test('App outage or installation revocation cannot be reported as completed invalidation', async (t) => {
  for (const error of ['API timeout', 'GitHub API request failed with HTTP 401', 'GitHub API request failed with HTTP 403']) {
    await t.test(error, async () => {
      const { adapter, state } = fixture({ failure: error });
      const result = await revokeCachedSuccesses({ appId: APP_ID, adapter });
      assert.equal(result.allObservedSuccessesInvalidated, false);
      assert.equal(result.failures.length, 1);
      assert.equal(state[0].conclusion, 'success', 'outage leaves legacy cached green visible; no enforcement guarantee is claimed');
      assert.equal(result.requiredCheckSuccessAllowed, false);
    });
  }
});

test('one candidate API failure does not prevent invalidation on other observed candidates', async () => {
  const { adapter, state } = fixture({ heads: [HEAD, SECOND_HEAD], checks: [green({ head_sha: SECOND_HEAD })] });
  const list = adapter.listChecks;
  adapter.listChecks = async (head) => { if (head === HEAD) throw new Error('API unavailable'); return list(head); };
  const result = await revokeCachedSuccesses({ appId: APP_ID, adapter });
  assert.equal(result.failures.length, 1);
  assert.equal(result.successesInvalidated, 1);
  assert.equal(result.allObservedSuccessesInvalidated, false);
  assert.equal(state[0].conclusion, 'failure');
});

test('concurrent or cached success observed after PATCH prevents complete-invalidation claim', async () => {
  const { adapter } = fixture();
  let reads = 0;
  adapter.listChecks = async () => ++reads === 1 ? [green()] : [green({ id: 2 })];
  const result = await revokeCachedSuccesses({ appId: APP_ID, adapter });
  assert.equal(result.allObservedSuccessesInvalidated, false);
  assert.match(result.failures[0].message, /remains or appeared/);
});

test('incorrect App PATCH identity and duplicate check IDs fail closed', async () => {
  const wrong = fixture();
  wrong.adapter.updateCheck = async (id, patch) => green({ id, ...patch, app: { id: 15368 } });
  assert.equal((await revokeCachedSuccesses({ appId: APP_ID, adapter: wrong.adapter })).allObservedSuccessesInvalidated, false);
  const duplicate = fixture({ checks: [green(), green()] });
  assert.equal((await revokeCachedSuccesses({ appId: APP_ID, adapter: duplicate.adapter })).allObservedSuccessesInvalidated, false);
});

test('candidate head pagination covers complete pages and rejects malformed or unbounded inventory', async () => {
  const row = (number, sha = HEAD) => ({ number, base: { ref: 'main' }, head: { sha } });
  const heads = await listCandidateHeadsAcrossPages(async (page) => page === 1 ? [row(133)] : [], { pageSize: 1 });
  assert.deepEqual(heads, [HEAD]);
  await assert.rejects(listCandidateHeadsAcrossPages(async () => [row(133)], { pageSize: 1, maximumPages: 2 }), /duplicate/);
  await assert.rejects(listCandidateHeadsAcrossPages(async () => [row(133, 'bad')]), /invalid/);
  await assert.rejects(listCandidateHeadsAcrossPages(async () => [row(133)], { pageSize: 1, maximumPages: 1 }), /pagination bound/);
});

function environment() {
  return { GITHUB_REPOSITORY: 'markd3ng/KIRARI', GITHUB_REPOSITORY_ID: '123456789', GITHUB_REF: 'refs/heads/main',
    R3_PUBLISHER_ENABLED: 'true',
    GITHUB_EVENT_NAME: 'workflow_dispatch', GITHUB_WORKFLOW_REF: 'markd3ng/KIRARI/.github/workflows/r3-authorization-revalidation.yml@refs/heads/main',
    GITHUB_SHA: MAIN, GITHUB_WORKFLOW_SHA: MAIN, GITHUB_API_URL: 'https://api.github.com', GH_TOKEN: 'read-only-test-token-at-least20', R3_PUBLISHER_APP_ID: String(APP_ID) };
}

test('revocation source refuses PR refs, unrelated workflows, unsupported events, missing read credentials, and stale main', async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async (url) => new Response(JSON.stringify(String(url).endsWith('/branches/main') ? { commit: { sha: MAIN } } : { id: 123456789, full_name: 'markd3ng/KIRARI' }));
  assert.equal((await validateRevocationSource(environment())).mainSha, MAIN);
  for (const drift of [{ R3_PUBLISHER_ENABLED: undefined }, { R3_PUBLISHER_ENABLED: 'false' }, { GITHUB_REF: 'refs/pull/133/merge' }, { GITHUB_EVENT_NAME: 'pull_request' }, { GH_TOKEN: '' }, { GITHUB_WORKFLOW_REF: 'untrusted' }]) {
    await assert.rejects(validateRevocationSource({ ...environment(), ...drift }));
  }
  globalThis.fetch = async () => new Response(JSON.stringify({ commit: { sha: SECOND_HEAD }, id: 123456789, full_name: 'markd3ng/KIRARI' }));
  await assert.rejects(validateRevocationSource(environment()), /not current trusted main/);
});

test('missing App credentials or failed GitHub reads cannot claim cached checks invalidated', async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async (url) => new Response(JSON.stringify(String(url).endsWith('/branches/main') ? { commit: { sha: MAIN } } : { id: 123456789, full_name: 'markd3ng/KIRARI' }));
  await assert.rejects(runRevocation({ mode: 'revoke', env: environment() }), /token is unavailable; cached checks could not be invalidated/);
  const preflight = await runRevocation({ mode: 'preflight', env: environment() });
  assert.equal(preflight.credentialsAccessed, false);
  globalThis.fetch = async () => new Response('unavailable', { status: 503 });
  await assert.rejects(runRevocation({ mode: 'revoke', env: { ...environment(), R3_APP_TOKEN: 'installation-token-at-least20' } }), /HTTP 503/);
});

test('revocation defaults off before any API or credential-bearing operation', async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async () => assert.fail('disabled operations cannot access API or credentials');
  const disabled = { ...environment(), R3_PUBLISHER_ENABLED: undefined, R3_APP_TOKEN: 'installation-token-at-least20' };
  await assert.rejects(runRevocation({ mode: 'preflight', env: disabled }), /operations are disabled/);
  await assert.rejects(runRevocation({ mode: 'revoke', env: disabled }), /operations are disabled/);
});

test('revocation CLI uses all check attempts and never sends a success or create payload', async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  let check = green();
  const methods = [];
  globalThis.fetch = async (url, options) => {
    const parsed = new URL(url); methods.push(options.method);
    assert.equal(options.cache, 'no-store');
    if (parsed.pathname.endsWith('/branches/main')) return new Response(JSON.stringify({ commit: { sha: MAIN } }));
    if (parsed.pathname.endsWith('/pulls')) return new Response(JSON.stringify([{ number: 133, base: { ref: 'main' }, head: { sha: HEAD } }]));
    if (parsed.pathname.endsWith('/commits/' + HEAD + '/check-runs')) {
      assert.equal(parsed.searchParams.get('filter'), 'all');
      return new Response(JSON.stringify({ total_count: 1, check_runs: [check] }));
    }
    if (options.method === 'PATCH') {
      const patch = JSON.parse(options.body); assert.equal(patch.conclusion, 'failure');
      check = { ...check, ...patch }; return new Response(JSON.stringify(check));
    }
    return new Response(JSON.stringify({ id: 123456789, full_name: 'markd3ng/KIRARI' }));
  };
  const result = await runRevocation({ mode: 'revoke', env: { ...environment(), R3_APP_TOKEN: 'installation-token-at-least20' } });
  assert.equal(result.allObservedSuccessesInvalidated, true);
  assert.ok(methods.every((method) => method === 'GET' || method === 'PATCH'));
});
