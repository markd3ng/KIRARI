import assert from 'node:assert/strict';
import test from 'node:test';
import { assessFinalAdmissionCapability, inspectFinalAdmission } from '../final-admission.mjs';
import { MAX_EVIDENCE_AGE_MS } from '../publisher-contract.mjs';
import { INSPECTION_NOW, makeFinalAdmissionFixture } from './final-admission-fixtures.mjs';

function denied(result, phase) {
  assert.equal(result.inspection, 'DENIED');
  assert.equal(result.phase, phase);
  assert.equal(result.mergeAdmission, 'BLOCKED');
  assert.equal(result.mergeAllowed, false);
  assert.equal(result.requiredCheckSuccessAllowed, false);
  assert.equal(result.consumptionAllowed, false);
  assert.equal(result.capability.status, 'NOT_READY');
}

test('native capability denies authority regardless of arbitrary caller atomicity/provider flags', () => {
  const capability = assessFinalAdmissionCapability({ platform: 'atomic-server', authoritative: true, atomic: true, ready: true });
  assert.equal(capability.status, 'NOT_READY');
  assert.equal(capability.authoritativeAdmissionAvailable, false);
  assert.equal(capability.mergeExecutionAvailable, false);
  assert.equal(capability.nativeRequiredCheckSuccessAllowed, false);
  assert.ok(capability.blockers.includes('NATIVE_MERGE_LACKS_ATOMIC_AUTHORIZATION_PREDICATE'));
  assert.ok(Object.isFrozen(capability));
  assert.ok(Object.isFrozen(capability.blockers));
  assert.throws(() => { capability.status = 'READY'; }, TypeError);
});

test('valid exact decision, dependencies, audit and dedicated App check produce inspection only', async () => {
  const fixture = makeFinalAdmissionFixture();
  const result = await inspectFinalAdmission(fixture);
  assert.equal(result.inspection, 'VALIDATED_BUT_BLOCKED');
  assert.equal(result.mergeAllowed, false);
  assert.equal(result.requiredCheckSuccessAllowed, false);
  assert.equal(result.consumptionAllowed, false);
  assert.equal(result.authoritative, false);
  assert.equal(result.liveTransportVerified, false);
  assert.equal(result.observedCheckRunId, 9001);
  assert.match(result.inspectionDigest, /^[a-f0-9]{64}$/);
  assert.deepEqual(fixture.state.writes, []);
  assert.ok(Object.isFrozen(result));
});

test('reinspection is evidence-idempotent and never a reusable or single-use merge grant', async () => {
  const fixture = makeFinalAdmissionFixture();
  const first = await inspectFinalAdmission(fixture);
  const replay = await inspectFinalAdmission(fixture);
  assert.equal(first.inspectionDigest, replay.inspectionDigest);
  assert.equal(replay.mergeAllowed, false);
  assert.deepEqual(fixture.state.writes, []);
  assert.throws(() => { replay.mergeAllowed = true; }, TypeError);
});

test('expired authorization after prior successful check cannot become admission', async () => {
  const fixture = makeFinalAdmissionFixture();
  fixture.state.now = INSPECTION_NOW + 60_000;
  fixture.state.check.conclusion = 'success';
  denied(await inspectFinalAdmission(fixture), 'CONTINUING_ELIGIBILITY');
});

test('revoked, deleted or edited live decision cannot become admission', async (t) => {
  for (const mutation of ['revoked', 'deleted', 'edited']) await t.test(mutation, async () => {
    const fixture = makeFinalAdmissionFixture();
    if (mutation === 'deleted') fixture.state.comment = null;
    else fixture.state.comment.body += mutation;
    denied(await inspectFinalAdmission(fixture), 'CONTINUING_ELIGIBILITY');
  });
});

test('changed live candidate HEAD, base, main, or head repository cannot become admission', async (t) => {
  for (const field of ['head', 'base', 'main', 'headRepository']) await t.test(field, async () => {
    const fixture = makeFinalAdmissionFixture();
    fixture.state[field] = field === 'headRepository' ? 'attacker/KIRARI' : '0'.repeat(40);
    denied(await inspectFinalAdmission(fixture), 'CONTINUING_ELIGIBILITY');
  });
});

test('changed candidate content/dependency graph or forged original result is rejected', async (t) => {
  for (const mutation of ['candidate', 'topology', 'result']) await t.test(mutation, async () => {
    const fixture = makeFinalAdmissionFixture();
    if (mutation === 'candidate') fixture.verificationInput.candidateFiles['package.json'] += '\n';
    if (mutation === 'topology') fixture.verificationInput.candidateFiles['pnpm-lock.yaml'] = fixture.verificationInput.candidateFiles['pnpm-lock.yaml'].replaceAll('postcss-selector-parser@6.1.4', 'postcss-selector-parser@6.1.5');
    if (mutation === 'result') fixture.verificationResult.topology.r3Paths = [];
    denied(await inspectFinalAdmission(fixture), 'EVIDENCE_RECONSTRUCTION');
  });
});

test('new unapproved qualifying audit finding rejects evidence', () => {
  const fixture = makeFinalAdmissionFixture();
  for (const label of ['normal', 'supplemental']) {
    const raw = JSON.parse(fixture.verificationInput.audits[label].raw);
    raw.advisories['1003'] = { ...structuredClone(raw.advisories['1001']), id: 1003, github_advisory_id: 'GHSA-new-high', module_name: 'new-package', severity: 'high' };
    raw.metadata.vulnerabilities.high += raw.advisories['1003'].findings.length;
    fixture.verificationInput.audits[label].raw = JSON.stringify(raw);
  }
  return inspectFinalAdmission(fixture).then((result) => denied(result, 'EVIDENCE_RECONSTRUCTION'));
});

test('even harmless raw audit-byte substitution cannot reuse original result hashes', async () => {
  const fixture = makeFinalAdmissionFixture();
  fixture.verificationInput.audits.normal.raw += '\n';
  denied(await inspectFinalAdmission(fixture), 'EVIDENCE_RECONSTRUCTION');
});

test('changed #122 or #135 original contract cannot be accepted as a new snapshot', async (t) => {
  for (const issue of ['issue122', 'issue135']) await t.test(issue, async () => {
    const fixture = makeFinalAdmissionFixture();
    fixture.verificationInput[issue].bodySha256 = '0'.repeat(64);
    denied(await inspectFinalAdmission(fixture), 'EVIDENCE_RECONSTRUCTION');
  });
});

test('closed or changed live #122/#135 contracts block continuing inspection', async (t) => {
  for (const issue of ['issue122', 'issue135']) await t.test(issue, async () => {
    const fixture = makeFinalAdmissionFixture();
    fixture.state[issue].state = 'closed';
    denied(await inspectFinalAdmission(fixture), 'CONTINUING_ELIGIBILITY');
  });
});

test('caller policy override cannot weaken dependency or issue scope', async () => {
  const fixture = makeFinalAdmissionFixture();
  fixture.verificationInput.policy = { repository: 'markd3ng/KIRARI', decisionIssue: 1, r3: {}, issue135: { bodySha256: '0'.repeat(64) } };
  const result = await inspectFinalAdmission(fixture);
  assert.equal(result.inspection, 'VALIDATED_BUT_BLOCKED', 'the untrusted caller policy is ignored in favor of module policy bytes');
  assert.equal(result.mergeAllowed, false);
});

test('replayed verifier attempt or changed evidence digest is denied', async (t) => {
  for (const mutation of ['attempt', 'run', 'main', 'workflow', 'digest', 'trustedPolicy', 'publisherPolicy']) await t.test(mutation, async () => {
    const fixture = makeFinalAdmissionFixture();
    if (mutation === 'attempt') fixture.source.runAttempt += 1;
    if (mutation === 'run') fixture.source.runId += 1;
    if (mutation === 'main') fixture.source.mainSha = '0'.repeat(40);
    if (mutation === 'workflow') fixture.source.workflowPath = '.github/workflows/untrusted.yml';
    if (mutation === 'digest') fixture.evidenceDigest = '0'.repeat(64);
    if (mutation === 'trustedPolicy') fixture.verificationInput.trusted.policyDigest = '0'.repeat(64);
    if (mutation === 'publisherPolicy') fixture.publisher.policyDigest = '0'.repeat(64);
    denied(await inspectFinalAdmission(fixture), 'EVIDENCE_RECONSTRUCTION');
  });
});

test('lab-repository evidence cannot rebind the fixed KIRARI contract', async () => {
  const fixture = makeFinalAdmissionFixture();
  fixture.source.repository = 'fixture-org/admission-lab';
  fixture.bundle.repository.fullName = fixture.source.repository;
  denied(await inspectFinalAdmission(fixture), 'EVIDENCE_RECONSTRUCTION');
  assert.deepEqual(fixture.state.reads, []);
});

test('caller mutation across an async observation cannot substitute evidence bytes', async () => {
  const fixture = makeFinalAdmissionFixture();
  const originalCheckRead = fixture.adapter.getPublisherCheck;
  fixture.adapter.getPublisherCheck = async (head) => {
    fixture.verificationInput.candidateFiles['package.json'] += '\n';
    fixture.verificationInput.audits.normal.raw += '\n';
    fixture.verificationResult.topology.r3Paths = [];
    fixture.source.runAttempt += 1;
    fixture.publisher.sha = '0'.repeat(40);
    return originalCheckRead(head);
  };
  const result = await inspectFinalAdmission(fixture);
  assert.equal(result.inspection, 'VALIDATED_BUT_BLOCKED', 'the original evidence snapshot remains bound');
  assert.equal(result.mergeAllowed, false);
  assert.deepEqual(fixture.state.writes, []);
});

test('wrong App, wrong external binding, missing check, and cached green are rejected', async (t) => {
  for (const mutation of ['App', 'external', 'missing', 'green', 'summary']) await t.test(mutation, async () => {
    const fixture = makeFinalAdmissionFixture();
    if (mutation === 'App') fixture.state.check.app.id = 15368;
    if (mutation === 'external') fixture.state.check.external_id = 'replayed';
    if (mutation === 'missing') fixture.state.check = null;
    if (mutation === 'green') fixture.state.check.conclusion = 'success';
    if (mutation === 'summary') fixture.state.check.output.summary = 'forged approved result';
    denied(await inspectFinalAdmission(fixture), 'PUBLISHER_CHECK');
  });
});

test('pending or shared Actions App setup identity is denied before API reads', async (t) => {
  for (const appId of [undefined, 'PENDING_OWNER_SETUP', 15368]) await t.test(String(appId), async () => {
    const fixture = makeFinalAdmissionFixture();
    fixture.expectedPublisherAppId = appId;
    denied(await inspectFinalAdmission(fixture), 'INSPECTION_CONFIGURATION');
    assert.deepEqual(fixture.state.reads, []);
  });
});

test('missing credentials, API failure, and publisher outage deny without echoing secrets', async (t) => {
  for (const method of ['assertPullRequest', 'getDecisionComment', 'getPublisherCheck']) await t.test(method, async () => {
    const fixture = makeFinalAdmissionFixture();
    fixture.adapter[method] = async () => { throw new Error('private-test-secret GitHub API outage'); };
    const result = await inspectFinalAdmission(fixture);
    denied(result, method === 'getPublisherCheck' ? 'PUBLISHER_CHECK' : 'CONTINUING_ELIGIBILITY');
    assert.doesNotMatch(JSON.stringify(result), /private-test-secret/);
    assert.deepEqual(fixture.state.writes, []);
  });
});

test('expiry or candidate mutation during publisher read is rechecked before completion', async (t) => {
  for (const mutation of ['expiry', 'head']) await t.test(mutation, async () => {
    const fixture = makeFinalAdmissionFixture();
    fixture.adapter.getPublisherCheck = async () => {
      if (mutation === 'expiry') fixture.state.now += 60_000;
      else fixture.state.head = '0'.repeat(40);
      return fixture.state.check;
    };
    denied(await inspectFinalAdmission(fixture), 'FINAL_OBSERVATION');
    assert.deepEqual(fixture.state.writes, []);
  });
});

test('inspection never refreshes old/future evidence checkedAt', async (t) => {
  for (const now of [INSPECTION_NOW + MAX_EVIDENCE_AGE_MS, INSPECTION_NOW - 1]) await t.test(String(now), async () => {
    const fixture = makeFinalAdmissionFixture();
    fixture.state.now = now;
    denied(await inspectFinalAdmission(fixture), 'CONTINUING_ELIGIBILITY');
    assert.equal(fixture.bundle.checkedAt, new Date(INSPECTION_NOW).toISOString());
  });
});

test('claimed atomic authority, server success, and additional write callbacks cannot grant admission', async () => {
  const fixture = makeFinalAdmissionFixture();
  const result = await inspectFinalAdmission({ ...fixture, atomic: true, authoritative: true, operationalSuccessEnabled: true,
    serverAuthority: { verified: true, atomic: true, merge: async () => assert.fail('cannot call external merge authority') } });
  assert.equal(result.inspection, 'VALIDATED_BUT_BLOCKED');
  assert.equal(result.authoritative, false);
  assert.equal(result.mergeAllowed, false);
  assert.deepEqual(fixture.state.writes, []);
});
