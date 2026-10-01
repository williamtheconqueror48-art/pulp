/* PULP studio engine — screenplay formatting, library, Neon sync.
   Vanilla JS. Docs live in localStorage as offline cache and sync to
   /api/projects (Neon Postgres) with an honest sync-status indicator. */
(function () {
'use strict';
const $ = (s) => document.querySelector(s);
const uid = () => (window.crypto && crypto.randomUUID)
  ? crypto.randomUUID()
  : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/* ================= SEED CONTENT (original writing) ================= */
function seedDocs() {
  const now = Date.now();
  return [
    {
      id: uid(), title: 'The Lighthouse Keeper', doc_type: 'screenplay',
      created_at: now, updated_at: now,
      title_page: { title: 'THE LIGHTHOUSE KEEPER', credit: 'written by', author: 'Pulp Writer', draft: 'First Draft', contact: '', show: true },
      content: { blocks: [
        { el: 'scene', text: 'INT. LIGHTHOUSE LANTERN ROOM - NIGHT' },
        { el: 'action', text: 'Rain hammers the glass. Below, the sea climbs the rocks like it means to swallow them whole.' },
        { el: 'shot', text: 'CLOSE ON — MARA (40s), oilskin coat, a kerosene lamp shaking in her grip.' },
        { el: 'action', text: 'She checks the great lens. It turns, throws its beam into the black — and dies.' },
        { el: 'character', text: 'MARA' },
        { el: 'parenthetical', text: '(into the dark)' },
        { el: 'dialogue', text: "Come on. Come on, you old beast." },
        { el: 'action', text: 'The radio on the desk CRACKLES awake.' },
        { el: 'character', text: 'RADIO (V.O.)' },
        { el: 'dialogue', text: '...vessel in distress, repeat, vessel in distress off Gull Rock...' },
        { el: 'character', text: 'MARA' },
        { el: 'dialogue', text: "Gull Rock? In this? They'll never make the channel." },
        { el: 'action', text: 'She grabs the lamp and takes the iron stairs two at a time.' },
        { el: 'scene', text: 'EXT. LIGHTHOUSE GALLERY - CONTINUOUS' },
        { el: 'action', text: 'Wind tries to peel her off the railing. Through the rain: a fishing boat, mast snapped, rolling toward the rocks.' },
        { el: 'character', text: 'MARA' },
        { el: 'parenthetical', text: '(shouting into the wind)' },
        { el: 'dialogue', text: "Hold your line! Hold your line, damn you!" },
        { el: 'action', text: 'She raises the lamp high — a small sun against the storm.' },
        { el: 'transition', text: 'CUT TO:' },
        { el: 'scene', text: 'INT. LIGHTHOUSE LANTERN ROOM - DAWN' },
        { el: 'action', text: 'The storm is gone. Mara sleeps against the great lens, the lamp burned to nothing in her hand. Through the glass: the fishing boat, safe at anchor.' },
        { el: 'character', text: 'ELI (V.O.)' },
        { el: 'dialogue', text: 'You kept the light, Mara.' },
        { el: 'character', text: 'MARA' },
        { el: 'parenthetical', text: '(smiling, asleep)' },
        { el: 'dialogue', text: 'Someone had to.' },
      ] }
    },
    {
      id: uid(), title: 'Monsoon Ledger', doc_type: 'poem',
      created_at: now, updated_at: now - 1000,
      title_page: { title: '', credit: '', author: '', draft: '', contact: '', show: false },
      content: { blocks: [
        { el: 'verse-title', text: 'Monsoon Ledger' },
        { el: 'verse', text: 'The city keeps its accounts in rain —' },
        { el: 'verse', text: 'each gutter a column, each puddle a sum.' },
        { el: 'verse', text: 'Commuters wade through the arithmetic' },
        { el: 'verse', text: 'of a sky that never learned subtraction.' },
        { el: 'stanza-break', text: '' },
        { el: 'verse', text: 'Somewhere a train waits, patient as a debt,' },
        { el: 'verse', text: 'while the sea rehearses its old argument' },
        { el: 'verse', text: 'with the shore. Nobody wins.' },
        { el: 'verse', text: 'Everyone gets wet. The ledger balances.' },
      ] }
    },
    {
      id: uid(), title: 'Neon River', doc_type: 'song',
      created_at: now, updated_at: now - 2000,
      title_page: { title: '', credit: '', author: '', draft: '', contact: '', show: false },
      content: { blocks: [
        { el: 'song-title', text: 'Neon River' },
        { el: 'section', text: '[Verse 1]' },
        { el: 'lyric', text: 'Streetlights bleeding in the rain outside,' },
        { el: 'lyric', text: 'Taxi meter running on the tears I hide.' },
        { el: 'lyric', text: "The city's humming all the words I never said," },
        { el: 'lyric', text: 'Neon river running through my head.' },
        { el: 'section', text: '[Chorus]' },
        { el: 'lyric', text: 'So carry me down, carry me slow,' },
        { el: 'lyric', text: 'Where the electric waters go.' },
        { el: 'lyric', text: "I don't need a map, I don't need a light —" },
        { el: 'lyric', text: "Just this neon river running through the night." },
        { el: 'section', text: '[Bridge]' },
        { el: 'lyric', text: 'And if the dawn should find me here,' },
        { el: 'lyric', text: "Drowned in static, crystal clear —" },
        { el: 'lyric', text: "I'll trade the morning for one more ride" },
        { el: 'lyric', text: 'Down the neon river, running wild.' },
      ] }
    },
  ];
}

/* ================= STORE + SYNC ================= */
const LS_DOCS = 'pulp_docs_v1', LS_DEV = 'pulp_device_id';
let deviceId = null, docs = [], activeId = null;
let saveTimer = null, syncState = 'saved';

function setSync(s) {
  syncState = s;
  const el = $('#saveState');
  if (!el) return;
  el.textContent = s === 'saved' ? 'saved'
    : s === 'saving' ? 'saving…'
    : s === 'offline' ? 'offline — saved on this device' : s;
  el.style.color = s === 'offline' ? '#e8a33d' : '';
}

async function api(path, method, body) {
  const r = await fetch('/api' + path, {
    method,
    headers: { 'Content-Type': 'application/json', 'x-device-id': deviceId },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!r.ok) throw new Error('api ' + r.status);
  return r.json();
}
const pack = (d) => ({ id: d.id, title: d.title, doc_type: d.doc_type,
  content: d.content, title_page: d.title_page });
const unpack = (r) => ({ id: r.id, title: r.title, doc_type: r.doc_type,
  content: r.content && r.content.blocks ? r.content : { blocks: [] },
  title_page: r.title_page || {}, created_at: +new Date(r.created_at),
  updated_at: +new Date(r.updated_at) });

function persistCache() {
  try { localStorage.setItem(LS_DOCS, JSON.stringify(docs)); } catch (e) {}
}

function scheduleSave() {
  persistCache();
  setSync('saving');
  clearTimeout(saveTimer);
  saveTimer = setTimeout(pushActive, 700);
}

async function pushActive() {
  const d = docs.find((x) => x.id === activeId);
  if (!d) { setSync('saved'); return; }
  try {
    await api('/projects/' + d.id, 'PUT', pack(d));
    setSync('saved');
  } catch (e) {
    setSync('offline');
  }
}

async function initialSync() {
  setSync('saving');
  try {
    const server = await api('/projects', 'GET');
    const have = new Set(server.map((r) => r.id));
    for (const d of docs) {
      if (!have.has(d.id)) {
        try { await api('/projects', 'POST', pack(d)); } catch (e) {}
      }
    }
    const fresh = await api('/projects', 'GET');
    if (fresh.length) {
      docs = fresh.map(unpack).sort((a, b) => b.updated_at - a.updated_at);
      persistCache();
    }
    setSync('saved');
  } catch (e) {
    setSync('offline');
  }
}

/* ================= EDITOR ================= */
const TYPES = {
  screenplay: ['scene', 'action', 'character', 'parenthetical', 'dialogue', 'transition', 'shot'],
  poem: ['verse-title', 'verse', 'stanza-break'],
  song: ['song-title', 'section', 'lyric'],
};
const NEXT = {
  scene: 'action', action: 'action', shot: 'action',
  character: 'dialogue', parenthetical: 'dialogue', dialogue: 'action',
  transition: 'scene',
  'verse-title': 'verse', verse: 'verse', 'stanza-break': 'verse',
  'song-title': 'section', section: 'lyric', lyric: 'lyric',
};
const EL_LABEL = {
  scene: 'Scene Heading', action: 'Action', character: 'Character',
  parenthetical: 'Parenthetical', dialogue: 'Dialogue',
  transition: 'Transition', shot: 'Shot',
  'verse-title': 'Title', verse: 'Verse', 'stanza-break': 'Stanza break',
  'song-title': 'Title', section: 'Section', lyric: 'Lyric',
};

const editor = () => $('#editor');
const activeDoc = () => docs.find((d) => d.id === activeId);
let typewriter = false, focusMode = false;

function blockEls() { return Array.from(editor().children).filter((n) => n.classList && n.classList.contains('blk')); }
function caretBlock() {
  const sel = window.getSelection();
  if (!sel.rangeCount) return null;
  let n = sel.anchorNode;
  while (n && n !== editor()) {
    if (n.classList && n.classList.contains('blk')) return n;
    n = n.parentNode;
  }
  return null;
}
function caretOffsetIn(el) {
  const sel = window.getSelection();
  if (!sel.rangeCount) return 0;
  const r = sel.getRangeAt(0).cloneRange();
  r.selectNodeContents(el);
  r.setEnd(sel.anchorNode, sel.anchorOffset);
  return r.toString().length;
}
function placeCaret(el, offset) {
  el.focus();
  const range = document.createRange(), sel = window.getSelection();
  let node = el.firstChild, off = offset;
  if (!node) { range.setStart(el, 0); range.collapse(true); }
  else {
    while (node) {
      const len = node.nodeType === 3 ? node.textContent.length : 0;
      if (node.nodeType === 3 && off <= len) { range.setStart(node, off); range.collapse(true); break; }
      off -= len; node = node.nextSibling;
    }
    if (!node) { range.selectNodeContents(el); range.collapse(false); }
  }
  sel.removeAllRanges(); sel.addRange(range);
}
function elType(el) {
  const m = (el.className.match(/el-([a-z-]+)/) || [])[1];
  return m || 'action';
}
function setElType(el, t) {
  el.className = 'blk el-' + t;
  el.dataset.el = t;
  updateHint();
}
function updateHint() {
  const b = caretBlock();
  const h = $('#elHint');
  if (h) h.textContent = b ? (EL_LABEL[elType(b)] || '') + ' — Tab to change · Enter for next' : 'Tab to change element · Enter for next';
}

function makeBlock(b) {
  const d = document.createElement('div');
  d.className = 'blk el-' + b.el;
  d.dataset.el = b.el;
  d.contentEditable = 'true';
  d.spellcheck = false;
  d.textContent = b.text || '';
  return d;
}

function renderEditor() {
  const d = activeDoc(), ed = editor();
  ed.dataset.mode = d ? d.doc_type : 'screenplay';
  ed.innerHTML = '';
  $('#docType').textContent = d ? d.doc_type : '';
  $('#docTitle').value = d ? d.title : '';
  if (!d || !d.content.blocks.length) {
    const b = makeBlock({ el: d && d.doc_type !== 'screenplay' ? TYPES[d.doc_type][0] : 'action', text: '' });
    ed.appendChild(b);
    if (d && !d.content.blocks.length) d.content.blocks = [{ el: b.dataset.el, text: '' }];
  } else {
    d.content.blocks.forEach((b) => ed.appendChild(makeBlock(b)));
  }
  renderTitlePage();
  renderNav();
  updateStats();
  renderLibrary();
}

function syncBlocksFromDOM() {
  const d = activeDoc();
  if (!d) return;
  d.content.blocks = blockEls().map((el) => ({ el: elType(el), text: el.textContent.replace(/\u00a0/g, ' ') }));
  d.updated_at = Date.now();
}

function characterNames() {
  const d = activeDoc(), names = [];
  if (!d) return names;
  const seen = new Set();
  d.content.blocks.forEach((b) => {
    if (b.el === 'character') {
      const n = b.text.trim().replace(/\s*\(.*\)\s*$/, '');
      if (n && !seen.has(n)) { seen.add(n); names.push(n); }
    }
  });
  return names;
}

/* --- keydown: Enter / Tab / Backspace --- */
function onKeyDown(e) {
  const ed = editor();
  if (e.target.closest && !e.target.closest('#editor')) return;
  const blk = caretBlock();
  if (!blk) return;
  const d = activeDoc();
  const mode = d ? d.doc_type : 'screenplay';

  if (e.key === 'Tab') {
    e.preventDefault();
    const list = TYPES[mode], cur = list.indexOf(elType(blk));
    const next = list[(cur + (e.shiftKey ? list.length - 1 : 1)) % list.length];
    setElType(blk, next);
    syncBlocksFromDOM(); scheduleSave(); updateStats(); renderNav();
    return;
  }

  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    hideSuggest();
    const off = caretOffsetIn(blk);
    const text = blk.textContent;
    const before = text.slice(0, off), after = text.slice(off);
    blk.textContent = before;
    const cur = elType(blk);
    let next = NEXT[cur] || 'action';
    // empty character + Enter -> back to action (quick escape hatch)
    if (cur === 'character' && !before.trim()) next = 'action';
    const nb = makeBlock({ el: next, text: after.replace(/^\n/, '') });
    blk.after(nb);
    placeCaret(nb, 0);
    setElType(nb, next);
    syncBlocksFromDOM(); scheduleSave(); updateStats(); renderNav();
    if (typewriter) centerCaret();
    return;
  }

  if (e.key === 'Backspace') {
    const off = caretOffsetIn(blk);
    if (off === 0) {
      const prev = blk.previousElementSibling;
      if (!blk.textContent && prev && prev.classList.contains('blk')) {
        e.preventDefault();
        blk.remove();
        placeCaret(prev, prev.textContent.length);
        syncBlocksFromDOM(); scheduleSave(); updateStats(); renderNav();
      } else if (blk.textContent && prev && prev.classList.contains('blk')) {
        e.preventDefault();
        const len = prev.textContent.length;
        prev.textContent += blk.textContent;
        blk.remove();
        placeCaret(prev, len);
        syncBlocksFromDOM(); scheduleSave(); updateStats(); renderNav();
      }
    }
  }
}

/* --- input: autodetect, stats, save --- */
function onInput(e) {
  const blk = caretBlock();
  const d = activeDoc();
  if (blk && d && d.doc_type === 'screenplay') {
    const t = elType(blk), txt = blk.textContent;
    if (t === 'action' && /^(INT|EXT|EST|INT\.\/EXT|INT\/EXT)[\.\s]/i.test(txt.trim())) {
      setElType(blk, 'scene');
      blk.textContent = txt.toUpperCase();
      placeCaret(blk, blk.textContent.length);
    } else if (t === 'dialogue' && /^\s*\(/.test(txt) && !/\)\s*$/.test(txt)) {
      setElType(blk, 'parenthetical');
    } else if (t === 'parenthetical' && !/^\s*\(/.test(txt)) {
      setElType(blk, 'dialogue');
    }
    if (t === 'character') maybeSuggest(blk);
  }
  syncBlocksFromDOM(); scheduleSave(); updateStats();
  clearTimeout(onInput._nt); onInput._nt = setTimeout(renderNav, 600);
}

/* --- character autocomplete --- */
function maybeSuggest(blk) {
  const q = blk.textContent.trim().toUpperCase();
  const box = $('#charSuggest');
  if (!q) { hideSuggest(); return; }
  const hits = characterNames().filter((n) => n.startsWith(q) && n !== q).slice(0, 6);
  if (!hits.length) { hideSuggest(); return; }
  const r = blk.getBoundingClientRect();
  box.innerHTML = hits.map((h, i) => `<button data-i="${i}" class="${i === 0 ? 'sel' : ''}">${esc(h)}</button>`).join('');
  box.style.left = Math.min(r.left, window.innerWidth - 220) + 'px';
  box.style.top = (r.bottom + window.scrollY + 4) + 'px';
  box.hidden = false;
  box.querySelectorAll('button').forEach((b) => b.addEventListener('mousedown', (ev) => {
    ev.preventDefault();
    blk.textContent = hits[+b.dataset.i];
    placeCaret(blk, blk.textContent.length);
    hideSuggest(); syncBlocksFromDOM(); scheduleSave();
  }));
}
function hideSuggest() { $('#charSuggest').hidden = true; }

/* --- paste as plain text --- */
function onPaste(e) {
  const blk = caretBlock();
  if (!blk) return;
  e.preventDefault();
  const text = (e.clipboardData || window.clipboardData).getData('text/plain');
  document.execCommand('insertText', false, text);
}

/* --- typewriter mode --- */
function centerCaret() {
  const blk = caretBlock();
  if (!blk) return;
  const sc = $('#paperScroll');
  const br = blk.getBoundingClientRect(), sr = sc.getBoundingClientRect();
  sc.scrollTop += (br.top + br.height / 2) - (sr.top + sr.height / 2);
}
document.addEventListener('selectionchange', () => {
  if (!typewriter) return;
  const blk = caretBlock();
  if (blk) {
    blockEls().forEach((b) => b.classList.remove('active'));
    blk.classList.add('active');
  }
});

/* ================= TITLE PAGE ================= */
function renderTitlePage() {
  const d = activeDoc(), v = $('#titlePageView');
  const tp = d ? d.title_page || {} : {};
  if (!d || !tp.show || d.doc_type !== 'screenplay') { v.hidden = true; v.innerHTML = ''; return; }
  v.hidden = false;
  v.innerHTML =
    `<div class="tp-title">${esc(tp.title || d.title || 'UNTITLED')}</div>` +
    (tp.credit ? `<div class="tp-credit">${esc(tp.credit)}</div>` : '') +
    (tp.author ? `<div>${esc(tp.author)}</div>` : '') +
    (tp.draft ? `<div class="tp-draft">${esc(tp.draft)}</div>` : '') +
    (tp.contact ? `<div class="tp-contact">${esc(tp.contact).replace(/\n/g, '<br>')}</div>` : '');
}
function openTitleModal() {
  const d = activeDoc(); if (!d) return;
  const tp = d.title_page || {};
  $('#tpTitle').value = tp.title || d.title || '';
  $('#tpCredit').value = tp.credit || 'written by';
  $('#tpAuthor').value = tp.author || '';
  $('#tpDraft').value = tp.draft || '';
  $('#tpContact').value = tp.contact || '';
  $('#tpShow').checked = tp.show !== false;
  $('#tpModal').hidden = false;
}
function saveTitleModal() {
  const d = activeDoc(); if (!d) return;
  d.title_page = {
    title: $('#tpTitle').value.trim(), credit: $('#tpCredit').value.trim(),
    author: $('#tpAuthor').value.trim(), draft: $('#tpDraft').value.trim(),
    contact: $('#tpContact').value.trim(), show: $('#tpShow').checked,
  };
  d.updated_at = Date.now();
  $('#tpModal').hidden = true;
  renderTitlePage(); scheduleSave();
  toast('Title page updated');
}

/* ================= NAVIGATOR ================= */
function renderNav() {
  const d = activeDoc(), list = $('#navList');
  if (!d || d.doc_type !== 'screenplay') {
    list.innerHTML = '<div class="nav-empty">Scene navigator appears for screenplays.</div>';
    return;
  }
  const scenes = [];
  blockEls().forEach((el) => { if (elType(el) === 'scene' && el.textContent.trim()) scenes.push(el); });
  if (!scenes.length) {
    list.innerHTML = '<div class="nav-empty">No scenes yet.<br>Type INT. or EXT. to start one.</div>';
    return;
  }
  list.innerHTML = '';
  scenes.forEach((el, i) => {
    const b = document.createElement('button');
    b.className = 'nav-item';
    b.textContent = (i + 1) + '. ' + el.textContent.trim().slice(0, 60);
    b.addEventListener('click', () => {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      placeCaret(el, 0);
    });
    list.appendChild(b);
  });
}

/* ================= STATS ================= */
function updateStats() {
  const d = activeDoc();
  let words = 0, units = 0;
  if (d) {
    d.content.blocks.forEach((b) => {
      const w = b.text.trim().split(/\s+/).filter(Boolean).length;
      words += w;
      if (d.doc_type === 'screenplay') units += Math.max(1, Math.ceil(b.text.length / 61));
      else units += Math.max(1, Math.ceil(b.text.length / 70));
    });
  }
  const perPage = d && d.doc_type === 'screenplay' ? 54 : 42;
  const pages = Math.max(d && d.content.blocks.length ? 1 : 0, Math.round(units / perPage));
  $('#statPages').textContent = pages + (pages === 1 ? ' page' : ' pages');
  $('#statWords').textContent = words.toLocaleString() + ' words';
  $('#statMins').textContent = '~' + pages + ' min';
}

/* ================= EXPORT ================= */
function toFountain(d) {
  const L = [];
  const tp = d.title_page || {};
  if (tp.show && d.doc_type === 'screenplay') {
    L.push('Title: ' + (tp.title || d.title || 'Untitled'));
    if (tp.credit) L.push('Credit: ' + tp.credit);
    if (tp.author) L.push('Author: ' + tp.author);
    if (tp.draft) L.push('Draft date: ' + tp.draft);
    if (tp.contact) L.push('Contact:\n' + tp.contact);
    L.push('');
  }
  d.content.blocks.forEach((b) => {
    const t = b.text.replace(/\s+$/, '');
    switch (b.el) {
      case 'scene': L.push(t.toUpperCase()); break;
      case 'character': L.push(t.toUpperCase()); break;
      case 'parenthetical': L.push(t.startsWith('(') ? t : '(' + t + ')'); break;
      case 'dialogue': L.push(t); break;
      case 'transition': L.push(t.toUpperCase().endsWith('TO:') || t.toUpperCase().endsWith('TO') ? t.toUpperCase() : '> ' + t.toUpperCase()); break;
      case 'shot': L.push(t.toUpperCase()); break;
      case 'section': L.push('# ' + t.replace(/[\[\]]/g, '')); break;
      case 'verse-title': case 'song-title': L.push('. ' + t); break;
      case 'stanza-break': L.push(''); break;
      default: L.push(t);
    }
    L.push('');
  });
  return L.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}
function toText(d) {
  const L = [];
  const tp = d.title_page || {};
  if (tp.show && (tp.title || d.title)) {
    L.push(tp.title || d.title, tp.credit || '', tp.author || '', tp.draft || '', '');
  }
  d.content.blocks.forEach((b) => {
    if (b.el === 'stanza-break') { L.push(''); return; }
    L.push(b.text);
  });
  return L.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}
function download(name, text, mime) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: mime }));
  a.download = name;
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 400);
}
function doExport(kind) {
  const d = activeDoc(); if (!d) return;
  const base = (d.title || 'untitled').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'untitled';
  if (kind === 'fountain') { download(base + '.fountain', toFountain(d), 'text/plain'); toast('Exported .fountain'); }
  else if (kind === 'txt') { download(base + '.txt', toText(d), 'text/plain'); toast('Exported .txt'); }
  else if (kind === 'pdf') { toast('Use your browser print dialog → Save as PDF'); setTimeout(() => window.print(), 600); }
  $('#exportMenu').hidden = true;
}

/* ================= LIBRARY ================= */
const TYPE_ICON = { screenplay: 'S', poem: 'P', song: '♪' };
function renderLibrary() {
  const list = $('#docList');
  if (!docs.length) {
    list.innerHTML = '<div class="lib-empty">Nothing here yet.<br>The deep is waiting.<br><br>Press + to begin.</div>';
    return;
  }
  list.innerHTML = '';
  docs.forEach((d) => {
    const b = document.createElement('button');
    b.className = 'doc-item' + (d.id === activeId ? ' active' : '');
    const dt = new Date(d.updated_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    b.innerHTML = `<span class="di">${TYPE_ICON[d.doc_type] || 'S'}</span><span class="dt"><b>${esc(d.title || 'Untitled')}</b><small>${d.doc_type} · ${dt}</small></span><span class="del" title="Delete">×</span>`;
    b.addEventListener('click', (e) => {
      if (e.target.classList.contains('del')) {
        e.stopPropagation();
        deleteDoc(d.id);
        return;
      }
      openDoc(d.id);
    });
    list.appendChild(b);
  });
}
function openDoc(id) {
  syncBlocksFromDOM();
  activeId = id;
  renderEditor();
  $('#paperScroll').scrollTop = 0;
}
async function newDoc(type) {
  syncBlocksFromDOM();
  const d = {
    id: uid(), title: 'Untitled ' + type.charAt(0).toUpperCase() + type.slice(1),
    doc_type: type, content: { blocks: [] }, title_page: { show: type === 'screenplay' },
    created_at: Date.now(), updated_at: Date.now(),
  };
  docs.unshift(d); activeId = d.id;
  persistCache(); setSync('saving');
  try { await api('/projects', 'POST', pack(d)); setSync('saved'); }
  catch (e) { setSync('offline'); }
  $('#newMenu').hidden = true;
  renderEditor();
  const first = blockEls()[0];
  if (first) placeCaret(first, 0);
  toast('New ' + type + ' — yours, free, unlimited');
}
async function deleteDoc(id) {
  const d = docs.find((x) => x.id === id);
  if (!d || !confirm('Delete "' + (d.title || 'Untitled') + '"? This cannot be undone.')) return;
  try {
    await api('/projects/' + id, 'DELETE');
  } catch (e) {
    toast("Couldn't reach the server — kept your document safe");
    return;
  }
  docs = docs.filter((x) => x.id !== id);
  if (activeId === id) activeId = docs.length ? docs[0].id : null;
  persistCache(); renderEditor();
  toast('Deleted');
}

/* ================= UI WIRING ================= */
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg; t.hidden = false;
  clearTimeout(toast._t); toast._t = setTimeout(() => { t.hidden = true; }, 2600);
}

function wire() {
  const ed = editor();
  ed.addEventListener('keydown', onKeyDown);
  ed.addEventListener('input', onInput);
  ed.addEventListener('paste', onPaste);
  ed.addEventListener('click', () => {
    hideSuggest(); updateHint();
    if (focusMode) {
      blockEls().forEach((b) => b.classList.remove('active'));
      const b = caretBlock(); if (b) b.classList.add('active');
    }
  });
  ed.addEventListener('keyup', () => { if (typewriter) centerCaret(); });

  $('#docTitle').addEventListener('input', (e) => {
    const d = activeDoc(); if (!d) return;
    d.title = e.target.value; d.updated_at = Date.now();
    scheduleSave(); renderLibrary();
  });

  $('#newDocBtn').addEventListener('click', (e) => {
    e.stopPropagation();
    $('#newMenu').hidden = !$('#newMenu').hidden;
  });
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#newMenu') && !e.target.closest('#newDocBtn')) $('#newMenu').hidden = true;
    if (!e.target.closest('.export-wrap')) $('#exportMenu').hidden = true;
  });
  document.querySelectorAll('#newMenu button').forEach((b) =>
    b.addEventListener('click', () => newDoc(b.dataset.newtype)));

  $('#exportBtn').addEventListener('click', (e) => {
    e.stopPropagation();
    $('#exportMenu').hidden = !$('#exportMenu').hidden;
  });
  document.querySelectorAll('#exportMenu button').forEach((b) =>
    b.addEventListener('click', () => doExport(b.dataset.exp)));

  $('#titlePageBtn').addEventListener('click', openTitleModal);
  $('#tpSave').addEventListener('click', saveTitleModal);
  $('#tpModal').addEventListener('click', (e) => { if (e.target.id === 'tpModal') $('#tpModal').hidden = true; });

  $('#navToggle').addEventListener('click', () => {
    const n = $('#navigator');
    n.hidden = !n.hidden;
    $('#navToggle').classList.toggle('on', !n.hidden);
    if (!n.hidden) renderNav();
  });
  $('#typewriterBtn').addEventListener('click', () => {
    typewriter = !typewriter;
    $('#typewriterBtn').classList.toggle('on', typewriter);
    if (typewriter) centerCaret();
    toast(typewriter ? 'Typewriter mode on' : 'Typewriter mode off');
  });
  $('#focusBtn').addEventListener('click', () => {
    focusMode = !focusMode;
    ed.classList.toggle('focus-mode', focusMode);
    $('#focusBtn').classList.toggle('on', focusMode);
    blockEls().forEach((b) => b.classList.remove('active'));
    toast(focusMode ? 'Focus mode on — only this paragraph' : 'Focus mode off');
  });
  $('#deskToggle').addEventListener('click', () => {
    const dk = $('#desk');
    dk.classList.toggle('desk-dark'); dk.classList.toggle('desk-light');
  });

  $('#shortcutsBtn').addEventListener('click', () => { $('#scModal').hidden = false; });
  $('#scClose').addEventListener('click', () => { $('#scModal').hidden = true; });
  $('#scModal').addEventListener('click', (e) => { if (e.target.id === 'scModal') $('#scModal').hidden = true; });

  $('#whyBtn').addEventListener('click', () => { $('#whyModal').hidden = false; });
  $('#whyClose').addEventListener('click', () => { $('#whyModal').hidden = true; });
  $('#whyModal').addEventListener('click', (e) => { if (e.target.id === 'whyModal') $('#whyModal').hidden = true; });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      ['#tpModal', '#scModal', '#whyModal', '#exportMenu', '#newMenu'].forEach((s) => { $(s).hidden = true; });
      hideSuggest();
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') { e.preventDefault(); $('#newMenu').hidden = false; }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'e') { e.preventDefault(); $('#exportMenu').hidden = !$('#exportMenu').hidden; }
  });

  window.addEventListener('online', () => { setSync('saving'); pushActive(); initialSync(); });
  window.addEventListener('offline', () => setSync('offline'));
}

/* ================= INIT ================= */
async function init() {
  deviceId = localStorage.getItem(LS_DEV);
  if (!deviceId) { deviceId = uid(); try { localStorage.setItem(LS_DEV, deviceId); } catch (e) {} }
  try { docs = JSON.parse(localStorage.getItem(LS_DOCS)) || []; } catch (e) { docs = []; }
  if (!docs.length) {
    docs = seedDocs();
    persistCache();
  }
  docs.sort((a, b) => b.updated_at - a.updated_at);
  activeId = docs[0].id;
  wire();
  renderEditor();
  initialSync().then(() => { renderEditor(); renderLibrary(); });
}

window.PulpStudio = {
  focus() { const b = blockEls()[0]; if (b && !b.textContent) placeCaret(b, 0); },
};

// deep-link: #studio skips the landing (used for testing/screenshots)
if (location.hash === '#studio') {
  const l = document.getElementById('landing');
  if (l) l.classList.add('gone');
  const s = document.getElementById('studio');
  if (s) { s.hidden = false; s.classList.add('on'); }
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
})();
