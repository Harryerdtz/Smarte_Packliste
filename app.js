/*
 * PackForge - UI controller.
 * Vanilla JS, no build step, no external dependencies.
 */
(function () {
  'use strict';

  var L = window.PackForgeLogic;
  var KEY = 'packforge:v2';
  var LEGACY_KEY = 'packforge:v1';
  var MAX_ARCHIVE = 30;
  var MAX_QTY = L.MAX_QTY;
  var MAX_DAYS = 30;

  var CAT_ICON = {
    Kleidung: 'i-shirt',
    Kulturbeutel: 'i-pouch',
    Dokumente: 'i-doc',
    Technik: 'i-cable',
    Sonstiges: 'i-box'
  };
  var TYPE_ICON = {
    Städtetrip: 'i-city',
    Strand: 'i-beach',
    Wandern: 'i-hike',
    Business: 'i-business'
  };
  var WEATHER_ICON = { Sonnig: 'i-sun', Kalt: 'i-snow', Regen: 'i-rain' };

  var state = loadState();
  var ui = {
    tab: 'plan',
    days: Math.min(MAX_DAYS, L.clampDays(state.prefs.days || 5)),
    types: state.prefs.types.slice(),
    weather: state.prefs.weather
  };
  var toastTimer = null;
  var modalConfirm = null;

  /* ------------------------------------------------------------------ */
  /* helpers                                                            */
  /* ------------------------------------------------------------------ */

  function $(selector, root) {
    return (root || document).querySelector(selector);
  }

  function uid() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
      try { return window.crypto.randomUUID(); } catch (err) { /* insecure context */ }
    }
    return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(16).slice(2, 10);
  }

  function esc(value) {
    return String(value).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }

  function icon(id, className) {
    return '<svg class="ic ' + (className || '') + '" viewBox="0 0 24 24" aria-hidden="true">' +
      '<use href="#' + id + '"></use></svg>';
  }

  function validCat(value) {
    return L.CATEGORIES.indexOf(value) >= 0 ? value : 'Sonstiges';
  }

  function legacyCat(value) {
    if (value === 'Elektronik') return 'Technik';
    if (value === 'Kosmetik') return 'Kulturbeutel';
    return validCat(value);
  }

  function legacyType(value) {
    if (value === 'Outdoor') return 'Wandern';
    return L.TRIP_TYPES.indexOf(value) >= 0 ? value : null;
  }

  function legacyWeather(value) {
    if (value === 'Gemischt') return 'Regen';
    return L.WEATHER_TYPES.indexOf(value) >= 0 ? value : 'Sonnig';
  }

  function safeId(value) {
    return typeof value === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(value) ? value : uid();
  }

  function sanitizeItem(raw) {
    if (!raw || typeof raw !== 'object') return null;
    var name = typeof raw.name === 'string' ? raw.name.trim().slice(0, 60) : '';
    if (!name) return null;
    var qty = Math.round(Number(raw.qty));
    if (!isFinite(qty) || qty < 1) qty = 1;
    if (qty > MAX_QTY) qty = MAX_QTY;
    return {
      id: safeId(raw.id),
      name: name,
      qty: qty,
      cat: legacyCat(raw.cat),
      packed: Boolean(raw.packed),
      custom: Boolean(raw.custom)
    };
  }

  function sanitizeList(raw, requireItems) {
    if (!raw || typeof raw !== 'object') return null;
    var items = Array.isArray(raw.items) ? raw.items.map(sanitizeItem).filter(Boolean) : [];
    if (requireItems && !items.length) return null;
    var name = typeof raw.name === 'string' ? raw.name.trim().slice(0, 40) : '';
    var createdAt = Number(raw.createdAt);
    var types = L.normalizeTypes(raw.types);
    if (!types.length) {
      var single = legacyType(raw.category);
      if (single) types = [single];
    }
    return {
      id: safeId(raw.id),
      name: name || 'Unbenannte Reise',
      days: L.clampDays(raw.days),
      types: types,
      weather: legacyWeather(raw.weather),
      createdAt: isFinite(createdAt) && createdAt > 0 ? createdAt : Date.now(),
      archivedAt: isFinite(Number(raw.archivedAt)) ? Number(raw.archivedAt) : undefined,
      items: items
    };
  }

  function emptyState() {
    return {
      version: 2,
      active: null,
      archive: [],
      prefs: { days: 5, types: [], weather: 'Sonnig' },
      rules: L.resetRules()
    };
  }

  function normalizeState(raw) {
    if (!raw || typeof raw !== 'object') return null;
    var source = raw.state && typeof raw.state === 'object' ? raw.state : raw;
    if (!('active' in source) && !('archive' in source)) return null;
    var archive = (Array.isArray(source.archive) ? source.archive : [])
      .map(function (list) { return sanitizeList(list, true); })
      .filter(Boolean)
      .slice(0, MAX_ARCHIVE);
    var active = source.active ? sanitizeList(source.active, true) : null;
    var prefs = source.prefs && typeof source.prefs === 'object' ? source.prefs : {};
    var types = L.normalizeTypes(prefs.types);
    if (!types.length && prefs.category) {
      var prefType = legacyType(prefs.category);
      if (prefType) types = [prefType];
    }
    return {
      version: 2,
      active: active,
      archive: archive,
      prefs: {
        days: Math.min(MAX_DAYS, L.clampDays(prefs.days || (active ? active.days : 5))),
        types: types,
        weather: legacyWeather(prefs.weather)
      },
      rules: L.normalizeRules(source.rules)
    };
  }

  function readKey(key) {
    try {
      var raw = window.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (err) {
      return null;
    }
  }

  function loadState() {
    var current = normalizeState(readKey(KEY));
    if (current) return current;
    var legacy = normalizeState(readKey(LEGACY_KEY));
    return legacy || emptyState();
  }

  function persist() {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(state));
      return true;
    } catch (err) {
      toast('Speichern fehlgeschlagen – bitte exportieren');
      return false;
    }
  }

  function haptic(pattern) {
    if (navigator.vibrate) {
      try { navigator.vibrate(pattern || 9); } catch (err) { /* optional */ }
    }
  }

  function formatDate(ts) {
    try {
      return new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: 'short', year: 'numeric' })
        .format(new Date(ts));
    } catch (err) {
      return '—';
    }
  }

  function toast(message) {
    var el = $('#toast');
    if (!el) return;
    el.textContent = message;
    el.classList.add('is-visible');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () {
      el.classList.remove('is-visible');
    }, 2600);
  }

  function listMeta(list) {
    var parts = [list.days + (list.days === 1 ? ' Tag' : ' Tage')];
    if (list.types.length) {
      list.types.forEach(function (type) { parts.push(type); });
    } else {
      parts.push('Ohne Reiseart');
    }
    parts.push(list.weather);
    return parts;
  }

  function emptyCard(iconId, title, text) {
    return '<div class="glass empty">' +
      '<span class="empty__icon">' + icon(iconId) + '</span>' +
      '<strong>' + esc(title) + '</strong>' +
      '<span>' + esc(text) + '</span>' +
      '</div>';
  }

  /* ------------------------------------------------------------------ */
  /* modal                                                              */
  /* ------------------------------------------------------------------ */

  function openModal(options) {
    $('#modal-title').textContent = options.title || 'Sicher?';
    $('#modal-text').textContent = options.text || '';
    $('#modal-confirm').textContent = options.confirmLabel || 'Bestätigen';
    modalConfirm = options.onConfirm || null;
    $('#modal').hidden = false;
    window.setTimeout(function () { $('#modal-confirm').focus(); }, 40);
  }

  function closeModal() {
    $('#modal').hidden = true;
    modalConfirm = null;
    $$('[data-modal-close]').forEach(function (el) { el.blur(); });
  }

  function $$(selector, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(selector));
  }

  /* ------------------------------------------------------------------ */
  /* render: generator controls                                         */
  /* ------------------------------------------------------------------ */

  function syncControls() {
    var range = $('#trip-days');
    if (range) {
      range.value = String(ui.days);
      range.style.setProperty('--fill', ((ui.days - 1) / (MAX_DAYS - 1)) * 100 + '%');
      range.setAttribute('aria-valuetext', ui.days + (ui.days === 1 ? ' Tag' : ' Tage'));
    }
    var number = $('#days-number');
    if (number) number.textContent = String(ui.days);
    var out = $('#days-out');
    if (out) out.textContent = ui.days + (ui.days === 1 ? ' Tag' : ' Tage');

    $$('[data-type]').forEach(function (button) {
      button.setAttribute('aria-pressed', ui.types.indexOf(button.dataset.type) >= 0 ? 'true' : 'false');
    });
    $$('[data-weather]').forEach(function (button) {
      button.setAttribute('aria-pressed', button.dataset.weather === ui.weather ? 'true' : 'false');
    });
  }

  /* ------------------------------------------------------------------ */
  /* render: active list                                                */
  /* ------------------------------------------------------------------ */

  function groupItems(items) {
    return L.CATEGORIES.map(function (cat) {
      return {
        cat: cat,
        items: items.filter(function (item) { return item.cat === cat; })
      };
    }).filter(function (group) { return group.items.length > 0; });
  }

  function renderItem(item, index) {
    var packed = Boolean(item.packed);
    return '' +
      '<li class="item' + (packed ? ' is-packed' : '') + '" data-id="' + esc(item.id) + '" style="--i:' + index + '">' +
        '<button type="button" class="check" data-act="toggle" role="checkbox" aria-checked="' + (packed ? 'true' : 'false') + '"' +
          ' aria-label="' + esc(item.name) + (packed ? ' wieder auspacken' : ' abhaken') + '">' +
          icon('i-check') +
        '</button>' +
        '<div class="item__body">' +
          '<span class="item__name">' + esc(item.name) + '</span>' +
          (item.custom ? '<span class="item__note">Eigenes</span>' : '') +
        '</div>' +
        '<div class="qty">' +
          '<button type="button" class="qty__btn" data-act="dec" aria-label="Menge von ' + esc(item.name) + ' verringern"' +
            (item.qty <= 1 ? ' disabled' : '') + '>' + icon('i-minus') + '</button>' +
          '<span class="qty__val" aria-label="Menge ' + item.qty + '">' + item.qty + '</span>' +
          '<button type="button" class="qty__btn" data-act="inc" aria-label="Menge von ' + esc(item.name) + ' erhöhen"' +
            (item.qty >= MAX_QTY ? ' disabled' : '') + '>' + icon('i-plus') + '</button>' +
        '</div>' +
        '<button type="button" class="item__del" data-act="del" aria-label="' + esc(item.name) + ' löschen">' +
          icon('i-trash') +
        '</button>' +
      '</li>';
  }

  function ringMarkup(progress) {
    var offset = (314.159 * (1 - progress.percent / 100)).toFixed(2);
    return '' +
      '<div class="ring" role="img" aria-label="' + progress.percent + ' Prozent gepackt">' +
        '<svg viewBox="0 0 120 120" aria-hidden="true">' +
          '<defs>' +
            '<linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">' +
              '<stop offset="0%" stop-color="#a293ff"></stop>' +
              '<stop offset="55%" stop-color="#4fd7ff"></stop>' +
              '<stop offset="100%" stop-color="#63f2c4"></stop>' +
            '</linearGradient>' +
          '</defs>' +
          '<circle class="ring__track" cx="60" cy="60" r="50"></circle>' +
          '<circle class="ring__value" id="ring-value" cx="60" cy="60" r="50" style="stroke-dashoffset:' + offset + '"></circle>' +
        '</svg>' +
        '<div class="ring__center">' +
          '<b><span id="ring-percent">' + progress.percent + '</span><span>%</span></b>' +
          '<small>gepackt</small>' +
        '</div>' +
      '</div>';
  }

  function renderActive() {
    var root = $('#active-root');
    var list = state.active;

    if (!list) {
      root.innerHTML = emptyCard('i-logo', 'Noch keine aktive Liste', 'Fülle oben den Generator aus – PackForge baut deine Liste automatisch.');
      return;
    }

    var progress = L.progress(list.items);
    var groups = groupItems(list.items);
    var open = progress.total - progress.packed;
    var done = progress.total > 0 && open === 0;

    var meta = listMeta(list).map(function (part) {
      return '<span>' + esc(part) + '</span>';
    }).join('');

    var groupsHtml = groups.length ? groups.map(function (group) {
      var qty = L.totalQty(group.items);
      return '' +
        '<section class="group">' +
          '<div class="group__head">' +
            '<span class="group__icon">' + icon(CAT_ICON[group.cat]) + '</span>' +
            '<h3 class="group__title">' + esc(group.cat) + '</h3>' +
            '<span class="group__count" data-group-count="' + esc(group.cat) + '">' + qty + ' Stück</span>' +
          '</div>' +
          '<ul class="items">' + group.items.map(renderItem).join('') + '</ul>' +
        '</section>';
    }).join('') : emptyCard('i-plus', 'Liste ist leer', 'Füge unten eigene Items hinzu.');

    root.innerHTML = '' +
      '<article class="glass trip">' +
        '<div class="trip__head">' +
          '<div class="trip__titles">' +
            '<p class="eyebrow">Aktive Reise</p>' +
            '<h2 class="trip__name">' + esc(list.name) + '</h2>' +
            '<div class="trip__meta">' + meta + '</div>' +
          '</div>' +
          ringMarkup(progress) +
        '</div>' +

        '<div class="trip__summary">' +
          '<span><b id="packed-count">' + progress.packed + '</b> von <b id="total-count">' + progress.total + '</b> Stück gepackt</span>' +
          '<span id="trip-status">' + (done ? 'Alles dabei' : open + ' offen') + '</span>' +
        '</div>' +

        groupsHtml +

        '<div class="add-item">' +
          '<label class="field__label" for="custom-name">Eigenes Item</label>' +
          '<input class="input" id="custom-name" type="text" maxlength="40" enterkeyhint="done"' +
            ' placeholder="z. B. Regenhose" aria-label="Name des eigenen Items">' +
          '<div class="add-item__row">' +
            '<div class="select-wrap">' +
              '<select class="select" id="custom-cat" aria-label="Kategorie des eigenen Items">' +
                L.CATEGORIES.map(function (cat) {
                  return '<option value="' + esc(cat) + '">' + esc(cat) + '</option>';
                }).join('') +
              '</select>' +
              icon('i-chevron') +
            '</div>' +
            '<button class="btn" type="button" data-act="add-custom">' + icon('i-plus') + 'Hinzufügen</button>' +
          '</div>' +
        '</div>' +

        '<button class="recalc" type="button" data-act="recalc">' +
          icon('i-reset') + 'Mengen mit aktuellen Formeln neu berechnen' +
        '</button>' +

        '<div class="trip__actions">' +
          '<button class="btn btn--soft" type="button" data-act="complete">' + icon('i-check') + 'Abschließen</button>' +
          '<button class="btn btn--danger" type="button" data-act="discard">' + icon('i-trash') + 'Verwerfen</button>' +
        '</div>' +
      '</article>';
  }

  /* Update progress in place so checkbox and list animations stay smooth. */
  function updateProgress() {
    var list = state.active;
    if (!list) return;
    var progress = L.progress(list.items);
    var ring = $('#ring-value');
    if (ring) ring.style.strokeDashoffset = (314.159 * (1 - progress.percent / 100)).toFixed(2);
    var percent = $('#ring-percent');
    if (percent) percent.textContent = String(progress.percent);
    var packed = $('#packed-count');
    if (packed) packed.textContent = String(progress.packed);
    var total = $('#total-count');
    if (total) total.textContent = String(progress.total);
    var status = $('#trip-status');
    if (status) {
      var open = progress.total - progress.packed;
      status.textContent = progress.total > 0 && open === 0 ? 'Alles dabei' : open + ' offen';
    }
    var ringWrap = document.querySelector('.ring');
    if (ringWrap) ringWrap.setAttribute('aria-label', progress.percent + ' Prozent gepackt');
    $$('[data-group-count]').forEach(function (el) {
      var cat = el.dataset.groupCount;
      var qty = L.totalQty(list.items.filter(function (item) { return item.cat === cat; }));
      el.textContent = qty + ' Stück';
    });
  }

  /* ------------------------------------------------------------------ */
  /* render: archive, rules, stats, tabs                                */
  /* ------------------------------------------------------------------ */

  function renderArchive() {
    var root = $('#archive-root');
    var count = state.archive.length;
    var label = count === 1 ? '1 Liste' : count + ' Listen';
    $('#archive-count').textContent = label;
    var badge = $('#tab-badge');
    badge.textContent = String(count);
    badge.hidden = count === 0;

    if (!count) {
      root.innerHTML = emptyCard('i-list', 'Noch nichts archiviert', 'Abgeschlossene Reisen erscheinen hier – inklusive Fortschritt.');
      return;
    }

    root.innerHTML = state.archive.map(function (list) {
      var progress = L.progress(list.items);
      return '' +
        '<article class="glass archive-card" data-id="' + esc(list.id) + '">' +
          '<div class="archive-card__head">' +
            '<div>' +
              '<h3 class="archive-card__name">' + esc(list.name) + '</h3>' +
              '<span class="archive-card__date">' + formatDate(list.archivedAt || list.createdAt) + '</span>' +
            '</div>' +
            '<span class="archive-card__pct">' + progress.percent + '%</span>' +
          '</div>' +
          '<p class="archive-card__meta">' + esc(listMeta(list).join(' · ')) + '</p>' +
          '<div class="archive-card__bar"><span style="width:' + progress.percent + '%"></span></div>' +
          '<div class="archive-card__actions">' +
            '<button class="btn btn--soft" type="button" data-act="load-archive" data-id="' + esc(list.id) + '">' +
              icon('i-upload') + 'Laden</button>' +
            '<button class="btn btn--danger" type="button" data-act="delete-archive" data-id="' + esc(list.id) + '">' +
              icon('i-trash') + 'Löschen</button>' +
          '</div>' +
        '</article>';
    }).join('');
  }

  function renderRules() {
    var root = $('#rules-root');
    if (!root) return;
    root.innerHTML = L.RULE_DEFS.map(function (def) {
      var rule = state.rules[def.key];
      var options = L.RATIO_OPTIONS.map(function (option) {
        return '<option value="' + option.value + '"' +
          (Number(rule.perDay) === option.value ? ' selected' : '') + '>' + esc(option.label) + '</option>';
      }).join('');
      return '' +
        '<div class="rule" data-rule="' + def.key + '">' +
          '<div class="rule__head">' +
            '<div>' +
              '<span class="rule__name">' + esc(def.label) + '</span>' +
              '<span class="rule__hint">' + esc(def.hint) + '</span>' +
            '</div>' +
            '<span class="rule__result" data-rule-result="' + def.key + '">' +
              L.ruleQty(ui.days, rule) + ' Stück</span>' +
          '</div>' +
          '<div class="rule__controls">' +
            '<div class="select-wrap">' +
              '<select class="select" data-ratio="' + def.key + '" aria-label="Menge pro Tag für ' + esc(def.label) + '">' +
                options +
              '</select>' +
              icon('i-chevron') +
            '</div>' +
            '<div class="buffer" role="group" aria-label="Puffer für ' + esc(def.label) + '">' +
              '<span class="buffer__label">Puffer</span>' +
              '<button type="button" class="buffer__btn" data-buffer="-1" data-key="' + def.key + '"' +
                ' aria-label="Puffer verringern"' + (rule.buffer <= 0 ? ' disabled' : '') + '>' +
                icon('i-minus') + '</button>' +
              '<span class="buffer__value" data-buffer-value="' + def.key + '" aria-live="polite">+' + rule.buffer + '</span>' +
              '<button type="button" class="buffer__btn" data-buffer="1" data-key="' + def.key + '"' +
                ' aria-label="Puffer erhöhen"' + (rule.buffer >= L.MAX_BUFFER ? ' disabled' : '') + '>' +
                icon('i-plus') + '</button>' +
            '</div>' +
          '</div>' +
        '</div>';
    }).join('');
    updateRulePreview();
  }

  function updateRulePreview() {
    L.RULE_DEFS.forEach(function (def) {
      var el = document.querySelector('[data-rule-result="' + def.key + '"]');
      if (el) el.textContent = L.ruleQty(ui.days, state.rules[def.key]) + ' Stück';
    });
    var preview = $('#rules-preview');
    if (preview) {
      var parts = L.RULE_DEFS.map(function (def) {
        return '<b>' + esc(def.label) + '</b> ' + L.ruleQty(ui.days, state.rules[def.key]);
      });
      preview.innerHTML = 'Bei ' + ui.days + (ui.days === 1 ? ' Tag' : ' Tagen') + ': ' + parts.join(' · ') +
        '. Änderungen werden sofort gespeichert.';
    }
  }

  function renderStats() {
    var root = $('#storage-stats');
    if (!root) return;
    var all = state.archive.slice();
    if (state.active) all.push(state.active);
    var items = all.reduce(function (sum, list) { return sum + L.totalQty(list.items); }, 0);
    var bytes = 0;
    try { bytes = new Blob([JSON.stringify(state)]).size; } catch (err) { bytes = JSON.stringify(state).length; }
    var size = bytes >= 1024 ? (bytes / 1024).toFixed(1).replace('.', ',') + ' KB' : bytes + ' B';

    var stats = [
      { num: state.active ? '1' : '0', label: 'Aktiv' },
      { num: String(state.archive.length), label: 'Archiv' },
      { num: String(items), label: 'Stück' },
      { num: size, label: 'Speicher' }
    ];
    root.innerHTML = stats.map(function (stat) {
      return '<div class="stat"><span class="stat__num">' + esc(stat.num) + '</span>' +
        '<span class="stat__label">' + esc(stat.label) + '</span></div>';
    }).join('');
  }

  function renderTabs() {
    ['plan', 'lists', 'rules'].forEach(function (tab) {
      var button = $('#tab-' + tab);
      var view = $('#view-' + tab);
      var active = ui.tab === tab;
      if (view) view.hidden = !active;
      if (active) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    });
  }

  function render() {
    syncControls();
    renderActive();
    renderArchive();
    renderRules();
    renderStats();
    renderTabs();
  }

  /* ------------------------------------------------------------------ */
  /* actions                                                            */
  /* ------------------------------------------------------------------ */

  function setDays(value, options) {
    ui.days = Math.min(MAX_DAYS, Math.max(1, L.clampDays(value)));
    state.prefs.days = ui.days;
    syncControls();
    updateRulePreview();
    if (!options || !options.silent) persist();
  }

  function findActiveItem(id) {
    if (!state.active) return null;
    return state.active.items.find(function (item) { return item.id === id; }) || null;
  }

  function generateList(event) {
    if (event) event.preventDefault();
    var nameInput = $('#trip-name');
    var name = (nameInput.value || '').trim().replace(/\s+/g, ' ').slice(0, 40);
    if (!name) {
      name = ui.types.length === 1 ? ui.types[0] + '-Trip' : 'Meine Reise';
    }

    var defs = L.generateItems({
      days: ui.days,
      types: ui.types,
      weather: ui.weather,
      rules: state.rules
    });
    var items = defs.map(function (def) {
      return {
        id: uid(),
        name: def.name,
        qty: def.qty,
        cat: def.cat,
        packed: false,
        custom: false
      };
    });

    var archived = false;
    if (state.active && state.active.items.length) {
      archiveCurrent();
      archived = true;
    }

    state.active = {
      id: uid(),
      name: name,
      days: ui.days,
      types: ui.types.slice(),
      weather: ui.weather,
      createdAt: Date.now(),
      items: items
    };
    persist();
    renderActive();
    renderArchive();
    renderStats();
    nameInput.value = '';
    haptic(12);
    toast(items.length + ' Positionen' + (archived ? ' · alte Liste archiviert' : ''));
    window.setTimeout(function () {
      var root = $('#active-root');
      if (root) root.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
  }

  function archiveCurrent() {
    var list = state.active;
    if (!list) return false;
    if (list.items.length) {
      var copy = JSON.parse(JSON.stringify(list));
      copy.archivedAt = Date.now();
      state.archive.unshift(copy);
      state.archive = state.archive.slice(0, MAX_ARCHIVE);
    }
    state.active = null;
    return true;
  }

  function completeList() {
    if (!state.active) return;
    var list = state.active;
    var progress = L.progress(list.items);
    if (!list.items.length) {
      openModal({
        title: 'Leere Liste',
        text: 'Diese Liste enthält keine Positionen. Verwerfen?',
        confirmLabel: 'Verwerfen',
        onConfirm: function () {
          state.active = null;
          persist();
          render();
          toast('Liste verworfen');
        }
      });
      return;
    }
    openModal({
      title: 'Reise abschließen?',
      text: '„' + list.name + '“ wandert mit ' + progress.total + ' Stück ins Archiv.',
      confirmLabel: 'Abschließen',
      onConfirm: function () {
        archiveCurrent();
        persist();
        render();
        ui.tab = 'lists';
        renderTabs();
        window.scrollTo({ top: 0, behavior: 'smooth' });
        toast('Liste archiviert');
      }
    });
  }

  function discardList() {
    if (!state.active) return;
    openModal({
      title: 'Liste verwerfen?',
      text: 'Die aktive Liste wird gelöscht und nicht archiviert.',
      confirmLabel: 'Verwerfen',
      onConfirm: function () {
        state.active = null;
        persist();
        render();
        toast('Liste verworfen');
      }
    });
  }

  function addCustomItem() {
    if (!state.active) {
      toast('Bitte zuerst eine Liste generieren');
      return;
    }
    var nameInput = $('#custom-name');
    var catSelect = $('#custom-cat');
    var name = nameInput.value.trim().replace(/\s+/g, ' ').slice(0, 40);
    if (!name) {
      toast('Bitte einen Namen eingeben');
      nameInput.focus();
      return;
    }
    var cat = legacyCat(catSelect.value);
    var existing = state.active.items.find(function (item) {
      return item.cat === cat && item.name.toLowerCase() === name.toLowerCase();
    });
    if (existing) {
      existing.qty = Math.min(MAX_QTY, existing.qty + 1);
      existing.custom = true;
      toast('Menge erhöht');
    } else {
      state.active.items.push({
        id: uid(),
        name: name,
        qty: 1,
        cat: cat,
        packed: false,
        custom: true
      });
      toast('Item hinzugefügt');
    }
    persist();
    renderActive();
    renderArchive();
    renderStats();
    var freshCat = $('#custom-cat');
    if (freshCat) freshCat.value = cat;
    var fresh = $('#custom-name');
    if (fresh) fresh.focus({ preventScroll: true });
    haptic(8);
  }

  function recalcActive() {
    if (!state.active) return;
    var list = state.active;
    var next = L.recalculateItems(list.items, {
      days: list.days,
      types: list.types,
      weather: list.weather,
      rules: state.rules
    });
    list.items = next.map(function (item) {
      return {
        id: item.id || uid(),
        name: item.name,
        qty: item.qty,
        cat: item.cat,
        packed: Boolean(item.packed),
        custom: Boolean(item.custom)
      };
    });
    persist();
    renderActive();
    renderStats();
    toast('Mengen neu berechnet');
    haptic(10);
  }

  function loadArchived(id) {
    var index = state.archive.findIndex(function (list) { return list.id === id; });
    if (index < 0) return;
    var list = state.archive[index];
    if (state.active && state.active.items.length) archiveCurrent();
    state.archive.splice(index, 1);
    list.archivedAt = undefined;
    state.active = list;
    persist();
    ui.tab = 'plan';
    render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    toast('Liste geladen');
  }

  function deleteArchived(id) {
    var list = state.archive.find(function (entry) { return entry.id === id; });
    if (!list) return;
    openModal({
      title: 'Archiv-Eintrag löschen?',
      text: '„' + list.name + '“ wird endgültig entfernt.',
      confirmLabel: 'Löschen',
      onConfirm: function () {
        state.archive = state.archive.filter(function (entry) { return entry.id !== id; });
        persist();
        render();
        toast('Eintrag gelöscht');
      }
    });
  }

  function exportData() {
    var payload = {
      app: 'PackForge',
      version: 2,
      exportedAt: new Date().toISOString(),
      rules: state.rules,
      prefs: state.prefs,
      active: state.active,
      archive: state.archive
    };
    var blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var link = document.createElement('a');
    link.href = url;
    link.download = 'packforge-export-' + new Date().toISOString().slice(0, 10) + '.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    toast('Export erstellt');
  }

  function importData(file) {
    var reader = new FileReader();
    reader.onload = function () {
      var parsed;
      try {
        parsed = JSON.parse(String(reader.result));
      } catch (err) {
        toast('Ungültige JSON-Datei');
        return;
      }
      var imported = normalizeState(parsed);
      if (!imported) {
        toast('Datei enthält keine Packliste');
        return;
      }
      var listCount = (imported.active ? 1 : 0) + imported.archive.length;
      openModal({
        title: 'Import bestätigen',
        text: listCount + ' Liste(n) und deine Pack-Formeln werden geladen. Bestehende Daten werden ersetzt.',
        confirmLabel: 'Importieren',
        onConfirm: function () {
          state = imported;
          ui.days = Math.min(MAX_DAYS, state.prefs.days);
          ui.types = state.prefs.types.slice();
          ui.weather = state.prefs.weather;
          ui.tab = imported.active ? 'plan' : 'lists';
          persist();
          render();
          window.scrollTo({ top: 0, behavior: 'smooth' });
          toast('Import erfolgreich');
        }
      });
    };
    reader.onerror = function () { toast('Datei konnte nicht gelesen werden'); };
    reader.readAsText(file);
  }

  function resetData() {
    openModal({
      title: 'Alle Daten löschen?',
      text: 'Aktive Liste, Archiv und deine Pack-Formeln werden entfernt. Vorher exportieren?',
      confirmLabel: 'Alles löschen',
      onConfirm: function () {
        state = emptyState();
        ui.days = 5;
        ui.types = [];
        ui.weather = 'Sonnig';
        ui.tab = 'plan';
        try {
          window.localStorage.removeItem(LEGACY_KEY);
        } catch (err) { /* storage may be unavailable */ }
        persist();
        render();
        window.scrollTo({ top: 0, behavior: 'smooth' });
        toast('Daten zurückgesetzt');
      }
    });
  }

  function resetRules() {
    state.rules = L.resetRules();
    persist();
    renderRules();
    toast('Standard-Formeln wiederhergestellt');
    haptic(8);
  }

  /* ------------------------------------------------------------------ */
  /* events                                                             */
  /* ------------------------------------------------------------------ */

  function switchTab(tab) {
    if (['plan', 'lists', 'rules'].indexOf(tab) < 0) return;
    ui.tab = tab;
    if (tab === 'rules') renderRules();
    if (tab === 'lists') renderArchive();
    renderTabs();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  document.addEventListener('click', function (event) {
    var tab = event.target.closest('[data-tab]');
    if (tab) {
      switchTab(tab.dataset.tab);
      return;
    }

    var typeButton = event.target.closest('[data-type]');
    if (typeButton) {
      var type = typeButton.dataset.type;
      if (L.TRIP_TYPES.indexOf(type) < 0) return;
      var index = ui.types.indexOf(type);
      if (index >= 0) ui.types.splice(index, 1);
      else ui.types.push(type);
      state.prefs.types = ui.types.slice();
      persist();
      syncControls();
      haptic(6);
      return;
    }

    var weatherButton = event.target.closest('[data-weather]');
    if (weatherButton) {
      ui.weather = weatherButton.dataset.weather;
      state.prefs.weather = ui.weather;
      persist();
      syncControls();
      haptic(6);
      return;
    }

    if (event.target.closest('[data-modal-close]')) {
      closeModal();
      return;
    }

    if (event.target.closest('#modal-confirm')) {
      var confirmed = modalConfirm;
      closeModal();
      if (confirmed) confirmed();
      return;
    }

    var bufferBtn = event.target.closest('[data-buffer]');
    if (bufferBtn) {
      var key = bufferBtn.dataset.key;
      var rule = state.rules[key];
      if (!rule) return;
      var next = rule.buffer + Number(bufferBtn.dataset.buffer);
      rule.buffer = Math.min(L.MAX_BUFFER, Math.max(0, next));
      persist();
      renderRules();
      haptic(6);
      return;
    }

    var actionEl = event.target.closest('[data-act]');
    if (!actionEl) return;
    var action = actionEl.dataset.act;

    if (action === 'add-custom') { addCustomItem(); return; }
    if (action === 'recalc') { recalcActive(); return; }
    if (action === 'export') { exportData(); return; }
    if (action === 'import') { $('#import-file').click(); return; }
    if (action === 'reset') { resetData(); return; }
    if (action === 'reset-rules') { resetRules(); return; }
    if (action === 'complete') { completeList(); return; }
    if (action === 'discard') { discardList(); return; }
    if (action === 'load-archive') { loadArchived(actionEl.dataset.id); return; }
    if (action === 'delete-archive') { deleteArchived(actionEl.dataset.id); return; }

    var row = actionEl.closest('.item');
    if (!row) return;
    var item = findActiveItem(row.dataset.id);
    if (!item) return;

    if (action === 'toggle') {
      item.packed = !item.packed;
      row.classList.toggle('is-packed', item.packed);
      var check = row.querySelector('.check');
      if (check) {
        check.setAttribute('aria-checked', item.packed ? 'true' : 'false');
        check.setAttribute('aria-label', item.name + (item.packed ? ' wieder auspacken' : ' abhaken'));
      }
      persist();
      updateProgress();
      haptic(item.packed ? [8, 30, 8] : 8);
      return;
    }

    if (action === 'inc') {
      item.qty = Math.min(MAX_QTY, item.qty + 1);
    } else if (action === 'dec') {
      item.qty = Math.max(1, item.qty - 1);
    } else if (action === 'del') {
      state.active.items = state.active.items.filter(function (entry) { return entry.id !== item.id; });
      persist();
      renderActive();
      renderArchive();
      renderStats();
      toast('Item entfernt');
      return;
    } else {
      return;
    }

    var valueEl = row.querySelector('.qty__val');
    if (valueEl) {
      valueEl.textContent = String(item.qty);
      valueEl.setAttribute('aria-label', 'Menge ' + item.qty);
    }
    var dec = row.querySelector('[data-act="dec"]');
    var inc = row.querySelector('[data-act="inc"]');
    if (dec) dec.disabled = item.qty <= 1;
    if (inc) inc.disabled = item.qty >= MAX_QTY;
    persist();
    updateProgress();
    renderStats();
    haptic(5);
  });

  document.addEventListener('change', function (event) {
    var select = event.target.closest('[data-ratio]');
    if (!select) return;
    var key = select.dataset.ratio;
    if (!state.rules[key]) return;
    var value = Number(select.value);
    var allowed = L.RATIO_OPTIONS.some(function (option) { return option.value === value; });
    if (!allowed) return;
    state.rules[key].perDay = value;
    persist();
    updateRulePreview();
    haptic(6);
  });

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && !$('#modal').hidden) {
      closeModal();
      return;
    }
    if (event.key === 'Enter' && event.target && event.target.id === 'custom-name') {
      event.preventDefault();
      addCustomItem();
    }
  });

  var daysRange = $('#trip-days');
  if (daysRange) {
    daysRange.addEventListener('input', function () {
      setDays(daysRange.value, { silent: true });
    });
    daysRange.addEventListener('change', function () {
      persist();
    });
  }

  $$('[data-step]').forEach(function (button) {
    button.addEventListener('click', function () {
      setDays(ui.days + Number(button.dataset.step));
      haptic(5);
    });
  });

  var tripForm = $('#trip-form');
  if (tripForm) tripForm.addEventListener('submit', generateList);

  var importInput = $('#import-file');
  if (importInput) {
    importInput.addEventListener('change', function () {
      var file = importInput.files && importInput.files[0];
      if (file) importData(file);
      importInput.value = '';
    });
  }

  window.addEventListener('storage', function (event) {
    if (event.key !== KEY) return;
    state = loadState();
    ui.days = Math.min(MAX_DAYS, state.prefs.days);
    ui.types = state.prefs.types.slice();
    ui.weather = state.prefs.weather;
    render();
  });

  /* ------------------------------------------------------------------ */
  /* init                                                               */
  /* ------------------------------------------------------------------ */

  persist();
  render();

  if ('serviceWorker' in navigator && window.location.protocol !== 'file:') {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function () {
        /* offline mode is optional; the app still works online */
      });
    });
  }
})();
