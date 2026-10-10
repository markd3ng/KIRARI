import assert from 'node:assert/strict';
import test from 'node:test';
import { runLiveHarness } from '../live-harness.mjs';
import { LabSession } from '../live-harness-session.mjs';
import { digest } from '../live-harness-contract.mjs';
import { startLabServer, labConfig } from './live-harness-http-fixture.mjs';

for (const index of [1, 2, 7]) for (const fault of ['503', 'malformed']) {
  test(`semantic case ${index + 1} cannot certify expiry/revocation from unrelated ${fault}`, async (t) => {
    let server; let injected = false;
    server = await startLabServer({ respond: ({ method, endpoint }) => {
      const match = endpoint.match(/\/issues\/comments\/(\d+)$/);
      if (method !== 'GET' || !match || injected) return null;
      const comment = server.state.comments.get(Number(match[1]));
      const decision = JSON.parse(comment.body.split('\n').slice(1).join('\n'));
      const target = decision.baseRef.endsWith(`-${String(index + 1).padStart(2, '0')}-base`);
      const expiredOrRevoked = decision.action === 'REVOKE_LAB_FIXTURE' || Date.parse(decision.expiresAt) <= server.now();
      if (!target || !expiredOrRevoked) return null;
      injected = true;
      return fault === '503' ? { status: 503, data: {} } : { status: 200, data: { id: comment.id, user: comment.user } };
    } });
    t.after(server.close);
    const report = await runLiveHarness(server.config, { ownerToken: server.ownerToken, loadAppKeys: async () => server.keys,
      now: server.now, wait: server.wait, transportOptions: { origin: server.origin, testTransport: true, mutationDelayMs: 0 } });
    assert.ok(injected); assert.equal(report.cases[index].assertionResult, 'FAIL');
    assert.equal(report.labRunComplete, false); assert.equal(report.liveGitHubVerified, false);
    assert.equal(report.cleanup.complete, true);
  });
}

for (const malformed of ['pull-request', 'base-ref', 'decision-comment']) {
  test(`malformed ${malformed} readback cannot impersonate a semantic denial`, async () => {
    const config = labConfig(); const sha = 'a'.repeat(40); const body = 'revoked-fixture';
    const fixture = { number: 1, baseRef: 'base-fixture', selected: { id: 2, bodyDigest: digest(body) } };
    const data = [
      { number: 1, state: 'open', head: { sha, ref: 'head-fixture', repo: { id: config.repositoryId } },
        base: { sha, ref: fixture.baseRef, repo: { id: config.repositoryId } } },
      { object: { sha } }, { id: 2, body, user: { id: config.ownerId, login: config.ownerLogin } },
    ];
    data[['pull-request', 'base-ref', 'decision-comment'].indexOf(malformed)] = {};
    const session = new LabSession(config, { root: '/synthetic-only' }, 'synthetic-owner-fixture-token');
    session.owner = async () => ({ data: data.shift() });
    const result = await session.inspect(fixture);
    assert.equal(result.reason, 'LAB_API_UNAVAILABLE_OR_MALFORMED');
    assert.equal(result.failureCode, 'LAB_INSPECTION_RESPONSE_MALFORMED');
    assert.equal(result.authorization, 'DENIED'); assert.equal(result.requiredCheckSuccessAllowed, false);
  });
}

test('unexpected inspection programming errors fail the case without becoming API-outage evidence', async () => {
  const session = new LabSession(labConfig(), { root: '/synthetic-only' }, 'synthetic-owner-fixture-token');
  session.owner = async () => { throw new Error('private-inspection-error'); };
  await assert.rejects(session.inspect({}), (error) => {
    assert.equal(error.code, 'LAB_UNEXPECTED_INSPECTION_FAILURE');
    assert.ok(!error.message.includes('private-inspection-error')); return true;
  });
});
