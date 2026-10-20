/*
 * PackForge - pure packing logic.
 * No DOM access here so the rules can be tested directly with Node.
 */
(function (global) {
  'use strict';

  var CATEGORIES = ['Kleidung', 'Elektronik', 'Dokumente', 'Kosmetik', 'Sonstiges'];
  var TRIP_CATEGORIES = ['Städtetrip', 'Strand', 'Outdoor', 'Business'];
  var WEATHER_TYPES = ['Sonnig', 'Kalt', 'Gemischt'];
  var MAX_DAYS = 60;

  function clampDays(value) {
    var days = Math.round(Number(value));
    if (!isFinite(days) || days < 1) return 1;
    if (days > MAX_DAYS) return MAX_DAYS;
    return days;
  }

  function generateItems(input) {
    var days = clampDays(input && input.days);
    var category = TRIP_CATEGORIES.indexOf(input && input.category) >= 0 ? input.category : 'Städtetrip';
    var weather = WEATHER_TYPES.indexOf(input && input.weather) >= 0 ? input.weather : 'Gemischt';
    var items = [];

    function add(cat, name, qty) {
      var amount = Math.max(0, Math.round(qty));
      if (!amount) return;
      for (var i = 0; i < items.length; i += 1) {
        if (items[i].name === name && items[i].cat === cat) {
          items[i].qty += amount;
          return;
        }
      }
      items.push({ cat: cat, name: name, qty: amount, custom: false });
    }

    /* ---------------- Kleidung: Mengen wachsen mit den Tagen ---------------- */
    add('Kleidung', 'Unterwäsche', days + 1);
    add('Kleidung', 'Socken', days + 1);
    add('Kleidung', 'T-Shirts / Oberteile', days);

    var pants = Math.max(1, Math.ceil(days / 2));
    var bottomsName = 'Hosen';
    if (category === 'Strand') {
      pants = Math.max(1, Math.ceil(days / 3));
      bottomsName = 'Shorts / leichte Hosen';
    } else if (category === 'Business') {
      pants = days;
      bottomsName = 'Business-Hosen';
    } else if (category === 'Outdoor') {
      pants = Math.max(1, Math.ceil(days / 2));
      bottomsName = 'Wanderhosen';
    }
    add('Kleidung', bottomsName, pants);

    if (days >= 2) add('Kleidung', 'Schlafanzug', 1);

    if (weather === 'Kalt') {
      add('Kleidung', 'Warme Jacke', 1);
      add('Kleidung', 'Pullover', Math.max(1, Math.ceil(days / 2)));
      add('Kleidung', 'Mütze', 1);
      add('Kleidung', 'Handschuhe', 1);
      add('Kleidung', 'Schal', 1);
    } else if (weather === 'Gemischt') {
      add('Kleidung', 'Übergangsjacke', 1);
      add('Kleidung', 'Pullover', Math.max(1, Math.ceil(days / 3)));
      add('Kleidung', 'Regenjacke', 1);
    } else {
      add('Kleidung', 'Leichte Jacke', 1);
    }

    /* ---------------- Reise-Kategorie ---------------- */
    if (category === 'Städtetrip') {
      add('Kleidung', 'Bequeme Schuhe', 1);
      add('Elektronik', 'Kamera', 1);
      add('Sonstiges', 'Tagesrucksack', 1);
    } else if (category === 'Strand') {
      add('Kleidung', 'Badehose / Badeanzug', days >= 4 ? 2 : 1);
      add('Kleidung', 'Flip-Flops', 1);
      add('Sonstiges', 'Strandtuch', 1);
      add('Sonstiges', 'Sonnenhut', 1);
    } else if (category === 'Outdoor') {
      add('Kleidung', 'Wanderschuhe', 1);
      add('Kleidung', 'Funktionssocken', Math.max(1, Math.ceil(days / 2)));
      add('Sonstiges', 'Trinkflasche', 1);
      add('Sonstiges', 'Erste-Hilfe-Set', 1);
      add('Elektronik', 'Stirnlampe', 1);
    } else if (category === 'Business') {
      add('Kleidung', 'Hemd / Bluse', days);
      add('Kleidung', 'Blazer', 1);
      add('Kleidung', 'Business-Schuhe', 1);
      add('Elektronik', 'Laptop', 1);
      add('Elektronik', 'Laptop-Ladegerät', 1);
      add('Dokumente', 'Visitenkarten', 1);
    }

    /* ---------------- Wetter-Zusätze ---------------- */
    if (weather === 'Sonnig') {
      add('Kosmetik', 'Sonnencreme', 1);
      add('Sonstiges', 'Sonnenbrille', 1);
    }
    if (weather === 'Kalt') {
      add('Kosmetik', 'Lippenpflege', 1);
      add('Kosmetik', 'Handcreme', 1);
    }
    if (weather === 'Gemischt') {
      add('Sonstiges', 'Regenschirm', 1);
    }

    /* ---------------- Elektronik ---------------- */
    add('Elektronik', 'Ladekabel', 1);
    add('Elektronik', 'Netzteil', 1);
    add('Elektronik', 'Kopfhörer', 1);
    if (days >= 3 || category === 'Outdoor' || category === 'Strand') {
      add('Elektronik', 'Powerbank', 1);
    }

    /* ---------------- Dokumente ---------------- */
    add('Dokumente', 'Personalausweis / Pass', 1);
    add('Dokumente', 'Tickets & Buchungen', 1);
    add('Dokumente', 'Geldbörse & Karten', 1);
    add('Dokumente', 'Versicherungskarte', 1);
    if (category === 'Business') add('Dokumente', 'Reiseunterlagen', 1);
    if (category === 'Outdoor') add('Dokumente', 'Führerschein', 1);

    /* ---------------- Kosmetik ---------------- */
    add('Kosmetik', 'Kulturbeutel', 1);
    add('Kosmetik', 'Zahnbürste', 1);
    add('Kosmetik', 'Zahnpasta', 1);
    add('Kosmetik', 'Deo', 1);
    add('Kosmetik', 'Duschgel / Shampoo', 1);
    add('Kosmetik', 'Rasierer', 1);

    /* ---------------- Sonstiges ---------------- */
    if (days >= 3) add('Sonstiges', 'Wäschebeutel', 1);
    if (days >= 5) add('Sonstiges', 'Reisewaschmittel', 1);

    return items;
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
    TRIP_CATEGORIES: TRIP_CATEGORIES,
    WEATHER_TYPES: WEATHER_TYPES,
    MAX_DAYS: MAX_DAYS,
    clampDays: clampDays,
    generateItems: generateItems,
    totalQty: totalQty,
    packedQty: packedQty,
    progress: progress
  };

  global.PackForgeLogic = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
