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

test('scales clothing quantities with trip length', () => {
  const items = L.generateItems({ days: 3, category: 'Städtetrip', weather: 'Sonnig' });
  assert.equal(byName(items, 'Unterwäsche').qty, 4);
  assert.equal(byName(items, 'Socken').qty, 4);
  assert.equal(byName(items, 'T-Shirts / Oberteile').qty, 3);
  assert.equal(byName(items, 'Hosen').qty, 2);
});

test('adds beach kit for Strand', () => {
  const items = L.generateItems({ days: 5, category: 'Strand', weather: 'Gemischt' });
  assert.ok(names(items).includes('Badehose / Badeanzug'));
  assert.equal(byName(items, 'Badehose / Badeanzug').qty, 2);
  assert.ok(names(items).includes('Flip-Flops'));
  assert.ok(names(items).includes('Strandtuch'));
  assert.ok(names(items).includes('Regenschirm'));
});

test('adds cold-weather gear', () => {
  const items = L.generateItems({ days: 2, category: 'Business', weather: 'Kalt' });
  ['Warme Jacke', 'Mütze', 'Handschuhe', 'Schal', 'Lippenpflege'].forEach((name) => {
    assert.ok(names(items).includes(name), name);
  });
  assert.ok(!names(items).includes('Sonnenbrille'));
});

test('adds business equipment and no powerbank for short trips', () => {
  const items = L.generateItems({ days: 2, category: 'Business', weather: 'Sonnig' });
  assert.equal(byName(items, 'Hemd / Bluse').qty, 2);
  assert.equal(byName(items, 'Laptop').qty, 1);
  assert.equal(byName(items, 'Business-Schuhe').qty, 1);
  assert.ok(!names(items).includes('Powerbank'));
});

test('outdoor trips get hiking and safety items', () => {
  const items = L.generateItems({ days: 3, category: 'Outdoor', weather: 'Gemischt' });
  ['Wanderschuhe', 'Erste-Hilfe-Set', 'Trinkflasche', 'Stirnlampe', 'Regenjacke'].forEach((name) => {
    assert.ok(names(items).includes(name), name);
  });
});

test('always covers the core categories', () => {
  const items = L.generateItems({ days: 3, category: 'Städtetrip', weather: 'Sonnig' });
  const cats = new Set(items.map((item) => item.cat));
  ['Kleidung', 'Elektronik', 'Dokumente', 'Kosmetik', 'Sonstiges'].forEach((cat) => {
    assert.ok(cats.has(cat), cat);
  });
  assert.ok(items.every((item) => item.qty >= 1));
  assert.ok(items.every((item) => L.CATEGORIES.includes(item.cat)));
});

test('items are unique per name and category', () => {
  const items = L.generateItems({ days: 60, category: 'Strand', weather: 'Sonnig' });
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
  const items = L.generateItems({ days: 1, category: 'Rakete', weather: 'Schnee' });
  assert.ok(items.length > 0);
  assert.ok(items.every((item) => L.CATEGORIES.includes(item.cat)));
});
