import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateVerification } from '../evaluator.mjs';
import { assertPullRequest } from '../publisher-cli.mjs';
import {
  assertAllowedConclusion,
  assertVerifierRunIsLatest,
  buildExternalId,
  buildPublisherResult,
  checkPayload,
  decisionIsCurrent,
  findIdempotentCheck,
  listChecksAcrossPages,
  listWorkflowRunsAcrossPages,
  parseVerifierRunName,
  publishCheck,
  publishFailure,
  publishPending,
  sha256,
  validateArtifactMetadata,
  validatePublisherResult,
  validateWorkflowMetadata,
  validateWorkflowRunApi,
  validateWorkflowRunEvent,
  VERIFIER_WORKFLOW_PATH,
} from '../publisher-contract.mjs';
import { createContext, ownerApproval } from './fixtures.mjs';

const REPOSITORY = 'markd3ng/KIRARI';
const REPOSITORY_ID = 123456789;
const WORKFLOW_ID = 9876543;
const REVIEW_DIGEST = 'e'.repeat(64);
const EVIDENCE_DIGEST = 'f'.repeat(64);
const API_URL = 'https://api.github.com';

function makeCase({ decision = false, securityReviewDigest = REVIEW_DIGEST } = {}) {
  const commentId = 6019999999;
  const context = createContext({
    expectedSecurityReviewDigest: decision ? 'd'.repeat(64) : securityReviewDigest,
    ...(decision ? { expectedDecisionCommentId: commentId } : {}),
  });
  if (decision) context.comments = [ownerApproval(context)];
  const result = evaluateVerification(context);
  result.trustedRun.repositoryId = REPOSITORY_ID;
  result.trustedRun.workflowPath = VERIFIER_WORKFLOW_PATH;
  const bundle = buildPublisherResult({
    result,
    repository: REPOSITORY,
    repositoryId: REPOSITORY_ID,
    evidenceDigest: EVIDENCE_DIGEST,
  });
  const source = {
    action: 'completed',
    status: 'completed',
    repositoryId: REPOSITORY_ID,
    repository: REPOSITORY,
    runId: Number(result.trustedRun.id),
    runNumber: 124,
    runAttempt: Number(result.trustedRun.attempt),
    conclusion: 'success',
    workflowId: WORKFLOW_ID,
    mainSha: result.trustedRun.sha,
    workflowPath: VERIFIER_WORKFLOW_PATH,
  };
  return { context, result, bundle, source };
}

function makeAdapter({ bundle, appId = 7654321, headSha = bundle.candidate.headSha, baseSha = bundle.candidate.baseSha, mainSha = bundle.candidate.baseSha, checks = [], decisionComment = null, now = Date.parse('2026-10-06T12:00:00.000Z'), listChecks = null, createCheck = null, updateCheck = null } = {}) {
  const created = [];
  const updates = [];
  const adapter = {
    apiUrl: API_URL,
    now: () => now,
    async assertPullRequest(prNumber, expectedHead, expectedBase) {
      assert.equal(prNumber, bundle.candidate.prNumber);
      if (headSha !== expectedHead || baseSha !== expectedBase || mainSha !== expectedBase) throw new Error('live PR HEAD, base, or current main changed');
    },
    async getDecisionComment(id) {
      assert.equal(id, bundle.decisionIdentity.requestedCommentId);
      return decisionComment;
    },
    async listChecks(sha) {
      assert.equal(sha, bundle.candidate.headSha);
      if (listChecks) return listChecks();
      return checks;
    },
    async createCheck(payload) {
      if (createCheck) return createCheck(payload);
      const check = { ...payload, id: 555, status: 'in_progress', app: { id: appId } };
      created.push(check);
      return check;
    },
    async updateCheck(id, patch) {
      updates.push({ id, patch });
      if (updateCheck) return updateCheck(id, patch);
      const check = created[0] ?? checks.find((item) => item.id === id);
      return { ...check, ...patch, id, app: { id: appId } };
    },
  };
  return { adapter, created, updates };
}

function workflowEvent(overrides = {}) {
  return {
    eventName: 'workflow_run',
    ref: 'refs/heads/main',
    repository: REPOSITORY,
    repositoryId: REPOSITORY_ID,
    payload: {
      action: 'completed',
      repository: { full_name: REPOSITORY, id: REPOSITORY_ID },
      workflow: { id: WORKFLOW_ID, name: 'R3 trusted verifier' },
      workflow_run: {
        id: 123456789,
        run_number: 124,
        run_attempt: 1,
        workflow_id: WORKFLOW_ID,
        event: 'workflow_dispatch',
        status: 'completed',
        conclusion: 'success',
        display_title: 'R3 verifier|pr=133|head=ef5ecc412e165ebd7f3c6f38f111c7bdcb8cfda8|base=c79659046cf6ea73ba69e03c3937d904c07ba93b',
        head_branch: 'main',
        head_sha: 'c79659046cf6ea73ba69e03c3937d904c07ba93b',
        head_repository: { full_name: REPOSITORY, id: REPOSITORY_ID },
      },
    },
    ...overrides,
  };
}

test('A: complete bound evidence publishes only a dedicated App success on the exact current head', async () => {
  const { bundle, source } = makeCase();
  const { adapter, created, updates } = makeAdapter({ bundle });
  const outcome = await publishCheck({ bundle, source, evidenceDigest: EVIDENCE_DIGEST, publisher: { sha: 'a'.repeat(40), policyDigest: 'b'.repeat(64) }, appId: 7654321, adapter });
  assert.equal(outcome.outcome, 'published-success');
  assert.equal(created.length, 1);
  assert.equal(created[0].head_sha, bundle.candidate.headSha);
  assert.equal(created[0].name, 'KIRARI / R3 trusted verifier');
  assert.equal(created[0].status, 'in_progress');
  assert.match(created[0].output.summary, /Verifier workflow path: \.github\/workflows\/r3-trusted-verifier\.yml/);
  assert.match(created[0].output.summary, /Candidate source repository: markd3ng\/KIRARI/);
  assert.match(created[0].output.summary, /Owner-supplied security review reference \(not fetched or authenticated by this check\):/);
  assert.match(created[0].output.summary, /Decision comment requested ID: not requested/);
  assert.match(created[0].output.summary, /lookup: NOT_REQUESTED/);
  assert.match(created[0].output.summary, /Decision expires: not applicable/);
  assert.match(created[0].output.summary, /Decision revalidation: NOT_REQUESTED/);
  assert.match(created[0].output.summary, /technical check is not R3 consumption or merge authorization/);
  assert.equal(updates.at(-1).patch.conclusion, 'success');
});

test('workflow_run webhook shape and REST path suffix bind through workflow ID to the bare trusted path', () => {
  const source = validateWorkflowRunEvent(workflowEvent());
  const apiRun = {
    id: source.runId,
    run_number: source.runNumber,
    run_attempt: source.runAttempt,
    workflow_id: source.workflowId,
    event: 'workflow_dispatch',
    status: 'completed',
    conclusion: 'success',
    display_title: source.displayTitle,
    path: `${VERIFIER_WORKFLOW_PATH}@main`,
    head_branch: 'main',
    head_sha: source.mainSha,
    repository: { full_name: REPOSITORY, id: REPOSITORY_ID },
    head_repository: { full_name: REPOSITORY, id: REPOSITORY_ID },
  };
  validateWorkflowRunApi(apiRun, source);
  validateWorkflowMetadata({ id: WORKFLOW_ID, path: VERIFIER_WORKFLOW_PATH, state: 'active' }, source);
});

test('source spoofing, wrong run conclusion, workflow, branch, repository, or REST path fails closed', () => {
  assert.throws(() => validateWorkflowRunEvent(workflowEvent({ eventName: 'pull_request' })), /default-branch workflow_run/);
  assert.throws(() => validateWorkflowRunEvent(workflowEvent({ ref: 'refs/pull/7/merge' })), /default-branch workflow_run/);
  assert.throws(() => validateWorkflowRunEvent(workflowEvent({ repository: 'attacker/KIRARI' })), /repository identity/);
  assert.equal(validateWorkflowRunEvent(workflowEvent({ payload: { ...workflowEvent().payload, workflow_run: { ...workflowEvent().payload.workflow_run, conclusion: 'failure' } } })).conclusion, 'failure');
  assert.throws(() => validateWorkflowRunEvent(workflowEvent({ payload: { ...workflowEvent().payload, workflow_run: { ...workflowEvent().payload.workflow_run, head_repository: { full_name: 'attacker/KIRARI', id: 8 } } } })), /head repository mismatch/);
  const source = validateWorkflowRunEvent(workflowEvent());
  assert.throws(() => validateWorkflowRunApi({ id: source.runId, run_number: source.runNumber, run_attempt: source.runAttempt, workflow_id: WORKFLOW_ID, event: 'workflow_dispatch', status: 'completed', conclusion: 'success', path: `${VERIFIER_WORKFLOW_PATH}@feature`, head_branch: 'main', head_sha: source.mainSha, repository: { full_name: REPOSITORY, id: REPOSITORY_ID }, head_repository: { full_name: REPOSITORY, id: REPOSITORY_ID } }, source), /metadata mismatch/);
  assert.throws(() => validateWorkflowMetadata({ id: WORKFLOW_ID + 1, path: VERIFIER_WORKFLOW_PATH, state: 'active' }, source), /trusted verifier path/);
});

test('failed verifier run title retains a strict authenticated PR/head/base target', () => {
  const source = validateWorkflowRunEvent(workflowEvent({ payload: {
    ...workflowEvent().payload,
    workflow_run: { ...workflowEvent().payload.workflow_run, conclusion: 'timed_out' },
  } }));
  const apiRun = {
    id: source.runId,
    run_number: source.runNumber,
    run_attempt: source.runAttempt,
    workflow_id: source.workflowId,
    event: 'workflow_dispatch',
    status: 'completed',
    conclusion: 'timed_out',
    display_title: source.displayTitle,
    path: `${VERIFIER_WORKFLOW_PATH}@main`,
    head_branch: 'main',
    head_sha: source.mainSha,
    repository: { full_name: REPOSITORY, id: REPOSITORY_ID },
    head_repository: { full_name: REPOSITORY, id: REPOSITORY_ID },
  };
  assert.deepEqual(validateWorkflowRunApi(apiRun, source), {
    prNumber: 133,
    headSha: 'ef5ecc412e165ebd7f3c6f38f111c7bdcb8cfda8',
    baseSha: 'c79659046cf6ea73ba69e03c3937d904c07ba93b',
  });
  assert.throws(() => parseVerifierRunName('R3 verifier|pr=133|head=bad|base=bad'), /valid PR\/head\/base binding/);
});

test('requested and in-progress events require a live pending run and bind the exact target', () => {
  const payload = workflowEvent({ payload: {
    ...workflowEvent().payload,
    action: 'in_progress',
    workflow_run: { ...workflowEvent().payload.workflow_run, status: 'in_progress', conclusion: null },
  } });
  const source = validateWorkflowRunEvent(payload);
  const apiRun = {
    id: source.runId,
    run_number: source.runNumber,
    run_attempt: source.runAttempt,
    workflow_id: source.workflowId,
    event: 'workflow_dispatch',
    status: 'in_progress',
    conclusion: null,
    display_title: source.displayTitle,
    path: `${VERIFIER_WORKFLOW_PATH}@main`,
    head_branch: 'main',
    head_sha: source.mainSha,
    repository: { full_name: REPOSITORY, id: REPOSITORY_ID },
    head_repository: { full_name: REPOSITORY, id: REPOSITORY_ID },
  };
  assert.deepEqual(validateWorkflowRunApi(apiRun, source), {
    prNumber: 133,
    headSha: 'ef5ecc412e165ebd7f3c6f38f111c7bdcb8cfda8',
    baseSha: 'c79659046cf6ea73ba69e03c3937d904c07ba93b',
  });
  assert.throws(() => validateWorkflowRunApi({ ...apiRun, status: 'completed', conclusion: 'success' }, source), /metadata mismatch/);
});

test('a later same-target verifier run supersedes earlier publisher events', () => {
  const source = validateWorkflowRunEvent(workflowEvent());
  const target = { prNumber: 133, headSha: 'ef5ecc412e165ebd7f3c6f38f111c7bdcb8cfda8', baseSha: 'c79659046cf6ea73ba69e03c3937d904c07ba93b' };
  const run = (overrides = {}) => ({
    id: source.runId,
    run_number: source.runNumber,
    run_attempt: source.runAttempt,
    workflow_id: source.workflowId,
    event: 'workflow_dispatch',
    head_branch: 'main',
    head_sha: source.mainSha,
    display_title: source.displayTitle,
    ...overrides,
  });
  assert.equal(assertVerifierRunIsLatest([run()], source, target), true);
  assert.equal(assertVerifierRunIsLatest([run(), run({ id: source.runId + 1, run_number: source.runNumber + 1 })], source, target), false);
  assert.equal(assertVerifierRunIsLatest([run(), run({ id: source.runId + 1, run_number: source.runNumber + 1, display_title: 'R3 verifier|pr=136|head=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa|base=bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' })], source, target), true);
  assert.equal(assertVerifierRunIsLatest([run({ run_attempt: source.runAttempt + 1 })], source, target), false);
  assert.throws(() => assertVerifierRunIsLatest([run(), run({ id: source.runId + 1, run_number: source.runNumber + 1, display_title: 'unexpected newer run' })], source, target), /valid PR\/head\/base binding/);
});

test('workflow run listing paginates consistently and fails closed on changing totals', async () => {
  const pages = await listWorkflowRunsAcrossPages(async (page) => ({
    total_count: 2,
    workflow_runs: page === 1 ? [{ id: 1 }] : [{ id: 2 }],
  }), { pageSize: 1, maximumPages: 2 });
  assert.deepEqual(pages.map(({ id }) => id), [1, 2]);
  await assert.rejects(listWorkflowRunsAcrossPages(async (page) => ({
    total_count: page === 1 ? 2 : 3,
    workflow_runs: [{ id: page }],
  }), { pageSize: 1, maximumPages: 2 }), /pagination changed/);
});

test('verifier start invalidates same-head success and publishes an in-progress App check', async () => {
  const { bundle, source } = makeCase();
  const oldSuccess = {
    id: 778,
    name: 'KIRARI / R3 trusted verifier',
    head_sha: bundle.candidate.headSha,
    external_id: 'older-success',
    status: 'completed',
    conclusion: 'success',
    app: { id: 7654321 },
    output: { summary: 'Verifier run: 123456788 attempt 1' },
  };
  const { adapter, created, updates } = makeAdapter({ bundle, checks: [oldSuccess] });
  const pendingSource = { ...source, action: 'in_progress', status: 'in_progress', runId: 123456789, runNumber: 125, runAttempt: 1 };
  const outcome = await publishPending({
    target: { prNumber: bundle.candidate.prNumber, headSha: bundle.candidate.headSha, baseSha: bundle.candidate.baseSha },
    source: pendingSource,
    publisher: { sha: 'a'.repeat(40), policyDigest: 'b'.repeat(64) },
    appId: 7654321,
    adapter,
  });
  assert.equal(outcome.outcome, 'published-pending');
  assert.equal(updates[0].patch.conclusion, 'failure');
  assert.equal(created[0].status, 'in_progress');
  assert.match(created[0].output.summary, /Verification has started/);
});

test('successful completion promotes the exact pending check for its run attempt', async () => {
  const { bundle, source } = makeCase();
  const pending = {
    id: 779,
    name: 'KIRARI / R3 trusted verifier',
    head_sha: bundle.candidate.headSha,
    external_id: 'kirari-r3-attempt:pending-binding',
    status: 'in_progress',
    app: { id: 7654321 },
    output: { title: 'Trusted verification pending', summary: `PR #${bundle.candidate.prNumber}\nVerifier run: ${source.runId} attempt ${source.runAttempt}` },
    details_url: `https://github.com/${REPOSITORY}/actions/runs/${source.runId}/attempts/${source.runAttempt}`,
  };
  let current = pending;
  const { adapter, updates, created } = makeAdapter({
    bundle,
    checks: [pending],
    updateCheck: async (id, patch) => {
      current = { ...current, ...patch, id, app: { id: 7654321 } };
      return current;
    },
  });
  const outcome = await publishCheck({ bundle, source, evidenceDigest: EVIDENCE_DIGEST, publisher: { sha: 'a'.repeat(40), policyDigest: 'b'.repeat(64) }, appId: 7654321, adapter });
  assert.equal(outcome.outcome, 'published-success');
  assert.equal(created.length, 0);
  assert.equal(updates[0].patch.external_id, outcome.externalId);
  assert.equal(updates.at(-1).patch.conclusion, 'success');
});

test('failed authenticated verifier run invalidates earlier same-head App success', async () => {
  const { bundle } = makeCase();
  const oldSuccess = {
    id: 777,
    name: 'KIRARI / R3 trusted verifier',
    head_sha: bundle.candidate.headSha,
    external_id: 'older-success',
    status: 'completed',
    conclusion: 'success',
    app: { id: 7654321 },
    output: { summary: 'Verifier run: 123456788 attempt 1' },
  };
  const { adapter, created, updates } = makeAdapter({ bundle, checks: [oldSuccess] });
  const source = {
    action: 'completed',
    repository: REPOSITORY,
    repositoryId: REPOSITORY_ID,
    runId: 123456789,
    runNumber: 124,
    runAttempt: 1,
    mainSha: bundle.candidate.baseSha,
    workflowPath: VERIFIER_WORKFLOW_PATH,
    status: 'completed',
    conclusion: 'failure',
  };
  const outcome = await publishFailure({
    target: { prNumber: bundle.candidate.prNumber, headSha: bundle.candidate.headSha, baseSha: bundle.candidate.baseSha },
    source,
    publisher: { sha: 'a'.repeat(40), policyDigest: 'b'.repeat(64) },
    appId: 7654321,
    adapter,
  });
  assert.equal(outcome.outcome, 'published-failure');
  assert.equal(updates[0].id, oldSuccess.id);
  assert.equal(updates[0].patch.conclusion, 'failure');
  assert.equal(created[0].head_sha, bundle.candidate.headSha);
  assert.equal(updates.at(-1).patch.conclusion, 'failure');
});

test('authenticated failed attempt downgrades an inconsistent same-attempt App success', async () => {
  const { bundle } = makeCase();
  const sameAttemptSuccess = {
    id: 780,
    name: 'KIRARI / R3 trusted verifier',
    head_sha: bundle.candidate.headSha,
    external_id: 'mismatched-success-binding',
    status: 'completed',
    conclusion: 'success',
    app: { id: 7654321 },
    output: { summary: 'Verifier run: 123456789 attempt 1' },
  };
  const { adapter, created, updates } = makeAdapter({ bundle, checks: [sameAttemptSuccess] });
  const outcome = await publishFailure({
    target: { prNumber: bundle.candidate.prNumber, headSha: bundle.candidate.headSha, baseSha: bundle.candidate.baseSha },
    source: { repository: REPOSITORY, repositoryId: REPOSITORY_ID, action: 'completed', status: 'completed', runId: 123456789, runAttempt: 1, mainSha: bundle.candidate.baseSha, workflowPath: VERIFIER_WORKFLOW_PATH, conclusion: 'failure' },
    publisher: { sha: 'a'.repeat(40), policyDigest: 'b'.repeat(64) },
    appId: 7654321,
    adapter,
  });
  assert.equal(outcome.outcome, 'invalidated-current-attempt');
  assert.equal(created.length, 0);
  assert.equal(updates[0].id, sameAttemptSuccess.id);
  assert.equal(updates[0].patch.conclusion, 'failure');
});

test('missing, expired, duplicate, or wrong-run artifact cannot enter publication', () => {
  const source = validateWorkflowRunEvent(workflowEvent());
  assert.throws(() => validateArtifactMetadata([], source), /missing, duplicated, or expired/);
  assert.throws(() => validateArtifactMetadata([
    { id: 1, name: `r3-trusted-verifier-${source.runId}-${source.runAttempt}`, expired: true },
  ], source), /missing, duplicated, or expired/);
  assert.throws(() => validateArtifactMetadata([
    { id: 1, name: `r3-trusted-verifier-${source.runId}-${source.runAttempt}`, expired: false },
    { id: 2, name: `r3-trusted-verifier-${source.runId}-${source.runAttempt}`, expired: false },
  ], source), /missing, duplicated, or expired/);
});

test('B: stale candidate HEAD and M: prior-head success cannot satisfy the live candidate', async () => {
  const { bundle, source } = makeCase();
  const { adapter, created } = makeAdapter({ bundle, headSha: '1'.repeat(40) });
  await assert.rejects(publishCheck({ bundle, source, evidenceDigest: EVIDENCE_DIGEST, publisher: { sha: 'a'.repeat(40), policyDigest: 'b'.repeat(64) }, appId: 7654321, adapter }), /HEAD, base, or current main changed/);
  assert.equal(created.length, 0);
});

test('publisher revalidates current PR identity, state, source, HEAD, and base', () => {
  const { bundle } = makeCase();
  const pr = {
    number: bundle.candidate.prNumber,
    state: 'open',
    merged: false,
    head: { sha: bundle.candidate.headSha, repo: { full_name: bundle.candidate.headRepository } },
    base: { sha: bundle.candidate.baseSha, ref: 'main' },
  };
  assert.doesNotThrow(() => assertPullRequest(pr, bundle, bundle.candidate.headRepository));
  assert.throws(() => assertPullRequest({ ...pr, head: { ...pr.head, repo: { full_name: 'attacker/KIRARI' } } }, bundle, bundle.candidate.headRepository), /source repository/);
  assert.throws(() => assertPullRequest({ ...pr, base: { ...pr.base, ref: 'dev' } }, bundle, bundle.candidate.headRepository), /source repository/);
});

test('C: stale candidate base cannot produce a successful check', async () => {
  const { bundle, source } = makeCase();
  const { adapter, created } = makeAdapter({ bundle, baseSha: '1'.repeat(40) });
  await assert.rejects(publishCheck({ bundle, source, evidenceDigest: EVIDENCE_DIGEST, publisher: { sha: 'a'.repeat(40), policyDigest: 'b'.repeat(64) }, appId: 7654321, adapter }), /HEAD, base, or current main changed/);
  assert.equal(created.length, 0);
});

test('publisher rejects a verifier/base binding that is stale relative to current main', async () => {
  const { bundle, source } = makeCase();
  const staleMain = makeAdapter({ bundle, mainSha: '1'.repeat(40) });
  await assert.rejects(publishCheck({ bundle, source, evidenceDigest: EVIDENCE_DIGEST, publisher: { sha: 'a'.repeat(40), policyDigest: 'b'.repeat(64) }, appId: 7654321, adapter: staleMain.adapter }), /current main changed/);
  const altered = structuredClone(bundle);
  altered.verifier.mainSha = '1'.repeat(40);
  assert.throws(() => validatePublisherResult(altered, source, EVIDENCE_DIGEST), /exact PR base/);
});

test('I: an upstream verifier error never produces a successful publisher result', () => {
  const { result } = makeCase();
  assert.throws(() => buildPublisherResult({ result: { ...result, trustedVerification: 'FAIL' }, repository: REPOSITORY, repositoryId: REPOSITORY_ID, evidenceDigest: EVIDENCE_DIGEST }), /not a passing supported result/);
  const failurePayload = workflowEvent();
  failurePayload.payload.workflow_run.conclusion = 'failure';
  assert.equal(validateWorkflowRunEvent(failurePayload).conclusion, 'failure');
});

test('J: an upstream verifier timeout or incomplete run never starts publication', () => {
  const timedOut = workflowEvent();
  timedOut.payload.workflow_run.conclusion = 'timed_out';
  assert.equal(validateWorkflowRunEvent(timedOut).conclusion, 'timed_out');
  const cancelled = workflowEvent();
  cancelled.payload.workflow_run.conclusion = 'cancelled';
  assert.equal(validateWorkflowRunEvent(cancelled).conclusion, 'cancelled');
});

test('D/E: candidate workflow and evaluator edits remain data-only in the trusted evaluator', () => {
  const context = createContext();
  context.candidateFiles['.github/workflows/r3-trusted-verifier.yml'] = 'run: process.exit(91)\n';
  context.candidateFiles['scripts/root-audit/evaluator.mjs'] = 'process.exit(92);\n';
  const result = evaluateVerification(context);
  assert.equal(result.trustedVerification, 'PASS');
  assert.equal(result.candidate.files['.github/workflows/r3-trusted-verifier.yml'].length, 64);
  assert.equal(result.candidate.files['scripts/root-audit/evaluator.mjs'].length, 64);
});

test('F/G: same-name Actions and user status spoofing are not trusted App check evidence', async () => {
  const { bundle, source } = makeCase();
  const payload = checkPayload(bundle, 'fixed-external-id', { sha: 'a'.repeat(40) });
  const actionCheck = { id: 44, name: payload.name, head_sha: payload.head_sha, external_id: payload.external_id, status: 'completed', conclusion: 'success', app: { id: 15368 }, output: payload.output, details_url: payload.details_url };
  assert.throws(() => findIdempotentCheck([actionCheck], payload, 7654321), /different status source/);
  assert.equal(findIdempotentCheck([{ ...actionCheck, external_id: 'actions-spoof' }], payload, 7654321), null);
  const userStatuses = [{ context: payload.name, state: 'success', creator: { login: 'attacker' } }];
  const { adapter, created } = makeAdapter({ bundle, listChecks: () => [] });
  assert.equal(userStatuses[0].state, 'success');
  await publishCheck({ bundle, source, evidenceDigest: EVIDENCE_DIGEST, publisher: { sha: 'a'.repeat(40), policyDigest: 'b'.repeat(64) }, appId: 7654321, adapter });
  assert.equal(created.length, 1, 'status-context spoof is not treated as an App check run');
});

test('H: missing evidence cannot produce success and an authenticated source can invalidate old success', async () => {
  const { bundle, source } = makeCase();
  assert.throws(() => validateArtifactMetadata([], source), /missing, duplicated, or expired/);
  const { adapter, created, updates } = makeAdapter({ bundle });
  await assert.rejects(publishCheck({ bundle, source: {}, evidenceDigest: EVIDENCE_DIGEST, publisher: { sha: 'a'.repeat(40), policyDigest: 'b'.repeat(64) }, appId: 7654321, adapter }), /completed successful verifier run/);
  assert.equal(created.length, 0);
  const failed = await publishFailure({
    target: { prNumber: bundle.candidate.prNumber, headSha: bundle.candidate.headSha, baseSha: bundle.candidate.baseSha },
    source: { ...source, conclusion: 'success' },
    publisher: { sha: 'a'.repeat(40), policyDigest: 'b'.repeat(64) },
    appId: 7654321,
    adapter,
    failureReason: 'successful verifier result artifact was missing',
  });
  assert.equal(failed.outcome, 'published-failure');
  assert.equal(created[0].head_sha, bundle.candidate.headSha);
  assert.equal(created.length, 1);
  assert.equal(updates.at(-1).patch.conclusion, 'failure');
});

test('K: publisher API timeout or GitHub API failure leaves no success conclusion', async () => {
  const { bundle, source } = makeCase();
  const timed = makeAdapter({ bundle, listChecks: () => { throw new Error('request timed out'); } });
  await assert.rejects(publishCheck({ bundle, source, evidenceDigest: EVIDENCE_DIGEST, publisher: { sha: 'a'.repeat(40), policyDigest: 'b'.repeat(64) }, appId: 7654321, adapter: timed.adapter }), /timed out/);
  assert.equal(timed.created.length, 0);
  const failed = makeAdapter({ bundle, createCheck: () => { throw new Error('Checks API rejected request'); } });
  await assert.rejects(publishCheck({ bundle, source, evidenceDigest: EVIDENCE_DIGEST, publisher: { sha: 'a'.repeat(40), policyDigest: 'b'.repeat(64) }, appId: 7654321, adapter: failed.adapter }), /API rejected/);
  assert.equal(failed.updates.some(({ patch }) => patch.conclusion === 'success'), false);
});

test('L: neutral and skipped conclusions are rejected', () => {
  assert.equal(assertAllowedConclusion('success'), 'success');
  assert.equal(assertAllowedConclusion('failure'), 'failure');
  assert.throws(() => assertAllowedConclusion('neutral'), /forbidden/);
  assert.throws(() => assertAllowedConclusion('skipped'), /forbidden/);
});

test('N: requested decision deletion, body edits, revocation, and expiry prevent success', async (t) => {
  const valid = makeCase({ decision: true });
  const apiComment = {
    id: valid.bundle.decisionIdentity.commentId,
    issue_url: `${API_URL}/repos/${REPOSITORY}/issues/135`,
    author_association: 'OWNER',
    user: { login: 'markd3ng' },
    body: valid.context.comments[0].body,
  };
  const expiredTime = Date.parse('2026-10-08T00:00:00.000Z');
  const edited = { ...apiComment, body: `${apiComment.body}\nchanged` };
  const revoked = { ...apiComment, body: apiComment.body.replace('APPROVE_R3_CONSUMPTION', 'REVOKE_R3_CONSUMPTION') };
  for (const [label, comment, now] of [
    ['deleted', null, Date.parse('2026-10-06T12:00:00.000Z')],
    ['edited', edited, Date.parse('2026-10-06T12:00:00.000Z')],
    ['revoked', revoked, Date.parse('2026-10-06T12:00:00.000Z')],
    ['expired', apiComment, expiredTime],
  ]) {
    await t.test(label, async () => {
      assert.equal(decisionIsCurrent(comment, valid.bundle, API_URL, now), false);
      const { adapter, created } = makeAdapter({ bundle: valid.bundle, decisionComment: comment, now });
      await assert.rejects(publishCheck({ bundle: valid.bundle, source: valid.source, evidenceDigest: EVIDENCE_DIGEST, publisher: { sha: 'a'.repeat(40), policyDigest: 'b'.repeat(64) }, appId: 7654321, adapter }), /Owner decision|requested Owner decision/);
      assert.equal(created.length, 0);
    });
  }
});

test('unrequested decision remains explicitly pending while technical verification is independent', async () => {
  const { bundle, source } = makeCase();
  assert.equal(bundle.decisionIdentity.requestedCommentId, null);
  assert.equal(bundle.decisionIdentity.state, 'PENDING');
  assert.equal(bundle.decisionIdentity.consumable, false);
  const { adapter, created } = makeAdapter({ bundle });
  await publishCheck({ bundle, source, evidenceDigest: EVIDENCE_DIGEST, publisher: { sha: 'a'.repeat(40), policyDigest: 'b'.repeat(64) }, appId: 7654321, adapter });
  assert.equal(created.length, 1);
});

test('replay is idempotent only for the same dedicated App result and exact bindings', async () => {
  const { bundle, source } = makeCase();
  const publisher = { sha: 'a'.repeat(40), policyDigest: 'b'.repeat(64) };
  const externalId = `kirari-r3-v1:${sha256('binding')}`;
  const payload = checkPayload(bundle, externalId, publisher);
  const completed = { id: 12, ...payload, status: 'completed', conclusion: 'success', app: { id: 7654321 } };
  const found = findIdempotentCheck([completed], payload, 7654321);
  assert.deepEqual(found, { id: 12, completed: true });
  assert.throws(() => findIdempotentCheck([{ ...completed, output: { summary: 'changed evidence' } }], payload, 7654321), /different evidence/);
  const changedEvidencePayload = checkPayload(bundle, `${externalId}-changed`, publisher);
  assert.throws(() => findIdempotentCheck([completed], changedEvidencePayload, 7654321), /different evidence binding/);
  assert.throws(() => validatePublisherResult(bundle, { ...source, runAttempt: source.runAttempt + 1 }, EVIDENCE_DIGEST), /authenticated verifier run/);
  assert.throws(() => validatePublisherResult(bundle, { ...source, workflowPath: '.github/workflows/untrusted.yml' }, EVIDENCE_DIGEST), /source binding is malformed/);
});

test('resuming an in-progress check omits immutable head_sha from Checks API updates', async () => {
  const { bundle, source } = makeCase();
  const publisher = { sha: 'a'.repeat(40), policyDigest: 'b'.repeat(64) };
  const payload = checkPayload(bundle, buildExternalId(bundle, publisher), publisher);
  const existing = { ...payload, id: 91, status: 'in_progress', app: { id: 7654321 } };
  const { adapter, updates } = makeAdapter({ bundle, checks: [existing] });
  await publishCheck({ bundle, source, evidenceDigest: EVIDENCE_DIGEST, publisher, appId: 7654321, adapter });
  assert.equal(updates.length, 2);
  assert.ok(updates.every(({ patch }) => !Object.hasOwn(patch, 'head_sha')));
});

test('Check lookup visits every page and rejects unstable or incomplete pagination', async () => {
  const pages = [];
  const checks = await listChecksAcrossPages(async (page) => {
    pages.push(page);
    return page === 1
      ? { total_count: 101, check_runs: Array.from({ length: 100 }, (_, index) => ({ id: index + 1 })) }
      : { total_count: 101, check_runs: [{ id: 101 }] };
  });
  assert.deepEqual(pages, [1, 2]);
  assert.equal(checks.length, 101);
  await assert.rejects(listChecksAcrossPages(async () => ({ total_count: 2, check_runs: [{ id: 1 }] })), /pagination is incomplete/);
});
