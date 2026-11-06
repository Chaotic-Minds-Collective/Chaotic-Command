import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';

const html = readFileSync(new URL('../web/index.html', import.meta.url), 'utf8');
const script = readFileSync(new URL('../web/app.js', import.meta.url), 'utf8');
// Exercise the workspace navigation/dashboard code without starting the session.
const prefix = script.slice(0, script.indexOf('/** Enable or disable every form control'));

function fixture(status = { channels: 3, roles: 2 }) {
  let focused;
  const elements = new Map();
  function element(markup) {
    const attrs = Object.fromEntries([...markup.matchAll(/([\w-]+)="([^"]*)"/g)].map(m => [m[1], m[2]]));
    const listeners = {};
    const el = {
      id: attrs.id, attrs, innerHTML: '', tabIndex: Number(attrs.tabindex), hidden: false,
      getAttribute: name => attrs[name],
      setAttribute: (name, value) => { attrs[name] = value; },
      addEventListener: (name, listener) => { listeners[name] = listener; },
      matches: selector => selector === '[role="tab"]' && attrs.role === 'tab',
      focus() { focused = el; },
      fire(name, key, target = el) {
        let prevented = false;
        listeners[name]({ key, target, preventDefault() { prevented = true; } });
        return prevented;
      }
    };
    if (el.id) elements.set(el.id, el);
    return el;
  }
  const tabs = [...html.matchAll(/<button[^>]*role="tab"[^>]*>/g)].map(m => element(m[0]));
  const panels = [...html.matchAll(/<section[^>]*role="tabpanel"[^>]*>/g)].map(m => element(m[0]));
  const nav = element(html.match(/<nav class="section-tabs"[^>]*>/)[0]);
  for (const id of ['dashboard-cards', 'dashboard-quick']) element('<div id="' + id + '">');
  const jumps = ['audit-panel', 'template-setup', 'bot-management', 'server-picker'].map(id => element('<button data-jump="' + id + '">'));
  const context = createContext({
    document: {
      getElementById: id => elements.get(id),
      querySelectorAll: selector => selector.startsWith('.section-tabs') ? tabs : jumps,
      querySelector: selector => selector === '.section-tabs' ? nav : tabs.find(t => selector.includes('"' + t.attrs['data-tab'] + '"'))
    },
    fetch: async path => {
      const body = path === '/api/bots' ? { bots: [] } : path === '/api/guilds' ? { guilds: [] } : status;
      return { ok: !body.error, status: body.error ? 403 : 200, json: async () => body };
    }
  });
  runInContext(prefix, context);
  runInContext("sessionUser = { username: 'Tester' }; selected = '12345678901234567'; initTabs('dashboard');", context);
  return { tabs, panels, nav, jumps, elements, context, focused: () => focused };
}

test('workspace tabs have reciprocal panel relationships and one tab stop', () => {
  const f = fixture();
  assert.equal(f.tabs.length, 9);
  assert.equal(f.nav.attrs.role, 'tablist');
  for (const tab of f.tabs) {
    const panel = f.panels.find(p => p.id === tab.attrs['aria-controls']);
    assert.ok(panel);
    assert.equal(panel.attrs['aria-labelledby'], tab.id);
    assert.equal(panel.tabIndex, 0);
    assert.equal(tab.tabIndex, tab.id === 'tab-dashboard' ? 0 : -1);
  }
});

test('keyboard reaches every workspace tab, wraps, and synchronizes selection and focus', () => {
  const f = fixture();
  function navigate(from, key, to) {
    assert.equal(f.nav.fire('keydown', key, f.tabs[from]), true);
    assert.equal(f.focused(), f.tabs[to]);
    f.tabs.forEach((tab, i) => {
      assert.equal(tab.attrs['aria-selected'], String(i === to));
      assert.equal(tab.tabIndex, i === to ? 0 : -1);
      assert.equal(f.elements.get(tab.attrs['aria-controls']).hidden, i !== to);
    });
  }
  for (let i = 0; i < 9; i++) navigate(i, 'ArrowRight', (i + 1) % 9);
  navigate(0, 'ArrowLeft', 8);
  navigate(8, 'Home', 0);
  navigate(0, 'End', 8);
  assert.equal(f.nav.fire('keydown', 'Tab', f.tabs[8]), false);
  f.tabs[6].fire('click');
  assert.equal(f.tabs[6].tabIndex, 0);
});

test('dashboard jumps transfer focus out of the hidden dashboard', async () => {
  const f = fixture();
  await runInContext('renderDashboard()', f.context);
  f.jumps[0].fire('click');
  assert.equal(f.focused(), f.tabs[3]);
  assert.equal(f.elements.get('dashboard').hidden, true);
});

test('status failures never imply missing installation; success and unassigned states remain distinct', async () => {
  for (const error of [
    'Discord denied access. Check bot membership, permissions and role hierarchy.',
    'Discord could not be reached. Try again.',
    'Discord rate limit reached. Try again later.',
    'Discord authorization expired or is invalid.'
  ]) {
    const f = fixture({ error });
    await runInContext('renderDashboard()', f.context);
    const cards = f.elements.get('dashboard-cards').innerHTML;
    assert.match(cards, /Status unavailable/);
    assert.ok(cards.includes(error));
    assert.doesNotMatch(cards, /Bot not installed|install link/);
  }
  const success = fixture();
  await runInContext('renderDashboard()', success.context);
  assert.match(success.elements.get('dashboard-cards').innerHTML, /3 channels · 2 roles/);
  const unassigned = fixture({ error: 'Connect your own Discord bot or select an available bot before continuing.' });
  await runInContext('renderDashboard()', unassigned.context);
  assert.match(unassigned.elements.get('dashboard-cards').innerHTML, /No bot assigned/);
});
