import assert from 'node:assert/strict';
import test from 'node:test';
import { parseAndValidateLockfile } from '../lockfile.mjs';
import { createFixture, createContext, policy } from './fixtures.mjs';

test('pnpm v9 importer and snapshot traversal returns exactly the reviewed routes', () => {
  const candidateFiles = createFixture();
  const result = parseAndValidateLockfile(candidateFiles['pnpm-lock.yaml'], candidateFiles, policy);
  assert.equal(result.lockfileVersion, '9.0');
  assert.deepEqual(result.r3Paths, [...policy.r3.paths].sort());
  assert.deepEqual(result.issue122Paths, [...policy.issue122.paths].sort());
  assert.equal(result.importers.length, 4);
});

test('unknown importer fails closed', () => {
  const candidateFiles = createFixture();
  candidateFiles['pnpm-lock.yaml'] = candidateFiles['pnpm-lock.yaml'].replace(
    '  "packages/site-profile":\npackages:',
    '  "packages/site-profile":\n  "unreviewed/workspace": {}\npackages:',
  );
  assert.throws(() => parseAndValidateLockfile(candidateFiles['pnpm-lock.yaml'], candidateFiles, policy), /workspace importer set mismatch/);
});

test('a changed lockfile parser format fails closed', () => {
  const candidateFiles = createFixture();
  candidateFiles['pnpm-lock.yaml'] = candidateFiles['pnpm-lock.yaml'].replace("lockfileVersion: '9.0'", "lockfileVersion: '10.0'");
  assert.throws(() => parseAndValidateLockfile(candidateFiles['pnpm-lock.yaml'], candidateFiles, policy), /lockfileVersion is not 9.0/);
});

test('YAML anchors and aliases are rejected instead of being interpreted', () => {
  const candidateFiles = createFixture();
  candidateFiles['pnpm-lock.yaml'] = candidateFiles['pnpm-lock.yaml'].replace('packages:\n', 'packages:\n  &injected: {}\n');
  assert.throws(() => parseAndValidateLockfile(candidateFiles['pnpm-lock.yaml'], candidateFiles, policy), /anchor, alias, or tag/);
});

test('duplicate importer keys fail closed', () => {
  const candidateFiles = createFixture();
  candidateFiles['pnpm-lock.yaml'] = candidateFiles['pnpm-lock.yaml'].replace(
    '  "packages/site-profile":\npackages:',
    '  "packages/site-profile":\n  "packages/site-profile":\npackages:',
  );
  assert.throws(() => parseAndValidateLockfile(candidateFiles['pnpm-lock.yaml'], candidateFiles, policy), /duplicate importer/);
});

test('wrong workspace dependency specifier fails closed', () => {
  const candidateFiles = createFixture();
  const site = JSON.parse(candidateFiles['apps/site/package.json']);
  site.dependencies.astro = '^7.0.0';
  candidateFiles['apps/site/package.json'] = JSON.stringify(site);
  assert.throws(() => parseAndValidateLockfile(candidateFiles['pnpm-lock.yaml'], candidateFiles, policy), /specifier mismatch/);
});

test('candidate exception cannot broaden beyond the independent #122 CVE', () => {
  const candidateFiles = createFixture();
  const root = JSON.parse(candidateFiles['package.json']);
  root.pnpm.auditConfig.ignoreCves.push('CVE-OTHER');
  candidateFiles['package.json'] = JSON.stringify(root);
  assert.throws(() => parseAndValidateLockfile(candidateFiles['pnpm-lock.yaml'], candidateFiles, policy), /candidate audit exception differs/);
});

test('malformed duplicate audit policy state is rejected before audit', () => {
  const context = createContext();
  context.candidateFiles['pnpm-workspace.yaml'] = 'packages: []\n';
  assert.throws(() => parseAndValidateLockfile(context.candidateFiles['pnpm-lock.yaml'], context.candidateFiles, policy), /workspace configuration mismatch/);
});
