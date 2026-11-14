import { app, uid } from './core.js';
import { setItems, resetHistory, select, emit } from './editor.js';
import { refreshRoofs } from './views.js';
import { defaultLayouts, existingItems, EXAMPLE_KEYS } from './layouts.js';

const KEY = 'backyard-planner.v1';
export const store = { layouts: [], currentId: null, examplesSeen: [] };
let memory = null;
let storageOK = true;

export function loadStore() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { storageOK = false; return memory; }
}
export function persist() {
  const data = { v: 1, layouts: store.layouts, currentId: store.currentId, examplesSeen: store.examplesSeen, settings: app.settings };
  memory = data;
  try { localStorage.setItem(KEY, JSON.stringify(data)); storageOK = true; } catch (e) { storageOK = false; }
}
export function canPersist() { return storageOK; }
let t;
export function saveSoon() { clearTimeout(t); t = setTimeout(persist, 350); }
export function currentLayout() { return store.layouts.find((l) => l.id === store.currentId); }
export function syncCurrent() {
  const L = currentLayout();
  if (!L) return;
  L.items = JSON.parse(JSON.stringify(app.items));
  L.updated = Date.now();
  saveSoon();
}
export function initLayouts(saved) {
  const defs = defaultLayouts();
  if (saved && Array.isArray(saved.layouts) && saved.layouts.length) {
    store.layouts = saved.layouts;
    store.currentId = saved.layouts.some((l) => l.id === saved.currentId) ? saved.currentId : saved.layouts[0].id;
    // pick up example layouts added in newer versions, without bringing back ones you deleted
    const seen = new Set(saved.examplesSeen || []);
    for (const l of store.layouts) {
      if (l.ex) seen.add(l.ex);
      const d = defs.find((x) => x.ex && x.name === l.name);
      if (d) { seen.add(d.ex); if (!l.ex) { l.ex = d.ex; l.desc = l.desc || d.desc; } }
    }
    for (const d of defs) if (d.ex && !seen.has(d.ex)) store.layouts.push(d);
  } else {
    store.layouts = defs;
    store.currentId = defs[0].id;
  }
  store.examplesSeen = EXAMPLE_KEYS.slice();
}
export function switchLayout(id) {
  if (id !== store.currentId) syncCurrent();
  store.currentId = id;
  const L = currentLayout();
  select(null);
  setItems(JSON.parse(JSON.stringify(L.items)), { keepSelection: false });
  resetHistory();
  refreshRoofs();
  saveSoon();
  emit('layouts');
}
export function newLayout(name, items) {
  syncCurrent();
  const L = { id: uid(), name: name || nextName('New layout'), items: items || existingItems() };
  store.layouts.push(L);
  switchLayout(L.id);
  return L;
}
export function duplicateLayout() {
  syncCurrent();
  const cur = currentLayout();
  const items = JSON.parse(JSON.stringify(cur.items)).map((i) => ({ ...i, id: uid() }));
  return newLayout(nextName(cur.name.replace(/^Idea: (.)/, (m, c) => c.toUpperCase()) + ' copy'), items);
}
export function renameLayout(name) {
  const L = currentLayout();
  if (L && name.trim()) { L.name = name.trim(); saveSoon(); emit('layouts'); }
}
export function deleteLayout() {
  if (store.layouts.length < 2) return false;
  store.layouts = store.layouts.filter((l) => l.id !== store.currentId);
  store.currentId = store.layouts[0].id;
  switchLayout(store.currentId);
  return true;
}
export function addExampleLayouts() {
  syncCurrent();
  const have = new Set(store.layouts.map((l) => l.ex).filter(Boolean));
  const ex = defaultLayouts().filter((d) => d.ex && !have.has(d.ex));
  if (!ex.length) return 0;
  store.layouts.push(...ex);
  switchLayout(ex[0].id);
  return ex.length;
}
function nextName(base) {
  let n = base, k = 2;
  while (store.layouts.some((l) => l.name === n)) n = `${base} ${k++}`;
  return n;
}
export function exportLayouts() {
  syncCurrent();
  const blob = new Blob([JSON.stringify({ app: 'backyard-planner', v: 1, layouts: store.layouts }, null, 1)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'backyard-layouts.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
export function importLayouts(text) {
  const data = JSON.parse(text);
  const list = Array.isArray(data) ? data : data.layouts;
  if (!Array.isArray(list) || !list.length) throw new Error('No layouts found in that file');
  syncCurrent();
  const added = list.filter((l) => l && Array.isArray(l.items)).map((l) => ({ id: uid(), name: nextName(l.name || 'Imported layout'), items: l.items }));
  if (!added.length) throw new Error('No layouts found in that file');
  store.layouts.push(...added);
  switchLayout(added[0].id);
  return added.length;
}
