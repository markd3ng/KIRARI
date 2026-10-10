import { readFile, open } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateLabConfig, assertLabRepository, LabError, requireLab, labBranch, labRulesetPayload, assertRulesetReadback, assertEffectiveRules } from './live-harness-contract.mjs';
import { createLabTransport } from './live-harness-api.mjs';

// Independent Owner settings recovery: no App key/token, check, approval, merge or production route is accessed.
export async function recoverLabRuleset(configInput, { ownerToken, mode = 'inspect', transportOptions } = {}) {
  const config = validateLabConfig(configInput); requireLab(['inspect', 'disable', 'restore'].includes(mode), 'LAB_RECOVERY_MODE_INVALID');
  const transport = createLabTransport(config, transportOptions);
  const owner = async (method, endpoint, body) => (await transport.request('owner', ownerToken, method, endpoint, body)).data;
  const repo = await owner('GET', transport.root); const user = await owner('GET', '/user'); assertLabRepository(config, repo, user);
  const rows = await owner('GET', `${transport.root}/rulesets?includes_parents=true&per_page=100`);
  requireLab(Array.isArray(rows) && rows.length < 100, 'LAB_RECOVERY_RULESET_LIST_INCOMPLETE');
  const name = labRulesetPayload(config).name; const selected = rows.filter((row) => row.name === name);
  requireLab(selected.length === 1 && Number.isSafeInteger(selected[0].id), 'LAB_RECOVERY_EXACT_RULESET_NOT_FOUND');
  const before = await owner('GET', `${transport.root}/rulesets/${selected[0].id}`);
  transport.registerRecoveryRuleset(before);
  const target = mode === 'inspect' ? before : labRulesetPayload(config, mode === 'disable' ? 'disabled' : 'active');
  if (mode !== 'inspect') await owner('PUT', `${transport.root}/rulesets/${before.id}`, target);
  const after = await owner('GET', `${transport.root}/rulesets/${before.id}`); assertRulesetReadback(after, target, before.id);
  for (let i = 0; i < 12; i += 1) {
    const rules = await owner('GET', `${transport.root}/rules/branches/${labBranch(config, i, 'base')}?per_page=100`);
    assertEffectiveRules(rules, target, before.id);
  }
  return { schema: 'kirari.lab-owner-recovery/v1', repository: config.repository, repositoryId: config.repositoryId, runId: config.runId,
    rulesetId: before.id, mode, beforeEnforcement: before.enforcement, afterEnforcement: after.enforcement,
    fullPayloadReadbackVerified: true, effectiveRulesReadbackVerified: true, noCheckDependency: true, bypassActors: 0,
    transportObservation: transport.observation(), liveGitHubVerified: transport.realTransport,
    liveRecoveryOperationVerified: transport.realTransport && mode !== 'inspect', liveRecoveryVerified: false, recoveryCycleVerified: false,
    productionMutation: false, finalGateResult: 'NOT_READY' };
}

export async function labRecoveryCli(argv = process.argv.slice(2), env = process.env) {
  requireLab(argv.length === 6 && argv[0] === '--config' && argv[2] === '--mode' && argv[4] === '--report' && path.isAbsolute(argv[1]) && path.isAbsolute(argv[5]), 'LAB_RECOVERY_EXPLICIT_ARGS_REQUIRED');
  const raw = await readFile(argv[1], 'utf8'); requireLab(Buffer.byteLength(raw) <= 16384, 'LAB_CONFIG_TOO_LARGE');
  let config; try { config = JSON.parse(raw); } catch { throw new LabError('LAB_CONFIG_JSON_INVALID'); }
  validateLabConfig(config); requireLab(!env.GITHUB_ACTIONS, 'LAB_OWNER_LOCAL_PROCESS_REQUIRED');
  const handle = await open(argv[5], 'wx', 0o600);
  try { const report = await recoverLabRuleset(config, { ownerToken: env.KIRARI_LAB_OWNER_ADMIN_TOKEN, mode: argv[3] });
    await handle.writeFile(`${JSON.stringify(report, null, 2)}\n`); return report;
  } finally { await handle.close(); }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { process.stdout.write(`${JSON.stringify(await labRecoveryCli(), null, 2)}\n`); }
  catch (error) { process.stdout.write(`${JSON.stringify({ schema: 'kirari.lab-owner-recovery-error/v1', code: error instanceof LabError ? error.code : 'LAB_RECOVERY_FAILED', liveRecoveryVerified: false, finalGateResult: 'NOT_READY' })}\n`); process.exitCode = 1; }
}
