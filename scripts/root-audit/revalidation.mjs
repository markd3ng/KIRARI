import { invalidateSuccessfulChecks, MERGE_ADMISSION_BLOCKED, SHA } from './publisher-contract.mjs';

// GitHub checks have no expiry. This mitigation retires reusable success rather
// than renewing it; it is not an atomic merge gate or an availability guarantee.
export async function revokeCachedSuccesses({ appId, adapter }) {
  if (!Number.isSafeInteger(appId) || appId <= 0) throw new Error('dedicated App ID is not configured');
  const heads = await adapter.listCandidateHeads();
  if (!Array.isArray(heads) || heads.some((head) => !SHA.test(head))) throw new Error('candidate head listing is malformed');
  const result = { headsExamined: 0, successesInvalidated: 0, failures: [], allObservedSuccessesInvalidated: false, requiredCheckSuccessAllowed: false };
  for (const headSha of new Set(heads)) {
    try {
      const checks = await adapter.listChecks(headSha);
      const successes = checks.filter((check) => check.name === 'KIRARI / R3 trusted verifier' && check.head_sha === headSha &&
        check.app?.id === appId && check.status === 'completed' && check.conclusion === 'success');
      await invalidateSuccessfulChecks({ checks, headSha, appId, adapter, reason: MERGE_ADMISSION_BLOCKED });
      // Readback proves this observation only. New writes and API outages cannot
      // be made atomic with a merge by an App with only checks-write permissions.
      const readback = await adapter.listChecks(headSha);
      if (readback.some((check) => check.name === 'KIRARI / R3 trusted verifier' && check.head_sha === headSha &&
          check.app?.id === appId && check.status === 'completed' && check.conclusion === 'success')) {
        throw new Error('dedicated-App success remains or appeared during revocation readback');
      }
      result.successesInvalidated += successes.length;
      result.headsExamined += 1;
    } catch (error) {
      result.failures.push({ headSha, message: error instanceof Error ? error.message : 'revocation failed' });
    }
  }
  result.allObservedSuccessesInvalidated = result.failures.length === 0;
  return result;
}

export async function listCandidateHeadsAcrossPages(getPage, { pageSize = 100, maximumPages = 100 } = {}) {
  const heads = [];
  const seen = new Set();
  for (let page = 1; page <= maximumPages; page += 1) {
    const rows = await getPage(page);
    if (!Array.isArray(rows) || rows.length > pageSize) throw new Error('pull-request listing is malformed');
    for (const row of rows) {
      if (!Number.isSafeInteger(row?.number) || row.number <= 0 || seen.has(row.number) ||
          !SHA.test(row.head?.sha ?? '') || row.base?.ref !== 'main') {
        throw new Error('pull-request listing contains invalid or duplicate candidate identities');
      }
      seen.add(row.number);
      heads.push(row.head.sha);
    }
    if (rows.length < pageSize) return heads;
  }
  throw new Error('pull-request listing exceeds revocation pagination bound');
}
