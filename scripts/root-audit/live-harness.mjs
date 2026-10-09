import { readFile, open, realpath } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assessFinalAdmissionCapability } from './final-admission.mjs';
import { LabError, requireLab, validateLabConfig, LAB_CASES } from './live-harness-contract.mjs';
import { createLabTransport, createTokenCustodyLedger, readLabPrivateKey, mintLabAppToken, revokeLabToken } from './live-harness-api.mjs';
import { LabSession } from './live-harness-session.mjs';
import { executeLabCases } from './live-harness-cases.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const sleep = (duration) => new Promise((resolve) => setTimeout(resolve, duration));
const safeError = (error) => ({ code: error instanceof LabError ? error.code : 'LAB_UNEXPECTED_FAILURE', ...(Number.isInteger(error?.status) && error.status >= 100 && error.status <= 599 ? { httpStatus: error.status } : {}) });

export async function runLiveHarness(configInput, { ownerToken, loadAppKeys, transportOptions, now = Date.now, wait = sleep, progress } = {}) {
  // Do not reorder: refusal precedes transport construction, environment/key access by loadAppKeys, or HTTP.
  const config = validateLabConfig(configInput);
  const ledger = createTokenCustodyLedger({ now });
  const transport = createLabTransport(config, { ...transportOptions, tokenCustodyLedger: ledger });
  const session = new LabSession(config, transport, ownerToken, now, wait);
  const report = { schema: 'kirari.live-harness-result/v1', repository: config.repository, repositoryId: config.repositoryId, runId: config.runId,
    visibility: config.visibility, startedAt: new Date(now()).toISOString(), isolationLevel: transport.testTransport ? 'HTTP_INTEGRATION_FAKE_GITHUB' : 'REAL_DISPOSABLE_GITHUB_LAB',
    liveGitHubVerified: false, labRunComplete: false, cases: [], finalAdmissionCapability: assessFinalAdmissionCapability(),
    finalGateResult: 'NOT_READY', productionAuthority: false, rulesetAppliedToProduction: false, r3Consumed: false };
  let initialized = false;
  try {
    requireLab(typeof ownerToken === 'string' && ownerToken.length >= 16 && typeof loadAppKeys === 'function', 'LAB_OWNER_SETUP_REQUIRED');
    await session.preflight(); initialized = true;
    const keys = await loadAppKeys();
    const primary = await mintLabAppToken(transport, config.app, keys.primary, now()); session.tokens.push(primary);
    const wrong = await mintLabAppToken(transport, config.wrongApp, keys.wrong, now()); session.tokens.push(wrong);
    report.appIdentity = primary.identity; report.wrongAppIdentity = wrong.identity;
    await session.setup(); report.labRulesetId = session.rulesetId;
    report.cases = await executeLabCases(session, { primary, wrong, primaryPem: keys.primary, sleep: wait, progress });
    report.labRunComplete = report.cases.length === LAB_CASES.length && report.cases.every(({ assertionResult }) => assertionResult === 'PASS');
  } catch (error) { report.failure = safeError(error); }
  finally {
    report.tokenCustody = await ledger.retryKnownTokens((credential) => revokeLabToken(transport, credential));
    report.tokenRevocation = report.tokenCustody.receipts.filter(({ issuance }) => issuance === 'KNOWN_TOKEN')
      .map(({ appId, scope, revocation }) => ({ appId, scope, verified: revocation === 'VERIFIED' }));
    const resources = initialized ? await session.cleanup() : { complete: true, noResourcesCreated: true };
    report.cleanup = { ...resources, resourcesComplete: resources.complete, credentialsComplete: report.tokenCustody.complete,
      complete: resources.complete && report.tokenCustody.complete };
    report.labRunComplete &&= report.cleanup.complete;
    report.transportObservation = transport.observation();
    report.realGitHubRequestsPerformed = transport.realTransport && report.transportObservation.responsesReceived > 0;
    report.liveGitHubVerified = transport.realTransport && report.labRunComplete;
    report.finishedAt = new Date(now()).toISOString();
    report.interpretation = 'Lab fixture validation and GitHub-native observations are separate. Native cached success cannot enforce continuing authorization; production final admission remains NOT_READY.';
  }
  return report;
}

async function assertExternalKeyPath(file) {
  requireLab(typeof file === 'string' && path.isAbsolute(file), 'LAB_APP_PRIVATE_KEY_PATH_REQUIRED');
  const relative = path.relative(await realpath(ROOT), await realpath(file));
  requireLab(relative.startsWith('..' + path.sep), 'LAB_PRIVATE_KEY_MUST_BE_OUTSIDE_CHECKOUT');
}

export async function liveHarnessCli(argv = process.argv.slice(2), env = process.env) {
  if (argv.length === 1 && argv[0] === '--help') return { schema: 'kirari.live-harness-usage/v1',
    command: 'node scripts/root-audit/live-harness.mjs --config /absolute/authorized-lab.json --report /absolute/lab-report.json',
    requiredEnvironment: ['KIRARI_LAB_OWNER_ADMIN_TOKEN', 'KIRARI_LAB_APP_PRIVATE_KEY_PATH', 'KIRARI_LAB_WRONG_APP_PRIVATE_KEY_PATH'],
    productionAllowed: false, realAppsAndDisposableLabRequired: true, visibility: "private by default, explicit public permitted" };
  requireLab(argv.length === 4 && argv[0] === '--config' && argv[2] === '--report' && path.isAbsolute(argv[1]) && path.isAbsolute(argv[3]), 'LAB_EXPLICIT_CONFIG_AND_REPORT_PATH_REQUIRED');
  const raw = await readFile(argv[1], 'utf8'); requireLab(Buffer.byteLength(raw) <= 16384, 'LAB_CONFIG_TOO_LARGE');
  let config;
  try { config = JSON.parse(raw); } catch { throw new LabError('LAB_CONFIG_JSON_INVALID'); }
  validateLabConfig(config);
  requireLab(!env.GITHUB_ACTIONS, 'LAB_OWNER_LOCAL_PROCESS_REQUIRED');
  const handle = await open(argv[3], 'wx', 0o600);
  try {
  const report = await runLiveHarness(config, { ownerToken: env.KIRARI_LAB_OWNER_ADMIN_TOKEN,
    loadAppKeys: async () => {
      await assertExternalKeyPath(env.KIRARI_LAB_APP_PRIVATE_KEY_PATH); await assertExternalKeyPath(env.KIRARI_LAB_WRONG_APP_PRIVATE_KEY_PATH);
      return { primary: await readLabPrivateKey(env.KIRARI_LAB_APP_PRIVATE_KEY_PATH), wrong: await readLabPrivateKey(env.KIRARI_LAB_WRONG_APP_PRIVATE_KEY_PATH) };
    }, progress: (entry) => process.stderr.write(`${JSON.stringify({ schema: 'kirari.lab-progress/v1', ...entry })}\n`) });
  await handle.writeFile(`${JSON.stringify(report, null, 2)}\n`);
  return report;
  } finally { await handle.close(); }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { const report = await liveHarnessCli(); process.stdout.write(`${JSON.stringify(report, null, 2)}\n`); if (report.labRunComplete === false) process.exitCode = 1; }
  catch (error) { process.stdout.write(`${JSON.stringify({ schema: 'kirari.live-harness-error/v1', ...safeError(error), liveGitHubVerified: false, finalGateResult: 'NOT_READY' })}\n`); process.exitCode = 1; }
}
