import assert from 'node:assert/strict';
import test from 'node:test';
import { executeLabCases } from '../live-harness-cases.mjs';

test('failed native-transport cases cannot claim verified LIVE observations or expose arbitrary error status', async () => {
  const failure = Object.assign(new Error('private-loader-value'), { status: 'private-loader-value' });
  const session = { transport: { testTransport: false, realTransport: true }, fixtures: Array.from({ length: 12 }, () => ({})),
    selectDecision: async () => { throw failure; } };
  const cases = await executeLabCases(session, { primary: {}, wrong: {}, sleep: async () => {} });
  assert.equal(cases.length, 12);
  assert.ok(cases.every((entry) => entry.assertionResult === 'FAIL'));
  assert.ok(cases.every((entry) => entry.liveGitHubVerified === false));
  assert.ok(!JSON.stringify(cases).includes('private-loader-value'));
});
