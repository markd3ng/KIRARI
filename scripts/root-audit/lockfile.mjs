import path from 'node:path';

const MAX_LOCK_BYTES = 8 * 1024 * 1024;
const MAX_LOCK_LINES = 150_000;
const DEPENDENCY_GROUPS = new Set(['dependencies', 'devDependencies', 'optionalDependencies']);
const SNAPSHOT_GROUPS = new Set(['dependencies', 'optionalDependencies']);

function fail(message) {
  throw new Error(`unsupported pnpm lockfile: ${message}`);
}

function parseScalar(value, where) {
  const source = value.trim();
  if (source === '') return '';
  if (source.startsWith("'")) {
    if (!/^'(?:[^']|'')*'$/.test(source)) fail(`invalid quoted scalar at ${where}`);
    return source.slice(1, -1).replaceAll("''", "'");
  }
  if (source.startsWith('"')) {
    try {
      const parsed = JSON.parse(source);
      if (typeof parsed !== 'string') fail(`non-string scalar at ${where}`);
      return parsed;
    } catch {
      fail(`invalid double-quoted scalar at ${where}`);
    }
  }
  if (/^[\[{]/.test(source) || /[\]}]$/.test(source)) fail(`flow scalar at ${where}`);
  if (/(^|\s)[&*!][A-Za-z0-9_-]+/.test(source)) fail(`YAML anchor, alias, or tag at ${where}`);
  if (source === 'null' || source === '~') return null;
  if (source === 'true') return true;
  if (source === 'false') return false;
  return source;
}

function splitEntry(line, where) {
  let quote = null;
  let escaped = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (quote === '"') {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') quote = null;
    } else if (quote === "'") {
      if (char === "'" && line[index + 1] === "'") index += 1;
      else if (char === "'") quote = null;
    } else if (char === '"' || char === "'") {
      quote = char;
    } else if (char === '#') {
      if (index === 0 || /\s/.test(line[index - 1])) {
        line = line.slice(0, index).trimEnd();
        break;
      }
    } else if (char === ':' && (index + 1 === line.length || /\s/.test(line[index + 1]))) {
      const rawKey = line.slice(0, index).trim();
      if (!rawKey) fail(`empty key at ${where}`);
      return { key: parseScalar(rawKey, where), value: line.slice(index + 1).trim() };
    }
  }
  if (line.trim() === '') return null;
  fail(`expected mapping entry at ${where}`);
}

function prepareLines(lockText) {
  if (typeof lockText !== 'string' || Buffer.byteLength(lockText, 'utf8') > MAX_LOCK_BYTES) {
    fail('size limit exceeded');
  }
  const text = lockText.charCodeAt(0) === 0xfeff ? lockText.slice(1) : lockText;
  const lines = text.replaceAll('\r\n', '\n').split('\n');
  if (lines.length > MAX_LOCK_LINES) fail('line limit exceeded');
  return lines.map((raw, index) => {
    if (raw.includes('\t')) fail(`tab indentation at line ${index + 1}`);
    let quote = null;
    let escaped = false;
    for (let offset = 0; offset < raw.length; offset += 1) {
      const char = raw[offset];
      if (quote === '"') {
        if (escaped) escaped = false;
        else if (char === '\\') escaped = true;
        else if (char === '"') quote = null;
      } else if (quote === "'") {
        if (char === "'" && raw[offset + 1] === "'") offset += 1;
        else if (char === "'") quote = null;
      } else if (char === '"' || char === "'") {
        quote = char;
      } else if ('&*!'.includes(char) && (offset === 0 || /[\s:[,{]/.test(raw[offset - 1])) && /[A-Za-z0-9_-]/.test(raw[offset + 1] ?? '')) {
        fail(`YAML anchor, alias, or tag at line ${index + 1}`);
      }
    }
    const indentation = raw.length - raw.trimStart().length;
    const body = raw.trim();
    if (!body || body.startsWith('#')) return null;
    if (indentation % 2 !== 0) fail(`odd indentation at line ${index + 1}`);
    if (/^(---|\.\.\.)\s*$/.test(body)) fail(`multiple YAML documents at line ${index + 1}`);
    return { indentation, body, line: index + 1 };
  });
}

function sectionRows(lines) {
  const top = new Map();
  let section = null;
  for (const row of lines) {
    if (!row) continue;
    if (row.indentation === 0) {
      const entry = splitEntry(row.body, `line ${row.line}`);
      if (!entry) continue;
      if (top.has(entry.key)) fail(`duplicate top-level key ${entry.key}`);
      top.set(entry.key, { value: entry.value, rows: [] });
      section = entry.key;
    } else {
      if (!section) fail(`indented content before a top-level key at line ${row.line}`);
      top.get(section).rows.push(row);
    }
  }
  for (const name of ['lockfileVersion', 'settings', 'importers', 'packages', 'snapshots']) {
    if (!top.has(name)) fail(`missing top-level ${name}`);
  }
  if (parseScalar(top.get('lockfileVersion').value, 'lockfileVersion') !== '9.0') {
    fail('lockfileVersion is not 9.0');
  }
  for (const name of ['importers', 'packages', 'snapshots']) {
    if (top.get(name).value !== '') fail(`${name} must be a block mapping`);
  }
  return top;
}

function parseImporters(rows) {
  const importers = new Map();
  let importer = null;
  let group = null;
  let dependency = null;
  for (const row of rows) {
    const entry = splitEntry(row.body, `line ${row.line}`);
    if (!entry) continue;
    if (row.indentation === 2) {
      assertSafePackageName(entry.key, `importer at line ${row.line}`);
      if (!['', '{}'].includes(entry.value)) fail(`importer ${entry.key} must be a mapping`);
      if (importers.has(entry.key)) fail(`duplicate importer ${entry.key}`);
      importer = { dependencies: new Map(), devDependencies: new Map(), optionalDependencies: new Map() };
      importers.set(entry.key, importer);
      group = null;
      dependency = null;
      continue;
    }
    if (!importer) fail(`importer field without importer at line ${row.line}`);
    if (row.indentation === 4) {
      if (!DEPENDENCY_GROUPS.has(entry.key) || !['', '{}'].includes(entry.value)) fail(`unsupported importer field ${entry.key}`);
      group = entry.key;
      dependency = null;
      continue;
    }
    if (row.indentation === 6) {
      if (!group || entry.value !== '') fail(`invalid dependency entry at line ${row.line}`);
      assertSafePackageName(entry.key, `dependency at line ${row.line}`);
      if (importer[group].has(entry.key)) fail(`duplicate dependency ${entry.key} in ${group}`);
      dependency = { specifier: undefined, version: undefined };
      importer[group].set(entry.key, dependency);
      continue;
    }
    if (row.indentation === 8) {
      if (!dependency || !['specifier', 'version'].includes(entry.key) || entry.value === '') {
        fail(`unsupported importer dependency detail at line ${row.line}`);
      }
      if (dependency[entry.key] !== undefined) fail(`duplicate importer dependency field ${entry.key}`);
      dependency[entry.key] = parseScalar(entry.value, `line ${row.line}`);
      if (typeof dependency[entry.key] !== 'string') fail(`non-string importer value at line ${row.line}`);
      continue;
    }
    fail(`unsupported importer nesting at line ${row.line}`);
  }
  for (const [pathName, entry] of importers) {
    for (const groupName of DEPENDENCY_GROUPS) {
      for (const [name, value] of entry[groupName]) {
        if (typeof value.specifier !== 'string' || typeof value.version !== 'string') {
          fail(`incomplete importer dependency ${pathName}:${name}`);
        }
      }
    }
  }
  return importers;
}

function parseSnapshots(rows) {
  const snapshots = new Map();
  let snapshot = null;
  let group = null;
  for (const row of rows) {
    if (row.indentation === 6 && row.body.startsWith('- ')) {
      if (group !== 'transitivePeerDependencies' || !snapshot) fail(`unexpected sequence at line ${row.line}`);
      parseScalar(row.body.slice(2), `line ${row.line}`);
      continue;
    }
    const entry = splitEntry(row.body, `line ${row.line}`);
    if (!entry) continue;
    if (row.indentation === 2) {
      if (typeof entry.key !== 'string' || entry.key.length > 1024 || /[\x00-\x1f\x7f]/.test(entry.key)) {
        fail(`invalid snapshot key at line ${row.line}`);
      }
      if (snapshots.has(entry.key)) fail(`duplicate snapshot ${entry.key}`);
      if (entry.value !== '' && entry.value !== '{}') fail(`snapshot ${entry.key} must be a mapping`);
      snapshot = { dependencies: new Map(), optionalDependencies: new Map() };
      snapshots.set(entry.key, snapshot);
      group = null;
      continue;
    }
    if (!snapshot) fail(`snapshot field without snapshot at line ${row.line}`);
    if (row.indentation === 4) {
      if (SNAPSHOT_GROUPS.has(entry.key) && ['', '{}'].includes(entry.value)) {
        group = entry.key;
      } else if (entry.key === 'transitivePeerDependencies' && entry.value === '') {
        group = entry.key;
      } else if (entry.key === 'optional' && entry.value !== '') {
        group = null;
        const value = parseScalar(entry.value, `line ${row.line}`);
        if (typeof value !== 'boolean') fail(`invalid optional flag at line ${row.line}`);
      } else {
        fail(`unsupported snapshot field ${entry.key}`);
      }
      continue;
    }
    if (row.indentation === 6 && group && SNAPSHOT_GROUPS.has(group)) {
      if (entry.value === '') fail(`dependency reference missing at line ${row.line}`);
      assertSafePackageName(entry.key, `snapshot dependency at line ${row.line}`);
      if (snapshot[group].has(entry.key)) fail(`duplicate snapshot dependency ${entry.key}`);
      const reference = parseScalar(entry.value, `line ${row.line}`);
      if (typeof reference !== 'string') fail(`non-string snapshot reference at line ${row.line}`);
      snapshot[group].set(entry.key, reference);
      continue;
    }
    if (row.indentation === 6 && group === 'transitivePeerDependencies' && entry.value === '') {
      fail(`invalid peer dependency sequence at line ${row.line}`);
    }
    fail(`unsupported snapshot nesting at line ${row.line}`);
  }
  return snapshots;
}

function packageIdentity(key, where) {
  if (typeof key !== 'string' || key.length > 1024 || /[\x00-\x1f\x7f]/.test(key)) {
    fail(`invalid package key at ${where}`);
  }
  const separator = key.lastIndexOf('@');
  if (separator <= 0) fail(`invalid package identity at ${where}`);
  const name = key.slice(0, separator);
  const version = key.slice(separator + 1);
  assertSafePackageName(name, where);
  if (!/^[0-9][0-9A-Za-z.+-]*$/.test(version)) fail(`unsupported package version at ${where}`);
  return `${name}@${version}`;
}

function parsePackages(rows) {
  const packages = new Map();
  let current = null;
  for (const row of rows) {
    if (row.indentation === 2) {
      const entry = splitEntry(row.body, `line ${row.line}`);
      if (!entry || (entry.value !== '' && entry.value !== '{}')) fail(`invalid package entry at line ${row.line}`);
      packageIdentity(entry.key, `line ${row.line}`);
      if (packages.has(entry.key)) fail(`duplicate package ${entry.key}`);
      current = { fields: new Set(), integrity: null };
      packages.set(entry.key, current);
      continue;
    }
    if (!current) fail(`package field without a package at line ${row.line}`);
    if (row.indentation === 4) {
      const entry = splitEntry(row.body, `line ${row.line}`);
      if (!entry || typeof entry.key !== 'string' || !/^[A-Za-z][A-Za-z0-9]*$/.test(entry.key)) {
        fail(`invalid package field at line ${row.line}`);
      }
      if (current.fields.has(entry.key)) fail(`duplicate package field ${entry.key}`);
      current.fields.add(entry.key);
      if (entry.key === 'resolution') {
        const match = /^\{\s*integrity:\s*(?:"(sha512-[A-Za-z0-9+/]{86}==)"|'(sha512-[A-Za-z0-9+/]{86}==)'|(sha512-[A-Za-z0-9+/]{86}==))\s*\}$/.exec(entry.value);
        if (!match) fail(`unsupported package resolution at line ${row.line}`);
        current.integrity = match[1] ?? match[2] ?? match[3];
      }
      continue;
    }
    if (row.indentation < 6 || row.indentation % 2 !== 0) fail(`unsupported package nesting at line ${row.line}`);
  }
  for (const [key, value] of packages) {
    if (!value.fields.has('resolution') || !value.integrity) fail(`package ${key} has no supported integrity resolution`);
  }
  return packages;
}

function assertSameKeys(actual, expected, label) {
  const left = [...actual].sort();
  const right = [...expected].sort();
  if (JSON.stringify(left) !== JSON.stringify(right)) fail(`${label} mismatch`);
}

function assertSafePackageName(name, where) {
  if (typeof name !== 'string' || name.length === 0 || name.length > 214 || /[\s\0-\x1f\x7f\\]/.test(name)) {
    fail(`invalid package name at ${where}`);
  }
}

function readManifest(candidateFiles, file, expectedName, root = false) {
  let parsed;
  try {
    parsed = JSON.parse(candidateFiles[file]);
  } catch {
    fail(`invalid JSON manifest ${file}`);
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || parsed.name !== expectedName) {
    fail(`unexpected manifest identity in ${file}`);
  }
  if (root && parsed.packageManager !== `pnpm@${ROOT_PNPM_VERSION}`) fail('root packageManager mismatch');
  for (const group of DEPENDENCY_GROUPS) {
    const dependencies = parsed[group] ?? {};
    if (!dependencies || typeof dependencies !== 'object' || Array.isArray(dependencies)) fail(`invalid ${group} in ${file}`);
    for (const [name, specifier] of Object.entries(dependencies)) {
      assertSafePackageName(name, file);
      if (typeof specifier !== 'string' || !specifier || /[\x00-\x1f\x7f]/.test(specifier)) {
        fail(`invalid dependency specifier in ${file}`);
      }
    }
  }
  if (typeof parsed.version === 'string' && (parsed.version.length > 128 || /[\x00-\x1f\x7f]/.test(parsed.version))) {
    fail(`invalid package version in ${file}`);
  }
  return parsed;
}

const ROOT_PNPM_VERSION = '9.14.4';

export function parseAndValidateLockfile(lockText, candidateFiles, policy) {
  const top = sectionRows(prepareLines(lockText));
  const importers = parseImporters(top.get('importers').rows);
  const packages = parsePackages(top.get('packages').rows);
  const snapshots = parseSnapshots(top.get('snapshots').rows);
  const packageKeys = new Set([...packages.keys()].map((key) => packageIdentity(key, 'packages')));
  const snapshotPackageKeys = new Set([...snapshots.keys()].map((key) => packageIdentity(key.split('(', 1)[0], 'snapshots')));
  assertSameKeys(snapshotPackageKeys, packageKeys, 'package resolution and snapshot identity set');
  const expectedImporterNames = Object.keys(policy.workspaceManifests);
  assertSameKeys(importers.keys(), expectedImporterNames, 'workspace importer set');

  const manifests = new Map();
  for (const [workspacePath, expectedName] of Object.entries(policy.workspaceManifests)) {
    const file = workspacePath === '.' ? 'package.json' : `${workspacePath}/package.json`;
    const manifest = readManifest(candidateFiles, file, expectedName, workspacePath === '.');
    manifests.set(workspacePath, manifest);
    const importer = importers.get(workspacePath);
    for (const group of DEPENDENCY_GROUPS) {
      const declared = manifest[group] ?? {};
      assertSameKeys(importer[group].keys(), Object.keys(declared), `${workspacePath} ${group}`);
      for (const [name, specifier] of Object.entries(declared)) {
        const lockSpecifier = importer[group].get(name).specifier;
        if (lockSpecifier !== specifier) {
          const overrides = Object.entries(manifests.get('.').pnpm?.overrides ?? {})
            .filter(([overrideName]) => overrideName === name || overrideName.startsWith(`${name}@`))
            .map(([, overrideValue]) => overrideValue);
          if (!overrides.includes(lockSpecifier)) fail(`specifier mismatch for ${workspacePath}:${name}`);
        }
      }
    }
  }

  const rootManifest = manifests.get('.');
  const ignoreCves = rootManifest.pnpm?.auditConfig?.ignoreCves;
  if (!Array.isArray(ignoreCves) || JSON.stringify(ignoreCves) !== JSON.stringify([policy.issue122.cve])) {
    fail('candidate audit exception differs from the independently pinned #122 exception');
  }
  if (rootManifest.pnpm?.auditConfig?.ignoreGhsas !== undefined) fail('unapproved ignoreGhsas setting');
  if (candidateFiles['pnpm-workspace.yaml'] !== policy.workspaceYaml) fail('workspace configuration mismatch');

  for (const [key, snapshot] of snapshots) {
    for (const group of SNAPSHOT_GROUPS) {
      for (const [name, reference] of snapshot[group]) {
        if (!name || !reference || /[\r\n\0]/.test(reference)) fail(`invalid edge in ${key}`);
      }
    }
  }

  const workspaceByLink = new Map();
  for (const workspacePath of expectedImporterNames) workspaceByLink.set(workspacePath, workspacePath);
  function resolveLink(importerPath, reference) {
    const destination = path.posix.normalize(path.posix.join(importerPath === '.' ? '.' : importerPath, reference.slice('link:'.length)));
    if (!workspaceByLink.has(destination)) fail(`unsupported workspace link ${reference}`);
    return destination;
  }
  function resolveRef(packageName, reference, importerPath) {
    if (reference.startsWith('link:')) {
      const workspacePath = resolveLink(importerPath, reference);
      return { kind: 'workspace', workspacePath, name: manifests.get(workspacePath).name, version: manifests.get(workspacePath).version ?? '0.0.0' };
    }
    if (/^(file:|workspace:|catalog:|npm:|git\+|https?:)/.test(reference)) fail(`unsupported dependency reference ${reference}`);
    const alias = reference.match(/^(@[^/]+\/[^@]+|[^@/]+)@([0-9][^()]*(?:\([^)]*\))*)$/);
    const snapshotName = alias ? alias[1] : packageName;
    const snapshotReference = alias ? alias[2] : reference;
    const snapshotKey = `${snapshotName}@${snapshotReference}`;
    if (!snapshots.has(snapshotKey)) fail(`missing snapshot ${snapshotKey}`);
    const version = snapshotReference.split('(', 1)[0];
    if (!/^[0-9][0-9A-Za-z.+-]*$/.test(version)) fail(`unsupported package version ${version}`);
    return { kind: 'snapshot', snapshotKey, name: packageName, version };
  }

  const routes = new Set();
  const issue122Routes = new Set();
  let visited = 0;
  function visit(node, currentImporter, route, seen) {
    visited += 1;
    if (visited > 750_000) fail('dependency traversal limit exceeded');
    const edges = node.kind === 'workspace'
      ? [...DEPENDENCY_GROUPS].flatMap((group) => [...importers.get(node.workspacePath)[group]].map(([name, value]) => [name, value.version]))
      : [...SNAPSHOT_GROUPS].flatMap((group) => [...snapshots.get(node.snapshotKey)[group]]);
    for (const [name, reference] of edges) {
      const child = resolveRef(name, reference, currentImporter);
      const childRoute = [...route, `${child.name}@${child.version}`];
      if (child.name === policy.r3.package) routes.add([currentImporter, ...childRoute].join(' > '));
      if (child.name === policy.issue122.package) issue122Routes.add([currentImporter, ...childRoute].join(' > '));
      if (seen.has(child.kind === 'workspace' ? `workspace:${child.workspacePath}` : child.snapshotKey)) continue;
      const nextSeen = new Set(seen);
      nextSeen.add(child.kind === 'workspace' ? `workspace:${child.workspacePath}` : child.snapshotKey);
      visit(child, child.kind === 'workspace' ? child.workspacePath : currentImporter, childRoute, nextSeen);
    }
  }

  for (const [importerPath, importer] of importers) {
    for (const group of DEPENDENCY_GROUPS) {
      for (const [name, dependency] of importer[group]) {
        const node = resolveRef(name, dependency.version, importerPath);
        const route = [node.name === policy.r3.package ? `${node.name}@${node.version}` : `${node.name}@${node.version}`];
        if (node.name === policy.r3.package) routes.add([importerPath, ...route].join(' > '));
        if (node.name === policy.issue122.package) issue122Routes.add([importerPath, ...route].join(' > '));
        const key = node.kind === 'workspace' ? `workspace:${node.workspacePath}` : node.snapshotKey;
        visit(node, node.kind === 'workspace' ? node.workspacePath : importerPath, route, new Set([key]));
      }
    }
  }
  const normalizedPaths = [...routes].sort();
  const expectedPaths = [...policy.r3.paths].sort();
  if (JSON.stringify(normalizedPaths) !== JSON.stringify(expectedPaths)) fail('R3 dependency topology differs from the exact policy paths');
  const normalizedIssue122Paths = [...issue122Routes].sort();
  if (JSON.stringify(normalizedIssue122Paths) !== JSON.stringify([...policy.issue122.paths].sort()) ||
      !normalizedIssue122Paths.includes(policy.issue122.path)) {
    fail(`#122 dependency topology differs from its separately pinned path set (found ${JSON.stringify(normalizedIssue122Paths)})`);
  }
  return { lockfileVersion: '9.0', importers: [...importers.keys()].sort(), r3Paths: normalizedPaths, issue122Paths: normalizedIssue122Paths, snapshotCount: snapshots.size };
}
