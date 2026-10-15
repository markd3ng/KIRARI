#!/usr/bin/env node
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm, symlink } from 'node:fs/promises';
import { dirname, resolve, join } from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { createServer } from 'node:http';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const siteRequire = createRequire(join(repo, 'apps/site/package.json'));
const browserRequire = createRequire(join(repo, 'scripts/p3-browser/package.json'));
const { build } = await import(pathToFileURL(siteRequire.resolve('astro')));
const { chromium } = browserRequire('playwright');
const WAIT_TIMEOUT = 30_000;
const fixture = await mkdtemp(join(repo, '.tmp-toc-browser-'));
let server;
let browser;
try {
    await symlink(join(repo, 'apps/site/node_modules'), join(fixture, 'node_modules'), 'dir');
    await writeFile(join(fixture, 'package.json'), '{"type":"module"}');
    await mkdir(join(fixture, 'src/pages/posts'), { recursive: true });
    // Compile the production component unchanged, including its actual dependency
    // closure. Only this fixture's page shell and article content are synthetic.
    await writeFile(join(fixture, 'astro.config.mjs'), `import {defineConfig} from 'astro/config'; import icon from 'astro-icon'; export default defineConfig({integrations:[icon()],vite:{server:{fs:{allow:[${JSON.stringify(repo)},${JSON.stringify(fixture)}]}}}});`);
    await writeFile(join(fixture, 'src/pages/posts/[id].astro'), `---
import { ClientRouter } from 'astro:transitions';
import TOC from ${JSON.stringify(join(repo, 'apps/site/src/components/widget/TOC.astro'))};
export function getStaticPaths() {return ['a','b'].flatMap(id => ['sidebar','floating'].map(layout => ({params:{id:layout+'-'+id},props:{id,layout}})));}
const {id,layout}=Astro.props;
const headings=[{depth:2,slug:'first-'+id,text:'First '+id},{depth:3,slug:'second-'+id,text:'Second '+id}];
---
<html lang="en"><head><ClientRouter/><title>TOC fixture</title></head><body>
<a id="route" href={'/posts/'+layout+'-'+(id==='a'?'b':'a')+'/'}>Next article</a>
<div id="content-wrapper"><article class="custom-md"><section><h2 id={'first-'+id}>First {id}</h2><p>First section content</p></section><section><h2 id={'second-'+id}>Second {id}</h2><div class="expressive-code">Async sized content</div></section></article>
<div id="fixture-toc"><TOC headings={headings} layout={layout} lang="en-US"/></div></div>
<style is:global>
html {scroll-behavior:smooth;} body{margin:24px;font-family:Arial;}section{min-height:750px;}#fixture-toc{position:fixed;right:24px;top:70px;width:220px;background:white;}table-of-contents{display:block;}a{display:block;}@media(max-width:768px){#fixture-toc{position:static;width:auto;}}
</style>
</body></html>`);
    await build({ root: fixture, configFile: 'astro.config.mjs', logLevel: 'error' });
    const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html' };
    server = createServer(async (request, response) => {
        try {
            const url = new URL(request.url, 'http://localhost');
            const pathname = decodeURIComponent(url.pathname);
            if (pathname.includes('..')) throw new Error('path');
            const path = join(fixture, 'dist', pathname.endsWith('/') ? pathname + 'index.html' : pathname);
            const bytes = await readFile(path);
            response.writeHead(200, { 'content-type': Object.entries(types).find(([extension]) => path.endsWith(extension))?.[1] ?? 'application/octet-stream' });
            response.end(bytes);
        } catch { response.writeHead(404); response.end(); }
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const origin = `http://127.0.0.1:${server.address().port}`;
    browser = await chromium.launch({ headless: true });
    const results = [];
    for (const width of [1600, 390]) {
        for (const layout of ['floating', 'sidebar']) {
            const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
            const page = await context.newPage();
            page.setDefaultTimeout(WAIT_TIMEOUT);
            page.setDefaultNavigationTimeout(WAIT_TIMEOUT);
            const errors = [];
            page.on('pageerror', error => errors.push(error.message));
            await page.addInitScript(() => {
                window.tocProbe = { token: Math.random(), clickCalls: 0, old: [], swaps: 0 };
                document.addEventListener('astro:after-swap', () => window.tocProbe.swaps++);
                const define = customElements.define.bind(customElements);
                customElements.define = (name, Constructor, options) => {
                    if (name === 'table-of-contents') {
                        const connected = Constructor.prototype.connectedCallback;
                        const disconnected = Constructor.prototype.disconnectedCallback;
                        Constructor.prototype.connectedCallback = function () {
                            if (!this.probed) {
                                const click = this.handleAnchorClick;
                                this.handleAnchorClick = event => { window.tocProbe.clickCalls++; return click(event); };
                                this.probed = true;
                            }
                            return connected.call(this);
                        };
                        Constructor.prototype.disconnectedCallback = function () {
                            const result = disconnected.call(this);
                            window.tocProbe.old.push(this);
                            return result;
                        };
                    }
                    return define(name, Constructor, options);
                };
            });
            await page.goto(origin + `/posts/${layout}-a/`);
            const token = await page.evaluate(() => window.tocProbe.token);
            for (let cycle = 0; cycle < 4; cycle++) {
                const toc = page.getByRole('navigation', { name: 'Table of Contents', exact: true });
                await toc.waitFor();
                await page.waitForFunction(() => document.querySelector('table-of-contents')?.tocEl != null, undefined, { timeout: WAIT_TIMEOUT });
                const current = toc.locator('[aria-current="location"]');
                await current.waitFor();
                assert.equal(await current.count(), 1);
                assert.equal(await toc.locator('a').nth(1).evaluate(anchor => getComputedStyle(anchor).paddingLeft), width < 768 ? '20px' : '24px');
                const bounds = await toc.boundingBox();
                assert.ok(bounds.width > 100 && bounds.width < width);
                const snapshot = await toc.ariaSnapshot();
                assert.match(snapshot, /navigation "Table of Contents"/);
                // Reach the first TOC link through actual Tab movement, then Enter.
                await page.locator('#route').focus();
                await page.keyboard.press('Tab');
                assert.equal(await page.evaluate(() => document.activeElement?.closest('table-of-contents') != null), true);
                await page.keyboard.press('Enter');
                assert.match(await page.evaluate(() => document.activeElement?.id), /^first-[ab]$/);
                assert.equal(await page.evaluate(() => window.tocProbe.clickCalls), cycle + 1);
                // Navigate while RAF/correction work is still in flight.
                await page.locator('#route').click();
                await page.waitForFunction(swaps => window.tocProbe.swaps === swaps, cycle + 1, { timeout: WAIT_TIMEOUT });
                assert.equal(await page.evaluate(() => window.tocProbe.token), token, 'route swap must retain JS global (no document reload)');
                const cleanup = await page.evaluate(() => window.tocProbe.old.every(toc => !toc.tocEl && toc.scrollCorrectionTimers.length === 0 && !toc.resizeObserver && !toc.updatePending && toc.headingIdxMap.size === 0));
                assert.equal(cleanup, true);
                await page.evaluate(() => {
                    for (const old of window.tocProbe.old) {
                        const event = new MouseEvent('click', { bubbles: true, cancelable: true });
                        event.preventDefault();
                        old.querySelector('a').dispatchEvent(event);
                    }
                });
                assert.equal(await page.evaluate(() => window.tocProbe.clickCalls), cycle + 1, 'detached TOCs must no longer receive captured click listeners');
            }
            // Reattach the exact element to exercise browser custom-element callbacks.
            await page.waitForFunction(() => document.querySelector('table-of-contents')?.tocEl != null, undefined, { timeout: WAIT_TIMEOUT });
            await page.evaluate(() => {
                const toc = document.querySelector('table-of-contents');
                const parent = toc.parentElement;
                toc.remove();
                parent.append(toc);
            });
            await page.waitForFunction(() => document.querySelector('table-of-contents')?.tocEl != null, undefined, { timeout: WAIT_TIMEOUT });
            await page.getByRole('navigation', { name: 'Table of Contents', exact: true }).locator('a').first().click();
            assert.equal(await page.evaluate(() => window.tocProbe.clickCalls), 5, 'reattach should dispatch exactly one click callback');
            assert.deepEqual(errors, []);
            const routeSwaps = await page.evaluate(() => window.tocProbe.swaps);
            results.push({ width, layout, routeSwaps, noReload: true, keyboardFocus: true, namedLandmark: true, oneCurrentLocation: true, reattachSingleClick: true, detachedListenersRemoved: true, responsiveIndent: width < 768 ? 20 : 24, pageErrors: errors.length });
            await context.close();
        }
    }
    console.log(JSON.stringify({ result: 'PASS', fixture: 'actual-TOC-Astro-ClientRouter', results, limitation: 'Synthetic page shell verifies component responsive styles; full-site floating/mobile placement is checked separately.' }, null, 2));
} finally {
    await browser?.close();
    if (server) await new Promise(resolve => server.close(resolve));
    await rm(fixture, { recursive: true, force: true });
}
