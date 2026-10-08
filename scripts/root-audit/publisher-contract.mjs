import { createHash } from 'node:crypto';

export const REQUIRED_CHECK_NAME = 'KIRARI / R3 trusted verifier';
export const VERIFIER_WORKFLOW_PATH = '.github/workflows/r3-trusted-verifier.yml';
export const PUBLISHER_WORKFLOW_PATH = '.github/workflows/r3-trusted-publisher.yml';
export const PUBLISHER_ENVIRONMENT = 'r3-trusted-publisher';
export const RESULT_SCHEMA = 'kirari.r3-publisher-result/v1';
export const SHA = /^[a-f0-9]{40}$/;
export const SHA256 = /^[a-f0-9]{64}$/;
const FINAL_CONCLUSIONS = new Set(['action_required', 'cancelled', 'failure', 'neutral', 'skipped', 'stale', 'success', 'timed_out']);
const PENDING_RUN_STATUSES = new Set(['in_progress', 'queued', 'requested', 'waiting']);

export function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

export function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function digestNamedFiles(files) {
  return sha256(Object.entries(files).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
    .map(([name, content]) => `${name}\0${sha256(content)}\n`).join(''));
}

function require(condition, message) {
  if (!condition) throw new Error(message);
}

function validPositiveInteger(value) {
  return Number.isSafeInteger(value) && value > 0;
}

export function validateWorkflowRunEvent({ eventName, ref, payload, repositoryId, repository }) {
  const run = payload?.workflow_run;
  require(eventName === 'workflow_run' && ref === 'refs/heads/main', 'publisher event is not a default-branch workflow_run');
  require(['completed', 'in_progress', 'requested'].includes(payload?.action), 'publisher workflow_run action is unsupported');
  require(repository === 'markd3ng/KIRARI' && validPositiveInteger(repositoryId), 'publisher repository identity is invalid');
  require(payload?.repository?.full_name === repository && payload.repository.id === repositoryId, 'workflow_run repository identity mismatch');
  require(run && run.event === 'workflow_dispatch', 'upstream run is not a workflow_dispatch verifier');
  if (payload.action === 'completed') {
    require(run.status === 'completed' && FINAL_CONCLUSIONS.has(run.conclusion), 'upstream verifier run conclusion is missing or unsupported');
  } else {
    require(PENDING_RUN_STATUSES.has(run.status) && run.conclusion == null, 'upstream verifier run is no longer pending');
  }
  require(run.head_branch === 'main' && run.head_sha && SHA.test(run.head_sha), 'upstream verifier run is not bound to main');
  const workflowId = run.workflow_id ?? payload.workflow?.id;
  require(validPositiveInteger(run.id) && validPositiveInteger(run.run_number) && validPositiveInteger(run.run_attempt) && validPositiveInteger(workflowId), 'upstream workflow run identity is invalid');
  require(typeof run.created_at === 'string' && Number.isFinite(Date.parse(run.created_at)), 'upstream workflow creation time is invalid');
  if (payload.workflow?.id !== undefined) require(payload.workflow.id === workflowId, 'workflow event identity mismatch');
  require(run.head_repository?.full_name === repository && run.head_repository.id === repositoryId, 'upstream verifier head repository mismatch');
  return {
    repositoryId,
    repository,
    action: payload.action,
    status: run.status,
    runId: run.id,
    runNumber: run.run_number,
    runAttempt: run.run_attempt,
    createdAt: run.created_at,
    workflowId,
    conclusion: run.conclusion,
    displayTitle: run.display_title,
    mainSha: run.head_sha,
    workflowPath: VERIFIER_WORKFLOW_PATH,
  };
}

export function validateWorkflowRunApi(run, source) {
  const correctState = source.action === 'completed'
    ? run?.status === 'completed' && run.conclusion === source.conclusion && FINAL_CONCLUSIONS.has(run.conclusion)
    : source.action === 'requested'
      ? PENDING_RUN_STATUSES.has(run?.status) && run.conclusion == null
      : run?.status === 'in_progress' && run.conclusion == null;
  require(run && run.id === source.runId && run.run_number === source.runNumber && run.run_attempt === source.runAttempt &&
    run.created_at === source.createdAt &&
    run.workflow_id === source.workflowId && run.event === 'workflow_dispatch' && correctState &&
    [
      `${source.workflowPath}@main`,
      `${source.workflowPath}@refs/heads/main`,
    ].includes(run.path) &&
    run.head_branch === 'main' && run.head_sha === source.mainSha &&
    typeof run.display_title === 'string' && run.display_title === source.displayTitle &&
    run.repository?.full_name === source.repository && run.repository?.id === source.repositoryId &&
    run.head_repository?.full_name === source.repository && run.head_repository?.id === source.repositoryId,
  'authenticated upstream workflow run metadata mismatch');
  return parseVerifierRunName(run.display_title);
}

export function parseVerifierRunName(displayTitle) {
  const match = /^R3 verifier\|pr=([1-9][0-9]{0,5})\|head=([a-f0-9]{40})\|base=([a-f0-9]{40})$/.exec(displayTitle ?? '');
  require(match, 'authenticated verifier run title does not contain a valid PR/head/base binding');
  return { prNumber: Number(match[1]), headSha: match[2], baseSha: match[3] };
}

export function assertVerifierRunIsLatest(runs, source, target) {
  require(Array.isArray(runs) && validPositiveInteger(source?.runNumber) && validPositiveInteger(source?.runAttempt) &&
    validPositiveInteger(source?.runId) && validPositiveInteger(source?.workflowId) && target &&
    Number.isSafeInteger(target.prNumber) && SHA.test(target.headSha) && SHA.test(target.baseSha) &&
    typeof source.createdAt === 'string' && Number.isFinite(Date.parse(source.createdAt)),
  'verifier run-order binding is malformed');
  const lowerBound = Date.parse(source.createdAt);
  let currentRunFound = false;
  const runIds = new Set();
  const runNumbers = new Map();
  for (const run of runs) {
    require(run && validPositiveInteger(run.id) && validPositiveInteger(run.run_number) && validPositiveInteger(run.run_attempt) &&
      run.workflow_id === source.workflowId && run.event === 'workflow_dispatch' && run.head_branch === 'main' && SHA.test(run.head_sha ?? '') &&
      typeof run.created_at === 'string' && Number.isFinite(Date.parse(run.created_at)) && Date.parse(run.created_at) >= lowerBound,
    'workflow run listing contains malformed verifier metadata');
    require(!runIds.has(run.id) && (!runNumbers.has(run.run_number) || runNumbers.get(run.run_number) === run.id), 'workflow run listing contains duplicate run identities');
    runIds.add(run.id);
    runNumbers.set(run.run_number, run.id);
    if (run.id === source.runId) {
      require(run.run_number === source.runNumber, 'current verifier run number changed in the authenticated listing');
      require(sameRunTarget(parseVerifierRunName(run.display_title), target), 'current verifier run title differs from its authenticated target');
      currentRunFound = true;
      if (run.run_attempt > source.runAttempt) return false;
      continue;
    }
    if (run.run_number > source.runNumber) {
      const laterTarget = parseVerifierRunName(run.display_title);
      if (sameRunTarget(laterTarget, target)) return false;
    }
  }
  require(currentRunFound, 'current verifier run is absent from the authenticated workflow run listing');
  return true;
}

export function workflowRunCreatedFilter(createdAt) {
  require(typeof createdAt === 'string' && Number.isFinite(Date.parse(createdAt)), 'workflow run creation-time filter is invalid');
  return `>=${createdAt}`;
}

function sameRunTarget(left, right) {
  return left.prNumber === right.prNumber && left.headSha === right.headSha && left.baseSha === right.baseSha;
}

export async function listWorkflowRunsAcrossPages(getPage, { pageSize = 100, maximumPages = 10 } = {}) {
  const all = [];
  let totalCount = null;
  for (let page = 1; page <= maximumPages; page += 1) {
    const result = await getPage(page);
    require(result && Number.isSafeInteger(result.total_count) && result.total_count >= 0 && Array.isArray(result.workflow_runs),
      'workflow runs API page is malformed');
    if (result.workflow_runs.length > pageSize || (totalCount !== null && result.total_count !== totalCount)) {
      throw new Error('workflow runs API pagination changed during lookup');
    }
    totalCount = result.total_count;
    all.push(...result.workflow_runs);
    if (all.length > totalCount) throw new Error('workflow runs API pagination changed during lookup');
    if (all.length === totalCount) return all;
    if (result.workflow_runs.length < pageSize) throw new Error('workflow runs API pagination is incomplete');
  }
  throw new Error('workflow runs API pagination limit exceeded');
}

export function validateWorkflowMetadata(workflow, source) {
  require(workflow && workflow.id === source.workflowId && workflow.path === source.workflowPath && workflow.state === 'active',
    'authenticated workflow ID does not resolve to the trusted verifier path');
}

export function validateArtifactMetadata(artifacts, source) {
  const name = `r3-trusted-verifier-${source.runId}-${source.runAttempt}`;
  require(Array.isArray(artifacts), 'upstream artifact response is malformed');
  const matches = artifacts.filter((artifact) => artifact?.name === name);
  require(matches.length === 1 && matches[0].expired === false && validPositiveInteger(matches[0].id), 'exact trusted verifier artifact is missing, duplicated, or expired');
  return { id: matches[0].id, name };
}

export function buildPublisherResult({ result, repository, repositoryId, evidenceDigest }) {
  const run = result?.trustedRun;
  const candidate = result?.candidate;
  require(result?.schema === 'kirari.r3-trusted-verification/v1' && result.trustedVerification === 'PASS', 'trusted verifier result is not a passing supported result');
  require(repository === 'markd3ng/KIRARI' && validPositiveInteger(repositoryId), 'trusted repository identity is invalid');
  require(candidate && Number.isSafeInteger(candidate.number) && candidate.number > 0 && SHA.test(candidate.headSha) && SHA.test(candidate.baseSha) &&
    typeof candidate.headRepo === 'string' && /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(candidate.headRepo) && SHA256.test(candidate.digest),
  'trusted candidate binding is invalid');
  require(run && run.repository === repository && run.repositoryId === repositoryId && run.ref === 'refs/heads/main' &&
    run.eventName === 'workflow_dispatch' && run.workflowRef === `${repository}/${VERIFIER_WORKFLOW_PATH}@refs/heads/main` &&
    run.workflowPath === VERIFIER_WORKFLOW_PATH && SHA.test(run.sha) && run.workflowSha === run.sha &&
    /^[1-9][0-9]*$/.test(String(run.id)) && /^[1-9][0-9]*$/.test(String(run.attempt)) &&
    SHA256.test(run.workflowDigest) && SHA256.test(run.verifierDigest) && SHA256.test(run.policyDigest),
  'trusted verifier run provenance is incomplete');
  require(SHA256.test(evidenceDigest), 'canonical evidence digest is invalid');
  const authorization = result.authorization;
  require(authorization && ['PENDING', 'APPROVED'].includes(authorization.decision) && authorization.r3ExceptionConsumable === (authorization.decision === 'APPROVED') &&
    authorization.exceptionApplied === false && authorization.exceptionConsumed === false &&
    (authorization.securityReviewDigest === null || authorization.securityReviewDigest === undefined || SHA256.test(authorization.securityReviewDigest)) &&
    (authorization.decision !== 'APPROVED' || SHA256.test(authorization.securityReviewDigest ?? '')),
  'R3 decision state is invalid or claims consumption');
  return {
    schema: RESULT_SCHEMA,
    trustedVerification: result.trustedVerification,
    repository: { id: repositoryId, fullName: repository },
    candidate: {
      prNumber: candidate.number,
      headRepository: candidate.headRepo,
      headSha: candidate.headSha,
      baseSha: candidate.baseSha,
      baseRef: candidate.baseRef,
      digest: candidate.digest,
    },
    verifier: {
      mainSha: run.sha,
      workflowSha: run.workflowSha,
      workflowPath: run.workflowPath,
      runId: Number(run.id),
      runAttempt: Number(run.attempt),
      workflowDigest: run.workflowDigest,
      verifierDigest: run.verifierDigest,
      policyDigest: run.policyDigest,
    },
    evidenceDigest,
    securityReviewDigest: authorization.securityReviewDigest ?? null,
    decisionIdentity: {
      issue: authorization.issue,
      requestedCommentId: authorization.requestedCommentId ?? null,
      state: authorization.decision,
      commentId: authorization.commentId,
      digest: authorization.decisionDigest ?? null,
      expiresAt: authorization.expiresAt,
      securityReviewDigest: authorization.securityReviewDigest ?? null,
      lookup: authorization.decisionLookup,
      consumable: authorization.r3ExceptionConsumable,
    },
  };
}

export function validatePublisherResult(bundle, source, evidenceDigest) {
  require(source && source.repository === 'markd3ng/KIRARI' && validPositiveInteger(source.repositoryId) &&
    validPositiveInteger(source.runId) && validPositiveInteger(source.runAttempt) && validPositiveInteger(source.workflowId) &&
    SHA.test(source.mainSha) && source.workflowPath === VERIFIER_WORKFLOW_PATH,
  'authenticated verifier source binding is malformed');
  require(bundle?.schema === RESULT_SCHEMA && bundle.trustedVerification === 'PASS', 'publisher result schema or verification conclusion is invalid');
  require(bundle.repository?.id === source.repositoryId && bundle.repository?.fullName === source.repository, 'publisher result repository mismatch');
  require(bundle.verifier?.mainSha === source.mainSha && bundle.verifier?.mainSha === bundle.candidate.baseSha && bundle.verifier?.workflowSha === source.mainSha &&
    bundle.verifier?.workflowPath === VERIFIER_WORKFLOW_PATH && bundle.verifier?.runId === source.runId &&
    bundle.verifier?.runAttempt === source.runAttempt,
  'publisher result is not bound to the authenticated verifier run and exact PR base');
  require(bundle.candidate && Number.isSafeInteger(bundle.candidate.prNumber) && bundle.candidate.prNumber > 0 &&
    typeof bundle.candidate.headRepository === 'string' && /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(bundle.candidate.headRepository) &&
    SHA.test(bundle.candidate.headSha) && SHA.test(bundle.candidate.baseSha) && SHA256.test(bundle.candidate.digest),
  'publisher candidate binding is invalid');
  require(SHA256.test(bundle.verifier.policyDigest) && SHA256.test(bundle.verifier.workflowDigest) &&
    SHA256.test(bundle.verifier.verifierDigest) && bundle.evidenceDigest === evidenceDigest && SHA256.test(evidenceDigest),
  'publisher policy, verifier, or evidence digest is invalid');
  const decision = bundle.decisionIdentity;
  require(decision && decision.issue === 135 && ['PENDING', 'APPROVED'].includes(decision.state) &&
    decision.consumable === (decision.state === 'APPROVED'), 'publisher R3 decision state is invalid');
  require((bundle.securityReviewDigest === null || SHA256.test(bundle.securityReviewDigest)) &&
    decision.securityReviewDigest === bundle.securityReviewDigest &&
    (decision.state !== 'APPROVED' || SHA256.test(bundle.securityReviewDigest ?? '')),
  'Owner-supplied security review reference binding is invalid');
  if (decision.requestedCommentId !== null) {
    require(decision.state === 'APPROVED' && decision.commentId === decision.requestedCommentId &&
      validPositiveInteger(decision.commentId) && SHA256.test(decision.digest) && SHA256.test(decision.securityReviewDigest) &&
      typeof decision.expiresAt === 'string', 'selected Owner decision is missing, revoked, or malformed');
  } else {
    require(decision.state === 'PENDING' && decision.commentId === null && decision.digest === null && decision.consumable === false,
      'publisher must not infer an unrequested R3 Owner decision');
  }
}

export function decisionIsCurrent(comment, bundle, apiUrl, now = Date.now()) {
  const expected = bundle.decisionIdentity;
  if (expected.requestedCommentId === null) return true;
  if (!comment || comment.id !== expected.requestedCommentId ||
      comment.issue_url !== new URL('/repos/markd3ng/KIRARI/issues/135', apiUrl).href ||
      comment.author_association !== 'OWNER' || comment.user?.login !== 'markd3ng' || typeof comment.body !== 'string' ||
      sha256(comment.body) !== expected.digest) return false;
  const marker = 'KIRARI_R3_CONSUMPTION_DECISION_V1\n';
  if (!comment.body.startsWith(marker)) return false;
  let record;
  try {
    record = JSON.parse(comment.body.slice(marker.length));
  } catch {
    return false;
  }
  if (record.commentId !== comment.id || record.issue !== 135 || record.repository !== 'markd3ng/KIRARI' ||
      record.decision !== 'APPROVE_R3_CONSUMPTION' || record.securityReviewDigest !== expected.securityReviewDigest ||
      record.expiresAt !== expected.expiresAt) return false;
  const expiry = Date.parse(record.expiresAt);
  return Number.isFinite(expiry) && new Date(expiry).toISOString() === record.expiresAt && expiry > now;
}

export function buildExternalId(bundle, publisher) {
  const binding = {
    schema: RESULT_SCHEMA,
    repositoryId: bundle.repository.id,
    repository: bundle.repository.fullName,
    prNumber: bundle.candidate.prNumber,
    headRepository: bundle.candidate.headRepository,
    headSha: bundle.candidate.headSha,
    baseSha: bundle.candidate.baseSha,
    verifierMainSha: bundle.verifier.mainSha,
    verifierWorkflowPath: bundle.verifier.workflowPath,
    runId: bundle.verifier.runId,
    runAttempt: bundle.verifier.runAttempt,
    policyDigest: bundle.verifier.policyDigest,
    candidateDigest: bundle.candidate.digest,
    evidenceDigest: bundle.evidenceDigest,
    securityReviewDigest: bundle.securityReviewDigest,
    decisionIdentity: bundle.decisionIdentity,
    publisherSha: publisher.sha,
    publisherWorkflowPath: PUBLISHER_WORKFLOW_PATH,
    publisherPolicyDigest: publisher.policyDigest,
  };
  return `kirari-r3-v1:${sha256(canonicalJson(binding))}`;
}

function buildAttemptExternalId(target, source, publisher) {
  return `kirari-r3-attempt:${sha256(canonicalJson({
    schema: RESULT_SCHEMA,
    repositoryId: source.repositoryId,
    repository: source.repository,
    prNumber: target.prNumber,
    headSha: target.headSha,
    baseSha: target.baseSha,
    verifierMainSha: source.mainSha,
    verifierWorkflowPath: source.workflowPath,
    runId: source.runId,
    runAttempt: source.runAttempt,
    publisherSha: publisher.sha,
    publisherPolicyDigest: publisher.policyDigest,
  }))}`;
}

function runAttemptLine(runId, runAttempt) {
  return `Verifier run: ${runId} attempt ${runAttempt}`;
}

function isAppCheckForHead(check, headSha, appId) {
  return check?.name === REQUIRED_CHECK_NAME && check?.head_sha === headSha && check?.app?.id === appId;
}

export async function publishPending({ target, source, publisher, appId, adapter }) {
  require(Number.isSafeInteger(appId) && appId > 0, 'dedicated App ID is not configured');
  require(target && Number.isSafeInteger(target.prNumber) && target.prNumber > 0 && SHA.test(target.headSha) && SHA.test(target.baseSha),
    'pending verifier target binding is malformed');
  require(source && ['requested', 'in_progress'].includes(source.action) && PENDING_RUN_STATUSES.has(source.status) &&
    source.repository === 'markd3ng/KIRARI' && validPositiveInteger(source.repositoryId) && validPositiveInteger(source.runId) &&
    validPositiveInteger(source.runNumber) && validPositiveInteger(source.runAttempt) && source.mainSha === target.baseSha &&
    source.workflowPath === VERIFIER_WORKFLOW_PATH,
  'pending verifier source binding is malformed');
  require(SHA.test(publisher?.sha) && SHA256.test(publisher?.policyDigest), 'publisher workflow provenance is malformed');
  await adapter.assertPullRequest(target.prNumber, target.headSha, target.baseSha);

  const checks = (await adapter.listChecks(target.headSha)).filter((check) => isAppCheckForHead(check, target.headSha, appId));
  const attemptSummary = runAttemptLine(source.runId, source.runAttempt);
  const currentAttempt = checks.filter((check) => check.output?.summary?.includes(attemptSummary));
  require(currentAttempt.length <= 1, 'duplicate App checks exist for the pending verifier run attempt');
  const externalId = buildAttemptExternalId(target, source, publisher);
  if (currentAttempt[0]?.status === 'completed') {
    require(currentAttempt[0].external_id === externalId, 'completed check conflicts with this pending verifier attempt');
    return { outcome: 'already-completed', checkRunId: currentAttempt[0].id };
  }
  if (currentAttempt[0]) {
    require(currentAttempt[0].external_id === externalId && currentAttempt[0].status === 'in_progress',
      'in-progress check conflicts with this pending verifier attempt');
    return { outcome: 'idempotent-pending', checkRunId: currentAttempt[0].id, externalId };
  }

  for (const check of checks) {
    if (check.status !== 'completed' || check.conclusion !== 'success') continue;
    await adapter.assertPullRequest(target.prNumber, target.headSha, target.baseSha);
    const invalidated = await adapter.updateCheck(check.id, {
      status: 'completed',
      conclusion: 'failure',
      output: {
        title: 'Trusted verification superseded',
        summary: `Verifier run ${source.runId} attempt ${source.runAttempt} has started for this candidate; the previous success is invalidated while it is rechecked.`,
      },
    });
    require(isAppCheckForHead(invalidated, target.headSha, appId) && invalidated.status === 'completed' && invalidated.conclusion === 'failure',
      'Checks API did not invalidate the superseded success');
  }

  await adapter.assertPullRequest(target.prNumber, target.headSha, target.baseSha);
  const runUrl = `https://github.com/${source.repository}/actions/runs/${source.runId}/attempts/${source.runAttempt}`;
  const pending = await adapter.createCheck({
    name: REQUIRED_CHECK_NAME,
    head_sha: target.headSha,
    external_id: externalId,
    details_url: runUrl,
    status: 'in_progress',
    output: {
      title: 'Trusted verification pending',
      summary: `PR #${target.prNumber} head ${target.headSha}; base ${target.baseSha}. ${attemptSummary}. Verification has started; no successful result has been published.`,
    },
  });
  require(isAppCheckForHead(pending, target.headSha, appId) && pending.external_id === externalId && pending.status === 'in_progress',
    'Checks API did not create the exact in-progress App check');
  return { outcome: 'published-pending', checkRunId: pending.id, externalId };
}

export async function publishFailure({ target, source, publisher, appId, adapter, failureReason = null }) {
  require(Number.isSafeInteger(appId) && appId > 0, 'dedicated App ID is not configured');
  require(target && Number.isSafeInteger(target.prNumber) && target.prNumber > 0 && SHA.test(target.headSha) && SHA.test(target.baseSha),
    'failed verifier target binding is malformed');
  require(source && source.action === 'completed' && source.status === 'completed' && source.repository === 'markd3ng/KIRARI' && validPositiveInteger(source.repositoryId) &&
    validPositiveInteger(source.runId) && validPositiveInteger(source.runAttempt) && source.mainSha === target.baseSha &&
    source.workflowPath === VERIFIER_WORKFLOW_PATH && FINAL_CONCLUSIONS.has(source.conclusion) &&
    (source.conclusion !== 'success' || typeof failureReason === 'string'),
  'failed verifier source binding is malformed');
  require(SHA.test(publisher?.sha) && SHA256.test(publisher?.policyDigest), 'publisher workflow provenance is malformed');
  await adapter.assertPullRequest(target.prNumber, target.headSha, target.baseSha);

  const checks = (await adapter.listChecks(target.headSha)).filter((check) => isAppCheckForHead(check, target.headSha, appId));
  const attemptSummary = runAttemptLine(source.runId, source.runAttempt);
  const currentAttempt = checks.filter((check) => check.output?.summary?.includes(attemptSummary));
  require(currentAttempt.length <= 1, 'duplicate App checks exist for the failed verifier run attempt');
  const externalId = buildAttemptExternalId(target, source, publisher);
  let completedCurrentAttempt = null;

  for (const check of checks) {
    const isCurrentAttempt = check.id === currentAttempt[0]?.id;
    if (check.status !== 'completed' || (check.conclusion !== 'success' && !(isCurrentAttempt && check.conclusion !== 'failure'))) continue;
    await adapter.assertPullRequest(target.prNumber, target.headSha, target.baseSha);
    const invalidated = await adapter.updateCheck(check.id, {
      status: 'completed',
      conclusion: 'failure',
      output: {
        title: isCurrentAttempt ? 'Trusted verification failed' : 'Trusted verification superseded',
        summary: isCurrentAttempt
          ? `PR #${target.prNumber} head ${target.headSha}; base ${target.baseSha}. ${attemptSummary}. Upstream conclusion: ${source.conclusion}.${failureReason ? ` ${failureReason}.` : ''} No successful trusted result was published.`
          : `A later authenticated verifier run ${source.runId} attempt ${source.runAttempt} did not pass. This previous success is invalidated.`,
      },
    });
    require(isAppCheckForHead(invalidated, target.headSha, appId) && invalidated.status === 'completed' && invalidated.conclusion === 'failure',
      'Checks API did not invalidate the superseded success');
    if (isCurrentAttempt) completedCurrentAttempt = invalidated;
  }

  if (completedCurrentAttempt) {
    return { outcome: 'invalidated-current-attempt', checkRunId: completedCurrentAttempt.id };
  }
  if (currentAttempt[0]?.status === 'completed' && currentAttempt[0].conclusion === 'failure' && currentAttempt[0].external_id === externalId) {
    return { outcome: 'idempotent-failure', checkRunId: currentAttempt[0].id };
  }
  if (currentAttempt[0]?.status === 'completed') {
    const invalidated = await adapter.updateCheck(currentAttempt[0].id, {
      status: 'completed',
      conclusion: 'failure',
      output: {
        title: 'Trusted verification failed',
        summary: `PR #${target.prNumber} head ${target.headSha}; base ${target.baseSha}. ${attemptSummary}. Upstream conclusion: ${source.conclusion}.${failureReason ? ` ${failureReason}.` : ''} No successful trusted result was published.`,
      },
    });
    require(isAppCheckForHead(invalidated, target.headSha, appId) && invalidated.status === 'completed' && invalidated.conclusion === 'failure',
      'Checks API did not replace a non-failure result for the failed verifier attempt');
    return { outcome: 'invalidated-current-attempt', checkRunId: invalidated.id };
  }

  await adapter.assertPullRequest(target.prNumber, target.headSha, target.baseSha);
  const runUrl = `https://github.com/${source.repository}/actions/runs/${source.runId}/attempts/${source.runAttempt}`;
  let pending = currentAttempt[0];
  if (!pending) {
    pending = await adapter.createCheck({
      name: REQUIRED_CHECK_NAME,
      head_sha: target.headSha,
      external_id: externalId,
      details_url: runUrl,
      status: 'in_progress',
      output: {
        title: 'Trusted verification failed',
        summary: `PR #${target.prNumber} head ${target.headSha}; base ${target.baseSha}. ${attemptSummary}. Upstream conclusion: ${source.conclusion}.${failureReason ? ` ${failureReason}.` : ''}`,
      },
    });
  }
  require(isAppCheckForHead(pending, target.headSha, appId) && pending.external_id === externalId && pending.status === 'in_progress',
    'Checks API did not create or resume the exact failed-attempt App check');
  const failed = await adapter.updateCheck(pending.id, {
    status: 'completed',
    conclusion: 'failure',
    output: {
      title: 'Trusted verification failed',
      summary: `PR #${target.prNumber} head ${target.headSha}; base ${target.baseSha}. ${attemptSummary}. Upstream conclusion: ${source.conclusion}.${failureReason ? ` ${failureReason}.` : ''} No successful trusted result was published.`,
    },
  });
  require(isAppCheckForHead(failed, target.headSha, appId) && failed.external_id === externalId && failed.status === 'completed' && failed.conclusion === 'failure',
    'Checks API did not record the failed verifier attempt');
  return { outcome: 'published-failure', checkRunId: failed.id, externalId };
}

export function checkPayload(bundle, externalId, publisher) {
  const runUrl = `https://github.com/${bundle.repository.fullName}/actions/runs/${bundle.verifier.runId}/attempts/${bundle.verifier.runAttempt}`;
  const summary = [
    `Trusted technical verification: ${bundle.trustedVerification}`,
    `PR #${bundle.candidate.prNumber} head: ${bundle.candidate.headSha}`,
    `Candidate source repository: ${bundle.candidate.headRepository}`,
    `Base: ${bundle.candidate.baseSha}`,
    `Verifier main SHA: ${bundle.verifier.mainSha}`,
    `Verifier workflow path: ${bundle.verifier.workflowPath}`,
    `Verifier run: ${bundle.verifier.runId} attempt ${bundle.verifier.runAttempt}`,
    `Policy digest: ${bundle.verifier.policyDigest}`,
    `Candidate digest: ${bundle.candidate.digest}`,
    `Evidence digest: ${bundle.evidenceDigest}`,
    `Owner-supplied security review reference (not fetched or authenticated by this check): ${bundle.securityReviewDigest ?? 'not supplied'}`,
    `Decision issue: #${bundle.decisionIdentity.issue}`,
    `R3 decision state: ${bundle.decisionIdentity.state}`,
    `Decision comment requested ID: ${bundle.decisionIdentity.requestedCommentId ?? 'not requested'}; accepted ID: ${bundle.decisionIdentity.commentId ?? 'none'} (lookup: ${bundle.decisionIdentity.lookup})`,
    `Decision expires: ${bundle.decisionIdentity.expiresAt ?? 'not applicable'}`,
    `Decision revalidation: ${bundle.decisionIdentity.requestedCommentId === null ? 'NOT_REQUESTED' : 'REVALIDATED_BEFORE_SUCCESS'}`,
    `R3 consumable: ${bundle.decisionIdentity.consumable ? 'YES' : 'NO'}; exception applied/consumed: NO/NO.`,
    'This technical check is not R3 consumption or merge authorization.',
    `Publisher SHA: ${publisher.sha}`,
  ].join('\n');
  return {
    name: REQUIRED_CHECK_NAME,
    head_sha: bundle.candidate.headSha,
    external_id: externalId,
    details_url: runUrl,
    status: 'in_progress',
    output: { title: 'Trusted technical verification', summary },
  };
}

export function findIdempotentCheck(checkRuns, payload, appId) {
  const runBinding = payload.output.summary.match(/^Verifier run: ([1-9][0-9]*) attempt ([1-9][0-9]*)$/m);
  require(runBinding, 'publisher check summary lacks verifier replay identity');
  const sameRun = (checkRuns ?? []).filter((check) => check.name === payload.name && check.head_sha === payload.head_sha &&
    check.app?.id === appId && check.output?.summary?.includes(`Verifier run: ${runBinding[1]} attempt ${runBinding[2]}`));
  require(sameRun.length <= 1, 'duplicate App checks exist for the same verifier run attempt');
  const pending = sameRun[0] && sameRun[0].status === 'in_progress' &&
    sameRun[0].output?.title === 'Trusted verification pending' &&
    typeof sameRun[0].external_id === 'string' && sameRun[0].external_id.startsWith('kirari-r3-attempt:')
    ? sameRun[0]
    : null;
  require(sameRun.every((check) => check.external_id === payload.external_id) || pending,
    'same verifier run attempt already has a different evidence binding');
  const matches = (checkRuns ?? []).filter((check) => check.name === payload.name && check.head_sha === payload.head_sha && check.external_id === payload.external_id);
  require(matches.length <= 1, 'duplicate App check runs share the same replay binding');
  if (matches.length === 0) return pending ? { id: pending.id, completed: false } : null;
  const check = matches[0];
  require(check.app?.id === appId, 'existing check replay binding belongs to a different status source');
  require(check.output?.summary === payload.output.summary && check.details_url === payload.details_url,
    'existing App check replay binding has different evidence');
  if (check.status === 'completed' && check.conclusion === 'success') return { id: check.id, completed: true };
  require(check.status === 'in_progress' && validPositiveInteger(check.id), 'existing App check is already concluded non-successfully');
  return { id: check.id, completed: false };
}

export async function listChecksAcrossPages(getPage, { pageSize = 100, maximumPages = 100 } = {}) {
  const all = [];
  let totalCount = null;
  for (let page = 1; page <= maximumPages; page += 1) {
    const result = await getPage(page);
    require(result && Number.isSafeInteger(result.total_count) && result.total_count >= 0 && Array.isArray(result.check_runs),
      'Checks API page is malformed');
    if (result.check_runs.length > pageSize || (totalCount !== null && result.total_count !== totalCount)) {
      throw new Error('Checks API pagination changed during lookup');
    }
    totalCount = result.total_count;
    all.push(...result.check_runs);
    if (all.length > totalCount) throw new Error('Checks API pagination changed during lookup');
    if (all.length === totalCount) return all;
    if (result.check_runs.length < pageSize) throw new Error('Checks API pagination is incomplete');
  }
  throw new Error('Checks API pagination limit exceeded');
}

function validateAppCheck(check, payload, appId, { completed = false, conclusion } = {}) {
  require(check && check.name === payload.name && check.head_sha === payload.head_sha &&
    check.external_id === payload.external_id && check.app?.id === appId,
  'Checks API response does not match the dedicated App, check name, HEAD, and replay binding');
  if (completed) require(check.status === 'completed' && check.conclusion === conclusion, 'Checks API did not record the requested completed conclusion');
  else require(check.status === 'in_progress', 'Checks API did not create an in-progress check');
  return check;
}

export async function publishCheck({ bundle, source, evidenceDigest, publisher, appId, adapter }) {
  require(Number.isSafeInteger(appId) && appId > 0, 'dedicated App ID is not configured');
  require(source?.action === 'completed' && source.status === 'completed' && source.conclusion === 'success',
    'only a completed successful verifier run can publish a successful App check');
  validatePublisherResult(bundle, source, evidenceDigest);
  require(SHA.test(publisher?.sha) && SHA256.test(publisher?.policyDigest), 'publisher workflow provenance is malformed');
  require(bundle.trustedVerification === 'PASS', 'trusted verification is not PASS');
  require(bundle.decisionIdentity.requestedCommentId === null || bundle.decisionIdentity.state === 'APPROVED',
    'requested Owner decision is missing, revoked, or expired');
  const externalId = buildExternalId(bundle, publisher);
  const payload = checkPayload(bundle, externalId, publisher);
  await adapter.assertPullRequest(bundle.candidate.prNumber, bundle.candidate.headSha, bundle.candidate.baseSha);
  if (bundle.decisionIdentity.requestedCommentId !== null) {
    const currentDecision = await adapter.getDecisionComment(bundle.decisionIdentity.requestedCommentId);
    require(decisionIsCurrent(currentDecision, bundle, adapter.apiUrl, adapter.now?.() ?? Date.now()), 'Owner decision was edited, revoked, or expired before publication');
  }
  const existing = findIdempotentCheck(await adapter.listChecks(bundle.candidate.headSha), payload, appId);
  if (existing?.completed) return { outcome: 'idempotent-success', externalId, checkRunId: existing.id };
  const updatePayload = Object.fromEntries(Object.entries(payload).filter(([key]) => key !== 'head_sha'));
  const pending = existing
    ? validateAppCheck(await adapter.updateCheck(existing.id, updatePayload), payload, appId)
    : validateAppCheck(await adapter.createCheck(payload), payload, appId);
  require(validPositiveInteger(pending.id), 'Checks API returned an invalid check run ID');

  try {
    await adapter.assertPullRequest(bundle.candidate.prNumber, bundle.candidate.headSha, bundle.candidate.baseSha);
    if (bundle.decisionIdentity.requestedCommentId !== null) {
      const currentDecision = await adapter.getDecisionComment(bundle.decisionIdentity.requestedCommentId);
      require(decisionIsCurrent(currentDecision, bundle, adapter.apiUrl, adapter.now?.() ?? Date.now()), 'Owner decision was edited, revoked, or expired before check completion');
    }
  } catch (error) {
    const failure = { status: 'completed', conclusion: 'failure', output: { title: 'Trusted verification invalidated', summary: String(error.message ?? 'binding changed') } };
    const failed = await adapter.updateCheck(pending.id, failure);
    validateAppCheck(failed, { ...payload, external_id: payload.external_id }, appId, { completed: true, conclusion: 'failure' });
    throw error;
  }

  const completed = await adapter.updateCheck(pending.id, { status: 'completed', conclusion: 'success' });
  validateAppCheck(completed, payload, appId, { completed: true, conclusion: 'success' });
  return { outcome: 'published-success', externalId, checkRunId: completed.id };
}

export function assertAllowedConclusion(conclusion) {
  require(conclusion === 'success' || conclusion === 'failure', 'neutral and skipped conclusions are forbidden');
  return conclusion;
}
