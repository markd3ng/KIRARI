import { realpath, readFile, open } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createAppJwt, mintLabAppToken, readLabPrivateKey, revokeLabToken, createTokenCustodyLedger, getTokenCustodyLedger } from './live-harness-api.mjs';
import { LabError, requireLab } from './live-harness-contract.mjs';

const NATIVE_FETCH = globalThis.fetch;
const liveTransports = new WeakSet();
const REPOSITORY = 'markd3ng/KIRARI';
const REPOSITORY_ID = 1156039202;
const OWNER_ID = 219239532;
const ROOT = `/repos/${REPOSITORY}`;
const SOURCE_ROOT = fileURLToPath(new URL('../../', import.meta.url));

export function validateCustodyConfig(app) {
  requireLab(app && Number.isSafeInteger(app.id) && app.id > 0 && Number.isSafeInteger(app.installationId) && app.installationId > 0 &&
    typeof app.clientId === 'string' && /^[A-Za-z0-9._-]{8,100}$/.test(app.clientId) && typeof app.slug === 'string' && /^[a-z0-9-]+$/.test(app.slug), 'APP_PUBLIC_IDENTITY_CONFIG_REQUIRED');
  return { id: app.id, installationId: app.installationId, clientId: app.clientId, slug: app.slug };
}

// This transport permits metadata reads, one exact repository token mint, and revocation only.
// Production check publication, contents, refs, PRs, rulesets and settings mutations have no path.
export function createCustodyTransport(appInput, fetchImpl = NATIVE_FETCH) {
  const app = validateCustodyConfig(appInput);
  async function request(role, credential, method, endpoint, body, accepted = [200, 201, 204]) {
    requireLab(typeof credential === 'string' && credential.length >= 16 && !/[\r\n]/.test(credential), 'APP_CREDENTIAL_MISSING');
    const allowed = role === 'app-jwt' && method === 'GET' && ['/app', `${ROOT}/installation`].includes(endpoint) ||
      role === 'app-jwt' && method === 'POST' && endpoint === `/app/installations/${app.installationId}/access_tokens` &&
        (JSON.stringify(body) === JSON.stringify({ repository_ids: [REPOSITORY_ID], permissions: { checks: 'write', metadata: 'read' } }) ||
         JSON.stringify(body) === JSON.stringify({ permissions: { metadata: 'read' } })) ||
      role === 'publisher' && method === 'GET' && ['/installation/repositories?per_page=100', '/installation/repositories'].includes(endpoint) ||
      role === 'publisher' && method === 'DELETE' && endpoint === '/installation/token';
    requireLab(allowed, 'APP_CUSTODY_ENDPOINT_FORBIDDEN');
    let response;
    try {
      response = await fetchImpl(new URL(endpoint, 'https://api.github.com'), { method, redirect: 'error', signal: AbortSignal.timeout(15000),
        headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${credential}`, 'X-GitHub-Api-Version': '2026-03-10',
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    } catch { throw new LabError('APP_CUSTODY_API_UNAVAILABLE'); }
    if (!accepted.includes(response.status)) { await response.body?.cancel(); throw new LabError('APP_CUSTODY_API_REJECTED', response.status); }
    if (response.status === 204) { await response.body?.cancel(); return { status: response.status, data: null }; }
    let size = 0; const chunks = []; const reader = response.body?.getReader();
    requireLab(reader, 'APP_CUSTODY_RESPONSE_MISSING');
    try {
      while (true) { const chunk = await reader.read(); if (chunk.done) break; size += chunk.value.byteLength; requireLab(size <= 1048576, 'APP_CUSTODY_RESPONSE_TOO_LARGE'); chunks.push(Buffer.from(chunk.value)); }
      return { status: response.status, data: JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks))) };
    } catch (error) { await reader.cancel(); if (error instanceof LabError) throw error; throw new LabError('APP_CUSTODY_RESPONSE_INVALID'); }
    finally { reader.releaseLock(); }
  }
  const transport = Object.freeze({ config: Object.freeze({ repository: REPOSITORY, repositoryId: REPOSITORY_ID, ownerId: OWNER_ID }), root: ROOT, request, tokenCustodyLedger: createTokenCustodyLedger() });
  if (fetchImpl === NATIVE_FETCH) liveTransports.add(transport);
  return transport;
}

export async function inspectAppCustody({ app: input, pem, transport }) {
  const app = validateCustodyConfig(input);
  requireLab(transport?.root === ROOT && transport.config?.repositoryId === REPOSITORY_ID && transport.config.ownerId === OWNER_ID, 'APP_CUSTODY_TARGET_MISMATCH');
  const ledger = getTokenCustodyLedger(transport);
  let credential; let result; let failure;
  try {
    const identity = (await transport.request('app-jwt', createAppJwt(app, pem), 'GET', '/app')).data;
    requireLab(identity?.id === app.id && identity.client_id === app.clientId && identity.slug === app.slug && identity.owner?.id === OWNER_ID, 'APP_CUSTODY_IDENTITY_MISMATCH');
    credential = await mintLabAppToken(transport, app, pem);
    requireLab(credential.identity?.installationScopeVerified === true && credential.identity.discoveryTokenRevocationVerified === true, 'APP_CUSTODY_INSTALLATION_SCOPE_UNVERIFIED');
    result = { schema: 'kirari.production-app-readonly-custody-inspection/v1', repository: REPOSITORY, repositoryId: REPOSITORY_ID,
      observedAt: new Date().toISOString(), liveGitHubVerified: liveTransports.has(transport),
      observationKind: liveTransports.has(transport) ? 'AUTHENTICATED_GITHUB_METADATA' : 'SYNTHETIC_TRANSPORT_OBSERVATIONS', appId: app.id, appSlug: app.slug, installationId: app.installationId,
      identityVerified: true, permissionsVerified: true, permissions: { checks: 'write', metadata: 'read' }, repositorySelection: 'selected',
      installationRepositoryScopeVerified: true, isolatedShortLivedTokenScopeVerified: true, installationTokenRevocationVerified: false,
      checkPublisherProvenanceVerified: false, prCredentialIsolationVerified: false, authoritativeMergeAdmissionVerified: false,
      activationReadiness: 'NOT_READY', limitation: 'Authenticated identity/permission/scope readback does not establish private-key isolation, required-check provenance, continuing authorization or recovery.' };
    await revokeLabToken(transport, credential); credential = null;
  } catch (error) { failure = error; }
  const tokenCustody = await ledger.retryKnownTokens((issued) => revokeLabToken(transport, issued));
  if (tokenCustody.manualOwnerReconciliationRequired) {
    throw Object.assign(new LabError('APP_CUSTODY_TOKEN_RECOVERY_UNVERIFIED'), { tokenCustody });
  }
  if (failure) throw Object.assign(failure instanceof LabError ? failure : new LabError('APP_CUSTODY_INSPECTION_FAILED'), { tokenCustody });
  requireLab(tokenCustody.complete, 'APP_CUSTODY_TOKEN_RECOVERY_UNVERIFIED');
  return { ...result, installationTokenRevocationVerified: true, tokenCustody };
}

async function main() {
  requireLab(process.env.GITHUB_ACTIONS !== 'true', 'OWNER_ISOLATED_LOCAL_HOST_REQUIRED');
  const [configFile, outputFile] = process.argv.slice(2);
  requireLab(configFile && outputFile, 'USAGE_PUBLIC_APP_CONFIG_AND_OUTPUT_REQUIRED');
  const app = validateCustodyConfig(JSON.parse(await readFile(configFile, 'utf8')));
  const keyPath = await realpath(process.env.KIRARI_APP_PRIVATE_KEY_FILE ?? '');
  const relative = path.relative(SOURCE_ROOT, keyPath);
  requireLab(relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative), 'APP_KEY_MUST_BE_OUTSIDE_SOURCE_TREE');
  const pem = await readLabPrivateKey(keyPath);
  const handle = await open(outputFile, 'wx', 0o600);
  try {
    const result = await inspectAppCustody({ app, pem, transport: createCustodyTransport(app) });
    await handle.writeFile(`${JSON.stringify(result, null, 2)}\n`);
    process.stdout.write('App metadata and scoped-token inspection completed; activation remains NOT_READY.\n');
  } catch (error) {
    await handle.writeFile(`${JSON.stringify({ schema: 'kirari.production-app-custody-failure/v1', code: error instanceof LabError ? error.code : 'APP_CUSTODY_INSPECTION_FAILED', liveGitHubVerified: false, installationTokenRevocationVerified: false, tokenCustody: error.tokenCustody ?? null, activationReadiness: 'NOT_READY' }, null, 2)}\n`);
    throw error;
  } finally { await handle.close(); }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch((error) => {
  process.stderr.write(`${error instanceof LabError ? error.code : 'APP_CUSTODY_INSPECTION_FAILED'}\n`); process.exitCode = 1;
});
