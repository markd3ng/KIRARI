import http from 'node:http';
import { createHash, generateKeyPairSync, verify } from 'node:crypto';
import { LAB_SCHEMA, LAB_CHECK_NAME } from '../live-harness-contract.mjs';

export const labConfig = () => ({ schema: LAB_SCHEMA, repository: 'fixture-owner/kirari-r3-disposable-lab-contract', repositoryId: 900001,
  ownerLogin: 'fixture-owner', ownerId: 900002, runId: 'abcdef0123456789', ownerAuthorized: true, disposable: true,
  app: { id: 900003, clientId: 'Iv1.primaryfixture', installationId: 900004, slug: 'primary-lab-fixture' },
  wrongApp: { id: 900005, clientId: 'Iv1.wrongfixture', installationId: 900006, slug: 'wrong-lab-fixture' }, staleAfterSeconds: 10 });
const pair = () => generateKeyPairSync('rsa', { modulusLength: 2048, publicKeyEncoding: { type: 'spki', format: 'pem' }, privateKeyEncoding: { type: 'pkcs8', format: 'pem' } });
const PRIMARY_KEYS = pair(); const WRONG_KEYS = pair();
export const labKeys = { primary: PRIMARY_KEYS.privateKey, wrong: WRONG_KEYS.privateKey };
export const ownerToken = 'synthetic-owner-admin-fixture-token';
const sha = (value) => createHash('sha1').update(JSON.stringify(value)).digest('hex');

// Fake GitHub transport, not a live security claim. It verifies JWT signatures and keeps independent server state.
export async function startLabServer(options = {}) {
  const config = labConfig(); let clock = Date.parse('2026-10-09T00:00:00.000Z'); let nextId = 1000;
  const seed = 'a'.repeat(40); const seedTree = 'b'.repeat(40); const root = `/repos/${config.repository}`;
  const refs = new Map([['main', seed]]); const commits = new Map([[seed, { sha: seed, tree: { sha: seedTree }, parents: [] }]]);
  const pulls = new Map(); const comments = new Map(); const tokens = new Map(); const checks = new Map(); const rulesets = new Map(); const requests = [];
  const permissions = { checks: 'write', metadata: 'read' };
  const repo = { id: config.repositoryId, full_name: config.repository, private: true, fork: false, archived: false, default_branch: 'main',
    allow_merge_commit: true, owner: { id: config.ownerId, login: config.ownerLogin, type: 'User' }, permissions: { admin: true }, ...options.repositoryDelta };
  function jwtApp(token) {
    try {
      const [header, body, signature] = token.split('.'); const claims = JSON.parse(Buffer.from(body, 'base64url'));
      const app = claims.iss === config.app.clientId ? config.app : claims.iss === config.wrongApp.clientId ? config.wrongApp : null;
      const key = app?.id === config.app.id ? PRIMARY_KEYS.publicKey : WRONG_KEYS.publicKey;
      if (!app || JSON.parse(Buffer.from(header, 'base64url')).alg !== 'RS256' || claims.iat !== Math.floor(clock / 1000) - 60 || claims.exp > Math.floor(clock / 1000) + 600 || claims.exp <= clock / 1000 || !verify('RSA-SHA256', Buffer.from(`${header}.${body}`), key, Buffer.from(signature, 'base64url'))) return null;
      return app;
    } catch { return null; }
  }
  function prJson(pr) {
    return { number: pr.number, state: pr.state, merged: pr.merged, mergeable: true, merge_commit_sha: pr.mergedSha ?? null,
      head: { ref: pr.head, sha: refs.get(pr.head), repo: { id: config.repositoryId, full_name: config.repository } },
      base: { ref: pr.base, sha: refs.get(pr.base), repo: { id: config.repositoryId, full_name: config.repository } } };
  }
  const effective = (branch) => [...rulesets.values()].filter((ruleset) => ruleset.enforcement === 'active' && ruleset.conditions.ref_name.include.includes(`refs/heads/${branch}`))
    .flatMap((ruleset) => ruleset.rules.map((rule) => ({ ...rule, ruleset_id: ruleset.id, ruleset_source_type: 'Repository', ruleset_source: config.repository })));
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1'); const endpoint = url.pathname;
    let raw = ''; for await (const chunk of req) raw += chunk;
    let body; try { body = raw ? JSON.parse(raw) : undefined; } catch { res.writeHead(400).end(); return; }
    const bearer = req.headers.authorization?.slice(7); const jwt = jwtApp(bearer ?? ''); const token = tokens.get(bearer); const owner = bearer === ownerToken;
    requests.push({ method: req.method, path: endpoint, query: url.search, body, credentialKind: owner ? 'owner' : jwt ? 'jwt' : token ? 'installation' : 'unknown', appId: jwt?.id ?? token?.appId });
    function send(status, value) { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(status === 204 ? '' : JSON.stringify(value)); }
    if (options.respond) { const custom = options.respond({ method: req.method, endpoint, body, state: { rulesets, requests, tokens, refs, pulls }, owner, jwt, token });
      if (custom) { if (custom.headers) res.writeHead(custom.status, custom.headers).end(custom.raw ?? ''); else send(custom.status, custom.data); return; } }
    if (!owner && !jwt && (!token || token.revoked)) { send(401, { message: 'synthetic unauthorized' }); return; }
    if (endpoint === '/app' && req.method === 'GET' && jwt) {
      send(200, { id: jwt.id, client_id: jwt.clientId, slug: jwt.slug, owner: { id: config.ownerId }, permissions, ...options.appDelta }); return;
    }
    if (endpoint === `${root}/installation` && jwt) { send(200, { id: jwt.installationId, app_id: jwt.id, account: { id: config.ownerId },
      repository_selection: 'selected', suspended_at: null, permissions, ...options.installationDelta }); return; }
    if (endpoint === `/app/installations/${jwt?.installationId}/access_tokens` && req.method === 'POST') {
      const value = `synthetic-installation-token-${nextId++}`; const tokenPermissions = body.permissions;
      tokens.set(value, { appId: jwt.id, permissions: tokenPermissions, revoked: false, scoped: body.repository_ids !== undefined });
      const delta = options.mintDelta?.({ body, app: jwt }) ?? {};
      send(201, { token: value, expires_at: new Date(clock + 3600000).toISOString(), permissions: tokenPermissions, repository_selection: 'selected', ...delta }); return;
    }
    if (endpoint === '/installation/token' && req.method === 'DELETE' && token) { token.revoked = true; send(204); return; }
    if (endpoint === '/installation/repositories' && token) {
      const selected = !token.scoped && options.installationRepositoryCount === 2 ? [{ id: config.repositoryId, full_name: config.repository }, { id: 900099, full_name: 'fixture-owner/other-repo' }] : [{ id: config.repositoryId, full_name: config.repository }];
      send(200, { total_count: selected.length, repositories: selected }); return;
    }
    if (endpoint === '/user' && owner) { send(200, { id: config.ownerId, login: config.ownerLogin }); return; }
    if (endpoint === root && owner) { send(200, repo); return; }
    if (endpoint === `${root}/actions/permissions` && owner) { send(200, { enabled: options.actionsEnabled ?? false }); return; }
    if (endpoint.startsWith(`${root}/git/ref/heads/`) && req.method === 'GET' && owner) {
      const branch = decodeURIComponent(endpoint.slice(`${root}/git/ref/heads/`.length));
      send(refs.has(branch) ? 200 : 404, refs.has(branch) ? { ref: `refs/heads/${branch}`, object: { sha: refs.get(branch) } } : {}); return;
    }
    if (endpoint.startsWith(`${root}/git/commits/`) && req.method === 'GET' && owner) { const commit = commits.get(endpoint.split('/').at(-1)); send(commit ? 200 : 404, commit ?? {}); return; }
    if (endpoint === `${root}/git/blobs` && req.method === 'POST' && owner) { send(201, { sha: sha(body) }); return; }
    if (endpoint === `${root}/git/trees` && req.method === 'POST' && owner) { send(201, { sha: sha(body) }); return; }
    if (endpoint === `${root}/git/commits` && req.method === 'POST' && owner) { const id = sha(body); const commit = { sha: id, tree: { sha: body.tree }, parents: body.parents };
      commits.set(id, commit); send(201, commit); return; }
    if (endpoint === `${root}/git/refs` && req.method === 'POST' && owner) {
      const branch = body.ref.slice(11); if (refs.has(branch)) { send(422, {}); return; } refs.set(branch, body.sha); send(201, { ref: body.ref, object: { sha: body.sha } }); return;
    }
    if (endpoint.startsWith(`${root}/git/refs/heads/`) && owner) {
      const branch = endpoint.slice(`${root}/git/refs/heads/`.length);
      if (effective(branch).length) { send(405, {}); return; }
      if (req.method === 'DELETE') { refs.delete(branch); send(204); return; }
      if (req.method === 'PATCH') { refs.set(branch, body.sha); send(200, { ref: `refs/heads/${branch}`, object: { sha: body.sha } }); return; }
    }
    if (endpoint === `${root}/pulls` && req.method === 'POST' && owner) {
      const number = nextId++; const pr = { number, head: body.head, base: body.base, state: 'open', merged: false }; pulls.set(number, pr); send(201, prJson(pr)); return;
    }
    const prMatch = endpoint.match(/\/pulls\/(\d+)(\/merge)?$/);
    if (prMatch && owner) {
      const pr = pulls.get(Number(prMatch[1])); if (!pr) { send(404, {}); return; }
      if (req.method === 'GET') { send(200, prJson(pr)); return; }
      if (req.method === 'PATCH') { pr.state = body.state; send(200, prJson(pr)); return; }
      if (req.method === 'PUT' && prMatch[2]) {
        if (body.sha !== refs.get(pr.head)) { send(409, {}); return; }
        const rules = effective(pr.base); const required = rules.find((rule) => rule.type === 'required_status_checks')?.parameters.required_status_checks ?? [];
        const satisfies = required.every((expected) => [...checks.values()].some((check) => check.head_sha === body.sha && check.name === expected.context && check.app.id === expected.integration_id && check.conclusion === 'success'));
        if (!satisfies) { send(405, { message: 'synthetic required App check blocked merge' }); return; }
        pr.merged = true; pr.state = 'closed'; pr.mergedSha = sha({ head: body.sha, base: refs.get(pr.base), number: pr.number }); refs.set(pr.base, pr.mergedSha);
        send(200, { merged: true, sha: pr.mergedSha }); return;
      }
    }
    const commentCreate = endpoint.match(/\/issues\/(\d+)\/comments$/);
    if (commentCreate && req.method === 'POST' && owner) { const id = nextId++; const comment = { id, body: body.body, user: { id: config.ownerId, login: config.ownerLogin } }; comments.set(id, comment); send(201, comment); return; }
    const commentEdit = endpoint.match(/\/issues\/comments\/(\d+)$/);
    if (commentEdit && owner) { const comment = comments.get(Number(commentEdit[1])); if (!comment) { send(404, {}); return; }
      if (req.method === 'PATCH') comment.body = body.body; send(200, comment); return; }
    if (endpoint === `${root}/rulesets` && owner) {
      if (req.method === 'GET') { send(200, [...rulesets.values()]); return; }
      if (req.method === 'POST') { const id = nextId++; const ruleset = { id, ...body }; rulesets.set(id, ruleset); send(201, ruleset); return; }
    }
    const rulesetMatch = endpoint.match(/\/rulesets\/(\d+)$/);
    if (rulesetMatch && owner) { const id = Number(rulesetMatch[1]); if (!rulesets.has(id)) { send(404, {}); return; }
      if (req.method === 'DELETE') { rulesets.delete(id); send(204); return; }
      if (req.method === 'PUT') rulesets.set(id, { id, ...body }); send(200, rulesets.get(id)); return; }
    if (endpoint.startsWith(`${root}/rules/branches/`) && owner) { send(200, effective(endpoint.split('/').at(-1))); return; }
    if (endpoint === `${root}/check-runs` && req.method === 'POST' && token?.permissions.checks === 'write') {
      const id = nextId++; const check = { id, ...body, app: { id: options.checkAppId ?? token.appId } }; checks.set(id, check); send(201, check); return;
    }
    const checkMatch = endpoint.match(/\/check-runs\/(\d+)$/);
    if (checkMatch && token?.permissions.checks === 'write') { const check = checks.get(Number(checkMatch[1])); if (!check) { send(404, {}); return; }
      if (req.method === 'PATCH') Object.assign(check, body); send(200, check); return; }
    const checkList = endpoint.match(/\/commits\/([a-f0-9]{40})\/check-runs$/);
    if (checkList && token?.permissions.checks === 'write') { const matches = [...checks.values()].filter((check) => check.head_sha === checkList[1] && check.name === LAB_CHECK_NAME); send(200, { total_count: matches.length, check_runs: matches }); return; }
    send(404, { message: 'unhandled fake endpoint' });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return { config, root, keys: labKeys, ownerToken, requests, state: { refs, pulls, comments, tokens, checks, rulesets, seed },
    now: () => clock, wait: async (ms) => { clock += ms; }, origin: `http://127.0.0.1:${server.address().port}`,
    close: () => new Promise((resolve) => { server.close(resolve); server.closeAllConnections(); }) };
}
