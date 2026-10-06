import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import policy from '../trusted-policy.json' with { type: 'json' };

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const workflow = await readFile(path.join(root, '.github/workflows/r3-trusted-verifier.yml'), 'utf8');
const cli = await readFile(path.join(root, 'scripts/root-audit/cli.mjs'), 'utf8');
const audit = await readFile(path.join(root, 'scripts/root-audit/audit.mjs'), 'utf8');

test('workflow is dispatch-only and validates main before using the trusted checkout', () => {
  assert.match(workflow, /^on:\n  workflow_dispatch:/m);
  assert.match(workflow, /if: github\.event_name == 'workflow_dispatch' && github\.ref == 'refs\/heads\/main'/);
  assert.match(workflow, /ref: \$\{\{ github\.sha \}\}/);
  assert.doesNotMatch(workflow, /^\s+(pull_request|pull_request_target|push|schedule):/m);
});

test('all workflow permissions are read-only and scoped to API needs', () => {
  assert.match(workflow, /^permissions: \{\}/m);
  assert.match(workflow, /permissions:\n      contents: read\n      pull-requests: read\n      issues: read/);
  assert.doesNotMatch(workflow, /\b(contents|issues|pull-requests|actions|deployments|id-token|packages): write\b/);
  assert.doesNotMatch(workflow, /secrets\.[A-Z0-9_]+/);
  assert.match(workflow, /GH_TOKEN: \$\{\{ github\.token \}\}/);
});

test('every action uses its exact full commit SHA pinned in trusted policy', () => {
  const uses = [...workflow.matchAll(/^\s+uses:\s+([^\s]+)$/gm)].map((match) => match[1]);
  assert.equal(uses.length, Object.keys(policy.actions).length);
  for (const [name, sha] of Object.entries(policy.actions)) {
    assert.ok(uses.includes(`${name}@${sha}`), `missing immutable pin for ${name}`);
    assert.match(sha, /^[a-f0-9]{40}$/);
  }
  assert.doesNotMatch(workflow, /uses:\s+[^\s]+@(v\d+|main|master)\b/);
});

test('workflow sends only explicit SHA inputs through environment variables to base code', () => {
  for (const input of ['pr_number', 'expected_head_sha', 'expected_base_sha', 'security_review_sha256']) {
    assert.match(workflow, new RegExp(`^      ${input}:$`, 'm'));
  }
  assert.match(workflow, /run: node scripts\/root-audit\/cli\.mjs/);
  assert.doesNotMatch(workflow, /\$\{\{\s*inputs\.[^}]+\}\}[^\n]*run:/);
  assert.doesNotMatch(workflow, /npm (install|test|run)|pnpm (install|test|run)|download-artifact|cache:/);
});

test('candidate acquisition is bounded to trusted allowlist and exact SHA API requests', () => {
  assert.match(cli, /for \(const file of policy\.candidateFiles\)/);
  assert.match(cli, /searchParams\.set\('ref', headSha\)/);
  assert.match(cli, /fetchCandidateFile\(event\.apiUrl, preflight\.candidate\.headRepo, file, input\.expectedHeadSha/);
  assert.match(cli, /const github = await getGitHubState\(event\.apiUrl, input\.prNumber/);
  assert.match(cli, /JSON\.stringify\(github\.candidate\) !== JSON\.stringify\(preflight\.candidate\)/);
  assert.match(cli, /candidate\.headSha !== expectedHeadSha \|\| candidate\.baseSha !== expectedBaseSha/);
  assert.match(cli, /GITHUB_EVENT_NAME/);
  assert.match(cli, /GITHUB_WORKFLOW_SHA/);
  assert.doesNotMatch(cli, /child_process|execFile|import\([^)]*candidate|eval\(/);
});

test('audit workspace is generated and child environment cannot receive GitHub credentials', () => {
  assert.match(audit, /const env = \{/);
  assert.match(audit, /npm_config_userconfig: '\/dev\/null'/);
  assert.match(audit, /npm_config_globalconfig: '\/dev\/null'/);
  assert.match(audit, /npm_config_ignore_scripts: 'true'/);
  assert.match(audit, /safeManifest\(manifest, policy\)/);
  assert.match(audit, /await writeFile\(path\.join\(destination, 'package\.json'/);
  assert.doesNotMatch(audit, /candidateFiles\[['"](?:\.npmrc|\.pnpmfile\.cjs)['"]\]/);
  assert.match(audit, /runAsAuditUser\('pnpm', \['--filter', '@kirari\/site', 'audit', '--json', '--audit-level=moderate'\]/);
  assert.match(audit, /'-u', 'nobody'/);
  assert.match(audit, /'\/usr\/bin\/env', '-i'/);
  assert.doesNotMatch(audit, /--ignore-registry-errors|pnpm install|npm install/);
});

test('GitHub API reads are byte-limited while streaming before JSON allocation', async () => {
  assert.match(cli, /response\.body\?\.getReader\(\)/);
  assert.match(cli, /byteLength > responseLimit/);
  assert.match(cli, /MAX_DECISION_COMMENT_BYTES/);
  assert.match(cli, /AbortSignal\.timeout\(20_000\)/);
});

test('workflow preserves bounded evidence without downloading or executing artifacts', () => {
  assert.match(workflow, /actions\/upload-artifact@[a-f0-9]{40}/);
  assert.match(workflow, /retention-days: 30/);
  assert.match(workflow, /if: always\(\)/);
  assert.doesNotMatch(workflow, /actions\/download-artifact|gh run download/);
});
