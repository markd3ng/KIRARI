import assert from 'node:assert/strict';
import test from 'node:test';
import { runLiveHarness } from '../live-harness.mjs';
import { startLabServer } from './live-harness-http-fixture.mjs';

async function fixture(t, settings) { const server = await startLabServer(settings); t.after(server.close); return server; }
const optionsFor = (server) => ({ ownerToken: server.ownerToken, loadAppKeys: async () => server.keys, now: server.now, wait: server.wait,
  transportOptions: { origin: server.origin, testTransport: true, mutationDelayMs: 0 } });
const noSecrets = (report) => {
  const body = JSON.stringify(report); assert.ok(!body.includes('PRIVATE KEY')); assert.ok(!body.includes('synthetic-installation-token'));
  assert.ok(!body.includes('synthetic-unreported-token')); assert.ok(!body.includes('synthetic-owner-admin-fixture-token'));
};

for (const scope of ['discovery', 'invalid-narrowed']) for (const persistent of [false, true]) {
  test(`${scope} token revoke503 ${persistent ? 'persistent' : 'transient'} is retained and retried in final cleanup`, async (t) => {
    let failures = 0;
    const server = await fixture(t, {
      mintDelta: ({ body }) => scope === 'invalid-narrowed' && body.permissions.checks ? { permissions: { checks: 'write', metadata: 'read', contents: 'write' } } : {},
      respond: ({ method, endpoint, token }) => {
        const selected = scope === 'discovery' ? token?.permissions.checks === undefined : token?.permissions.checks === 'write';
        if (method === 'DELETE' && endpoint === '/installation/token' && selected && (persistent || failures === 0)) {
          failures += 1; return { status: 503, data: { message: 'synthetic private token must not be logged' } };
        }
        return null;
      },
    });
    const report = await runLiveHarness(server.config, optionsFor(server));
    assert.equal(report.labRunComplete, false); assert.equal(report.liveGitHubVerified, false);
    assert.ok(report.tokenCustody.knownTokensIssued >= 1); assert.equal(report.tokenCustody.unknownIssuances, 0);
    assert.ok(report.tokenCustody.receipts.some(({ revocationAttempts }) => revocationAttempts >= 2));
    assert.equal(report.tokenCustody.complete, !persistent);
    assert.equal(report.tokenCustody.manualOwnerReconciliationRequired, persistent);
    assert.equal(report.cleanup.credentialsComplete, !persistent);
    if (persistent) {
      assert.equal(report.cleanup.complete, false); assert.ok([...server.state.tokens.values()].some(({ revoked }) => !revoked));
      assert.ok(report.tokenCustody.receipts.some(({ revocation }) => revocation === 'FAILED'));
    } else {
      assert.equal(report.cleanup.complete, true); assert.ok([...server.state.tokens.values()].every(({ revoked }) => revoked));
    }
    noSecrets(report);
  });
}

test('malformed mint response preserves unknown issuance and requires Owner reconciliation', async (t) => {
  const server = await fixture(t, { respond: ({ method, endpoint, state, jwt, body }) => {
    if (method === 'POST' && endpoint.endsWith('/access_tokens')) {
      state.tokens.set('synthetic-unreported-token', { appId: jwt.id, permissions: body.permissions, revoked: false });
      return { status: 201, headers: {}, raw: '{broken-mint-response' };
    }
    return null;
  } });
  const report = await runLiveHarness(server.config, optionsFor(server));
  assert.equal(report.tokenCustody.mintRequestsAttempted, 1); assert.equal(report.tokenCustody.knownTokensIssued, 0);
  assert.equal(report.tokenCustody.unknownIssuances, 1); assert.equal(report.tokenCustody.complete, false);
  assert.equal(report.tokenCustody.manualOwnerReconciliationRequired, true); assert.equal(report.cleanup.complete, false);
  assert.equal(report.cleanup.credentialsComplete, false); assert.equal(report.liveGitHubVerified, false);
  assert.equal(report.tokenCustody.receipts[0].scope, 'installation-metadata-discovery');
  assert.deepEqual(report.tokenCustody.receipts[0].requestedPermissions, { metadata: 'read' });
  noSecrets(report);
});

test('lost mint response after accepted HTTP request cannot be mistaken for no issuance', async (t) => {
  const server = await fixture(t);
  const base = optionsFor(server);
  const fetchImpl = async (url, options) => {
    const response = await fetch(url, options);
    if (options.method === 'POST' && new URL(url).pathname.endsWith('/access_tokens')) {
      await response.body.cancel(); throw new Error('simulated response lost after server accepted token mint');
    }
    return response;
  };
  const report = await runLiveHarness(server.config, { ...base, transportOptions: { ...base.transportOptions, fetchImpl } });
  assert.equal(server.state.tokens.size, 1); assert.equal(report.tokenCustody.unknownIssuances, 1);
  assert.equal(report.cleanup.complete, false); assert.equal(report.tokenCustody.manualOwnerReconciliationRequired, true); noSecrets(report);
});

test('DELETE204 followed by readback503 recovers idempotently through DELETE401 and verified GET401', async (t) => {
  let readbackFailures = 0; let alreadyRevokedDeleteAttempts = 0;
  const server = await fixture(t, { respond: ({ method, endpoint, token }) => {
    if (method === 'DELETE' && endpoint === '/installation/token' && token?.revoked) alreadyRevokedDeleteAttempts += 1;
    if (method === 'GET' && endpoint === '/installation/repositories' && token?.revoked && readbackFailures === 0) {
      readbackFailures += 1; return { status: 503, data: {} };
    }
    return null;
  } });
  const report = await runLiveHarness(server.config, optionsFor(server));
  assert.equal(readbackFailures, 1); assert.equal(alreadyRevokedDeleteAttempts, 1);
  assert.equal(report.failure.httpStatus, 503); assert.equal(report.labRunComplete, false);
  assert.equal(report.tokenCustody.complete, true); assert.equal(report.cleanup.credentialsComplete, true);
  assert.equal(report.cleanup.complete, true); assert.equal(report.liveGitHubVerified, false);
  assert.equal(report.tokenCustody.receipts[0].revocationAttempts, 2); assert.equal(report.tokenCustody.receipts[0].revocation, 'VERIFIED');
  noSecrets(report);
});

test('pre-mint App GET failure never turns empty token revocation into credential verification PASS', async (t) => {
  const server = await fixture(t, { respond: ({ endpoint }) => endpoint === '/app' ? { status: 503, data: {} } : null });
  const report = await runLiveHarness(server.config, optionsFor(server));
  assert.equal(report.tokenCustody.mintRequestsAttempted, 0); assert.equal(report.tokenCustody.noMintAttempted, true);
  assert.equal(report.tokenCustody.complete, false); assert.equal(report.cleanup.credentialsComplete, false);
  assert.equal(report.labRunComplete, false); assert.equal(report.liveGitHubVerified, false); noSecrets(report);
});

test('token custody ledger is frozen, deduplicates known tokens and rejects unverified revoke callbacks', async () => {
  const { createTokenCustodyLedger } = await import('../live-harness-api.mjs');
  const ledger = createTokenCustodyLedger({ now: () => Date.parse('2026-10-09T00:00:00Z') });
  assert.equal(Object.isFrozen(ledger), true);
  assert.throws(() => { ledger.report = () => ({ complete: true }); });
  for (let i = 0; i < 2; i += 1) {
    const receipt = ledger.beforeMint({ appId: 900003, installationId: 900004, scope: 'repository-checks', repositoryIds: [900001], permissions: { checks: 'write', metadata: 'read' } });
    ledger.recordMintResponse(receipt, { token: 'synthetic-duplicate-known-token', expires_at: '2026-10-09T01:00:00Z', permissions: { checks: 'write', metadata: 'read' } });
  }
  let calls = 0; await ledger.retryKnownTokens(async () => { calls += 1; return undefined; });
  assert.equal(calls, 1); assert.equal(ledger.report().complete, false);
  await ledger.retryKnownTokens(async () => { calls += 1; return { verified: true }; });
  assert.equal(calls, 2); assert.equal(ledger.report().complete, true);
  assert.equal(ledger.report().knownTokensIssued, 1); assert.equal(ledger.report().receipts.length, 2);
  assert.ok(!JSON.stringify(ledger.report()).includes('synthetic-duplicate-known-token'));
});
