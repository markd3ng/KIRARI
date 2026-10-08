import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { chmod, mkdir, mkdtemp, readFile, readdir, realpath, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runIndependentAudits } from '../audit.mjs';

assert.equal(process.platform, 'linux', 'this proof requires the real Linux nobody boundary');
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const policy = JSON.parse(await readFile(path.join(repo, 'scripts/root-audit/trusted-policy.json'), 'utf8'));
const candidate = Object.fromEntries(await Promise.all(policy.candidateFiles.map(async (file) => [file, await readFile(path.join(repo, file), 'utf8')])));
const temp = await mkdtemp(path.join(os.tmpdir(), 'kirari-isolation-proof-'));
const originalPath = process.env.PATH;
const originalToken = process.env.GH_TOKEN;
const originalHook = process.env.npm_config_pnpmfile;
const shellQuote = (value) => `'${value.replaceAll("'", "'\\''")}'`;
try {
  await chmod(temp, 0o755);
  const recordsDirectory = path.join(temp, 'records');
  await mkdir(recordsDirectory, { mode: 0o777 });
  await chmod(recordsDirectory, 0o777);
  const marker = path.join(recordsDirectory, 'candidate-script-ran');
  const root = JSON.parse(candidate['package.json']);
  root.scripts = { preinstall: `/usr/bin/touch ${marker}`, postinstall: `/usr/bin/touch ${marker}` };
  candidate['package.json'] = JSON.stringify(root);
  const hook = path.join(temp, 'candidate-hook.cjs');
  await writeFile(hook, `require('node:fs').writeFileSync(${JSON.stringify(marker)}, 'executed');\n`);
  candidate['.pnpmfile.cjs'] = await readFile(hook, 'utf8');
  const pnpm = execFileSync('which', ['pnpm'], { encoding: 'utf8' }).trim();
  for (const protectedPath of [await realpath(pnpm), path.dirname(await realpath(pnpm)), process.execPath]) {
    assert.throws(() => execFileSync('/usr/bin/sudo', ['-n', '-u', 'nobody', '--', '/usr/bin/test', '-w', protectedPath]),
      'the audit user must not be able to modify trusted toolchain files');
  }
  const probe = path.join(temp, 'probe.mjs');
  await writeFile(probe, `import { writeFileSync } from 'node:fs';
    const result = { uid: process.getuid(), sensitiveKeys: Object.keys(process.env).filter(k => /TOKEN|AUTH|PASSWORD|SECRET|CERT|PRIVATE_KEY|GITHUB/i.test(k)), candidateHookPresent: 'npm_config_pnpmfile' in process.env };
    writeFileSync(${JSON.stringify(recordsDirectory)} + '/identity-' + process.pid + '.json', JSON.stringify(result), { flag: 'wx', mode: 0o600 });\n`);
  await writeFile(path.join(temp, 'pnpm'), `#!/bin/sh\n${shellQuote(process.execPath)} ${shellQuote(probe)} || exit 1\nexec ${shellQuote(pnpm)} "$@"\n`, { mode: 0o755 });
  process.env.PATH = `${temp}:${originalPath}`;
  process.env.GH_TOKEN = 'isolated-nonsecret-test-sentinel';
  process.env.npm_config_pnpmfile = hook;
  const evidence = await runIndependentAudits(candidate, policy, path.join(temp, 'audit-evidence'));
  assert.equal(evidence.pnpmVersion, policy.pnpmVersion);
  assert.equal(evidence.supplemental.executed, true);
  assert.equal(evidence.supplemental.exitCode, 1);
  const uid = Number(execFileSync('/usr/bin/id', ['-u', 'nobody'], { encoding: 'utf8' }).trim());
  const records = (await readdir(recordsDirectory)).filter((name) => name.startsWith('identity-'));
  assert.equal(records.length, 2, 'both version and actual audit execute through the probe');
  // Nobody-owned records are read through sudo, rather than weakening their mode.
  for (const name of records) {
    const identity = JSON.parse(execFileSync('/usr/bin/sudo', ['-n', '/bin/cat', path.join(recordsDirectory, name)], { encoding: 'utf8' }));
    assert.equal(identity.uid, uid);
    assert.deepEqual(identity.sensitiveKeys, []);
    assert.equal(identity.candidateHookPresent, false);
  }
  assert.equal((await readdir(recordsDirectory)).includes('candidate-script-ran'), false);
  const unignored = JSON.parse(evidence.supplemental.raw);
  const qualifying = Object.values(unignored.advisories).filter((advisory) => ['moderate', 'high', 'critical'].includes(advisory.severity));
  assert.deepEqual(new Set(qualifying.map((advisory) => advisory.github_advisory_id ?? advisory.url?.split('/').at(-1))), new Set([policy.r3.ghsa, policy.issue122.ghsa]));
  console.log(JSON.stringify({ schema: 'kirari.linux-audit-isolation-proof/v1', platform: 'linux', auditUid: uid, pnpmVersion: evidence.pnpmVersion, credentialsAbsent: true, candidateHookAbsent: true, candidateScriptsExecuted: false, rawAuditExitCode: 1, rawRootAudit: 'FAIL_R3_WITH_SEPARATE_122', appProvenanceVerified: false, trustedBaseEstablished: false }));
} finally {
  process.env.PATH = originalPath;
  if (originalToken === undefined) delete process.env.GH_TOKEN; else process.env.GH_TOKEN = originalToken;
  if (originalHook === undefined) delete process.env.npm_config_pnpmfile; else process.env.npm_config_pnpmfile = originalHook;
  await rm(temp, { recursive: true, force: true });
}
