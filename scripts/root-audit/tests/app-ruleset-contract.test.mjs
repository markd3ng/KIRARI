import assert from 'node:assert/strict';
import test from 'node:test';
import app from '../github-app-manifest.json' with { type: 'json' };
import environment from '../publisher-environment-manifest.json' with { type: 'json' };
import proposal from '../ruleset-proposal.json' with { type: 'json' };
import publisherPolicy from '../publisher-policy.json' with { type: 'json' };
import trustedPolicy from '../trusted-policy.json' with { type: 'json' };

// Test-side guards check the planning contract. They are neither an activation
// implementation nor evidence that GitHub's live settings/recovery were tested.
function assertIndependentRecoveryContract(value) {
  assert.equal(value.recovery.requiresPassingPublisherCheck, false,
    'recovery must not depend on the check that prevents the repair merge');
  assert.equal(value.recovery.publisherMayModifyRulesets, false,
    'check writer must not receive ruleset Administration permission');
  assert.match(value.recovery.actor, /markd3ng Owner account with repository administration/,
    'recovery needs independent Owner settings access');
  assert.equal(value.recovery.restorePriorJsonRequired, true);
  assert.equal(value.recovery.freezeMergesDuringRecovery, true);
  assert.equal(value.recovery.separateOwnerAuthorizationRequired, true);
}

function assertNoUnsafeActivationClaim(value) {
  const claimsReady = value.applyReady || value.activationReady
    || value.apiPayloadReady || value.enforcement === 'active';
  if (!claimsReady) return;
  assert.equal(value.continuingFreshness.requiredCheckSuccessEnabled, true,
    'activating a required check with success disabled locks out merges');
  assert.equal(value.continuingFreshness.finalMergeAdmissionReady, true,
    'a periodic invalidation sweep is not final merge admission');
  assert.equal(value.appProvenanceObserved, true,
    'pending App identity is not source provenance');
  assert.ok(Number.isSafeInteger(value.requiredStatusChecks[0].expectedIntegrationId)
    && value.requiredStatusChecks[0].expectedIntegrationId > 0
    && value.requiredStatusChecks[0].expectedIntegrationId !== 15368,
  'activation needs the real dedicated App integration ID');
  assert.equal(value.continuingDecisionFreshnessEnforcementReady, true);
  assert.equal(value.recovery.ownerManagementAccessVerified, true);
  assert.equal(value.recovery.restoreReadbackVerified, true);
  assert.equal(value.recovery.isolatedDemonstrationVerified, true);
  assertIndependentRecoveryContract(value);
}

test('App setup has no webhook/OAuth service and only selected-repository check authority', () => {
  assert.equal(app.kind, 'manual-setup-wrapper-not-github-app-manifest-flow-payload');
  assert.equal(app.registration.manifestFlowUsed, false);
  assert.equal(app.application.owner, 'markd3ng');
  assert.ok(app.application.name.length <= 34);
  assert.equal(app.application.visibility, 'private-only-on-owner-account');
  assert.equal(app.application.repositorySelection, 'selected');
  assert.deepEqual(app.application.installationRepositories, ['markd3ng/KIRARI']);
  assert.equal(app.application.webhookActive, false);
  assert.deepEqual(app.application.webhookEvents, []);
  assert.deepEqual(app.application.callbackUrls, []);
  assert.equal(app.application.requestUserAuthorization, false);
  assert.equal(app.application.deviceFlow, false);
  assert.equal(app.application.setupUrl, null);
  assert.deepEqual(app.permissions, { checks: 'write', metadata: 'read', additional: {} });
  assert.deepEqual(publisherPolicy.requiredCheckSource.permissions, { checks: 'write', metadata: 'read' });
});

test('persistent key never substitutes for candidate credentials or a PAT trust root', () => {
  assert.equal(app.credential.privateKey, 'NOT_CREATED');
  assert.equal(app.credential.persistentKeyExpiresAutomatically, false);
  assert.equal(app.credential.environmentStorageReady, false);
  assert.equal(app.credential.candidateAccessible, false);
  assert.equal(app.credential.repositoryOrOrganizationSecretAllowed, false);
  assert.equal(app.credential.personalAccessTokenTrustRootAllowed, false);
  assert.deepEqual(app.credential.tokenRepositoryScope, ['KIRARI']);
  assert.deepEqual(app.credential.tokenPermissions, { checks: 'write' });
  assert.equal(app.credential.installationTokenMaximumLifetimeSeconds, 3600);
  assert.equal(app.credential.revokeTokenAtJobEnd, true);
  assert.equal(app.credential.maskTokensAndNeverPersist, true);
  assert.match(app.credential.bootstrapStorage, /Owner-controlled.*outside repository/);
  assert.ok(Object.values(publisherPolicy.githubTokenPermissions).every((level) => level === 'read'));
});

test('App, Environment and exact-source required check retain unknown live identity', () => {
  assert.equal(app.applyReady, false);
  assert.equal(app.liveAppCreated, false);
  assert.equal(app.liveInstallationCreated, false);
  assert.equal(app.identityReadback.verified, false);
  assert.equal(app.application.appId, 'PENDING_OWNER_SETUP');
  assert.equal(app.application.installationId, 'PENDING_OWNER_SETUP');
  assert.equal(app.application.slug, 'PENDING_OWNER_SETUP');
  assert.deepEqual(proposal.requiredStatusChecks, [{
    context: publisherPolicy.requiredCheckName,
    expectedIntegrationId: app.application.appId,
    source: 'DEDICATED_GITHUB_APP',
  }]);
  assert.equal(environment.variables[0].name, 'KIRARI_R3_PUBLISHER_APP_ID');
  assert.equal(environment.variables[0].value, app.application.appId);
  assert.equal(app.isolatedTestPrerequisites.trustedImplementationEstablished, false);
  assert.equal(app.isolatedTestPrerequisites.ownerSetupApproved, false);
  assert.equal(app.isolatedTestPrerequisites.realAppIdentityObserved, false);
  assert.equal(app.isolatedTestPrerequisites.enforcingMainRulesetAllowed, false);
  assert.equal(app.isolatedTestPrerequisites.productionAppInstallationMayExpandForTests, false);
  assert.equal(app.isolatedTestPrerequisites.separateTestAppRequiredForIsolatedRepository, true);
});

test('Environment main-only ref policy is not claimed to isolate upstream candidate jobs', () => {
  assert.equal(environment.applyReady, false);
  assert.equal(environment.isolatedSetupReady, false);
  assert.equal(environment.liveEnvironmentCreated, false);
  assert.equal(environment.liveSecretCreated, false);
  assert.equal(environment.repositoryOptIn.name, 'KIRARI_R3_PUBLISHER_ENABLED');
  assert.equal(environment.repositoryOptIn.scope, 'repository-variable-not-secret');
  assert.equal(environment.repositoryOptIn.defaultValue, 'false');
  assert.equal(environment.repositoryOptIn.enableReady, false);
  assert.deepEqual(environment.branchPolicy.allowedBranches, ['main']);
  assert.deepEqual(environment.branchPolicy.allowedTags, []);
  assert.equal(environment.branchPolicy.type, 'selected_branches');
  assert.equal(environment.branchPolicy.protectedBranchesOnly, false);
  assert.equal(environment.branchPolicy.pullRequestRefsAllowed, false);
  assert.equal(environment.branchPolicy.administratorBypass, false);
  assert.deepEqual(environment.protectionRules.requiredReviewers, []);
  assert.equal(environment.protectionRules.requiredApprovals, 0);
  assert.equal(environment.protectionRules.administratorBypass, false);
  assert.equal(environment.workflowJob.branchPolicyAloneIsCredentialIsolation, false);
  assert.equal(environment.custody.privateKeyMayEnterCandidateJob, false);
  assert.equal(environment.custody.privateKeyMayEnterRepositoryOrOrganizationSecret, false);
  assert.equal(environment.custody.candidateDenialLiveVerified, false);
  assert.equal(environment.secrets.length, 1);
  assert.equal(environment.secrets[0].name, 'KIRARI_R3_PUBLISHER_PRIVATE_KEY');
  assert.equal(environment.secrets[0].value, 'NOT_CREATED');
  assert.equal(environment.revocationJob.path, publisherPolicy.continuingAuthorization.revocationWorkflowPath);
  assert.equal(environment.revocationJob.preflightBeforeEnvironment, true);
  assert.equal(environment.revocationJob.mayRenewSuccess, false);
  assert.equal(environment.revocationJob.continuingAuthorizationGuarantee, false);
  assert.deepEqual(environment.revocationJob.appTokenPermissions, { checks: 'write' });
  assert.ok(environment.secretSetupPrerequisites.includes(
    'the exact ruleset has been separately authorized, applied, and authenticated-read back'));
  assert.ok(environment.secretSetupPrerequisites.some((value) => value.includes('final merge admission')));
});

test('future main policy binds only the dedicated source, current base and zero-approval path gate', () => {
  assert.equal(proposal.kind, 'planning-wrapper-not-github-api-payload');
  assert.equal(proposal.target, 'refs/heads/main');
  assert.equal(proposal.enforcement, 'disabled');
  assert.equal(proposal.desiredEnforcementAfterSeparateApproval, 'active');
  assert.equal(proposal.requirePullRequest, true);
  assert.equal(proposal.requiredApprovals, 0);
  assert.equal(proposal.dismissStaleApprovals, true);
  assert.equal(proposal.requireCodeOwnerReview, false);
  assert.equal(proposal.requireLastPushApproval, false);
  assert.deepEqual(proposal.allowedMergeMethods, ['merge', 'squash', 'rebase']);
  assert.equal(proposal.requireUpToDateBranch, true);
  assert.equal(proposal.blockForcePush, true);
  assert.equal(proposal.protectDeletion, true);
  assert.deepEqual(proposal.bypassActors, []);
  assert.equal(proposal.mergeQueueEnabled, false);
  assert.equal(proposal.autoMergeEnabled, false);
  assert.deepEqual(proposal.requiredStatusCheckAdditionalGate.protectedPaths, trustedPolicy.trustedRootPaths);
  assert.equal(proposal.requiredStatusCheckAdditionalGate.ordinaryCheckMayAuthorizeTrustedRootChanges, false);
});

test('freshness and App outages never become apply-ready by a schedule or strict branch alone', () => {
  assert.equal(proposal.continuingFreshness.nativeCheckExpirySupported, false);
  assert.equal(proposal.continuingFreshness.strictStatusChecksExpireAuthorization, false);
  assert.equal(proposal.continuingFreshness.requiredCheckSuccessEnabled, false);
  assert.equal(proposal.continuingFreshness.requiredCheckSuccessEnabled,
    publisherPolicy.continuingAuthorization.requiredCheckSuccessEnabled);
  assert.deepEqual(publisherPolicy.checkConclusions, ['failure']);
  assert.equal(proposal.continuingFreshness.finalMergeAdmissionReady, false);
  assert.equal(proposal.continuingFreshness.invalidation, 'best-effort-revocation-only');
  assert.equal(proposal.continuingFreshness.invalidationMayRenewSuccess, false);
  assert.equal(proposal.continuingFreshness.cachedSuccessDuringAppOutageIsAutomaticallyInvalidated, false);
  assert.equal(proposal.continuingDecisionFreshnessEnforcementReady, false);
  assert.equal(proposal.activationReady, false);
  assert.equal(proposal.applyReady, false);
  assert.equal(proposal.apiPayloadReady, false);
  assert.equal(proposal.apiPayload, null);
  assert.equal(proposal.applied, false);
  assert.equal(proposal.mainProtected, false);
  assert.equal(proposal.appProvenanceObserved, false);
  assert.ok(proposal.activationBlockers.includes('REQUIRED_CHECK_SUCCESS_DISABLED_TO_AVOID_CACHED_AUTHORIZATION'));
  assertNoUnsafeActivationClaim(proposal);
  for (const key of ['applyReady', 'activationReady', 'apiPayloadReady', 'enforcement']) {
    const unsafe = structuredClone(proposal);
    unsafe[key] = key === 'enforcement' ? 'active' : true;
    assert.throws(() => assertNoUnsafeActivationClaim(unsafe), /success disabled locks out merges/);
  }
});

test('case 17 rejects recovery dependent on an unavailable check or the check-only App', () => {
  assertIndependentRecoveryContract(proposal);
  assert.equal(proposal.recovery.activationMustRejectDependentRecovery, true);
  const circular = structuredClone(proposal);
  circular.recovery.requiresPassingPublisherCheck = true;
  assert.throws(() => assertIndependentRecoveryContract(circular), /check that prevents the repair merge/);
  const appAdministration = structuredClone(proposal);
  appAdministration.recovery.publisherMayModifyRulesets = true;
  assert.throws(() => assertIndependentRecoveryContract(appAdministration), /Administration permission/);
  const appOnly = structuredClone(proposal);
  appOnly.recovery.actor = 'publisher installation token';
  assert.throws(() => assertIndependentRecoveryContract(appOnly), /independent Owner settings access/);
  const missingRestore = structuredClone(proposal);
  missingRestore.recovery.restorePriorJsonRequired = false;
  assert.throws(() => assertIndependentRecoveryContract(missingRestore));
});

test('case 17 does not treat the static recovery contract as a live restore demonstration', () => {
  assert.equal(proposal.recovery.ownerManagementAccessVerified, false);
  assert.equal(proposal.recovery.restoreReadbackVerified, false);
  assert.equal(proposal.recovery.isolatedDemonstrationVerified, false);
  assert.equal(proposal.recovery.liveDemonstration, 'NOT_RUN_NO_APP_OR_APPROVED_TEST_TARGET');
  // A hypothetical future passing check and real App identity still cannot
  // justify activation without independent recovery and restoration evidence.
  const unverifiedRecovery = structuredClone(proposal);
  unverifiedRecovery.applyReady = true;
  unverifiedRecovery.continuingFreshness.requiredCheckSuccessEnabled = true;
  unverifiedRecovery.continuingFreshness.finalMergeAdmissionReady = true;
  unverifiedRecovery.appProvenanceObserved = true;
  unverifiedRecovery.requiredStatusChecks[0].expectedIntegrationId = 987654;
  unverifiedRecovery.continuingDecisionFreshnessEnforcementReady = true;
  assert.throws(() => assertNoUnsafeActivationClaim(unverifiedRecovery));
});
