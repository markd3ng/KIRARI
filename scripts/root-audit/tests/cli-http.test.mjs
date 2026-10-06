import assert from 'node:assert/strict';
import test from 'node:test';
import { readBoundedResponseText } from '../cli.mjs';

test('GitHub response streaming rejects a body as soon as it exceeds the per-response limit', async () => {
  const response = new Response(new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode('0123456789'));
      controller.close();
    },
  }));
  await assert.rejects(readBoundedResponseText(response, 8), /response exceeds size limit/);
});

test('GitHub response streaming enforces a cumulative comment-page byte budget', async () => {
  const budget = { limit: 8, used: 5 };
  const response = new Response('1234', { headers: { 'content-length': '4' } });
  await assert.rejects(readBoundedResponseText(response, 20, budget), /response exceeds size limit/);
  assert.equal(budget.used, 5);
});

test('GitHub response streaming accepts valid UTF-8 and tracks its exact byte size', async () => {
  const budget = { limit: 10, used: 0 };
  const response = new Response('安全');
  assert.equal(await readBoundedResponseText(response, 10, budget), '安全');
  assert.equal(budget.used, Buffer.byteLength('安全', 'utf8'));
});
