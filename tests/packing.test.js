'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../packing.js');

const byName = (items, name) => items.find((item) => item.name === name);
const names = (items) => items.map((item) => item.name);

test('clamps days between 1 and 60', () => {
  assert.equal(L.clampDays(0), 1);
  assert.equal(L.clampDays(-4), 1);
  assert.equal(L.clampDays('7'), 7);
  assert.equal(L.clampDays(61), 60);
  assert.equal(L.clampDays(999), 60);
  assert.equal(L.clampDays('abc'), 1);
});

test('default formulas scale with trip length', () => {
  const items = L.generateItems({ days: 3, types: ['Städtetrip'], weather: 'Sonnig' });
  assert.equal(byName(items, 'Unterwäsche').qty, 4);
  assert.equal(byName(items, 'Socken').qty, 4);
  assert.equal(byName(items, 'T-Shirts & Oberteile').qty, 3);
  assert.equal(byName(items, 'Hosen').qty, 2);
});

test('applies custom per-day ratios and buffers', () => {
  const rules = L.normalizeRules({
    underwear: { perDay: 2, buffer: 2 },
    socks: { perDay: 0.5, buffer: 0 },
    tops: { perDay: 3, buffer: 1 },
    bottoms: { perDay: 1, buffer: 0 },
  });
  const items = L.generateItems({ days: 4, types: [], weather: 'Sonnig', rules });
  assert.equal(byName(items, 'Unterwäsche').qty, 10);
  assert.equal(byName(items, 'Socken').qty, 2);
  assert.equal(byName(items, 'T-Shirts & Oberteile').qty, 13);
  assert.equal(byName(items, 'Hosen').qty, 4);
});

test('rule quantities never drop below one and respect the cap', () => {
  assert.equal(L.ruleQty(1, { perDay: 0.5, buffer: 0 }), 1);
  assert.equal(L.ruleQty(5, { perDay: 1, buffer: 0 }), 5);
  assert.equal(L.ruleQty(5, { perDay: 0.5, buffer: 1 }), 4);
  assert.equal(L.ruleQty(60, { perDay: 3, buffer: 5 }), 99);
});

test('normalizes invalid rule input to safe defaults', () => {
  const rules = L.normalizeRules({
    underwear: { perDay: 7, buffer: -3 },
    socks: { perDay: '1', buffer: 200 },
    tops: 'nope',
    hacker: { perDay: 2, buffer: 2 },
  });
  assert.deepEqual(rules.underwear, { perDay: 1, buffer: 0 });
  assert.deepEqual(rules.socks, { perDay: 1, buffer: L.MAX_BUFFER });
  assert.deepEqual(rules.tops, L.DEFAULT_RULES.tops);
  assert.equal('hacker' in rules, false);
  assert.deepEqual(L.normalizeRules(rules), rules);
  assert.deepEqual(L.resetRules(), L.DEFAULT_RULES);
});

test('adds beach kit for Strand', () => {
  const items = L.generateItems({ days: 5, types: ['Strand'], weather: 'Regen' });
  assert.equal(byName(items, 'Badekleidung').qty, 2);
  assert.ok(names(items).includes('Flip-Flops'));
  assert.ok(names(items).includes('Sonnenhut'));
  assert.ok(names(items).includes('Regenschirm'));
});

test('adds cold-weather gear without summer items', () => {
  const items = L.generateItems({ days: 2, types: ['Business'], weather: 'Kalt' });
  ['Warme Jacke', 'Mütze', 'Handschuhe', 'Schal', 'Lippenpflege'].forEach((name) => {
    assert.ok(names(items).includes(name), name);
  });
  assert.ok(!names(items).includes('Sonnenbrille'));
  assert.ok(!names(items).includes('Sonnencreme'));
});

test('rain weather adds waterproof gear', () => {
  const items = L.generateItems({ days: 3, types: ['Wandern'], weather: 'Regen' });
  ['Regenjacke', 'Wasserfeste Schuhe', 'Regenschirm', 'Wanderschuhe'].forEach((name) => {
    assert.ok(names(items).includes(name), name);
  });
});

test('adds business equipment', () => {
  const items = L.generateItems({ days: 2, types: ['Business'], weather: 'Sonnig' });
  assert.equal(byName(items, 'Hemd / Bluse').qty, 2);
  assert.ok(names(items).includes('Laptop'));
  assert.ok(names(items).includes('Business-Schuhe'));
  assert.ok(names(items).includes('Visitenkarten'));
  assert.ok(names(items).includes('Powerbank'));
});

test('hiking trips get outdoor and safety items', () => {
  const items = L.generateItems({ days: 3, types: ['Wandern'], weather: 'Sonnig' });
  ['Wanderschuhe', 'Erste-Hilfe-Set', 'Trinkflasche', 'Stirnlampe', 'Führerschein'].forEach((name) => {
    assert.ok(names(items).includes(name), name);
  });
});

test('multiple trip types combine their kits', () => {
  const items = L.generateItems({ days: 4, types: ['Strand', 'Business'], weather: 'Sonnig' });
  ['Flip-Flops', 'Laptop', 'Badekleidung', 'Visitenkarten'].forEach((name) => {
    assert.ok(names(items).includes(name), name);
  });
});

test('always covers the core categories', () => {
  const items = L.generateItems({ days: 3, types: [], weather: 'Sonnig' });
  const cats = new Set(items.map((item) => item.cat));
  ['Kleidung', 'Kulturbeutel', 'Dokumente', 'Technik', 'Sonstiges'].forEach((cat) => {
    assert.ok(cats.has(cat), cat);
  });
  assert.ok(items.every((item) => item.qty >= 1));
  assert.ok(items.every((item) => L.CATEGORIES.includes(item.cat)));
});

test('items are unique per name and category', () => {
  const items = L.generateItems({
    days: 60,
    types: ['Strand', 'Wandern', 'Business', 'Städtetrip'],
    weather: 'Regen',
  });
  const keys = items.map((item) => item.cat + '|' + item.name);
  assert.equal(new Set(keys).size, keys.length);
});

test('progress counts packed quantities, not positions', () => {
  const items = [
    { qty: 2, packed: true },
    { qty: 3, packed: false },
    { qty: 5, packed: true },
  ];
  assert.deepEqual(L.progress(items), { total: 10, packed: 7, percent: 70 });
  assert.deepEqual(L.progress([]), { total: 0, packed: 0, percent: 0 });
});

test('unknown input falls back to safe defaults', () => {
  const items = L.generateItems({ days: 1, types: ['Rakete'], weather: 'Schnee' });
  assert.ok(items.length > 0);
  assert.ok(items.every((item) => L.CATEGORIES.includes(item.cat)));
  assert.ok(!byName(items, 'Regenjacke'));
});

test('recalculation updates formula quantities and keeps custom rows', () => {
  const existing = [
    { id: 'a', name: 'Unterwäsche', cat: 'Kleidung', qty: 2, packed: true, custom: false },
    { id: 'b', name: 'Reiseadapter', cat: 'Technik', qty: 1, packed: true, custom: true },
    { id: 'c', name: 'Badehose', cat: 'Kleidung', qty: 1, packed: false, custom: false },
  ];
  const rules = L.normalizeRules({ underwear: { perDay: 2, buffer: 0 } });
  const next = L.recalculateItems(existing, { days: 3, types: [], weather: 'Sonnig', rules });
  const underwear = next.find((item) => item.name === 'Unterwäsche');
  assert.equal(underwear.qty, 6);
  assert.equal(underwear.packed, true);
  assert.equal(underwear.id, 'a');
  const custom = next.find((item) => item.name === 'Reiseadapter');
  assert.equal(custom.qty, 1);
  assert.equal(custom.packed, true);
  assert.equal(next.some((item) => item.name === 'Badehose'), false);
});
