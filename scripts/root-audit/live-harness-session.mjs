import { LAB_CASES, LAB_CHECK_NAME, LabError, requireLab, isSha, digest, labBranch, assertLabBranch,
  assertLabRepository, labRulesetPayload, assertRulesetReadback, assertEffectiveRules, labDecision, decisionBody, inspectLabDecision } from './live-harness-contract.mjs';

export class LabSession {
  constructor(config, transport, ownerToken, now = Date.now, wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))) {
    this.config = config; this.transport = transport; this.ownerToken = ownerToken; this.now = now; this.wait = wait;
    this.refs = []; this.fixtures = []; this.tokens = []; this.rulesetId = null;
    this.pendingCreations = [];
    this.activePayload = labRulesetPayload(config, 'active'); this.root = transport.root;
  }
  async owner(method, suffix, body, accepted) { return this.transport.request('owner', this.ownerToken, method, suffix === '/user' ? suffix : `${this.root}${suffix}`, body, accepted); }
  async preflight() {
    const [repo, user] = await Promise.all([this.owner('GET', ''), this.owner('GET', '/user')]);
    assertLabRepository(this.config, repo.data, user.data);
    this.defaultBranch = repo.data.default_branch;
    const actions = (await this.owner('GET', '/actions/permissions')).data;
    requireLab(actions?.enabled === false, 'LAB_ACTIONS_MUST_BE_DISABLED');
    const rulesets = (await this.owner('GET', '/rulesets?includes_parents=true&per_page=100')).data;
    requireLab(Array.isArray(rulesets) && rulesets.length === 0, 'LAB_MUST_HAVE_NO_PREEXISTING_RULESETS');
    const ref = (await this.owner('GET', `/git/ref/heads/${encodeURIComponent(this.defaultBranch)}`)).data;
    requireLab(isSha(ref?.object?.sha), 'LAB_SEED_COMMIT_INVALID'); this.seed = ref.object.sha;
    const commit = (await this.owner('GET', `/git/commits/${this.seed}`)).data;
    requireLab(commit?.sha === this.seed && isSha(commit.tree?.sha), 'LAB_SEED_TREE_INVALID'); this.seedTree = commit.tree.sha;
  }
  async commit(index, parent, marker) {
    const blob = (await this.owner('POST', '/git/blobs', { content: JSON.stringify({ schema: 'kirari.lab-fixture/v1', run: this.config.runId, index, marker }), encoding: 'utf-8' })).data;
    requireLab(isSha(blob?.sha), 'LAB_BLOB_RESPONSE_INVALID');
    const tree = (await this.owner('POST', '/git/trees', { base_tree: this.seedTree,
      tree: [{ path: `fixtures/${this.config.runId}/${index}-${marker}.json`, mode: '100644', type: 'blob', sha: blob.sha }] })).data;
    requireLab(isSha(tree?.sha), 'LAB_TREE_RESPONSE_INVALID');
    const commit = (await this.owner('POST', '/git/commits', { message: `KIRARI disposable lab ${this.config.runId} ${index} ${marker}`, tree: tree.sha, parents: [parent] })).data;
    requireLab(isSha(commit?.sha), 'LAB_COMMIT_RESPONSE_INVALID'); return commit.sha;
  }
  async createRef(branch, sha) {
    assertLabBranch(this.config, branch, this.defaultBranch);
    const absent = await this.owner('GET', `/git/ref/heads/${branch}`, undefined, [200, 404]);
    requireLab(absent.status === 404, 'LAB_RUN_REF_ALREADY_EXISTS');
    const pending = { type: 'ref', branch }; this.pendingCreations.push(pending);
    const result = (await this.owner('POST', '/git/refs', { ref: `refs/heads/${branch}`, sha })).data;
    requireLab(result?.ref === `refs/heads/${branch}` && result.object?.sha === sha, 'LAB_CREATED_REF_MISMATCH'); this.refs.push(branch);
    this.pendingCreations.splice(this.pendingCreations.indexOf(pending), 1);
  }
  async setup() {
    for (let i = 0; i < LAB_CASES.length; i += 1) {
      const head = await this.commit(i, this.seed, 'initial');
      const baseRef = labBranch(this.config, i, 'base'); const headRef = labBranch(this.config, i, 'head');
      await this.createRef(baseRef, this.seed); await this.createRef(headRef, head);
      const pending = { type: 'pull-request', headRef, baseRef }; this.pendingCreations.push(pending);
      const pr = (await this.owner('POST', '/pulls', { title: `Disposable KIRARI lab ${this.config.runId}: ${LAB_CASES[i]}`,
        body: 'NONPRODUCTION TEST ONLY. No KIRARI, R3, deployment or production authorization.', base: baseRef, head: headRef, draft: false, maintainer_can_modify: false })).data;
      requireLab(Number.isSafeInteger(pr?.number) && pr.number > 0 && pr.head?.sha === head && pr.base?.sha === this.seed && pr.head.ref === headRef && pr.base.ref === baseRef &&
        pr.head.repo?.id === this.config.repositoryId && pr.base.repo?.id === this.config.repositoryId, 'LAB_CREATED_PR_MISMATCH');
      this.fixtures.push({ number: pr.number, head, base: this.seed, headRef, baseRef, index: i });
      this.pendingCreations.splice(this.pendingCreations.indexOf(pending), 1);
    }
    const disabled = labRulesetPayload(this.config);
    const pending = { type: 'ruleset', name: disabled.name, branches: disabled.conditions.ref_name.include }; this.pendingCreations.push(pending);
    const created = (await this.owner('POST', '/rulesets', disabled)).data;
    assertRulesetReadback(created, disabled); this.rulesetId = created.id;
    this.pendingCreations.splice(this.pendingCreations.indexOf(pending), 1);
    await this.setEnforcement('disabled'); await this.setEnforcement('active');
    for (const fixture of this.fixtures) await this.effective(fixture.baseRef, this.activePayload);
  }
  async effective(branch, payload) {
    assertLabBranch(this.config, branch, this.defaultBranch);
    const rules = (await this.owner('GET', `/rules/branches/${branch}?per_page=100`)).data;
    assertEffectiveRules(rules, payload, this.rulesetId); return rules;
  }
  async setEnforcement(enforcement) {
    requireLab(this.rulesetId !== null, 'LAB_RULESET_NOT_CREATED');
    const payload = labRulesetPayload(this.config, enforcement);
    const result = (await this.owner('PUT', `/rulesets/${this.rulesetId}`, payload)).data;
    assertRulesetReadback(result, payload, this.rulesetId);
    const readback = (await this.owner('GET', `/rulesets/${this.rulesetId}`)).data;
    assertRulesetReadback(readback, payload, this.rulesetId);
    await this.effective(this.fixtures[0].baseRef, payload); return payload;
  }
  async selectDecision(fixture, { expiresAt = this.now() + 600000, decision } = {}) {
    const body = decisionBody(decision ?? labDecision(this.config, fixture, this.now(), expiresAt));
    const comment = (await this.owner('POST', `/issues/${fixture.number}/comments`, { body })).data;
    requireLab(Number.isSafeInteger(comment?.id) && comment.id > 0 && comment.body === body && comment.user?.id === this.config.ownerId, 'LAB_DECISION_RESPONSE_INVALID');
    const selected = { id: comment.id, bodyDigest: digest(body), body };
    fixture.selected = selected; return selected;
  }
  async editDecision(fixture, change) {
    const decision = JSON.parse(fixture.selected.body.split('\n').slice(1).join('\n'));
    Object.assign(decision, change);
    await this.owner('PATCH', `/issues/comments/${fixture.selected.id}`, { body: decisionBody(decision) });
  }
  async inspect(fixture) {
    try {
      const pr = (await this.owner('GET', `/pulls/${fixture.number}`)).data;
      const base = (await this.owner('GET', `/git/ref/heads/${fixture.baseRef}`)).data;
      const comment = (await this.owner('GET', `/issues/comments/${fixture.selected.id}`)).data;
      requireLab(Number.isSafeInteger(pr?.number) && pr.number > 0 && ['open', 'closed'].includes(pr.state) &&
        [pr.head, pr.base].every((ref) => isSha(ref?.sha) && typeof ref.ref === 'string' && ref.ref.length > 0 &&
          Number.isSafeInteger(ref.repo?.id) && ref.repo.id > 0) && isSha(base?.object?.sha) &&
        Number.isSafeInteger(comment?.id) && comment.id > 0 && typeof comment.body === 'string' &&
        Number.isSafeInteger(comment.user?.id) && comment.user.id > 0 && typeof comment.user.login === 'string' && comment.user.login.length > 0,
      'LAB_INSPECTION_RESPONSE_MALFORMED');
      return inspectLabDecision(this.config, fixture, fixture.selected, pr, base, comment, this.now());
    } catch (error) {
      if (!(error instanceof LabError)) throw new LabError('LAB_UNEXPECTED_INSPECTION_FAILURE');
      return { technicalVerification: 'NOT_VERIFIED', authorization: 'DENIED', mergeAdmission: 'BLOCKED', requiredCheckSuccessAllowed: false,
        reason: 'LAB_API_UNAVAILABLE_OR_MALFORMED', failureCode: error.code };
    }
  }
  async writeCheck(fixture, credential, conclusion) {
    requireLab(this.tokens.includes(credential) && ['success', 'failure'].includes(conclusion), 'LAB_CHECK_CREDENTIAL_OR_CONCLUSION_INVALID');
    assertLabBranch(this.config, fixture.headRef, this.defaultBranch);
    const live = (await this.owner('GET', `/pulls/${fixture.number}`)).data;
    requireLab(live.head?.sha === fixture.head && live.head?.ref === fixture.headRef && live.head.repo?.id === this.config.repositoryId && live.base?.ref === fixture.baseRef && live.base.repo?.id === this.config.repositoryId, 'LAB_CHECK_TARGET_CHANGED');
    const check = (await this.transport.request('publisher', credential.token, 'POST', `${this.root}/check-runs`,
      { name: LAB_CHECK_NAME, head_sha: fixture.head, status: 'completed', conclusion, completed_at: new Date(this.now()).toISOString(),
        external_id: `nonproduction:${this.config.runId}:${fixture.number}:${fixture.head}`, output: { title: 'Disposable lab test signal', summary: 'Not a KIRARI/R3 authorization or final admission grant.' } })).data;
    requireLab(Number.isSafeInteger(check?.id) && check.id > 0 && check.app?.id === credential.appId && check.head_sha === fixture.head && check.name === LAB_CHECK_NAME && check.conclusion === conclusion && check.status === 'completed', 'LAB_CHECK_PUBLISHER_READBACK_MISMATCH');
    const readback = (await this.transport.request('publisher', credential.token, 'GET', `${this.root}/check-runs/${check.id}`)).data;
    requireLab(readback?.id === check.id && readback.app?.id === credential.appId && readback.head_sha === fixture.head && readback.name === LAB_CHECK_NAME && readback.conclusion === conclusion && readback.status === 'completed', 'LAB_CHECK_PUBLISHER_READBACK_MISMATCH');
    return { id: check.id, appId: check.app.id, head: check.head_sha, conclusion: check.conclusion };
  }
  async publishEligibleFixture(fixture, credential) {
    const eligibility = await this.inspect(fixture);
    requireLab(eligibility.authorization === 'VALIDATED', 'LAB_AUTHORIZATION_DENIED');
    const check = await this.writeCheck(fixture, credential, 'success');
    return { eligibility, check, purpose: 'NATIVE_RULESET_TEST_ONLY' };
  }
  async listChecks(fixture, credential) {
    const result = (await this.transport.request('publisher', credential.token, 'GET', `${this.root}/commits/${fixture.head}/check-runs?check_name=${encodeURIComponent(LAB_CHECK_NAME)}&filter=all&per_page=100`)).data;
    requireLab(Number.isInteger(result?.total_count) && result.total_count === result.check_runs?.length && result.total_count < 100, 'LAB_CHECK_LIST_INCOMPLETE');
    return result.check_runs.map((check) => { requireLab(check.head_sha === fixture.head && check.name === LAB_CHECK_NAME && Number.isSafeInteger(check.app?.id), 'LAB_CHECK_LIST_IDENTITY_INVALID');
      return { id: check.id, appId: check.app.id, conclusion: check.conclusion, head: check.head_sha }; });
  }
  async nativeMerge(fixture) {
    let before;
    for (let attempt = 0; attempt < 15; attempt += 1) {
      before = (await this.owner('GET', `/pulls/${fixture.number}`)).data;
      requireLab(before?.number === fixture.number && before.state === 'open' && before.head?.repo?.id === this.config.repositoryId && before.base?.repo?.id === this.config.repositoryId && before.head.ref === fixture.headRef && before.base.ref === fixture.baseRef && isSha(before.head.sha), 'LAB_NATIVE_MERGE_TARGET_CHANGED');
      if (before.mergeable === true) break;
      requireLab(before.mergeable === null || before.mergeable === undefined, 'LAB_NATIVE_FIXTURE_NOT_MERGEABLE');
      requireLab(attempt < 14, 'LAB_NATIVE_MERGEABILITY_UNAVAILABLE');
      await this.wait(1000);
    }
    requireLab(before.number === fixture.number && before.state === 'open' && before.head?.repo?.id === this.config.repositoryId && before.base?.repo?.id === this.config.repositoryId && before.head.ref === fixture.headRef && before.base.ref === fixture.baseRef && isSha(before.head.sha), 'LAB_NATIVE_MERGE_TARGET_CHANGED');
    // A native merge attempt is intentionally permitted only for disposable fixtures, including negative cases.
    const result = await this.owner('PUT', `/pulls/${fixture.number}/merge`, { sha: before.head.sha, merge_method: 'merge',
      commit_title: `Disposable KIRARI lab ${this.config.runId}`, commit_message: 'NONPRODUCTION TEST ONLY; not R3 authorization.' }, [200, 403, 405]);
    const readback = (await this.owner('GET', `/pulls/${fixture.number}`)).data;
    requireLab(readback.number === fixture.number && readback.head?.ref === fixture.headRef && readback.base?.ref === fixture.baseRef && readback.head.repo?.id === this.config.repositoryId && readback.base.repo?.id === this.config.repositoryId, 'LAB_NATIVE_MERGE_READBACK_CHANGED');
    if (result.status === 200) {
      requireLab(result.data?.merged === true && isSha(result.data.sha) && readback.merged === true && readback.merge_commit_sha === result.data.sha, 'LAB_NATIVE_MERGE_READBACK_INVALID');
      return { accepted: true, status: 200, mergedSha: result.data.sha, expectedHead: before.head.sha };
    }
    requireLab(readback.merged === false && readback.state === 'open', 'LAB_NATIVE_REJECTION_UNVERIFIED');
    return { accepted: false, status: result.status, expectedHead: before.head.sha };
  }
  async mutateHeadAndBase(fixture) {
    const head = await this.commit(fixture.index, fixture.head, 'changed-head');
    await this.owner('PATCH', `/git/refs/heads/${fixture.headRef}`, { sha: head, force: false });
    await this.setEnforcement('disabled');
    try {
      const base = await this.commit(fixture.index, fixture.base, 'changed-base');
      await this.owner('PATCH', `/git/refs/heads/${fixture.baseRef}`, { sha: base, force: false });
      const live = (await this.owner('GET', `/pulls/${fixture.number}`)).data;
      requireLab(live.head?.sha === head && live.base?.sha === base, 'LAB_HEAD_BASE_MUTATION_UNVERIFIED');
      return { previousHead: fixture.head, currentHead: head, previousBase: fixture.base, currentBase: base };
    } finally { await this.setEnforcement('active'); }
  }
  async recover(fixture, mergeWhileDisabled = false) {
    await this.setEnforcement('disabled'); await this.effective(fixture.baseRef, labRulesetPayload(this.config));
    let native;
    try { if (mergeWhileDisabled) native = await this.nativeMerge(fixture); }
    finally { await this.setEnforcement('active'); await this.effective(fixture.baseRef, this.activePayload); }
    return { independentOwnerAdministration: true, disabledReadback: true, restoredFullPayloadReadback: true, effectiveRulesRestored: true,
      checkDependency: false, bypassActors: 0, ...(native ? { nativeWhileDisabled: native } : {}) };
  }
  async cleanup() {
    const errors = [];
    try {
      const repo = (await this.owner('GET', '')).data; const user = (await this.owner('GET', '/user')).data;
      assertLabRepository(this.config, repo, user);
      const seed = (await this.owner('GET', `/git/ref/heads/${encodeURIComponent(this.defaultBranch)}`)).data;
      requireLab(seed.object?.sha === this.seed, 'LAB_DEFAULT_BRANCH_UNEXPECTEDLY_CHANGED');
      if (this.rulesetId !== null) {
        await this.setEnforcement('disabled');
        await this.owner('DELETE', `/rulesets/${this.rulesetId}`);
        const absent = await this.owner('GET', `/rulesets/${this.rulesetId}`, undefined, [200, 404]);
        requireLab(absent.status === 404, 'LAB_RULESET_CLEANUP_UNVERIFIED');
      }
      for (const fixture of this.fixtures) {
        const pr = (await this.owner('GET', `/pulls/${fixture.number}`)).data;
        if (pr.state === 'open') {
          await this.owner('PATCH', `/pulls/${fixture.number}`, { state: 'closed' });
          const closed = (await this.owner('GET', `/pulls/${fixture.number}`)).data;
          requireLab(closed.number === fixture.number && closed.state === 'closed' && closed.head?.ref === fixture.headRef && closed.base?.ref === fixture.baseRef, 'LAB_PR_CLOSE_UNVERIFIED');
        }
      }
      for (const branch of this.refs.reverse()) {
        assertLabBranch(this.config, branch, this.defaultBranch);
        await this.owner('DELETE', `/git/refs/heads/${branch}`);
        const absent = await this.owner('GET', `/git/ref/heads/${branch}`, undefined, [200, 404]);
        requireLab(absent.status === 404, 'LAB_REF_CLEANUP_UNVERIFIED');
      }
    } catch (error) { errors.push({ code: error instanceof LabError ? error.code : 'LAB_CLEANUP_FAILED', ...(error.status ? { status: error.status } : {}) }); }
    return { complete: errors.length === 0 && this.pendingCreations.length === 0, errors,
      defaultBranchUnchanged: errors.length === 0, pendingCreations: structuredClone(this.pendingCreations),
      ...(this.pendingCreations.length ? { manualOwnerReconciliationRequired: true, reason: 'CREATION_MAY_HAVE_SUCCEEDED_WITHOUT_A_VERIFIABLE_RESPONSE' } : {}) };
  }
}
