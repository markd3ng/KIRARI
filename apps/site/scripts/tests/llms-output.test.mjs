import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { createVercelConfig } from '../security-policy.mjs';
import { unified } from 'unified';
import remarkParse from 'remark-parse';

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
  const page = (path, lang, title, links = '') => {
    const file = join(root, 'dist', path, 'index.html');
    mkdirSync(join(root, 'dist', path), { recursive: true });
    writeFileSync(file, `<!doctype html><html lang="${lang}"><head><title>${title} - Fixture</title><meta name="description" content="Fixture description">${links}<link rel="canonical" href="https://fixture.example${base}${path}${path ? '/' : ''}"></head><body><h1>${title}</h1><p>Public fixture text.</p></body></html>`);
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
  assert.doesNotMatch(result.stdout, /indexing API (?:submission|notification)/i);
}

test('postbuild creates an opted-in public key file but never contacts an indexing provider', (context) => {
  const { root, dist } = fixture(context);
  writeFileSync(join(root, 'kirari.config.toml'), `${readFileSync(join(root, 'kirari.config.toml'), 'utf8')}\n[seo]\nindexNow = true\nindexNowKey = "public-key-123"\n[seo.google]\nindexingApi = true\n`);
  const block = fileURLToPath(new URL('./block-indexing-fetch.mjs', import.meta.url));
  const env = { ...process.env, NODE_ENV: 'production', KIRARI_ALLOW_INDEXING_SUBMISSIONS: 'true', KIRARI_INDEXNOW_ENABLED: 'true', PUBLIC_INDEXNOW_ENABLE: 'true', PUBLIC_INDEXNOW_KEY: 'public-key-123', NODE_OPTIONS: `${process.env.NODE_OPTIONS || ''} --import=${block}`.trim() };
  const result = spawnSync(process.execPath, [join(root, 'scripts/postbuild.mjs')], { cwd: root, env, encoding: 'utf8', timeout: 30_000 });
  assert.equal(result.status, 0, `${result.error || ''}\n${result.stdout}\n${result.stderr}`);
  assert.equal(readFileSync(join(dist, 'public-key-123.txt'), 'utf8'), 'public-key-123');
  assert.doesNotMatch(`${result.stdout}\n${result.stderr}`, /Test blocked indexing request/);
});

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
  assert.match(readFileSync(join(dist, 'robots.txt'), 'utf8'), /Disallow: \/docs\/llms-full\.txt/);
  assert.match(readFileSync(join(dist, '_headers'), 'utf8'), /\/docs\/llms-full\.txt\n  Cache-Control: no-store/);
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


test('postbuild discovers real Markdown views and covering locale indexes under a base path', (context) => {
  const { root, dist, page } = fixture(context, { base: '/docs/' });
  const links = (view, index) => `<link href="https://fixture.example/docs/${view}" type="text/markdown" rel="alternate"><link type="text/plain" rel="describedby" href="https://fixture.example/docs/${index}">`;
  page('posts/nested/guide', 'en-US', 'A [nested] guide', links('posts/nested/guide/index.md', 'llms.txt'));
  page('zh-CN/posts/nested/guide', 'zh-CN', '中文指南', links('zh-CN/posts/nested/guide/index.md', 'zh-CN/llms.txt'));
  page('zh-CN/about', 'zh-CN', '关于', links('zh-CN/about/index.md', 'zh-CN/llms.txt'));
  page('blog', 'en-US', 'Blog');
  // Invalid or foreign discovery must never become a local write destination.
  page('posts/foreign', 'en-US', 'Foreign', '<link rel="describedby" type="text/plain" href="https://foreign.example/docs/fr-FR/llms.txt">');
  page('posts/bad', 'en-US', 'Bad', '<link rel="describedby" type="text/plain" href="https://fixture.example/docs/other/deep/llms.txt">');
  runPostbuild(root);
  const index = readFileSync(join(dist, 'llms.txt'), 'utf8');
  assert.ok(index.includes('[A \\[nested\\] guide](https://fixture.example/docs/posts/nested/guide/index.md)'));
  assert.match(index, /https:\/\/fixture\.example\/docs\/blog\//);
  assert.match(index, /## Language indexes/);
  assert.match(index, /https:\/\/fixture\.example\/docs\/zh-CN\/llms\.txt/);
  const scoped = readFileSync(join(dist, 'zh-CN/llms.txt'), 'utf8');
  assert.match(scoped, /zh-CN\/posts\/nested\/guide\/index\.md/);
  assert.match(scoped, /zh-CN\/about\/index\.md/);
  assert.doesNotMatch(scoped, /A \[nested\]|English article/);
  assert.equal(existsSync(join(dist, 'fr-FR/llms.txt')), false);
  assert.equal(existsSync(join(dist, 'other/deep/llms.txt')), false);
});


test('retained full aggregation no-store path follows the configured deployment base', () => {
  for (const [base, expected] of [['/', '/llms-full.txt'], ['/docs/', '/docs/llms-full.txt']]) {
    const policy = createVercelConfig({ site: { base } }).headers.find((entry) => entry.source === expected);
    assert.deepEqual(policy?.headers, [{ key: 'Cache-Control', value: 'no-store' }]);
  }
});


test('plain frontmatter descriptions cannot inject Markdown links or formatting into an index', (context) => {
  const { root, dist } = fixture(context);
  const html = join(dist, 'posts/english/index.html');
  writeFileSync(html, readFileSync(html, 'utf8').replace('Fixture description', '[injected](https://evil.example/) `code` \\ slash ](https://evil.example/)'));
  runPostbuild(root);
  const index = readFileSync(join(dist, 'llms.txt'), 'utf8');
  const tree = unified().use(remarkParse).parse(index);
  const links = [];
  const texts = [];
  const visit = (node) => { if (node.type === 'link') links.push(node.url); if (node.type === 'text') texts.push(node.value); for (const child of node.children || []) visit(child); };
  visit(tree);
  assert.equal(links.some((href) => href.includes('evil.example')), false);
  assert.ok(texts.some((text) => text.includes('[injected](https://evil.example/) `code` \\ slash')));
});
