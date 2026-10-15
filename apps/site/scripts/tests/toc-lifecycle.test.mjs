import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

const source = readFileSync(new URL('../../src/components/widget/TOC.astro', import.meta.url), 'utf8');
const script = source.match(/<script>([\s\S]*?)<\/script>/)[1];

function fixture({ animated = false } = {}) {
    const timers = new Map();
    const frames = new Map();
    const observers = [];
    let sequence = 0;
    let focused = null;
    class Element extends EventTarget {
        isConnected = true;
        attrs = new Map();
        tokens = new Set();
        classList = { add: name => this.tokens.add(name), remove: name => this.tokens.delete(name) };
        style = { scrollBehavior: 'smooth' };
        scrollTop = 0;
        clientHeight = 400;
        offsetTop = 20;
        rect = { top: 30, bottom: 100 };
        children = [];
        setAttribute(name, value) { this.attrs.set(name, value); }
        getAttribute(name) { return this.attrs.get(name) ?? null; }
        removeAttribute(name) { this.attrs.delete(name); }
        hasAttribute(name) { return this.attrs.has(name); }
        getBoundingClientRect() { return this.rect; }
        scrollTo() {}
        scrollIntoView() { this.scrolls = (this.scrolls ?? 0) + 1; }
        focus() { focused = this; }
    }
    class Anchor extends Element {}
    class Click extends Event {
        constructor(anchor, detail = 1) { super('click', { cancelable: true }); this.anchor = anchor; this.detail = detail; }
        composedPath() { return [this.anchor]; }
    }
    class Observer {
        targets = new Set();
        constructor(callback) { this.callback = callback; observers.push(this); }
        observe(target) { this.targets.add(target); }
        unobserve(target) { this.targets.delete(target); }
        disconnect() { this.targets.clear(); }
    }
    const wrapper = new Element();
    // Match the browser's capture-sensitive listener identity (Node EventTarget
    // does not match removeEventListener's boolean capture option consistently).
    const listeners = new Set();
    const capture = option => typeof option === 'boolean' ? option : !!option?.capture;
    wrapper.addEventListener = (type, callback, options) => listeners.add({ type, callback, capture: capture(options) });
    wrapper.removeEventListener = (type, callback, options) => {
        for (const entry of listeners) if (entry.type === type && entry.callback === callback && entry.capture === capture(options)) listeners.delete(entry);
    };
    const anchors = [new Anchor(), new Anchor()];
    const headings = [new Element(), new Element()];
    const sections = headings.map((heading, index) => {
        anchors[index].hash = `#h${index}`;
        heading.setAttribute('id', `h${index}`);
        const section = new Element();
        section.children = [heading];
        section.firstChild = heading;
        heading.parentElement = section;
        return section;
    });
    const markdown = new Element();
    const root = new Element();
    const indicator = new Element();
    const context = vm.createContext({
        HTMLElement: Element, HTMLAnchorElement: Anchor, MouseEvent: Click,
        IntersectionObserver: Observer, ResizeObserver: Observer,
        document: {
            getElementById: id => id === 'content-wrapper' ? (animated ? wrapper : null) : headings.find(h => h.getAttribute('id') === id) ?? null,
            querySelector: selector => selector === '.custom-md' ? markdown : null,
            querySelectorAll: () => [markdown], documentElement: root,
        },
        window: { innerHeight: 800, setTimeout: (callback, delay) => { const id = ++sequence; timers.set(id, { callback, delay }); return id; } },
        setTimeout: (callback, delay) => { const id = ++sequence; timers.set(id, { callback, delay }); return id; },
        clearTimeout: id => timers.delete(id),
        requestAnimationFrame: callback => { const id = ++sequence; frames.set(id, callback); return id; },
        cancelAnimationFrame: id => frames.delete(id), performance: { now: () => 0 },
        customElements: { get: () => null, define: (_, ctor) => { context.TOC = ctor; } },
    });
    vm.runInContext(ts.transpileModule(script, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, context);
    const toc = new context.TOC();
    toc.closest = () => wrapper;
    toc.querySelector = () => indicator;
    toc.querySelectorAll = () => anchors;
    toc.contains = anchor => anchors.includes(anchor);
    const connect = () => { toc.isConnected = true; toc.connectedCallback(); };
    const disconnect = () => { toc.isConnected = false; toc.disconnectedCallback(); };
    const flushFrames = () => { const pending = [...frames.values()]; frames.clear(); pending.forEach(callback => callback(300)); };
    const click = (index, detail) => { const event = new Click(anchors[index], detail); for (const entry of listeners) if (entry.type === 'click') entry.callback(event); return event; };
    return { toc, connect, disconnect, flushFrames, click, timers, frames, listeners, observers, markdown, root, anchors, headings, sections, get focused() { return focused; } };
}

test('disconnect before animation init removes startup timer and listener', () => {
    const f = fixture({ animated: true });
    f.connect();
    assert.equal(f.timers.size, 1);
    assert.equal(f.listeners.size, 1);
    f.disconnect();
    assert.equal(f.timers.size, 0);
    assert.equal(f.listeners.size, 0);
    assert.equal(f.toc.tocEl, null);
});

test('repeated route detach/reconnect releases capture listeners, all scheduled work and observers', () => {
    const f = fixture();
    for (let cycle = 0; cycle < 4; cycle++) {
        f.connect();
        assert.equal(f.listeners.size, 1);
        assert.equal(f.click(1).defaultPrevented, true);
        assert.equal(f.markdown.tokens.has('cv-force-visible'), true);
        assert.ok(f.timers.size >= 4);
        assert.ok(f.frames.size >= 2);
        const queued = [...f.timers.values()].map(timer => timer.callback).concat([...f.frames.values()]);
        const oldObservers = [...f.observers];
        f.disconnect();
        assert.equal(f.listeners.size, 0);
        assert.equal(f.timers.size, 0);
        assert.equal(f.frames.size, 0);
        assert.equal(f.root.style.scrollBehavior, 'smooth');
        assert.equal(f.markdown.tokens.has('cv-force-visible'), false);
        assert.ok(f.observers.every(observer => observer.targets.size === 0));
        // Even already-delivered old observer/RAF callbacks cannot mutate a new route.
        f.connect();
        queued.forEach(callback => callback(1000));
        oldObservers.forEach(observer => observer.callback([{ target: f.sections[1], isIntersecting: true }]));
        assert.equal(f.headings[1].scrolls ?? 0, 0);
        assert.equal(f.toc.anchorNavTarget, null);
        assert.equal(f.listeners.size, 1);
        f.disconnect();
    }
});

test('one current location follows observer updates; native keyboard activation focuses the heading', () => {
    const f = fixture();
    f.connect();
    f.flushFrames();
    assert.equal(f.anchors[0].getAttribute('aria-current'), 'location');
    assert.equal(f.anchors[1].getAttribute('aria-current'), null);
    f.toc.observer.callback([{ target: f.sections[0], isIntersecting: false }, { target: f.sections[1], isIntersecting: true }]);
    f.flushFrames();
    assert.equal(f.anchors[0].getAttribute('aria-current'), null);
    assert.equal(f.anchors[1].getAttribute('aria-current'), 'location');
    assert.equal(f.click(1, 0).defaultPrevented, true);
    assert.equal(f.focused, f.headings[1]);
    assert.equal(f.headings[1].getAttribute('tabindex'), '-1');
    f.disconnect();
    assert.ok(f.anchors.every(anchor => anchor.getAttribute('aria-current') === null));
});

test('both static TOC variants expose a localized navigation landmark and ordinary anchors', () => {
    assert.equal((source.match(/<table-of-contents role="navigation" aria-label=\{i18n\(I18nKey.toc, lang\)\}/g) ?? []).length, 2);
    assert.equal((source.match(/<a href=\{`#\$\{heading.slug\}`\}/g) ?? []).length, 2);
    const layout = readFileSync(new URL('../../src/layouts/MainGridLayout.astro', import.meta.url), 'utf8');
    assert.match(layout, /const pageLang = normalizeLangCode\(lang \|\| siteConfig.lang\)/);
    assert.match(layout, /<TOC\b[^>]*layout="floating"[^>]*lang=\{pageLang\}/);
});
