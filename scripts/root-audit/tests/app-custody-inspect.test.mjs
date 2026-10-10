import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { test } from 'node:test';
import { createCustodyTransport, inspectAppCustody, validateCustodyConfig } from '../app-custody-inspect.mjs';

const app = { id: 424242, clientId: 'Iv1.nonproduction-test', installationId: 123456, slug: 'nonproduction-fixture' };
const pem = generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey.export({ format: 'pem', type: 'pkcs8' });
const token = 'nonproduction-token-value-never-persist';
function server(change = () => {}) {
  const calls = []; let revoked = false;
  const fetchImpl = async (url, options) => {
    const pathname = new URL(url).pathname; calls.push({ pathname, method: options.method });
    const permissions = { checks: 'write', metadata: 'read' };
    let data; let status = 200;
    if (pathname === '/app') data = { id: app.id, client_id: app.clientId, slug: app.slug, owner: { id: 219239532 }, permissions };
    else if (pathname === '/repos/markd3ng/KIRARI/installation') data = { id: app.installationId, app_id: app.id, repository_selection: 'selected', suspended_at: null, account: { id: 219239532 }, permissions };
    else if (pathname === `/app/installations/${app.installationId}/access_tokens`) {
      const requested = JSON.parse(options.body);
      assert.ok(JSON.stringify(requested) === JSON.stringify({ repository_ids: [1156039202], permissions }) || JSON.stringify(requested) === JSON.stringify({ permissions: { metadata: 'read' } }));
      revoked = false;
      data = { token, permissions: requested.permissions, repository_selection: 'selected', expires_at: new Date(Date.now() + 3600000).toISOString() }; status = 201;
    } else if (pathname === '/installation/token') { revoked = true; status = 204; }
    else if (pathname === '/installation/repositories') {
      if (revoked) { status = 401; data = { message: 'bad credentials' }; }
      else data = { total_count: 1, repositories: [{ id: 1156039202, full_name: 'markd3ng/KIRARI' }] };
    } else assert.fail(`unexpected endpoint ${pathname}`);
    change(pathname, data, options);
    return new Response(status === 204 ? null : JSON.stringify(data), { status });
  };
  return { transport: createCustodyTransport(app, fetchImpl), fetchImpl, calls, revoked: () => revoked };
}

test('production custody inspection verifies metadata and revokes without publishing a check or granting admission', async () => {
  const fixture = server(); const result = await inspectAppCustody({ app, pem, transport: fixture.transport });
  assert.equal(result.identityVerified, true); assert.equal(result.permissionsVerified, true); assert.equal(result.installationTokenRevocationVerified, true);
  assert.equal(result.checkPublisherProvenanceVerified, false); assert.equal(result.prCredentialIsolationVerified, false); assert.equal(result.authoritativeMergeAdmissionVerified, false);
  assert.equal(result.activationReadiness, 'NOT_READY');
  assert.equal(result.liveGitHubVerified, false); assert.equal(result.observationKind, 'SYNTHETIC_TRANSPORT_OBSERVATIONS'); assert.ok(fixture.revoked());
  assert.ok(!JSON.stringify(result).includes(token)); assert.ok(!JSON.stringify(result).includes('PRIVATE KEY'));
  assert.ok(fixture.calls.every((call) => call.method === 'GET' || /access_tokens|\/installation\/token$/.test(call.pathname)));
});
test('production custody refuses all settings, check, ref and PR writes before fetching', async () => {
  const fixture = server();
  for (const endpoint of ['/repos/markd3ng/KIRARI/check-runs', '/repos/markd3ng/KIRARI/git/refs/heads/main', '/repos/markd3ng/KIRARI/rulesets', '/repos/markd3ng/KIRARI/pulls/133/merge', 'https://example.com/app']) {
    await assert.rejects(fixture.transport.request('publisher', token, 'POST', endpoint, {}), /APP_CUSTODY_ENDPOINT_FORBIDDEN/);
  }
  assert.equal(fixture.calls.length, 0);
});
test('production custody rejects wrong owner, wrong App and incorrect slug before minting', async () => {
  for (const change of [(data) => { data.owner.id = 1; }, (data) => { data.id = 1; }, (data) => { data.slug = 'another-app'; }]) {
    const fixture = server((pathname, data) => { if (pathname === '/app') change(data); });
    await assert.rejects(inspectAppCustody({ app, pem, transport: fixture.transport }), /APP_CUSTODY_IDENTITY_MISMATCH/);
    assert.ok(!fixture.calls.some((call) => call.method === 'POST'));
  }
});
test('production custody rejects broader installation permissions and repository selection', async () => {
  for (const change of [(data) => { data.permissions.contents = 'write'; }, (data) => { data.repository_selection = 'all'; }]) {
    const fixture = server((pathname, data) => { if (pathname.endsWith('/installation')) change(data); });
    await assert.rejects(inspectAppCustody({ app, pem, transport: fixture.transport }), /LAB_APP_/);
    assert.ok(!fixture.calls.some((call) => call.method === 'POST'));
  }
});
test('production custody revokes tokens with broader repository scope or corrupt expiry', async () => {
  for (const change of [(pathname, data) => { if (pathname === '/installation/repositories' && data?.repositories) data.total_count = 2; },
    (pathname, data) => { if (pathname.endsWith('/access_tokens')) data.expires_at = 'not-a-time'; },
    (pathname, data) => { if (pathname.endsWith('/access_tokens') && data.permissions.checks === 'write') data.expires_at = 'not-a-time'; }]) {
    const fixture = server(change);
    await assert.rejects(inspectAppCustody({ app, pem, transport: fixture.transport }), /LAB_APP_TOKEN_|LAB_APP_INSTALLATION_REPOSITORY_SCOPE_INVALID|LAB_APP_DISCOVERY_EXPIRY_OR_SELECTION_INVALID/); assert.ok(fixture.revoked());
  }
});
test('production custody has no PASS outcome during API outage or missing credentials', async () => {
  const fixture = server();
  await assert.rejects(inspectAppCustody({ app, pem: '', transport: fixture.transport }), /LAB_APP_CREDENTIAL_MISSING/);
  const transport = createCustodyTransport(app, async () => { throw new Error('test outage'); });
  await assert.rejects(inspectAppCustody({ app, pem, transport }), /APP_CUSTODY_API_UNAVAILABLE/);
});
test('production custody rejects malformed public configuration and redirected/oversized responses', async () => {
  assert.throws(() => validateCustodyConfig({ ...app, id: '424242' }), /APP_PUBLIC_IDENTITY_CONFIG_REQUIRED/);
  for (const response of [new Response('{}', { status: 302 }), new Response(' '.repeat(1048577), { status: 200 })]) {
    const transport = createCustodyTransport(app, async () => response);
    await assert.rejects(inspectAppCustody({ app, pem, transport }), /APP_CUSTODY_API_REJECTED|APP_CUSTODY_RESPONSE_TOO_LARGE/);
  }
});

test('a caller cannot forge live custody verification through an injected transport flag', async () => {
  const fixture = server(); const forged = { ...fixture.transport, liveGitHubVerified: true, liveTransport: true };
  const result = await inspectAppCustody({ app, pem, transport: forged });
  assert.equal(result.liveGitHubVerified, false); assert.equal(result.observationKind, 'SYNTHETIC_TRANSPORT_OBSERVATIONS');
});


test('registered native custody transport cannot be replaced with synthetic request or configuration', () => {
  const fixture = server(); const native = createCustodyTransport(app);
  assert.throws(() => { native.request = fixture.transport.request; }, TypeError);
  assert.throws(() => { native.config.repositoryId = 1; }, TypeError);
  assert.ok(Object.isFrozen(native)); assert.ok(Object.isFrozen(native.config));
  assert.equal(fixture.calls.length, 0);
});


test('custody retries known token cleanup after transient failure and retains sanitized failure evidence', async () => {
  const fixture = server(); let fail = true;
  const transport = createCustodyTransport(app, async (url, options) => {
    if (options.method === 'DELETE' && fail) { fail = false; return new Response('{}', { status: 503 }); }
    return fixture.fetchImpl(url, options);
  });
  await assert.rejects(inspectAppCustody({ app, pem, transport }), (error) => {
    assert.equal(error.code, 'APP_CUSTODY_API_REJECTED'); assert.equal(error.tokenCustody.complete, true);
    assert.equal(error.tokenCustody.manualOwnerReconciliationRequired, false);
    assert.ok(!JSON.stringify(error.tokenCustody).includes(token)); return true;
  });
  assert.ok(fixture.revoked());
});

test('custody records persistent known-token revocation failure and uncertain issuance instead of claiming recovery', async () => {
  for (const kind of ['revoke-outage', 'lost-mint-response']) {
    const fixture = server();
    const transport = createCustodyTransport(app, async (url, options) => {
      if (kind === 'revoke-outage' && options.method === 'DELETE') return new Response('{}', { status: 503 });
      const response = await fixture.fetchImpl(url, options);
      if (kind === 'lost-mint-response' && options.method === 'POST') { await response.body.cancel(); return new Response('{lost-response', { status: 201 }); }
      return response;
    });
    await assert.rejects(inspectAppCustody({ app, pem, transport }), (error) => {
      assert.equal(error.code, 'APP_CUSTODY_TOKEN_RECOVERY_UNVERIFIED');
      assert.equal(error.tokenCustody.complete, false); assert.equal(error.tokenCustody.manualOwnerReconciliationRequired, true);
      assert.ok(!JSON.stringify(error.tokenCustody).includes(token));
      if (kind === 'revoke-outage') assert.equal(error.tokenCustody.knownTokensIssued, 1);
      else assert.equal(error.tokenCustody.unknownIssuances, 1); return true;
    });
  }
});
