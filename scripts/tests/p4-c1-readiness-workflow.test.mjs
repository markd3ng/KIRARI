import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const workflow = readFileSync(new URL("../../.github/workflows/c1-readiness.yml", import.meta.url), "utf8");

test("C1 verification requires the Owner, exact main source, protected Environment and first attempt", () => {
  assert.match(workflow, /^  workflow_dispatch:/m);
  assert.doesNotMatch(workflow, /^  (?:push|pull_request|workflow_run|schedule):/m);
  for (const condition of [
    "github.repository == 'markd3ng/KIRARI'",
    "github.ref == 'refs/heads/main'",
    "github.actor == github.repository_owner",
    "github.triggering_actor == github.repository_owner",
    "github.run_attempt == 1",
    "github.workflow_sha == github.sha",
  ]) assert.ok(workflow.includes(condition), condition);
  assert.match(workflow, /environment:\n\s+name: kirari-site-production/);
  assert.match(workflow, /ref: \$\{\{ github\.sha \}\}/);
  assert.match(workflow, /persist-credentials: false/);
  assert.match(workflow, /timeout-minutes: 5/);
});

test("C1 workflow maps credentials only to the reviewed GET-only gate and retains its sanitized output", () => {
  assert.match(workflow, /permissions:\n  actions: read\n  contents: read\n  issues: read/);
  assert.doesNotMatch(workflow, /:\s*write\b|continue-on-error|preflight\.mjs|run\.mjs|deploy-vercel-production|vercel (?:deploy|promote|rollback|alias)/);
  assert.equal([...workflow.matchAll(/VERCEL_TOKEN:/g)].length, 1);
  assert.equal([...workflow.matchAll(/^\s+run:/gm)].length, 1);
  assert.match(workflow, /VERCEL_TOKEN: \$\{\{ secrets\.VERCEL_PRODUCTION_TOKEN \}\}/);
  assert.match(workflow, /VERCEL_ORG_ID: \$\{\{ vars\.VERCEL_PRODUCTION_ORG_ID \}\}/);
  assert.match(workflow, /VERCEL_PROJECT_ID: \$\{\{ vars\.VERCEL_PRODUCTION_PROJECT_ID \}\}/);
  assert.match(workflow, /NODE_OPTIONS: ''\n\s+NODE_PATH: ''/);
  assert.match(workflow, /node\/22\.12\.0\/x64\/bin\/node" scripts\/p4-production\/credential-gate\.mjs > "\$RUNNER_TEMP\/c1-readiness\.json"/);
  assert.match(workflow, /path: \$\{\{ runner\.temp \}\}\/c1-readiness\.json/);
  assert.doesNotMatch(workflow, /npm (?:ci|install)|pnpm install|npx|set -x|printenv/);
  for (const action of workflow.matchAll(/uses: ([^\n]+)/g)) assert.match(action[1], /^[\w/-]+@[a-f0-9]{40}$/);
});
