import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { buildGatewayPackage } from '../scripts/package.mjs';

const packageRoot = fileURLToPath(new URL('../', import.meta.url));

test('package is a self-contained Makers route with only the expected layout', async () => {
  const files = await buildGatewayPackage();
  assert.deepEqual([...files.keys()], [
    'edge-functions/_kirari/edge/[[path]].js',
    'edge-functions/_kirari/edge/index.js',
    'package.json',
    'edgeone.json',
    'public/404.html',
  ]);
  assert.deepEqual(JSON.parse(files.get('edgeone.json')), { outputDirectory: 'public' });
  const code = files.get('edge-functions/_kirari/edge/[[path]].js');
  assert.ok(code.byteLength < 1_000_000);
  assert.deepEqual(code, files.get('edge-functions/_kirari/edge/index.js'));
  const source = new TextDecoder().decode(code);
  assert.doesNotMatch(source, /(?:process\.env|node:|require\(|waitUntil|caches\.default|new ReadableStream)/);
  const module = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
  assert.equal(typeof module.onRequest, 'function');
  assert.equal(module.default, module.onRequest);
  const response = await module.onRequest({ request: new Request('https://gateway.example/_kirari/edge/healthz') });
  assert.equal(response.status, 200);
  assert.equal(await response.text(), 'ok');
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const rejected = await module.onRequest({ request: new Request('https://gateway.example/_kirari/edge/https://evil.example') });
  assert.equal(rejected.status, 404);
});

test('packager refuses symlinked output before writing any files', async () => {
  const fixture = await mkdtemp(join(packageRoot, '.package-test-'));
  const outside = join(fixture, 'outside');
  try {
    await mkdir(join(fixture, 'scripts'));
    await mkdir(join(fixture, 'src'));
    await mkdir(outside);
    await writeFile(join(fixture, 'scripts/package.mjs'), await readFile(join(packageRoot, 'scripts/package.mjs')));
    await writeFile(join(fixture, 'src/entry.ts'), 'export const onRequest = () => new Response("ok");');
    await writeFile(join(outside, 'sentinel'), 'keep');
    await symlink(outside, join(fixture, 'dist'));
    const result = spawnSync(process.execPath, [join(fixture, 'scripts/package.mjs')], { encoding: 'utf8' });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /cannot traverse symlinks/);
    assert.equal(await readFile(join(outside, 'sentinel'), 'utf8'), 'keep');
    await assert.rejects(readFile(join(outside, 'edgeone.json')), { code: 'ENOENT' });
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
});
