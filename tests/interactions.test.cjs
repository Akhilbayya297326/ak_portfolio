const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');
const source = readFileSync(join(__dirname, '../app.js'), 'utf8');

// A small DOM/event fixture verifies interaction behavior without dependencies.
// Visual layout and browser rendering are checked separately in a real browser.
function fixture({ empty = false, secure = true, reducedMotion = true, finePointer = false } = {}) {
  const byId = new Map(), bySelector = new Map(), documentEvents = new Map();
  const windowEvents = new Map(), media = new Map(), frames = new Map();
  let document, frameId = 0;
  const listeners = (map, type, callback) => map.set(type, [...(map.get(type) || []), callback]);
  class Element {
    constructor(tag = 'div', attrs = {}) {
      this.tagName = tag.toUpperCase(); this.attributes = {}; this.dataset = {};
      this.children = []; this.events = new Map(); this.hidden = false;
      this.isConnected = true; this.open = false; this.textContent = '';
      this.rect = { top: 0, bottom: 300, left: 0, right: 500, width: 500, height: 72 };
      const classes = new Set();
      this.classList = {
        add: (...values) => values.forEach(value => classes.add(value)),
        remove: (...values) => values.forEach(value => classes.delete(value)),
        contains: value => classes.has(value),
        toggle: (value, force) => {
          const add = force === undefined ? !classes.has(value) : force;
          add ? classes.add(value) : classes.delete(value); return add;
        }
      };
      Object.defineProperty(this, 'className', {
        get: () => [...classes].join(' '),
        set: value => { classes.clear(); String(value).split(/\s+/).filter(Boolean).forEach(item => classes.add(item)); }
      });
      this.style = { setProperty(key, value) { this[key] = value; } };
      Object.entries(attrs).forEach(([key, value]) => this.setAttribute(key, value));
    }
    setAttribute(key, value) {
      this.attributes[key] = String(value);
      if (key.startsWith('data-')) this.dataset[key.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = String(value);
      if (key === 'href') this.href = String(value);
      if (key === 'class') this.className = value;
    }
    getAttribute(key) { return this.attributes[key] ?? null; }
    hasAttribute(key) { return key in this.attributes; }
    removeAttribute(key) { delete this.attributes[key]; }
    addEventListener(type, callback) { listeners(this.events, type, callback); }
    async emit(type, properties = {}) {
      const event = { target: this, button: 0, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, ...properties };
      for (const callback of this.events.get(type) || []) await callback(event);
      return event;
    }
    focus() { document.activeElement = this; }
    contains(element) { return element === this || this.children.some(child => child.contains(element)); }
    closest() { return this.tagName === 'A' && this.href ? this : null; }
    getBoundingClientRect() { return this.rect; }
    append(...children) {
      children.forEach(child => {
        if (child.tagName === 'FRAGMENT') this.append(...child.children);
        else { child.parentElement = this; this.children.push(child); }
      });
    }
    replaceChildren(...children) { this.children = []; this.append(...children); }
    matches(selector) {
      return selector.split(',').some(part => {
        const value = part.trim();
        if (value === 'a' || value === 'img') return this.tagName === value.toUpperCase();
        if (value === 'a[href]') return this.tagName === 'A' && this.hasAttribute('href');
        if (value === 'button:not([disabled])') return this.tagName === 'BUTTON' && !this.hasAttribute('disabled');
        if (value === 'dialog[open]') return this.tagName === 'DIALOG' && this.open;
        if (value.startsWith('.')) return this.classList.contains(value.slice(1));
        if (/^\[[\w-]+\]$/.test(value)) return this.hasAttribute(value.slice(1, -1));
        return false;
      });
    }
    querySelectorAll(selector) {
      return this.children.flatMap(child => [...(child.matches(selector) ? [child] : []), ...child.querySelectorAll(selector)]);
    }
    querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
    showModal() { this.open = true; }
    close() { this.open = false; this.emit('close'); }
  }
  document = {
    readyState: 'complete', documentElement: new Element('html'), activeElement: null, hidden: false,
    getElementById: id => byId.get(id) || null,
    querySelectorAll: selector => bySelector.get(selector) || [],
    querySelector: selector => {
      if (selector.startsWith('.email-link') || selector.startsWith('a[href="mailto:')) return byId.get('email') || null;
      if (selector === 'dialog[open]') return [...byId.values()].find(element => element.matches(selector)) || null;
      return (bySelector.get(selector) || [])[0] || null;
    },
    createElement: tag => new Element(tag), createDocumentFragment: () => new Element('fragment'),
    createRange: () => ({ selectNodeContents(element) { document.selected = element; } }),
    addEventListener(type, callback) { listeners(documentEvents, type, callback); }
  };
  document.documentElement.scrollHeight = 2400;
  const window = {
    innerHeight: 800, scrollY: 0, isSecureContext: secure,
    addEventListener(type, callback) { listeners(windowEvents, type, callback); },
    requestAnimationFrame(callback) { const id = ++frameId; frames.set(id, callback); return id; },
    cancelAnimationFrame: id => frames.delete(id),
    scrollTo: options => window.lastScroll = options,
    setTimeout: () => 1, clearTimeout() {}, setInterval() {},
    getSelection: () => ({ removeAllRanges() {}, addRange() {} }),
    matchMedia(query) {
      if (!media.has(query)) media.set(query, {
        matches: query.includes('reduced-motion') ? reducedMotion : query.includes('pointer: fine') ? finePointer : false,
        addEventListener(type, callback) { listeners(this.events, type, callback); }, events: new Map()
      });
      return media.get(query);
    }
  };
  const add = (id, tag = 'div', attrs = {}) => { const element = new Element(tag, attrs); byId.set(id, element); return element; };
  if (!empty) {
    add('navbar'); add('menu-toggle', 'button', { 'aria-expanded': 'false' }); add('mobile-menu').hidden = true;
    add('mobile-first', 'a', { href: '#work' }); add('mobile-last', 'a', { href: '#contact' });
    byId.get('mobile-menu').append(byId.get('mobile-first'), byId.get('mobile-last'));
    add('scroll-progress', 'div', { role: 'progressbar' });
    add('project-count'); add('copy-email', 'button'); add('copy-status');
    add('email', 'a', { href: 'mailto:akhilbayya111@gmail.com' });
    add('work').rect.top = 700;
    bySelector.set('[data-filter]', ['all', 'ai', 'healthcare'].map(value => new Element('button', { 'data-filter': value })));
    bySelector.set('[data-category]', ['ai', 'healthcare', 'ai', 'ai', 'ai healthcare'].map(value => new Element('article', { 'data-category': value })));
    bySelector.set('.reveal', [new Element('section')]);
    bySelector.set('[data-project]', ['krishi', 'mediflow', 'apex', 'auro', 'carebridge'].map(value => new Element('button', { 'data-project': value })));
    for (const id of ['project-dialog', 'image-dialog']) add(id, 'dialog').append(new Element('button', { 'data-close-dialog': '' }));
    add('dialog-content'); byId.get('project-dialog').append(byId.get('dialog-content'));
    add('lightbox-image', 'img'); add('lightbox-caption');
    bySelector.set('[data-lightbox]', [new Element('button', { 'data-lightbox': 'images/award-1.jpeg', 'data-caption': 'Ideathon award' })]);
    bySelector.set('.portrait-scene', [new Element('figure')]);
  }
  const context = {
    document, window, navigator: { clipboard: { async writeText(text) { context.copied = text; } } },
    location: new URL('https://portfolio.example/index.html'),
    history: { pushState(...args) { context.hash = args[2]; } }, URL, Date, Intl, console
  };
  vm.runInNewContext(source, context);
  const dispatch = async (map, type, properties = {}) => {
    const event = { button: 0, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, ...properties };
    for (const callback of map.get(type) || []) await callback(event);
    return event;
  };
  return {
    context, document, window, byId, bySelector, media, Element,
    clickDocument: target => dispatch(documentEvents, 'click', { target }),
    keydown: properties => dispatch(documentEvents, 'keydown', properties),
    windowEvent: type => dispatch(windowEvents, type),
    flushFrames() { const pending = [...frames.values()]; frames.clear(); pending.forEach(callback => callback()); },
    async setMedia(query, matches) {
      const target = media.get(query); target.matches = matches;
      return dispatch(target.events, 'change', { matches });
    }
  };
}

test('optional missing elements and reduced motion do not break initialization', async () => {
  assert.doesNotThrow(() => fixture({ empty: true }));
  const f = fixture({ finePointer: true });
  assert.equal(f.document.documentElement.classList.contains('js-motion'), false);
  assert.equal(f.bySelector.get('.reveal')[0].classList.contains('is-visible'), true);
  const portrait = f.bySelector.get('.portrait-scene')[0];
  await portrait.emit('pointermove', { clientX: 400, clientY: 30 }); f.flushFrames();
  assert.equal(portrait.style['--pointer-x'], undefined);
});

test('filters show all five projects, four AI projects, and both healthcare projects', async () => {
  const f = fixture(), filters = f.bySelector.get('[data-filter]'), cards = f.bySelector.get('[data-category]');
  for (const [index, expected] of [[1, 4], [2, 2], [0, 5]]) {
    await filters[index].emit('click');
    assert.equal(cards.filter(card => !card.hidden).length, expected);
    assert.equal(f.byId.get('project-count').textContent, `${expected} projects`);
    assert.equal(filters[index].getAttribute('aria-pressed'), 'true');
    assert.equal(filters.filter(filter => filter.getAttribute('aria-pressed') === 'true').length, 1);
  }
});

test('mobile menu closes on Escape, returns focus, and closes at the desktop breakpoint', async () => {
  const f = fixture(), toggle = f.byId.get('menu-toggle'), menu = f.byId.get('mobile-menu');
  await toggle.emit('click'); assert.equal(menu.hidden, false);
  await f.keydown({ key: 'Escape' });
  assert.equal(menu.hidden, true); assert.equal(f.document.activeElement, toggle);
  await toggle.emit('click'); await f.setMedia('(min-width: 761px)', true);
  assert.equal(menu.hidden, true); assert.equal(toggle.getAttribute('aria-expanded'), 'false');
});

test('open mobile navigation loops keyboard focus and closes after a link is chosen', async () => {
  const f = fixture(), toggle = f.byId.get('menu-toggle'), last = f.byId.get('mobile-last');
  await toggle.emit('click'); toggle.focus();
  assert.equal((await f.keydown({ key: 'Tab', shiftKey: true })).defaultPrevented, true);
  assert.equal(f.document.activeElement, last);
  assert.equal((await f.keydown({ key: 'Tab', shiftKey: false })).defaultPrevented, true);
  assert.equal(f.document.activeElement, toggle);
  await f.byId.get('mobile-first').emit('click');
  assert.equal(f.byId.get('mobile-menu').hidden, true);
  assert.equal((await f.keydown({ key: 'Tab', shiftKey: true })).defaultPrevented, false);
});

test('navigation handles valid targets while malformed, empty, and external hashes stay native', async () => {
  const f = fixture();
  for (const href of ['#', '#missing', '#%E0%A4%A', 'projects.html#work', 'https://other.example/#work']) {
    assert.equal((await f.clickDocument(new f.Element('a', { href }))).defaultPrevented, false);
  }
  const event = await f.clickDocument(new f.Element('a', { href: '#work' }));
  assert.equal(event.defaultPrevented, true); assert.equal(f.context.hash, '#work');
  assert.equal(f.window.lastScroll.behavior, 'instant'); assert.equal(f.window.lastScroll.top, 600);
  assert.equal(f.document.activeElement, f.byId.get('work'));
});

test('all five case studies render and modal close restores the triggering control', async () => {
  const f = fixture(), dialog = f.byId.get('project-dialog');
  const expected = ['Krishi Chakra 2.0', 'MediFlow AI', 'ApexResume', 'Insight Companion — Auro', 'CareBridge'];
  for (const [index, trigger] of f.bySelector.get('[data-project]').entries()) {
    await trigger.emit('click'); assert.equal(dialog.open, true);
    const title = f.byId.get('dialog-content').querySelector('.dialog-title');
    assert.equal(title.textContent, expected[index]); assert.equal(f.document.activeElement, title);
    assert.equal(f.document.documentElement.classList.contains('dialog-open'), true);
    await dialog.children[0].emit('click'); assert.equal(dialog.open, false);
    assert.equal(f.document.activeElement, trigger);
    assert.equal(f.document.documentElement.classList.contains('dialog-open'), false);
  }
});

test('photo preview uses the chosen image and its meaningful caption', async () => {
  const f = fixture(); await f.bySelector.get('[data-lightbox]')[0].emit('click');
  assert.equal(f.byId.get('image-dialog').open, true);
  assert.equal(f.byId.get('lightbox-image').src, 'images/award-1.jpeg');
  assert.equal(f.byId.get('lightbox-caption').textContent, 'Ideathon award');
});

test('copy email reports actual success and gives an honest manual fallback', async () => {
  const success = fixture(); await success.byId.get('copy-email').emit('click');
  assert.equal(success.context.copied, 'akhilbayya111@gmail.com');
  assert.match(success.byId.get('copy-status').textContent, /Email copied/);
  const fallback = fixture({ secure: false }); await fallback.byId.get('copy-email').emit('click');
  assert.match(fallback.byId.get('copy-status').textContent, /Copy manually/);
  assert.equal(fallback.document.selected, fallback.byId.get('email'));
});

test('scroll progress updates, clamps at the end, and handles a page without overflow', async () => {
  const f = fixture(), progress = f.byId.get('scroll-progress');
  assert.equal(progress.style.transform, 'scaleX(0)');
  f.window.scrollY = 800; await f.windowEvent('scroll'); f.flushFrames();
  assert.equal(progress.style.transform, 'scaleX(0.5)');
  assert.equal(progress.getAttribute('aria-valuenow'), '50');
  assert.equal(f.byId.get('navbar').classList.contains('is-scrolled'), true);
  f.window.scrollY = 2000; await f.windowEvent('scroll'); f.flushFrames();
  assert.equal(progress.style.transform, 'scaleX(1)');
  f.document.documentElement.scrollHeight = 800; await f.windowEvent('resize'); f.flushFrames();
  assert.equal(progress.style.transform, 'scaleX(0)');
});
