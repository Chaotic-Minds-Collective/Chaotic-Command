import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const html = readFileSync(new URL('../web/home.html', import.meta.url), 'utf8');
const script = readFileSync(new URL('../web/home.js', import.meta.url), 'utf8');

function fixture(session) {
  let focused;
  let replaced;
  function element(markup) {
    const attributes = Object.fromEntries([...markup.matchAll(/([\w-]+)="([^"]*)"/g)].map(m => [m[1], m[2]]));
    const listeners = {};
    return {
      id: attributes.id, attributes, hidden: /\shidden(?:>|\s)/.test(markup),
      tabIndex: Number(attributes.tabindex),
      getAttribute: name => attributes[name],
      setAttribute: (name, value) => { attributes[name] = value; },
      addEventListener: (name, listener) => { listeners[name] = listener; },
      focus() { focused = this; },
      fire(name, key) {
        let prevented = false;
        listeners[name]({ key, preventDefault() { prevented = true; } });
        return prevented;
      }
    };
  }
  const tabs = [...html.matchAll(/<button class="nav-tab"[^>]*>/g)].map(m => element(m[0]));
  const panels = [...html.matchAll(/<section class="panel"[^>]*>/g)].map(m => element(m[0]));
  const jumps = [...html.matchAll(/<button[^>]*class="[^"]*tab-jump"[^>]*>/g)].map(m => element(m[0]));
  const elements = [...tabs, ...panels, ...jumps];
  runInNewContext(script, {
    document: {
      querySelectorAll: selector => selector === '.nav-tab' ? tabs : jumps,
      getElementById: id => elements.find(e => e.id === id)
    }, window: {
      scrollTo() {},
      location: session ? { replace(url) { replaced = url; } } : undefined,
      fetch: session ? async () => ({ json: async () => session }) : undefined
    }
  });
  function selected(index) {
    tabs.forEach((tab, i) => {
      assert.equal(tab.attributes['aria-selected'], String(i === index));
      assert.equal(tab.tabIndex, i === index ? 0 : -1);
      assert.equal(panels[i].hidden, i !== index);
    });
  }
  return { tabs, panels, jumps, selected, replaced: () => replaced, focused: () => focused };
}

test('homepage exposes related tabs and focusable panels, excluding Documentation from the tablist', () => {
  const { tabs, panels, selected } = fixture();
  assert.equal(tabs.length, 5);
  assert.equal(panels.length, tabs.length);
  selected(0);
  tabs.forEach((tab, i) => {
    assert.equal(tab.attributes.role, 'tab');
    assert.equal(tab.attributes['aria-controls'], panels[i].id);
    assert.equal(panels[i].attributes.role, 'tabpanel');
    assert.equal(panels[i].attributes['aria-labelledby'], tab.id);
    assert.equal(panels[i].tabIndex, 0);
  });
  const list = html.match(/<div class="tab-list"[^>]*>([\s\S]*?)<\/div>/);
  assert.match(list[0], /role="tablist" aria-label="[^"]+"/);
  assert.doesNotMatch(list[1], /<a /);
  assert.match(html.slice(html.indexOf(list[0]) + list[0].length), /<a class="nav-link"[^>]*>Documentation<\/a>/);
});

test('tab keyboard navigation wraps, supports Home/End, and preserves ordinary keys', () => {
  const f = fixture();
  for (const [from, key, to] of [[0, 'ArrowLeft', 4], [4, 'ArrowRight', 0], [0, 'End', 4], [4, 'Home', 0], [0, 'ArrowRight', 1], [1, 'ArrowLeft', 0]]) {
    assert.equal(f.tabs[from].fire('keydown', key), true);
    f.selected(to);
    assert.equal(f.focused(), f.tabs[to]);
  }
  assert.equal(f.tabs[0].fire('keydown', 'Tab'), false);
  f.selected(0);
  f.tabs[4].fire('click');
  f.selected(4);
});

test('panel jump moves focus to the selected tab instead of leaving it in a hidden panel', () => {
  const f = fixture();
  f.jumps[0].fire('click');
  f.selected(1);
  assert.equal(f.focused(), f.tabs[1]);
});

test('comparison scroll region has a name, keyboard focus, overflow, and visible focus styling', () => {
  const css = readFileSync(new URL('../web/home.css', import.meta.url), 'utf8');
  assert.match(html, /<div class="compare-wrap" tabindex="0" role="region" aria-label="Feature comparison across plans">/);
  assert.match(css, /\.compare-wrap\{overflow-x:auto/);
  assert.match(css, /\.compare-table\{[^}]*min-width:640px/);
  assert.match(css, /\[tabindex="0"\]:focus-visible\{outline:3px solid var\(--green\)/);
});

test('signed-in visitors are redirected from the homepage to the command center', async () => {
  const { replaced: replacedRef } = fixture({ user: { id: '1', username: 'test-user' } });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(replacedRef(), '/command');
});

test('anonymous visitors stay on the homepage', async () => {
  const { replaced: replacedRef2 } = fixture({ user: null });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(replacedRef2(), undefined);
});
