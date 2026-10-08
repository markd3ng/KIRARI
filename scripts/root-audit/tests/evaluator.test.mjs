import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { evaluateVerification } from '../evaluator.mjs';
import { prepareAuditWorkspace, restrictedEnvironment } from '../audit.mjs';
import { createAudits, createContext, createFixture, ownerApproval, approvalSecurityDigest, policy } from './fixtures.mjs';

const MARKER = 'KIRARI_R3_CONSUMPTION_DECISION_V1';

function evalError(context, pattern) {
  assert.throws(() => evaluateVerification(context), pattern);
}

function addAdvisory(context, severity) {
  const extra = {};
  for (const label of ['normal', 'supplemental']) {
    const report = JSON.parse(context.audits[label].raw);
    const original = report.advisories['1001'];
    extra[label] = {
      ...structuredClone(original),
      id: 1003,
      github_advisory_id: `GHSA-extra-${severity}`,
      module_name: `extra-${severity}`,
      severity,
    };
    report.advisories['1003'] = extra[label];
    report.metadata.vulnerabilities[severity] += 1;
    context.audits[label].raw = JSON.stringify(report);
  }
}

test('exact candidate data without consumption approval remains pending and non-consumable', () => {
  const result = evaluateVerification(createContext());
  assert.equal(result.trustedVerification, 'PASS');
  assert.equal(result.authorization.decision, 'PENDING');
  assert.equal(result.authorization.r3ExceptionConsumable, false);
  assert.equal(result.authorization.exceptionApplied, false);
  assert.equal(result.authorization.exceptionConsumed, false);
});

test('technical PASS does not authenticate or require a security review reference', () => {
  const context = createContext({ expectedSecurityReviewDigest: null });
  const result = evaluateVerification(context);
  assert.equal(result.trustedVerification, 'PASS');
  assert.equal(result.authorization.securityReviewDigest, null);
  assert.equal(result.authorization.r3ExceptionConsumable, false);
});

test('normal view removes only #122 while preserving pnpm raw severity totals', () => {
  const context = createContext();
  const raw = JSON.parse(context.audits.supplemental.raw);
  const normal = JSON.parse(context.audits.normal.raw);
  assert.ok(Object.values(raw.advisories).some((item) => item.github_advisory_id === policy.issue122.ghsa));
  assert.ok(Object.values(normal.advisories).every((item) => item.github_advisory_id !== policy.issue122.ghsa));
  assert.deepEqual(normal.metadata.vulnerabilities, raw.metadata.vulnerabilities);
  assert.equal(normal.metadata.vulnerabilities.high, 1);
  assert.equal(evaluateVerification(context).trustedVerification, 'PASS');
});

test('simulated exact future Owner approval is eligible only for its bound candidate and evidence', () => {
  const context = createContext({ expectedSecurityReviewDigest: approvalSecurityDigest, expectedDecisionCommentId: 6019999999 });
  context.comments = [ownerApproval(context)];
  const result = evaluateVerification(context);
  assert.equal(result.authorization.decision, 'APPROVED');
  assert.equal(result.authorization.r3ExceptionConsumable, true);
  assert.equal(result.authorization.exceptionApplied, false);
  assert.equal(result.authorization.exceptionConsumed, false);
});

test('PR HEAD mismatch fails closed', () => {
  const context = createContext();
  context.expectedHeadSha = '1'.repeat(40);
  evalError(context, /immutable SHA binding mismatch/);
});

test('closed PR state fails closed', () => {
  const context = createContext();
  context.candidate.state = 'closed';
  evalError(context, /pull request state or immutable SHA binding mismatch/);
});

test('merged PR state fails closed', () => {
  const context = createContext();
  context.candidate.merged = true;
  evalError(context, /pull request state or immutable SHA binding mismatch/);
});

test('PR base mismatch fails closed', () => {
  const context = createContext();
  context.expectedBaseSha = '1'.repeat(40);
  evalError(context, /immutable SHA binding mismatch/);
});

test('changed trusted pnpm audit parser version fails closed', () => {
  const context = createContext();
  context.audits.pnpmVersion = '9.15.0';
  evalError(context, /pnpm audit parser version mismatch/);
});

test('unignored audit severity totals must reconcile with advisory rows', () => {
  const context = createContext();
  for (const label of ['normal', 'supplemental']) {
    const report = JSON.parse(context.audits[label].raw);
    report.metadata.vulnerabilities.high = 500;
    context.audits[label].raw = JSON.stringify(report);
  }
  evalError(context, /vulnerability counts do not match its advisory set/);
});

test('audit subprocess environment excludes GitHub and package registry credentials', () => {
  const previous = Object.fromEntries(['GH_TOKEN', 'GITHUB_TOKEN', 'NPM_TOKEN', 'NODE_AUTH_TOKEN'].map((name) => [name, process.env[name]]));
  try {
    process.env.GH_TOKEN = 'unit-test-gh-token';
    process.env.GITHUB_TOKEN = 'unit-test-github-token';
    process.env.NPM_TOKEN = 'unit-test-npm-token';
    process.env.NODE_AUTH_TOKEN = 'unit-test-node-auth-token';
    const env = restrictedEnvironment();
    for (const name of ['GH_TOKEN', 'GITHUB_TOKEN', 'NPM_TOKEN', 'NODE_AUTH_TOKEN']) assert.equal(env[name], undefined);
    assert.equal(env.npm_config_userconfig, '/dev/null');
    assert.equal(env.npm_config_globalconfig, '/dev/null');
    assert.equal(env.npm_config_ignore_scripts, 'true');
  } finally {
    for (const [name, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
});

test('malicious candidate package scripts are excluded from the sanitized audit workspace', async () => {
  const temp = await mkdtemp(path.join(os.tmpdir(), 'r3-test-'));
  const marker = path.join(temp, 'script-ran');
  const context = createContext();
  const rootManifest = JSON.parse(context.candidateFiles['package.json']);
  rootManifest.scripts.preinstall = `node -e "require('fs').writeFileSync('${marker}', 'ran')"`;
  context.candidateFiles['package.json'] = JSON.stringify(rootManifest);
  const workspace = path.join(temp, 'workspace');
  await prepareAuditWorkspace(workspace, context.candidateFiles, policy);
  const written = JSON.parse(await readFile(path.join(workspace, 'package.json'), 'utf8'));
  assert.equal(written.scripts, undefined);
  await assert.rejects(stat(marker));
  await rm(temp, { recursive: true, force: true });
});

test('candidate .npmrc bytes are never copied into the audit workspace', async () => {
  const temp = await mkdtemp(path.join(os.tmpdir(), 'r3-test-'));
  const context = createContext();
  context.candidateFiles['.npmrc'] = 'registry=https://attacker.invalid\n';
  const workspace = path.join(temp, 'workspace');
  await prepareAuditWorkspace(workspace, context.candidateFiles, policy);
  assert.equal(await readFile(path.join(workspace, '.npmrc'), 'utf8'), '');
  await rm(temp, { recursive: true, force: true });
});

test('candidate .pnpmfile.cjs bytes are never copied into the audit workspace', async () => {
  const temp = await mkdtemp(path.join(os.tmpdir(), 'r3-test-'));
  const context = createContext();
  context.candidateFiles['.pnpmfile.cjs'] = 'throw new Error("candidate hook loaded")';
  const workspace = path.join(temp, 'workspace');
  await prepareAuditWorkspace(workspace, context.candidateFiles, policy);
  await assert.rejects(stat(path.join(workspace, '.pnpmfile.cjs')));
  await rm(temp, { recursive: true, force: true });
});

test('candidate evaluator is hashed as data and never executed', () => {
  const context = createContext();
  context.candidateFiles['scripts/root-audit/evaluator.mjs'] = 'process.exit(99);';
  const result = evaluateVerification(context);
  assert.equal(result.trustedVerification, 'PASS');
});

test('ordinary App checks reject PR changes to workflows or trusted verifier/publisher sources', () => {
  for (const file of [
    '.github/workflows/r3-trusted-publisher.yml',
    '.github/workflows/new-secret-consumer.yml',
    'scripts/root-audit/publisher-cli.mjs',
    'scripts/root-audit/evaluator.mjs',
  ]) {
    const context = createContext({ changedFiles: [file] });
    context.candidateFiles['scripts/root-audit/evaluator.mjs'] = 'process.exit(99);';
    evalError(context, /candidate changes protected trusted-root paths/);
  }
});

test('candidate workflow is hashed as data and never executed', () => {
  const context = createContext();
  context.candidateFiles['.github/workflows/ci.yml'] = 'run: exit 99\n';
  const result = evaluateVerification(context);
  assert.equal(result.trustedVerification, 'PASS');
});

test('candidate R3 verifier workflow is fetched only as data and never executed', () => {
  const context = createContext();
  context.candidateFiles['.github/workflows/r3-trusted-verifier.yml'] = 'run: process.exit(99)\n';
  const result = evaluateVerification(context);
  assert.equal(result.trustedVerification, 'PASS');
  assert.equal(result.candidate.files['.github/workflows/r3-trusted-verifier.yml'].length, 64);
});

test('candidate trusted-policy bytes are hashed as data and never replace the base policy', () => {
  const context = createContext();
  const originalPolicy = context.policy;
  const originalDigest = context.candidate.digest;
  context.candidateFiles['scripts/root-audit/trusted-policy.json'] = JSON.stringify({ repository: 'attacker/repository' });
  const result = evaluateVerification(context);
  assert.notEqual(result.candidate.digest, originalDigest);
  assert.equal(context.policy, originalPolicy);
  assert.equal(result.trustedVerification, 'PASS');
});

test('trusted verifier source SHA must equal the expected PR base SHA', () => {
  const context = createContext();
  context.trusted.sha = '1'.repeat(40);
  context.trusted.workflowSha = context.trusted.sha;
  assert.throws(() => evaluateVerification(context), /workflow run is not bound to the trusted base workflow/);
});

test('an unrelated decision marker cannot be selected implicitly', () => {
  const context = createContext();
  context.comments = [ownerApproval(context)];
  evalError(context, /not selected by its immutable comment ID/);
});

test('candidate-generated audit artifact is outside the allowlist and cannot be authoritative', () => {
  const context = createContext();
  context.candidateFiles['candidate-audit-artifact.json'] = JSON.stringify({ trusted: true });
  evalError(context, /candidate input allowlist mismatch/);
});

test('altered R3 GHSA fails closed', () => {
  const context = createContext();
  for (const label of ['normal', 'supplemental']) {
    const report = JSON.parse(context.audits[label].raw);
    report.advisories['1001'].github_advisory_id = 'GHSA-altered';
    context.audits[label].raw = JSON.stringify(report);
  }
  evalError(context, /normal R3 advisory identity mismatch/);
});

test('an additional moderate advisory fails closed', () => {
  const context = createContext();
  addAdvisory(context, 'moderate');
  evalError(context, /unapproved moderate advisory/);
});

test('an additional high advisory fails closed', () => {
  const context = createContext();
  addAdvisory(context, 'high');
  evalError(context, /unapproved high advisory/);
});

test('an additional critical advisory fails closed', () => {
  const context = createContext();
  addAdvisory(context, 'critical');
  evalError(context, /unapproved critical advisory/);
});

test('malformed audit JSON fails closed', () => {
  const context = createContext();
  context.audits.normal.raw = '{not json';
  evalError(context, /audit JSON is malformed/);
});

test('audit schema drift fails closed', () => {
  const context = createContext();
  const report = JSON.parse(context.audits.supplemental.raw);
  delete report.metadata.vulnerabilities.critical;
  context.audits.supplemental.raw = JSON.stringify(report);
  evalError(context, /audit schema drift: critical count/);
});

test('missing raw audit fails closed', () => {
  const context = createContext();
  context.audits.supplemental.raw = '';
  evalError(context, /supplemental raw audit missing/);
});

test('audit command not executed fails closed', () => {
  const context = createContext();
  context.audits.supplemental.executed = false;
  evalError(context, /supplemental audit evidence was not produced/);
});

test('extra R3 dependency path fails exact lockfile topology validation', () => {
  const context = createContext();
  context.candidateFiles['pnpm-lock.yaml'] = context.candidateFiles['pnpm-lock.yaml'].replace(
    '      "postcss-selector-parser": "6.0.10"',
    '      "postcss-nested": "6.2.0"\n      "postcss-selector-parser": "6.0.10"',
  );
  evalError(context, /R3 dependency topology differs/);
});

test('missing R3 dependency path fails exact lockfile topology validation', () => {
  const files = createFixture();
  const site = JSON.parse(files['apps/site/package.json']);
  delete site.dependencies['@expressive-code/plugin-line-numbers'];
  const context = createContext({ siteDependencies: site.dependencies });
  evalError(context, /R3 dependency topology differs/);
});

test('wrong R3 dependency version fails exact lockfile topology validation', () => {
  const context = createContext();
  context.candidateFiles['pnpm-lock.yaml'] = context.candidateFiles['pnpm-lock.yaml']
    .replaceAll('postcss-selector-parser@6.0.10', 'postcss-selector-parser@6.0.11')
    .replace('"postcss-selector-parser": "6.0.10"', '"postcss-selector-parser": "6.0.11"');
  evalError(context, /R3 dependency topology differs/);
});

test('issue #122 state drift fails closed', () => {
  const context = createContext();
  context.issue122.state = 'closed';
  evalError(context, /issue #122 state, title, or body digest drift/);
});

test('expired future Owner approval fails closed', () => {
  const context = createContext({ expectedSecurityReviewDigest: approvalSecurityDigest, expectedDecisionCommentId: 6019999999 });
  context.comments = [ownerApproval(context, { expiresAt: '2026-10-05T23:59:59.000Z' })];
  evalError(context, /expired or malformed/);
});

test('unauthenticated local fake approval fails closed', () => {
  const context = createContext({ expectedSecurityReviewDigest: approvalSecurityDigest, expectedDecisionCommentId: 6019999999 });
  const fake = ownerApproval(context);
  fake.author_association = 'NONE';
  fake.user.login = 'attacker';
  context.comments = [fake];
  evalError(context, /not an authenticated repository Owner/);
});

test('approval posted on the wrong issue fails closed', () => {
  const context = createContext({ expectedSecurityReviewDigest: approvalSecurityDigest, expectedDecisionCommentId: 6019999999 });
  const wrongIssue = ownerApproval(context);
  wrongIssue.issueNumber = 129;
  context.comments = [wrongIssue];
  evalError(context, /not an authenticated repository Owner/);
});

test('approval without a concrete GitHub comment ID fails closed', () => {
  const context = createContext({ expectedSecurityReviewDigest: approvalSecurityDigest, expectedDecisionCommentId: 6019999999 });
  const noId = ownerApproval(context);
  noId.id = null;
  context.comments = [noId];
  evalError(context, /not selected by its immutable comment ID/);
});

test('approval record bound to a different GitHub comment ID fails closed', () => {
  const context = createContext({ expectedSecurityReviewDigest: approvalSecurityDigest, expectedDecisionCommentId: 6019999999 });
  const wrongComment = ownerApproval(context);
  wrongComment.id += 1;
  context.comments = [wrongComment];
  evalError(context, /not selected by its immutable comment ID/);
});

test('an internal verifier exception is surfaced as a failure', () => {
  const context = createContext();
  context.candidateFiles['pnpm-lock.yaml'] = null;
  evalError(context, /invalid candidate input pnpm-lock.yaml/);
});

test('local fixture audits are never mistaken for a live GitHub approval', () => {
  const context = createContext({ audits: createAudits() });
  const result = evaluateVerification(context);
  assert.equal(result.authorization.decision, 'PENDING');
  assert.equal(result.authorization.r3ExceptionConsumable, false);
});

test(`a decision comment must begin with the exact ${MARKER} marker`, () => {
  const context = createContext({ expectedSecurityReviewDigest: approvalSecurityDigest });
  context.comments = [{ ...ownerApproval(context), body: ` ${ownerApproval(context).body}` }];
  const result = evaluateVerification(context);
  assert.equal(result.authorization.decision, 'PENDING');
});
