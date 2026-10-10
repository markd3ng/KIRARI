import { readFile } from 'node:fs/promises';
import { evaluateVerification } from './evaluator.mjs';
import {
  buildExternalId, buildPublisherResult, canonicalJson, checkPayload,
  evaluateContinuingEligibility, REQUIRED_CHECK_NAME, sha256,
  validatePublisherResult, VERIFIER_WORKFLOW_PATH,
} from './publisher-contract.mjs';

const trustedPolicyBytes = await readFile(new URL('./trusted-policy.json', import.meta.url));
const trustedPolicy = JSON.parse(trustedPolicyBytes.toString('utf8'));
const trustedPolicyDigest = sha256(trustedPolicyBytes);
const publisherPolicyDigest = sha256(await readFile(new URL('./publisher-policy.json', import.meta.url)));

// This is a fixed assessment of the documented native protocol, not an adapter
// registration or a caller-provided certificate of server-side atomicity.
const capability = Object.freeze({
  schema: 'kirari.r3-final-admission-capability/v1',
  platform: 'github-native-checks-and-pull-request-merge',
  status: 'NOT_READY',
  authoritativeAdmissionAvailable: false,
  mergeExecutionAvailable: false,
  nativeRequiredCheckSuccessAllowed: false,
  expectedHeadShaComparisonSupported: true,
  atomicAuthorizationPredicatesSupported: false,
  blockers: Object.freeze([
    'NATIVE_CHECKS_HAVE_NO_AUTHORIZATION_TTL',
    'NATIVE_MERGE_LACKS_ATOMIC_AUTHORIZATION_PREDICATE',
    'CHECK_WRITER_APP_HAS_NO_MERGE_AUTHORITY',
    'EXCLUSIVE_FINAL_ADMISSION_AUTHORITY_NOT_ESTABLISHED',
  ]),
});

export function assessFinalAdmissionCapability() {
  return capability;
}

function requireValue(condition) {
  if (!condition) throw new Error('final-admission inspection binding rejected');
}

function result(inspection, phase, fields = {}) {
  return Object.freeze({
    schema: 'kirari.r3-final-admission-inspection/v1',
    inspection,
    phase,
    authoritative: false,
    liveTransportVerified: false,
    mergeAdmission: 'BLOCKED',
    mergeAllowed: false,
    requiredCheckSuccessAllowed: false,
    consumptionAllowed: false,
    capability,
    ...fields,
  });
}

function reconstructEvidence(snapshot) {
  const { verificationInput, verificationResult, bundle, source, evidenceDigest, publisher } = snapshot;
  validatePublisherResult(bundle, source, evidenceDigest);
  requireValue(verificationInput?.trusted?.policyDigest === trustedPolicyDigest && bundle.verifier.policyDigest === trustedPolicyDigest &&
    publisher?.policyDigest === publisherPolicyDigest);
  // Reproduce the original result at its original timestamp. Live eligibility
  // is evaluated separately at the observer's current time; no audit is rerun
  // here and no old audit/freshness timestamp is renewed by inspection.
  const derived = evaluateVerification({ ...verificationInput, policy: trustedPolicy, now: Date.parse(bundle.checkedAt) });
  requireValue(verificationResult?.trustedRun?.repositoryId === source.repositoryId &&
    verificationResult.trustedRun.workflowPath === VERIFIER_WORKFLOW_PATH);
  const recorded = { ...verificationResult, trustedRun: { ...verificationResult.trustedRun } };
  if (recorded.trustedRun.actionPins !== undefined) requireValue(canonicalJson(recorded.trustedRun.actionPins) === canonicalJson(trustedPolicy.actions));
  if (recorded.trustedRun.evaluatorDigest !== undefined) requireValue(recorded.trustedRun.evaluatorDigest === verificationInput.trusted.evaluatorDigest);
  // These four fields are added by the existing CLI after the evaluator result.
  for (const name of ['repositoryId', 'workflowPath', 'actionPins', 'evaluatorDigest']) delete recorded.trustedRun[name];
  requireValue(canonicalJson(recorded) === canonicalJson(derived));
  const derivedBundle = buildPublisherResult({ result: verificationResult, repository: source.repository, repositoryId: source.repositoryId, evidenceDigest });
  requireValue(canonicalJson(derivedBundle) === canonicalJson(bundle));
}

function assertObservedPublisherCheck(check, snapshot, expectedPublisherAppId) {
  const externalId = buildExternalId(snapshot.bundle, snapshot.publisher);
  const payload = checkPayload(snapshot.bundle, externalId, snapshot.publisher);
  requireValue(check && Number.isSafeInteger(check.id) && check.id > 0 &&
    check.app?.id === expectedPublisherAppId && check.name === REQUIRED_CHECK_NAME &&
    check.head_sha === snapshot.bundle.candidate.headSha && check.external_id === externalId &&
    check.status === 'completed' && check.conclusion === 'failure' &&
    check.details_url === payload.details_url && check.output?.title === payload.output.title &&
    check.output.summary === payload.output.summary);
}

// Adapter observations can come from authenticated reads or isolated fixtures.
// This inspector does not attest their transport, issue a grant/token, mutate a
// check, or perform a merge. Valid inspection still has no admission authority.
export async function inspectFinalAdmission({ verificationInput, verificationResult, bundle, source, evidenceDigest,
  publisher, expectedPublisherAppId, adapter } = {}) {
  let phase = 'INSPECTION_CONFIGURATION';
  try {
    requireValue(Number.isSafeInteger(expectedPublisherAppId) && expectedPublisherAppId > 0 && expectedPublisherAppId !== 15368);
    requireValue(adapter?.apiUrl === 'https://api.github.com' &&
      ['assertPullRequest', 'assertIssue122', 'assertIssue135', 'getDecisionComment', 'getPublisherCheck'].every((name) => typeof adapter[name] === 'function'));
    phase = 'EVIDENCE_RECONSTRUCTION';
    // Fix the caller's data before crossing an async boundary. Only the adapter
    // supplies new observations; mutable input references cannot substitute it.
    const snapshot = structuredClone({ verificationInput, verificationResult, bundle, source, evidenceDigest, publisher });
    reconstructEvidence(snapshot);
    phase = 'CONTINUING_ELIGIBILITY';
    await evaluateContinuingEligibility({ ...snapshot, adapter });
    phase = 'PUBLISHER_CHECK';
    const check = structuredClone(await adapter.getPublisherCheck(snapshot.bundle.candidate.headSha));
    assertObservedPublisherCheck(check, snapshot, expectedPublisherAppId);
    phase = 'FINAL_OBSERVATION';
    await evaluateContinuingEligibility({ ...snapshot, adapter });
    const inspectionDigest = sha256(canonicalJson({
      schema: 'kirari.r3-final-admission-inspection/v1',
      bundleDigest: sha256(canonicalJson(snapshot.bundle)),
      verificationResultDigest: sha256(canonicalJson(snapshot.verificationResult)),
      expectedPublisherAppId,
      checkRunId: check.id,
      externalId: check.external_id,
      workflowId: snapshot.source.workflowId,
      runId: snapshot.source.runId,
      runAttempt: snapshot.source.runAttempt,
    }));
    return result('VALIDATED_BUT_BLOCKED', 'COMPLETE', { inspectionDigest, observedCheckRunId: check.id });
  } catch {
    // Adapter errors can contain credentials. Report only the failed phase.
    return result('DENIED', phase);
  }
}
