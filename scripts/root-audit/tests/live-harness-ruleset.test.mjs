import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { prepareDisabledProductionRuleset } from '../live-harness-ruleset.mjs';
import { REQUIRED_CHECK_NAME, NATIVE_REQUIRED_CHECK_SUCCESS_ENABLED } from '../publisher-contract.mjs';
import { validateLabConfig } from '../live-harness-contract.mjs';

test('unresolved App proposal is inert and cannot become an API payload with an omitted integration identity', () => {
  const proposal = prepareDisabledProductionRuleset();
  assert.equal(proposal.apiPayload, null); assert.equal(proposal.proposedAppId, null);
  assert.equal(proposal.template.enforcement, 'disabled'); assert.equal(proposal.applyReady, false); assert.equal(proposal.activationReady, false);
  assert.equal(proposal.appIdentityVerified, false); assert.equal(proposal.requiresRealAppReceipt, true);
  assert.equal(proposal.template.rules.find(({ type }) => type === 'required_status_checks').parameters.required_status_checks[0].integration_id, 'PENDING_OWNER_VERIFIED_PRODUCTION_APP_ID');
});

test('a proposed numeric App ID never certifies identity or enables required-check success/admission', () => {
  const proposal = prepareDisabledProductionRuleset(900003);
  assert.equal(proposal.proposedAppId, 900003); assert.equal(proposal.appIdentityVerified, false); assert.equal(proposal.requiresRealAppReceipt, true);
  assert.equal(proposal.applyReady, false); assert.equal(proposal.activationReady, false); assert.equal(proposal.finalAdmissionReady, false);
  assert.equal(proposal.nativeCheckExpirySupported, false); assert.equal(proposal.requiredCheckSuccessAllowed, false); assert.equal(NATIVE_REQUIRED_CHECK_SUCCESS_ENABLED, false);
  assert.equal(proposal.apiPayload.enforcement, 'disabled'); assert.deepEqual(proposal.apiPayload.conditions.ref_name, { include: ['refs/heads/main'], exclude: [] });
  assert.deepEqual(proposal.apiPayload.bypass_actors, []);
  const checks = proposal.apiPayload.rules.find(({ type }) => type === 'required_status_checks').parameters;
  assert.deepEqual(checks.required_status_checks, [{ context: REQUIRED_CHECK_NAME, integration_id: 900003 }]);
  assert.equal(checks.strict_required_status_checks_policy, true); assert.equal(checks.do_not_enforce_on_create, false);
  assert.equal(proposal.apiPayload.rules.find(({ type }) => type === 'pull_request').parameters.required_approving_review_count, 0);
  assert.ok(proposal.apiPayload.rules.some(({ type }) => type === 'non_fast_forward')); assert.ok(proposal.apiPayload.rules.some(({ type }) => type === 'deletion'));
  assert.ok(proposal.blockers.includes('SUPPORTED_ATOMIC_CONTINUING_AUTHORIZATION_ADMISSION'));
});

test('shared GitHub Actions identity, malformed and nonpositive proposed IDs fail closed', () => {
  for (const id of [15368, 0, -1, 1.5, '900003', Number.MAX_SAFE_INTEGER + 1, {}, NaN]) assert.throws(() => prepareDisabledProductionRuleset(id));
});

test('checked-in lab example cannot authorize a live run and contains no credential fields', async () => {
  const example = JSON.parse(await readFile(new URL('../live-harness-config.example.json', import.meta.url), 'utf8'));
  assert.equal(example.ownerAuthorized, false); assert.equal(example.visibility, 'private'); assert.equal(example.disposable, true);
  assert.throws(() => validateLabConfig(example));
  const serialized = JSON.stringify(example); assert.ok(!serialized.includes('PRIVATE KEY')); assert.ok(!serialized.includes('Token'));
});
