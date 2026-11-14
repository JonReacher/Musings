import * as THREE from 'three';
import { app, fmtFt, parseFt, polyArea, polyLength } from './core.js';
import { S, applySun, buildContext, bearingToWorld } from './scene.js';
import { E, on, emit, select, getItem, makeItem, addItem, updateItem, removeItem, duplicateItem, startDraw, cancelDraw, finishDraw, undoDrawPoint, startMeasure, stopMeasure, clearMeasures, undo, redo, commit, nudge, rotateSelected, clearances, itemStats, groundPoint, footprint, refreshGizmo } from './editor.js';
import { TYPES, CATEGORIES, defaultsOf } from './catalog.js';
import { SURFACES } from './models_items.js';
import { setView, flyTo, PHOTO_POSES, fitPhotoFov, focusItem, isTyping, refreshRoofs } from './views.js';
import { thumb } from './thumbs.js';
import { store, currentLayout, syncCurrent, switchLayout, newLayout, duplicateLayout, renameLayout, deleteLayout, exportLayouts, importLayouts, addExampleLayouts, saveSoon, canPersist } from './store.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const h = (tag, attrs = {}, ...kids) => {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'html') el.innerHTML = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat()) if (c !== null && c !== undefined && c !== false) el.append(c.nodeType ? c : document.createTextNode(c));
  return el;
};
const ICON = {
  eye: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="16" height="16"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>',
  eyeOff: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="16" height="16"><path d="M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4.1M6.3 6.3C3.6 8 2 12 2 12s3.5 7 10 7a9.6 9.6 0 0 0 4.4-1"/></svg>',
  lock: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="15" height="15"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>',
  close: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M6 6l12 12M18 6 6 18"/></svg>',
};
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DIRS = [['0', 'North'], ['45', 'Northeast'], ['90', 'East'], ['135', 'Southeast'], ['180', 'South'], ['225', 'Southwest'], ['270', 'West'], ['315', 'Northwest']];

let toastT;
export function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2200); }
function fmtTime(hr) { const H = Math.floor(hr), M = Math.round((hr - H) * 60); const ap = H >= 12 && H < 24 ? 'PM' : 'AM'; let h12 = H % 12; if (h12 === 0) h12 = 12; return `${h12}:${String(M).padStart(2, '0')} ${ap}`; }
const typeName = (it) => it.name || TYPES[it.type].name.replace(/^Draw (an? )?/, '').replace(/^./, (c) => c.toUpperCase());

export function initUI() {
  buildCatalog();
  renderInspector();
  buildPhotos();
  wireTopbar();
  wireKeys();
  wireDrop();
  on('select', () => { renderInspector(); updateHint(); });
  on('items', () => { renderInspector(); });
  on('itemChanged', () => renderInspectorSoft());
  on('dragging', () => renderInspectorSoft());
  on('commit', () => { syncCurrent(); updateUndo(); if (!app.selectedId) renderInspector(); });
  on('mode', () => { updateHint(); $('#measureBtn').classList.toggle('on', E.mode === 'measure'); });
  on('drawProgress', updateHint);
  on('view', (v) => { $$('.seg button[data-view]').forEach((b) => b.classList.toggle('on', b.dataset.view === v)); updateHint(); });
  on('layouts', () => { updateLayoutBtn(); renderInspector(); });
  on('cursor', (p) => {
    const el = $('#cursorpos');
    if (p.z < -1 || p.z > 50 || p.x < -11.5 || p.x > 40) { el.textContent = ''; return; }
    el.textContent = `${fmtFt(Math.max(0, p.z))} out from the house, ${fmtFt(Math.max(0, p.x + 11.5))} from the right fence`;
  });
  updateLayoutBtn();
  updateUndo();
  updateHint();
  updateTimeUI();
}

// ---------------- catalog ----------------
function buildCatalog() {
  const root = $('#cats');
  root.innerHTML = '';
  const openCat = (cat, open) => {
    cat.classList.toggle('open', open);
    if (open) $$('img[data-type]', cat).forEach(loadThumb);
  };
  CATEGORIES.forEach((c, idx) => {
    const types = Object.entries(TYPES).filter(([, t]) => t.cat === c.id);
    const tiles = h('div', { class: 'tiles' }, types.map(([id, t]) => tile(id, t)));
    const cat = h('div', { class: 'cat', 'data-cat': c.id },
      h('button', { 'aria-expanded': 'false', onclick: () => { const open = !cat.classList.contains('open'); $$('.cat', root).forEach((x) => openCat(x, false)); openCat(cat, open); cat.firstChild.setAttribute('aria-expanded', open); } },
        h('span', {}, c.name), h('span', { class: 'n' }, String(types.length))),
      tiles);
    root.append(cat);
    if (idx === 0) openCat(cat, true);
  });
  const results = h('div', { class: 'tiles', id: 'results' });
  root.prepend(results);
  $('#search').addEventListener('input', (ev) => {
    const q = ev.target.value.trim().toLowerCase();
    results.innerHTML = '';
    if (!q) { results.classList.remove('show'); $$('.cat', root).forEach((x) => (x.style.display = '')); return; }
    $$('.cat', root).forEach((x) => (x.style.display = 'none'));
    const words = q.split(/\s+/);
    const match = Object.entries(TYPES).filter(([id, t]) => !t.existingOnly && words.every((w) => (t.name + ' ' + (t.desc || '') + ' ' + id + ' ' + catName(t.cat)).toLowerCase().includes(w)));
    if (!match.length) results.append(h('div', { class: 'empty', style: 'grid-column: span 2' }, 'Nothing matches that. Try "fence", "path", "light" or "tree".'));
    match.forEach(([id, t]) => results.append(tile(id, t)));
    $$('img[data-type]', results).forEach(loadThumb);
    results.classList.add('show');
  });
}
const catName = (id) => (CATEGORIES.find((c) => c.id === id) || {}).name || '';
function tile(id, t) {
  const img = h('img', { class: 'thumb', alt: '', 'data-type': id, draggable: 'false' });
  const el = h('button', { class: 'tile', title: t.desc || t.name, draggable: t.kind === 'box' ? 'true' : 'false', onclick: () => addFromCatalog(id) },
    img, t.draw ? h('span', { class: 'draw' }, 'Draw') : null, h('span', { class: 'nm' }, t.name.replace(/^Draw (an? )?/, (m) => (t.draw ? '' : m)).replace(/^./, (c) => c.toUpperCase())));
  el.addEventListener('dragstart', (ev) => { ev.dataTransfer.setData('text/x-yard-type', id); ev.dataTransfer.effectAllowed = 'copy'; });
  return el;
}
function loadThumb(img) {
  if (img.dataset.loaded) return;
  img.dataset.loaded = '1';
  thumb(img.dataset.type, (url) => { if (url) img.src = url; });
}
function viewCenterGround() {
  const r = S.renderer.domElement.getBoundingClientRect();
  const p = groundPoint({ clientX: r.left + r.width / 2, clientY: r.top + r.height * 0.55 });
  let x = 14, z = 24;
  if (p) { x = p.x; z = p.z; }
  x = Math.max(-8, Math.min(36, x)); z = Math.max(13, Math.min(46, z));
  return [Math.round(x * 2) / 2, Math.round(z * 2) / 2];
}
function addFromCatalog(type, at) {
  const t = TYPES[type];
  if (t.kind !== 'box') { if (S.camMode === 'photo' || S.camMode === 'walk') setView('orbit'); startDraw(type); return; }
  const [x, z] = at || viewCenterGround();
  const it = makeItem(type, { x, z });
  addItem(it);
  toast(`Added ${t.name.toLowerCase()}. Drag it where you want it.`);
}
function wireDrop() {
  const stage = $('#stage');
  stage.addEventListener('dragover', (ev) => { if ([...ev.dataTransfer.types].includes('text/x-yard-type')) { ev.preventDefault(); ev.dataTransfer.dropEffect = 'copy'; } });
  stage.addEventListener('drop', (ev) => {
    const type = ev.dataTransfer.getData('text/x-yard-type');
    if (!type) return;
    ev.preventDefault();
    const p = groundPoint(ev);
    if (p) addFromCatalog(type, [Math.round(p.x * 2) / 2, Math.round(p.z * 2) / 2]);
  });
}

// ---------------- inspector ----------------
let softPending = false;
function renderInspectorSoft() {
  if (softPending) return;
  softPending = true;
  requestAnimationFrame(() => {
    softPending = false;
    const it = getItem(app.selectedId);
    const ins = $('#inspector');
    const ae = document.activeElement;
    if (!it || (ins.contains(ae) && (ae.tagName === 'INPUT' || ae.tagName === 'SELECT'))) { if (it) updateSizeReadout(it); return; }
    renderInspector();
  });
}
function updateSizeReadout(it) {
  const el = $('#sizebig');
  if (el) el.firstChild.textContent = sizeText(it);
}
function sizeText(it) {
  const t = TYPES[it.type];
  if (t.kind === 'area') return `${Math.round(polyArea(it.pts))} sq ft`;
  if (t.kind === 'poly') return `${fmtFt(polyLength(it.pts))} long`;
  if (t.resize === 'diam') return `⌀ ${fmtFt(it.w)}`;
  return `${fmtFt(it.w)} × ${fmtFt(it.d)}`;
}
function renderInspector() {
  const ins = $('#inspector');
  const it = getItem(app.selectedId);
  const scrollTop = ins.querySelector('.scroll')?.scrollTop || 0;
  ins.innerHTML = '';
  if (!it) { renderOverview(ins); return; }
  const t = TYPES[it.type];
  const body = h('div', { class: 'scroll' });
  ins.append(
    h('div', { class: 'ins-h' },
      h('div', { class: 'names' },
        h('input', { class: 'name', value: typeName(it), 'aria-label': 'Name', onchange: (ev) => { updateItem(it.id, { name: ev.target.value.trim() || undefined }, { rebuild: false, c: true }); } }),
        h('div', { class: 'type' }, it.existing ? 'Part of your yard today' : catName(t.cat) + (t.kind !== 'box' ? ', drawn' : ''))),
      h('button', { class: 'btn', title: 'Deselect (Esc)', 'aria-label': 'Close', html: ICON.close, onclick: () => select(null) })),
    body);
  body.append(h('div', { class: 'sizebig', id: 'sizebig' }, sizeText(it), h('small', {}, t.kind === 'box' && it.h && t.hEditable ? `${fmtFt(it.h)} tall` : '')));
  if (it.locked) {
    body.append(h('div', { class: 'note' }, it.type === 'house' ? 'Your house is fixed in place. Everything is measured from its back wall.' : 'This is part of your yard as it is today, so it is locked to keep it from moving by accident. Unlock it to adjust its size or position.'));
    if (it.type !== 'house') body.append(h('div', { class: 'actions' }, h('button', { class: 'btn outline', onclick: () => updateItem(it.id, { locked: false }, { rebuild: false, c: true }) }, 'Unlock'), h('button', { class: 'btn outline', onclick: () => toggleHidden(it) }, it.hidden ? 'Show' : 'Hide')));
    return;
  }
  // size
  const sz = h('div', { class: 'sect' }, h('h3', {}, 'Size and placement'));
  const dims = h('div', { class: 'dims' });
  const dimField = (label, key, val) => h('label', {}, label, h('input', { class: 'field', value: fmtFt(val), 'aria-label': label, onchange: (ev) => setDim(it, key, ev.target), onkeydown: (ev) => { if (ev.key === 'Enter') ev.target.blur(); } }));
  if (t.kind === 'box') {
    if (t.resize === 'diam') dims.append(dimField('Diameter', 'diam', it.w));
    else if (t.resize === 'wd' || t.resize === 'w') { dims.append(dimField(t.resize === 'w' ? 'Length' : 'Width', 'w', it.w)); if (t.resize === 'wd') dims.append(dimField('Depth', 'd', it.d)); }
    if (t.hEditable) dims.append(dimField('Height', 'h', it.h));
  } else {
    if (t.wEditable) dims.append(dimField('Width', 'w', it.w));
    if (t.hEditable) dims.append(dimField('Height', 'h', it.h));
  }
  if (dims.children.length) sz.append(dims);
  if (!t.noRotate) {
    if (t.kind === 'box') {
      const deg = Math.round((((it.rot || 0) * 180) / Math.PI % 360 + 360) % 360);
      sz.append(h('div', { class: 'row' }, h('label', {}, 'Rotation'), h('div', { class: 'ctl' },
        h('button', { class: 'btn outline', title: 'Rotate 15° left (Shift+R)', 'aria-label': 'Rotate 15° left', onclick: () => rotateSelected(-15) }, '⟲'),
        h('input', { class: 'field', value: deg + '°', 'aria-label': 'Rotation in degrees', style: 'text-align:center', onchange: (ev) => { const v = parseFloat(ev.target.value); if (!isNaN(v)) updateItem(it.id, { rot: (v * Math.PI) / 180 }, { rebuild: false, c: true }); } }),
        h('button', { class: 'btn outline', title: 'Rotate 15° right (R)', 'aria-label': 'Rotate 15° right', onclick: () => rotateSelected(15) }, '⟳'))));
    } else {
      sz.append(h('div', { class: 'row' }, h('label', {}, 'Turn'), h('div', { class: 'ctl' },
        h('button', { class: 'btn outline', onclick: () => rotateSelected(-15) }, '⟲ 15°'),
        h('button', { class: 'btn outline', onclick: () => rotateSelected(15) }, '⟳ 15°'))));
    }
  }
  body.append(sz);
  // options
  if (t.params && t.params.length) {
    const op = h('div', { class: 'sect' }, h('h3', {}, 'Options'));
    for (const p of t.params) op.append(paramRow(it, p));
    body.append(op);
  }
  // clearances
  const cl = clearances(it);
  if (cl.length) {
    const box = h('div', { class: 'clear' });
    for (const [k, d] of cl) box.append(h('span', {}, k), h('span', {}, d < 0.05 ? 'touching' : fmtFt(d)));
    body.append(h('div', { class: 'sect' }, h('h3', {}, 'Distance to'), box));
  }
  if (t.desc && t.kind === 'box') body.append(h('div', { class: 'note' }, t.desc));
  body.append(h('div', { class: 'actions' },
    h('button', { class: 'btn outline', onclick: () => duplicateItem(it.id), title: 'Ctrl+D' }, 'Duplicate'),
    h('button', { class: 'btn outline', onclick: () => focusItem(it), title: 'F' }, 'Zoom to'),
    h('button', { class: 'btn outline', onclick: () => { updateItem(it.id, { locked: true }, { rebuild: false, c: true }); } }, 'Lock'),
    h('button', { class: 'btn outline danger', onclick: () => removeItem(it.id), title: 'Delete' }, 'Remove')));
  const sc = ins.querySelector('.scroll'); if (sc) sc.scrollTop = scrollTop;
}
function setDim(it, key, input) {
  const t = TYPES[it.type];
  let v = parseFt(input.value);
  if (isNaN(v) || v <= 0) { input.value = fmtFt(key === 'diam' ? it.w : it[key]); toast('Use feet and inches, like 12\' 6" or 12.5'); return; }
  const min = { w: 0.5, d: 0.5, h: 0.2, ...(t.min || {}) }, max = { w: 120, d: 120, h: 60, ...(t.max || {}) };
  const k = key === 'diam' ? 'w' : key;
  v = Math.max(min[k], Math.min(max[k], v));
  const patch = key === 'diam' ? { w: v, d: v } : { [key]: v };
  updateItem(it.id, patch, { c: true });
  renderInspector();
}
function paramRow(it, p) {
  const val = it.p[p.key] ?? p.def;
  const set = (v, commitNow = true) => { updateItem(it.id, { p: { [p.key]: v } }, { c: commitNow }); };
  let ctl;
  if (p.type === 'select') {
    const short = p.options.length <= 3 && p.options.every(([, l]) => l.length <= 11);
    if (short) {
      ctl = h('div', { class: 'seg' }, p.options.map(([v, l]) => h('button', { class: v === val ? 'on' : '', onclick: () => { set(v); renderInspector(); } }, l)));
    } else {
      ctl = h('select', { class: 'field', 'aria-label': p.label, onchange: (ev) => set(ev.target.value) }, p.options.map(([v, l]) => h('option', { value: v, selected: v === val }, l)));
    }
  } else if (p.type === 'toggle') {
    ctl = h('button', { class: 'switch' + (val ? ' on' : ''), role: 'switch', 'aria-checked': String(!!val), 'aria-label': p.label, onclick: (ev) => { set(!val); renderInspector(); } });
  } else if (p.type === 'range') {
    const out = h('span', { class: 'rv' }, `${val}${p.unit ? (p.unit === '°' ? '°' : ' ' + p.unit) : ''}`);
    let tmr;
    ctl = h('div', { class: 'ctl' }, h('input', { type: 'range', min: p.min, max: p.max, step: p.step, value: val, 'aria-label': p.label,
      oninput: (ev) => { const v = parseFloat(ev.target.value); out.textContent = `${v}${p.unit ? (p.unit === '°' ? '°' : ' ' + p.unit) : ''}`; clearTimeout(tmr); tmr = setTimeout(() => updateItem(it.id, { p: { [p.key]: v } }), 60); },
      onchange: (ev) => { clearTimeout(tmr); set(parseFloat(ev.target.value)); } }), out);
  } else if (p.type === 'swatch') {
    ctl = h('div', { class: 'swatches' }, p.options.map(([v, l]) => h('button', { class: 'sw' + (v === val ? ' on' : ''), title: l, 'aria-label': l, style: `background:${v}`, onclick: () => { set(v); renderInspector(); } })));
  }
  return h('div', { class: 'row' }, h('label', {}, p.label), h('div', { class: 'ctl' }, ctl));
}
function toggleHidden(it) { updateItem(it.id, { hidden: !it.hidden }, { rebuild: false, c: true }); refreshGizmo(); renderInspector(); }

function renderOverview(ins) {
  const L = currentLayout();
  const added = app.items.filter((i) => !i.existing);
  const existing = app.items.filter((i) => i.existing);
  const body = h('div', { class: 'scroll' });
  ins.append(h('div', { class: 'panel-h' }, h('h2', {}, L ? L.name.replace(/^Idea: (.)/, (m, c) => c.toUpperCase()) : 'Layout'), L && L.desc ? h('p', { style: 'color:var(--bark);margin-top:5px' }, L.desc) : null, h('p', {}, added.length ? `${added.length} added item${added.length === 1 ? '' : 's'}. Click one to edit it.` : 'Nothing added yet. Pick something on the left to start.')), body);
  const row = (it) => {
    const t = TYPES[it.type];
    const s = t.kind === 'area' ? `${Math.round(polyArea(it.pts))} sq ft` : t.kind === 'poly' ? fmtFt(polyLength(it.pts)) : t.resize === 'diam' ? '⌀ ' + fmtFt(it.w) : t.resize === 'none' ? '' : `${fmtFt(it.w)} × ${fmtFt(it.d)}`;
    return h('div', { class: 'li' + (it.hidden ? ' hid' : ''), onclick: () => select(it.id) },
      it.locked ? h('span', { html: ICON.lock, style: 'color:var(--moss);display:flex' }) : null,
      h('span', { class: 't' }, typeName(it)), h('span', { class: 's' }, s),
      h('button', { title: it.hidden ? 'Show' : 'Hide', 'aria-label': it.hidden ? 'Show' : 'Hide', html: it.hidden ? ICON.eyeOff : ICON.eye, onclick: (ev) => { ev.stopPropagation(); toggleHidden(it); } }));
  };
  if (added.length) body.append(h('div', { class: 'sect' }, h('h3', {}, 'In this layout'), h('div', { class: 'list', style: 'padding:0' }, added.map(row))));
  body.append(totalsSection(added));
  body.append(h('div', { class: 'sect' }, h('h3', {}, 'Your yard today'), h('div', { class: 'list', style: 'padding:0' }, existing.map(row))));
  body.append(h('div', { class: 'note' }, 'Measured from your photos and your 29 × 10 ft patio, so the fence lines, shed and patio roof are close estimates. Unlock any of them to nudge it into place.'));
  if (store.layouts.length > 1 && !added.length) body.prepend(h('div', { class: 'note', style: 'border-style:solid;color:var(--bark)' }, `There ${store.layouts.length === 2 ? 'is 1 more layout' : 'are ' + (store.layouts.length - 1) + ' more layouts'} in the layout menu at the top left, including example ideas to pull apart and remix.`));
}
function totalsSection(added) {
  const sum = { hard: 0, gravel: 0, mulch: 0, turf: 0, fence: 0, lights: 0, plantsArea: 0, footprint: 0 };
  const hardKeys = ['pavers', 'slab', 'brick', 'flagstone', 'concrete', 'deck', 'stepping'];
  for (const it of added) {
    if (it.hidden) continue;
    const t = TYPES[it.type];
    const st = itemStats(it);
    const mat = it.p?.material || it.p?.ground || it.p?.pad;
    const area = t.kind === 'poly' ? (it.w || 0) * polyLength(it.pts) : st.area || 0;
    if (['surface_pad', 'walkway', 'walk_path', 'grill_pad', 'creek', 'surface_area', 'flower_bed', 'planting_bed', 'rock_garden', 'deck'].includes(it.type) || it.type === 'fire_pit' || it.type === 'dog_run') {
      const m = it.type === 'deck' ? 'deck' : it.type === 'creek' ? 'river_rock' : mat;
      let a = area;
      if (it.type === 'fire_pit') a = it.p.pad && it.p.pad !== 'none' ? Math.PI * (it.w / 2) ** 2 : 0;
      if (it.type === 'dog_run' && (!mat || mat === 'none')) a = 0;
      if (!m || m === 'none') continue;
      if (hardKeys.some((k) => m.startsWith(k))) sum.hard += a;
      else if (m.startsWith('gravel') || m === 'dg' || m === 'river_rock' || m === 'lava' || m === 'sand') sum.gravel += a;
      else if (m.startsWith('mulch') || m === 'soil') sum.mulch += a;
      else if (m === 'turf' || m === 'sod') sum.turf += a;
    }
    if (it.type === 'fence_line') sum.fence += polyLength(it.pts);
    if (it.type === 'dog_run' || it.type === 'privacy_area') sum.fence += 2 * (it.w + it.d);
    if (it.type === 'string_lights') sum.lights += polyLength(it.pts);
  }
  const box = h('div', { class: 'totals' });
  const add = (k, v) => box.append(h('span', {}, k), h('span', {}, v));
  if (sum.hard) add('Paving & decking', `${Math.round(sum.hard)} sq ft`);
  if (sum.gravel) add('Gravel & rock (3" deep)', `${Math.round(sum.gravel)} sq ft, ${(sum.gravel * 0.25 / 27).toFixed(1)} cu yd`);
  if (sum.mulch) add('Mulch & soil (3" deep)', `${Math.round(sum.mulch)} sq ft, ${(sum.mulch * 0.25 / 27).toFixed(1)} cu yd`);
  if (sum.turf) add('Turf or sod', `${Math.round(sum.turf)} sq ft`);
  if (sum.fence) add('New fencing', `${Math.round(sum.fence)} linear ft`);
  if (sum.lights) add('String lights', `${Math.round(sum.lights * 1.15)} ft with sag`);
  if (!box.children.length) return h('div', {});
  return h('div', { class: 'sect' }, h('h3', {}, 'Materials, roughly'), box);
}

// ---------------- hint bar ----------------
function updateHint() {
  const el = $('#hint');
  el.innerHTML = '';
  const k = (s) => `<span class="k">${s}</span>`;
  if (E.mode === 'draw') {
    const t = TYPES[E.draw.type];
    const n = E.draw.pts.length;
    el.append(h('span', { html: `<b>${t.name.replace(/^Draw /, 'Drawing ')}.</b> ${n ? 'Keep clicking to add points, then double-click or press ' + k('Enter') + ' to finish.' : 'Click on the ground to place the first point.'} ${k('Shift')} keeps 45° angles.` }));
    if (n >= (t.kind === 'area' ? 3 : 2)) el.append(h('button', { onclick: finishDraw }, 'Finish'));
    el.append(h('button', { onclick: () => cancelDraw() }, 'Cancel'));
    return;
  }
  if (E.mode === 'measure') {
    el.append(h('span', { html: `<b>Measuring.</b> Click two points. ${k('Shift')} keeps 45° angles.` }), h('button', { onclick: clearMeasures }, 'Clear'), h('button', { onclick: stopMeasure }, 'Done'));
    return;
  }
  if (S.camMode === 'walk') { el.innerHTML = `<span><b>Walking.</b> ${k('W')}${k('A')}${k('S')}${k('D')} to move, drag to look around, scroll to step.</span>`; return; }
  if (S.camMode === 'photo') { el.innerHTML = ''; return; }
  const it = getItem(app.selectedId);
  if (it && !it.locked) {
    const t = TYPES[it.type];
    if (t.kind === 'box') el.innerHTML = `<span>Drag to move. Gold handles resize${t.noRotate ? '' : ', the white ring rotates'}. ${k('R')} turns 15°, ${k('Del')} removes, hold ${k('Alt')} to skip snapping.</span>`;
    else el.innerHTML = `<span>Drag the gold points to reshape. Drag a faint midpoint to add a point, double-click a point to remove it.</span>`;
    return;
  }
  el.innerHTML = '';
}

// ---------------- top bar ----------------
function updateLayoutBtn() { const L = currentLayout(); $('#layoutBtn span').textContent = L ? L.name : 'Layout'; }
function updateUndo() { $('#undoBtn').disabled = E.hIndex <= 0; $('#redoBtn').disabled = E.hIndex >= E.history.length - 1; }
function closeMenus() { $$('.menu').forEach((m) => m.classList.remove('open')); }
function openMenu(menu, anchor) {
  const was = menu.classList.contains('open');
  closeMenus();
  if (was) return;
  const r = anchor.getBoundingClientRect();
  menu.classList.add('open');
  const mw = menu.offsetWidth;
  menu.style.top = r.bottom + 6 + 'px';
  menu.style.left = Math.max(8, Math.min(window.innerWidth - mw - 8, r.left)) + 'px';
}
function buildLayoutMenu() {
  const m = $('#layoutMenu');
  m.innerHTML = '';
  const entry = (L) => h('button', { class: 'mi' + (L.id === store.currentId ? ' cur' : ''), role: 'menuitem', title: L.desc || '', onclick: () => { closeMenus(); switchLayout(L.id); toast(`Switched to ${L.name}`); } }, h('span', { class: 'tick' }, L.id === store.currentId ? '✓' : ''), L.name.replace(/^Idea: /, ''));
  const mine = store.layouts.filter((l) => !l.ex), ideas = store.layouts.filter((l) => l.ex);
  if (mine.length) { m.append(h('div', { class: 'mh' }, 'Your layouts')); mine.forEach((L) => m.append(entry(L))); }
  if (ideas.length) { m.append(h('div', { class: 'mh' }, 'Example ideas')); ideas.forEach((L) => m.append(entry(L))); }
  m.append(h('hr'));
  const mi = (label, fn) => m.append(h('button', { class: 'mi', role: 'menuitem', onclick: () => { closeMenus(); fn(); } }, h('span', { class: 'tick' }), label));
  mi('New layout from the yard as it is', () => { newLayout(); toast('New layout started'); });
  mi('Duplicate this layout', () => { duplicateLayout(); toast('Copied. Changes here won’t touch the original.'); });
  mi('Rename this layout…', () => promptRename());
  mi('Delete this layout', () => { if (store.layouts.length < 2) { toast('Keep at least one layout'); return; } const name = currentLayout().name; if (confirm(`Delete “${name}”? This can’t be undone.`)) { deleteLayout(); toast(`Deleted ${name}`); } });
  m.append(h('hr'));
  mi('Export layouts to a file', () => { exportLayouts(); toast('Saved backyard-layouts.json'); });
  mi('Import layouts from a file', () => $('#importFile').click());
  mi('Bring back deleted example ideas', () => { const n = addExampleLayouts(); toast(n ? `Brought back ${n} example idea${n === 1 ? '' : 's'}` : 'All the example ideas are already here'); });
  if (!canPersist()) m.append(h('div', { class: 'mh' }, 'This browser is blocking storage, so export your layouts to keep them.'));
}
function promptRename() {
  const L = currentLayout();
  const name = prompt('Name this layout', L.name);
  if (name) renameLayout(name);
}
function buildViewsMenu() {
  const m = $('#viewsMenu');
  m.innerHTML = '';
  const mi = (label, fn) => m.append(h('button', { class: 'mi', role: 'menuitem', onclick: () => { closeMenus(); fn(); } }, label));
  mi('Overview', () => flyTo('overview'));
  mi('Standing on the patio', () => flyTo('patio'));
  mi('From the back fence', () => flyTo('back'));
  mi('From the left side', () => flyTo('left'));
  m.append(h('hr'));
  mi('Walk from the back door', () => setView('walk', { pos: [15, 5.4, 2], yaw: 0 }));
  mi('Top-down plan', () => setView('plan'));
}
function buildSettings() {
  const m = $('#settingsPop');
  const st = app.settings;
  m.innerHTML = '';
  const row = (label, ctl) => m.append(h('div', { class: 'row' }, h('label', {}, label), h('div', { class: 'ctl' }, ctl)));
  const seg = (key, opts) => h('div', { class: 'seg' }, opts.map(([v, l]) => h('button', { class: st[key] === v ? 'on' : '', onclick: () => { st[key] = v; applySettings(); buildSettings(); } }, l)));
  m.append(h('div', { style: 'font-weight:700;font-size:14px;margin-bottom:6px' }, 'Sun, season and display'));
  row('Month', h('select', { class: 'field', onchange: (ev) => { st.month = +ev.target.value; applySettings(); } }, MONTHS.map((n, i) => h('option', { value: i + 1, selected: st.month === i + 1 }, n))));
  row('Yard faces', h('select', { class: 'field', onchange: (ev) => { st.facing = +ev.target.value; applySettings(); } }, DIRS.map(([v, l]) => h('option', { value: v, selected: String(st.facing) === v }, l))));
  m.append(h('div', { style: 'color:var(--moss);font-size:11.5px;margin:-2px 0 8px' }, 'The direction you look standing on the patio. It sets where the sun and shade fall.'));
  row('Latitude', h('input', { class: 'field', type: 'number', min: -60, max: 60, step: 1, value: st.lat, onchange: (ev) => { const v = parseFloat(ev.target.value); if (!isNaN(v)) { st.lat = Math.max(-66, Math.min(66, v)); applySettings(); } } }));
  row('Lights', seg('lightsMode', [['auto', 'Dusk'], ['on', 'On'], ['off', 'Off']]));
  row('Lawn', seg('lawn', [['asis', 'Today'], ['healthy', 'Healthy'], ['lush', 'Lush']]));
  row('Neighbors', h('button', { class: 'switch' + (st.neighbors ? ' on' : ''), role: 'switch', 'aria-checked': String(!!st.neighbors), onclick: () => { st.neighbors = !st.neighbors; buildContext(st.neighbors); buildSettings(); saveSoon(); } }));
  row('Shadows', h('button', { class: 'switch' + (st.shadows !== false ? ' on' : ''), role: 'switch', 'aria-checked': String(st.shadows !== false), onclick: () => { st.shadows = st.shadows === false; S.sun.castShadow = st.shadows !== false; buildSettings(); saveSoon(); } }));
}
export function applySettings() {
  applySun(app.settings);
  updateTimeUI();
  saveSoon();
}
function updateTimeUI() {
  const st = app.settings;
  $('#timeRange').value = st.hour;
  $('#timeVal').textContent = fmtTime(st.hour);
  const night = st.hour < 6.5 || st.hour > 19;
  $('#sunIcon').innerHTML = night ? '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z"/>' : '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>';
  $('#nightBtn').textContent = st.hour >= 19 || st.hour < 6 ? 'Daytime' : 'Evening';
}
function wireTopbar() {
  $('#layoutBtn').addEventListener('click', (ev) => { buildLayoutMenu(); openMenu($('#layoutMenu'), ev.currentTarget); });
  $('#viewsBtn').addEventListener('click', (ev) => { buildViewsMenu(); openMenu($('#viewsMenu'), ev.currentTarget); });
  $('#settingsBtn').addEventListener('click', (ev) => { buildSettings(); openMenu($('#settingsPop'), ev.currentTarget); const p = $('#settingsPop'); p.style.left = Math.min(window.innerWidth - p.offsetWidth - 10, ev.currentTarget.getBoundingClientRect().right - p.offsetWidth) + 'px'; });
  document.addEventListener('pointerdown', (ev) => { if (!ev.target.closest('.menu') && !ev.target.closest('#layoutBtn,#viewsBtn,#settingsBtn')) closeMenus(); });
  $('#undoBtn').addEventListener('click', undo);
  $('#redoBtn').addEventListener('click', redo);
  $$('.seg button[data-view]').forEach((b) => b.addEventListener('click', () => { if (E.mode === 'draw' && b.dataset.view === 'walk') cancelDraw(); setView(b.dataset.view); }));
  $('#timeRange').addEventListener('input', (ev) => { app.settings.hour = parseFloat(ev.target.value); applySettings(); });
  $('#nightBtn').addEventListener('click', () => { const st = app.settings; st.hour = st.hour >= 19 || st.hour < 6 ? 14 : 20.5; applySettings(); });
  $('#shotBtn').addEventListener('click', saveImage);
  $('#helpBtn').addEventListener('click', showHelp);
  $('#measureBtn').addEventListener('click', () => (E.mode === 'measure' ? stopMeasure() : startMeasure()));
  const snaps = [[0.5, 'Snap 6"'], [1, 'Snap 1 ft'], [0.25, 'Snap 3"'], [0, 'Snap off']];
  const sb = $('#snapBtn');
  const setSnap = () => { const cur = snaps.find(([v]) => v === E.snap) || snaps[0]; sb.textContent = cur[1]; sb.classList.toggle('on', E.snap === 0); };
  sb.addEventListener('click', () => { const i = snaps.findIndex(([v]) => v === E.snap); E.snap = snaps[(i + 1) % snaps.length][0]; setSnap(); toast(E.snap ? `Snapping to ${fmtFt(E.snap, { short: true })}` : 'Snapping off'); });
  setSnap();
  $('#gridBtn').addEventListener('click', toggleGrid);
  $('#gridBtn').classList.toggle('on', !!app.settings.grid);
  $('#photosBtn').addEventListener('click', () => { document.body.classList.toggle('photos-open'); $('#photosBtn').classList.toggle('on', document.body.classList.contains('photos-open')); });
  $('#importFile').addEventListener('change', async (ev) => {
    const f = ev.target.files[0]; if (!f) return;
    try { const n = importLayouts(await f.text()); toast(`Imported ${n} layout${n === 1 ? '' : 's'}`); } catch (e) { toast(e.message || 'That file isn’t a layouts file'); }
    ev.target.value = '';
  });
  $('#modal').addEventListener('click', (ev) => { if (ev.target.id === 'modal') $('#modal').classList.remove('open'); });
}
function toggleGrid() { app.settings.grid = !app.settings.grid; S.grid.visible = S.camMode === 'plan' || app.settings.grid; $('#gridBtn').classList.toggle('on', app.settings.grid); saveSoon(); }
function saveImage() {
  const L = currentLayout();
  const prevSel = app.selectedId;
  select(null);
  requestAnimationFrame(() => requestAnimationFrame(() => {
    const url = S.renderer.domElement.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url; a.download = `${(L ? L.name : 'backyard').replace(/[^\w\- ]+/g, '').trim() || 'backyard'}.png`;
    a.click();
    if (prevSel) select(prevSel);
    toast('Saved a picture of this view');
  }));
}
function showHelp() {
  const c = $('#modalCard');
  const rows = [
    ['Click an item', 'Select it to see its options and size'],
    ['Drag an item', 'Move it (snaps to the grid; hold <kbd>Alt</kbd> for free placement)'],
    ['Gold handles', 'Resize from that edge; the white ring rotates'],
    ['Drawn items', 'Drag points to reshape; drag a faint midpoint to add one; double-click a point to remove it'],
    ['<kbd>R</kbd> / <kbd>Shift</kbd>+<kbd>R</kbd>', 'Rotate 15° right / left'],
    ['Arrow keys', 'Nudge 6 in (hold <kbd>Shift</kbd> for 2 ft)'],
    ['<kbd>Ctrl</kbd>+<kbd>D</kbd>', 'Duplicate'],
    ['<kbd>Delete</kbd>', 'Remove the selected item'],
    ['<kbd>Ctrl</kbd>+<kbd>Z</kbd> / <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>Z</kbd>', 'Undo / redo'],
    ['<kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd>', '3D, plan and walk views'],
    ['<kbd>M</kbd>', 'Measure between two points'],
    ['<kbd>G</kbd>', 'Show the 1 ft grid'],
    ['<kbd>F</kbd>', 'Zoom to the selected item'],
    ['<kbd>Esc</kbd>', 'Deselect, or stop drawing or measuring'],
    ['Mouse in 3D', 'Drag empty ground to orbit, right-drag to pan, scroll to zoom'],
  ];
  c.innerHTML = '';
  c.append(h('h2', {}, 'Getting around'),
    h('p', {}, 'Left and right mean as seen standing on your patio looking out. Your layouts save in this browser as you go; use Export in the layout menu to keep a copy or move them to another computer.'),
    h('table', {}, rows.map(([a, b]) => h('tr', {}, h('td', { html: a }), h('td', { html: b })))),
    h('div', { style: 'margin-top:16px;text-align:right' }, h('button', { class: 'btn solid', onclick: () => $('#modal').classList.remove('open') }, 'Got it')));
  $('#modal').classList.add('open');
}

// ---------------- photos ----------------
let photoList = [];
export function setPhotos(list) { photoList = list; buildPhotos(); const b = document.getElementById('photosBtn'); if (b) b.style.display = list.length ? '' : 'none'; }
function buildPhotos() {
  const strip = $('#strip');
  if (!strip) return;
  strip.innerHTML = '';
  for (const p of photoList) {
    const pose = PHOTO_POSES[p.id];
    strip.append(h('button', { title: pose ? pose.label : 'Photo', 'data-id': p.id, onclick: () => enterPhoto(p) }, h('img', { src: p.thumb, alt: pose ? pose.label : 'Yard photo' })));
  }
}
function enterPhoto(p) {
  if (!PHOTO_POSES[p.id]) return;
  cancelDraw(); stopMeasure();
  setView('photo', { photo: p.id });
  $('#photoOverlay img').src = p.src;
  $('#photoLabel').textContent = PHOTO_POSES[p.id].label;
  $$('#strip button').forEach((b) => b.classList.toggle('on', b.dataset.id === p.id));
  layoutPhotoOverlay();
}
export function layoutPhotoOverlay() {
  if (S.camMode !== 'photo') return;
  const { boxW, boxH } = fitPhotoFov();
  const ov = $('#photoOverlay');
  const W = S.container.clientWidth, H = S.container.clientHeight;
  Object.assign(ov.style, { width: boxW + 'px', height: boxH + 'px', left: (W - boxW) / 2 + 'px', top: (H - boxH) / 2 + 'px', opacity: $('#photoOpacity').value });
}
document.addEventListener('DOMContentLoaded', () => {});
export function wirePhotoBar() {
  $('#photoOpacity').addEventListener('input', (ev) => { $('#photoOverlay').style.opacity = ev.target.value; });
  $('#photoExit').addEventListener('click', () => { setView('orbit'); $$('#strip button').forEach((b) => b.classList.remove('on')); });
}

// ---------------- keyboard ----------------
function wireKeys() {
  window.addEventListener('keydown', (ev) => {
    if (isTyping(ev)) return;
    const mod = ev.ctrlKey || ev.metaKey;
    const k = ev.key;
    if (mod && (k === 'z' || k === 'Z')) { ev.preventDefault(); ev.shiftKey ? redo() : undo(); return; }
    if (mod && (k === 'y' || k === 'Y')) { ev.preventDefault(); redo(); return; }
    if (mod && (k === 'd' || k === 'D')) { ev.preventDefault(); if (app.selectedId) duplicateItem(app.selectedId); return; }
    if (mod) return;
    if (E.mode === 'draw') {
      if (k === 'Escape') cancelDraw();
      else if (k === 'Enter') finishDraw();
      else if (k === 'Backspace' || k === 'Delete') { ev.preventDefault(); undoDrawPoint(); }
      return;
    }
    if (E.mode === 'measure' && k === 'Escape') { stopMeasure(); return; }
    if (k === 'Escape') { closeMenus(); $('#modal').classList.remove('open'); if (S.camMode === 'photo' || S.camMode === 'walk') setView('orbit'); else select(null); return; }
    if (k === 'Delete' || k === 'Backspace') { const it = getItem(app.selectedId); if (it && !it.locked) { ev.preventDefault(); removeItem(it.id); } return; }
    if (k === 'r' || k === 'R') { rotateSelected(ev.shiftKey ? -15 : 15); return; }
    if (k === 'f' || k === 'F') { focusItem(getItem(app.selectedId)); return; }
    if (k === 'm' || k === 'M') { E.mode === 'measure' ? stopMeasure() : startMeasure(); return; }
    if (k === 'g' || k === 'G') { toggleGrid(); return; }
    if (k === '1') setView('orbit'); if (k === '2') setView('plan'); if (k === '3') setView('walk');
    if (k.startsWith('Arrow') && app.selectedId && S.camMode !== 'walk') {
      ev.preventDefault();
      const st = ev.shiftKey ? 2 : 0.5;
      // nudge relative to the screen: up = away from camera
      const cam = S.camera;
      const f = new THREE.Vector3(); cam.getWorldDirection(f); f.y = 0;
      if (cam.isOrthographicCamera || f.lengthSq() < 1e-4) f.set(0, 0, 1);
      f.normalize();
      const r = new THREE.Vector3(-f.z, 0, f.x);
      const snap = (v) => Math.round(v);
      let dx = 0, dz = 0;
      const ax = Math.abs(f.x) > Math.abs(f.z) ? [Math.sign(f.x), 0] : [0, Math.sign(f.z)];
      const ar = Math.abs(r.x) > Math.abs(r.z) ? [Math.sign(r.x), 0] : [0, Math.sign(r.z)];
      if (k === 'ArrowUp') [dx, dz] = ax; if (k === 'ArrowDown') [dx, dz] = [-ax[0], -ax[1]];
      if (k === 'ArrowRight') [dx, dz] = ar; if (k === 'ArrowLeft') [dx, dz] = [-ar[0], -ar[1]];
      nudge(snap(dx) * st, snap(dz) * st);
    }
  });
}

// ---------------- compass ----------------
const _f = new THREE.Vector3();
export function updateCompass() {
  const n = bearingToWorld(0, app.settings.facing || 180, 0);
  let fx, fz;
  if (S.camera.isOrthographicCamera) { fx = 0; fz = 1; }
  else { S.camera.getWorldDirection(_f); fx = _f.x; fz = _f.z; const L = Math.hypot(fx, fz) || 1; fx /= L; fz /= L; }
  const xs = -n.x * fz + n.z * fx, ys = n.x * fx + n.z * fz;
  const ang = Math.atan2(xs, ys) * 180 / Math.PI;
  $('#compass svg').style.transform = `rotate(${ang}deg)`;
}
