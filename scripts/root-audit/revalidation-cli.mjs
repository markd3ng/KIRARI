import { appendFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { apiEndpoint, requestJson } from './publisher-cli.mjs';
import { listChecksAcrossPages, SHA } from './publisher-contract.mjs';
import { listCandidateHeadsAcrossPages, revokeCachedSuccesses } from './revalidation.mjs';

const REPOSITORY = 'markd3ng/KIRARI';
const WORKFLOW_PATH = '.github/workflows/r3-authorization-revalidation.yml';

export async function validateRevocationSource(env = process.env) {
  if (env.R3_PUBLISHER_ENABLED !== 'true') throw new Error('trusted App operations are disabled pending Owner-controlled setup');
  if (env.GITHUB_REPOSITORY !== REPOSITORY || env.GITHUB_REF !== 'refs/heads/main' ||
      !['workflow_dispatch', 'schedule', 'issues', 'issue_comment'].includes(env.GITHUB_EVENT_NAME) ||
      env.GITHUB_WORKFLOW_REF !== `${REPOSITORY}/${WORKFLOW_PATH}@refs/heads/main` ||
      !SHA.test(env.GITHUB_SHA ?? '') || env.GITHUB_WORKFLOW_SHA !== env.GITHUB_SHA) {
    throw new Error('revocation workflow is not the exact main-only trusted source');
  }
  if (typeof env.GH_TOKEN !== 'string' || env.GH_TOKEN.length < 20) throw new Error('read-only GitHub token is unavailable');
  const repositoryId = Number(env.GITHUB_REPOSITORY_ID);
  if (!Number.isSafeInteger(repositoryId) || repositoryId <= 0) throw new Error('repository ID is invalid');
  const repository = await requestJson(apiEndpoint(env.GITHUB_API_URL, `/repos/${REPOSITORY}`), env.GH_TOKEN);
  if (repository.id !== repositoryId || repository.full_name !== REPOSITORY) throw new Error('live repository identity mismatch');
  const main = await requestJson(apiEndpoint(env.GITHUB_API_URL, `/repos/${REPOSITORY}/branches/main`), env.GH_TOKEN);
  if (main.commit?.sha !== env.GITHUB_WORKFLOW_SHA) throw new Error('revocation source is not current trusted main');
  return { repository: REPOSITORY, mainSha: main.commit.sha };
}

export async function runRevocation({ mode, env = process.env }) {
  if (!['preflight', 'revoke'].includes(mode)) throw new Error('revocation mode is unsupported');
  await validateRevocationSource(env);
  if (mode === 'preflight') {
    if (env.GITHUB_OUTPUT) await appendFile(env.GITHUB_OUTPUT, 'revocation_eligible=true\n', { mode: 0o600 });
    return { sourceValidated: true, credentialsAccessed: false };
  }
  if (typeof env.R3_APP_TOKEN !== 'string' || env.R3_APP_TOKEN.length < 20) throw new Error('dedicated GitHub App installation token is unavailable; cached checks could not be invalidated');
  const appId = Number(env.R3_PUBLISHER_APP_ID);
  const adapter = {
    async listCandidateHeads() {
      return listCandidateHeadsAcrossPages(async (page) => {
        const url = apiEndpoint(env.GITHUB_API_URL, `/repos/${REPOSITORY}/pulls`);
        for (const [key, value] of Object.entries({ state: 'all', base: 'main', sort: 'created', direction: 'asc', per_page: '100', page: String(page) })) url.searchParams.set(key, value);
        return requestJson(url, env.GH_TOKEN);
      });
    },
    async listChecks(headSha) {
      return listChecksAcrossPages(async (page) => {
        const url = apiEndpoint(env.GITHUB_API_URL, `/repos/${REPOSITORY}/commits/${headSha}/check-runs`);
        for (const [key, value] of Object.entries({ check_name: 'KIRARI / R3 trusted verifier', filter: 'all', per_page: '100', page: String(page) })) url.searchParams.set(key, value);
        return requestJson(url, env.R3_APP_TOKEN);
      });
    },
    async updateCheck(id, payload) {
      return requestJson(apiEndpoint(env.GITHUB_API_URL, `/repos/${REPOSITORY}/check-runs/${id}`), env.R3_APP_TOKEN, { method: 'PATCH', body: payload });
    },
  };
  return revokeCachedSuccesses({ appId, adapter });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = await runRevocation({ mode: process.argv[2] });
    process.stdout.write(`${JSON.stringify(result)}\n`);
    if (result.allObservedSuccessesInvalidated === false) process.exitCode = 1;
  } catch (error) {
    process.stderr.write(`R3 revocation incomplete: ${error instanceof Error ? error.message : 'unknown error'}. No successful check was published; existing cached checks may remain.\n`);
    process.exitCode = 1;
  }
}
