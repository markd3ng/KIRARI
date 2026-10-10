import { REQUIRED_CHECK_NAME } from './publisher-contract.mjs';
import { requireLab } from './live-harness-contract.mjs';

// Preparation only: this module has no HTTP, secret or mutation capability.
export function prepareDisabledProductionRuleset(proposedAppId = null) {
  requireLab(proposedAppId === null || (Number.isSafeInteger(proposedAppId) && proposedAppId > 0 && proposedAppId != 15368), 'DEDICATED_NUMERIC_APP_ID_REQUIRED');
  const payload = { name: 'KIRARI R3 trusted admission (disabled proposal)', target: 'branch', enforcement: 'disabled', bypass_actors: [],
    conditions: { ref_name: { include: ['refs/heads/main'], exclude: [] } }, rules: [
      { type: 'pull_request', parameters: { required_approving_review_count: 0, dismiss_stale_reviews_on_push: true,
        require_code_owner_review: false, require_last_push_approval: false, required_review_thread_resolution: false,
        allowed_merge_methods: ['merge', 'squash', 'rebase'] } },
      { type: 'required_status_checks', parameters: { required_status_checks: [{ context: REQUIRED_CHECK_NAME,
        integration_id: proposedAppId ?? 'PENDING_OWNER_VERIFIED_PRODUCTION_APP_ID' }], strict_required_status_checks_policy: true, do_not_enforce_on_create: false } },
      { type: 'non_fast_forward' }, { type: 'deletion' },
    ] };
  return { schema: 'kirari.disabled-production-ruleset-preparation/v1', repository: 'markd3ng/KIRARI',
    applyReady: false, activationReady: false, finalAdmissionReady: false, nativeCheckExpirySupported: false,
    requiredCheckSuccessAllowed: false, appIdentityVerified: false, requiresRealAppReceipt: true, proposedAppId, template: payload, apiPayload: proposedAppId === null ? null : payload,
    blockers: ['REAL_PRODUCTION_APP_IDENTITY_AND_CUSTODY_VERIFICATION', 'REAL_LAB_PROVENANCE_AND_RECOVERY_EVIDENCE',
      'SUPPORTED_ATOMIC_CONTINUING_AUTHORIZATION_ADMISSION', 'EXACT_SOURCE_INDEPENDENT_REVIEWS', 'SEPARATE_OWNER_ACTIVATION_DECISION'] };
}
