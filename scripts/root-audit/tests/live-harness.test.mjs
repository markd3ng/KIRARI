import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, writeFile, chmod, symlink, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { runLiveHarness } from '../live-harness.mjs';
import { createLabTransport, readLabPrivateKey, createAppJwt, mintLabAppToken } from '../live-harness-api.mjs';
import { LAB_CASES, LAB_CHECK_NAME, validateLabConfig, labRulesetPayload } from '../live-harness-contract.mjs';
import { labConfig, labKeys, startLabServer, ownerToken } from './live-harness-http-fixture.mjs';

const optionsFor = (server) => ({ ownerToken: server.ownerToken, loadAppKeys: async () => server.keys, now: server.now, wait: server.wait,
  transportOptions: { origin: server.origin, testTransport: true, mutationDelayMs: 0 } });
async function fixture(t, options) { const server = await startLabServer(options); t.after(server.close); return server; }

test('real harness executes all twelve scenarios over isolated HTTP and reports native weaknesses separately', async (t) => {
  const server = await fixture(t); const report = await runLiveHarness(server.config, optionsFor(server));
  assert.equal(report.failure, undefined); assert.equal(report.labRunComplete, true);
  assert.equal(report.liveGitHubVerified, false); assert.equal(report.realGitHubRequestsPerformed, false);
  assert.equal(report.finalGateResult, 'NOT_READY'); assert.equal(report.productionAuthority, false);
  assert.equal(report.rulesetAppliedToProduction, false); assert.equal(report.r3Consumed, false);
  assert.equal(report.finalAdmissionCapability.status, 'NOT_READY');
  assert.equal(report.cases.length, 12);
  for (const entry of report.cases) await t.test(`${entry.id}: ${entry.name}`, () => {
    assert.equal(entry.name, LAB_CASES[entry.id - 1]); assert.equal(entry.assertionResult, 'PASS', JSON.stringify(entry.observed));
    assert.ok(entry.expected); assert.ok(entry.observed); assert.equal(entry.liveGitHubVerified, false);
    assert.equal(entry.isolationLevel, 'HTTP_INTEGRATION_FAKE_GITHUB');
  });
  assert.equal(report.cases[0].observed.eligibility.technicalVerification, 'PASS');
  assert.equal(report.cases[0].observed.eligibility.authorization, 'VALIDATED');
  assert.equal(report.cases[0].observed.eligibility.mergeAdmission, 'BLOCKED');
  for (const index of [2, 7, 8, 9]) {
    assert.equal(report.cases[index].observed.native.accepted, true); assert.equal(report.cases[index].observed.gate, 'NOT_READY');
    assert.ok(report.cases[index].observed.checks.some(({ conclusion }) => conclusion === 'success'));
  }
  for (const index of [1, 3, 4, 5, 6]) assert.equal(report.cases[index].observed.native.accepted, false);
  assert.equal(report.cases[5].observed.wrongAppCheck.appId, server.config.wrongApp.id);
  assert.equal(report.cases[5].observed.requiredAppId, server.config.app.id);
  assert.equal(report.cases[10].observed.recovery.nativeWhileDisabled.accepted, true);
  assert.equal(report.cases[11].observed.afterRestore.accepted, false);
  assert.ok(report.tokenRevocation.every(({ verified }) => verified)); assert.equal(report.cleanup.complete, true);
  assert.deepEqual([...server.state.refs], [['main', server.state.seed]]); assert.equal(server.state.rulesets.size, 0);
  assert.ok([...server.state.pulls.values()].every((pr) => pr.state === 'closed'));
  assert.ok([...server.state.tokens.values()].every((token) => token.revoked));
  const mintRequests = server.requests.filter(({ method, path: endpoint }) => method === 'POST' && endpoint.endsWith('/access_tokens'));
  assert.ok(mintRequests.length >= 6);
  assert.ok(mintRequests.every(({ body }) => body.permissions.checks === 'write'
    ? JSON.stringify(body) === JSON.stringify({ repository_ids: [server.config.repositoryId], permissions: { checks: 'write', metadata: 'read' } })
    : JSON.stringify(body) === JSON.stringify({ permissions: { metadata: 'read' } })));
  assert.ok(server.requests.every(({ path: endpoint }) => !endpoint.toLowerCase().includes('/markd3ng/kirari')));
  assert.ok(server.requests.filter(({ method, path: endpoint }) => method !== 'GET' && endpoint.includes('/ruleset')).every(({ credentialKind }) => credentialKind === 'owner'));
  const serial = JSON.stringify(report);
  assert.ok(!serial.includes('PRIVATE KEY')); assert.ok(!serial.includes(ownerToken)); assert.ok(!serial.includes('synthetic-installation-token'));
});

test('production and unsafe config refuse before key loaders or any HTTP call', async () => {
  let touched = 0;
  for (const delta of [{ repository: 'markd3ng/KIRARI' }, { repository: 'markd3ng/kirari' }, { repository: 'fixture-owner/valuable-project' },
    { ownerAuthorized: false }, { disposable: false }, { repositoryId: '900001' }, { repositoryId: 1156039202 }, { runId: '../main' }, { wrongApp: labConfig().app }]) {
    await assert.rejects(runLiveHarness({ ...labConfig(), ...delta }, { ownerToken,
      loadAppKeys: async () => { touched += 1; return labKeys; }, transportOptions: { fetchImpl: async () => { touched += 1; throw new Error(); } } }));
  }
  assert.equal(touched, 0);
});

test('missing Owner setup never claims live verification or makes a request', async () => {
  let touched = 0;
  const report = await runLiveHarness(labConfig(), { loadAppKeys: async () => { touched += 1; }, transportOptions: { fetchImpl: async () => { touched += 1; } } });
  assert.equal(report.failure.code, 'LAB_OWNER_SETUP_REQUIRED'); assert.equal(report.liveGitHubVerified, false);
  assert.equal(report.realGitHubRequestsPerformed, false); assert.equal(report.transportObservation.requestAttempts, 0); assert.equal(touched, 0);
});

test('custom fetch cannot claim live GitHub even when caller omits testTransport', async () => {
  const transport = createLabTransport(labConfig(), { fetchImpl: async () => new Response('{}') });
  assert.equal(transport.realTransport, false); assert.equal(transport.testTransport, true);
});

test('private/fork/id/owner/admin and Actions preflight rejects before private key access', async (t) => {
  for (const settings of [{ repositoryDelta: { private: false } }, { repositoryDelta: { fork: true } }, { repositoryDelta: { id: 900099 } },
    { repositoryDelta: { owner: { id: 900099, login: 'other', type: 'User' } } }, { repositoryDelta: { permissions: { admin: false } } }, { actionsEnabled: true }]) {
    const server = await fixture(t, settings); let keysRead = 0;
    const report = await runLiveHarness(server.config, { ...optionsFor(server), loadAppKeys: async () => { keysRead += 1; return server.keys; } });
    assert.equal(keysRead, 0); assert.equal(report.labRunComplete, false); assert.equal(report.liveGitHubVerified, false);
    assert.ok(server.requests.every(({ method }) => method === 'GET'));
  }
});

test('App identity, ownership, excessive permissions and installation mismatches refuse before any token mint', async (t) => {
  for (const settings of [{ appDelta: { id: 900099 } }, { appDelta: { owner: { id: 900099 } } },
    { appDelta: { slug: 'different' } }, { appDelta: { permissions: { checks: 'write', metadata: 'read', contents: 'read' } } },
    { installationDelta: { repository_selection: 'all' } }, { installationDelta: { suspended_at: '2026-10-09T00:00:00Z' } }]) {
    const server = await fixture(t, settings); const report = await runLiveHarness(server.config, optionsFor(server));
    assert.equal(report.labRunComplete, false); assert.equal(report.liveGitHubVerified, false); assert.ok(report.failure);
    assert.equal(server.requests.filter(({ method, path: endpoint }) => method === 'POST' && endpoint.endsWith('/access_tokens')).length, 0);
    assert.equal(server.state.rulesets.size, 0);
  }
});

test('full installation inventory detects a second selected repository without ever minting a checks token', async (t) => {
  const server = await fixture(t, { installationRepositoryCount: 2 });
  const report = await runLiveHarness(server.config, optionsFor(server));
  assert.equal(report.failure.code, 'LAB_APP_INSTALLATION_REPOSITORY_SCOPE_INVALID');
  assert.ok([...server.state.tokens.values()].every((token) => token.revoked && token.permissions.checks === undefined));
  assert.ok(server.requests.filter(({ method, path: endpoint }) => method === 'POST' && endpoint.endsWith('/access_tokens')).every(({ body }) => body.permissions.checks === undefined));
});

test('invalid narrowed token permissions or expiry are revoked before fixture creation', async (t) => {
  for (const delta of [{ permissions: { checks: 'write', metadata: 'read', administration: 'write' } }, { expires_at: '2027-01-01T00:00:00Z' }]) {
    const server = await fixture(t, { mintDelta: ({ body }) => body.permissions.checks ? delta : {} });
    const report = await runLiveHarness(server.config, optionsFor(server));
    assert.equal(report.labRunComplete, false); assert.equal(report.liveGitHubVerified, false);
    assert.ok([...server.state.tokens.values()].every((token) => token.revoked)); assert.equal(server.state.pulls.size, 0);
  }
});

test('missing App credential fails before App HTTP; RSA JWT has exact bounded claims', async (t) => {
  const server = await fixture(t); const transport = createLabTransport(server.config, optionsFor(server).transportOptions);
  await assert.rejects(mintLabAppToken(transport, server.config.app, undefined, server.now()), /LAB_APP_CREDENTIAL_MISSING/);
  assert.equal(server.requests.length, 0);
  const jwt = createAppJwt(server.config.app, server.keys.primary, server.now());
  const claims = JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url'));
  assert.equal(claims.iss, server.config.app.clientId); assert.equal(claims.iat, server.now() / 1000 - 60); assert.equal(claims.exp, server.now() / 1000 + 540);
});

test('transport refuses production/default/foreign ruleset and unscoped publisher mutations locally', async () => {
  let requests = 0; const config = labConfig(); const root = `/repos/${config.repository}`;
  const transport = createLabTransport(config, { fetchImpl: async () => { requests += 1; return new Response('{}'); }, mutationDelayMs: 0 });
  for (const [role, method, endpoint, body] of [
    ['owner', 'PUT', '/repos/markd3ng/KIRARI/rulesets/1', {}], ['owner', 'POST', `${root}/git/refs`, { ref: 'refs/heads/main', sha: 'a'.repeat(40) }],
    ['owner', 'DELETE', `${root}/git/refs/heads/main`], ['owner', 'PUT', `${root}/rulesets/1`, labRulesetPayload(config, 'active')],
    ['publisher', 'PUT', `${root}/rulesets/1`, {}], ['app-jwt', 'POST', `/app/installations/${config.app.installationId}/access_tokens`, { permissions: { checks: 'write' } }],
    ['owner', 'PATCH', `${root}/pulls/42`, { state: 'closed' }], ['owner', 'POST', `${root}/git/trees`, { base_tree: 'a'.repeat(40), tree: [{ path: '.github/workflows/evil.yml', sha: 'b'.repeat(40), type: 'blob', mode: '100644' }] }],
  ]) await assert.rejects(transport.request(role, ownerToken, method, endpoint, body));
  assert.equal(requests, 0);
});

test('redirects, malformed/invalid UTF-8 and oversized HTTP responses fail closed without response data leakage', async (t) => {
  for (const response of [{ status: 302, headers: { Location: 'https://evil.invalid/' } }, { status: 200, headers: {}, raw: '{malformed private-token' },
    { status: 200, headers: {}, raw: Buffer.from([0xc0, 0xaf]) }, { status: 200, headers: {}, raw: 'a'.repeat(2 * 1024 * 1024 + 1) }]) {
    const server = await fixture(t, { respond: ({ endpoint }) => endpoint === '/user' ? response : null });
    const report = await runLiveHarness(server.config, optionsFor(server));
    assert.equal(report.labRunComplete, false); assert.equal(report.liveGitHubVerified, false);
    assert.ok(!JSON.stringify(report).includes('private-token')); assert.ok(!server.requests.some(({ path: endpoint }) => endpoint.includes('evil')));
  }
});

test('check readback cannot substitute the expected publisher identity', async (t) => {
  const server = await fixture(t, { checkAppId: 900099 }); const report = await runLiveHarness(server.config, optionsFor(server));
  assert.equal(report.labRunComplete, false); assert.equal(report.liveGitHubVerified, false);
  assert.equal(report.cases[0].assertionResult, 'FAIL'); assert.equal(report.cases[0].observed.code, 'LAB_CHECK_PUBLISHER_READBACK_MISMATCH');
  assert.equal(report.finalGateResult, 'NOT_READY');
});

test('uncertain ref/PR/ruleset creations cannot report complete cleanup', async (t) => {
  for (const type of ['ref', 'pull-request', 'ruleset']) {
    let injected = false;
    const server = await fixture(t, { respond: ({ method, endpoint, body, state }) => {
      if (injected || method !== 'POST') return null;
      const matches = type === 'ref' ? endpoint.endsWith('/git/refs') : type === 'pull-request' ? endpoint.endsWith('/pulls') : endpoint.endsWith('/rulesets');
      if (!matches) return null;
      injected = true;
      // Simulates a response lost/corrupted after GitHub accepted the mutation. Uncertainty alone must survive cleanup.
      if (type === 'ruleset') state.rulesets.set(999999, { id: 999999, ...body });
      if (type === 'ref') state.refs.set(body.ref.slice(11), body.sha);
      if (type === 'pull-request') state.pulls.set(999999, { number: 999999, head: body.head, base: body.base, state: 'open', merged: false });
      return { status: 201, headers: {}, raw: '{malformed-response' };
    } });
    const report = await runLiveHarness(server.config, optionsFor(server));
    assert.equal(report.labRunComplete, false); assert.equal(report.liveGitHubVerified, false); assert.equal(report.cleanup.complete, false);
    assert.ok(report.cleanup.pendingCreations.some((pending) => pending.type === type)); assert.equal(report.cleanup.manualOwnerReconciliationRequired, true);
  }
});

test('private key reader rejects readable-by-others and symlink keys without revealing their content', async (t) => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'kirari-lab-key-')); t.after(() => rm(dir, { recursive: true, force: true }));
  const file = path.join(dir, 'owner.pem'); await writeFile(file, labKeys.primary, { mode: 0o600 });
  assert.equal(await readLabPrivateKey(file), labKeys.primary);
  await chmod(file, 0o644); await assert.rejects(readLabPrivateKey(file), /LAB_PRIVATE_KEY_CUSTODY_UNSAFE/);
  await chmod(file, 0o600); const link = path.join(dir, 'link.pem'); await symlink(file, link);
  await assert.rejects(readLabPrivateKey(link), /LAB_PRIVATE_KEY_UNREADABLE/);
  await assert.rejects(readLabPrivateKey('relative.pem'), /LAB_APP_PRIVATE_KEY_PATH_REQUIRED/);
});


test('unexpected credential-loader errors cannot serialize custom error status or secrets', async (t) => {
  const server = await fixture(t);
  const report = await runLiveHarness(server.config, { ...optionsFor(server), loadAppKeys: async () => {
    throw Object.assign(new Error('loader-private-secret'), { status: 'loader-private-secret' });
  } });
  assert.equal(report.failure.code, 'LAB_UNEXPECTED_FAILURE');
  assert.equal(report.failure.httpStatus, undefined);
  assert.ok(!JSON.stringify(report).includes('loader-private-secret'));
  assert.equal(report.liveGitHubVerified, false);
});
