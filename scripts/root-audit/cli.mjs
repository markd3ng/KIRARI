import { createHash } from 'node:crypto';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runIndependentAudits } from './audit.mjs';
import { evaluateVerification } from './evaluator.mjs';
import { parseAndValidateLockfile } from './lockfile.mjs';

const MAX_FILE_BYTES = 8 * 1024 * 1024;
const MAX_GITHUB_RESPONSE_BYTES = 20 * 1024 * 1024;
const MAX_DECISION_COMMENT_BYTES = 32 * 1024 * 1024;
const SHA = /^[a-f0-9]{40}$/;
const SHA256 = /^[a-f0-9]{64}$/;

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function digestNamedFiles(files) {
  return sha256(Object.entries(files).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
    .map(([name, content]) => `${name}\0${sha256(content)}\n`).join(''));
}

function validateInputs(event) {
  if (event.eventName !== 'workflow_dispatch' || event.repository !== 'markd3ng/KIRARI' ||
      event.ref !== 'refs/heads/main' || event.workflowRef !== 'markd3ng/KIRARI/.github/workflows/r3-trusted-verifier.yml@refs/heads/main' ||
      event.workflowSha !== event.sha || !SHA.test(event.sha) || !/^\d+$/.test(event.runId) ||
      !/^\d+$/.test(event.runAttempt) || !event.apiUrl ||
      new URL(event.apiUrl).origin !== 'https://api.github.com') {
    throw new Error('run metadata is not a trusted main workflow_dispatch event');
  }
  const eventInputs = event.payload?.inputs;
  if (!eventInputs || typeof eventInputs !== 'object') throw new Error('workflow_dispatch inputs are missing');
  const prNumber = process.env.R3_PR_NUMBER ?? '';
  const expectedHeadSha = process.env.R3_EXPECTED_HEAD_SHA ?? '';
  const expectedBaseSha = process.env.R3_EXPECTED_BASE_SHA ?? '';
  const expectedSecurityReviewDigest = process.env.R3_SECURITY_REVIEW_SHA256 ?? '';
  if (!/^[1-9][0-9]{0,5}$/.test(prNumber) || !SHA.test(expectedHeadSha) || !SHA.test(expectedBaseSha)) {
    throw new Error('PR number or immutable candidate SHA input is invalid');
  }
  if (eventInputs.pr_number !== prNumber || eventInputs.expected_head_sha !== expectedHeadSha ||
      eventInputs.expected_base_sha !== expectedBaseSha ||
      (eventInputs.security_review_sha256 ?? '') !== expectedSecurityReviewDigest) {
    throw new Error('event payload does not match the validated workflow inputs');
  }
  if (expectedSecurityReviewDigest && !SHA256.test(expectedSecurityReviewDigest)) throw new Error('security review SHA256 input is invalid');
  return { prNumber: Number(prNumber), expectedHeadSha, expectedBaseSha, expectedSecurityReviewDigest: expectedSecurityReviewDigest || null };
}

export async function readBoundedResponseText(response, maxBytes, byteBudget = null) {
  const remainingBudget = byteBudget ? byteBudget.limit - byteBudget.used : maxBytes;
  const responseLimit = Math.min(maxBytes, remainingBudget);
  const contentLength = response.headers.get('content-length');
  if (remainingBudget <= 0 || (contentLength && /^\d+$/.test(contentLength) && Number(contentLength) > responseLimit)) {
    await response.body?.cancel();
    throw new Error('GitHub API response exceeds size limit');
  }
  const reader = response.body?.getReader();
  if (!reader) throw new Error('GitHub API response has no body');
  const chunks = [];
  let byteLength = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      byteLength += value.byteLength;
      if (byteLength > responseLimit) {
        await reader.cancel();
        throw new Error('GitHub API response exceeds size limit');
      }
      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }
  let text;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks, byteLength));
  } catch {
    throw new Error('GitHub API returned invalid UTF-8');
  }
  if (byteBudget) byteBudget.used += byteLength;
  return text;
}

async function requestJson(url, token, { byteBudget } = {}) {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'kirari-r3-trusted-verifier',
    },
    redirect: 'error',
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error(`GitHub API request failed with HTTP ${response.status}`);
  }
  const text = await readBoundedResponseText(response, MAX_GITHUB_RESPONSE_BYTES, byteBudget);
  try {
    return JSON.parse(text);
  } catch {
    throw new Error('GitHub API returned malformed JSON');
  }
}

async function fetchCandidateFile(apiUrl, headRepo, file, headSha, token) {
  const [owner, repo] = headRepo.split('/');
  const segments = file.split('/').map(encodeURIComponent).join('/');
  const url = new URL(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${segments}`, apiUrl);
  url.searchParams.set('ref', headSha);
  const response = await requestJson(url, token);
  if (!response || response.type !== 'file' || response.encoding !== 'base64' || typeof response.content !== 'string') {
    throw new Error(`required candidate file is unavailable: ${file}`);
  }
  const encoded = response.content.replace(/\s/g, '');
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded)) {
    throw new Error(`candidate file encoding is invalid: ${file}`);
  }
  const bytes = Buffer.from(encoded, 'base64');
  if (bytes.length > MAX_FILE_BYTES) throw new Error(`candidate file exceeds size limit: ${file}`);
  let content;
  try {
    content = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw new Error(`candidate file is not valid UTF-8: ${file}`);
  }
  return content;
}

async function getDecisionComments(apiUrl, issueNumber, token) {
  const comments = [];
  const byteBudget = { limit: MAX_DECISION_COMMENT_BYTES, used: 0 };
  for (let page = 1; page <= 100; page += 1) {
    const url = new URL(`/repos/markd3ng/KIRARI/issues/${issueNumber}/comments`, apiUrl);
    url.searchParams.set('per_page', '100');
    url.searchParams.set('page', String(page));
    const response = await requestJson(url, token, { byteBudget });
    if (!Array.isArray(response)) throw new Error('GitHub issue comments response is malformed');
    for (const comment of response) {
      if (typeof comment.body !== 'string' || !comment.body.startsWith('KIRARI_R3_CONSUMPTION_DECISION_V1\n')) continue;
      comments.push({
        id: comment.id,
        body: comment.body,
        author_association: comment.author_association,
        user: { login: comment.user?.login },
        issueNumber,
      });
    }
    if (response.length < 100) return comments;
  }
  throw new Error('GitHub issue comment page limit exceeded');
}

async function getGitHubState(apiUrl, prNumber, expectedHeadSha, expectedBaseSha, token) {
  const pr = await requestJson(new URL(`/repos/markd3ng/KIRARI/pulls/${prNumber}`, apiUrl), token);
  const candidate = {
    number: pr.number,
    state: pr.state,
    merged: pr.merged,
    headSha: pr.head?.sha,
    baseSha: pr.base?.sha,
    baseRef: pr.base?.ref,
    headRepo: pr.head?.repo?.full_name,
  };
  if (candidate.number !== prNumber || candidate.state !== 'open' || candidate.merged !== false ||
      candidate.headSha !== expectedHeadSha || candidate.baseSha !== expectedBaseSha || candidate.baseRef !== 'main' ||
      typeof candidate.headRepo !== 'string' || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(candidate.headRepo)) {
    throw new Error('GitHub pull request metadata does not match the immutable inputs');
  }
  const issue122Raw = await requestJson(new URL('/repos/markd3ng/KIRARI/issues/122', apiUrl), token);
  const issue135Raw = await requestJson(new URL('/repos/markd3ng/KIRARI/issues/135', apiUrl), token);
  const issue122 = {
    number: issue122Raw.number,
    state: issue122Raw.state,
    title: issue122Raw.title,
    bodySha256: sha256(issue122Raw.body ?? ''),
  };
  const issue135 = { number: issue135Raw.number, state: issue135Raw.state };
  const comments = await getDecisionComments(apiUrl, 135, token);
  return { candidate, issue122, issue135, comments };
}

function writeJson(directory, name, value) {
  return writeFile(path.join(directory, name), `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
}

async function saveFailure(evidenceDirectory, error) {
  await mkdir(evidenceDirectory, { recursive: true, mode: 0o700 });
  await writeJson(evidenceDirectory, 'failure.json', {
    schema: 'kirari.r3-trusted-verification-failure/v1',
    trustedVerification: 'FAIL',
    authorization: { decision: 'PENDING', r3ExceptionConsumable: false, exceptionApplied: false, exceptionConsumed: false },
    error: error instanceof Error ? error.message : 'unknown trusted verifier error',
  });
  await writeFile(path.join(evidenceDirectory, 'summary.md'), [
    '# R3 trusted verifier',
    '',
    '- Trusted verification: **FAIL**',
    '- R3 consumption: **PENDING / NOT CONSUMABLE**',
    '- Failure details: see machine-readable `failure.json` in the artifact.',
    '',
  ].join('\n'), { mode: 0o600 });
}

async function main() {
  const evidenceDirectory = process.env.R3_EVIDENCE_DIR ?? path.join(process.env.RUNNER_TEMP ?? '/tmp', 'r3-evidence');
  await mkdir(evidenceDirectory, { recursive: true, mode: 0o700 });
  try {
    const eventPath = process.env.GITHUB_EVENT_PATH;
    if (!eventPath) throw new Error('GitHub event payload path is missing');
    let payload;
    try {
      payload = JSON.parse(await readFile(eventPath, 'utf8'));
    } catch {
      throw new Error('GitHub event payload is malformed');
    }
    const event = {
      eventName: process.env.GITHUB_EVENT_NAME,
      repository: process.env.GITHUB_REPOSITORY,
      ref: process.env.GITHUB_REF,
      sha: process.env.GITHUB_SHA,
      workflowRef: process.env.GITHUB_WORKFLOW_REF,
      workflowSha: process.env.GITHUB_WORKFLOW_SHA,
      runId: process.env.GITHUB_RUN_ID,
      runAttempt: process.env.GITHUB_RUN_ATTEMPT,
      apiUrl: process.env.GITHUB_API_URL,
      payload,
    };
    const input = validateInputs(event);
    const token = process.env.GH_TOKEN;
    if (typeof token !== 'string' || token.length < 20) throw new Error('read-only GitHub token is unavailable');
    const policyRaw = await readFile(new URL('./trusted-policy.json', import.meta.url));
    const policy = JSON.parse(policyRaw.toString('utf8'));
    const workflowRaw = await readFile(path.resolve('.github/workflows/r3-trusted-verifier.yml'));
    const trustedSources = {};
    for (const file of [
      '.github/workflows/r3-trusted-verifier.yml',
      'scripts/root-audit/cli.mjs',
      'scripts/root-audit/evaluator.mjs',
      'scripts/root-audit/lockfile.mjs',
      'scripts/root-audit/audit.mjs',
      'scripts/root-audit/trusted-policy.json',
    ]) {
      trustedSources[file] = await readFile(path.resolve(file));
    }
    const trusted = {
      eventName: event.eventName,
      repository: event.repository,
      ref: event.ref,
      sha: event.sha,
      workflowRef: event.workflowRef,
      workflowSha: event.workflowSha,
      runId: event.runId,
      runAttempt: event.runAttempt,
      workflowDigest: sha256(workflowRaw),
      evaluatorDigest: sha256(trustedSources['scripts/root-audit/evaluator.mjs']),
      verifierDigest: digestNamedFiles(trustedSources),
      policyDigest: sha256(policyRaw),
    };
    const preflight = await getGitHubState(event.apiUrl, input.prNumber, input.expectedHeadSha, input.expectedBaseSha, token);
    await writeJson(evidenceDirectory, 'preflight-pr-metadata.json', preflight.candidate);
    const candidateFiles = {};
    for (const file of policy.candidateFiles) {
      candidateFiles[file] = await fetchCandidateFile(event.apiUrl, preflight.candidate.headRepo, file, input.expectedHeadSha, token);
    }
    parseAndValidateLockfile(candidateFiles['pnpm-lock.yaml'], candidateFiles, policy);
    const audits = await runIndependentAudits(candidateFiles, policy, evidenceDirectory);
    const github = await getGitHubState(event.apiUrl, input.prNumber, input.expectedHeadSha, input.expectedBaseSha, token);
    if (JSON.stringify(github.candidate) !== JSON.stringify(preflight.candidate)) {
      throw new Error('pull request metadata changed while verification was running');
    }
    await writeJson(evidenceDirectory, 'candidate-metadata.json', github.candidate);
    await writeJson(evidenceDirectory, 'control-plane-metadata.json', {
      issue122: github.issue122,
      issue135: github.issue135,
      approvalCommentCount: github.comments.length,
    });
    const result = evaluateVerification({
      policy,
      expectedPrNumber: input.prNumber,
      expectedHeadSha: input.expectedHeadSha,
      expectedBaseSha: input.expectedBaseSha,
      expectedSecurityReviewDigest: input.expectedSecurityReviewDigest,
      candidate: github.candidate,
      candidateFiles,
      audits,
      issue122: github.issue122,
      issue135: github.issue135,
      comments: github.comments,
      trusted,
    });
    result.trustedRun.evaluatorDigest = trusted.evaluatorDigest;
    result.trustedRun.actionPins = policy.actions;
    result.trustedRun.policyDigest = trusted.policyDigest;
    await writeJson(evidenceDirectory, 'result.json', result);
    await writeJson(evidenceDirectory, 'candidate-file-digests.json', result.candidate.files);
    await writeJson(evidenceDirectory, 'dependency-topology.json', result.topology);
    await writeJson(evidenceDirectory, 'action-pins.json', policy.actions);
    await writeJson(evidenceDirectory, 'authorization.json', result.authorization);
    const summary = [
      '# R3 trusted verifier',
      '',
      `- Trusted verification: **${result.trustedVerification}**`,
      `- Candidate: PR #${result.candidate.number} at \`${result.candidate.headSha}\``,
      `- Base: \`${result.candidate.baseSha}\``,
      `- Candidate digest: \`${result.candidate.digest}\``,
      `- Trusted verifier digest: \`${trusted.verifierDigest}\``,
      `- R3 topology paths: **${result.topology.r3Paths.length} exact paths**`,
      `- #122: **separate; ${github.issue122.state}; supplemental audit only**`,
      `- R3 consumption decision: **${result.authorization.decision}**`,
      `- R3 exception consumable: **${result.authorization.r3ExceptionConsumable ? 'YES' : 'NO'}**`,
      '',
      'Raw audit output and stderr are retained in this run artifact.',
      '',
    ].join('\n');
    await writeFile(path.join(evidenceDirectory, 'summary.md'), summary, { mode: 0o600 });
    const stepSummary = process.env.GITHUB_STEP_SUMMARY;
    if (stepSummary) await writeFile(stepSummary, summary, { flag: 'a' });
  } catch (error) {
    await saveFailure(evidenceDirectory, error);
    const stepSummary = process.env.GITHUB_STEP_SUMMARY;
    if (stepSummary) await writeFile(stepSummary, '# R3 trusted verifier\n\n- Trusted verification: **FAIL**\n- R3 consumption: **PENDING / NOT CONSUMABLE**\n', { flag: 'a' });
    process.exitCode = 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
