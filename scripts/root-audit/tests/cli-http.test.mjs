import assert from 'node:assert/strict';
import test from 'node:test';
import { getDecisionComment, getGitHubState, listPullRequestChangedFiles, readBoundedResponseText } from '../cli.mjs';
import { evaluateVerification } from '../evaluator.mjs';
import { createContext } from './fixtures.mjs';

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

test('PR changed-file lookup paginates to the authenticated metadata count', async (t) => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  const allFiles = Array.from({ length: 101 }, (_, index) => ({ filename: `src/file-${String(index).padStart(3, '0')}.mjs` }));
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async (url) => {
    const parsed = new URL(String(url));
    calls.push(parsed);
    const page = Number(parsed.searchParams.get('page'));
    return new Response(JSON.stringify(page === 1 ? allFiles.slice(0, 100) : allFiles.slice(100)), {
      headers: { 'content-type': 'application/json' },
    });
  };

  const files = await listPullRequestChangedFiles('https://api.github.com', 136, 101, 'token');
  assert.equal(files.length, 101);
  assert.deepEqual(calls.map((url) => url.searchParams.get('page')), ['1', '2']);
  assert.ok(calls.every((url) => url.searchParams.get('per_page') === '100'));
});

test('PR changed-file lookup fails closed on inconsistent counts and the API ceiling', async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async () => new Response(JSON.stringify([{ filename: 'same.mjs' }, { filename: 'same.mjs' }]), {
    headers: { 'content-type': 'application/json' },
  });
  await assert.rejects(listPullRequestChangedFiles('https://api.github.com', 136, 1, 'token'), /inconsistent/);
  await assert.rejects(listPullRequestChangedFiles('https://api.github.com', 136, 3001, 'token'), /API limit/);

  globalThis.fetch = async () => new Response(JSON.stringify([{ filename: 'same.mjs' }, { filename: 'same.mjs' }]), {
    headers: { 'content-type': 'application/json' },
  });
  await assert.rejects(listPullRequestChangedFiles('https://api.github.com', 136, 2, 'token'), /duplicated/);
});

test('PR rename lookup reconciles file rows while protecting both original and destination paths', async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  const cases = [
    { from: '.npmrc', to: 'docs/old-config', blocked: true },
    { from: '.pnpmfile.cjs', to: 'scripts/old-hook.cjs', blocked: true },
    { from: '.github/workflows/r3-trusted-publisher.yml', to: 'docs/archived-publisher.yml', blocked: true },
    { from: 'scripts/root-audit/publisher-cli.mjs', to: 'scripts/archived-publisher.mjs', blocked: true },
    { from: 'docs/new-workflow.yml', to: '.github/workflows/new-workflow.yml', blocked: true },
    { from: 'docs/before.md', to: 'docs/after.md', blocked: false },
  ];
  for (const { from, to, blocked } of cases) {
    globalThis.fetch = async () => new Response(JSON.stringify([
      { status: 'renamed', filename: to, previous_filename: from },
    ]), { headers: { 'content-type': 'application/json' } });
    const changedFiles = await listPullRequestChangedFiles('https://api.github.com', 136, 1, 'token');
    assert.deepEqual(changedFiles, [from, to].sort());
    const verify = () => evaluateVerification(createContext({ changedFiles }));
    if (blocked) assert.throws(verify, /protected trusted-root paths/);
    else assert.equal(verify().trustedVerification, 'PASS');
  }
});

test('PR rename lookup fails closed when the original path is missing or malformed', async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  for (const previous_filename of [undefined, null, '', 'bad\0path', 'docs/after.md']) {
    globalThis.fetch = async () => new Response(JSON.stringify([
      { status: 'renamed', filename: 'docs/after.md', previous_filename },
    ]), { headers: { 'content-type': 'application/json' } });
    await assert.rejects(listPullRequestChangedFiles('https://api.github.com', 136, 1, 'token'), /original path/);
  }
});

test('PR rename lookup bounds affected paths independently of GitHub file-row count', async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async (url) => {
    const page = Number(new URL(String(url)).searchParams.get('page'));
    const rows = Array.from({ length: 100 }, (_, index) => {
      const id = (page - 1) * 100 + index;
      return { status: 'renamed', filename: `docs/after-${id}.md`, previous_filename: `docs/before-${id}.md` };
    });
    return new Response(JSON.stringify(rows), { headers: { 'content-type': 'application/json' } });
  };
  const changedFiles = await listPullRequestChangedFiles('https://api.github.com', 136, 3000, 'token');
  assert.equal(changedFiles.length, 6000);
  assert.equal(evaluateVerification(createContext({ changedFiles })).trustedVerification, 'PASS');
  assert.throws(() => evaluateVerification(createContext({ changedFiles: [...changedFiles, 'docs/extra.md'] })), /changed-file evidence/);
});

test('PR metadata ABA cannot substitute safe mutable rows for immutable protected-path edits', async (t) => {
  const context = createContext();
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  const sha = (digit) => digit.repeat(40);
  const baseTreeSha = sha('8'); const headTreeSha = sha('9');
  const inputEntries = new Map();
  for (const file of context.policy.candidateFiles) {
    const parts = file.split('/');
    for (let index = 1; index < parts.length; index++) inputEntries.set(parts.slice(0, index).join('/'), { path: parts.slice(0, index).join('/'), type: 'tree', mode: '040000', sha: sha('1') });
    inputEntries.set(file, { path: file, type: 'blob', mode: '100644', sha: sha('2') });
  }
  let metadataReads = 0;
  globalThis.fetch = async (url) => {
    const endpoint = new URL(url);
    let response;
    if (endpoint.pathname.endsWith('/pulls/133')) {
      metadataReads++;
      response = { number: 133, state: 'open', merged: false, changed_files: 1,
        head: { sha: context.expectedHeadSha, repo: { full_name: context.candidate.headRepo } }, base: { sha: context.expectedBaseSha, ref: 'main' } };
    } else if (endpoint.pathname.endsWith('/pulls/133/files')) {
      response = [{ filename: 'docs/safe-file.md', raw_url: `https://github.com/markd3ng/KIRARI/raw/${sha('0')}/docs/safe-file.md` }];
    } else if (endpoint.pathname.includes('/git/commits/')) {
      const commitSha = endpoint.pathname.split('/').at(-1);
      response = { sha: commitSha, tree: { sha: commitSha === context.expectedBaseSha ? baseTreeSha : headTreeSha } };
    } else if (endpoint.pathname.includes('/git/trees/')) {
      assert.equal(endpoint.searchParams.get('recursive'), '1');
      const treeSha = endpoint.pathname.split('/').at(-1);
      const entries = [...inputEntries.values()].map((entry) => entry.path === 'scripts/root-audit/cli.mjs' && treeSha === headTreeSha ? { ...entry, sha: sha('3') } : entry);
      response = { sha: treeSha, truncated: false, tree: entries };
    } else {
      response = { number: endpoint.pathname.endsWith('/issues/122') ? 122 : 135, state: 'open', title: 'issue snapshot', body: 'issue snapshot' };
    }
    return new Response(JSON.stringify(response));
  };
  const args = ['https://api.github.com', 133, context.expectedHeadSha, context.expectedBaseSha, null, 'test-read-token', context.policy];
  const first = await getGitHubState(...args);
  const second = await getGitHubState(...args);
  assert.equal(metadataReads, 2);
  assert.deepEqual(first.candidate, second.candidate, 'both mutable PR snapshots show A');
  assert.deepEqual(first.pullRequestFiles, ['docs/safe-file.md'], 'mutable file rows show B');
  assert.deepEqual(first.changedFiles, ['scripts/root-audit/cli.mjs'], 'authorization gate derives immutable A');
  assert.equal(first.immutableTrees.length, 4);
  assert.throws(() => evaluateVerification({ ...context, changedFiles: first.changedFiles }), /protected trusted-root paths/);
});
