import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "node:http";
import { chromium } from "../p3-browser/node_modules/playwright/index.mjs";
const dist = fileURLToPath(new URL("../../apps/site/dist/", import.meta.url));
const headers = JSON.parse(await readFile(new URL("../../vercel.json", import.meta.url), "utf8")).headers.at(-1).headers;
const server = createServer(async (req, res) => {
 try {
  const path = resolve(dist, `.${decodeURIComponent(new URL(req.url, 'http://localhost').pathname)}`);
  if (!path.startsWith(dist)) throw new Error('path');
  const file = path.endsWith('/') || !extname(path) ? resolve(path, 'index.html') : path;
  const data = await readFile(file);
  for (const {key,value} of headers) res.setHeader(key,value);
  res.setHeader('Content-Type', {'.html':'text/html','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.json':'application/json','.woff2':'font/woff2','.txt':'text/plain'}[extname(file)] || 'application/octet-stream');
  res.end(data);
 } catch {res.writeHead(404);res.end('Not found');}
});
let browser;
try {
 await new Promise(done=>server.listen(0,'127.0.0.1',done));
 const origin=`http://127.0.0.1:${server.address().port}`;
 browser=await chromium.launch({headless:true});
 const results=[];
 for (const width of [1600,390]) {
  const page=await browser.newPage({viewport:{width,height:1000}}), errors=[], tracking=[], violations=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.exposeFunction('recordCSP',event=>violations.push(event));
  await page.addInitScript(()=>document.addEventListener('securitypolicyviolation',e=>window.recordCSP({directive:e.effectiveDirective,uri:e.blockedURI})));
  await page.route('**/*',route=>{
   const url=route.request().url();
   if (/googletagmanager|google-analytics|umami|plausible|clarity|usefathom|simpleanalytics|amplitude/.test(url)) tracking.push(url);
   return new URL(url).origin===origin ? route.continue() : route.abort();
  });
  await page.goto(origin+'/zh-CN/posts/mermaid-test/');
  await page.waitForFunction(() => document.querySelectorAll('[data-mermaid-rendered] svg').length === document.querySelectorAll('[data-mermaid-enabled="true"] pre.mermaid').length);
  const diagrams=await page.locator('[data-mermaid-rendered] svg').count();
  assert.ok(diagrams>=4,`all example diagrams rendered (${diagrams})`);
  const toc=page.locator('table-of-contents');
  assert.equal(await toc.count(),1);
  assert.ok((await toc.getAttribute('aria-label')).length>0);
  await page.waitForSelector('table-of-contents [aria-current="location"]');
  assert.equal(await toc.locator('[aria-current="location"]').count(),1);
  const placement=await toc.evaluate(el=>({sidebar:!!el.closest('#sidebar'),floating:!!el.closest('#toc-wrapper'),width:el.getBoundingClientRect().width}));
  assert.equal(placement.sidebar,true,'profile sidebar host preserved');
  assert.equal(await toc.isVisible(),true,'TOC remains visible');
  assert.ok(!placement.floating,'profile sidebar layout preserved');
  assert.ok(placement.width>0);
  await page.evaluate(()=>window.p5SameDocument=true);
  await page.evaluate(()=>{ const a=document.createElement('a');a.id='p5-next';a.href='/posts/markdown/';a.textContent='P5 next';document.body.append(a); });
  await page.locator('#p5-next').evaluate(anchor=>anchor.click());
  await page.waitForURL('**/posts/markdown/');
  assert.equal(await page.evaluate(()=>window.p5SameDocument),true);
  assert.equal(await page.locator('pre.mermaid svg').count(),0);
  await page.goBack();
  await page.waitForSelector('[data-mermaid-rendered] svg');
  assert.equal(await page.locator('table-of-contents').count(),1);
  assert.deepEqual(tracking,[]);
  assert.deepEqual(errors,[]);
  const baselineIconHosts = new Set(['api.iconify.design','api.simplesvg.com','api.unisvg.com']);
  const unexpected = violations.filter(event => event.directive !== 'connect-src' || !baselineIconHosts.has(new URL(event.uri).hostname));
  assert.deepEqual(unexpected,[]);
  results.push({width,diagrams,routeSwaps:2,placement,defaultAnalyticsRequests:0,pageErrors:0,unexpectedCspViolations:0,baselineIconifyCspBlocks:violations.length});
  await page.close();
 }
 console.log(JSON.stringify({result:'PASS',fixture:'full-default-profile-static-output',results}));
} finally {await browser?.close();await new Promise(done=>server.close(done));}
