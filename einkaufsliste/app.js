(function () {
  'use strict';
  var STORAGE_KEY = 'marktzettel-v1';
  var categories = ['Allgemein', 'Obst', 'Gemüse', 'Milchprodukte', 'Brot & Backwaren', 'Getränke', 'Haushalt'];
  var state = loadState();
  var activeFilter = 'open';
  var alphabetical = false;
  var toastTimer;

  function uid() { return 'i' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function cleanName(value) { return String(value || '').trim().replace(/\s+/g, ' '); }
  function loadState() {
    try {
      var saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (saved && saved.lists && saved.lists.length) {
        saved.staples = Array.isArray(saved.staples) ? saved.staples : [];
        saved.lists = saved.lists.map(function (list) {
          list.items = Array.isArray(list.items) ? list.items : [];
          list.items.forEach(function (item) { if (!item.id) item.id = uid(); if (!item.category) item.category = 'Allgemein'; });
          return list;
        });
        if (!saved.lists.some(function (list) { return list.id === saved.activeId; })) saved.activeId = saved.lists[0].id;
        return saved;
      }
    } catch (error) { /* Start with a fresh local list when saved data is unreadable. */ }
    var first = { id: uid(), name: 'Wocheneinkauf', items: [], createdAt: Date.now() };
    return { activeId: first.id, lists: [first], staples: [] };
  }
  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
    catch (error) { showToast('Speichern war nicht möglich.'); }
  }
  function activeList() { return state.lists.filter(function (list) { return list.id === state.activeId; })[0] || state.lists[0]; }
  function escapeHtml(value) { return String(value).replace(/[&<>"']/g, function (char) { return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]; }); }
  function guessCategory(name) {
    var value = name.toLowerCase();
    if (/apfel|banane|birne|orange|zitrone|beere|traube|obst/.test(value)) return 'Obst';
    if (/salat|tomate|gurke|paprika|zwiebel|kartoffel|möhre|karotte|gemüse|brokkoli/.test(value)) return 'Gemüse';
    if (/milch|käse|joghurt|quark|butter|sahne|ei\b/.test(value)) return 'Milchprodukte';
    if (/brot|brötchen|toast|croissant/.test(value)) return 'Brot & Backwaren';
    if (/wasser|saft|cola|limonade|getränk|kaffee|tee/.test(value)) return 'Getränke';
    if (/seife|spül|waschmittel|papier|reiniger|müllbeutel/.test(value)) return 'Haushalt';
    return 'Allgemein';
  }
  function render() {
    var list = activeList();
    if (!list) return;
    document.getElementById('listTitle').textContent = list.name;
    document.getElementById('listEyebrow').textContent = list.name.toUpperCase() === 'WOCHENEINKAUF' ? 'DEIN NÄCHSTER EINKAUF' : 'DEINE EINKAUFSLISTE';
    document.getElementById('listSubtitle').textContent = list.items.length ? 'Alles im Blick. Schritt für Schritt.' : 'Alles im Blick. Schritt für Schritt.';
    renderNav(); renderItems(); renderStaples();
  }
  function renderNav() {
    var nav = document.getElementById('listNav');
    var picker = document.getElementById('listPicker');
    nav.innerHTML = '';
    picker.innerHTML = '';
    state.lists.forEach(function (list) {
      var open = list.items.filter(function (item) { return !item.done; }).length;
      var button = document.createElement('button');
      button.type = 'button'; button.className = 'nav-list-button' + (list.id === state.activeId ? ' active' : '');
      button.innerHTML = '<span class="nav-glyph" aria-hidden="true">▤</span><span class="nav-name">' + escapeHtml(list.name) + '</span><span class="nav-count">' + open + '</span>';
      button.addEventListener('click', function () { state.activeId = list.id; save(); render(); });
      nav.appendChild(button);
      var option = document.createElement('option'); option.value = list.id; option.textContent = list.name; option.selected = list.id === state.activeId; picker.appendChild(option);
    });
    document.getElementById('openCount').textContent = String(activeList().items.filter(function (item) { return !item.done; }).length);
  }
  function renderItems() {
    var list = activeList();
    var ul = document.getElementById('itemList');
    var empty = document.getElementById('emptyState');
    var rows = list.items.filter(function (item) { return activeFilter === 'all' || (activeFilter === 'open' && !item.done) || (activeFilter === 'done' && item.done); });
    if (alphabetical) rows.sort(function (a, b) { return a.name.localeCompare(b.name, 'de'); });
    else rows.sort(function (a, b) { return Number(a.done) - Number(b.done) || (a.createdAt || 0) - (b.createdAt || 0); });
    ul.innerHTML = '';
    rows.forEach(function (item) {
      var li = document.createElement('li'); li.className = 'item-row' + (item.done ? ' is-done' : '');
      li.innerHTML = '<label class="check-wrap"><input type="checkbox" aria-label="' + (item.done ? 'Erledigt: ' : 'Abhaken: ') + escapeHtml(item.name) + '" ' + (item.done ? 'checked' : '') + '><span class="check-mark" aria-hidden="true"></span></label>' +
        '<div class="item-main"><div class="item-name">' + escapeHtml(item.name) + '</div><div class="item-meta">' + (item.category && item.category !== 'Allgemein' ? '<span class="category-tag">' + escapeHtml(item.category) + '</span>' : '') + (item.quantity ? '<span class="quantity">· ' + escapeHtml(item.quantity) + '</span>' : '') + '</div></div>' +
        '<div class="item-actions"><button class="row-action staple-toggle" type="button" aria-label="' + (item.repeat ? 'Aus Standardartikeln entfernen' : 'Zu Standardartikeln hinzufügen') + '" title="' + (item.repeat ? 'Wird zu jeder neuen Liste hinzugefügt' : 'Immer auf neue Listen setzen') + '">' + (item.repeat ? '★' : '☆') + '</button><button class="row-action edit-item" type="button" aria-label="' + escapeHtml(item.name) + ' bearbeiten" title="Bearbeiten">⋯</button></div>';
      li.querySelector('input').addEventListener('change', function () { item.done = this.checked; save(); render(); });
      li.querySelector('.staple-toggle').addEventListener('click', function () { toggleStaple(item); });
      li.querySelector('.edit-item').addEventListener('click', function () { openItemEditor(item); });
      ul.appendChild(li);
    });
    empty.hidden = list.items.length > 0;
    if (list.items.length && rows.length === 0) {
      empty.hidden = false; empty.querySelector('h2').textContent = activeFilter === 'done' ? 'Noch nichts erledigt' : 'Alles erledigt';
      empty.querySelector('p').textContent = activeFilter === 'done' ? 'Abgehakte Artikel erscheinen hier.' : 'Deine offenen Artikel sind erledigt. Gut gemacht!';
    } else if (!list.items.length) {
      empty.querySelector('h2').textContent = 'Deine Liste ist bereit';
      empty.querySelector('p').textContent = 'Füge oben deinen ersten Artikel hinzu. Dann kann\'s losgehen.';
    }
    var done = list.items.filter(function (item) { return item.done; }).length;
    var total = list.items.length;
    var wrap = document.getElementById('progressWrap');
    wrap.hidden = total === 0;
    if (total) {
      document.getElementById('progressText').textContent = done + ' von ' + total + ' erledigt';
      document.getElementById('progressPercent').textContent = Math.round(done / total * 100) + '%';
      document.getElementById('progressFill').style.width = Math.round(done / total * 100) + '%';
    }
    var doneActions = document.getElementById('doneActions');
    doneActions.hidden = done === 0;
    document.getElementById('doneSummary').textContent = done + (done === 1 ? ' Artikel erledigt' : ' Artikel erledigt');
    document.getElementById('openCount').textContent = String(total - done);
  }
  function renderStaples() {
    var summary = document.getElementById('stapleSummary');
    summary.textContent = state.staples.length ? state.staples.map(function (item) { return item.name; }).join(' · ') : 'Noch keine Standardartikel hinzugefügt.';
  }
  function addItem(name, quantity, category) {
    name = cleanName(name); if (!name) return false;
    var existing = activeList().items.filter(function (item) { return item.name.toLowerCase() === name.toLowerCase() && !item.done; })[0];
    if (existing) { showToast('Ist schon auf deiner Liste.'); return false; }
    var item = { id: uid(), name: name, quantity: quantity || '', category: category || guessCategory(name), done: false, repeat: false, createdAt: Date.now() };
    activeList().items.push(item); save(); render(); return true;
  }
  function toggleStaple(item) {
    item.repeat = !item.repeat;
    var existingIndex = state.staples.findIndex(function (entry) { return entry.name.toLowerCase() === item.name.toLowerCase(); });
    if (item.repeat && existingIndex < 0) state.staples.push({ id: uid(), name: item.name, category: item.category, quantity: item.quantity || '' });
    if (!item.repeat && existingIndex >= 0) state.staples.splice(existingIndex, 1);
    save(); render(); showToast(item.repeat ? 'Kommt auf jede neue Liste.' : 'Standardartikel entfernt.');
  }
  function showToast(message) {
    var toast = document.getElementById('toast'); toast.textContent = message; toast.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { toast.classList.remove('show'); }, 2300);
  }
  function showModal(title, bodyHtml, actionsHtml, onOpen) {
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalBody').innerHTML = bodyHtml;
    document.getElementById('modalActions').innerHTML = actionsHtml;
    var modal = document.getElementById('modal');
    if (typeof modal.showModal === 'function') modal.showModal(); else modal.setAttribute('open', 'open');
    if (onOpen) onOpen(modal);
  }
  function closeModal() { var modal = document.getElementById('modal'); if (typeof modal.close === 'function') modal.close(); else modal.removeAttribute('open'); }
  function addNewList() {
    showModal('Neue Liste', '<label class="modal-label" for="newListName">Name der Liste</label><input class="modal-input" id="newListName" maxlength="40" placeholder="z. B. Grillabend" autocomplete="off">', '<button class="modal-secondary" type="button" data-cancel>Abbrechen</button><button class="modal-primary" type="button" id="createList">Liste erstellen</button>', function () {
      var input = document.getElementById('newListName'); input.focus();
      document.getElementById('createList').addEventListener('click', function () {
        var name = cleanName(input.value); if (!name) { input.focus(); return; }
        var list = { id: uid(), name: name, items: state.staples.map(function (item) { return { id: uid(), name: item.name, quantity: item.quantity || '', category: item.category || guessCategory(item.name), done: false, repeat: true, createdAt: Date.now() }; }), createdAt: Date.now() };
        state.lists.unshift(list); state.activeId = list.id; save(); closeModal(); render(); showToast(state.staples.length ? 'Liste erstellt – deine Standardartikel sind drin.' : 'Neue Liste erstellt.');
      });
      document.querySelector('[data-cancel]').addEventListener('click', closeModal);
      input.addEventListener('keydown', function (event) { if (event.key === 'Enter') { event.preventDefault(); document.getElementById('createList').click(); } });
    });
  }
  function openItemEditor(item) {
    var options = categories.map(function (category) { return '<option ' + (item.category === category ? 'selected' : '') + '>' + escapeHtml(category) + '</option>'; }).join('');
    showModal('Artikel bearbeiten', '<label class="modal-label" for="editItemName">Artikel</label><input class="modal-input" id="editItemName" maxlength="80" value="' + escapeHtml(item.name) + '"><label class="modal-label" for="editItemQty">Menge oder Notiz <span style="font-weight:400">(optional)</span></label><input class="modal-input" id="editItemQty" maxlength="30" placeholder="z. B. 2 Packungen" value="' + escapeHtml(item.quantity || '') + '"><label class="modal-label" for="editItemCategory">Kategorie</label><select class="modal-input" id="editItemCategory">' + options + '</select>', '<button class="modal-danger" type="button" id="deleteItem">Löschen</button><button class="modal-primary" type="button" id="saveItem">Speichern</button>', function () {
      document.getElementById('editItemName').focus();
      document.getElementById('saveItem').addEventListener('click', function () { var name = cleanName(document.getElementById('editItemName').value); if (!name) return; var oldName = item.name; item.name = name; item.quantity = cleanName(document.getElementById('editItemQty').value); item.category = document.getElementById('editItemCategory').value; if (item.repeat) state.staples.forEach(function (entry) { if (entry.name.toLowerCase() === oldName.toLowerCase()) { entry.name = item.name; entry.quantity = item.quantity; entry.category = item.category; } }); save(); closeModal(); render(); });
      document.getElementById('deleteItem').addEventListener('click', function () { activeList().items = activeList().items.filter(function (entry) { return entry.id !== item.id; }); if (item.repeat) state.staples = state.staples.filter(function (entry) { return entry.name.toLowerCase() !== item.name.toLowerCase(); }); save(); closeModal(); render(); showToast('Artikel gelöscht.'); });
    });
  }
  function manageStaples() {
    var body = state.staples.length ? '<p class="modal-intro" style="color:#7d877e;font-size:13px;line-height:1.55;margin:0 0 10px">Markierte Artikel werden automatisch zu jeder neuen Liste hinzugefügt.</p><div class="staple-edit-list">' + state.staples.map(function (item) { return '<label class="modal-check-row"><input type="checkbox" checked data-staple-id="' + escapeHtml(item.id) + '"><span>' + escapeHtml(item.name) + '</span></label>'; }).join('') + '</div>' : '<p style="color:#7d877e;font-size:13px;line-height:1.6;margin:0">Tippe bei einem Artikel auf den Stern ☆, damit er bei jeder neuen Liste automatisch dabei ist.</p>';
    showModal('Standardartikel', body, '<button class="modal-primary" type="button" id="stapleDone">Fertig</button>', function () {
      Array.prototype.forEach.call(document.querySelectorAll('[data-staple-id]'), function (checkbox) { checkbox.addEventListener('change', function () { if (!this.checked) { var staple = state.staples.filter(function (entry) { return entry.id === this.dataset.stapleId; }, this)[0]; state.staples = state.staples.filter(function (entry) { return entry.id !== this.dataset.stapleId; }, this); if (staple) state.lists.forEach(function (list) { list.items.forEach(function (item) { if (item.name.toLowerCase() === staple.name.toLowerCase()) item.repeat = false; }); }); save(); renderStaples(); this.closest('label').remove(); } }); });
      document.getElementById('stapleDone').addEventListener('click', closeModal);
    });
  }
  function listOptions() {
    var list = activeList();
    var body = '<label class="modal-label" for="renameList">Listenname</label><input class="modal-input" id="renameList" maxlength="40" value="' + escapeHtml(list.name) + '"><p style="color:#858f86;font-size:12px;line-height:1.55;margin:12px 0 0">' + list.items.length + (list.items.length === 1 ? ' Artikel' : ' Artikel') + ' auf dieser Liste.</p>';
    var remove = state.lists.length > 1 ? '<button class="modal-danger" type="button" id="deleteList">Liste löschen</button>' : '';
    showModal('Listenoptionen', body, remove + '<button class="modal-secondary" type="button" data-cancel>Schließen</button><button class="modal-primary" type="button" id="renameSave">Speichern</button>', function () {
      document.getElementById('renameList').focus();
      document.getElementById('renameSave').addEventListener('click', function () { var name = cleanName(document.getElementById('renameList').value); if (!name) return; list.name = name; save(); closeModal(); render(); showToast('Listenname geändert.'); });
      var deleteButton = document.getElementById('deleteList');
      if (deleteButton) deleteButton.addEventListener('click', function () { state.lists = state.lists.filter(function (entry) { return entry.id !== list.id; }); state.activeId = state.lists[0].id; save(); closeModal(); render(); showToast('Liste gelöscht.'); });
      document.querySelector('[data-cancel]').addEventListener('click', closeModal);
    });
  }
  function shareList() {
    var list = activeList();
    var pending = list.items.filter(function (item) { return !item.done; });
    var text = list.name + '\n' + (pending.length ? pending.map(function (item) { return '☐ ' + item.name + (item.quantity ? ' – ' + item.quantity : ''); }).join('\n') : 'Alles erledigt!');
    if (navigator.share) navigator.share({ title: list.name + ' · Marktzettel', text: text }).catch(function () {});
    else if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(function () { showToast('Liste in die Zwischenablage kopiert.'); }).catch(function () { showToast(text); });
    else showToast('Teilen wird von diesem Browser nicht unterstützt.');
  }

  document.getElementById('addForm').addEventListener('submit', function (event) { event.preventDefault(); var input = document.getElementById('itemInput'); if (addItem(input.value)) { input.value = ''; input.focus(); } });
  document.querySelectorAll('[data-quick]').forEach(function (button) { button.addEventListener('click', function () { var value = this.dataset.quick; if (addItem(value)) showToast(value + ' hinzugefügt.'); }); });
  document.querySelectorAll('.filter-tab').forEach(function (button) { button.addEventListener('click', function () { activeFilter = this.dataset.filter; document.querySelectorAll('.filter-tab').forEach(function (tab) { tab.classList.toggle('active', tab === button); }); renderItems(); }); });
  document.getElementById('sortButton').addEventListener('click', function () { alphabetical = !alphabetical; this.innerHTML = alphabetical ? 'Neu <span aria-hidden="true">⌄</span>' : 'A–Z <span aria-hidden="true">⌄</span>'; renderItems(); });
  document.getElementById('clearDone').addEventListener('click', function () { var list = activeList(); list.items = list.items.filter(function (item) { return !item.done; }); save(); render(); showToast('Erledigte Artikel entfernt.'); });
  document.getElementById('newListSide').addEventListener('click', addNewList);
  document.getElementById('newListMobile').addEventListener('click', addNewList);
  document.getElementById('listPicker').addEventListener('change', function () { state.activeId = this.value; save(); render(); });
  document.getElementById('manageStaples').addEventListener('click', manageStaples);
  document.getElementById('listMenuButton').addEventListener('click', listOptions);
  document.getElementById('shareButton').addEventListener('click', shareList);
  document.getElementById('modal').addEventListener('click', function (event) { if (event.target === this) closeModal(); });
  window.addEventListener('storage', function (event) { if (event.key === STORAGE_KEY) { state = loadState(); render(); } });
  if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) window.addEventListener('load', function () { navigator.serviceWorker.register('./service-worker.js').catch(function () {}); });
  save(); render();
}());
