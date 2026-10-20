/*
 * PackForge - pure packing logic.
 * No DOM access here so the formulas can be tested directly with Node.
 */
(function (global) {
  'use strict';

  var CATEGORIES = ['Kleidung', 'Kulturbeutel', 'Dokumente', 'Technik', 'Sonstiges'];
  var TRIP_TYPES = ['Städtetrip', 'Strand', 'Wandern', 'Business'];
  var WEATHER_TYPES = ['Sonnig', 'Kalt', 'Regen'];
  var MAX_DAYS = 60;
  var MAX_QTY = 99;
  var MAX_BUFFER = 10;

  /* Ratio options exposed to the rule configurator. */
  var RATIO_OPTIONS = [
    { value: 0.5, label: '1 pro 2 Tage' },
    { value: 1, label: '1 pro Tag' },
    { value: 2, label: '2 pro Tag' },
    { value: 3, label: '3 pro Tag' }
  ];

  var RULE_DEFS = [
    { key: 'underwear', label: 'Unterwäsche', hint: 'Basis für jeden Reisetag' },
    { key: 'socks', label: 'Socken', hint: 'Ein Paar pro Einheit' },
    { key: 'tops', label: 'Oberteile', hint: 'T-Shirts, Hemden, Pullover' },
    { key: 'bottoms', label: 'Hosen & Unterteile', hint: 'Hosen, Shorts, Röcke' }
  ];

  var DEFAULT_RULES = {
    underwear: { perDay: 1, buffer: 1 },
    socks: { perDay: 1, buffer: 1 },
    tops: { perDay: 1, buffer: 0 },
    bottoms: { perDay: 0.5, buffer: 0 }
  };

  function clampDays(value) {
    var days = Math.round(Number(value));
    if (!isFinite(days) || days < 1) return 1;
    if (days > MAX_DAYS) return MAX_DAYS;
    return days;
  }

  function clampQty(value) {
    var qty = Math.round(Number(value));
    if (!isFinite(qty) || qty < 1) return 1;
    return Math.min(MAX_QTY, qty);
  }

  function normalizeRule(raw, fallback) {
    if (!raw || typeof raw !== 'object') return { perDay: fallback.perDay, buffer: fallback.buffer };
    var perDay = Number(raw.perDay);
    var allowed = RATIO_OPTIONS.some(function (option) { return option.value === perDay; });
    var buffer = Math.round(Number(raw.buffer));
    return {
      perDay: allowed ? perDay : fallback.perDay,
      buffer: isFinite(buffer) ? Math.min(MAX_BUFFER, Math.max(0, buffer)) : fallback.buffer
    };
  }

  function normalizeRules(raw) {
    var source = raw && typeof raw === 'object' ? raw : {};
    var rules = {};
    RULE_DEFS.forEach(function (def) {
      rules[def.key] = normalizeRule(source[def.key], DEFAULT_RULES[def.key]);
    });
    return rules;
  }

  function resetRules() {
    return normalizeRules(null);
  }

  /* days * ratio, rounded up, plus the personal buffer. Never below 1. */
  function ruleQty(days, rule) {
    var span = clampDays(days);
    var perDay = rule && isFinite(Number(rule.perDay)) ? Number(rule.perDay) : 1;
    var buffer = rule && isFinite(Number(rule.buffer)) ? Math.max(0, Math.round(Number(rule.buffer))) : 0;
    return Math.min(MAX_QTY, Math.max(1, Math.ceil(span * perDay) + buffer));
  }

  function normalizeTypes(value) {
    var list = [];
    if (Array.isArray(value)) list = value;
    else if (typeof value === 'string' && value) list = [value];
    var result = [];
    list.forEach(function (type) {
      if (TRIP_TYPES.indexOf(type) >= 0 && result.indexOf(type) < 0) result.push(type);
    });
    return result;
  }

  function generateItems(input) {
    var source = input || {};
    var days = clampDays(source.days);
    var types = normalizeTypes(source.types !== undefined ? source.types : source.category);
    var weather = WEATHER_TYPES.indexOf(source.weather) >= 0 ? source.weather : 'Sonnig';
    var rules = normalizeRules(source.rules);
    var items = [];

    var has = function (type) { return types.indexOf(type) >= 0; };
    var isStrand = has('Strand');
    var isWandern = has('Wandern');
    var isBusiness = has('Business');
    var isStadt = has('Städtetrip');

    function add(cat, name, qty) {
      var amount = Math.max(0, Math.round(Number(qty) || 0));
      if (!amount) return;
      for (var i = 0; i < items.length; i += 1) {
        if (items[i].name === name && items[i].cat === cat) {
          items[i].qty = Math.min(MAX_QTY, items[i].qty + amount);
          return;
        }
      }
      items.push({ cat: cat, name: name, qty: amount, custom: false });
    }

    /* ---------------- Kleidung: Mengen folgen den Regeln ---------------- */
    add('Kleidung', 'Unterwäsche', ruleQty(days, rules.underwear));
    add('Kleidung', 'Socken', ruleQty(days, rules.socks));
    add('Kleidung', 'T-Shirts & Oberteile', ruleQty(days, rules.tops));

    var bottomsName = 'Hosen';
    if (isWandern) bottomsName = 'Wanderhosen';
    else if (isBusiness) bottomsName = 'Business-Hosen';
    else if (isStrand) bottomsName = 'Shorts';
    add('Kleidung', bottomsName, ruleQty(days, rules.bottoms));

    if (days >= 2) add('Kleidung', 'Schlafanzug', 1);

    if (isBusiness) {
      add('Kleidung', 'Hemd / Bluse', days);
      add('Kleidung', 'Blazer', 1);
      add('Kleidung', 'Business-Schuhe', 1);
    }
    if (isStrand) {
      add('Kleidung', 'Badekleidung', days >= 4 ? 2 : 1);
      add('Kleidung', 'Flip-Flops', 1);
      add('Sonstiges', 'Sonnenhut', 1);
    }
    if (isWandern) {
      add('Kleidung', 'Wanderschuhe', 1);
      add('Kleidung', 'Funktionssocken', Math.max(1, Math.ceil(days / 2)));
    }
    if (isStadt && !isWandern) add('Kleidung', 'Bequeme Sneaker', 1);

    if (weather === 'Kalt') {
      add('Kleidung', 'Warme Jacke', 1);
      add('Kleidung', 'Pullover', Math.max(1, Math.ceil(days / 2)));
      add('Kleidung', 'Mütze', 1);
      add('Kleidung', 'Handschuhe', 1);
      add('Kleidung', 'Schal', 1);
      add('Kulturbeutel', 'Lippenpflege', 1);
    } else if (weather === 'Regen') {
      add('Kleidung', 'Regenjacke', 1);
      add('Kleidung', 'Wasserfeste Schuhe', 1);
      add('Sonstiges', 'Regenschirm', 1);
    } else {
      add('Kleidung', 'Leichte Jacke', 1);
      add('Sonstiges', 'Sonnenbrille', 1);
      add('Kulturbeutel', 'Sonnencreme', 1);
    }

    /* ---------------- Technik ---------------- */
    add('Technik', 'Ladekabel', 1);
    add('Technik', 'Netzteil', 1);
    add('Technik', 'Kopfhörer', 1);
    if (isBusiness) {
      add('Technik', 'Laptop', 1);
      add('Technik', 'Laptop-Ladegerät', 1);
    }
    if (isWandern) add('Technik', 'Stirnlampe', 1);
    if (isStadt || isStrand) add('Technik', 'Kamera', 1);
    if (days >= 3 || isStrand || isWandern || isBusiness) add('Technik', 'Powerbank', 1);

    /* ---------------- Dokumente ---------------- */
    add('Dokumente', 'Reisepass / Ausweis', 1);
    add('Dokumente', 'Tickets & Buchungen', 1);
    add('Dokumente', 'Geldbörse & Karten', 1);
    add('Dokumente', 'Versicherungskarte', 1);
    if (isBusiness) add('Dokumente', 'Visitenkarten', 1);
    if (isWandern) add('Dokumente', 'Führerschein', 1);

    /* ---------------- Kulturbeutel ---------------- */
    add('Kulturbeutel', 'Zahnbürste & Zahnpasta', 1);
    add('Kulturbeutel', 'Deo', 1);
    add('Kulturbeutel', 'Shampoo / Duschgel', 1);
    add('Kulturbeutel', 'Rasierer', 1);
    add('Kulturbeutel', 'Handcreme', 1);

    /* ---------------- Sonstiges ---------------- */
    add('Sonstiges', 'Trinkflasche', 1);
    if (isWandern) add('Sonstiges', 'Erste-Hilfe-Set', 1);
    if (days >= 3) add('Sonstiges', 'Wäschebeutel', 1);
    if (days >= 5) add('Sonstiges', 'Reisewaschmittel', 1);

    return items;
  }

  /* Recompute standard quantities for an existing list, keeping custom rows. */
  function recalculateItems(items, input) {
    var generated = generateItems(input);
    var existing = Array.isArray(items) ? items : [];
    var result = generated.map(function (def) {
      var match = null;
      for (var i = 0; i < existing.length; i += 1) {
        if (existing[i].name === def.name && existing[i].cat === def.cat) { match = existing[i]; break; }
      }
      return {
        id: match ? match.id : null,
        cat: def.cat,
        name: def.name,
        qty: def.qty,
        packed: match ? Boolean(match.packed) : false,
        custom: false
      };
    });
    existing.forEach(function (item) {
      if (!item || !item.custom) return;
      var duplicate = result.some(function (entry) {
        return entry.name === item.name && entry.cat === item.cat;
      });
      if (duplicate) return;
      result.push({
        id: item.id,
        cat: item.cat,
        name: item.name,
        qty: clampQty(item.qty),
        packed: Boolean(item.packed),
        custom: true
      });
    });
    return result;
  }

  function totalQty(items) {
    return (items || []).reduce(function (sum, item) {
      return sum + Math.max(0, Number(item.qty) || 0);
    }, 0);
  }

  function packedQty(items) {
    return (items || []).reduce(function (sum, item) {
      return item.packed ? sum + Math.max(0, Number(item.qty) || 0) : sum;
    }, 0);
  }

  function progress(items) {
    var total = totalQty(items);
    var packed = packedQty(items);
    return {
      total: total,
      packed: packed,
      percent: total ? Math.round((packed / total) * 100) : 0
    };
  }

  var api = {
    CATEGORIES: CATEGORIES,
    TRIP_TYPES: TRIP_TYPES,
    WEATHER_TYPES: WEATHER_TYPES,
    MAX_DAYS: MAX_DAYS,
    MAX_QTY: MAX_QTY,
    MAX_BUFFER: MAX_BUFFER,
    RATIO_OPTIONS: RATIO_OPTIONS,
    RULE_DEFS: RULE_DEFS,
    DEFAULT_RULES: DEFAULT_RULES,
    clampDays: clampDays,
    clampQty: clampQty,
    normalizeRules: normalizeRules,
    resetRules: resetRules,
    ruleQty: ruleQty,
    normalizeTypes: normalizeTypes,
    generateItems: generateItems,
    recalculateItems: recalculateItems,
    totalQty: totalQty,
    packedQty: packedQty,
    progress: progress
  };

  global.PackForgeLogic = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
