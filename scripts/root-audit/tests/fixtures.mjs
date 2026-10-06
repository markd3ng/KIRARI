import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { deriveNormalAudit, digestFiles } from '../evaluator.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
export const policy = JSON.parse(await readFile(path.resolve(here, '../trusted-policy.json'), 'utf8'));
const policyRaw = await readFile(path.resolve(here, '../trusted-policy.json'));
const hash = (value) => createHash('sha256').update(value).digest('hex');

const snapshotDependencies = {
  'parse5@7.3.0': {},
  '@tailwindcss/typography@0.5.20': { dependencies: { 'postcss-selector-parser': '6.0.10' } },
  '@expressive-code/core@0.44.2': { dependencies: { 'postcss-nested': '6.2.0' } },
  'postcss-nested@6.2.0': { dependencies: { 'postcss-selector-parser': '6.1.4' } },
  '@expressive-code/plugin-collapsible-sections@0.44.2': { dependencies: { '@expressive-code/core': '0.44.2' } },
  '@expressive-code/plugin-line-numbers@0.44.2': { dependencies: { '@expressive-code/core': '0.44.2' } },
  'astro-expressive-code@0.44.2': { dependencies: { 'rehype-expressive-code': '0.44.2', astro: '7.3.5' } },
  '@astrojs/mdx@8.0.2': { dependencies: { astro: '7.3.5' } },
  '@astrojs/svelte@9.0.1': { dependencies: { astro: '7.3.5' } },
  'rehype-expressive-code@0.44.2': { dependencies: { 'expressive-code': '0.44.2' } },
  'expressive-code@0.44.2': { dependencies: {
    '@expressive-code/core': '0.44.2',
    '@expressive-code/plugin-frames': '0.44.2',
    '@expressive-code/plugin-shiki': '0.44.2',
    '@expressive-code/plugin-text-markers': '0.44.2',
  } },
  '@expressive-code/plugin-frames@0.44.2': { dependencies: { '@expressive-code/core': '0.44.2' } },
  '@expressive-code/plugin-shiki@0.44.2': { dependencies: { '@expressive-code/core': '0.44.2' } },
  '@expressive-code/plugin-text-markers@0.44.2': { dependencies: { '@expressive-code/core': '0.44.2' } },
  'astro@7.3.5': { dependencies: { 'http-cache-semantics': '4.2.0' } },
  'http-cache-semantics@4.2.0': {},
  'postcss-selector-parser@6.0.10': {},
  'postcss-selector-parser@6.1.4': {},
};

const defaultSiteDependencies = {
  '@tailwindcss/typography': '0.5.20',
  '@expressive-code/core': '0.44.2',
  '@expressive-code/plugin-collapsible-sections': '0.44.2',
  '@expressive-code/plugin-line-numbers': '0.44.2',
  'astro-expressive-code': '0.44.2',
  '@astrojs/mdx': '8.0.2',
  '@astrojs/svelte': '9.0.1',
  astro: '7.3.5',
};

function q(value) {
  return JSON.stringify(value);
}

function importerSection(pathName, groups) {
  const lines = [`  ${q(pathName)}:`];
  for (const group of ['dependencies', 'devDependencies', 'optionalDependencies']) {
    const dependencies = groups[group] ?? {};
    if (Object.keys(dependencies).length === 0) continue;
    lines.push(`    ${group}:`);
    for (const [name, version] of Object.entries(dependencies).sort(([a], [b]) => a.localeCompare(b))) {
      lines.push(`      ${q(name)}:`, `        specifier: ${q(version)}`, `        version: ${q(version)}`);
    }
  }
  return lines.join('\n');
}

function snapshotsSection(snapshots) {
  const lines = [];
  for (const [key, groups] of Object.entries(snapshots).sort(([a], [b]) => a.localeCompare(b))) {
    const groupEntries = Object.entries(groups).filter(([name]) => ['dependencies', 'optionalDependencies'].includes(name));
    if (groupEntries.length === 0) {
      lines.push(`  ${q(key)}: {}`);
      continue;
    }
    lines.push(`  ${q(key)}:`);
    for (const [group, dependencies] of groupEntries) {
      lines.push(`    ${group}:`);
      for (const [name, reference] of Object.entries(dependencies).sort(([a], [b]) => a.localeCompare(b))) {
        lines.push(`      ${q(name)}: ${q(reference)}`);
      }
    }
  }
  return lines.join('\n');
}

function packagesSection(snapshots) {
  const packageKeys = [...new Set(Object.keys(snapshots).map((key) => key.split('(', 1)[0]))].sort();
  return packageKeys.map((key) => `  ${q(key)}:\n    resolution: {integrity: "sha512-${'A'.repeat(86)}=="}`).join('\n');
}

function makeLock(siteDependencies, snapshots) {
  const rootImporter = { devDependencies: { parse5: '7.3.0' } };
  const siteImporter = { dependencies: siteDependencies };
  return [
    "lockfileVersion: '9.0'",
    'settings:',
    '  autoInstallPeers: true',
    '  excludeLinksFromLockfile: false',
    'importers:',
    importerSection('.', rootImporter),
    importerSection('apps/site', siteImporter),
    importerSection('workers/kirari-edge', {}),
    importerSection('packages/site-profile', {}),
    'packages:',
    packagesSection(snapshots),
    'snapshots:',
    snapshotsSection(snapshots),
    '',
  ].join('\n');
}

export function createFixture({ siteDependencies = { ...defaultSiteDependencies }, snapshots = structuredClone(snapshotDependencies) } = {}) {
  const rootManifest = {
    name: 'kirari',
    private: true,
    packageManager: `pnpm@${policy.pnpmVersion}`,
    pnpm: { auditConfig: { ignoreCves: [policy.issue122.cve] } },
    devDependencies: { parse5: '7.3.0' },
    scripts: { preinstall: 'throw new Error("candidate script executed")' },
  };
  const siteManifest = { name: '@kirari/site', dependencies: siteDependencies, scripts: { preinstall: 'throw new Error("site script executed")' } };
  const candidateFiles = {
    'package.json': `${JSON.stringify(rootManifest)}\n`,
    'pnpm-lock.yaml': makeLock(siteDependencies, snapshots),
    'pnpm-workspace.yaml': policy.workspaceYaml,
    'apps/site/package.json': `${JSON.stringify(siteManifest)}\n`,
    'workers/kirari-edge/package.json': '{"name":"@kirari/edge"}\n',
    'packages/site-profile/package.json': '{"name":"@kirari/site-profile"}\n',
    '.github/workflows/ci.yml': 'name: malicious candidate workflow\n',
    'scripts/root-audit/cli.mjs': 'throw new Error("candidate cli executed")\n',
    'scripts/root-audit/evaluator.mjs': 'throw new Error("candidate evaluator executed")\n',
    'scripts/root-audit/policy.json': '{"candidatePolicy":true}\n',
  };
  return candidateFiles;
}

function advisory({ id, ghsa, moduleName, severity, cves = [], findings }) {
  return {
    findings: findings.map((finding) => ({ version: finding.version, paths: finding.paths, dev: true, optional: false, bundled: false })),
    id,
    created: '2026-01-01T00:00:00.000Z',
    updated: '2026-01-01T00:00:00.000Z',
    title: `${moduleName} test advisory`,
    found_by: { name: 'fixture' },
    reported_by: { name: 'fixture' },
    module_name: moduleName,
    cves,
    vulnerable_versions: '*',
    patched_versions: '',
    overview: '',
    recommendation: '',
    references: '',
    access: 'public',
    severity,
    cwe: '',
    github_advisory_id: ghsa,
    metadata: { module_type: 'npm', exploitability: 0, affected_components: '' },
    url: `https://github.com/advisories/${ghsa}`,
  };
}

export function createAudits() {
  const r3Findings = new Map();
  for (const fullPath of policy.r3.paths) {
    const pathNames = fullPath.split(' > ').map((part) => {
      if (part === 'apps/site') return part;
      const at = part.lastIndexOf('@');
      return at > 0 ? part.slice(0, at) : part;
    }).join('>');
    const version = fullPath.split(' > ').at(-1).slice(policy.r3.package.length + 1);
    const key = version;
    if (!r3Findings.has(key)) r3Findings.set(key, { version, paths: [] });
    r3Findings.get(key).paths.push(pathNames);
  }
  const r3 = advisory({
    id: 1001,
    ghsa: policy.r3.ghsa,
    moduleName: policy.r3.package,
    severity: policy.r3.severity,
    cves: ['CVE-2026-R3FIXTURE'],
    findings: [...r3Findings.values()],
  });
  const issue122 = advisory({
    id: 1002,
    ghsa: policy.issue122.ghsa,
    moduleName: policy.issue122.package,
    severity: policy.issue122.severity,
    cves: [policy.issue122.cve],
    findings: [{
      version: policy.issue122.version,
      paths: policy.issue122.paths.map((fullPath) => fullPath.split(' > ').map((part) => {
        if (part === 'apps/site') return part;
        const at = part.lastIndexOf('@');
        return at > 0 ? part.slice(0, at) : part;
      }).join('>')),
    }],
  });
  const base = {
    actions: [],
    muted: [],
    metadata: {
      vulnerabilities: { info: 0, low: 0, moderate: 1, high: 1, critical: 0 },
      dependencies: 100,
      devDependencies: 100,
      optionalDependencies: 0,
      totalDependencies: 100,
    },
  };
  const supplementalRaw = JSON.stringify({ ...base, advisories: { '1001': r3, '1002': issue122 } });
  return {
    pnpmVersion: policy.pnpmVersion,
    normal: { executed: false, derived: true, source: 'trusted-filter-from-supplemental', exitCode: 1, stderr: '', raw: deriveNormalAudit(supplementalRaw, policy) },
    supplemental: { executed: true, exitCode: 1, stderr: '', raw: supplementalRaw },
  };
}

export function createContext(overrides = {}) {
  const candidateFiles = overrides.candidateFiles ?? createFixture({ siteDependencies: overrides.siteDependencies });
  const headSha = 'ef5ecc412e165ebd7f3c6f38f111c7bdcb8cfda8';
  const baseSha = 'c79659046cf6ea73ba69e03c3937d904c07ba93b';
  const trusted = {
    eventName: 'workflow_dispatch',
    repository: policy.repository,
    ref: 'refs/heads/main',
    sha: baseSha,
    workflowRef: `${policy.repository}/.github/workflows/r3-trusted-verifier.yml@refs/heads/main`,
    workflowSha: baseSha,
    runId: '123456789',
    runAttempt: '1',
    workflowDigest: 'a'.repeat(64),
    verifierDigest: 'b'.repeat(64),
    evaluatorDigest: 'c'.repeat(64),
    policyDigest: hash(policyRaw),
  };
  return {
    policy,
    expectedPrNumber: 133,
    expectedHeadSha: headSha,
    expectedBaseSha: baseSha,
    candidate: { number: 133, state: 'open', merged: false, headSha, baseSha, baseRef: 'main', headRepo: policy.repository },
    candidateFiles,
    audits: createAudits(),
    issue122: { number: 122, state: 'open', title: policy.issue122.title, bodySha256: policy.issue122.bodySha256 },
    issue135: { number: 135, state: 'open' },
    comments: [],
    trusted,
    now: Date.parse('2026-10-06T00:00:00.000Z'),
    ...overrides,
  };
}

export const approvalSecurityDigest = 'd'.repeat(64);
export function ownerApproval(context, changes = {}) {
  const record = {
    schema: 'kirari.r3-consumption-decision/v1',
    decision: 'APPROVE_R3_CONSUMPTION',
    repository: policy.repository,
    issue: policy.decisionIssue,
    commentId: 6019999999,
    candidateHeadSha: context.expectedHeadSha,
    baseSha: context.expectedBaseSha,
    candidateDigest: digestFiles(context.candidateFiles),
    policyDigest: context.trusted.policyDigest,
    verifierDigest: context.trusted.verifierDigest,
    securityReviewDigest: approvalSecurityDigest,
    expiresAt: '2026-10-07T00:00:00.000Z',
    ...changes,
  };
  return {
    id: 6019999999,
    issueNumber: 135,
    body: `KIRARI_R3_CONSUMPTION_DECISION_V1\n${JSON.stringify(record)}`,
    author_association: 'OWNER',
    user: { login: 'markd3ng' },
  };
}
