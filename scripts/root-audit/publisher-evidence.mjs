import { lstat, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { digestNamedFiles } from './publisher-contract.mjs';

const MAX_EVIDENCE_FILES = 256;
const MAX_EVIDENCE_BYTES = 80 * 1024 * 1024;

export async function digestEvidenceDirectory(directory, { exclude = ['publisher-result.json'] } = {}) {
  const files = {};
  let totalBytes = 0;
  async function walk(current, prefix = '') {
    const entries = await readdir(current, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      const name = prefix ? `${prefix}/${entry.name}` : entry.name;
      const fullPath = path.join(current, entry.name);
      const metadata = await lstat(fullPath);
      if (metadata.isSymbolicLink()) throw new Error('evidence contains a symbolic link');
      if (metadata.isDirectory()) {
        await walk(fullPath, name);
        continue;
      }
      if (!metadata.isFile()) throw new Error('evidence contains a non-file entry');
      if (exclude.includes(name)) continue;
      if (Object.keys(files).length >= MAX_EVIDENCE_FILES || metadata.size > MAX_EVIDENCE_BYTES - totalBytes) {
        throw new Error('evidence bundle exceeds its file or byte limit');
      }
      totalBytes += metadata.size;
      files[name] = await readFile(fullPath);
    }
  }
  await walk(directory);
  if (Object.keys(files).length === 0) throw new Error('trusted evidence bundle is empty');
  return { digest: digestNamedFiles(files), fileCount: Object.keys(files).length, totalBytes };
}
