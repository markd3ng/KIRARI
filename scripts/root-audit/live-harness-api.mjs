import { createPrivateKey, sign } from 'node:crypto';
import { constants } from 'node:fs';
import { open } from 'node:fs/promises';
import { LabError, requireLab, validateLabConfig, assertMinimalAppPermissions, assertLabBranch, labRulesetPayload, assertRulesetReadback, isSha } from './live-harness-contract.mjs';

const API_ORIGIN = 'https://api.github.com';
const NATIVE_FETCH = globalThis.fetch;
const MAX_RESPONSE = 2 * 1024 * 1024;
const custodyLedgers = new WeakSet();
const transportLedgers = new WeakMap();

// Secret token strings exist only in this closure. Reports expose whitelisted receipt metadata.
export function createTokenCustodyLedger({ now = Date.now } = {}) {
  const receipts = new Map(); let sequence = 0;
  const publicPermissions = (permissions) => Object.fromEntries(['checks', 'metadata', 'contents', 'administration', 'pull_requests', 'issues', 'actions']
    .filter((key) => ['read', 'write'].includes(permissions?.[key])).map((key) => [key, permissions[key]]));
  const matches = (credential) => [...receipts.values()].filter((receipt) => receipt.token === credential.token &&
    (credential.appId === undefined || receipt.appId === credential.appId));
  const report = () => {
    const rows = [...receipts.values()]; const known = rows.filter((receipt) => receipt.issuance === 'KNOWN_TOKEN');
    const unknown = rows.filter((receipt) => ['PENDING', 'UNKNOWN_ISSUANCE'].includes(receipt.issuance));
    const unique = new Set(known.map((receipt) => `${receipt.appId}:${receipt.token}`));
    const allKnownTokensRevoked = known.length > 0 && known.every((receipt) => receipt.revocation === 'VERIFIED');
    return { schema: 'kirari.app-token-custody/v1', mintRequestsAttempted: rows.length, noMintAttempted: rows.length === 0,
      knownTokensIssued: unique.size, unknownIssuances: unknown.length, allKnownTokensRevoked,
      complete: rows.length > 0 && unknown.length === 0 && allKnownTokensRevoked,
      manualOwnerReconciliationRequired: unknown.length > 0 || known.some((receipt) => receipt.revocation !== 'VERIFIED'),
      receipts: rows.map(({ token, ...receipt }) => structuredClone(receipt)) };
  };
  const ledger = Object.freeze({
    beforeMint({ appId, installationId, scope, repositoryIds = [], permissions }) {
      requireLab(Number.isSafeInteger(appId) && appId > 0 && Number.isSafeInteger(installationId) && installationId > 0 &&
        ['installation-metadata-discovery', 'repository-checks'].includes(scope) && Array.isArray(repositoryIds) && repositoryIds.every((id) => Number.isSafeInteger(id) && id > 0), 'LAB_TOKEN_CUSTODY_RECEIPT_INVALID');
      const id = ++sequence;
      receipts.set(id, { id, appId, installationId, scope, repositoryIds: [...repositoryIds], requestedPermissions: publicPermissions(permissions),
        requestStartedAt: new Date(now()).toISOString(), expectedMaximumLifetimeSeconds: 3600, issuance: 'PENDING',
        expiresAt: null, revocation: 'NOT_ATTEMPTED', revocationAttempts: 0 });
      return id;
    },
    recordMintResponse(id, minted) {
      const receipt = receipts.get(id); requireLab(receipt && receipt.issuance === 'PENDING', 'LAB_TOKEN_CUSTODY_RECEIPT_INVALID');
      receipt.observedPermissions = publicPermissions(minted?.permissions);
      if (typeof minted?.expires_at === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(minted.expires_at) && Number.isFinite(Date.parse(minted.expires_at))) receipt.expiresAt = new Date(minted.expires_at).toISOString();
      if (typeof minted?.token === 'string' && minted.token.length >= 16 && !/[\r\n]/.test(minted.token)) {
        receipt.token = minted.token; receipt.issuance = 'KNOWN_TOKEN';
      } else receipt.issuance = 'UNKNOWN_ISSUANCE';
    },
    recordMintFailure(id, error) {
      const receipt = receipts.get(id); requireLab(receipt, 'LAB_TOKEN_CUSTODY_RECEIPT_INVALID');
      if (receipt.issuance !== 'PENDING') return;
      receipt.issuance = error instanceof LabError && [400, 401, 403, 404, 422].includes(error.status) ? 'NOT_ISSUED_CONFIRMED_REJECTION' : 'UNKNOWN_ISSUANCE';
    },
    beforeRevocation(credential) {
      for (const receipt of matches(credential)) { receipt.revocationAttempts += 1; receipt.revocation = 'ATTEMPTED'; }
    },
    hasKnownToken(credential) { return matches(credential).some((receipt) => receipt.issuance === 'KNOWN_TOKEN'); },
    finishRevocation(credential, verified, error) {
      for (const receipt of matches(credential)) {
        receipt.revocation = verified ? 'VERIFIED' : 'FAILED';
        delete receipt.revocationHttpStatus;
        if (!verified && Number.isInteger(error?.status) && error.status >= 100 && error.status <= 599) receipt.revocationHttpStatus = error.status;
      }
    },
    async retryKnownTokens(revoke) {
      const pending = new Map();
      for (const receipt of receipts.values()) if (receipt.issuance === 'KNOWN_TOKEN' && receipt.revocation !== 'VERIFIED') {
        pending.set(`${receipt.appId}:${receipt.token}`, { token: receipt.token, appId: receipt.appId });
      }
      for (const credential of pending.values()) {
        const first = matches(credential)[0]; const priorAttempts = first.revocationAttempts;
        try {
          const proof = await revoke(credential);
          requireLab(proof?.verified === true, 'LAB_TOKEN_REVOCATION_PROOF_MISSING');
          if (first.revocationAttempts === priorAttempts) ledger.beforeRevocation(credential);
          ledger.finishRevocation(credential, true);
        } catch (error) {
          if (first.revocationAttempts === priorAttempts) ledger.beforeRevocation(credential);
          ledger.finishRevocation(credential, false, error);
        }
      }
      return report();
    },
    report,
  });
  custodyLedgers.add(ledger); return ledger;
}

export function getTokenCustodyLedger(transport) {
  if (transport.tokenCustodyLedger !== undefined) {
    requireLab(custodyLedgers.has(transport.tokenCustodyLedger), 'LAB_TOKEN_CUSTODY_LEDGER_INVALID');
    return transport.tokenCustodyLedger;
  }
  if (!transportLedgers.has(transport)) transportLedgers.set(transport, createTokenCustodyLedger());
  return transportLedgers.get(transport);
}

export async function readLabPrivateKey(file) {
  requireLab(typeof file === 'string' && file.startsWith('/'), 'LAB_APP_PRIVATE_KEY_PATH_REQUIRED');
  let handle;
  try {
    handle = await open(file, constants.O_RDONLY | constants.O_NOFOLLOW);
    const stat = await handle.stat();
    requireLab(stat.isFile() && stat.size > 0 && stat.size <= 16384 && (stat.mode & 0o077) === 0 && stat.uid === process.getuid?.(), 'LAB_PRIVATE_KEY_CUSTODY_UNSAFE');
    return await handle.readFile('utf8');
  } catch (error) { if (error instanceof LabError) throw error; throw new LabError('LAB_PRIVATE_KEY_UNREADABLE'); }
  finally { await handle?.close(); }
}

export function createAppJwt(app, pem, now = Date.now()) {
  requireLab(typeof pem === 'string' && pem.length > 0, 'LAB_APP_CREDENTIAL_MISSING');
  try {
    const key = createPrivateKey(pem);
    requireLab(key.asymmetricKeyType === 'rsa' && key.asymmetricKeyDetails.modulusLength >= 2048, 'LAB_APP_RSA_KEY_REQUIRED');
    const part = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
    const content = `${part({ alg: 'RS256', typ: 'JWT' })}.${part({ iat: Math.floor(now / 1000) - 60, exp: Math.floor(now / 1000) + 540, iss: app.clientId })}`;
    return `${content}.${sign('RSA-SHA256', Buffer.from(content), key).toString('base64url')}`;
  } catch (error) { if (error instanceof LabError) throw error; throw new LabError('LAB_APP_KEY_INVALID'); }
}

// An injectable fetch connects the same transport to a local HTTP server in tests. CLI origin is fixed.
export function createLabTransport(configInput, { fetchImpl = NATIVE_FETCH, origin = API_ORIGIN, testTransport = false, timeoutMs = 15000, mutationDelayMs = 1000,
  tokenCustodyLedger = createTokenCustodyLedger() } = {}) {
  const config = validateLabConfig(configInput);
  const parsed = new URL(origin);
  requireLab(origin === API_ORIGIN || (testTransport === true && parsed.protocol === 'http:' && ['127.0.0.1', '[::1]'].includes(parsed.hostname) && parsed.pathname === '/'), 'LAB_API_ORIGIN_FORBIDDEN');
  requireLab(Number.isInteger(timeoutMs) && timeoutMs > 0 && timeoutMs <= 30000 && Number.isInteger(mutationDelayMs) && mutationDelayMs >= 0 && mutationDelayMs <= 5000, 'LAB_TRANSPORT_LIMIT_INVALID');
  const repoRoot = `/repos/${config.repository}`;
  const realTransport = origin === API_ORIGIN && fetchImpl === NATIVE_FETCH && testTransport === false;
  let requestAttempts = 0; let responsesReceived = 0;
  let previousMutation = 0;
  const faults = new Set();
  const createdRulesets = new Set(); const createdPrs = new Set(); const createdComments = new Set(); const createdChecks = new Set(); const fixtureHeads = new Set();
  function allowedPath(pathname, role) {
    if (role === 'app-jwt') return pathname === '/app' || pathname === `${repoRoot}/installation` || pathname === `/app/installations/${config.app.installationId}/access_tokens` || pathname === `/app/installations/${config.wrongApp.installationId}/access_tokens`;
    if (role === 'publisher') return pathname === '/installation/token' || pathname === '/installation/repositories' || pathname === repoRoot || pathname.startsWith(`${repoRoot}/check-runs`) || pathname.startsWith(`${repoRoot}/commits/`);
    return role === 'owner' && (pathname === '/user' || pathname === repoRoot || pathname.startsWith(`${repoRoot}/`));
  }
  function allowedMutation(role, method, pathname, body) {
    if (method === 'GET') return;
    if (role === 'app-jwt') {
      requireLab(method === 'POST' && pathname.endsWith('/access_tokens') && [
        { permissions: { metadata: 'read' } },
        { repository_ids: [config.repositoryId], permissions: { checks: 'write', metadata: 'read' } },
      ].some((permitted) => JSON.stringify(body) === JSON.stringify(permitted)), 'LAB_APP_TOKEN_SCOPE_FORBIDDEN'); return;
    }
    if (role === 'publisher') {
      if (method === 'DELETE' && pathname === '/installation/token') return;
      if (method === 'POST' && pathname === `${repoRoot}/check-runs`) { requireLab(body?.name === 'KIRARI nonproduction admission fixture' && fixtureHeads.has(body.head_sha) && body.external_id?.startsWith(`nonproduction:${config.runId}:`), 'LAB_CHECK_PAYLOAD_FORBIDDEN'); return; }
      const id = Number(pathname.split('/').at(-1));
      requireLab(method === 'PATCH' && pathname === `${repoRoot}/check-runs/${id}` && createdChecks.has(id) && body?.conclusion === 'failure', 'LAB_PUBLISHER_MUTATION_FORBIDDEN'); return;
    }
    if (pathname === `${repoRoot}/git/blobs`) { requireLab(method === 'POST' && body?.encoding === 'utf-8' && typeof body.content === 'string' && body.content.length <= 16384, 'LAB_BLOB_PAYLOAD_FORBIDDEN'); return; }
    if (pathname === `${repoRoot}/git/trees`) { requireLab(method === 'POST' && isSha(body?.base_tree) && Array.isArray(body.tree) && body.tree.length === 1 &&
      body.tree.every((entry) => entry.path?.startsWith(`fixtures/${config.runId}/`) && !entry.path.includes('..') && entry.mode === '100644' && entry.type === 'blob' && isSha(entry.sha)), 'LAB_TREE_PAYLOAD_FORBIDDEN'); return; }
    if (pathname === `${repoRoot}/git/commits`) { requireLab(method === 'POST' && body?.message?.startsWith(`KIRARI disposable lab ${config.runId} `) && isSha(body.tree) && body.parents?.length === 1 && isSha(body.parents[0]), 'LAB_COMMIT_PAYLOAD_FORBIDDEN'); return; }
    if (pathname === `${repoRoot}/git/refs`) { requireLab(method === 'POST' && body?.ref?.startsWith('refs/heads/') && isSha(body.sha), 'LAB_REF_PAYLOAD_FORBIDDEN'); assertLabBranch(config, body.ref.slice(11)); return; }
    if (pathname.startsWith(`${repoRoot}/git/refs/heads/`)) { assertLabBranch(config, pathname.slice(`${repoRoot}/git/refs/heads/`.length));
      requireLab(method === 'DELETE' || (method === 'PATCH' && body?.force === false && isSha(body.sha)), 'LAB_REF_MUTATION_FORBIDDEN'); return; }
    if (pathname === `${repoRoot}/rulesets`) { requireLab(method === 'POST' && body?.enforcement === 'disabled', 'LAB_RULESET_CREATE_MUST_START_DISABLED'); assertRulesetReadback({ id: 1, ...body }, labRulesetPayload(config)); return; }
    const rulesetId = Number(pathname.slice(`${repoRoot}/rulesets/`.length));
    if (pathname === `${repoRoot}/rulesets/${rulesetId}`) { requireLab(createdRulesets.has(rulesetId), 'LAB_FOREIGN_RULESET_MUTATION_FORBIDDEN');
      requireLab(method === 'DELETE' || method === 'PUT', 'LAB_RULESET_METHOD_FORBIDDEN'); if (method === 'PUT') assertRulesetReadback({ id: rulesetId, ...body }, labRulesetPayload(config, body?.enforcement), rulesetId); return; }
    if (pathname === `${repoRoot}/pulls`) { requireLab(method === 'POST', 'LAB_PR_CREATE_METHOD_FORBIDDEN'); assertLabBranch(config, body?.head); assertLabBranch(config, body?.base); return; }
    const prMatch = pathname.match(/\/pulls\/(\d+)(\/merge)?$/);
    if (prMatch) { requireLab(createdPrs.has(Number(prMatch[1])), 'LAB_FOREIGN_PR_MUTATION_FORBIDDEN');
      requireLab(prMatch[2] ? method === 'PUT' && isSha(body?.sha) && body.merge_method === 'merge' : method === 'PATCH' && body?.state === 'closed' && Object.keys(body).length === 1, 'LAB_PR_MUTATION_FORBIDDEN'); return; }
    const commentCreate = pathname.match(/\/issues\/(\d+)\/comments$/);
    if (commentCreate) { requireLab(method === 'POST' && createdPrs.has(Number(commentCreate[1])) && body?.body?.startsWith('KIRARI_NONPRODUCTION_LAB_DECISION_V1\n'), 'LAB_DECISION_CREATE_FORBIDDEN'); return; }
    const commentEdit = pathname.match(/\/issues\/comments\/(\d+)$/);
    requireLab(commentEdit && method === 'PATCH' && createdComments.has(Number(commentEdit[1])) && body?.body?.startsWith('KIRARI_NONPRODUCTION_LAB_DECISION_V1\n'), 'LAB_OWNER_MUTATION_FORBIDDEN');
  }
  async function request(role, credential, method, endpoint, body, accepted = [200, 201, 204]) {
    requireLab(typeof credential === 'string' && credential.length >= 16 && !/[\r\n]/.test(credential), 'LAB_CREDENTIAL_MISSING');
    requireLab(typeof endpoint === 'string' && endpoint.startsWith('/') && !endpoint.includes('..') && !endpoint.includes('\\') && !endpoint.includes('%2f'), 'LAB_API_PATH_FORBIDDEN');
    const url = new URL(endpoint, origin);
    requireLab(url.origin === parsed.origin && !url.hash && allowedPath(url.pathname, role), 'LAB_API_PATH_FORBIDDEN');
    allowedMutation(role, method, url.pathname, body);
    if (faults.has(`${role}:${method}:${url.pathname}`)) throw new LabError('LAB_INJECTED_GITHUB_API_OUTAGE', 503);
    if (method !== 'GET' && mutationDelayMs) {
      const delay = mutationDelayMs - (Date.now() - previousMutation);
      if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
      previousMutation = Date.now();
    }
    let response;
    requestAttempts += 1;
    try { response = await fetchImpl(url, { method, redirect: 'manual', signal: AbortSignal.timeout(timeoutMs),
      headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${credential}`, 'X-GitHub-Api-Version': '2026-03-10',
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }); }
    catch { throw new LabError('LAB_HTTP_UNAVAILABLE'); }
    responsesReceived += 1;
    if (!accepted.includes(response.status)) { await response.body?.cancel(); throw new LabError('LAB_HTTP_REJECTED', response.status); }
    requireLab(response.status < 300 || response.status >= 400, 'LAB_HTTP_REDIRECT_FORBIDDEN');
    if (response.status === 204 || response.status === 404) { await response.body?.cancel(); return { status: response.status, data: null }; }
    const reader = response.body?.getReader();
    requireLab(reader, 'LAB_HTTP_BODY_MISSING');
    let bytes = 0; const chunks = [];
    try {
      while (true) { const chunk = await reader.read(); if (chunk.done) break; bytes += chunk.value.length;
        requireLab(bytes <= MAX_RESPONSE, 'LAB_HTTP_BODY_TOO_LARGE'); chunks.push(Buffer.from(chunk.value)); }
      const data = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)));
      if (response.status === 201 && method === 'POST') {
        if (url.pathname === `${repoRoot}/rulesets` && Number.isSafeInteger(data.id)) createdRulesets.add(data.id);
        if (url.pathname === `${repoRoot}/pulls` && Number.isSafeInteger(data.number)) {
          createdPrs.add(data.number);
          if (data.head?.ref === body.head && data.base?.ref === body.base && data.head?.repo?.id === config.repositoryId && data.base?.repo?.id === config.repositoryId && isSha(data.head?.sha)) fixtureHeads.add(data.head.sha);
        }
        if (/\/issues\/\d+\/comments$/.test(url.pathname) && Number.isSafeInteger(data.id)) createdComments.add(data.id);
        if (url.pathname === `${repoRoot}/check-runs` && Number.isSafeInteger(data.id)) createdChecks.add(data.id);
      }
      return { status: response.status, data };
    } catch (error) { await reader.cancel(); if (error instanceof LabError) throw error; throw new LabError('LAB_HTTP_JSON_INVALID'); }
    finally { reader.releaseLock(); }
  }
  requireLab(custodyLedgers.has(tokenCustodyLedger), 'LAB_TOKEN_CUSTODY_LEDGER_INVALID');
  return { config, testTransport: !realTransport, realTransport, root: repoRoot, request, tokenCustodyLedger,
    observation: () => ({ realTransport, requestAttempts, responsesReceived }),
    registerRecoveryRuleset(rule) {
      requireLab(['active', 'disabled'].includes(rule?.enforcement), 'LAB_RECOVERY_RULESET_ENFORCEMENT_INVALID');
      assertRulesetReadback(rule, labRulesetPayload(config, rule.enforcement)); createdRulesets.add(rule.id);
    },
    injectFault(role, method, endpoint) { const key = `${role}:${method}:${new URL(endpoint, origin).pathname}`; faults.add(key); return () => faults.delete(key); } };
}

export async function mintLabAppToken(transport, app, pem, now = Date.now()) {
  const ledger = getTokenCustodyLedger(transport);
  const jwt = createAppJwt(app, pem, now);
  const identity = (await transport.request('app-jwt', jwt, 'GET', '/app')).data;
  requireLab(identity?.id === app.id && identity.client_id === app.clientId && identity.owner?.id === transport.config.ownerId &&
    (app.slug === undefined || identity.slug === app.slug), 'LAB_APP_IDENTITY_MISMATCH');
  assertMinimalAppPermissions(identity.permissions);
  const installation = (await transport.request('app-jwt', jwt, 'GET', `${transport.root}/installation`)).data;
  requireLab(installation?.id === app.installationId && installation.app_id === app.id && installation.repository_selection === 'selected' && installation.suspended_at === null && installation.account?.id === transport.config.ownerId, 'LAB_APP_INSTALLATION_MISMATCH');
  assertMinimalAppPermissions(installation.permissions);
  // A narrowed token alone cannot prove that the installation is selected on exactly one repository.
  // Discover the complete installation inventory using a token incapable of publishing checks.
  const issue = async (scope, body) => {
    const receipt = ledger.beforeMint({ appId: app.id, installationId: app.installationId, scope,
      repositoryIds: body.repository_ids ?? [], permissions: body.permissions });
    try {
      const data = (await transport.request('app-jwt', jwt, 'POST', `/app/installations/${app.installationId}/access_tokens`, body)).data;
      ledger.recordMintResponse(receipt, data);
      requireLab(typeof data?.token === 'string' && data.token.length >= 16 && !/[\r\n]/.test(data.token), 'LAB_APP_TOKEN_RESPONSE_INVALID');
      return data;
    } catch (error) { ledger.recordMintFailure(receipt, error); throw error; }
  };
  const discovery = await issue('installation-metadata-discovery', { permissions: { metadata: 'read' } });
  try {
    requireLab(Object.keys(discovery.permissions ?? {}).join(',') === 'metadata' && discovery.permissions.metadata === 'read', 'LAB_APP_DISCOVERY_PERMISSIONS_INVALID');
    requireLab(Date.parse(discovery.expires_at) > now && Date.parse(discovery.expires_at) <= now + 3660000 && discovery.repository_selection === 'selected', 'LAB_APP_DISCOVERY_EXPIRY_OR_SELECTION_INVALID');
    const inventory = (await transport.request('publisher', discovery.token, 'GET', '/installation/repositories?per_page=100')).data;
    requireLab(inventory?.total_count === 1 && inventory.repositories?.length === 1 && inventory.repositories[0].id === transport.config.repositoryId && inventory.repositories[0].full_name === transport.config.repository, 'LAB_APP_INSTALLATION_REPOSITORY_SCOPE_INVALID');
  } finally { await revokeLabToken(transport, { token: discovery.token, appId: app.id }); }
  const minted = await issue('repository-checks',
    { repository_ids: [transport.config.repositoryId], permissions: { checks: 'write', metadata: 'read' } });
  const token = minted.token;
  try {
    assertMinimalAppPermissions(minted.permissions);
    requireLab(Date.parse(minted.expires_at) > now && Date.parse(minted.expires_at) <= now + 3660000 && minted.repository_selection === 'selected', 'LAB_APP_TOKEN_EXPIRY_OR_SELECTION_INVALID');
    const selected = (await transport.request('publisher', token, 'GET', '/installation/repositories?per_page=100')).data;
    requireLab(selected?.total_count === 1 && selected.repositories?.length === 1 && selected.repositories[0].id === transport.config.repositoryId && selected.repositories[0].full_name === transport.config.repository, 'LAB_APP_TOKEN_REPOSITORY_SCOPE_INVALID');
    return { token, appId: app.id, expiresAt: minted.expires_at, identity: { id: identity.id, slug: identity.slug,
      ownerId: identity.owner.id, installationId: installation.id, permissions: minted.permissions,
      repositorySelection: minted.repository_selection, installationScopeVerified: true, discoveryTokenRevocationVerified: true,
      selectedRepositoryIds: selected.repositories.map(({ id }) => id) } };
  } catch (error) { await revokeLabToken(transport, { token, appId: app.id }); throw error; }
}

export async function revokeLabToken(transport, credential) {
  requireLab(typeof credential?.token === 'string' && credential.token.length >= 16, 'LAB_APP_CREDENTIAL_MISSING');
  const ledger = getTokenCustodyLedger(transport);
  requireLab(ledger.hasKnownToken(credential), 'LAB_TOKEN_CUSTODY_CREDENTIAL_UNKNOWN');
  ledger.beforeRevocation(credential);
  try {
    await transport.request('publisher', credential.token, 'DELETE', '/installation/token', undefined, [204, 401]);
    const rejected = await transport.request('publisher', credential.token, 'GET', '/installation/repositories', undefined, [401]);
    requireLab(rejected.status === 401, 'LAB_APP_TOKEN_REVOCATION_UNVERIFIED');
    ledger.finishRevocation(credential, true); return { verified: true, appId: credential.appId };
  } catch (error) { ledger.finishRevocation(credential, false, error); throw error; }
}
