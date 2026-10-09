import assert from 'node:assert/strict';
import test from 'node:test';
import { recoverLabRuleset } from '../live-harness-recovery.mjs';
import { labRulesetPayload } from '../live-harness-contract.mjs';
import { startLabServer, labConfig, ownerToken } from './live-harness-http-fixture.mjs';

async function fixture(t, options) {
  const server = await startLabServer(options); t.after(server.close);
  server.state.rulesets.set(2222, { id: 2222, ...labRulesetPayload(server.config, 'active') });
  return server;
}
const optionsFor = (server, mode) => ({ mode, ownerToken: server.ownerToken, transportOptions: { origin: server.origin, testTransport: true, mutationDelayMs: 0 } });

test('standalone Owner recovery disables and restores the full lab ruleset without App credentials or checks', async (t) => {
  const server = await fixture(t);
  const disabled = await recoverLabRuleset(server.config, optionsFor(server, 'disable'));
  assert.equal(disabled.afterEnforcement, 'disabled'); assert.equal(disabled.noCheckDependency, true);
  assert.equal(disabled.fullPayloadReadbackVerified, true); assert.equal(disabled.effectiveRulesReadbackVerified, true);
  assert.equal(disabled.liveRecoveryVerified, false); assert.equal(disabled.finalGateResult, 'NOT_READY');
  assert.equal(disabled.liveGitHubVerified, false); assert.equal(disabled.liveRecoveryOperationVerified, false); assert.equal(disabled.recoveryCycleVerified, false);
  assert.deepEqual(server.state.rulesets.get(2222), { id: 2222, ...labRulesetPayload(server.config) });
  const restored = await recoverLabRuleset(server.config, optionsFor(server, 'restore'));
  assert.equal(restored.afterEnforcement, 'active'); assert.equal(restored.bypassActors, 0);
  assert.deepEqual(server.state.rulesets.get(2222), { id: 2222, ...labRulesetPayload(server.config, 'active') });
  assert.equal(server.state.checks.size, 0); assert.equal(server.state.tokens.size, 0);
  assert.ok(server.requests.every(({ credentialKind }) => credentialKind === 'owner'));
  assert.ok(server.requests.every(({ path }) => !path.includes('/check-runs') && !path.includes('/access_tokens') && !path.includes('/merge')));
  assert.ok(server.requests.filter(({ method }) => method !== 'GET').every(({ method, path, body }) =>
    method === 'PUT' && path.endsWith('/rulesets/2222') && body.bypass_actors.length === 0 && body.rules.find(({ type }) => type === 'pull_request').parameters.required_approving_review_count === 0));
});

test('recovery inspect is read-only and cannot silently change an active lab rule', async (t) => {
  const server = await fixture(t); const report = await recoverLabRuleset(server.config, optionsFor(server, 'inspect'));
  assert.equal(report.beforeEnforcement, 'active'); assert.equal(report.afterEnforcement, 'active');
  assert.ok(server.requests.every(({ method }) => method === 'GET')); assert.equal(report.productionMutation, false);
  assert.equal(report.liveRecoveryOperationVerified, false); assert.equal(report.liveRecoveryVerified, false); assert.equal(report.recoveryCycleVerified, false);
});

test('standalone recovery refuses production and missing credentials before HTTP', async () => {
  let calls = 0; const opts = { ownerToken, mode: 'disable', transportOptions: { fetchImpl: async () => { calls += 1; throw new Error(); } } };
  await assert.rejects(recoverLabRuleset({ ...labConfig(), repository: 'markd3ng/KIRARI' }, opts));
  await assert.rejects(recoverLabRuleset({ ...labConfig(), repositoryId: 1156039202 }, opts));
  await assert.rejects(recoverLabRuleset(labConfig(), { ...opts, ownerToken: undefined }), /LAB_CREDENTIAL_MISSING/);
  await assert.rejects(recoverLabRuleset(labConfig(), { ...opts, mode: 'delete-production-rule' }), /LAB_RECOVERY_MODE_INVALID/);
  assert.equal(calls, 0);
});

test('a check-publisher credential cannot perform Owner recovery administration', async (t) => {
  const server = await fixture(t);
  const appToken = 'synthetic-checks-only-installation-token';
  server.state.tokens.set(appToken, { appId: server.config.app.id, permissions: { checks: 'write', metadata: 'read' }, revoked: false });
  await assert.rejects(recoverLabRuleset(server.config, { ...optionsFor(server, 'disable'), ownerToken: appToken }), /LAB_HTTP_REJECTED/);
  assert.ok(server.requests.every(({ method }) => method === 'GET')); assert.equal(server.state.rulesets.get(2222).enforcement, 'active');
});

test('foreign or duplicated ruleset names are never adopted for recovery', async (t) => {
  for (const kind of ['foreign', 'duplicate']) {
    const server = await fixture(t);
    if (kind === 'foreign') server.state.rulesets.get(2222).name = 'Unrelated rule';
    else server.state.rulesets.set(3333, { ...server.state.rulesets.get(2222), id: 3333 });
    await assert.rejects(recoverLabRuleset(server.config, optionsFor(server, 'disable')), /LAB_RECOVERY_EXACT_RULESET_NOT_FOUND/);
    assert.ok(server.requests.every(({ method }) => method === 'GET'));
  }
});

test('untrusted recovery readback with main targeting, bypass, approval or wrong App is refused before mutation', async (t) => {
  for (const change of ['main', 'bypass', 'approval', 'app']) {
    const server = await fixture(t); const rule = server.state.rulesets.get(2222);
    if (change === 'main') rule.conditions.ref_name.include = ['refs/heads/main'];
    if (change === 'bypass') rule.bypass_actors = [{ actor_type: 'RepositoryRole', actor_id: 5, bypass_mode: 'always' }];
    if (change === 'approval') rule.rules.find(({ type }) => type === 'pull_request').parameters.required_approving_review_count = 1;
    if (change === 'app') rule.rules.find(({ type }) => type === 'required_status_checks').parameters.required_status_checks[0].integration_id = server.config.wrongApp.id;
    await assert.rejects(recoverLabRuleset(server.config, optionsFor(server, 'disable')), /LAB_RULESET_READBACK_MISMATCH/);
    assert.ok(server.requests.every(({ method }) => method === 'GET'));
  }
});

test('full restore and effective-rule readback detect server tampering instead of claiming recovery verified', async (t) => {
  for (const kind of ['restore-tamper', 'foreign-effective-rule']) {
    let wrote = false;
    const server = await fixture(t, { respond: ({ method, endpoint, state }) => {
      if (method === 'PUT') wrote = true;
      if (kind === 'restore-tamper' && wrote && method === 'GET' && endpoint.endsWith('/rulesets/2222')) {
        const value = structuredClone(state.rulesets.get(2222)); value.bypass_actors = [{ actor_type: 'User', actor_id: 9999, bypass_mode: 'always' }];
        return { status: 200, data: value };
      }
      if (kind === 'foreign-effective-rule' && endpoint.includes('/rules/branches/')) return { status: 200, data: [{ type: 'deletion', ruleset_id: 77777 }] };
      return null;
    } });
    await assert.rejects(recoverLabRuleset(server.config, optionsFor(server, 'restore')), kind === 'restore-tamper' ? /LAB_RULESET_READBACK_MISMATCH/ : /LAB_UNEXPECTED_INHERITED_RULES/);
  }
});

test('explicit public disposable lab recovery is supported; implicit visibility change fails', async (t) => {
  const server = await fixture(t, { repositoryDelta: { private: false } });
  await assert.rejects(recoverLabRuleset(server.config, optionsFor(server, 'disable')), /LAB_REPOSITORY_IDENTITY_UNSAFE/);
  const report = await recoverLabRuleset({ ...server.config, visibility: 'public' }, optionsFor(server, 'disable'));
  assert.equal(report.fullPayloadReadbackVerified, true); assert.equal(report.liveRecoveryVerified, false);
});
