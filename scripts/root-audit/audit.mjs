import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { deriveNormalAudit } from './evaluator.mjs';

const MAX_AUDIT_OUTPUT = 16 * 1024 * 1024;
const AUDIT_TIMEOUT_MS = 120_000;

function safeManifest(candidateManifest, policy) {
  const result = {
    name: candidateManifest.name,
    private: true,
  };
  if (typeof candidateManifest.version === 'string') result.version = candidateManifest.version;
  for (const group of ['dependencies', 'devDependencies', 'optionalDependencies']) {
    if (candidateManifest[group] && Object.keys(candidateManifest[group]).length > 0) {
      result[group] = candidateManifest[group];
    }
  }
  if (candidateManifest.name === 'kirari') {
    result.packageManager = `pnpm@${policy.pnpmVersion}`;
  }
  return result;
}

export function restrictedEnvironment() {
  const env = {
    PATH: process.env.PATH ?? '/usr/bin:/bin',
    HOME: process.env.HOME ?? os.tmpdir(),
    TMPDIR: process.env.RUNNER_TEMP ?? os.tmpdir(),
    CI: 'true',
    COREPACK_ENABLE_PROJECT_SPEC: '0',
    npm_config_userconfig: '/dev/null',
    npm_config_globalconfig: '/dev/null',
    npm_config_registry: 'https://registry.npmjs.org/',
    npm_config_ignore_scripts: 'true',
    npm_config_yes: 'true',
  };
  for (const name of Object.keys(env)) {
    if (/(TOKEN|AUTH|PASSWORD|SECRET|CERT|PRIVATE_KEY|GITHUB|GH_TOKEN)/i.test(name)) delete env[name];
  }
  return env;
}

function run(command, args, options) {
  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let executed = false;
    let timedOut = false;
    let tooLarge = false;
    const child = spawn(command, args, { ...options, stdio: ['ignore', 'pipe', 'pipe'] });
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, AUDIT_TIMEOUT_MS);
    child.once('spawn', () => { executed = true; });
    child.stdout.on('data', (chunk) => {
      if (Buffer.byteLength(stdout) + chunk.length > MAX_AUDIT_OUTPUT) {
        tooLarge = true;
        child.kill('SIGKILL');
      } else stdout += chunk.toString('utf8');
    });
    child.stderr.on('data', (chunk) => {
      if (Buffer.byteLength(stderr) + chunk.length <= MAX_AUDIT_OUTPUT) stderr += chunk.toString('utf8');
      else {
        tooLarge = true;
        child.kill('SIGKILL');
      }
    });
    child.once('close', (exitCode, signal) => {
      clearTimeout(timer);
      resolve({
        executed,
        exitCode,
        signal,
        timedOut,
        tooLarge,
        stdout,
        stderr,
      });
    });
    child.once('error', (error) => {
      clearTimeout(timer);
      resolve({ executed: false, exitCode: null, signal: null, timedOut: false, tooLarge: false, stdout, stderr: `${stderr}${error.message}` });
    });
  });
}

export async function prepareAuditWorkspace(workspace, candidateFiles, policy) {
  const writeManifest = async (workspacePath, file) => {
    const manifest = JSON.parse(candidateFiles[file]);
    const destination = workspacePath === '.' ? workspace : path.join(workspace, workspacePath);
    await mkdir(destination, { recursive: true, mode: 0o700 });
    await writeFile(path.join(destination, 'package.json'), `${JSON.stringify(safeManifest(manifest, policy), null, 2)}\n`, { mode: 0o600 });
  };
  await writeManifest('.', 'package.json');
  for (const workspacePath of Object.keys(policy.workspaceManifests).filter((value) => value !== '.')) {
    await writeManifest(workspacePath, `${workspacePath}/package.json`);
  }
  await writeFile(path.join(workspace, 'pnpm-lock.yaml'), candidateFiles['pnpm-lock.yaml'], { mode: 0o600 });
  await writeFile(path.join(workspace, 'pnpm-workspace.yaml'), policy.workspaceYaml, { mode: 0o600 });
  await writeFile(path.join(workspace, '.npmrc'), '', { mode: 0o600 });
}

export async function runIndependentAudits(candidateFiles, policy, evidenceDirectory) {
  const tempRoot = await mkdtemp(path.join(process.env.RUNNER_TEMP ?? os.tmpdir(), 'kirari-r3-audit-'));
  const env = restrictedEnvironment();
  const evidence = {};
  try {
    const version = await run('pnpm', ['--version'], { cwd: tempRoot, env, windowsHide: true });
    evidence.pnpmVersion = version.stdout.trim();
    if (!version.executed || version.exitCode !== 0 || evidence.pnpmVersion !== policy.pnpmVersion) {
      throw new Error(`trusted pnpm version mismatch: expected ${policy.pnpmVersion}, received ${evidence.pnpmVersion || 'unavailable'}`);
    }
    const workspace = path.join(tempRoot, 'supplemental');
    await mkdir(workspace, { recursive: true, mode: 0o700 });
    await prepareAuditWorkspace(workspace, candidateFiles, policy);
    const result = await run('pnpm', ['--filter', '@kirari/site', 'audit', '--json', '--audit-level=moderate'], {
      cwd: workspace,
      env,
      windowsHide: true,
    });
    evidence.supplemental = {
      executed: result.executed,
      exitCode: result.exitCode,
      signal: result.signal,
      timedOut: result.timedOut,
      tooLarge: result.tooLarge,
      raw: result.stdout,
      stderr: result.stderr,
    };
    let normalRaw = '';
    let derivationError = null;
    try {
      normalRaw = deriveNormalAudit(result.stdout, policy);
    } catch (error) {
      derivationError = error instanceof Error ? error.message : 'normal audit derivation failed';
    }
    evidence.normal = {
      ...evidence.supplemental,
      executed: false,
      derived: true,
      raw: normalRaw,
      source: 'trusted-filter-from-supplemental',
      derivationError,
    };
  } finally {
    await mkdir(evidenceDirectory, { recursive: true });
    for (const name of ['normal', 'supplemental']) {
      const result = evidence[name];
      if (!result) continue;
      await writeFile(path.join(evidenceDirectory, `${name}-audit.json`), result.raw, { mode: 0o600 });
      await writeFile(path.join(evidenceDirectory, `${name}-audit.stderr.txt`), result.stderr, { mode: 0o600 });
      await writeFile(path.join(evidenceDirectory, `${name}-audit.exit-code.json`), `${JSON.stringify({
        executed: result.executed,
        exitCode: result.exitCode,
        signal: result.signal,
        timedOut: result.timedOut,
        tooLarge: result.tooLarge,
        source: result.source ?? 'pnpm-audit-process',
        derivationError: result.derivationError,
      }, null, 2)}\n`, { mode: 0o600 });
    }
    await rm(tempRoot, { recursive: true, force: true });
  }
  if (!evidence.normal || !evidence.supplemental) throw new Error('the unignored audit and trusted normal comparison are required');
  return evidence;
}
