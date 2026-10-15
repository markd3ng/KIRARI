import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const workflowsRoot = join(dirname(fileURLToPath(import.meta.url)), "../../.github/workflows");

// Actions can build/export portable output. Hosting belongs to native Git.
function assertNoSiteDeploymentController(source) {
	const content = source.replace(/^\s*#.*$/gm, "");
	assert.doesNotMatch(content, /\bVERCEL_PRODUCTION_TOKEN\b|secrets\.VERCEL_TOKEN\b/i, "Actions must not consume retired Site deployment credentials");
	assert.doesNotMatch(content, /\b(?:vercel|vc)(?:@[^\s]+)?(?:[^\r\n]*\b(?:deploy|promote|rollback)\b|\s+(?:--prebuilt\s+)?--prod\b)/i, "Actions must not publish or promote Site deployments");
	for (const line of content.split(/\r?\n/)) {
		if (/api\.vercel\.com\/[^\s]*\b(?:deployments|promote|aliases|files)\b/i.test(line)) {
			assert.doesNotMatch(line, /(?:-X\s*|--request(?:\s+|=))(?:POST|PUT|PATCH|DELETE)\b|(?:^|\s)(?:-[dF]|--data(?:-ascii|-binary|-raw|-urlencode)?(?=\s|=)|--form(?:-string)?(?=\s|=))/i, "Actions must not upload or mutate Site deployments");
		}
	}
	assert.doesNotMatch(content, /uses:\s*(?:amondnet\/vercel-action|[^\s]*vercel-deploy[^\s]*)@/i, "Actions must not install a second Site deployment controller");
	assert.doesNotMatch(content, /scripts\/(?:deploy-vercel-|production-authorization|p4-production\/)/, "Actions must not run retired deployment admission controllers");
}

test("all Actions workflows preserve native Git as the hosting controller", () => {
	for (const file of readdirSync(workflowsRoot).filter((name) => /\.ya?ml$/.test(name))) {
		assertNoSiteDeploymentController(readFileSync(join(workflowsRoot, file), "utf8"));
	}
});

test("architecture check rejects retired deployment credentials and duplicate publishers", () => {
	for (const source of [
		"env:\n  VERCEL_PRODUCTION_TOKEN: ${{ secrets.HOSTING_TOKEN }}",
		"run: npx vercel deploy --prod",
		"run: npx vercel --prod",
		"run: vercel --prebuilt --prod",
		"run: vc promote dpl_test",
		"run: npx vercel --token ${{ secrets.HOSTING }} deploy --prod",
		"run: curl -X POST https://api.vercel.com/v13/deployments",
		"run: curl --request POST https://api.vercel.com/v2/files",
		"run: curl https://api.vercel.com/v13/deployments -X POST",
		"run: curl https://api.vercel.com/v13/deployments -d '{}'",
		"run: curl --data '{}' https://api.vercel.com/v13/deployments",
		"run: curl https://api.vercel.com/v2/files --data-binary=@output",
		"run: curl -F file=@output https://api.vercel.com/v2/files",
		"run: curl -d@output https://api.vercel.com/v2/files",
		"run: curl https://api.vercel.com/v13/deployments -XPOST",
		"env:\n  VERCEL_TOKEN: ${{ secrets.VERCEL_TOKEN }}",
		"run: vercel rollback dpl_test",
		"uses: amondnet/vercel-action@v25",
		"run: node scripts/p4-production/run.mjs",
	]) assert.throws(() => assertNoSiteDeploymentController(source));
	assert.doesNotThrow(() => assertNoSiteDeploymentController("run: node scripts/package-vercel-site.mjs\nrun: pnpm edge:deploy:dry"));
});


test("independent provenance and native read-only verification remain allowed", () => {
	for (const source of [
		"permissions:\n  id-token: write\n  attestations: write\nsteps:\n  - uses: actions/attest-build-provenance@v2",
		"permissions:\n  deployments: write\nrun: gh api repos/owner/repo/deployments/123/statuses --method POST",
		"env:\n  VERCEL_ORG_ID: team_expected\n  VERCEL_PROJECT_ID: prj_expected\nrun: curl --request GET https://api.vercel.com/v13/deployments/dpl_expected",
		"run: vercel inspect dpl_expected --json",
		"name: Download deployment logs from Vercel\nrun: curl https://api.vercel.com/v13/deployments/dpl_expected -X GET",
		"run: vercel build",
		"run: vercel build --prod",
		"uses: vercel/ai-review@v1",
	]) assert.doesNotThrow(() => assertNoSiteDeploymentController(source));
});
