import { appendFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildPublisherResult, canonicalJson, decisionIsCurrent, listChecksAcrossPages, publishCheck, sha256, validateArtifactMetadata, validatePublisherResult, validateWorkflowMetadata, validateWorkflowRunApi, validateWorkflowRunEvent } from './publisher-contract.mjs';
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
  validateWorkflowRunApi(run, source);
  const workflow = await requestJson(apiEndpoint(apiUrl, `/repos/${repository}/actions/workflows/${source.workflowId}`), readToken);
  validateWorkflowMetadata(workflow, source);
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

  const pr = await requestJson(apiEndpoint(apiUrl, `/repos/${repository}/pulls/${bundle.candidate.prNumber}`), readToken);
  assertPullRequest(pr, bundle, bundle.candidate.headRepository);

  if (bundle.decisionIdentity.requestedCommentId !== null) {
    const comment = await requestOptionalJson(apiEndpoint(apiUrl, `/repos/${repository}/issues/comments/${bundle.decisionIdentity.requestedCommentId}`), readToken);
    if (!decisionIsCurrent(comment, bundle, apiUrl)) throw new Error('selected Owner decision was revoked, edited, or expired');
  }

  if (mode === 'validate') {
    if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, 'publisher_eligible=true\n', { mode: 0o600 });
    process.stdout.write(`Validated trusted evidence for PR #${bundle.candidate.prNumber} at ${bundle.candidate.headSha}; no App check was written.\n`);
    return;
  }

  const appToken = process.env.R3_APP_TOKEN;
  const appId = positiveInteger(process.env.R3_PUBLISHER_APP_ID, 'dedicated App ID');
  if (typeof appToken !== 'string' || appToken.length < 20) throw new Error('dedicated GitHub App installation token is unavailable');
  const appPublisher = {
    sha: publisherSha,
    policyDigest: sha256(policyBytes),
  };
  const checksToken = appToken;
  const adapter = {
    apiUrl,
    async assertPullRequest(prNumber, headSha, baseSha) {
      const current = await requestJson(apiEndpoint(apiUrl, `/repos/${repository}/pulls/${prNumber}`), readToken);
      if (current.state !== 'open' || current.merged !== false || current.head?.sha !== headSha || current.base?.sha !== baseSha || current.base?.ref !== 'main') {
        throw new Error('live PR HEAD or base changed before publication');
      }
    },
    async getDecisionComment(commentId) {
      return requestOptionalJson(apiEndpoint(apiUrl, `/repos/${repository}/issues/comments/${commentId}`), readToken);
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
  const outcome = await publishCheck({ bundle, source, evidenceDigest: evidenceStats.digest, publisher: appPublisher, appId, adapter });
  process.stdout.write(`Published trusted technical verifier check run ${outcome.checkRunId} (${outcome.outcome}); R3 consumption and merge authorization remain separate.\n`);
}

async function main() {
  try {
    const mode = process.argv[2];
    if (mode !== 'validate' && mode !== 'publish') throw new Error('publisher mode must be validate or publish');
    await validateInputs({ mode });
  } catch (error) {
    process.stderr.write(`R3 publisher failed closed: ${error instanceof Error ? error.message : 'unknown error'}\n`);
    process.exitCode = 1;
  }
}

export { assertPullRequest };

function assertPullRequest(pr, bundle, expectedHeadRepo) {
  if (pr.number !== bundle.candidate.prNumber || pr.state !== 'open' || pr.merged !== false ||
      pr.head?.sha !== bundle.candidate.headSha || pr.base?.sha !== bundle.candidate.baseSha || pr.base?.ref !== 'main' ||
      pr.head?.repo?.full_name !== expectedHeadRepo) {
    throw new Error('live PR HEAD, base, state, or source repository does not match trusted evidence');
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
