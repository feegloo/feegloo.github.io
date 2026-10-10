import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL(process.env.FRONTEND_PATH || '../../../udid/app.js', import.meta.url), 'utf8');
const modernUDID = '00000000-0000000000000001';
const legacyUDID = 'A'.repeat(40);

function run({ hash = '', pending = null, clipboard } = {}) {
  const events = {};
  const elements = Object.fromEntries(
    ['start', 'result', 'udid', 'status', 'download', 'copy', 'instruction-carousel'].map(id => [
      id, { hidden: id === 'result', textContent: '', value: '', listeners: {},
        addEventListener(name, handler) { this.listeners[name] = handler; },
        focus() { this.focused = true; },
        select() { this.selected = true; },
        setSelectionRange(start, end) { this.selection = [start, end]; },
      },
    ]),
  );
  elements['instruction-carousel'].querySelector = () => ({
    style: { setProperty() {}, removeProperty() {} },
  });
  const location = { hash, pathname: '/udid/', assign() {} };
  let stored = pending, removed = false, cleared = false, scrolls = 0;
  vm.runInNewContext(source, {
    document: { getElementById: id => elements[id] },
    window: {
      addEventListener(name, handler) { events[name] = handler; },
      scrollTo(x, y) { assert.equal(x, 0); assert.equal(y, 0); scrolls++; },
    },
    location,
    history: { replaceState() { cleared = true; location.hash = ''; } },
    URLSearchParams, Date,
    localStorage: {
      getItem: () => JSON.stringify(stored),
      setItem(key, value) { stored = JSON.parse(value); },
      removeItem() { removed = true; stored = null; },
    },
    Image: class {},
    navigator: { clipboard },
  });
  return {
    elements, events, location,
    get removed() { return removed; },
    get cleared() { return cleared; },
    get scrolls() { return scrolls; },
  };
}

function returnedHash(udid = modernUDID, state = 'abc') {
  return '#udid=' + udid + '&state=' + state;
}

test('initial load accepts modern and legacy UDID and clears URL and session', () => {
  for (const udid of [modernUDID, legacyUDID]) {
    const result = run({ hash: returnedHash(udid), pending: { state: 'abc', created: Date.now() } });
    assert.equal(result.elements.start.hidden, true);
    assert.equal(result.elements.result.hidden, false);
    assert.equal(result.elements.udid.value, udid);
    assert.equal(result.removed, true);
    assert.equal(result.cleared, true);
    assert.equal(result.scrolls, 1);
  }
});

test('Safari same-document hash return displays the result without reloading', () => {
  const result = run({ pending: { state: 'abc', created: Date.now() } });
  assert.equal(result.elements.result.hidden, true);
  result.location.hash = returnedHash(legacyUDID);
  result.events.hashchange();
  assert.equal(result.elements.result.hidden, false);
  assert.equal(result.elements.udid.value, legacyUDID);
  assert.equal(result.location.hash, '');
  assert.equal(result.scrolls, 1);
});

test('Safari restored page processes return and repeated lifecycle events retain result', () => {
  const result = run({ pending: { state: 'abc', created: Date.now() } });
  result.location.hash = returnedHash();
  result.events.pageshow();
  result.events.hashchange();
  result.events.pageshow();
  assert.equal(result.elements.result.hidden, false);
  assert.equal(result.elements.udid.value, modernUDID);
  assert.equal(result.elements.status.textContent, '');
  assert.equal(result.scrolls, 1);
});

test('wrong, missing and expired sessions and malformed UDID are rejected', () => {
  for (const options of [
    { pending: null },
    { pending: { state: 'wrong', created: Date.now() } },
    { pending: { state: 'abc', created: Date.now() - 1801000 } },
    { hash: returnedHash('invalid'), pending: { state: 'abc', created: Date.now() } },
  ]) {
    const result = run({ hash: returnedHash(), ...options });
    assert.equal(result.elements.result.hidden, true);
    assert.ok(result.elements.status.textContent);
    assert.equal(result.cleared, true);
    assert.equal(result.removed, false);
  }
});

test('older Safari without clipboard API falls back to native selection', async () => {
  const result = run({ hash: returnedHash(legacyUDID), pending: { state: 'abc', created: Date.now() } });
  await result.elements.copy.listeners.click();
  assert.equal(result.elements.udid.focused, true);
  assert.equal(result.elements.udid.selected, true);
  assert.deepEqual(result.elements.udid.selection, [0, 40]);
});

test('copy uses clipboard API when available', async () => {
  let copied;
  const result = run({
    hash: returnedHash(), pending: { state: 'abc', created: Date.now() },
    clipboard: { async writeText(value) { copied = value; } },
  });
  await result.elements.copy.listeners.click();
  assert.equal(copied, modernUDID);
  assert.equal(result.elements.status.textContent, 'Skopiowano UDID.');
});
