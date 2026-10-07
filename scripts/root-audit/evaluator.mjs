import { createHash } from 'node:crypto';
import { parseAndValidateLockfile } from './lockfile.mjs';

export const APPROVAL_MARKER = 'KIRARI_R3_CONSUMPTION_DECISION_V1';
const SEVERITY = new Set(['info', 'low', 'moderate', 'high', 'critical']);
const SHA = /^[a-f0-9]{40}$/;
const SHA256 = /^[a-f0-9]{64}$/;

function fail(message) {
  throw new Error(`trusted verification failed: ${message}`);
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function digestFiles(files) {
  const entries = Object.entries(files).sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0);
  return sha256(entries.map(([file, content]) => `${file}\0${sha256(content)}\n`).join(''));
}

function normalizeAuditPath(value) {
  if (typeof value !== 'string' || !value || value.includes('..')) fail('invalid audit finding path');
  return value.split('>').map((part) => part.trim()).join(' > ');
}

function packageNames(versionedPath) {
  return versionedPath.split(' > ').map((component) => {
    if (component === '.' || component.startsWith('apps/') || component.startsWith('workers/') || component.startsWith('packages/')) return component;
    const separator = component.lastIndexOf('@');
    return separator > 0 ? component.slice(0, separator) : component;
  }).join(' > ');
}

function parseAudit(raw, label, execution) {
  if (!execution || (label === 'normal'
    ? execution.derived !== true || execution.source !== 'trusted-filter-from-supplemental'
    : execution.executed !== true)) fail(`${label} audit evidence was not produced by its trusted source`);
  if (![0, 1].includes(execution.exitCode)) fail(`${label} audit exited unexpectedly`);
  if (execution.timedOut === true || execution.tooLarge === true || execution.signal) fail(`${label} audit did not complete cleanly`);
  if (typeof raw !== 'string' || raw.length === 0) fail(`${label} raw audit missing`);
  let report;
  try {
    report = JSON.parse(raw);
  } catch {
    fail(`${label} audit JSON is malformed`);
  }
  if (!report || typeof report !== 'object' || Array.isArray(report)) fail(`${label} audit root is invalid`);
  if (!Array.isArray(report.actions) || !report.advisories || typeof report.advisories !== 'object' || Array.isArray(report.advisories)) {
    fail(`${label} audit schema drift: actions/advisories`);
  }
  if (!Array.isArray(report.muted) || !report.metadata || typeof report.metadata !== 'object') fail(`${label} audit schema drift: muted/metadata`);
  const counts = report.metadata.vulnerabilities;
  if (!counts || typeof counts !== 'object' || Array.isArray(counts)) fail(`${label} audit schema drift: vulnerability counts`);
  for (const name of ['info', 'low', 'moderate', 'high', 'critical']) {
    if (!Number.isSafeInteger(counts[name]) || counts[name] < 0) fail(`${label} audit schema drift: ${name} count`);
  }
  for (const name of ['dependencies', 'devDependencies', 'optionalDependencies', 'totalDependencies']) {
    if (!Number.isSafeInteger(report.metadata[name]) || report.metadata[name] < 0) fail(`${label} audit schema drift: ${name}`);
  }
  for (const [id, advisory] of Object.entries(report.advisories)) {
    if (!/^\d+$/.test(id) || !advisory || typeof advisory !== 'object') fail(`${label} audit advisory key is invalid`);
    if (advisory.id !== Number(id) || !SEVERITY.has(advisory.severity) || typeof advisory.github_advisory_id !== 'string' ||
        typeof advisory.module_name !== 'string' || !Array.isArray(advisory.cves) || !Array.isArray(advisory.findings)) {
      fail(`${label} audit schema drift in advisory ${id}`);
    }
    for (const finding of advisory.findings) {
      if (!finding || typeof finding.version !== 'string' || !Array.isArray(finding.paths) ||
          typeof finding.dev !== 'boolean' || typeof finding.optional !== 'boolean' || typeof finding.bundled !== 'boolean') {
        fail(`${label} audit schema drift in finding ${id}`);
      }
      for (const findingPath of finding.paths) normalizeAuditPath(findingPath);
    }
  }
  return report;
}

function assertRawVulnerabilityCountsMatchAdvisories(report) {
  const actual = Object.fromEntries(['info', 'low', 'moderate', 'high', 'critical'].map((severity) => [severity, 0]));
  for (const advisory of Object.values(report.advisories)) actual[advisory.severity] += 1;
  const reported = report.metadata.vulnerabilities;
  if (Object.keys(actual).some((severity) => actual[severity] !== reported[severity])) {
    fail('unignored audit vulnerability counts do not match its advisory set');
  }
}

export function deriveNormalAudit(raw, policy) {
  let report;
  try {
    report = JSON.parse(raw);
  } catch {
    fail('cannot derive normal audit from malformed unignored JSON');
  }
  if (!report || typeof report !== 'object' || !report.advisories || typeof report.advisories !== 'object' || Array.isArray(report.advisories)) {
    fail('cannot derive normal audit from an unknown unignored schema');
  }
  const matching = Object.entries(report.advisories).filter(([, advisory]) =>
    advisory?.github_advisory_id === policy.issue122.ghsa || advisory?.cves?.includes(policy.issue122.cve));
  if (matching.length !== 1) fail('unignored audit does not contain exactly one separate #122 advisory');
  const [key, advisory] = matching[0];
  if (advisory.github_advisory_id !== policy.issue122.ghsa || advisory.module_name !== policy.issue122.package ||
      advisory.severity !== policy.issue122.severity || JSON.stringify(advisory.cves) !== JSON.stringify([policy.issue122.cve])) {
    fail('unignored #122 advisory identity differs from its exact independent policy');
  }
  const normal = structuredClone(report);
  delete normal.advisories[key];
  return JSON.stringify(normal, null, 2);
}

function collectFindings(report, advisoryId) {
  const entries = Object.entries(report.advisories).filter(([, advisory]) => advisory.github_advisory_id === advisoryId);
  if (entries.length > 1) fail(`duplicate advisory ${advisoryId}`);
  return entries.length === 0 ? null : entries[0][1];
}

function assertExactFindings(advisory, expected, policy, label) {
  if (!advisory || advisory.module_name !== policy.package || advisory.github_advisory_id !== policy.ghsa ||
      advisory.severity !== policy.severity) fail(`${label} advisory identity mismatch`);
  const actual = advisory.findings.flatMap((finding) => finding.paths.map((path) => `${normalizeAuditPath(path)}\0${finding.version}`)).sort();
  const wanted = expected.map((finding) => `${finding.pathNames}\0${finding.version}`).sort();
  if (JSON.stringify(actual) !== JSON.stringify(wanted)) fail(`${label} advisory paths or versions mismatch`);
}

function auditFindingList(report, advisory) {
  return advisory.findings.flatMap((finding) => finding.paths.map((path) => ({ path: normalizeAuditPath(path), version: finding.version })));
}

function checkUnexpectedAdvisories(report, allowed, label) {
  for (const advisory of Object.values(report.advisories)) {
    if (['moderate', 'high', 'critical'].includes(advisory.severity) && !allowed.has(advisory.github_advisory_id)) {
      fail(`${label} contains an unapproved ${advisory.severity} advisory ${advisory.github_advisory_id}`);
    }
  }
}

function parseApproval(comments, context, now) {
  const marked = [];
  for (const comment of comments) {
    if (typeof comment.body !== 'string' || !comment.body.startsWith(`${APPROVAL_MARKER}\n`)) continue;
    if (comment.id !== context.expectedDecisionCommentId || context.expectedDecisionCommentId === null) {
      fail('decision comment was not selected by its immutable comment ID');
    }
    if (comment.issueNumber !== context.policy.decisionIssue || comment.author_association !== 'OWNER' ||
        comment.user?.login !== context.policy.requiredOwnerLogin || !Number.isSafeInteger(comment.id) || comment.id <= 0) {
      fail('decision comment is not an authenticated repository Owner comment on the decision issue');
    }
    let record;
    try {
      record = JSON.parse(comment.body.slice(APPROVAL_MARKER.length + 1));
    } catch {
      fail('Owner decision record is malformed');
    }
    marked.push({ comment, record });
  }
  if (marked.length === 0) return { state: 'PENDING', commentId: null, decision: null, decisionDigest: null };
  if (marked.length !== 1) fail('multiple Owner decision records are ambiguous');
  const { comment, record } = marked[0];
  const requiredKeys = [
    'schema', 'decision', 'repository', 'issue', 'commentId', 'candidateHeadSha', 'baseSha', 'candidateDigest',
    'policyDigest', 'verifierDigest', 'securityReviewDigest', 'expiresAt',
  ].sort();
  if (!record || typeof record !== 'object' || Array.isArray(record) ||
      JSON.stringify(Object.keys(record).sort()) !== JSON.stringify(requiredKeys)) fail('Owner decision fields are incomplete or unknown');
  if (record.schema !== 'kirari.r3-consumption-decision/v1' || record.decision !== 'APPROVE_R3_CONSUMPTION' ||
      record.repository !== context.policy.repository || record.issue !== context.policy.decisionIssue ||
      record.commentId !== comment.id ||
      record.candidateHeadSha !== context.expectedHeadSha || record.baseSha !== context.expectedBaseSha ||
      record.candidateDigest !== context.candidateDigest || record.policyDigest !== context.policyDigest ||
      record.verifierDigest !== context.trusted.verifierDigest ||
      !SHA256.test(record.securityReviewDigest) || record.securityReviewDigest !== context.expectedSecurityReviewDigest) {
    fail('Owner decision is bound to different candidate or trusted evidence');
  }
  if (!SHA.test(record.candidateHeadSha) || !SHA.test(record.baseSha) || !SHA256.test(record.candidateDigest) ||
      !SHA256.test(record.policyDigest) || !SHA256.test(record.verifierDigest)) fail('Owner decision digest format is invalid');
  const expiry = Date.parse(record.expiresAt);
  if (!Number.isFinite(expiry) || new Date(expiry).toISOString() !== record.expiresAt || expiry <= now) fail('Owner decision is expired or malformed');
  if (expiry - now > 7 * 24 * 60 * 60 * 1000) fail('Owner decision expiry exceeds the seven-day maximum');
  return {
    state: 'APPROVED',
    commentId: comment.id,
    decision: record.decision,
    decisionDigest: sha256(comment.body),
    securityReviewDigest: record.securityReviewDigest,
    expiresAt: record.expiresAt,
  };
}

export function evaluateVerification(input) {
  const { policy, expectedHeadSha, expectedBaseSha, candidate, candidateFiles, audits, issue122, issue135, comments, trusted } = input;
  const now = input.now ?? Date.now();
  if (!policy || policy.repository !== 'markd3ng/KIRARI') fail('trusted policy missing or unexpected');
  if (!SHA.test(expectedHeadSha) || !SHA.test(expectedBaseSha)) fail('expected SHA input is invalid');
  if (!Number.isSafeInteger(input.expectedPrNumber) || input.expectedPrNumber <= 0 ||
      !candidate || candidate.number !== input.expectedPrNumber || candidate.state !== 'open' || candidate.merged !== false ||
      candidate.headSha !== expectedHeadSha || candidate.baseSha !== expectedBaseSha || candidate.baseRef !== 'main') {
    fail('pull request state or immutable SHA binding mismatch');
  }
  if (!candidate.headRepo || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(candidate.headRepo)) fail('pull request head repository is missing');
  const allowedFiles = [...policy.candidateFiles].sort();
  if (JSON.stringify(Object.keys(candidateFiles).sort()) !== JSON.stringify(allowedFiles)) fail('candidate input allowlist mismatch');
  for (const [file, content] of Object.entries(candidateFiles)) {
    if (typeof content !== 'string' || Buffer.byteLength(content, 'utf8') > 8 * 1024 * 1024) fail(`invalid candidate input ${file}`);
  }
  const candidateDigest = digestFiles(candidateFiles);
  const topology = parseAndValidateLockfile(candidateFiles['pnpm-lock.yaml'], candidateFiles, policy);
  if (!topology.issue122Paths.includes(policy.issue122.path)) fail('lockfile #122 canonical dependency path is missing');
  if (!issue122 || issue122.number !== policy.issue122.number || issue122.state !== policy.issue122.expectedState ||
      issue122.title !== policy.issue122.title || issue122.bodySha256 !== policy.issue122.bodySha256) {
    fail('issue #122 state, title, or body digest drift');
  }
  if (!issue135 || issue135.number !== policy.decisionIssue || issue135.state !== 'open') fail('decision issue metadata is unavailable or closed');
  if (!trusted || trusted.eventName !== 'workflow_dispatch' || trusted.repository !== policy.repository ||
      trusted.ref !== 'refs/heads/main' || trusted.workflowRef !== `${policy.repository}/.github/workflows/r3-trusted-verifier.yml@refs/heads/main` ||
      trusted.workflowSha !== trusted.sha || trusted.sha !== expectedBaseSha || !SHA.test(trusted.sha) || !/^\d+$/.test(trusted.runId ?? '') ||
      !/^\d+$/.test(trusted.runAttempt ?? '') ||
      !SHA256.test(trusted.workflowDigest) || !SHA256.test(trusted.verifierDigest) || !SHA256.test(trusted.policyDigest)) {
    fail('workflow run is not bound to the trusted base workflow');
  }

  const normal = parseAudit(audits?.normal?.raw, 'normal', audits?.normal);
  const supplemental = parseAudit(audits?.supplemental?.raw, 'supplemental', audits?.supplemental);
  assertRawVulnerabilityCountsMatchAdvisories(supplemental);
  if (audits.pnpmVersion !== policy.pnpmVersion) fail('pnpm audit parser version mismatch');
  if (audits.normal.source !== 'trusted-filter-from-supplemental') fail('normal audit is not derived by the trusted exact #122 filter');
  // pnpm 9.14.4 calculates metadata.vulnerabilities before applying ignoreCves.
  // The derived normal view therefore preserves the raw counts while removing only #122's advisory row.
  if (JSON.stringify(normal.metadata) !== JSON.stringify(supplemental.metadata) ||
      JSON.stringify(normal.actions) !== JSON.stringify(supplemental.actions) ||
      JSON.stringify(normal.muted) !== JSON.stringify(supplemental.muted)) {
    fail('normal and unignored audit metadata differ outside the exact advisory filter');
  }
  const normalAdvisoriesExpected = structuredClone(supplemental.advisories);
  const filteredException = Object.entries(normalAdvisoriesExpected).filter(([, advisory]) =>
    advisory.github_advisory_id === policy.issue122.ghsa || advisory.cves.includes(policy.issue122.cve));
  if (filteredException.length !== 1) fail('unignored audit has an ambiguous #122 filter target');
  delete normalAdvisoriesExpected[filteredException[0][0]];
  if (canonicalJson(normal.advisories) !== canonicalJson(normalAdvisoriesExpected)) {
    fail('normal audit differs from the unignored report by more than the exact #122 advisory');
  }
  const r3Policy = { ...policy.r3, package: policy.r3.package };
  const expectedR3 = policy.r3.paths.map((fullPath) => ({
    pathNames: packageNames(fullPath),
    version: fullPath.split(' > ').at(-1).slice(policy.r3.package.length + 1),
  }));
  const normalR3 = collectFindings(normal, policy.r3.ghsa);
  const supplementalR3 = collectFindings(supplemental, policy.r3.ghsa);
  assertExactFindings(normalR3, expectedR3, r3Policy, 'normal R3');
  assertExactFindings(supplementalR3, expectedR3, r3Policy, 'supplemental R3');
  if (collectFindings(normal, policy.issue122.ghsa)) fail('#122 is present in the normal audit despite its independent exception');
  const issue122Advisory = collectFindings(supplemental, policy.issue122.ghsa);
  const issue122Finding = issue122Advisory && auditFindingList(supplemental, issue122Advisory);
  const expectedIssue122Findings = topology.issue122Paths.map((findingPath) => ({
    path: packageNames(findingPath),
    version: findingPath.split(' > ').at(-1).slice(policy.issue122.package.length + 1),
  })).sort((a, b) => `${a.path}\0${a.version}`.localeCompare(`${b.path}\0${b.version}`));
  const normalizedIssue122Findings = [...(issue122Finding ?? [])].sort((a, b) => `${a.path}\0${a.version}`.localeCompare(`${b.path}\0${b.version}`));
  if (!issue122Advisory || issue122Advisory.module_name !== policy.issue122.package ||
      issue122Advisory.severity !== policy.issue122.severity ||
      issue122Advisory.cves.length !== 1 || issue122Advisory.cves[0] !== policy.issue122.cve ||
      JSON.stringify(normalizedIssue122Findings) !== JSON.stringify(expectedIssue122Findings) ||
      expectedIssue122Findings.some((finding) => finding.version !== policy.issue122.version)) {
    fail('supplemental #122 advisory identity, severity, version, or path mismatch');
  }
  checkUnexpectedAdvisories(normal, new Set([policy.r3.ghsa]), 'normal audit');
  checkUnexpectedAdvisories(supplemental, new Set([policy.r3.ghsa, policy.issue122.ghsa]), 'supplemental audit');
  if (audits.normal.exitCode !== 1 || audits.supplemental.exitCode !== 1) fail('audit command exit status did not reflect reported vulnerabilities');

  const expectedSecurityReviewDigest = input.expectedSecurityReviewDigest ?? null;
  if (expectedSecurityReviewDigest !== null && expectedSecurityReviewDigest !== undefined && !SHA256.test(expectedSecurityReviewDigest)) {
    fail('Owner-supplied security review reference digest is malformed');
  }
  const approval = parseApproval(comments ?? [], {
    policy,
    expectedHeadSha,
    expectedBaseSha,
    candidateDigest,
    policyDigest: trusted.policyDigest,
    trusted,
    expectedSecurityReviewDigest,
    expectedDecisionCommentId: input.expectedDecisionCommentId ?? null,
  }, now);
  if (approval.state === 'APPROVED' && !approval.securityReviewDigest) {
    fail('Owner decision is missing its manually reviewed security-review reference');
  }
  return {
    schema: 'kirari.r3-trusted-verification/v1',
    trustedVerification: 'PASS',
    candidate: {
      number: candidate.number,
      state: candidate.state,
      merged: candidate.merged,
      headSha: candidate.headSha,
      baseSha: candidate.baseSha,
      baseRef: candidate.baseRef,
      headRepo: candidate.headRepo,
      digest: candidateDigest,
      lockfileSha256: sha256(candidateFiles['pnpm-lock.yaml']),
      files: Object.fromEntries(Object.entries(candidateFiles).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([file, content]) => [file, sha256(content)])),
    },
    topology,
    auditTool: { name: 'pnpm', version: audits.pnpmVersion },
    audits: {
      normal: { derived: true, derivedFrom: audits.normal.source, exitCode: audits.normal.exitCode, rawSha256: sha256(audits.normal.raw), stderrSha256: sha256(audits.normal.stderr), advisoryIds: Object.values(normal.advisories).map((item) => item.github_advisory_id).sort() },
      supplemental: { executed: true, exitCode: audits.supplemental.exitCode, rawSha256: sha256(audits.supplemental.raw), stderrSha256: sha256(audits.supplemental.stderr), advisoryIds: Object.values(supplemental.advisories).map((item) => item.github_advisory_id).sort() },
    },
    issue122: { number: issue122.number, state: issue122.state, bodySha256: issue122.bodySha256, separateFromR3: true },
    trustedRun: {
      eventName: trusted.eventName,
      repository: trusted.repository,
      ref: trusted.ref,
      workflowRef: trusted.workflowRef,
      id: trusted.runId,
      attempt: trusted.runAttempt,
      sha: trusted.sha,
      workflowSha: trusted.workflowSha,
      workflowDigest: trusted.workflowDigest,
      verifierDigest: trusted.verifierDigest,
      policyDigest: trusted.policyDigest,
    },
    authorization: {
      decision: approval.state,
      issue: policy.decisionIssue,
      requestedCommentId: input.expectedDecisionCommentId ?? null,
      commentId: approval.commentId,
      decisionDigest: approval.decisionDigest,
      decisionLookup: input.decisionLookup?.state ?? (input.expectedDecisionCommentId === null || input.expectedDecisionCommentId === undefined ? 'NOT_REQUESTED' : 'FOUND'),
      owner: policy.requiredOwnerLogin,
      securityReviewDigest: approval.securityReviewDigest ?? expectedSecurityReviewDigest,
      expiresAt: approval.expiresAt ?? null,
      r3ExceptionConsumable: approval.state === 'APPROVED',
      exceptionApplied: false,
      exceptionConsumed: false,
    },
  };
}
