import assert from 'node:assert/strict';
import { test } from 'node:test';
import { changedPathsFromImmutableTrees, listImmutableChangedPaths } from '../immutable-trees.mjs';

const sha = (character) => character.repeat(40);
const blob = (path, character = '1', mode = '100644') => ({ path, type: 'blob', mode, sha: sha(character) });
const directory = (path, character = '2') => ({ path, type: 'tree', mode: '040000', sha: sha(character) });
const tree = (entries, character) => ({ sha: sha(character), truncated: false, tree: entries });
const options = { baseTreeSha: sha('a'), headTreeSha: sha('b') };

test('immutable diff retains protected deleted and incoming paths, independent of mutable PR file rows', () => {
  const base = tree([directory('.github'), directory('.github/workflows'), blob('.github/workflows/gate.yml')], 'a');
  const head = tree([directory('docs'), blob('docs/gate.yml')], 'b');
  const changed = changedPathsFromImmutableTrees(base, head, options);
  assert.ok(changed.includes('.github/workflows/gate.yml'));
  assert.ok(changed.includes('.github/workflows/'));
  assert.ok(changed.includes('docs/gate.yml'));
});

test('immutable diff includes mode-only changes and accepts unchanged ordinary input blobs', () => {
  const base = tree([blob('package.json'), blob('pnpm-lock.yaml'), blob('tool.sh')], 'a');
  const head = tree([blob('package.json'), blob('pnpm-lock.yaml'), blob('tool.sh', '1', '100755')], 'b');
  assert.deepEqual(changedPathsFromImmutableTrees(base, head, { ...options, candidateFiles: ['package.json', 'pnpm-lock.yaml'] }), ['tool.sh']);
});

test('recursive tree identity, truncation, duplicate, traversal and ancestor corruption fail closed', () => {
  const base = tree([], 'a');
  for (const bad of [
    { ...tree([], 'b'), sha: sha('c') },
    { ...tree([], 'b'), truncated: true },
    tree([blob('x'), blob('x')], 'b'),
    tree([blob('../x')], 'b'),
    tree([blob('/x')], 'b'),
    tree([blob('a\\b')], 'b'),
    tree([blob('a/b')], 'b'),
    tree([{ ...blob('x'), mode: '160000' }], 'b'),
  ]) assert.throws(() => changedPathsFromImmutableTrees(base, bad, options), /immutable tree:/);
});

test('workspace symlink/gitlink discovery and symbolic fixed manifest inputs fail closed', () => {
  const base = tree([], 'a');
  for (const entry of [
    blob('packages', '1', '120000'),
    blob('packages/phantom', '1', '120000'),
    { path: 'packages/phantom', type: 'commit', mode: '160000', sha: sha('1') },
  ]) {
    const entries = entry.path.includes('/') ? [directory('packages'), entry] : [entry];
    assert.throws(() => changedPathsFromImmutableTrees(base, tree(entries, 'b'), options), /workspace discovery/);
  }
  assert.throws(() => changedPathsFromImmutableTrees(base, tree([blob('package.json', '1', '120000')], 'b'), { ...options, candidateFiles: ['package.json'] }), /ordinary blob/);
  assert.throws(() => changedPathsFromImmutableTrees(base, tree([], 'b'), { ...options, candidateFiles: ['pnpm-lock.yaml'] }), /ordinary blob/);
});

test('immutable acquisition binds commit/tree SHA and separate fork repository without mutable PR endpoint', async () => {
  const seen = [];
  const apiRoot = 'https://api.github.com/repos/owner/base';
  const headApiRoot = 'https://api.github.com/repos/author/fork';
  const result = await listImmutableChangedPaths({ apiRoot, headApiRoot, baseSha: sha('c'), headSha: sha('d'), request: async (url) => {
    seen.push(url);
    if (url.includes('/git/commits/')) return { sha: url.endsWith(sha('c')) ? sha('c') : sha('d'), tree: { sha: url.endsWith(sha('c')) ? sha('a') : sha('b') } };
    return url.includes(sha('a')) ? tree([blob('safe.txt')], 'a') : tree([blob('safe.txt', '2')], 'b');
  } });
  assert.deepEqual(result, ['safe.txt']);
  assert.ok(seen.includes(`${headApiRoot}/git/commits/${sha('d')}`));
  assert.equal(seen.some((url) => url.includes('/pulls/')), false);
  await assert.rejects(listImmutableChangedPaths({ apiRoot, headApiRoot: 'https://attacker.invalid/repo', baseSha: sha('c'), headSha: sha('d'), request: async () => assert.fail('no fetch') }), /origin/);
  await assert.rejects(listImmutableChangedPaths({ apiRoot, baseSha: sha('c'), headSha: sha('d'), request: async () => ({ sha: sha('0') }) }), /binding/);
  await assert.rejects(listImmutableChangedPaths({ apiRoot, baseSha: sha('c'), headSha: sha('d'), request: async () => { throw new Error('API unavailable'); } }), /API unavailable/);
});

test('unchanged extra workspace importer is rejected even when the diff and lock omit it', () => {
  const entries = [blob('package.json'), directory('packages'), directory('packages/phantom'), blob('packages/phantom/package.json')];
  assert.throws(() => changedPathsFromImmutableTrees(tree(entries, 'a'), tree(entries, 'b'), {
    ...options, candidateFiles: ['package.json'],
  }), /workspace manifest inventory/);
  assert.deepEqual(changedPathsFromImmutableTrees(tree(entries, 'a'), tree(entries, 'b'), {
    ...options, candidateFiles: ['package.json', 'packages/phantom/package.json'],
  }), []);
});

test('oversized immutable affected-path set fails closed rather than dropping paths', () => {
  const head = tree(Array.from({ length: 6001 }, (_, i) => blob(`file-${i}`)), 'b');
  assert.throws(() => changedPathsFromImmutableTrees(tree([], 'a'), head, options), /trusted bound/);
});
