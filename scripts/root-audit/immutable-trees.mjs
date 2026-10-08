const SHA = /^[a-f0-9]{40}$/;
const MAX_TREE_ENTRIES = 100_000;
const MAX_CHANGED_PATHS = 6_000;
const MODES = { blob: new Set(['100644', '100755', '120000']), tree: new Set(['040000']), commit: new Set(['160000']) };

function requireValue(condition, message) {
  if (!condition) throw new Error(`immutable tree: ${message}`);
}

function treeEntries(response, expectedSha) {
  requireValue(response && response.sha === expectedSha && SHA.test(expectedSha), 'tree identity changed');
  requireValue(response.truncated === false, 'incomplete recursive tree');
  requireValue(Array.isArray(response.tree) && response.tree.length <= MAX_TREE_ENTRIES, 'tree entry count is invalid');
  const entries = new Map();
  for (const entry of response.tree) {
    const validPath = typeof entry.path === 'string' && entry.path.length > 0 && entry.path.length <= 4096 &&
      !entry.path.includes('\0') && !entry.path.includes('\\') && !entry.path.startsWith('/') &&
      entry.path.split('/').every((part) => part !== '' && part !== '.' && part !== '..');
    requireValue(validPath && !entries.has(entry.path), 'malformed or duplicate path');
    requireValue(MODES[entry.type]?.has(entry.mode) && SHA.test(entry.sha), 'invalid entry type, mode or identity');
    entries.set(entry.path, { type: entry.type, mode: entry.mode, sha: entry.sha });
  }
  // A recursive tree must include ordinary ancestor directories. This rejects
  // synthetic children under a symlink/gitlink and incomplete API responses.
  for (const file of entries.keys()) {
    const parts = file.split('/');
    for (let length = 1; length < parts.length; length += 1) {
      requireValue(entries.get(parts.slice(0, length).join('/'))?.type === 'tree', 'missing ordinary parent directory');
    }
  }
  return entries;
}

function validateCandidateInventory(entries, candidateFiles) {
  for (const [file, entry] of entries) {
    if (/^(?:apps|workers|packages)(?:\/[^/]+)?$/.test(file)) {
      requireValue(entry.type === 'tree' || (entry.type === 'blob' && entry.mode !== '120000' && file.includes('/')),
        'workspace discovery cannot contain symlinks or gitlinks');
    }
  }
  for (const file of candidateFiles) {
    const entry = entries.get(file);
    requireValue(entry?.type === 'blob' && ['100644', '100755'].includes(entry.mode), 'candidate input must be an ordinary blob');
  }
  if (candidateFiles.includes('package.json')) {
    const workspaceManifest = /^(?:apps|workers|packages)\/[^/]+\/package\.json$/;
    const expected = candidateFiles.filter((file) => workspaceManifest.test(file)).sort();
    const observed = [...entries.keys()].filter((file) => workspaceManifest.test(file)).sort();
    requireValue(JSON.stringify(observed) === JSON.stringify(expected), 'workspace manifest inventory differs from the trusted fixed set');
  }
}

export function changedPathsFromImmutableTrees(baseTree, headTree, { baseTreeSha, headTreeSha, candidateFiles = [] }) {
  const base = treeEntries(baseTree, baseTreeSha);
  const head = treeEntries(headTree, headTreeSha);
  validateCandidateInventory(head, candidateFiles);
  const changed = [];
  for (const file of new Set([...base.keys(), ...head.keys()])) {
    const before = base.get(file);
    const after = head.get(file);
    if (before?.sha === after?.sha && before?.mode === after?.mode && before?.type === after?.type) continue;
    // Directory paths retain a slash so a protected directory replacement is
    // protected even when its old/new tree contains no ordinary child blob.
    changed.push(before?.type === 'tree' || after?.type === 'tree' ? `${file}/` : file);
    requireValue(changed.length <= MAX_CHANGED_PATHS, 'changed path count exceeds the trusted bound');
  }
  return changed.sort();
}

export async function listImmutableChangedPaths({ request, apiRoot, headApiRoot = apiRoot, baseSha, headSha, candidateFiles = [] }) {
  requireValue(SHA.test(baseSha) && SHA.test(headSha), 'commit identity is invalid');
  const baseRoot = new URL(apiRoot);
  const headRoot = new URL(headApiRoot);
  requireValue(baseRoot.origin === headRoot.origin && ['http:', 'https:'].includes(baseRoot.protocol), 'candidate API origin differs');
  const roots = [apiRoot.replace(/\/$/, ''), headApiRoot.replace(/\/$/, '')];
  const commits = await Promise.all([baseSha, headSha].map(async (sha, i) => {
    const commit = await request(`${roots[i]}/git/commits/${sha}`);
    requireValue(commit?.sha === sha && SHA.test(commit.tree?.sha), 'commit or tree binding differs');
    return commit;
  }));
  const trees = await Promise.all(commits.map((commit, i) => request(`${roots[i]}/git/trees/${commit.tree.sha}?recursive=1`)));
  return changedPathsFromImmutableTrees(trees[0], trees[1], {
    baseTreeSha: commits[0].tree.sha,
    headTreeSha: commits[1].tree.sha,
    candidateFiles,
  });
}
