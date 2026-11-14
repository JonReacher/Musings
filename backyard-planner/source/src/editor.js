import * as THREE from 'three';
import { app, uid, hashStr, optimize, disposeObject, fmtFt, polyArea, polyLength, centroid, segDist, pointInPoly } from './core.js';
import { S } from './scene.js';
import { TYPES, buildFor, defaultsOf } from './catalog.js';

export const E = { mode: 'select', drag: null, draw: null, measures: [], history: [], hIndex: -1, snap: 0.5, angleSnap: 15 };
const listeners = {};
export function on(evt, fn) { (listeners[evt] ||= []).push(fn); }
export function emit(evt, data) { (listeners[evt] || []).forEach((f) => f(data)); }

const ACCENT = '#f2a541';
const handleMat = new THREE.MeshBasicMaterial({ color: ACCENT, depthTest: false, transparent: true, opacity: 0.95 });
const handleMat2 = new THREE.MeshBasicMaterial({ color: '#ffffff', depthTest: false, transparent: true, opacity: 0.9 });
const handleMatMid = new THREE.MeshBasicMaterial({ color: ACCENT, depthTest: false, transparent: true, opacity: 0.45 });
const lineMat = new THREE.LineBasicMaterial({ color: ACCENT, depthTest: false, transparent: true, opacity: 0.95 });
const lineMatDim = new THREE.LineDashedMaterial({ color: '#ffffff', depthTest: false, transparent: true, opacity: 0.9, dashSize: 0.6, gapSize: 0.4 });
const raycaster = new THREE.Raycaster();
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

// ---------------- items ----------------
export function getItem(id) { return app.items.find((i) => i.id === id); }
export function makeItem(type, o = {}) {
  const t = TYPES[type];
  const it = { id: uid(), type, rot: 0, p: { ...defaultsOf(t) }, ...o };
  if (t.kind === 'box') { it.w ??= t.size.w; it.d ??= t.size.d; it.h ??= t.size.h; it.x ??= 14; it.z ??= 20; }
  else { if (t.size?.w !== undefined) it.w ??= t.size.w; if (t.size?.h !== undefined) it.h ??= t.size.h; it.pts ??= []; }
  if (o.p) it.p = { ...defaultsOf(t), ...o.p };
  return it;
}
function groundish(item) { const t = TYPES[item.type]; return t.ground || t.kind === 'area' || item.type === 'walk_path' || item.type === 'creek'; }

export function rebuildItem(item) {
  const old = app.objects.get(item.id);
  if (old) { S.itemsRoot.remove(old); disposeObject(old); }
  const seed = hashStr(item.id);
  let obj;
  try { obj = buildFor(item, seed); } catch (e) { console.error('build failed', item.type, e); obj = new THREE.Group(); }
  const ticks = [];
  obj.traverse((o) => { if (o.userData.tick) ticks.push(o.userData.tick); });
  const emitters = obj.userData.emitters;
  const roofs = [];
  obj.traverse((o) => { if (o.userData.isRoof) roofs.push(o); });
  optimize(obj);
  obj.userData.ticks = ticks;
  obj.userData.emitters = emitters;
  obj.userData.roofs = roofs;
  obj.userData.itemId = item.id;
  app.objects.set(item.id, obj);
  S.itemsRoot.add(obj);
  placeObject(item);
  return obj;
}
export function surfaceHeightAt(x, z, exceptId) {
  let h = 0;
  for (const it of app.items) {
    if (it.id === exceptId || it.hidden) continue;
    const t = TYPES[it.type];
    if (!t.surfaceH) continue;
    const fp = footprint(it);
    if (pointInPoly(x, z, fp)) h = Math.max(h, t.surfaceH(it));
  }
  return h;
}
let groundOrder = new Map();
function refreshGroundOrder() {
  groundOrder = new Map();
  let i = 0;
  for (const it of app.items) if (groundish(it)) groundOrder.set(it.id, i++);
}
export function placeObject(item) {
  const obj = app.objects.get(item.id);
  if (!obj) return;
  const t = TYPES[item.type];
  obj.visible = !item.hidden;
  let y = 0;
  if (t.kind === 'box') {
    obj.position.set(item.x, 0, item.z);
    obj.rotation.set(0, item.rot || 0, 0);
    if (item.type !== 'house' && item.type !== 'slab') y = surfaceHeightAt(item.x, item.z, item.id);
  } else {
    obj.position.set(0, 0, 0); obj.rotation.set(0, 0, 0);
  }
  if (groundish(item)) y += ((groundOrder.get(item.id) || 0) % 25) * 0.004;
  obj.position.y = y;
  obj.updateMatrixWorld(true);
}
export function setItems(items, { keepSelection = true } = {}) {
  const keep = new Set(items.map((i) => i.id));
  for (const [id, obj] of app.objects) if (!keep.has(id)) { S.itemsRoot.remove(obj); disposeObject(obj); app.objects.delete(id); }
  const prev = new Map(app.items.map((i) => [i.id, JSON.stringify(i)]));
  app.items = items;
  refreshGroundOrder();
  for (const it of items) {
    const was = prev.get(it.id);
    if (!app.objects.has(it.id) || !was || stripPos(was) !== stripPos(JSON.stringify(it))) rebuildItem(it);
  }
  for (const it of items) placeObject(it);
  if (!keepSelection || !getItem(app.selectedId)) select(null);
  else refreshGizmo();
  emit('items');
}
function stripPos(json) { const o = JSON.parse(json); delete o.x; delete o.z; delete o.rot; delete o.hidden; delete o.locked; delete o.name; return JSON.stringify(o); }

export function addItem(item, { select: sel = true, commit: c = true } = {}) {
  app.items.push(item);
  refreshGroundOrder();
  rebuildItem(item);
  for (const it of app.items) if (TYPES[it.type].surfaceH) placeAll();
  if (sel) select(item.id);
  emit('items');
  if (c) commit();
  return item;
}
function placeAll() { for (const it of app.items) placeObject(it); }
export function updateItem(id, patch, { rebuild = true, c = false } = {}) {
  const it = getItem(id);
  if (!it) return;
  if (patch.p) { it.p = { ...it.p, ...patch.p }; const { p, ...rest } = patch; Object.assign(it, rest); }
  else Object.assign(it, patch);
  if (rebuild) rebuildItem(it); else placeObject(it);
  if (TYPES[it.type].surfaceH) placeAll();
  if (id === app.selectedId) refreshGizmo();
  emit('itemChanged', it);
  if (c) commit();
}
export function removeItem(id) {
  const it = getItem(id);
  if (!it) return;
  app.items = app.items.filter((i) => i.id !== id);
  const obj = app.objects.get(id);
  if (obj) { S.itemsRoot.remove(obj); disposeObject(obj); app.objects.delete(id); }
  refreshGroundOrder();
  placeAll();
  if (app.selectedId === id) select(null);
  emit('items');
  commit();
}
export function duplicateItem(id) {
  const it = getItem(id);
  if (!it || it.type === 'house') return;
  const c = JSON.parse(JSON.stringify(it));
  c.id = uid(); delete c.existing; delete c.locked;
  if (c.name) c.name = c.name + ' copy';
  if (TYPES[c.type].kind === 'box') { c.x += 3; c.z += 3; }
  else c.pts = c.pts.map(([x, z]) => [x + 3, z + 3]);
  return addItem(c);
}

// ---------------- footprint & clearances ----------------
export function footprint(it) {
  const t = TYPES[it.type];
  if (t.kind !== 'box') return it.pts || [];
  const c = Math.cos(it.rot || 0), s = Math.sin(it.rot || 0);
  const tf = (lx, lz) => [it.x + lx * c + lz * s, it.z - lx * s + lz * c];
  if (t.resize === 'diam') {
    const pts = []; for (let i = 0; i < 20; i++) { const a = i / 20 * Math.PI * 2; pts.push(tf(Math.cos(a) * it.w / 2, Math.sin(a) * it.d / 2)); } return pts;
  }
  return [tf(-it.w / 2, -it.d / 2), tf(it.w / 2, -it.d / 2), tf(it.w / 2, it.d / 2), tf(-it.w / 2, it.d / 2)];
}
function polyToSegDist(fp, ax, az, bx, bz) {
  if (!fp.length) return Infinity;
  let d = Infinity;
  for (const [x, z] of fp) d = Math.min(d, segDist(x, z, ax, az, bx, bz));
  for (let i = 0; i < fp.length; i++) { const a = fp[i], b = fp[(i + 1) % fp.length]; d = Math.min(d, segDist(ax, az, a[0], a[1], b[0], b[1]), segDist(bx, bz, a[0], a[1], b[0], b[1])); }
  return d;
}
export function clearances(it) {
  const fp = footprint(it);
  if (!fp.length) return [];
  const out = [];
  const house = app.items.find((i) => i.type === 'house');
  if (house && it.type !== 'house') {
    const hp = footprint(house);
    let d = Infinity;
    for (let i = 0; i < hp.length; i++) { const a = hp[i], b = hp[(i + 1) % hp.length]; d = Math.min(d, polyToSegDist(fp, a[0], a[1], b[0], b[1])); }
    out.push(['House', d]);
  }
  const best = {};
  for (const f of app.items.filter((i) => i.type === 'fence_line' && i.existing)) {
    for (let i = 0; i < f.pts.length - 1; i++) {
      const [ax, az] = f.pts[i], [bx, bz] = f.pts[i + 1];
      const along = Math.abs(bx - ax) > Math.abs(bz - az);
      const mx = (ax + bx) / 2, mz = (az + bz) / 2;
      let label;
      if (along) { if (mz < 5) continue; label = 'Back fence'; }
      else label = mx < 14.5 ? 'Right fence' : 'Left fence';
      const d = polyToSegDist(fp, ax, az, bx, bz);
      best[label] = Math.min(best[label] ?? Infinity, d);
    }
  }
  for (const k of ['Back fence', 'Left fence', 'Right fence']) if (best[k] !== undefined) out.push([k, best[k]]);
  return out;
}
export function itemStats(it) {
  const t = TYPES[it.type];
  if (t.kind === 'area') return { area: polyArea(it.pts), perim: polyLength(it.pts, true) };
  if (t.kind === 'poly') return { length: polyLength(it.pts), area: it.w ? polyLength(it.pts) * it.w : 0 };
  if (t.resize === 'diam') return { area: Math.PI * (it.w / 2) * (it.d / 2) };
  return { area: it.w * it.d };
}

// ---------------- selection & gizmo ----------------
export function select(id) {
  if (app.selectedId === id) { refreshGizmo(); return; }
  app.selectedId = id;
  refreshGizmo();
  emit('select', id);
}
function clearOverlay() {
  while (S.overlay.children.length) { const c = S.overlay.children.pop(); c.geometry && c.geometry.dispose(); }
}
const handleGeo = new THREE.SphereGeometry(1, 16, 10);
const boxHandleGeo = new THREE.BoxGeometry(1.4, 1.4, 1.4);
const rotGeo = new THREE.TorusGeometry(0.9, 0.28, 8, 24);
function addHandle(geo, mat, x, y, z, data, scale = 0.45) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.renderOrder = 20;
  m.userData.handle = data;
  m.userData.baseScale = scale;
  if (geo === rotGeo) m.rotation.x = Math.PI / 2;
  S.overlay.add(m);
  return m;
}
function addLine(points, closed = false, mat = lineMat) {
  const pts = points.map((p) => new THREE.Vector3(p[0], p[1], p[2]));
  if (closed && pts.length) pts.push(pts[0].clone());
  const g = new THREE.BufferGeometry().setFromPoints(pts);
  const l = new THREE.Line(g, mat);
  l.renderOrder = 19;
  if (mat.isLineDashedMaterial) l.computeLineDistances();
  l.raycast = () => {};
  S.overlay.add(l);
  return l;
}
export function refreshGizmo() {
  clearOverlay();
  labels.clearPrefix('sel');
  drawMeasureOverlay();
  const it = getItem(app.selectedId);
  if (!it || it.hidden) return;
  const t = TYPES[it.type];
  const y = 0.12 + (app.objects.get(it.id)?.position.y || 0);
  if (t.kind === 'box') {
    const fp = footprint(it);
    addLine(fp.map(([x, z]) => [x, y, z]), true);
    if (it.locked) { labels.set('sel-name', [it.x, y, it.z], '🔒 ' + (it.name || t.name), 'lbl lbl-lock'); return; }
    const c = Math.cos(it.rot || 0), s = Math.sin(it.rot || 0);
    const tf = (lx, lz) => [it.x + lx * c + lz * s, it.z - lx * s + lz * c];
    if (t.resize === 'wd' || t.resize === 'w') {
      for (const side of t.resize === 'w' ? ['+x', '-x'] : ['+x', '-x', '+z', '-z']) {
        const [lx, lz] = side === '+x' ? [it.w / 2, 0] : side === '-x' ? [-it.w / 2, 0] : side === '+z' ? [0, it.d / 2] : [0, -it.d / 2];
        const [x, z] = tf(lx, lz);
        addHandle(boxHandleGeo, handleMat, x, y, z, { kind: 'edge', side });
      }
    } else if (t.resize === 'diam') {
      const [x, z] = tf(it.w / 2, 0);
      addHandle(boxHandleGeo, handleMat, x, y, z, { kind: 'diam' });
    }
    if (!t.noRotate) {
      const off = it.d / 2 + 2.2;
      const [x, z] = tf(0, off);
      const [ex, ez] = tf(0, it.d / 2);
      addLine([[ex, y, ez], [x, y, z]]);
      const hnd = addHandle(handleGeo, handleMat2, x, y, z, { kind: 'rot' }, 0.36);
      const ring = new THREE.Mesh(rotGeo, handleMat2);
      ring.rotation.x = Math.PI / 2; ring.scale.setScalar(1.7); ring.renderOrder = 20; ring.raycast = () => {};
      hnd.add(ring);
    }
    // dimension labels
    const [fx, fz] = tf(0, it.d / 2);
    const [rx, rz] = tf(it.w / 2, 0);
    if (t.resize === 'diam') { const [lx, lz] = tf(0, -it.d / 2); labels.set('sel-w', [lx, y, lz], '⌀ ' + fmtFt(it.w), 'lbl'); }
    else if (t.resize !== 'none') {
      labels.set('sel-w', [fx, y, fz], fmtFt(it.w), 'lbl');
      labels.set('sel-d', [rx, y, rz], fmtFt(it.d), 'lbl');
    }
  } else {
    const pts = it.pts;
    const closed = t.kind === 'area';
    addLine(pts.map(([x, z]) => [x, y, z]), closed);
    if (it.locked) { const [cx, cz] = centroid(pts); labels.set('sel-name', [cx, y, cz], '🔒 ' + (it.name || t.name), 'lbl lbl-lock'); return; }
    pts.forEach(([x, z], i) => addHandle(handleGeo, handleMat, x, y, z, { kind: 'vertex', i }, 0.42));
    const n = closed ? pts.length : pts.length - 1;
    for (let i = 0; i < n; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      addHandle(handleGeo, handleMatMid, (a[0] + b[0]) / 2, y, (a[1] + b[1]) / 2, { kind: 'mid', i }, 0.3);
    }
    const st = itemStats(it);
    const [cx, cz] = centroid(pts);
    if (closed) labels.set('sel-w', [cx, y, cz], Math.round(st.area) + ' sq ft', 'lbl');
    else { const mid = pts[Math.floor((pts.length - 1) / 2)]; labels.set('sel-w', [mid[0], y, mid[1]], fmtFt(st.length) + ' long', 'lbl'); }
  }
}
export function updateHandleScales() {
  const cam = S.camera;
  for (const h of S.overlay.children) {
    if (!h.userData.handle) continue;
    let k;
    if (cam.isOrthographicCamera) k = (cam.top - cam.bottom) / cam.zoom / 60;
    else k = h.position.distanceTo(cam.position) / 45;
    h.scale.setScalar(Math.max(0.15, k) * h.userData.baseScale * 1.6);
  }
}

// ---------------- labels (HTML overlay) ----------------
export const labels = {
  map: new Map(), root: null,
  init(root) { this.root = root; },
  set(key, pos, text, cls = 'lbl') {
    let L = this.map.get(key);
    if (!L) { const el = document.createElement('div'); el.className = cls; this.root.appendChild(el); L = { el, pos: new THREE.Vector3() }; this.map.set(key, L); }
    L.el.className = cls;
    if (L.el.textContent !== text) L.el.textContent = text;
    L.pos.set(pos[0], pos[1], pos[2]);
  },
  remove(key) { const L = this.map.get(key); if (L) { L.el.remove(); this.map.delete(key); } },
  clearPrefix(p) { for (const k of [...this.map.keys()]) if (k.startsWith(p)) this.remove(k); },
  update() {
    const cam = S.camera, w = S.container.clientWidth, h = S.container.clientHeight;
    const v = new THREE.Vector3();
    for (const L of this.map.values()) {
      v.copy(L.pos).project(cam);
      if (v.z > 1 || v.z < -1) { L.el.style.display = 'none'; continue; }
      L.el.style.display = '';
      L.el.style.transform = `translate(${(v.x * 0.5 + 0.5) * w}px, ${(-v.y * 0.5 + 0.5) * h}px) translate(-50%, -140%)`;
    }
  },
};

// ---------------- history ----------------
export function commit() {
  const snap = JSON.stringify(app.items);
  if (E.history[E.hIndex] === snap) return;
  E.history = E.history.slice(0, E.hIndex + 1);
  E.history.push(snap);
  if (E.history.length > 150) E.history.shift();
  E.hIndex = E.history.length - 1;
  emit('commit');
}
export function resetHistory() { E.history = [JSON.stringify(app.items)]; E.hIndex = 0; emit('commit'); }
export function undo() { if (E.hIndex <= 0) return; E.hIndex--; setItems(JSON.parse(E.history[E.hIndex])); emit('commit'); }
export function redo() { if (E.hIndex >= E.history.length - 1) return; E.hIndex++; setItems(JSON.parse(E.history[E.hIndex])); emit('commit'); }

// ---------------- pointer helpers ----------------
const ndc = new THREE.Vector2();
function setRay(ev) {
  const r = S.renderer.domElement.getBoundingClientRect();
  ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
  raycaster.setFromCamera(ndc, S.camera);
}
export function groundPoint(ev, y = 0) {
  setRay(ev);
  groundPlane.constant = -y;
  const p = new THREE.Vector3();
  return raycaster.ray.intersectPlane(groundPlane, p) ? p : null;
}
const snapV = (v, alt) => (E.snap && !alt ? Math.round(v / E.snap) * E.snap : v);
function pickHandle(ev) {
  setRay(ev);
  const hits = raycaster.intersectObjects(S.overlay.children.filter((c) => c.userData.handle), false);
  return hits.length ? hits[0].object : null;
}
export function pickItem(ev) {
  setRay(ev);
  const hits = raycaster.intersectObjects(S.itemsRoot.children, true);
  const ids = [];
  for (const h of hits) {
    let o = h.object;
    while (o && !o.userData.itemId) o = o.parent;
    if (!o || !o.visible) continue;
    if (!ids.includes(o.userData.itemId)) ids.push(o.userData.itemId);
  }
  const items = ids.map(getItem).filter(Boolean);
  return items.find((i) => !i.locked && !groundish(i)) || items.find((i) => !i.locked) || items.find((i) => i.type !== 'house') || items[0] || null;
}
function screenDist(a, b) {
  const v1 = new THREE.Vector3(a[0], 0, a[1]).project(S.camera), v2 = new THREE.Vector3(b[0], 0, b[1]).project(S.camera);
  const w = S.container.clientWidth, h = S.container.clientHeight;
  return Math.hypot((v1.x - v2.x) * w / 2, (v1.y - v2.y) * h / 2);
}

// ---------------- pointer events ----------------
export function initPointer(dom) {
  let down = null;
  dom.addEventListener('pointerdown', (ev) => {
    if (ev.button !== 0) return;
    down = { x: ev.clientX, y: ev.clientY, t: performance.now() };
    if (E.mode === 'draw' || E.mode === 'measure') return; // click handled on up
    const h = pickHandle(ev);
    const it = getItem(app.selectedId);
    if (h && it) { startHandleDrag(ev, it, h.userData.handle); return; }
    const hit = pickItem(ev);
    // big flat things (patios, beds, paths) only drag once selected, so they don't hijack orbiting
    if (hit && !hit.locked && (app.selectedId === hit.id || !groundish(hit))) {
      if (app.selectedId !== hit.id) select(hit.id);
      const p = groundPoint(ev, 0);
      if (p) {
        E.drag = { kind: 'move', id: hit.id, start: p, pending: true, orig: JSON.parse(JSON.stringify(hit)) };
        setControls(false);
        dom.setPointerCapture(ev.pointerId);
      }
    } else {
      down.hit = hit ? hit.id : null;
    }
  }, { capture: true });
  dom.addEventListener('pointermove', (ev) => {
    if (E.drag) { dragMove(ev); return; }
    if (E.mode === 'draw' || E.mode === 'measure') { drawHover(ev); return; }
    hoverCursor(ev);
    const p = groundPoint(ev);
    if (p) emit('cursor', p);
  });
  const up = (ev) => {
    if (E.drag) {
      const d = E.drag;
      E.drag = null;
      setControls(true);
      try { dom.releasePointerCapture(ev.pointerId); } catch (_) {}
      if (d.needsRebuild) { const it = getItem(d.id); if (it) { rebuildItem(it); refreshGizmo(); } }
      if (!d.pending) { commit(); emit('itemChanged', getItem(d.id)); }
      down = null;
      return;
    }
    if (!down || ev.button !== 0) return;
    const moved = Math.hypot(ev.clientX - down.x, ev.clientY - down.y);
    if (moved < 5) {
      if (E.mode === 'draw') drawClick(ev);
      else if (E.mode === 'measure') measureClick(ev);
      else select(down.hit || null);
    }
    down = null;
  };
  dom.addEventListener('pointerup', up);
  dom.addEventListener('pointercancel', up);
  dom.addEventListener('dblclick', (ev) => {
    if (E.mode === 'draw') { finishDraw(); return; }
    const h = pickHandle(ev);
    const it = getItem(app.selectedId);
    if (h && it && h.userData.handle.kind === 'vertex') {
      const t = TYPES[it.type];
      const min = t.kind === 'area' ? 3 : 2;
      if (it.pts.length > min) { const pts = it.pts.slice(); pts.splice(h.userData.handle.i, 1); updateItem(it.id, { pts }, { c: true }); }
    }
  });
}
function setControls(on) {
  if (S.camMode === 'plan') S.orthoControls.enabled = on;
  else if (S.camMode === 'orbit') S.controls.enabled = on;
  S.dragging = !on;
}
let hoverT = 0;
function hoverCursor(ev) {
  const now = performance.now();
  if (now - hoverT < 50) return;
  hoverT = now;
  const dom = S.renderer.domElement;
  const h = pickHandle(ev);
  if (h) { dom.style.cursor = h.userData.handle.kind === 'rot' ? 'grab' : h.userData.handle.kind === 'edge' || h.userData.handle.kind === 'diam' ? 'ew-resize' : 'move'; return; }
  const it = pickItem(ev);
  dom.style.cursor = it && !it.locked ? (it.id === app.selectedId ? 'move' : 'pointer') : '';
}

function startHandleDrag(ev, it, h) {
  const p = groundPoint(ev, 0);
  if (!p) return;
  if (h.kind === 'mid') {
    const pts = it.pts.slice();
    pts.splice(h.i + 1, 0, [snapV(p.x), snapV(p.z)]);
    it.pts = pts;
    rebuildItem(it); refreshGizmo();
    h = { kind: 'vertex', i: h.i + 1 };
  }
  E.drag = { kind: h.kind, side: h.side, i: h.i, id: it.id, start: p, orig: JSON.parse(JSON.stringify(it)) };
  setControls(false);
  S.renderer.domElement.setPointerCapture(ev.pointerId);
}
let rafPending = null;
function dragMove(ev) {
  const d = E.drag;
  const it = getItem(d.id);
  if (!it) return;
  const p = groundPoint(ev, 0);
  if (!p) return;
  const alt = ev.altKey;
  const t = TYPES[it.type];
  const o = d.orig;
  if (d.kind === 'move') {
    if (d.pending) {
      const r = S.renderer.domElement.getBoundingClientRect();
      // threshold in px
      const v = new THREE.Vector3(d.start.x, 0, d.start.z).project(S.camera);
      const sx = (v.x * 0.5 + 0.5) * r.width + r.left, sy = (-v.y * 0.5 + 0.5) * r.height + r.top;
      if (Math.hypot(ev.clientX - sx, ev.clientY - sy) < 4) return;
      d.pending = false;
    }
    const dx = p.x - d.start.x, dz = p.z - d.start.z;
    if (t.kind === 'box') { it.x = snapV(o.x + dx, alt); it.z = snapV(o.z + dz, alt); placeObject(it); if (t.surfaceH) for (const j of app.items) placeObject(j); }
    else {
      const sx = snapV(dx, alt), sz = snapV(dz, alt);
      it.pts = o.pts.map(([x, z]) => [x + sx, z + sz]);
      const obj = app.objects.get(it.id);
      if (!d.builtFrom) d.builtFrom = o.pts;
      obj.position.x = sx; obj.position.z = sz; obj.updateMatrixWorld(true);
      d.needsRebuild = true;
    }
    refreshGizmo();
    emit('dragging', it);
    return;
  }
  if (d.kind === 'rot') {
    let a = Math.atan2(p.x - it.x, p.z - it.z);
    if (!alt && E.angleSnap) { const st = E.angleSnap * Math.PI / 180; a = Math.round(a / st) * st; }
    it.rot = a; placeObject(it); refreshGizmo(); emit('dragging', it);
    return;
  }
  if (d.kind === 'edge' || d.kind === 'diam') {
    const c = Math.cos(o.rot || 0), s = Math.sin(o.rot || 0);
    const dx = p.x - o.x, dz = p.z - o.z;
    const lx = dx * c - dz * s, lz = dx * s + dz * c;
    const min = { w: 0.5, d: 0.5, ...(t.min || {}) }, max = { w: 80, d: 80, ...(t.max || {}) };
    const cl = (v, k) => Math.max(min[k], Math.min(max[k], v));
    if (d.kind === 'diam') {
      const D = cl(snapV(2 * Math.hypot(lx, lz), alt), 'w');
      it.w = D; it.d = D;
    } else if (d.side === '+x' || d.side === '-x') {
      const sign = d.side === '+x' ? 1 : -1;
      const W = cl(snapV(sign * lx + o.w / 2, alt), 'w');
      const sh = sign * (W - o.w) / 2;
      it.w = W; it.x = o.x + sh * c; it.z = o.z - sh * s;
    } else {
      const sign = d.side === '+z' ? 1 : -1;
      const D = cl(snapV(sign * lz + o.d / 2, alt), 'd');
      const sh = sign * (D - o.d) / 2;
      it.d = D; it.x = o.x + sh * s; it.z = o.z + sh * c;
    }
    scheduleRebuild(it);
    refreshGizmo();
    emit('dragging', it);
    return;
  }
  if (d.kind === 'vertex') {
    const pts = it.pts.slice();
    pts[d.i] = [snapV(p.x, alt), snapV(p.z, alt)];
    it.pts = pts;
    scheduleRebuild(it);
    refreshGizmo();
    emit('dragging', it);
  }
}
function scheduleRebuild(it) {
  if (rafPending) return;
  rafPending = requestAnimationFrame(() => { rafPending = null; rebuildItem(it); if (TYPES[it.type].surfaceH) for (const j of app.items) placeObject(j); });
}

// ---------------- drawing ----------------
export function startDraw(type) {
  cancelDraw(false);
  E.mode = 'draw';
  E.draw = { type, pts: [], cursor: null };
  select(null);
  S.renderer.domElement.style.cursor = 'crosshair';
  emit('mode', 'draw');
}
export function cancelDraw(notify = true) {
  if (E.mode !== 'draw') return;
  E.mode = 'select'; E.draw = null;
  clearOverlay(); labels.clearPrefix('draw');
  drawMeasureOverlay();
  S.renderer.domElement.style.cursor = '';
  if (notify) emit('mode', 'select');
}
function snapAngle(prev, p) {
  const dx = p[0] - prev[0], dz = p[1] - prev[1];
  const L = Math.hypot(dx, dz);
  const a = Math.round(Math.atan2(dz, dx) / (Math.PI / 4)) * (Math.PI / 4);
  return [prev[0] + Math.cos(a) * L, prev[1] + Math.sin(a) * L];
}
function drawPoint(ev) {
  const p = groundPoint(ev);
  if (!p) return null;
  let q = [snapV(p.x, ev.altKey), snapV(p.z, ev.altKey)];
  const pts = (E.draw && E.draw.pts) || [];
  if (ev.shiftKey && pts.length) q = snapAngle(pts[pts.length - 1], q);
  return q;
}
function drawHover(ev) {
  if (E.mode === 'measure') { measureHover(ev); return; }
  const q = drawPoint(ev);
  if (!q) return;
  E.draw.cursor = q;
  renderDrawOverlay();
}
function drawClick(ev) {
  const q = drawPoint(ev);
  if (!q) return;
  const D = E.draw;
  const t = TYPES[D.type];
  if (t.kind === 'area' && D.pts.length >= 3 && screenDist(q, D.pts[0]) < 14) { finishDraw(); return; }
  const last = D.pts[D.pts.length - 1];
  if (last && Math.hypot(last[0] - q[0], last[1] - q[1]) < 0.2) return;
  D.pts.push(q);
  renderDrawOverlay();
  emit('drawProgress', D);
}
export function undoDrawPoint() { if (E.draw && E.draw.pts.length) { E.draw.pts.pop(); renderDrawOverlay(); emit('drawProgress', E.draw); } }
export function finishDraw() {
  const D = E.draw;
  if (!D) return;
  const t = TYPES[D.type];
  const pts = D.pts.filter((p, i) => i === 0 || Math.hypot(p[0] - D.pts[i - 1][0], p[1] - D.pts[i - 1][1]) > 0.2);
  const min = t.kind === 'area' ? 3 : 2;
  cancelDraw(false);
  if (pts.length >= min) {
    const it = makeItem(D.type, { pts });
    addItem(it);
  }
  emit('mode', 'select');
}
function renderDrawOverlay() {
  clearOverlay(); labels.clearPrefix('draw');
  drawMeasureOverlay();
  const D = E.draw;
  if (!D) return;
  const t = TYPES[D.type];
  const y = 0.15;
  const pts = D.pts.slice();
  if (D.cursor) pts.push(D.cursor);
  if (pts.length >= 2) addLine(pts.map(([x, z]) => [x, y, z]), t.kind === 'area' && pts.length >= 3);
  D.pts.forEach(([x, z], i) => addHandle(handleGeo, i === 0 && t.kind === 'area' ? handleMat2 : handleMat, x, y, z, { kind: 'drawpt' }, 0.35));
  if (D.cursor) {
    addHandle(handleGeo, handleMatMid, D.cursor[0], y, D.cursor[1], { kind: 'drawpt' }, 0.3);
    const last = D.pts[D.pts.length - 1];
    if (last) {
      const L = Math.hypot(D.cursor[0] - last[0], D.cursor[1] - last[1]);
      labels.set('draw-seg', [(last[0] + D.cursor[0]) / 2, y, (last[1] + D.cursor[1]) / 2], fmtFt(L), 'lbl');
    }
    if (D.pts.length > 1) {
      const total = polyLength([...D.pts, D.cursor]);
      labels.set('draw-total', [D.cursor[0], y, D.cursor[1]], 'total ' + fmtFt(total), 'lbl lbl-soft');
    }
  }
  updateHandleScales();
}

// ---------------- measuring ----------------
export function startMeasure() {
  cancelDraw(false);
  E.mode = 'measure';
  E.mdraft = null;
  select(null);
  S.renderer.domElement.style.cursor = 'crosshair';
  emit('mode', 'measure');
}
export function stopMeasure() {
  if (E.mode !== 'measure') return;
  E.mode = 'select'; E.mdraft = null;
  S.renderer.domElement.style.cursor = '';
  drawMeasureOverlay();
  emit('mode', 'select');
}
export function clearMeasures() { E.measures = []; E.mdraft = null; labels.clearPrefix('m-'); refreshGizmo(); }
function measureHover(ev) {
  const p = groundPoint(ev); if (!p) return;
  let q = [snapV(p.x, ev.altKey), snapV(p.z, ev.altKey)];
  if (E.mdraft) { if (ev.shiftKey) q = snapAngle(E.mdraft[0], q); E.mdraft[1] = q; }
  clearOverlay(); drawMeasureOverlay();
  addHandle(handleGeo, handleMat2, q[0], 0.15, q[1], { kind: 'drawpt' }, 0.3);
  updateHandleScales();
}
function measureClick(ev) {
  const p = groundPoint(ev); if (!p) return;
  let q = [snapV(p.x, ev.altKey), snapV(p.z, ev.altKey)];
  if (!E.mdraft) E.mdraft = [q, q];
  else { if (ev.shiftKey) q = snapAngle(E.mdraft[0], q); E.measures.push([E.mdraft[0], q]); E.mdraft = null; }
  clearOverlay(); drawMeasureOverlay();
}
function drawMeasureOverlay() {
  labels.clearPrefix('m-');
  const all = [...E.measures];
  if (E.mdraft) all.push(E.mdraft);
  all.forEach(([a, b], i) => {
    const y = 0.2;
    addLine([[a[0], y, a[1]], [b[0], y, b[1]]], false, lineMatDim);
    for (const q of [a, b]) addLine([[q[0], 0.05, q[1]], [q[0], 1.2, q[1]]], false, lineMatDim);
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (L > 0.05) labels.set('m-' + i, [(a[0] + b[0]) / 2, y, (a[1] + b[1]) / 2], fmtFt(L), 'lbl lbl-measure');
  });
}

// ---------------- keyboard ----------------
export function nudge(dx, dz) {
  const it = getItem(app.selectedId);
  if (!it || it.locked) return;
  if (TYPES[it.type].kind === 'box') updateItem(it.id, { x: it.x + dx, z: it.z + dz }, { rebuild: false, c: true });
  else updateItem(it.id, { pts: it.pts.map(([x, z]) => [x + dx, z + dz]) }, { c: true });
}
export function rotateSelected(deg) {
  const it = getItem(app.selectedId);
  if (!it || it.locked || TYPES[it.type].noRotate) return;
  if (TYPES[it.type].kind === 'box') updateItem(it.id, { rot: (it.rot || 0) + deg * Math.PI / 180 }, { rebuild: false, c: true });
  else {
    const [cx, cz] = centroid(it.pts); const a = -deg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
    updateItem(it.id, { pts: it.pts.map(([x, z]) => [cx + (x - cx) * c - (z - cz) * s, cz + (x - cx) * s + (z - cz) * c]) }, { c: true });
  }
}
export function tick(t) {
  for (const obj of app.objects.values()) if (obj.visible && obj.userData.ticks) for (const f of obj.userData.ticks) f(t);
  updateHandleScales();
  labels.update();
}
