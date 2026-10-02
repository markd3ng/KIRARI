import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");
const workflow = readFileSync(join(repoRoot, ".github/workflows/ocr-review.yml"), "utf8");

test("OCR listens only to the accepted pull request events", () => {
	const trigger = workflow.match(/^on:\n([\s\S]*?)^permissions:/m)?.[1] ?? "";
	assert.match(trigger, /^  pull_request:\n    types: \[opened, synchronize, reopened, ready_for_review\]$/m);
	assert.doesNotMatch(trigger, /^\s+(?:push|workflow_dispatch|pull_request_target|issue_comment):/m);
});

test("OCR skips draft and fork PRs with the requested advisory concurrency and permissions", () => {
	assert.match(workflow, /^    if: \$\{\{ !github\.event\.pull_request\.draft && !github\.event\.pull_request\.head\.repo\.fork \}\}$/m);
	assert.match(workflow, /^  group: \$\{\{ github\.workflow \}\}-\$\{\{ github\.event\.pull_request\.number \|\| github\.ref \}\}$/m);
	assert.match(workflow, /^  cancel-in-progress: true$/m);
	assert.match(workflow, /^permissions:\n  contents: read\n  pull-requests: write$/m);
	assert.doesNotMatch(workflow, /contents:\s*write|issues:\s*write|branch[_ -]protection|required[_ -]checks/i);
});

test("OCR pins the accepted action and passes its credentials without logging them", () => {
	assert.match(workflow, /^      - uses: alibaba\/open-code-review@a758d9cbfb689937c7857ad64b2dd66adb58c0c2$/m);
	assert.match(workflow, /^          llm_url: \$\{\{ secrets\.OCR_LLM_URL \}\}$/m);
	assert.match(workflow, /^          llm_auth_token: \$\{\{ secrets\.OCR_LLM_AUTH_TOKEN \}\}$/m);
	assert.match(workflow, /^          llm_model: \$\{\{ vars\.OCR_LLM_MODEL \}\}$/m);
	assert.doesNotMatch(workflow, /secrets\.OCR_LLM_MODEL/);
	assert.match(workflow, /^          llm_use_anthropic: 'false'$/m);
	assert.match(workflow, /^          llm_protocol: openai$/m);
	assert.match(workflow, /^          ocr_version: '1\.12\.11'$/m);
	assert.match(workflow, /^          language: Chinese$/m);
	assert.match(workflow, /^          effort: high$/m);
	assert.match(workflow, /^          review_concurrency: '4'$/m);
	assert.match(workflow, /^          review_task_timeout: '20'$/m);
	assert.match(workflow, /^          llm_timeout: '300'$/m);
	assert.match(workflow, /^          stream_progress: 'true'$/m);
	assert.match(workflow, /^          upload_artifacts: 'true'$/m);
	assert.match(workflow, /^          sticky_summary: 'true'$/m);
	assert.match(workflow, /^          incremental: 'true'$/m);
	assert.match(workflow, /^          route_severity_below: low$/m);
	assert.match(workflow, /^          route_categories: style,documentation$/m);
	assert.match(workflow, /^          resolve_outdated: report$/m);
	assert.match(workflow, /^          checkpoint_range: 'false'$/m);
	assert.doesNotMatch(workflow, /^\s+run:|\becho\b/i);
});
