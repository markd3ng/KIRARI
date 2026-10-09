import { createHash } from 'node:crypto';

export const LAB_SCHEMA = 'kirari.disposable-live-lab/v1';
export const LAB_CHECK_NAME = 'KIRARI nonproduction admission fixture';
export const LAB_DECISION_HEADER = 'KIRARI_NONPRODUCTION_LAB_DECISION_V1';
export const LAB_CASES = ['valid-decision', 'expired-decision', 'revoked-decision', 'head-base-mutation',
  'missing-app-credentials', 'incorrect-app-identity', 'replay', 'stale-successful-check',
  'github-api-outage', 'publisher-outage', 'recovery-after-failure', 'administrator-lockout-prevention'];

export class LabError extends Error {
  constructor(code, status) { super(code); this.name = 'LabError'; this.code = code; this.status = status; }
}
export function requireLab(condition, code) { if (!condition) throw new LabError(code); }
export const digest = (value) => createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
export const isSha = (value) => typeof value === 'string' && /^[a-f0-9]{40}$/.test(value);
const positiveId = (value) => Number.isSafeInteger(value) && value > 0;

// This runs before any key read, token access or HTTP request. A generic repo name is insufficient consent.
export function validateLabConfig(input) {
  requireLab(input && input.schema === LAB_SCHEMA && input.ownerAuthorized === true && input.disposable === true, 'LAB_EXPLICIT_AUTHORIZATION_REQUIRED');
  requireLab(typeof input.repository === 'string' && /^[A-Za-z0-9][A-Za-z0-9-]*\/kirari-r3-disposable-lab-[a-z0-9-]+$/.test(input.repository), 'LAB_DEDICATED_REPOSITORY_REQUIRED');
  requireLab(input.repository.toLowerCase() !== 'markd3ng/kirari', 'PRODUCTION_REPOSITORY_FORBIDDEN');
  requireLab(input.visibility === undefined || ['private', 'public'].includes(input.visibility), 'LAB_VISIBILITY_INVALID');
  requireLab(positiveId(input.repositoryId) && positiveId(input.ownerId), 'LAB_NUMERIC_IDENTITY_REQUIRED');
  requireLab(input.repositoryId !== 1156039202, 'PRODUCTION_REPOSITORY_ID_FORBIDDEN');
  const owner = input.repository.split('/')[0];
  requireLab(typeof input.ownerLogin === 'string' && owner === input.ownerLogin, 'LAB_OWNER_MISMATCH');
  requireLab(typeof input.runId === 'string' && /^[a-f0-9]{16}$/.test(input.runId), 'LAB_UNIQUE_RUN_ID_REQUIRED');
  for (const app of [input.app, input.wrongApp]) {
    requireLab(app && positiveId(app.id) && positiveId(app.installationId) && typeof app.clientId === 'string' && /^[A-Za-z0-9._-]{8,100}$/.test(app.clientId), 'LAB_TWO_REAL_APP_IDENTITIES_REQUIRED');
  }
  requireLab(input.app.id !== input.wrongApp.id && input.app.installationId !== input.wrongApp.installationId, 'LAB_DISTINCT_APP_IDENTITIES_REQUIRED');
  requireLab(input.staleAfterSeconds === undefined || (Number.isInteger(input.staleAfterSeconds) && input.staleAfterSeconds >= 10 && input.staleAfterSeconds <= 45), 'LAB_EXPIRY_WINDOW_INVALID');
  return { ...structuredClone(input), visibility: input.visibility ?? 'private' };
}

export function labBranch(config, index, role) {
  requireLab(Number.isInteger(index) && index >= 0 && index < LAB_CASES.length && ['base', 'head'].includes(role), 'LAB_BRANCH_INVALID');
  return `kirari-live-${config.runId}-${String(index + 1).padStart(2, '0')}-${role}`;
}
export function assertLabBranch(config, branch, defaultBranch) {
  requireLab(typeof branch === 'string' && LAB_CASES.some((_, i) => ['base', 'head'].some((role) => branch === labBranch(config, i, role))), 'LAB_BRANCH_NOT_OWNED');
  requireLab(!['main', 'master', defaultBranch].includes(branch), 'LAB_DEFAULT_BRANCH_FORBIDDEN');
}

export function assertLabRepository(config, repo, user) {
  requireLab(repo?.id === config.repositoryId && repo.full_name === config.repository && repo.private === (config.visibility !== 'public') && repo.fork === false && repo.archived === false, 'LAB_REPOSITORY_IDENTITY_UNSAFE');
  requireLab(repo.owner?.id === config.ownerId && repo.owner?.login === config.ownerLogin && repo.owner?.type === 'User', 'LAB_OWNER_IDENTITY_UNSAFE');
  requireLab(user?.id === config.ownerId && user.login === config.ownerLogin && repo.permissions?.admin === true, 'LAB_INDEPENDENT_OWNER_ADMIN_REQUIRED');
  requireLab(typeof repo.default_branch === 'string' && repo.allow_merge_commit === true, 'LAB_DEFAULT_BRANCH_OR_MERGE_UNAVAILABLE');
  for (let i = 0; i < LAB_CASES.length; i += 1) assertLabBranch(config, labBranch(config, i, 'base'), repo.default_branch);
}

export function assertMinimalAppPermissions(permissions) {
  requireLab(permissions && Object.keys(permissions).sort().join(',') === 'checks,metadata' && permissions.checks === 'write' && permissions.metadata === 'read', 'LAB_APP_PERMISSIONS_EXCESSIVE_OR_MISSING');
}
export function labRulesetPayload(config, enforcement = 'disabled') {
  validateLabConfig(config);
  requireLab(['disabled', 'active'].includes(enforcement), 'LAB_RULESET_ENFORCEMENT_INVALID');
  return { name: `KIRARI disposable live lab ${config.runId}`, target: 'branch', enforcement, bypass_actors: [],
    conditions: { ref_name: { include: LAB_CASES.map((_, i) => `refs/heads/${labBranch(config, i, 'base')}`), exclude: [] } },
    rules: [{ type: 'pull_request', parameters: { required_approving_review_count: 0, dismiss_stale_reviews_on_push: true,
      require_code_owner_review: false, require_last_push_approval: false, required_review_thread_resolution: false, allowed_merge_methods: ['merge'] } },
    { type: 'required_status_checks', parameters: { required_status_checks: [{ context: LAB_CHECK_NAME, integration_id: config.app.id }],
      strict_required_status_checks_policy: true, do_not_enforce_on_create: true } }, { type: 'non_fast_forward' }, { type: 'deletion' }] };
}
export function canonicalRuleset(value) {
  return { name: value?.name, target: value?.target, enforcement: value?.enforcement, bypass_actors: value?.bypass_actors,
    conditions: value?.conditions, rules: value?.rules };
}
const stable = (value) => JSON.stringify(value, (_, item) => item && typeof item === 'object' && !Array.isArray(item)
  ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b))) : item);
export function assertRulesetReadback(value, expected, id) {
  requireLab(Number.isSafeInteger(value?.id) && (id === undefined || value.id === id), 'LAB_RULESET_IDENTITY_CHANGED');
  requireLab(stable(canonicalRuleset(value)) === stable(canonicalRuleset(expected)), 'LAB_RULESET_READBACK_MISMATCH');
}
export function assertEffectiveRules(rules, payload, id) {
  requireLab(Array.isArray(rules), 'LAB_EFFECTIVE_RULES_MALFORMED');
  const own = rules.filter((rule) => rule.ruleset_id === id);
  requireLab(rules.length === own.length, 'LAB_UNEXPECTED_INHERITED_RULES');
  if (payload.enforcement === 'disabled') requireLab(own.length === 0, 'LAB_DISABLED_RULESET_STILL_EFFECTIVE');
  else requireLab(stable(own.map(({ type, parameters }) => ({ type, ...(parameters ? { parameters } : {}) })).sort((a, b) => a.type.localeCompare(b.type))) ===
    stable([...payload.rules].sort((a, b) => a.type.localeCompare(b.type))), 'LAB_EFFECTIVE_RULES_MISMATCH');
}

export function labDecision(config, fixture, now, expiresAt) {
  return { schema: LAB_SCHEMA, purpose: 'NONPRODUCTION_TEST_ONLY_NO_R3_AUTHORITY', action: 'APPROVE_LAB_FIXTURE',
    repository: config.repository, repositoryId: config.repositoryId, runId: config.runId, pr: fixture.number,
    head: fixture.head, base: fixture.base, headRef: fixture.headRef, baseRef: fixture.baseRef,
    evidenceDigest: digest({ repositoryId: config.repositoryId, runId: config.runId, pr: fixture.number, head: fixture.head, base: fixture.base }),
    createdAt: new Date(now).toISOString(), expiresAt: new Date(expiresAt).toISOString() };
}
export const decisionBody = (decision) => `${LAB_DECISION_HEADER}\n${JSON.stringify(decision)}`;
export function inspectLabDecision(config, fixture, selected, livePr, liveBase, comment, now) {
  const denied = (reason) => ({ technicalVerification: 'NOT_VERIFIED', authorization: 'DENIED', mergeAdmission: 'BLOCKED', requiredCheckSuccessAllowed: false, reason });
  if (comment?.id !== selected.id || comment.user?.id !== config.ownerId || comment.user?.login !== config.ownerLogin || digest(comment.body ?? '') !== selected.bodyDigest) return denied('LAB_DECISION_CHANGED_OR_REVOKED');
  let decision;
  try { requireLab(comment.body.startsWith(`${LAB_DECISION_HEADER}\n`), 'LAB_DECISION_FORMAT'); decision = JSON.parse(comment.body.slice(LAB_DECISION_HEADER.length + 1)); } catch { return denied('LAB_DECISION_FORMAT'); }
  if (decision.action !== 'APPROVE_LAB_FIXTURE' || decision.schema !== LAB_SCHEMA || decision.purpose !== 'NONPRODUCTION_TEST_ONLY_NO_R3_AUTHORITY') return denied('LAB_DECISION_REVOKED');
  if (!Number.isFinite(Date.parse(decision.createdAt)) || Date.parse(decision.createdAt) > now || !Number.isFinite(Date.parse(decision.expiresAt)) || Date.parse(decision.expiresAt) <= now) return denied('LAB_DECISION_EXPIRED');
  const expected = labDecision(config, fixture, Date.parse(decision.createdAt), Date.parse(decision.expiresAt));
  if (stable(decision) !== stable(expected)) return denied('LAB_DECISION_REPLAY_OR_BINDING_MISMATCH');
  if (livePr?.number !== fixture.number || livePr.state !== 'open' || livePr.head?.sha !== fixture.head || livePr.base?.sha !== fixture.base ||
      livePr.head?.ref !== fixture.headRef || livePr.base?.ref !== fixture.baseRef || livePr.head?.repo?.id !== config.repositoryId || livePr.base?.repo?.id !== config.repositoryId || liveBase?.object?.sha !== fixture.base) return denied('LAB_HEAD_OR_BASE_CHANGED');
  return { technicalVerification: 'PASS', authorization: 'VALIDATED', mergeAdmission: 'BLOCKED', requiredCheckSuccessAllowed: false,
    reason: 'LAB_TEST_ELIGIBILITY_ONLY_NATIVE_FINAL_ADMISSION_NOT_READY' };
}
