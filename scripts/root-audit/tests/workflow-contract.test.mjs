import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import policy from '../trusted-policy.json' with { type: 'json' };
import publisherPolicy from '../publisher-policy.json' with { type: 'json' };
import appManifest from '../github-app-manifest.json' with { type: 'json' };
import environmentManifest from '../publisher-environment-manifest.json' with { type: 'json' };
import rulesetProposal from '../ruleset-proposal.json' with { type: 'json' };

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const workflow = await readFile(path.join(root, '.github/workflows/r3-trusted-verifier.yml'), 'utf8');
const publisherWorkflow = await readFile(path.join(root, '.github/workflows/r3-trusted-publisher.yml'), 'utf8');
const cli = await readFile(path.join(root, 'scripts/root-audit/cli.mjs'), 'utf8');
const publisherCli = await readFile(path.join(root, 'scripts/root-audit/publisher-cli.mjs'), 'utf8');
const audit = await readFile(path.join(root, 'scripts/root-audit/audit.mjs'), 'utf8');

test('workflow is dispatch-only and validates main before using the trusted checkout', () => {
  assert.match(workflow, /^on:\n  workflow_dispatch:/m);
  assert.match(workflow, /if: github\.event_name == 'workflow_dispatch' && github\.ref == 'refs\/heads\/main'/);
  assert.match(workflow, /ref: \$\{\{ github\.sha \}\}/);
  assert.doesNotMatch(workflow, /^\s+(pull_request|pull_request_target|push|schedule):/m);
});

test('all workflow permissions are read-only and scoped to API needs', () => {
  assert.match(workflow, /^permissions: \{\}/m);
  assert.match(workflow, /permissions:\n      contents: read\n      pull-requests: read\n      issues: read/);
  assert.doesNotMatch(workflow, /\b(contents|issues|pull-requests|actions|deployments|id-token|packages): write\b/);
  assert.doesNotMatch(workflow, /secrets\.[A-Z0-9_]+/);
  assert.match(workflow, /GH_TOKEN: \$\{\{ github\.token \}\}/);
});

test('every action uses its exact full commit SHA pinned in trusted policy', () => {
  const uses = [...workflow.matchAll(/^\s+uses:\s+([^\s]+)$/gm)].map((match) => match[1]);
  assert.equal(uses.length, Object.keys(policy.actions).length);
  for (const [name, sha] of Object.entries(policy.actions)) {
    assert.ok(uses.includes(`${name}@${sha}`), `missing immutable pin for ${name}`);
    assert.match(sha, /^[a-f0-9]{40}$/);
  }
  assert.doesNotMatch(workflow, /uses:\s+[^\s]+@(v\d+|main|master)\b/);
});

test('workflow sends only explicit SHA inputs through environment variables to base code', () => {
  for (const input of ['pr_number', 'expected_head_sha', 'expected_base_sha', 'security_review_sha256']) {
    assert.match(workflow, new RegExp(`^      ${input}:$`, 'm'));
  }
  assert.match(workflow, /run: node scripts\/root-audit\/cli\.mjs/);
  assert.doesNotMatch(workflow, /\$\{\{\s*inputs\.[^}]+\}\}[^\n]*run:/);
  assert.doesNotMatch(workflow, /npm (install|test|run)|pnpm (install|test|run)|download-artifact|cache:/);
  assert.match(workflow, /security_review_sha256:\n        description:[^\n]+\n        required: false/);
});

test('publisher preflights source before the main-only Environment and never executes candidate content', () => {
  const sourceJob = publisherWorkflow.indexOf('  validate-source:');
  const publishJob = publisherWorkflow.indexOf('  publish:');
  const environment = publisherWorkflow.indexOf('    environment:\n      name: r3-trusted-publisher');
  const appToken = publisherWorkflow.indexOf('      - name: Mint a repository-scoped check-writer token');
  assert.ok(sourceJob >= 0 && sourceJob < publishJob && publishJob < environment && environment < appToken);
  assert.match(publisherWorkflow, /needs: validate-source/);
  assert.match(publisherWorkflow, /needs\.validate-source\.outputs\.publisher_eligible == 'true'/);
  assert.match(publisherWorkflow, /publisher_eligible: \$\{\{ steps\.preflight\.outputs\.publisher_eligible \}\}/);
  assert.doesNotMatch(publisherWorkflow.slice(sourceJob, publisherWorkflow.indexOf('    runs-on:', sourceJob)), /conclusion == 'success'/);
  assert.match(publisherWorkflow, /types: \[requested, in_progress, completed\]/);
  assert.match(publisherWorkflow, /concurrency:\n  group: r3-trusted-publisher-\$\{\{ github\.event\.workflow_run\.display_title \}\}\n  cancel-in-progress: false/);
  assert.match(publisherWorkflow, /if: github\.event\.workflow_run\.status == 'completed' && github\.event\.workflow_run\.conclusion == 'success'/);
  assert.match(publisherWorkflow, /publisher-cli\.mjs publish-pending/);
  assert.match(publisherWorkflow, /continue-on-error: true/);
  assert.match(publisherWorkflow, /steps\.verify-evidence\.outcome != 'success'/);
  assert.match(workflow, /^run-name: R3 verifier\|pr=\$\{\{ inputs\.pr_number \}\}\|head=\$\{\{ inputs\.expected_head_sha \}\}\|base=\$\{\{ inputs\.expected_base_sha \}\}$/m);
  assert.match(publisherCli, /publishFailure/);
  assert.match(publisherWorkflow, /github\.event\.workflow_run\.event == 'workflow_dispatch'/);
  assert.match(publisherWorkflow, /github\.event\.workflow_run\.head_repository\.id == github\.event\.repository\.id/);
  assert.match(publisherWorkflow, /ref: \$\{\{ github\.workflow_sha \}\}/);
  assert.doesNotMatch(publisherWorkflow, /ref: \$\{\{ github\.event\.workflow_run\.(?:head_sha|head_branch)/);
  assert.match(publisherWorkflow, /permission-checks: write/);
  assert.match(publisherWorkflow, /^permissions: \{\}/m);
  assert.match(publisherWorkflow, /permissions:\n      actions: read\n      contents: read\n      issues: read\n      pull-requests: read/);
  const publisherUses = [...publisherWorkflow.matchAll(/^\s+uses:\s+([^\s]+)$/gm)].map((match) => match[1]);
  const publisherPins = publisherPolicy.actionPins;
  for (const use of publisherUses) {
    const [name, sha] = use.split('@');
    assert.equal(publisherPins[name], sha, `unapproved or mutable publisher action pin: ${use}`);
  }
  for (const name of Object.keys(publisherPins)) {
    assert.ok(publisherUses.some((use) => use.startsWith(`${name}@`)), `missing immutable publisher action ${name}`);
  }
  assert.deepEqual([...new Set(publisherUses.map((use) => use.split('@')[0]))].sort(), Object.keys(publisherPins).sort());
  for (const sha of Object.values(publisherPins)) {
    assert.match(sha, /^[a-f0-9]{40}$/);
  }
  assert.doesNotMatch(publisherWorkflow, /pull_request_target/);
  assert.doesNotMatch(publisherWorkflow, /pull-requests: write|contents: write|issues: write|statuses: write/);
  assert.match(publisherCli, /actions\/runs\/\$\{runId\}\/attempts\/\$\{runAttempt\}/);
  assert.match(publisherCli, /actions\/workflows\/\$\{source\.workflowId\}/);
  assert.match(publisherCli, /validateWorkflowMetadata\(workflow, source\)/);
  assert.match(publisherCli, /assertVerifierRunIsLatest/);
  assert.match(publisherCli, /searchParams\.set\('created', workflowRunCreatedFilter\(source\.createdAt\)\)/);
  assert.match(publisherCli, /trusted verifier run is not based on the current main SHA/);
  assert.match(publisherCli, /live PR base is not the current main SHA/);
  assert.match(publisherCli, /\/check-runs/);
  assert.doesNotMatch(publisherCli, /\/statuses/);
  assert.match(publisherCli, /redirect: 'error'/);
  assert.doesNotMatch(publisherCli, /child_process|execFile|eval\(|import\([^)]*evidence/);
});

test('publisher and ruleset manifests remain inert until a real App identity is observed', () => {
  assert.equal(rulesetProposal.kind, 'planning-wrapper-not-github-api-payload');
  assert.equal(rulesetProposal.requiredApprovals, 0);
  assert.equal(rulesetProposal.requireUpToDateBranch, true);
  assert.deepEqual(rulesetProposal.requiredStatusChecks, [{
    context: 'KIRARI / R3 trusted verifier',
    expectedIntegrationId: 'PENDING_OWNER_SETUP',
    source: 'DEDICATED_GITHUB_APP',
  }]);
  assert.deepEqual(rulesetProposal.requiredStatusCheckAdditionalGate.protectedPaths, ['.github/workflows/', 'scripts/root-audit/']);
  assert.equal(rulesetProposal.requiredStatusCheckAdditionalGate.ordinaryCheckMayAuthorizeTrustedRootChanges, false);
  assert.equal(rulesetProposal.blockForcePush, true);
  assert.equal(rulesetProposal.protectDeletion, true);
  assert.deepEqual(rulesetProposal.bypassActors, []);
  assert.equal(rulesetProposal.apiPayload, null);
  assert.equal(rulesetProposal.apiPayloadReady, false);
  assert.equal(rulesetProposal.applied, false);
  assert.equal(rulesetProposal.mainProtected, false);

  assert.equal(publisherPolicy.requiredCheckSource.appId, 'PENDING_OWNER_SETUP');
  assert.deepEqual(publisherPolicy.requiredCheckSource.permissions, { checks: 'write', metadata: 'read' });
  assert.equal(publisherPolicy.independentSecurityReview.requiredForAutomatedCheck, false);
  assert.equal(publisherPolicy.independentSecurityReview.missingBlocksTechnicalSuccess, false);
  assert.equal(publisherPolicy.independentSecurityReview.inputMode, 'optional_owner_supplied_reference');
  assert.equal(publisherPolicy.independentSecurityReview.reportFetchedOrInspectedByVerifier, false);
  assert.equal(publisherPolicy.independentSecurityReview.reviewerIdentityAuthenticatedByVerifier, false);
  assert.equal(publisherPolicy.workflowRunFilter.latestRunRequiredForPublication, true);
  assert.match(publisherPolicy.workflowRunFilter.createdAtLowerBound, /created_at/);
  assert.equal(publisherPolicy.workflowRunFilter.startedRunInvalidatesPriorSuccess, true);
  assert.equal(publisherPolicy.workflowRunFilter.concurrencyKey, 'trusted verifier display title binding PR/head/base');
  assert.equal(publisherPolicy.appCredentialsPresent, false);
  assert.equal(publisherPolicy.applyReady, false);
  assert.deepEqual(publisherPolicy.trustedRootChangePolicy.protectedPathsFromTrustedBase, ['.github/workflows/', 'scripts/root-audit/']);
  assert.equal(publisherPolicy.trustedRootChangePolicy.ordinaryAppCheckMayAuthorizeChanges, false);

  assert.equal(appManifest.status, 'PENDING_OWNER_SETUP');
  assert.equal(appManifest.applyReady, false);
  assert.equal(appManifest.liveAppCreated, false);
  assert.equal(appManifest.liveInstallationCreated, false);
  assert.equal(appManifest.application.appId, 'PENDING_OWNER_SETUP');
  assert.deepEqual(appManifest.application.installationRepositories, ['markd3ng/KIRARI']);
  assert.equal(appManifest.credential.privateKey, 'NOT_CREATED');
  assert.deepEqual(appManifest.permissions, { checks: 'write', metadata: 'read', additional: {} });

  assert.deepEqual(environmentManifest.branchPolicy.allowedBranches, ['main']);
  assert.equal(environmentManifest.branchPolicy.type, 'selected_branches');
  assert.equal(environmentManifest.branchPolicy.protectedBranchesOnly, false);
  assert.equal(environmentManifest.branchPolicy.administratorBypass, false);
  assert.equal(environmentManifest.secrets[0].value, 'NOT_CREATED');
  assert.equal(environmentManifest.variables[0].value, 'PENDING_OWNER_SETUP');
  assert.equal(environmentManifest.liveEnvironmentCreated, false);
  assert.equal(environmentManifest.liveSecretCreated, false);
  assert.ok(environmentManifest.secretSetupPrerequisites.includes('the exact ruleset has been separately authorized, applied, and authenticated-read back'));
});

test('candidate acquisition is bounded to trusted allowlist and exact SHA API requests', () => {
  assert.match(cli, /for \(const file of policy\.candidateFiles\)/);
  assert.match(cli, /pulls\/\$\{prNumber\}\/files/);
  assert.match(cli, /github\.changedFiles\) !== JSON\.stringify\(preflight\.changedFiles/);
  assert.match(cli, /changedFiles: github\.changedFiles/);
  assert.match(cli, /searchParams\.set\('ref', headSha\)/);
  assert.match(cli, /fetchCandidateFile\(event\.apiUrl, preflight\.candidate\.headRepo, file, input\.expectedHeadSha/);
  assert.match(cli, /const github = await getGitHubState\(event\.apiUrl, input\.prNumber/);
  assert.match(cli, /JSON\.stringify\(github\.candidate\) !== JSON\.stringify\(preflight\.candidate\)/);
  assert.match(cli, /candidate\.headSha !== expectedHeadSha \|\| candidate\.baseSha !== expectedBaseSha/);
  assert.match(cli, /GITHUB_EVENT_NAME/);
  assert.match(cli, /GITHUB_WORKFLOW_SHA/);
  assert.match(cli, /issues\/comments\/\$\{commentId\}/);
  assert.doesNotMatch(cli, /issues\/\$\{issueNumber\}\/comments|approvalCommentCount|getDecisionComments/);
  assert.doesNotMatch(cli, /child_process|execFile|import\([^)]*candidate|eval\(/);
});

test('every candidate allowlist path exists in the checked-in tree and binds candidate policy bytes', async () => {
  for (const file of policy.candidateFiles) await access(path.join(root, file));
  assert.ok(policy.candidateFiles.includes('scripts/root-audit/trusted-policy.json'));
  assert.ok(!policy.candidateFiles.includes('scripts/root-audit/policy.json'));
});

test('audit workspace is generated and child environment cannot receive GitHub credentials', () => {
  assert.match(audit, /const env = \{/);
  assert.match(audit, /npm_config_userconfig: '\/dev\/null'/);
  assert.match(audit, /npm_config_globalconfig: '\/dev\/null'/);
  assert.match(audit, /npm_config_ignore_scripts: 'true'/);
  assert.match(audit, /safeManifest\(manifest, policy\)/);
  assert.match(audit, /await writeFile\(path\.join\(destination, 'package\.json'/);
  assert.doesNotMatch(audit, /candidateFiles\[['"](?:\.npmrc|\.pnpmfile\.cjs)['"]\]/);
  assert.match(audit, /runAsAuditUser\('pnpm', \['--filter', '@kirari\/site', 'audit', '--json', '--audit-level=moderate'\]/);
  assert.match(audit, /'-u', 'nobody'/);
  assert.match(audit, /'\/usr\/bin\/env', '-i'/);
  assert.doesNotMatch(audit, /--ignore-registry-errors|pnpm install|npm install/);
});

test('GitHub API reads are byte-limited while streaming before JSON allocation', async () => {
  assert.match(cli, /response\.body\?\.getReader\(\)/);
  assert.match(cli, /byteLength > responseLimit/);
  assert.match(cli, /MAX_GITHUB_RESPONSE_BYTES/);
  assert.match(cli, /redirect: 'error'/);
  assert.match(cli, /AbortSignal\.timeout\(20_000\)/);
});

test('workflow preserves bounded evidence without downloading or executing artifacts', () => {
  assert.match(workflow, /actions\/upload-artifact@[a-f0-9]{40}/);
  assert.match(workflow, /retention-days: 30/);
  assert.match(workflow, /if: always\(\)/);
  assert.doesNotMatch(workflow, /actions\/download-artifact|gh run download/);
});
