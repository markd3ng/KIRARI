import { LAB_CASES, LabError, requireLab, labDecision } from './live-harness-contract.mjs';
import { mintLabAppToken, revokeLabToken } from './live-harness-api.mjs';

const requireAuthorization = (value, expected) => {
  requireLab(value.authorization === expected && value.mergeAdmission === 'BLOCKED' && value.requiredCheckSuccessAllowed === false, 'LAB_ELIGIBILITY_ASSERTION_FAILED');
};
const requireNative = (value, accepted) => requireLab(value.accepted === accepted, 'LAB_NATIVE_EXPECTATION_NOT_OBSERVED');
const requireDenialReason = (value, reason) => {
  requireAuthorization(value, 'DENIED');
  requireLab(value.reason === reason, 'LAB_DENIAL_REASON_UNEXPECTED');
};
async function oldGreen(session, fixture, app) {
  const checks = await session.listChecks(fixture, app);
  requireLab(checks.some((check) => check.appId === app.appId && check.conclusion === 'success'), 'LAB_OLD_GREEN_NOT_OBSERVED');
  return checks;
}

export async function executeLabCases(session, { primary, wrong, primaryPem, sleep, progress = () => {} }) {
  const cases = [];
  async function run(index, expected, operation) {
    const record = { id: index + 1, name: LAB_CASES[index], expected,
      isolationLevel: session.transport.testTransport ? 'HTTP_INTEGRATION_FAKE_GITHUB' : 'REAL_DISPOSABLE_GITHUB_LAB',
      liveGitHubVerified: false, assertionResult: 'FAIL' };
    try { record.observed = await operation(session.fixtures[index]); record.assertionResult = 'PASS'; record.liveGitHubVerified = session.transport.realTransport === true; }
    catch (error) { record.observed = { code: error instanceof LabError ? error.code : 'LAB_UNEXPECTED_FAILURE', ...(Number.isInteger(error?.status) && error.status >= 100 && error.status <= 599 ? { httpStatus: error.status } : {}) }; }
    cases.push(record); progress({ case: record.id, name: record.name, assertionResult: record.assertionResult });
  }
  await run(0, { labEligibility: 'VALIDATED', productionMergeAdmission: 'BLOCKED', nativeLabMerge: 'ACCEPTED' }, async (fixture) => {
    await session.selectDecision(fixture);
    const publication = await session.publishEligibleFixture(fixture, primary);
    requireAuthorization(publication.eligibility, 'VALIDATED');
    const native = await session.nativeMerge(fixture); requireNative(native, true);
    return { ...publication, native, productionGrant: false };
  });
  await run(1, { labEligibility: 'DENIED', nativeLabMerge: 'REJECTED' }, async (fixture) => {
    await session.selectDecision(fixture, { expiresAt: session.now() - 1 });
    const eligibility = await session.inspect(fixture); requireDenialReason(eligibility, 'LAB_DECISION_EXPIRED');
    const native = await session.nativeMerge(fixture); requireNative(native, false);
    return { eligibility, native, successPublished: false };
  });
  await run(2, { labEligibilityAfterRevocation: 'DENIED', nativeOldGreen: 'MAY_REMAIN_ADMISSIBLE', gate: 'NOT_READY' }, async (fixture) => {
    await session.selectDecision(fixture); await session.publishEligibleFixture(fixture, primary);
    await session.editDecision(fixture, { action: 'REVOKE_LAB_FIXTURE' });
    const eligibility = await session.inspect(fixture); requireDenialReason(eligibility, 'LAB_DECISION_CHANGED_OR_REVOKED');
    const checks = await oldGreen(session, fixture, primary);
    const native = await session.nativeMerge(fixture); requireNative(native, true);
    return { eligibility, checks, native, limitationProved: 'NATIVE_CHECK_DOES_NOT_REEVALUATE_REVOCATION', gate: 'NOT_READY' };
  });
  await run(3, { headMutation: 'DENIED', baseMutation: 'DENIED', nativeLabMerge: 'REJECTED' }, async (fixture) => {
    await session.selectDecision(fixture);
    const mutation = await session.mutateHeadAndBase(fixture);
    const eligibility = await session.inspect(fixture); requireAuthorization(eligibility, 'DENIED');
    requireLab(eligibility.reason === 'LAB_HEAD_OR_BASE_CHANGED', 'LAB_MUTATION_REASON_UNEXPECTED');
    const native = await session.nativeMerge(fixture); requireNative(native, false);
    return { mutation, eligibility, native, successPublished: false };
  });
  await run(4, { missingCredential: 'FAIL_CLOSED_BEFORE_APP_HTTP', nativeLabMerge: 'REJECTED' }, async (fixture) => {
    await session.selectDecision(fixture); let missing;
    try { await mintLabAppToken(session.transport, session.config.app, undefined, session.now()); }
    catch (error) { missing = error.code; }
    requireLab(missing === 'LAB_APP_CREDENTIAL_MISSING', 'LAB_MISSING_APP_CREDENTIAL_NOT_REJECTED');
    const native = await session.nativeMerge(fixture); requireNative(native, false);
    return { missing, native, successPublished: false };
  });
  await run(5, { configuredAppIdentityMismatch: 'DENIED', realWrongAppGreen: 'REJECTED_BY_NATIVE_INTEGRATION_ID' }, async (fixture) => {
    let mismatch;
    try { await mintLabAppToken(session.transport, { ...session.config.app, id: wrong.appId }, primaryPem, session.now()); }
    catch (error) { mismatch = error.code; }
    requireLab(mismatch === 'LAB_APP_IDENTITY_MISMATCH', 'LAB_WRONG_APP_IDENTITY_NOT_REJECTED');
    await session.selectDecision(fixture);
    const publication = await session.publishEligibleFixture(fixture, wrong);
    requireLab(publication.check.appId !== primary.appId, 'LAB_REAL_WRONG_PUBLISHER_MISSING');
    const native = await session.nativeMerge(fixture); requireNative(native, false);
    return { mismatch, wrongAppCheck: publication.check, requiredAppId: primary.appId, native };
  });
  await run(6, { replayedDecision: 'DENIED', nativeLabMerge: 'REJECTED' }, async (fixture) => {
    const original = session.fixtures[0];
    await session.selectDecision(fixture, { decision: labDecision(session.config, original, session.now(), session.now() + 600000) });
    const eligibility = await session.inspect(fixture); requireAuthorization(eligibility, 'DENIED');
    requireLab(eligibility.reason === 'LAB_DECISION_REPLAY_OR_BINDING_MISMATCH', 'LAB_REPLAY_REASON_UNEXPECTED');
    const native = await session.nativeMerge(fixture); requireNative(native, false);
    return { eligibility, native, successPublished: false };
  });
  await run(7, { initiallyValid: 'VALIDATED', afterRealExpiry: 'DENIED', nativeOldGreen: 'MAY_REMAIN_ADMISSIBLE', gate: 'NOT_READY' }, async (fixture) => {
    const expiresAt = session.now() + (session.config.staleAfterSeconds ?? 10) * 1000;
    await session.selectDecision(fixture, { expiresAt }); await session.publishEligibleFixture(fixture, primary);
    for (let attempt = 0; session.now() <= expiresAt && attempt < 50; attempt += 1) await sleep(Math.min(1000, expiresAt - session.now() + 1));
    requireLab(session.now() > expiresAt, 'LAB_REAL_EXPIRY_NOT_REACHED');
    const eligibility = await session.inspect(fixture); requireDenialReason(eligibility, 'LAB_DECISION_EXPIRED');
    const checks = await oldGreen(session, fixture, primary);
    const native = await session.nativeMerge(fixture); requireNative(native, true);
    return { expiresAt: new Date(expiresAt).toISOString(), observedAt: new Date(session.now()).toISOString(), eligibility, checks, native,
      limitationProved: 'NATIVE_CHECK_SUCCESS_HAS_NO_AUTHORIZATION_EXPIRY', gate: 'NOT_READY' };
  });
  await run(8, { injectedClientApiFailure: 'DENIED', nativeOldGreen: 'MAY_REMAIN_ADMISSIBLE', gate: 'NOT_READY' }, async (fixture) => {
    await session.selectDecision(fixture); await session.publishEligibleFixture(fixture, primary);
    const clear = session.transport.injectFault('owner', 'GET', `${session.root}/pulls/${fixture.number}`);
    let eligibility;
    try { eligibility = await session.inspect(fixture); } finally { clear(); }
    requireDenialReason(eligibility, 'LAB_API_UNAVAILABLE_OR_MALFORMED');
    requireLab(eligibility.failureCode === 'LAB_INJECTED_GITHUB_API_OUTAGE', 'LAB_OUTAGE_CAUSE_UNEXPECTED');
    const checks = await oldGreen(session, fixture, primary);
    const native = await session.nativeMerge(fixture); requireNative(native, true);
    return { injection: 'LOCAL_CLIENT_TRANSPORT_503_NOT_ACTUAL_GITHUB_SERVICE_OUTAGE', eligibility, checks, native,
      limitationProved: 'CLIENT_API_OUTAGE_DOES_NOT_INVALIDATE_NATIVE_GREEN', gate: 'NOT_READY' };
  });
  await run(9, { revokedPublisherToken: 'WRITE_REJECTED_401', nativeOldGreen: 'MAY_REMAIN_ADMISSIBLE', gate: 'NOT_READY' }, async (fixture) => {
    await session.selectDecision(fixture); const published = await session.publishEligibleFixture(fixture, primary);
    const outage = await mintLabAppToken(session.transport, session.config.app, primaryPem, session.now()); session.tokens.push(outage);
    await revokeLabToken(session.transport, outage); outage.revoked = true;
    const failedWrite = await session.transport.request('publisher', outage.token, 'PATCH', `${session.root}/check-runs/${published.check.id}`,
      { status: 'completed', conclusion: 'failure' }, [401]);
    requireLab(failedWrite.status === 401, 'LAB_PUBLISHER_OUTAGE_NOT_OBSERVED');
    const checks = await oldGreen(session, fixture, primary);
    const native = await session.nativeMerge(fixture); requireNative(native, true);
    return { injection: 'REAL_TOKEN_REVOCATION_SIMULATES_PUBLISHER_CREDENTIAL_OUTAGE', publisherHttpStatus: failedWrite.status, checks, native,
      limitationProved: 'UNAVAILABLE_PUBLISHER_CANNOT_REVOKE_OLD_GREEN', gate: 'NOT_READY' };
  });
  await run(10, { initialNativeMerge: 'REJECTED', independentOwnerDisable: 'WORKS_WITHOUT_REQUIRED_CHECK', fullRestore: 'VERIFIED' }, async (fixture) => {
    await session.selectDecision(fixture);
    const rejected = await session.nativeMerge(fixture); requireNative(rejected, false);
    const recovery = await session.recover(fixture, true); requireNative(recovery.nativeWhileDisabled, true);
    return { rejected, recovery, emergencyLabMergePurpose: 'RECOVERY_TEST_ONLY', productionGrant: false };
  });
  await run(11, { failedCheckMerge: 'REJECTED', independentOwnerRecovery: 'NO_CHECK_DEPENDENCY', restoredNativeMerge: 'REJECTED' }, async (fixture) => {
    await session.selectDecision(fixture); const failedCheck = await session.writeCheck(fixture, primary, 'failure');
    const rejected = await session.nativeMerge(fixture); requireNative(rejected, false);
    const recovery = await session.recover(fixture);
    const afterRestore = await session.nativeMerge(fixture); requireNative(afterRestore, false);
    return { failedCheck, rejected, recovery, afterRestore, administratorLockoutPrevented: true, approvalsRequired: 0, bypassActors: 0 };
  });
  return cases;
}
