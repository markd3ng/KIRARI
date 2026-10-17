import { build } from 'esbuild';
import { lstat, mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = fileURLToPath(new URL('../', import.meta.url));
const outputRoot = join(packageRoot, 'dist');

// No Node builtins, runtime imports, bindings, or deployment tools in the output.
export async function buildGatewayPackage() {
  const result = await build({
    entryPoints: [join(packageRoot, 'src/entry.ts')],
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'browser',
    target: 'es2022',
    minify: false,
    sourcemap: false,
    metafile: true,
  });
  if (Object.values(result.metafile.outputs).some((output) => output.imports.length)) {
    throw new Error('Gateway package must be self-contained.');
  }
  const code = result.outputFiles[0].contents;
  // Makers documents a 5 MB function limit; this tighter uncompressed bound
  // avoids depending on a compression estimate, SDK, or provider upload.
  if (code.byteLength > 1_000_000) throw new Error('Gateway bundle exceeds local size budget.');
  return new Map([
    ['edge-functions/_kirari/edge/[[path]].js', code],
    ['edge-functions/_kirari/edge/index.js', code],
    ['package.json', JSON.stringify({ name: 'kirari-makers-gateway', private: true, type: 'module' }, null, 2) + '\n'],
    ['edgeone.json', JSON.stringify({ outputDirectory: 'public' }, null, 2) + '\n'],
    ['public/404.html', '<!doctype html><title>Not found</title><h1>Not found</h1>\n'],
  ]);
}

async function rejectSymlinks(target) {
  const relative = target.slice(packageRoot.length);
  let current = packageRoot;
  for (const part of relative.split('/').filter(Boolean)) {
    current = join(current, part);
    try {
      if ((await lstat(current)).isSymbolicLink()) throw new Error('Package output cannot traverse symlinks.');
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
}

export async function packageGateway() {
  const files = await buildGatewayPackage();
  // Fixed dedicated dist only; no caller-selected output and no recursive deletion.
  for (const name of files.keys()) await rejectSymlinks(join(outputRoot, name));
  for (const [name, content] of files) {
    const destination = join(outputRoot, name);
    await mkdir(dirname(destination), { recursive: true });
    await writeFile(destination, content);
  }
  return { files: [...files.keys()], bundleBytes: files.values().next().value.byteLength };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify(await packageGateway()));
}
