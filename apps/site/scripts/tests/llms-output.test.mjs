import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const site = fileURLToPath(new URL('../../', import.meta.url));

function fixture(context, { enabled = true, i18n = true, base = '/' } = {}) {
  const root = mkdtempSync(join(site, '.llms-output-test-'));
  context.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, 'scripts'));
  mkdirSync(join(root, 'src/utils'), { recursive: true });
  mkdirSync(join(root, 'dist'));
  for (const file of ['postbuild.mjs', 'build-analytics-settings.mjs', 'security-policy.mjs', 'pagefind-index.mjs', 'indexing.mjs']) {
    cpSync(join(site, 'scripts', file), join(root, 'scripts', file));
  }
  for (const file of ['analytics-settings.mjs', 'search-provider.mjs']) {
    cpSync(join(site, 'src/utils', file), join(root, 'src/utils', file));
  }
  cpSync(join(site, 'site-defaults.json'), join(root, 'site-defaults.json'));
  writeFileSync(join(root, 'kirari.config.toml'), `[site]\nurl = "https://fixture.example"\nbase = "${base}"\ntitle = "Fixture"\n[search]\nenable = false\n[llms]\nenable = ${enabled}\ni18n = ${i18n}\n`);
  const page = (path, lang, title) => {
    const file = join(root, 'dist', path, 'index.html');
    mkdirSync(join(root, 'dist', path), { recursive: true });
    writeFileSync(file, `<!doctype html><html lang="${lang}"><head><title>${title} - Fixture</title><meta name="description" content="Fixture description"><link rel="canonical" href="https://fixture.example${base}${path}${path ? '/' : ''}"></head><body><h1>${title}</h1><p>Public fixture text.</p></body></html>`);
  };
  page('', 'en-US', 'Home');
  page('posts/english', 'en-US', 'English article');
  page('zh-CN/posts/chinese', 'zh-CN', 'Chinese article');
  return { root, dist: join(root, 'dist'), page };
}

function runPostbuild(root) {
  const env = { ...process.env, NODE_ENV: 'test', KIRARI_BUILD_ONLY: 'true' };
  for (const key of Object.keys(env)) if (key.startsWith('PUBLIC_') || key === 'KIRARI_SITE_SOURCE') delete env[key];
  const result = spawnSync(process.execPath, [join(root, 'scripts/postbuild.mjs')], { cwd: root, env, encoding: 'utf8', timeout: 30_000 });
  assert.equal(result.status, 0, `${result.error || ''}\n${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /Indexing submissions skipped/);
}

test('postbuild retires the condensed output while retaining full and locale indexes with base-aware URLs', (context) => {
  const { root, dist, page } = fixture(context, { base: '/docs/' });
  for (let index = 0; index < 35; index++) page(`posts/post-${index}`, 'en-US', `Article ${index}`);
  writeFileSync(join(dist, 'llms-small.txt'), 'stale legacy content');
  runPostbuild(root);
  assert.equal(existsSync(join(dist, 'llms-small.txt')), false);
  const index = readFileSync(join(dist, 'llms.txt'), 'utf8');
  assert.match(index, /https:\/\/fixture\.example\/docs\/llms-full\.txt/);
  assert.match(index, /https:\/\/fixture\.example\/docs\/posts\/post-34\//);
  for (const name of readdirSync(dist).filter((name) => /^llms.*\.txt$/.test(name))) {
    assert.doesNotMatch(readFileSync(join(dist, name), 'utf8'), /llms-small\.txt/);
  }
  const full = readFileSync(join(dist, 'llms-full.txt'), 'utf8');
  assert.match(full, /English article/);
  assert.match(full, /Chinese article/);
  const english = readFileSync(join(dist, 'llms-en-US.txt'), 'utf8');
  assert.match(english, /English article/);
  assert.doesNotMatch(english, /Chinese article/);
  assert.match(readFileSync(join(dist, 'llms-zh-CN.txt'), 'utf8'), /Chinese article/);
  assert.doesNotMatch(readFileSync(join(dist, 'llms-zh-CN.txt'), 'utf8'), /English article/);
});

test('disabled LLM generation still removes a stale retired artifact and adds no alias', (context) => {
  const { root, dist } = fixture(context, { enabled: false });
  writeFileSync(join(dist, 'llms-small.txt'), 'stale legacy content');
  runPostbuild(root);
  assert.deepEqual(readdirSync(dist).filter((name) => /^llms.*\.txt$/.test(name)), []);
  assert.doesNotMatch(readFileSync(join(dist, '_redirects'), 'utf8'), /llms-small/);
});

test('retained full output keeps current robots and no-store policy when locale indexes are disabled', (context) => {
  const { root, dist } = fixture(context, { i18n: false });
  runPostbuild(root);
  assert.equal(existsSync(join(dist, 'llms.txt')), true);
  assert.equal(existsSync(join(dist, 'llms-full.txt')), true);
  assert.equal(existsSync(join(dist, 'llms-en-US.txt')), false);
  assert.equal(existsSync(join(dist, 'llms-zh-CN.txt')), false);
  assert.match(readFileSync(join(dist, 'robots.txt'), 'utf8'), /Disallow: \/llms-full\.txt/);
  assert.match(readFileSync(join(dist, '_headers'), 'utf8'), /\/llms-full\.txt\n  Cache-Control: no-store/);
});
