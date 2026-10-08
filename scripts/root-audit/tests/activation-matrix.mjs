import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { deriveNormalAudit, evaluateVerification } from '../evaluator.mjs';
import {
  buildPublisherResult, checkPayload, buildExternalId, decisionIsCurrent,
  evaluateContinuingEligibility, findIdempotentCheck, publishCheck,
  REQUIRED_CHECK_NAME, VERIFIER_WORKFLOW_PATH, validateWorkflowMetadata,
} from '../publisher-contract.mjs';
import { revokeCachedSuccesses } from '../revalidation.mjs';
import { runRevocation } from '../revalidation-cli.mjs';
import { listImmutableChangedPaths } from '../immutable-trees.mjs';
import { createContext, ownerApproval, approvalSecurityDigest } from './fixtures.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const NOW = Date.parse('2026-10-08T00:00:00.000Z');
const EXPIRY = '2026-10-09T00:00:00.000Z';
const APP_ID = 7654321; // Synthetic identity only; never a live App claim.
const REPOSITORY_ID = 123456789;
const HEAD = 'a'.repeat(40);
const BASE = 'b'.repeat(40);
const EVIDENCE_DIGEST = 'f'.repeat(64);
const METHOD_ISOLATION = 'actual modules with synthetic fixtures and in-memory adapters; outbound network disabled';
const manifest = JSON.parse(await readFile(path.join(ROOT, 'scripts/root-audit/ruleset-proposal.json'), 'utf8'));

function fixture() {
  const context = createContext({ expectedPrNumber: 1001, expectedHeadSha: HEAD, expectedBaseSha: BASE,
    expectedDecisionCommentId: 6019999999, expectedSecurityReviewDigest: approvalSecurityDigest, now: NOW });
  Object.assign(context.candidate, { number: 1001, headSha: HEAD, baseSha: BASE });
  Object.assign(context.trusted, { sha: BASE, workflowSha: BASE });
  context.comments = [ownerApproval(context, { expiresAt: EXPIRY })];
  const result = evaluateVerification(context);
  result.trustedRun.repositoryId = REPOSITORY_ID;
  result.trustedRun.workflowPath = VERIFIER_WORKFLOW_PATH;
  const bundle = buildPublisherResult({ result, repository: 'markd3ng/KIRARI', repositoryId: REPOSITORY_ID, evidenceDigest: EVIDENCE_DIGEST });
  const source = { action: 'completed', status: 'completed', repository: 'markd3ng/KIRARI', repositoryId: REPOSITORY_ID,
    runId: Number(result.trustedRun.id), runNumber: 124, runAttempt: Number(result.trustedRun.attempt),
    conclusion: 'success', workflowId: 9876543, mainSha: BASE, workflowPath: VERIFIER_WORKFLOW_PATH };
  const publisher = { sha: BASE, policyDigest: 'c'.repeat(64) };
  const state = { now: NOW, head: HEAD, base: BASE, main: BASE, headRepository: 'markd3ng/KIRARI', checks: [],
    comment: { ...context.comments[0], issue_url: 'https://api.github.com/repos/markd3ng/KIRARI/issues/135' },
    issue122: bundle.issue122, issue135: bundle.issue135, writes: [], prReads: 0, createResponseApp: APP_ID };
  const adapter = {
    apiUrl: 'https://api.github.com', now: () => state.now,
    async assertPullRequest(number, head, base, repository) {
      state.prReads += 1;
      assert.equal(number, 1001);
      if (state.head !== head || state.base !== base || state.main !== base ||
          (repository !== undefined && repository !== state.headRepository)) throw new Error('live candidate source, HEAD, base or main changed');
    },
    async assertIssue122(expected) { assert.deepEqual(state.issue122, expected, 'live #122 contract drift'); },
    async assertIssue135(expected) { assert.deepEqual(state.issue135, expected, 'live #135 contract drift'); },
    async getDecisionComment(id) { assert.equal(id, context.expectedDecisionCommentId); return state.comment; },
    async listCandidateHeads() { return [state.head]; },
    async listChecks(head) { return state.checks.filter((check) => check.head_sha === head); },
    async createCheck(payload) {
      state.writes.push({ method: 'CREATE', payload: structuredClone(payload) });
      const check = { ...payload, id: 10000 + state.checks.length, app: { id: state.createResponseApp } };
      state.checks.push(check);
      return check;
    },
    async updateCheck(id, patch) {
      state.writes.push({ method: 'PATCH', id, payload: structuredClone(patch) });
      const check = state.checks.find((item) => item.id === id);
      assert.ok(check, 'adapter refuses unknown check ID');
      Object.assign(check, patch);
      return check;
    },
  };
  return { context, result, bundle, source, publisher, state, adapter };
}

const publication = (f) => ({ bundle: f.bundle, source: f.source, evidenceDigest: EVIDENCE_DIGEST,
  publisher: f.publisher, appId: APP_ID, adapter: f.adapter });
const green = (overrides = {}) => ({ id: 777, name: REQUIRED_CHECK_NAME, head_sha: HEAD, app: { id: APP_ID },
  status: 'completed', conclusion: 'success', external_id: 'legacy-fixture-green', ...overrides });
function noNewSuccess(state) {
  assert.ok(state.writes.every(({ payload }) => payload.conclusion !== 'success'), 'new successful check is forbidden');
}
async function rejection(operation, pattern) {
  try { await operation(); } catch (error) {
    assert.match(error.message, pattern);
    return error.message;
  }
  assert.fail('expected fail-closed rejection did not occur');
}
async function withMockFetch(fetcher, operation) {
  const previous = globalThis.fetch;
  globalThis.fetch = fetcher;
  try { return await operation(); } finally { globalThis.fetch = previous; }
}
const revocationEnv = () => ({ GITHUB_REPOSITORY: 'markd3ng/KIRARI', GITHUB_REPOSITORY_ID: String(REPOSITORY_ID),
  GITHUB_REF: 'refs/heads/main', GITHUB_EVENT_NAME: 'workflow_dispatch',
  GITHUB_WORKFLOW_REF: 'markd3ng/KIRARI/.github/workflows/r3-authorization-revalidation.yml@refs/heads/main',
  GITHUB_SHA: BASE, GITHUB_WORKFLOW_SHA: BASE, GITHUB_API_URL: 'https://api.github.com',
  GH_TOKEN: 'synthetic-read-token-at-least20', R3_PUBLISHER_APP_ID: String(APP_ID), R3_PUBLISHER_ENABLED: 'true' });
function sourceRead(url) {
  const pathname = new URL(url).pathname;
  assert.ok(['/repos/markd3ng/KIRARI', '/repos/markd3ng/KIRARI/branches/main'].includes(pathname));
  return new Response(JSON.stringify(pathname.endsWith('/branches/main') ? { commit: { sha: BASE } }
    : { id: REPOSITORY_ID, full_name: 'markd3ng/KIRARI' }));
}

export async function runActivationMatrix() {
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error('activation matrix prohibits outbound network'); };
  const cases = [];
  async function run(id, name, expected, operation, isolationLevel = METHOD_ISOLATION) {
    const entry = { id, name, expected, isolationLevel, liveGitHubVerified: false, assertionResult: 'FAIL' };
    try { entry.observed = await operation(); entry.assertionResult = 'PASS'; }
    catch (error) { entry.observed = { assertionError: error.message }; }
    cases.push(entry);
  }
  try {
    await run(1, 'Valid authorization and exact source identity', 'Technical PASS; eligibility VALIDATED; merge admission BLOCKED; App conclusion failure', async () => {
      const f = fixture();
      const eligibility = await evaluateContinuingEligibility(publication(f));
      assert.deepEqual(eligibility, { technicalVerification: 'PASS', authorization: 'VALIDATED', mergeAdmission: 'BLOCKED', requiredCheckSuccessAllowed: false });
      const result = await publishCheck(publication(f));
      assert.equal(result.outcome, 'validated-but-blocked');
      assert.equal(f.state.checks.at(-1).conclusion, 'failure');
      assert.equal(f.result.authorization.exceptionConsumed, false);
      noNewSuccess(f.state);
      return { eligibility, publication: result.outcome, checkConclusion: f.state.checks.at(-1).conclusion, r3Consumed: false };
    });
    await run(2, 'Expired authorization', 'Verifier rejects expiry and publisher emits no success', async () => {
      const f = fixture(); f.context.now = Date.parse(EXPIRY); f.state.now = Date.parse(EXPIRY);
      const verifier = await rejection(() => evaluateVerification(f.context), /expired/);
      assert.equal(decisionIsCurrent(f.state.comment, f.bundle, f.adapter.apiUrl, f.state.now), false);
      const publisher = await rejection(() => publishCheck(publication(f)), /stale|expired/);
      noNewSuccess(f.state); return { verifier, publisher, decisionCurrent: false };
    });
    await run(3, 'Revoked authorization', 'Edited/revoked selected decision is rejected; no success', async () => {
      const f = fixture(); f.state.comment.body = f.state.comment.body.replace('APPROVE_R3_CONSUMPTION', 'REVOKE_R3_CONSUMPTION');
      const error = await rejection(() => publishCheck(publication(f)), /edited, revoked, rebound, or expired/);
      noNewSuccess(f.state); return { error, writes: f.state.writes.length };
    });
    await run(4, 'Replayed decision', 'Decision from original evidence cannot authorize a changed candidate digest', async () => {
      const f = fixture(); f.bundle.candidate.digest = '1'.repeat(64);
      const error = await rejection(() => publishCheck(publication(f)), /edited, revoked, rebound, or expired/);
      noNewSuccess(f.state); return { error, reusedCommentRejected: true };
    });
    await run(5, 'Changed candidate SHA', 'Current candidate HEAD mismatch rejects publication', async () => {
      const f = fixture(); f.state.head = '1'.repeat(40);
      const error = await rejection(() => publishCheck(publication(f)), /HEAD, base or main changed/);
      noNewSuccess(f.state); return { error, writes: f.state.writes.length };
    });
    await run(6, 'Changed verifier or workflow', 'Protected workflow/source edits and substituted workflow ID/path reject', async () => {
      const errors = [];
      const mockedRequests = [];
      const baseTreeSha = 'c'.repeat(40); const headTreeSha = 'd'.repeat(40);
      const dir = (name) => ({ path: name, type: 'tree', mode: '040000', sha: '2'.repeat(40) });
      const blob = (name) => ({ path: name, type: 'blob', mode: '100644', sha: '3'.repeat(40) });
      const changed = await listImmutableChangedPaths({ apiRoot: 'https://api.github.com/repos/markd3ng/KIRARI', baseSha: BASE, headSha: HEAD,
        request: async (url) => {
          mockedRequests.push(url);
          if (url.includes('/git/commits/')) return { sha: url.endsWith(BASE) ? BASE : HEAD,
            tree: { sha: url.endsWith(BASE) ? baseTreeSha : headTreeSha } };
          const base = url.includes(baseTreeSha);
          return { sha: base ? baseTreeSha : headTreeSha, truncated: false, tree: base
            ? [dir('.github'), dir('.github/workflows'), blob('.github/workflows/gate.yml')]
            : [dir('docs'), blob('docs/renamed-gate.yml')] };
        } });
      assert.ok(changed.includes('.github/workflows/gate.yml'));
      assert.equal(mockedRequests.some((url) => url.includes('/pulls/')), false);
      const immutable = fixture(); immutable.context.changedFiles = changed;
      errors.push(await rejection(() => evaluateVerification(immutable.context), /protected trusted-root paths/));
      for (const changedPath of ['.github/workflows/r3-trusted-verifier.yml', 'scripts/root-audit/evaluator.mjs']) {
        const f = fixture(); f.context.changedFiles = [changedPath];
        errors.push(await rejection(() => evaluateVerification(f.context), /protected trusted-root paths/));
      }
      const f = fixture(); f.context.trusted.workflowSha = '1'.repeat(40);
      errors.push(await rejection(() => evaluateVerification(f.context), /trusted base workflow/));
      errors.push(await rejection(() => validateWorkflowMetadata({ id: f.source.workflowId, path: '.github/workflows/forged.yml', state: 'active' }, f.source), /trusted verifier path/));
      return { errors, immutableChangedPaths: changed, mockedImmutableRequests: mockedRequests,
        mutablePrFileListingUsed: false, renamedProtectedSourceRejected: true };
    });
    await run(7, 'Changed R3 dependency topology', 'Extra R3 dependency route rejects exact topology', async () => {
      const f = fixture();
      const lock = f.context.candidateFiles['pnpm-lock.yaml'];
      f.context.candidateFiles['pnpm-lock.yaml'] = lock.replace('      "postcss-selector-parser": "6.0.10"',
        '      "postcss-nested": "6.2.0"\n      "postcss-selector-parser": "6.0.10"');
      assert.notEqual(f.context.candidateFiles['pnpm-lock.yaml'], lock, 'topology mutation must occur');
      return { error: await rejection(() => evaluateVerification(f.context), /R3 dependency topology differs/) };
    });
    await run(8, 'Additional moderate/high/critical finding', 'Every additional unapproved qualifying severity rejects', async () => {
      const errors = [];
      for (const severity of ['moderate', 'high', 'critical']) {
        const f = fixture(); const raw = JSON.parse(f.context.audits.supplemental.raw);
        raw.advisories['1003'] = { ...structuredClone(raw.advisories['1001']), id: 1003, severity,
          github_advisory_id: `GHSA-fixture-extra-${severity}`, module_name: `extra-${severity}` };
        raw.metadata.vulnerabilities[severity] += raw.advisories['1003'].findings.length;
        f.context.audits.supplemental.raw = JSON.stringify(raw);
        f.context.audits.normal.raw = deriveNormalAudit(f.context.audits.supplemental.raw, f.context.policy);
        errors.push({ severity, error: await rejection(() => evaluateVerification(f.context), /unapproved .* advisory/) });
      }
      return { errors };
    });
    await run(9, 'Modified #122 exception', 'State/title/body drift rejects both verifier and publisher', async () => {
      const errors = [];
      for (const delta of [{ state: 'closed' }, { title: 'altered exception' }, { bodySha256: '0'.repeat(64) }]) {
        const f = fixture(); Object.assign(f.context.issue122, delta); f.state.issue122 = { ...f.bundle.issue122, ...delta };
        errors.push({ verifier: await rejection(() => evaluateVerification(f.context), /issue #122.*drift/),
          publisher: await rejection(() => publishCheck(publication(f)), /live #122 contract drift/) });
        noNewSuccess(f.state);
      }
      return { errors };
    });
    await run(10, 'Closed or altered #135 contract', 'Issue closure/title/body drift rejects both verifier and publisher', async () => {
      const errors = [];
      for (const delta of [{ state: 'closed' }, { title: 'altered decision issue' }, { bodySha256: '0'.repeat(64) }]) {
        const f = fixture(); Object.assign(f.context.issue135, delta); f.state.issue135 = { ...f.bundle.issue135, ...delta };
        errors.push({ verifier: await rejection(() => evaluateVerification(f.context), /decision issue metadata/),
          publisher: await rejection(() => publishCheck(publication(f)), /live #135 contract drift/) });
        noNewSuccess(f.state);
      }
      return { errors };
    });
    await run(11, 'Forged successful status', 'Same-name Actions green does not impersonate dedicated App', async () => {
      const f = fixture(); f.state.checks.push(green({ app: { id: 15368 } }));
      const payload = checkPayload(f.bundle, buildExternalId(f.bundle, f.publisher), f.publisher);
      assert.equal(findIdempotentCheck(f.state.checks, payload, APP_ID), null);
      const result = await publishCheck(publication(f)); noNewSuccess(f.state);
      assert.equal(f.state.checks.at(-1).conclusion, 'failure');
      return { forgeryAccepted: false, publication: result.outcome, isolatedDedicatedConclusion: 'failure',
        liveRulesetExpectedSourceBehavior: 'NOT_RUN_REAL_APP_REQUIRED' };
    });
    await run(12, 'Incorrect GitHub App identity', 'Wrong App in check creation response rejects completion', async () => {
      const f = fixture(); f.state.createResponseApp = 15368;
      const error = await rejection(() => publishCheck(publication(f)), /dedicated App, check name, HEAD/);
      noNewSuccess(f.state); return { error, completedChecks: f.state.checks.filter((check) => check.status === 'completed').length };
    });
    await run(13, 'Missing credentials', 'Missing installation token rejects actual revocation CLI; cannot claim old green removed', async () => {
      const methods = [];
      const error = await withMockFetch(async (url, options) => { methods.push(options.method); return sourceRead(url); },
        () => rejection(() => runRevocation({ mode: 'revoke', env: revocationEnv() }), /token is unavailable; cached checks could not be invalidated/));
      assert.ok(methods.every((method) => method === 'GET'));
      return { error, mockedHttpMethods: methods, cachedCheckInvalidationProven: false, enforcement: 'NOT_READY' };
    });
    await run(14, 'GitHub API failure', 'HTTP 503 rejects real CLI API path; no check mutation', async () => {
      const methods = [];
      const error = await withMockFetch(async (_url, options) => { methods.push(options.method); return new Response('synthetic API unavailable', { status: 503 }); },
        () => rejection(() => runRevocation({ mode: 'revoke', env: { ...revocationEnv(), R3_APP_TOKEN: 'synthetic-installation-token20' } }), /HTTP 503/));
      assert.deepEqual(methods, ['GET']);
      return { error, mockedHttpMethods: methods, enforcement: 'NOT_READY' };
    });
    await run(15, 'Concurrent updates and TOCTOU', 'Post-create HEAD drift records failure; readback concurrent green prevents complete-invalidation claim', async () => {
      const f = fixture(); const create = f.adapter.createCheck;
      f.adapter.createCheck = async (payload) => { const check = await create(payload); f.state.head = '1'.repeat(40); return check; };
      const publisher = await rejection(() => publishCheck(publication(f)), /HEAD, base or main changed/);
      assert.equal(f.state.checks[0].conclusion, 'failure'); noNewSuccess(f.state);
      const race = fixture(); race.state.checks.push(green()); let reads = 0;
      race.adapter.listChecks = async () => ++reads === 1 ? race.state.checks : [green({ id: 888 })];
      const revoked = await revokeCachedSuccesses({ appId: APP_ID, adapter: race.adapter });
      assert.equal(revoked.allObservedSuccessesInvalidated, false);
      assert.match(revoked.failures[0].message, /remains or appeared/);
      return { publisher, pendingCheckConclusion: 'failure', concurrentReadback: revoked,
        atomicMergeGuarantee: false, enforcement: 'NOT_READY' };
    });
    await run(16, 'Previously green check after authorization expiry', 'Previously green is invalidated before expired/stale evidence refusal when adapter is available', async () => {
      const f = fixture(); f.state.checks.push(green()); f.state.now = Date.parse(EXPIRY);
      const error = await rejection(() => publishCheck(publication(f)), /stale|expired/);
      assert.equal(f.state.checks[0].conclusion, 'failure'); noNewSuccess(f.state);
      return { error, previousCheckConclusion: 'failure', revocationObserved: 'AVAILABLE_ADAPTER_ONLY', outageGuarantee: false };
    });
    await run(17, 'Ruleset configuration prevents authorized recovery', 'Actual inert manifest requires independent Owner recovery; circular/App-only recovery fixtures reject', async () => {
      assert.equal(manifest.recovery.requiresPassingPublisherCheck, false);
      assert.equal(manifest.recovery.publisherMayModifyRulesets, false);
      assert.match(manifest.recovery.actor, /Owner account with repository administration/);
      assert.equal(manifest.recovery.restorePriorJsonRequired, true);
      const invalid = [
        { ...manifest.recovery, requiresPassingPublisherCheck: true },
        { ...manifest.recovery, publisherMayModifyRulesets: true },
        { ...manifest.recovery, actor: 'publisher installation token' },
      ];
      const unsafe = (recovery) => recovery.requiresPassingPublisherCheck || recovery.publisherMayModifyRulesets
        || !/Owner account with repository administration/.test(recovery.actor) || !recovery.restorePriorJsonRequired;
      assert.ok(invalid.every(unsafe), 'negative recovery fixture must be classified unsafe');
      assert.equal(manifest.activationReady, false);
      assert.equal(manifest.recovery.isolatedDemonstrationVerified, false);
      return { unsafeRecoveryFixturesRejectedByStaticContract: invalid.length, currentManifestSafeToKeepInert: true,
        liveRecoveryDemonstrated: false, enforcement: 'NOT_READY' };
    }, 'actual manifest invariant assertions and synthetic negative planning fixtures; no live ruleset or runtime application guard');
    await run(18, 'App outage or installation revocation', 'Invalidation incomplete; old green may persist; no new success; enforcement NOT_READY', async () => {
      const outcomes = [];
      for (const failure of ['App API timeout', 'GitHub API request failed with HTTP 401', 'GitHub API request failed with HTTP 403']) {
        const f = fixture(); f.state.checks.push(green());
        f.adapter.updateCheck = async () => { throw new Error(failure); };
        const result = await revokeCachedSuccesses({ appId: APP_ID, adapter: f.adapter });
        assert.equal(result.allObservedSuccessesInvalidated, false);
        assert.equal(result.requiredCheckSuccessAllowed, false);
        assert.equal(f.state.checks[0].conclusion, 'success', 'cached green persists during synthetic outage');
        outcomes.push({ failure, result, oldCheckConclusion: f.state.checks[0].conclusion });
      }
      assert.equal(manifest.continuingFreshness.cachedSuccessDuringAppOutageIsAutomaticallyInvalidated, false);
      return { outcomes, oldGreenMayPersist: true, noNativeFreshnessGuarantee: true, enforcement: 'NOT_READY' };
    });
  } finally { globalThis.fetch = realFetch; }
  assert.equal(cases.length, 18);
  const sourceFiles = ['tests/activation-matrix.mjs', 'tests/fixtures.mjs', 'evaluator.mjs', 'lockfile.mjs',
    'publisher-contract.mjs', 'publisher-cli.mjs', 'revalidation.mjs', 'revalidation-cli.mjs', 'immutable-trees.mjs',
    'trusted-policy.json', 'publisher-policy.json', 'ruleset-proposal.json'];
  const sourceSha256 = Object.fromEntries(await Promise.all(sourceFiles.map(async (relative) => {
    const file = `scripts/root-audit/${relative}`;
    return [file, createHash('sha256').update(await readFile(path.join(ROOT, file))).digest('hex')];
  })));
  return { schema: 'kirari.r3-isolated-activation-matrix/v1', executedAt: new Date().toISOString(),
    baselineMainSha: 'b3a295f30bc89083d03f03d77e6060b602f785e5', sourceSha256,
    syntheticFixtures: true, fixtureClock: new Date(NOW).toISOString(), fixturePrNumber: 1001,
    fixtureIdentityIsNotLiveApp: true, liveGitHubOperations: [], liveCredentialsUsed: false,
    caseCount: cases.length, assertionsPassed: cases.filter((entry) => entry.assertionResult === 'PASS').length,
    assertionsFailed: cases.filter((entry) => entry.assertionResult === 'FAIL').length,
    enforcementReadiness: 'NOT_READY', liveRecoveryVerified: false, rulesetApplied: false, r3Consumed: false, cases };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length > 3) throw new Error('usage: node scripts/root-audit/tests/activation-matrix.mjs [output.json]');
  const result = await runActivationMatrix();
  if (process.argv[2]) {
    await writeFile(path.resolve(process.argv[2]), `${JSON.stringify(result, null, 2)}\n`);
    process.stdout.write(`${JSON.stringify({ output: path.resolve(process.argv[2]), cases: result.caseCount,
      passed: result.assertionsPassed, failed: result.assertionsFailed, enforcementReadiness: result.enforcementReadiness })}\n`);
  } else {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  }
  if (result.assertionsFailed > 0) process.exitCode = 1;
}
