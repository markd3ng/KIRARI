import assert from 'node:assert/strict';
import test from 'node:test';
import { getDecisionComment, readBoundedResponseText } from '../cli.mjs';

test('GitHub response streaming rejects a body as soon as it exceeds the per-response limit', async () => {
  const response = new Response(new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode('0123456789'));
      controller.close();
    },
  }));
  await assert.rejects(readBoundedResponseText(response, 8), /response exceeds size limit/);
});

test('GitHub response streaming enforces its optional cumulative byte budget', async () => {
  const budget = { limit: 8, used: 5 };
  const response = new Response('1234', { headers: { 'content-length': '4' } });
  await assert.rejects(readBoundedResponseText(response, 20, budget), /response exceeds size limit/);
  assert.equal(budget.used, 5);
});

test('decision lookup fetches only the selected immutable comment ID', async (t) => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async (url) => {
    calls.push(String(url));
    return new Response('', { status: 404 });
  };

  const omitted = await getDecisionComment('https://api.github.com', 135, null, 'token');
  assert.deepEqual(omitted.lookup, { requestedCommentId: null, state: 'NOT_REQUESTED' });
  assert.equal(calls.length, 0);

  const missing = await getDecisionComment('https://api.github.com', 135, 6019999999, 'token');
  assert.deepEqual(missing.lookup, { requestedCommentId: 6019999999, state: 'NOT_FOUND' });
  assert.deepEqual(calls, ['https://api.github.com/repos/markd3ng/KIRARI/issues/comments/6019999999']);
});

test('decision lookup rejects an immutable ID that points at another issue or comment', async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async () => new Response(JSON.stringify({
    id: 6019999998,
    issue_url: 'https://api.github.com/repos/markd3ng/KIRARI/issues/129',
    body: 'KIRARI_R3_CONSUMPTION_DECISION_V1\n{}',
  }), { headers: { 'content-type': 'application/json' } });
  await assert.rejects(getDecisionComment('https://api.github.com', 135, 6019999999, 'token'), /immutable comment ID/);
});

test('GitHub response streaming accepts valid UTF-8 and tracks its exact byte size', async () => {
  const budget = { limit: 10, used: 0 };
  const response = new Response('安全');
  assert.equal(await readBoundedResponseText(response, 10, budget), '安全');
  assert.equal(budget.used, Buffer.byteLength('安全', 'utf8'));
});
