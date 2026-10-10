import assert from 'node:assert/strict';
import test from 'node:test';
import { LabSession } from '../live-harness-session.mjs';
import { labConfig } from './live-harness-http-fixture.mjs';

function mergeFixture(states) {
  const config = labConfig(); const root = `/repos/${config.repository}`;
  const fixture = { number: 1111, headRef: 'kirari-live-abcdef0123456789-01-head', baseRef: 'kirari-live-abcdef0123456789-01-base' };
  let reads = 0; let puts = 0; let sleeps = 0; let merged = false;
  const pr = () => ({ number: fixture.number, state: merged ? 'closed' : 'open', merged, merge_commit_sha: merged ? 'c'.repeat(40) : null,
    mergeable: states[Math.min(reads - 1, states.length - 1)],
    head: { ref: fixture.headRef, sha: 'a'.repeat(40), repo: { id: config.repositoryId } },
    base: { ref: fixture.baseRef, sha: 'b'.repeat(40), repo: { id: config.repositoryId } } });
  const session = new LabSession(config, { root }, 'synthetic-owner-only-test', Date.now, async () => { sleeps += 1; });
  session.owner = async (method) => {
    if (method === 'GET') { reads += 1; return { status: 200, data: pr() }; }
    assert.equal(method, 'PUT'); puts += 1; merged = true;
    return { status: 200, data: { merged: true, sha: 'c'.repeat(40) } };
  };
  return { session, fixture, counts: () => ({ reads, puts, sleeps }) };
}

test('native merge waits for computed conflict-free fixture before attempting native admission', async () => {
  const { session, fixture, counts } = mergeFixture([null, null, true]);
  const result = await session.nativeMerge(fixture);
  assert.equal(result.accepted, true); assert.deepEqual(counts(), { reads: 4, puts: 1, sleeps: 2 });
});
test('conflicting or indefinitely unknown mergeability cannot masquerade as native rule enforcement', async () => {
  for (const states of [[false], [null]]) {
    const { session, fixture, counts } = mergeFixture(states);
    await assert.rejects(session.nativeMerge(fixture), /LAB_NATIVE_FIXTURE_NOT_MERGEABLE|LAB_NATIVE_MERGEABILITY_UNAVAILABLE/);
    assert.equal(counts().puts, 0); assert.ok(counts().reads <= 15);
  }
});
