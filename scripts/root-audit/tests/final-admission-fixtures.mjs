import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { evaluateVerification } from '../evaluator.mjs';
import { buildExternalId, buildPublisherResult, checkPayload, sha256, VERIFIER_WORKFLOW_PATH } from '../publisher-contract.mjs';
import { approvalSecurityDigest, createContext, ownerApproval } from './fixtures.mjs';

export const SYNTHETIC_APP_ID = 7654321;
export const SYNTHETIC_REPOSITORY_ID = 123456789;
export const INSPECTION_NOW = Date.parse('2026-10-09T00:00:00.000Z');
const publisherPolicyDigest = sha256(await readFile(new URL('../publisher-policy.json', import.meta.url)));

// Pure fixtures; this factory never authenticates GitHub or asserts live custody.
export function makeFinalAdmissionFixture() {
  const verificationInput = createContext({ now: INSPECTION_NOW, expectedDecisionCommentId: 6019999999,
    expectedSecurityReviewDigest: approvalSecurityDigest });
  verificationInput.comments = [ownerApproval(verificationInput, { expiresAt: '2026-10-09T00:01:00.000Z' })];
  const verificationResult = evaluateVerification(verificationInput);
  verificationResult.trustedRun.repositoryId = SYNTHETIC_REPOSITORY_ID;
  verificationResult.trustedRun.workflowPath = VERIFIER_WORKFLOW_PATH;
  const evidenceDigest = 'f'.repeat(64);
  const bundle = buildPublisherResult({ result: verificationResult, repository: 'markd3ng/KIRARI', repositoryId: SYNTHETIC_REPOSITORY_ID, evidenceDigest });
  const source = { action: 'completed', status: 'completed', conclusion: 'success', repository: 'markd3ng/KIRARI',
    repositoryId: SYNTHETIC_REPOSITORY_ID, runId: Number(verificationResult.trustedRun.id), runNumber: 124,
    runAttempt: Number(verificationResult.trustedRun.attempt), workflowId: 9876543,
    mainSha: verificationResult.trustedRun.sha, workflowPath: VERIFIER_WORKFLOW_PATH };
  const publisher = { sha: source.mainSha, policyDigest: publisherPolicyDigest };
  const state = { now: INSPECTION_NOW, head: bundle.candidate.headSha, base: bundle.candidate.baseSha, main: bundle.candidate.baseSha,
    headRepository: bundle.candidate.headRepository, issue122: structuredClone(bundle.issue122), issue135: structuredClone(bundle.issue135),
    comment: { ...verificationInput.comments[0], issue_url: 'https://api.github.com/repos/markd3ng/KIRARI/issues/135' }, reads: [], writes: [] };
  state.check = { ...checkPayload(bundle, buildExternalId(bundle, publisher), publisher), id: 9001,
    app: { id: SYNTHETIC_APP_ID }, status: 'completed', conclusion: 'failure' };
  const adapter = {
    apiUrl: 'https://api.github.com', now: () => state.now,
    async assertPullRequest(pr, head, base, repository) {
      state.reads.push('PR');
      assert.equal(pr, bundle.candidate.prNumber);
      if (state.head !== head || state.base !== base || state.main !== base || state.headRepository !== repository) throw new Error('candidate identity changed');
    },
    async assertIssue122(expected) { state.reads.push('#122'); assert.deepEqual(state.issue122, expected); },
    async assertIssue135(expected) { state.reads.push('#135'); assert.deepEqual(state.issue135, expected); },
    async getDecisionComment(id) { state.reads.push('decision'); assert.equal(id, bundle.decisionIdentity.requestedCommentId); return state.comment; },
    async getPublisherCheck(head) { state.reads.push('check'); assert.equal(head, bundle.candidate.headSha); return state.check; },
    async createCheck() { state.writes.push('check'); assert.fail('inspection cannot publish'); },
    async updateCheck() { state.writes.push('check'); assert.fail('inspection cannot publish'); },
    async merge() { state.writes.push('merge'); assert.fail('inspection cannot merge'); },
  };
  return { verificationInput, verificationResult, bundle, source, evidenceDigest, publisher,
    expectedPublisherAppId: SYNTHETIC_APP_ID, adapter, state, syntheticOnly: true };
}
