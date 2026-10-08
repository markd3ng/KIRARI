import { appendFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertVerifierRunIsLatest, buildPublisherResult, canonicalJson, decisionIsCurrent, listChecksAcrossPages, listWorkflowRunsAcrossPages, publishCheck, publishFailure, publishPending, sha256, validateArtifactMetadata, validatePublisherResult, validateWorkflowMetadata, validateWorkflowRunApi, validateWorkflowRunEvent, workflowRunCreatedFilter } from './publisher-contract.mjs';
import { digestEvidenceDirectory } from './publisher-evidence.mjs';

const MAX_RESPONSE_BYTES = 20 * 1024 * 1024;
const REPOSITORY = 'markd3ng/KIRARI';

async function requestJson(url, token, { method = 'GET', body = undefined } = {}) {
  const response = await fetch(url, {
    method,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'kirari-r3-trusted-publisher',
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    redirect: 'error',
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error(`GitHub API request failed with HTTP ${response.status}`);
  }
  const reader = response.body?.getReader();
  if (!reader) throw new Error('GitHub API response has no body');
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_RESPONSE_BYTES) {
        await reader.cancel();
        throw new Error('GitHub API response exceeds size limit');
      }
      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }
  try {
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks, size)));
  } catch {
    throw new Error('GitHub API returned malformed JSON');
  }
}

async function requestOptionalJson(url, token) {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'kirari-r3-trusted-publisher',
    },
    redirect: 'error',
    signal: AbortSignal.timeout(20_000),
  });
  if (response.status === 404) {
    await response.body?.cancel();
    return null;
  }
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error(`GitHub API request failed with HTTP ${response.status}`);
  }
  const reader = response.body?.getReader();
  if (!reader) throw new Error('GitHub API response has no body');
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_RESPONSE_BYTES) {
        await reader.cancel();
        throw new Error('GitHub API response exceeds size limit');
      }
      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }
  try {
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks, size)));
  } catch {
    throw new Error('GitHub API returned malformed JSON');
  }
}

function positiveInteger(value, label) {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number <= 0) throw new Error(`${label} is invalid`);
  return number;
}

function apiEndpoint(apiUrl, pathname) {
  const url = new URL(pathname, apiUrl);
  if (url.origin !== 'https://api.github.com') throw new Error('GitHub API origin is invalid');
  return url;
}

async function readEvent(eventPath) {
  if (!eventPath) throw new Error('GitHub event payload path is missing');
  try {
    return JSON.parse(await readFile(eventPath, 'utf8'));
  } catch {
    throw new Error('GitHub workflow_run payload is malformed');
  }
}

export async function getOpenDecisionComment(apiUrl, repository, commentId, token) {
  if (repository !== REPOSITORY || !Number.isSafeInteger(commentId) || commentId <= 0) throw new Error('Owner decision lookup identity is invalid');
  const issue = await requestJson(apiEndpoint(apiUrl, `/repos/${repository}/issues/135`), token);
  if (issue.number !== 135 || issue.state !== 'open') throw new Error('Owner decision issue #135 is closed or unavailable');
  return requestOptionalJson(apiEndpoint(apiUrl, `/repos/${repository}/issues/comments/${commentId}`), token);
}

async function validateInputs({ mode }) {
  const event = await readEvent(process.env.GITHUB_EVENT_PATH);
  const apiUrl = process.env.GITHUB_API_URL;
  const repository = process.env.GITHUB_REPOSITORY;
  const repositoryId = positiveInteger(process.env.GITHUB_REPOSITORY_ID, 'repository ID');
  const ref = process.env.GITHUB_REF;
  const eventName = process.env.GITHUB_EVENT_NAME;
  const source = validateWorkflowRunEvent({ eventName, ref, payload: event, repositoryId, repository });
  const runId = positiveInteger(process.env.R3_UPSTREAM_RUN_ID, 'upstream run ID');
  const runAttempt = positiveInteger(process.env.R3_UPSTREAM_ATTEMPT, 'upstream run attempt');
  if (runId !== source.runId || runAttempt !== source.runAttempt) throw new Error('upstream run environment does not match authenticated event metadata');
  const readToken = process.env.GH_TOKEN;
  if (typeof readToken !== 'string' || readToken.length < 20) throw new Error('read-only GitHub token is unavailable');
  const evidenceDirectory = process.env.R3_EVIDENCE_DIR;
  if (!evidenceDirectory) throw new Error('trusted verifier artifact directory is missing');
  const publisherSha = process.env.GITHUB_WORKFLOW_SHA;
  if (!/^[a-f0-9]{40}$/.test(publisherSha ?? '')) throw new Error('publisher workflow SHA is invalid');
  const policyBytes = await readFile(new URL('./publisher-policy.json', import.meta.url));
  const publisherPolicy = JSON.parse(policyBytes.toString('utf8'));
  if (publisherPolicy.repository !== repository || publisherPolicy.requiredCheckName !== 'KIRARI / R3 trusted verifier' ||
      publisherPolicy.publisherWorkflowPath !== '.github/workflows/r3-trusted-publisher.yml' || publisherPolicy.environment !== 'r3-trusted-publisher') {
    throw new Error('publisher policy identity mismatch');
  }

  const run = await requestJson(apiEndpoint(apiUrl, `/repos/${repository}/actions/runs/${runId}/attempts/${runAttempt}`), readToken);
  const target = validateWorkflowRunApi(run, source);
  const mainBranch = await requestJson(apiEndpoint(apiUrl, `/repos/${repository}/branches/main`), readToken);
  if (mainBranch?.commit?.sha !== source.mainSha) throw new Error('trusted verifier run is not based on the current main SHA');
  const workflow = await requestJson(apiEndpoint(apiUrl, `/repos/${repository}/actions/workflows/${source.workflowId}`), readToken);
  validateWorkflowMetadata(workflow, source);
  if (target.baseSha !== source.mainSha) throw new Error('verifier run title base does not equal the trusted main SHA');
  const pr = await requestJson(apiEndpoint(apiUrl, `/repos/${repository}/pulls/${target.prNumber}`), readToken);
  assertRunTargetPullRequest(pr, target);
  if (!await isLatestVerifierRun({ apiUrl, repository, readToken, source, target })) {
    if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, 'publisher_eligible=false\n', { mode: 0o600 });
    process.stdout.write(`Verifier run ${source.runId} attempt ${source.runAttempt} was superseded for PR #${target.prNumber}; no App check was changed.\n`);
    return;
  }

  if (mode === 'preflight') {
    if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, 'publisher_eligible=true\n', { mode: 0o600 });
    process.stdout.write(`Authenticated verifier source and live PR target #${target.prNumber}; no artifact or App check was accessed.\n`);
    return;
  }

  const appToken = process.env.R3_APP_TOKEN;
  const appId = ['publish', 'publish-failure', 'publish-pending'].includes(mode) ? positiveInteger(process.env.R3_PUBLISHER_APP_ID, 'dedicated App ID') : null;
  const publisher = { sha: publisherSha, policyDigest: sha256(policyBytes) };
  const adapter = createCheckAdapter({ apiUrl, repository, readToken, checksToken: appToken, source, target });
  if (mode === 'publish-pending') {
    if (source.action === 'completed') throw new Error('completed verifier event cannot publish a pending App check');
    if (typeof appToken !== 'string' || appToken.length < 20) throw new Error('dedicated GitHub App installation token is unavailable');
    const outcome = await publishPending({ target, source, publisher, appId, adapter });
    process.stdout.write(`Published trusted verifier in-progress check run ${outcome.checkRunId}; no success conclusion was published.\n`);
    return;
  }
  if (mode === 'publish-failure') {
    if (source.action !== 'completed') throw new Error('pending verifier event cannot publish a failure conclusion');
    if (typeof appToken !== 'string' || appToken.length < 20) throw new Error('dedicated GitHub App installation token is unavailable');
    const outcome = await publishFailure({
      target,
      source,
      publisher,
      appId,
      adapter,
      failureReason: source.conclusion === 'success' ? 'successful verifier result artifact was missing or invalid' : null,
    });
    process.stdout.write(`Published trusted verifier failure check run ${outcome.checkRunId}; prior success for this exact HEAD was invalidated.\n`);
    return;
  }
  if (source.action !== 'completed') throw new Error('pending verifier event cannot validate or publish a result artifact');
  if (source.conclusion !== 'success') {
    if (mode === 'validate') {
      if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, 'result_valid=false\n', { mode: 0o600 });
      process.stdout.write(`Validated failed trusted verifier run for PR #${target.prNumber} at ${target.headSha}; it can invalidate an older App success.\n`);
      return;
    }
    if (typeof appToken !== 'string' || appToken.length < 20) throw new Error('dedicated GitHub App installation token is unavailable');
    const policyBytes = await readFile(new URL('./publisher-policy.json', import.meta.url));
    const outcome = await publishFailure({
      target,
      source,
      publisher,
      appId,
      adapter,
    });
    process.stdout.write(`Published trusted verifier failure check run ${outcome.checkRunId}; prior success for this exact HEAD was invalidated.\n`);
    return;
  }
  const artifactPage = await requestJson(apiEndpoint(apiUrl, `/repos/${repository}/actions/runs/${runId}/artifacts?per_page=100`), readToken);
  const artifact = validateArtifactMetadata(artifactPage.artifacts, source);

  const evidenceStats = await digestEvidenceDirectory(evidenceDirectory);
  let bundle;
  let result;
  try {
    [bundle, result] = await Promise.all([
      readFile(path.join(evidenceDirectory, 'publisher-result.json'), 'utf8').then(JSON.parse),
      readFile(path.join(evidenceDirectory, 'result.json'), 'utf8').then(JSON.parse),
    ]);
  } catch {
    throw new Error('trusted verifier result artifact is missing or malformed');
  }
  const expectedBundle = buildPublisherResult({
    result,
    repository,
    repositoryId,
    evidenceDigest: evidenceStats.digest,
  });
  if (canonicalJson(bundle) !== canonicalJson(expectedBundle)) throw new Error('publisher result does not match canonical verifier evidence');
  validatePublisherResult(bundle, source, evidenceStats.digest);

  if (bundle.candidate.prNumber !== target.prNumber || bundle.candidate.headSha !== target.headSha || bundle.candidate.baseSha !== target.baseSha) {
    throw new Error('successful verifier result does not match the authenticated run-title target');
  }
  assertPullRequest(pr, bundle, bundle.candidate.headRepository);

  if (bundle.decisionIdentity.requestedCommentId !== null) {
    const comment = await getOpenDecisionComment(apiUrl, repository, bundle.decisionIdentity.requestedCommentId, readToken);
    if (!decisionIsCurrent(comment, bundle, apiUrl)) throw new Error('selected Owner decision was revoked, edited, or expired');
  }

  if (mode === 'validate') {
    if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, 'result_valid=true\n', { mode: 0o600 });
    process.stdout.write(`Validated trusted evidence for PR #${bundle.candidate.prNumber} at ${bundle.candidate.headSha}; no App check was written.\n`);
    return;
  }

  if (typeof appToken !== 'string' || appToken.length < 20) throw new Error('dedicated GitHub App installation token is unavailable');
  const outcome = await publishCheck({ bundle, source, evidenceDigest: evidenceStats.digest, publisher, appId, adapter });
  process.stdout.write(`Published trusted technical verifier check run ${outcome.checkRunId} (${outcome.outcome}); R3 consumption and merge authorization remain separate.\n`);
}

async function main() {
  try {
    const mode = process.argv[2];
    if (!['preflight', 'validate', 'publish', 'publish-failure', 'publish-pending'].includes(mode)) throw new Error('publisher mode is unsupported');
    await validateInputs({ mode });
  } catch (error) {
    process.stderr.write(`R3 publisher failed closed: ${error instanceof Error ? error.message : 'unknown error'}\n`);
    process.exitCode = 1;
  }
}

export { assertPullRequest };

async function isLatestVerifierRun({ apiUrl, repository, readToken, source, target }) {
  const runs = await listWorkflowRunsAcrossPages(async (page) => {
    const url = apiEndpoint(apiUrl, `/repos/${repository}/actions/workflows/${source.workflowId}/runs`);
    url.searchParams.set('branch', 'main');
    url.searchParams.set('event', 'workflow_dispatch');
    url.searchParams.set('created', workflowRunCreatedFilter(source.createdAt));
    url.searchParams.set('per_page', '100');
    url.searchParams.set('page', String(page));
    return requestJson(url, readToken);
  });
  return assertVerifierRunIsLatest(runs, source, target);
}

function createCheckAdapter({ apiUrl, repository, readToken, checksToken, source, target }) {
  return {
    apiUrl,
    async assertPullRequest(prNumber, headSha, baseSha) {
      const current = await requestJson(apiEndpoint(apiUrl, `/repos/${repository}/pulls/${prNumber}`), readToken);
      if (current.state !== 'open' || current.merged !== false || current.head?.sha !== headSha || current.base?.sha !== baseSha || current.base?.ref !== 'main') {
        throw new Error('live PR HEAD or base changed before publication');
      }
      const main = await requestJson(apiEndpoint(apiUrl, `/repos/${repository}/branches/main`), readToken);
      if (main?.commit?.sha !== baseSha) throw new Error('live PR base is not the current main SHA');
      if (!await isLatestVerifierRun({ apiUrl, repository, readToken, source, target })) {
        throw new Error('a newer authenticated verifier run superseded this publisher attempt');
      }
    },
    async getDecisionComment(commentId) {
      return getOpenDecisionComment(apiUrl, repository, commentId, readToken);
    },
    async listChecks(headSha) {
      return listChecksAcrossPages(async (page) => {
        const url = apiEndpoint(apiUrl, `/repos/${repository}/commits/${headSha}/check-runs`);
        url.searchParams.set('check_name', 'KIRARI / R3 trusted verifier');
        url.searchParams.set('per_page', '100');
        url.searchParams.set('page', String(page));
        return requestJson(url, checksToken);
      });
    },
    async createCheck(payload) {
      return requestJson(apiEndpoint(apiUrl, `/repos/${repository}/check-runs`), checksToken, { method: 'POST', body: payload });
    },
    async updateCheck(id, payload) {
      return requestJson(apiEndpoint(apiUrl, `/repos/${repository}/check-runs/${id}`), checksToken, { method: 'PATCH', body: payload });
    },
  };
}

function assertRunTargetPullRequest(pr, target) {
  if (pr?.number !== target.prNumber || pr.state !== 'open' || pr.merged !== false ||
      pr.head?.sha !== target.headSha || pr.base?.sha !== target.baseSha || pr.base?.ref !== 'main' ||
      typeof pr.head?.repo?.full_name !== 'string') {
    throw new Error('authenticated verifier run title does not match the live PR head/base/state');
  }
}

function assertPullRequest(pr, bundle, expectedHeadRepo) {
  if (pr.number !== bundle.candidate.prNumber || pr.state !== 'open' || pr.merged !== false ||
      pr.head?.sha !== bundle.candidate.headSha || pr.base?.sha !== bundle.candidate.baseSha || pr.base?.ref !== 'main' ||
      pr.head?.repo?.full_name !== expectedHeadRepo) {
    throw new Error('live PR HEAD, base, state, or source repository does not match trusted evidence');
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
