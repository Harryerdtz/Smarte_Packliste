/*
 * PackForge - UI controller.
 * Vanilla JS, no build step, no external dependencies.
 */
(function () {
  'use strict';

  var L = window.PackForgeLogic;
  var KEY = 'packforge:v1';
  var MAX_ARCHIVE = 30;
  var MAX_QTY = 99;

  var CAT_ICON = {
    Kleidung: 'i-shirt',
    Elektronik: 'i-plug',
    Dokumente: 'i-doc',
    Kosmetik: 'i-bottle',
    Sonstiges: 'i-box'
  };
  var TRIP_ICON = {
    'Städtetrip': 'i-city',
    Strand: 'i-wave',
    Outdoor: 'i-mountain',
    Business: 'i-case'
  };
  var WEATHER_ICON = { Sonnig: 'i-sun', Kalt: 'i-snow', Gemischt: 'i-rain' };

  var state = loadState();
  var ui = {
    tab: 'plan',
    category: validTripCategory(state.prefs.category) ? state.prefs.category : 'Städtetrip',
    weather: validWeather(state.prefs.weather) ? state.prefs.weather : 'Sonnig'
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

  function icon(id, extraClass) {
    return '<svg viewBox="0 0 16 16" class="pixel-svg ' + (extraClass || '') +
      '" aria-hidden="true"><use href="#' + id + '"></use></svg>';
  }

  function validTripCategory(value) {
    return L.TRIP_CATEGORIES.indexOf(value) >= 0;
  }

  function validWeather(value) {
    return L.WEATHER_TYPES.indexOf(value) >= 0;
  }

  function validCat(value) {
    return L.CATEGORIES.indexOf(value) >= 0 ? value : 'Sonstiges';
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
      cat: validCat(raw.cat),
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
    return {
      id: safeId(raw.id),
      name: name || 'Unbenannte Reise',
      days: L.clampDays(raw.days),
      category: validTripCategory(raw.category) ? raw.category : 'Städtetrip',
      weather: validWeather(raw.weather) ? raw.weather : 'Gemischt',
      createdAt: isFinite(createdAt) && createdAt > 0 ? createdAt : Date.now(),
      archivedAt: isFinite(Number(raw.archivedAt)) ? Number(raw.archivedAt) : undefined,
      items: items
    };
  }

  function emptyState() {
    return {
      version: 1,
      active: null,
      archive: [],
      prefs: { category: 'Städtetrip', weather: 'Sonnig' }
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
    return {
      version: 1,
      active: active,
      archive: archive,
      prefs: {
        category: validTripCategory(prefs.category) ? prefs.category : 'Städtetrip',
        weather: validWeather(prefs.weather) ? prefs.weather : 'Sonnig'
      }
    };
  }

  function loadState() {
    try {
      var raw = window.localStorage.getItem(KEY);
      if (!raw) return emptyState();
      return normalizeState(JSON.parse(raw)) || emptyState();
    } catch (err) {
      return emptyState();
    }
  }

  function persist() {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(state));
      return true;
    } catch (err) {
      toast('SPEICHERN FEHLGESCHLAGEN – EXPORTIEREN?');
      return false;
    }
  }

  function formatDate(ts) {
    try {
      return new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
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

  /* ------------------------------------------------------------------ */
  /* modal                                                              */
  /* ------------------------------------------------------------------ */

  function openModal(options) {
    $('#modal-title').textContent = options.title || 'BIST DU SICHER?';
    $('#modal-text').textContent = options.text || '';
    $('#modal-confirm').textContent = options.confirmLabel || 'BESTÄTIGEN';
    modalConfirm = options.onConfirm || null;
    $('#modal').hidden = false;
    $('#modal-confirm').focus();
  }

  function closeModal() {
    $('#modal').hidden = true;
    modalConfirm = null;
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

  function renderItem(item) {
    var packed = Boolean(item.packed);
    return '' +
      '<li class="item' + (packed ? ' is-packed' : '') + '" data-id="' + esc(item.id) + '">' +
        '<button type="button" class="check" data-act="toggle" role="checkbox" tabindex="0"' +
          ' aria-checked="' + (packed ? 'true' : 'false') + '"' +
          ' aria-label="' + esc(item.name) + (packed ? ' wieder auspacken' : ' abhaken') + '">' +
          icon('i-check') +
        '</button>' +
        '<div class="item__body">' +
          '<span class="item__name">' + esc(item.name) + '</span>' +
          (item.custom ? '<span class="item__meta">EIGENES ITEM</span>' : '') +
        '</div>' +
        '<div class="qty">' +
          '<button type="button" class="qty__btn" data-act="dec" aria-label="Menge von ' + esc(item.name) + ' verringern"' +
            (item.qty <= 1 ? ' disabled' : '') + '>' + icon('i-minus') + '</button>' +
          '<span class="qty__val" aria-label="Menge ' + item.qty + '">' + item.qty + '</span>' +
          '<button type="button" class="qty__btn" data-act="inc" aria-label="Menge von ' + esc(item.name) + ' erhöhen"' +
            (item.qty >= MAX_QTY ? ' disabled' : '') + '>' + icon('i-plus') + '</button>' +
        '</div>' +
        '<button type="button" class="icon-btn" data-act="del" aria-label="' + esc(item.name) + ' löschen">' +
          icon('i-trash') +
        '</button>' +
      '</li>';
  }

  function renderActive() {
    var root = $('#active-root');
    var list = state.active;

    if (!list) {
      root.innerHTML = '' +
        '<div class="panel">' +
          '<div class="empty">' +
            icon('i-bag') +
            '<strong>NOCH KEINE AKTIVE REISE</strong>' +
            '<span>Fülle den Generator aus – PackForge baut deine Liste automatisch.</span>' +
          '</div>' +
        '</div>';
      return;
    }

    var progress = L.progress(list.items);
    var packedPositions = list.items.filter(function (item) { return item.packed; }).length;
    var groups = groupItems(list.items);
    var done = progress.total > 0 && progress.packed === progress.total;

    var groupsHtml = groups.length ? groups.map(function (group) {
      var qty = L.totalQty(group.items);
      return '' +
        '<div class="group">' +
          '<div class="group__head">' +
            icon(CAT_ICON[group.cat]) +
            '<span class="group__title">' + esc(group.cat) + '</span>' +
            '<span class="group__count">' + qty + ' STK</span>' +
          '</div>' +
          '<ul class="items">' + group.items.map(renderItem).join('') + '</ul>' +
        '</div>';
    }).join('') :
      '<div class="empty" style="margin-top:16px">' +
        '<strong>LISTE IST LEER</strong>' +
        '<span>Füge unten eigene Items hinzu.</span>' +
      '</div>';

    root.innerHTML = '' +
      '<div class="panel">' +
        '<div class="panel__head">' +
          '<div class="trip-card__top">' +
            '<h2 class="trip-card__name">' + esc(list.name) + '</h2>' +
            '<p class="trip-card__meta">' + list.days + ' TAGE · ' + esc(list.category).toUpperCase() +
              ' · ' + esc(list.weather).toUpperCase() + '</p>' +
          '</div>' +
          '<span class="panel__hint">AKTIV</span>' +
        '</div>' +

        '<div class="trip-card__tags">' +
          '<span class="tag">' + icon(TRIP_ICON[list.category]) + esc(list.category).toUpperCase() + '</span>' +
          '<span class="tag">' + icon(WEATHER_ICON[list.weather]) + esc(list.weather).toUpperCase() + '</span>' +
          '<span class="tag">' + icon('i-doc') + list.items.length + ' POSITIONEN</span>' +
        '</div>' +

        '<div class="progress">' +
          '<div class="progress__top">' +
            '<span class="progress__label">' + progress.packed + ' / ' + progress.total +
              ' GEGENSTÄNDE EINGEPACKT</span>' +
            '<span class="progress__value">' + progress.percent + '%</span>' +
          '</div>' +
          '<div class="progress__bar" role="progressbar" aria-valuemin="0" aria-valuemax="100"' +
            ' aria-valuenow="' + progress.percent + '" aria-label="Packfortschritt">' +
            '<div class="progress__fill' + (done ? ' is-full' : '') +
              '" style="width:' + progress.percent + '%"></div>' +
          '</div>' +
          '<p class="progress__note">' + packedPositions + ' VON ' + list.items.length +
            ' POSITIONEN ABGEHAKT' + (done ? ' · ALLES DABEI' : '') + '</p>' +
        '</div>' +

        groupsHtml +

        '<div class="add-item">' +
          '<span class="field__label">EIGENES ITEM HINZUFÜGEN</span>' +
          '<div class="add-item__row add-item__row--single">' +
            '<input class="input" id="custom-name" type="text" maxlength="40"' +
              ' placeholder="z. B. Regenhose" aria-label="Name des eigenen Items">' +
          '</div>' +
          '<div class="add-item__row">' +
            '<select class="select" id="custom-cat" aria-label="Kategorie des eigenen Items">' +
              L.CATEGORIES.map(function (cat) {
                return '<option value="' + esc(cat) + '">' + esc(cat) + '</option>';
              }).join('') +
            '</select>' +
            '<button class="btn btn--ghost" type="button" data-act="add-custom">' +
              icon('i-plus') + ' ADD' +
            '</button>' +
          '</div>' +
        '</div>' +

        '<div class="list-actions">' +
          '<button class="btn btn--ghost btn--sm" type="button" data-act="complete">' +
            icon('i-check') + ' FERTIG' +
          '</button>' +
          '<button class="btn btn--danger btn--sm" type="button" data-act="discard">' +
            icon('i-trash') + ' VERWERFEN' +
          '</button>' +
        '</div>' +
      '</div>';
  }

  /* ------------------------------------------------------------------ */
  /* render: archive, settings, tabs                                    */
  /* ------------------------------------------------------------------ */

  function renderArchive() {
    var root = $('#archive-root');
    var count = state.archive.length;
    $('#archive-count').textContent = count + (count === 1 ? ' LISTE' : ' LISTEN');
    var badge = $('#tab-badge');
    badge.textContent = String(count);
    badge.hidden = count === 0;

    if (!count) {
      root.innerHTML = '' +
        '<div class="empty">' +
          icon('i-doc') +
          '<strong>ARCHIV IST LEER</strong>' +
          '<span>Abgeschlossene Reisen erscheinen hier.</span>' +
        '</div>';
      return;
    }

    root.innerHTML = '<div class="archive-list">' + state.archive.map(function (list) {
      var progress = L.progress(list.items);
      return '' +
        '<article class="archive-card" data-id="' + esc(list.id) + '">' +
          '<div class="archive-card__head">' +
            '<div>' +
              '<h3 class="archive-card__name">' + esc(list.name) + '</h3>' +
              '<span class="archive-card__date">' + formatDate(list.archivedAt || list.createdAt) + '</span>' +
            '</div>' +
            '<span class="archive-card__stat">' + progress.packed + '/' + progress.total + '</span>' +
          '</div>' +
          '<p class="archive-card__meta">' + list.days + ' TAGE · ' + esc(list.category).toUpperCase() +
            ' · ' + esc(list.weather).toUpperCase() + '</p>' +
          '<div class="archive-card__bar"><span style="width:' + progress.percent + '%"></span></div>' +
          '<div class="archive-card__actions">' +
            '<button class="btn btn--ghost btn--sm" type="button" data-act="load-archive" data-id="' +
              esc(list.id) + '">' + icon('i-upload') + ' LADEN</button>' +
            '<button class="btn btn--danger btn--sm" type="button" data-act="delete-archive" data-id="' +
              esc(list.id) + '">' + icon('i-trash') + ' LÖSCHEN</button>' +
          '</div>' +
        '</article>';
    }).join('') + '</div>';
  }

  function renderSettings() {
    var root = $('#storage-stats');
    if (!root) return;
    var allLists = state.archive.slice();
    if (state.active) allLists.push(state.active);
    var items = allLists.reduce(function (sum, list) {
      return sum + L.totalQty(list.items);
    }, 0);
    var bytes = 0;
    try { bytes = new Blob([JSON.stringify(state)]).size; } catch (err) { bytes = JSON.stringify(state).length; }
    var size = bytes >= 1024 ? (bytes / 1024).toFixed(1).replace('.', ',') + ' KB' : bytes + ' B';

    root.innerHTML = '' +
      '<div class="stat"><span class="stat__num">' + (state.active ? '1' : '0') + '</span>' +
        '<span class="stat__label">AKTIVE REISE</span></div>' +
      '<div class="stat"><span class="stat__num">' + state.archive.length + '</span>' +
        '<span class="stat__label">IM ARCHIV</span></div>' +
      '<div class="stat"><span class="stat__num">' + items + '</span>' +
        '<span class="stat__label">GEGENSTÄNDE</span></div>' +
      '<div class="stat"><span class="stat__num">' + size + '</span>' +
        '<span class="stat__label">SPEICHER</span></div>';
  }

  function renderTabs() {
    ['plan', 'lists', 'settings'].forEach(function (tab) {
      var button = $('#tab-' + tab);
      var view = $('#view-' + tab);
      var active = ui.tab === tab;
      view.hidden = !active;
      if (active) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    });
  }

  function syncChips() {
    document.querySelectorAll('[data-category]').forEach(function (button) {
      button.setAttribute('aria-pressed', button.dataset.category === ui.category ? 'true' : 'false');
    });
    document.querySelectorAll('[data-weather]').forEach(function (button) {
      button.setAttribute('aria-pressed', button.dataset.weather === ui.weather ? 'true' : 'false');
    });
  }

  function render() {
    syncChips();
    renderActive();
    renderArchive();
    renderSettings();
    renderTabs();
  }

  /* ------------------------------------------------------------------ */
  /* actions                                                            */
  /* ------------------------------------------------------------------ */

  function findActiveItem(id) {
    if (!state.active) return null;
    return state.active.items.find(function (item) { return item.id === id; }) || null;
  }

  function rerenderActive(focusAction) {
    var focused = document.activeElement;
    var focusedId = focused && focused.closest ? focused.closest('.item') : null;
    if (focusAction && focusedId) focusedId = focusedId.dataset.id;
    renderActive();
    renderSettings();
    renderArchive();
    if (focusAction && focusedId) {
      var el = document.querySelector('.item[data-id="' + focusedId + '"] .' + focusAction);
      if (el) el.focus({ preventScroll: true });
    }
  }

  function generateList(event) {
    event.preventDefault();
    var nameInput = $('#trip-name');
    var daysInput = $('#trip-days');
    var name = nameInput.value.trim().replace(/\s+/g, ' ').slice(0, 40) || 'Meine Reise';
    var days = L.clampDays(daysInput.value);
    daysInput.value = String(days);
    var defs = L.generateItems({ days: days, category: ui.category, weather: ui.weather });
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
      days: days,
      category: ui.category,
      weather: ui.weather,
      createdAt: Date.now(),
      items: items
    };
    persist();
    render();
    nameInput.value = '';
    toast(items.length + ' POSITIONEN BERECHNET' + (archived ? ' · ALTE LISTE ARCHIVIERT' : ''));
    window.setTimeout(function () {
      var root = $('#active-root');
      if (root) root.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 60);
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
        title: 'LEERE LISTE',
        text: 'Diese Liste enthält keine Positionen. Verwerfen?',
        confirmLabel: 'VERWERFEN',
        onConfirm: function () {
          state.active = null;
          persist();
          render();
          toast('LISTE VERWORFEN');
        }
      });
      return;
    }
    openModal({
      title: 'REISE ABSCHLIESSEN?',
      text: '"' + list.name + '" wandert mit ' + progress.total + ' Gegenständen ins Archiv.',
      confirmLabel: 'ABSCHLIESSEN',
      onConfirm: function () {
        archiveCurrent();
        persist();
        render();
        ui.tab = 'lists';
        renderTabs();
        window.scrollTo(0, 0);
        toast('LISTE ARCHIVIERT');
      }
    });
  }

  function discardList() {
    if (!state.active) return;
    openModal({
      title: 'LISTE VERWERFEN?',
      text: 'Die aktive Liste wird gelöscht und nicht archiviert.',
      confirmLabel: 'VERWERFEN',
      onConfirm: function () {
        state.active = null;
        persist();
        render();
        toast('LISTE VERWORFEN');
      }
    });
  }

  function addCustomItem() {
    if (!state.active) {
      toast('ERST EINE LISTE GENERIEREN');
      return;
    }
    var nameInput = $('#custom-name');
    var catSelect = $('#custom-cat');
    var name = nameInput.value.trim().replace(/\s+/g, ' ').slice(0, 40);
    if (!name) {
      toast('BITTE EINEN NAMEN EINGEBEN');
      nameInput.focus();
      return;
    }
    var cat = validCat(catSelect.value);
    var existing = state.active.items.find(function (item) {
      return item.cat === cat && item.name.toLowerCase() === name.toLowerCase();
    });
    if (existing) {
      existing.qty = Math.min(MAX_QTY, existing.qty + 1);
      existing.custom = true;
      toast('MENGE ERHÖHT');
    } else {
      state.active.items.push({
        id: uid(),
        name: name,
        qty: 1,
        cat: cat,
        packed: false,
        custom: true
      });
      toast('ITEM HINZUGEFÜGT');
    }
    persist();
    renderActive();
    renderSettings();
    renderArchive();
    var fresh = $('#custom-name');
    if (fresh) fresh.focus({ preventScroll: true });
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
    render();
    ui.tab = 'plan';
    renderTabs();
    window.scrollTo(0, 0);
    toast('LISTE GELADEN');
  }

  function deleteArchived(id) {
    var list = state.archive.find(function (entry) { return entry.id === id; });
    if (!list) return;
    openModal({
      title: 'ARCHIV-EINTRAG LÖSCHEN?',
      text: '"' + list.name + '" wird endgültig entfernt.',
      confirmLabel: 'LÖSCHEN',
      onConfirm: function () {
        state.archive = state.archive.filter(function (entry) { return entry.id !== id; });
        persist();
        render();
        toast('EINTRAG GELÖSCHT');
      }
    });
  }

  function exportData() {
    var payload = {
      app: 'PackForge',
      version: 1,
      exportedAt: new Date().toISOString(),
      active: state.active,
      archive: state.archive,
      prefs: state.prefs
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
    toast('EXPORT ERSTELLT');
  }

  function importData(file) {
    var reader = new FileReader();
    reader.onload = function () {
      var parsed;
      try {
        parsed = JSON.parse(String(reader.result));
      } catch (err) {
        toast('UNGÜLTIGE JSON-DATEI');
        return;
      }
      var imported = normalizeState(parsed);
      if (!imported) {
        toast('DATEI ENTHÄLT KEINE PACKLISTE');
        return;
      }
      var listCount = (imported.active ? 1 : 0) + imported.archive.length;
      openModal({
        title: 'IMPORT BESTÄTIGEN',
        text: listCount + ' Liste(n) werden geladen. Bestehende Daten werden ersetzt.',
        confirmLabel: 'IMPORTIEREN',
        onConfirm: function () {
          state = imported;
          ui.category = state.prefs.category;
          ui.weather = state.prefs.weather;
          ui.tab = imported.active ? 'plan' : 'lists';
          persist();
          render();
          window.scrollTo(0, 0);
          toast('IMPORT ERFOLGREICH');
        }
      });
    };
    reader.onerror = function () { toast('DATEI KONNTE NICHT GELESEN WERDEN'); };
    reader.readAsText(file);
  }

  function resetData() {
    openModal({
      title: 'ALLES LÖSCHEN?',
      text: 'Aktive Liste und das komplette Archiv werden entfernt. Vorher exportieren?',
      confirmLabel: 'ALLES LÖSCHEN',
      onConfirm: function () {
        state = emptyState();
        ui.category = 'Städtetrip';
        ui.weather = 'Sonnig';
        ui.tab = 'plan';
        persist();
        render();
        window.scrollTo(0, 0);
        toast('DATEN ZURÜCKGESETZT');
      }
    });
  }

  /* ------------------------------------------------------------------ */
  /* events                                                             */
  /* ------------------------------------------------------------------ */

  function switchTab(tab) {
    if (['plan', 'lists', 'settings'].indexOf(tab) < 0) return;
    ui.tab = tab;
    renderTabs();
    window.scrollTo(0, 0);
  }

  document.addEventListener('click', function (event) {
    var tab = event.target.closest('[data-tab]');
    if (tab) {
      switchTab(tab.dataset.tab);
      return;
    }

    var categoryButton = event.target.closest('[data-category]');
    if (categoryButton) {
      ui.category = categoryButton.dataset.category;
      state.prefs.category = ui.category;
      persist();
      syncChips();
      return;
    }

    var weatherButton = event.target.closest('[data-weather]');
    if (weatherButton) {
      ui.weather = weatherButton.dataset.weather;
      state.prefs.weather = ui.weather;
      persist();
      syncChips();
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

    var actionEl = event.target.closest('[data-act]');
    if (!actionEl) return;
    var action = actionEl.dataset.act;

    var itemRow = actionEl.closest('.item');
    var itemId = itemRow ? itemRow.dataset.id : null;

    if (action === 'add-custom') {
      addCustomItem();
      return;
    }
    if (action === 'export') {
      exportData();
      return;
    }
    if (action === 'import') {
      var fileInput = $('#import-file');
      if (fileInput) fileInput.click();
      return;
    }
    if (action === 'reset') {
      resetData();
      return;
    }
    if (action === 'complete') {
      completeList();
      return;
    }
    if (action === 'discard') {
      discardList();
      return;
    }
    if (action === 'load-archive') {
      loadArchived(actionEl.dataset.id);
      return;
    }
    if (action === 'delete-archive') {
      deleteArchived(actionEl.dataset.id);
      return;
    }

    if (!itemId) return;
    var item = findActiveItem(itemId);
    if (!item) return;

    if (action === 'toggle') {
      item.packed = !item.packed;
      persist();
      rerenderActive('check');
      return;
    }
    if (action === 'inc') {
      item.qty = Math.min(MAX_QTY, item.qty + 1);
      persist();
      rerenderActive('qty__btn');
      return;
    }
    if (action === 'dec') {
      if (item.qty > 1) item.qty -= 1;
      persist();
      rerenderActive('qty__btn');
      return;
    }
    if (action === 'del') {
      state.active.items = state.active.items.filter(function (entry) { return entry.id !== itemId; });
      persist();
      renderActive();
      renderSettings();
      toast('ITEM ENTFERNT');
    }
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

  document.querySelectorAll('[data-step]').forEach(function (button) {
    button.addEventListener('click', function () {
      var input = $('#trip-days');
      var value = L.clampDays(input.value) + Number(button.dataset.step);
      input.value = String(Math.min(L.MAX_DAYS, Math.max(1, value)));
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
    var next = loadState();
    state = next;
    ui.category = state.prefs.category;
    ui.weather = state.prefs.weather;
    render();
  });

  /* ------------------------------------------------------------------ */
  /* init                                                               */
  /* ------------------------------------------------------------------ */

  var daysField = $('#trip-days');
  if (daysField) daysField.value = '3';

  render();

  if ('serviceWorker' in navigator && window.location.protocol !== 'file:') {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function () {
        /* offline mode is optional; the app still works online */
      });
    });
  }
})();
