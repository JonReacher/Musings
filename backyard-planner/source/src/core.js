import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Shared mutable app state (filled in by main.js)
export const app = {
  items: [],          // design items (plain data)
  objects: new Map(), // id -> THREE.Object3D
  selectedId: null,
  settings: {},
  emitters: [],
};

// ---------- random ----------
export function rng(seed) {
  let a = (seed >>> 0) || 1;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
export const uid = () => Math.random().toString(36).slice(2, 10);

// ---------- feet / inches ----------
export function fmtFt(v, opts = {}) {
  const neg = v < 0; v = Math.abs(v);
  let ft = Math.floor(v + 1e-6);
  let inch = Math.round((v - ft) * 12);
  if (inch === 12) { ft += 1; inch = 0; }
  let s;
  if (opts.short && ft === 0) s = `${inch}"`;
  else s = inch ? `${ft}' ${inch}"` : `${ft}'`;
  return (neg ? '-' : '') + s;
}
export function parseFt(str) {
  if (typeof str === 'number') return str;
  str = String(str).trim().replace(/[’′]/g, "'").replace(/[”″]/g, '"');
  if (!str) return NaN;
  let m = str.match(/^(-?\d+(?:\.\d+)?)\s*'\s*(?:(\d+(?:\.\d+)?)\s*(?:"|in)?)?$/);
  if (m) return parseFloat(m[1]) + (m[2] ? parseFloat(m[2]) / 12 : 0);
  m = str.match(/^(-?\d+(?:\.\d+)?)\s*(?:"|in)$/);
  if (m) return parseFloat(m[1]) / 12;
  m = str.match(/^(-?\d+(?:\.\d+)?)\s*(?:ft|feet)?$/);
  if (m) return parseFloat(m[1]);
  m = str.match(/^(-?\d+)\s+(\d+(?:\.\d+)?)$/); // "12 6"
  if (m) return parseFloat(m[1]) + parseFloat(m[2]) / 12;
  return NaN;
}

// ---------- canvas & textures ----------
export function makeCanvas(w, h = w) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}
export function toTexture(canvas, { srgb = true, repeat = true, aniso = 8 } = {}) {
  const t = new THREE.CanvasTexture(canvas);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  t.anisotropy = aniso;
  t.needsUpdate = true;
  return t;
}

// Periodic value noise for tileable canvas textures
export function periodicNoise(seed, period) {
  const r = rng(seed);
  const g = new Float32Array(period * period);
  for (let i = 0; i < g.length; i++) g[i] = r();
  return (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const x0 = ((xi % period) + period) % period, y0 = ((yi % period) + period) % period;
    const x1 = (x0 + 1) % period, y1 = (y0 + 1) % period;
    const a = g[y0 * period + x0], b = g[y0 * period + x1], c = g[y1 * period + x0], d = g[y1 * period + x1];
    return (a + (b - a) * u) * (1 - v) + (c + (d - c) * u) * v;
  };
}
export function fbmField(seed, baseP = 4, oct = 5) {
  const ns = [];
  for (let i = 0; i < oct; i++) ns.push(periodicNoise(seed + i * 101, baseP << i));
  // u,v in [0,1)
  return (u, v) => {
    let s = 0, a = 0.5, tot = 0;
    for (let i = 0; i < oct; i++) {
      const p = baseP << i;
      s += a * ns[i](u * p, v * p); tot += a; a *= 0.5;
    }
    return s / tot;
  };
}
export function hexToRgb(hex) {
  const c = new THREE.Color(hex);
  return [c.r * 255, c.g * 255, c.b * 255];
}

// ---------- materials ----------
const matCache = new Map();
export function mat(key, make) {
  if (!matCache.has(key)) matCache.set(key, make());
  return matCache.get(key);
}
export function std(color, o = {}) {
  const key = 'std:' + color + ':' + JSON.stringify(o, (k, v) => (v && v.isTexture ? v.uuid : v));
  return mat(key, () => new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0, ...o }));
}
export function allMaterials() { return matCache; }

// ---------- geometry helpers ----------
// Box with UVs scaled in feet so tiling textures keep real-world scale.
export function boxGeo(w, h, d, uvScale = 1) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  // face order: +x, -x, +y, -y, +z, -z (4 verts each)
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) {
    for (let i = 0; i < 4; i++) {
      const idx = f * 4 + i;
      uv.setXY(idx, uv.getX(idx) * dims[f][0] * uvScale, uv.getY(idx) * dims[f][1] * uvScale);
    }
  }
  return g;
}
export function mesh(geo, material, parent, x = 0, y = 0, z = 0, opts = {}) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  if (opts.rx) m.rotation.x = opts.rx;
  if (opts.ry) m.rotation.y = opts.ry;
  if (opts.rz) m.rotation.z = opts.rz;
  if (opts.order) m.rotation.order = opts.order;
  m.castShadow = opts.cast !== false;
  m.receiveShadow = opts.receive !== false;
  if (opts.noMerge) m.userData.noMerge = true;
  if (parent) parent.add(m);
  return m;
}
// box whose bottom sits at y
export function B(p, w, h, d, material, x = 0, y = 0, z = 0, opts = {}) {
  return mesh(boxGeo(w, h, d, opts.uv ?? 1), material, p, x, y + h / 2, z, opts);
}
// cylinder whose bottom sits at y
export function C(p, rTop, rBot, h, material, x = 0, y = 0, z = 0, opts = {}) {
  const g = new THREE.CylinderGeometry(rTop, rBot, h, opts.seg ?? 18, 1, opts.open ?? false);
  return mesh(g, material, p, x, y + h / 2, z, opts);
}
// blob (icosahedron) centered at x,y,z
export function blob(p, r, material, x, y, z, sx = 1, sy = 1, sz = 1, detail = 1, opts = {}) {
  const g = new THREE.IcosahedronGeometry(r, detail);
  const m = mesh(g, material, p, x, y, z, opts);
  m.scale.set(sx, sy, sz);
  return m;
}
// beam between two 3D points (square or round)
export function beam(p, a, b, size, material, round = false, opts = {}) {
  const A = new THREE.Vector3(...a), Bv = new THREE.Vector3(...b);
  const len = A.distanceTo(Bv);
  const g = round ? new THREE.CylinderGeometry(size / 2, size / 2, len, opts.seg ?? 8) : boxGeo(size, len, size);
  const m = mesh(g, material, p, 0, 0, 0, opts);
  m.position.copy(A).add(Bv).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), Bv.clone().sub(A).normalize());
  return m;
}

// Merge static meshes by material to keep draw calls low.
export function optimize(root) {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const groups = new Map();
  const remove = [];
  root.traverse((o) => {
    if (!o.isMesh || o.userData.noMerge || o.isInstancedMesh || o.isSkinnedMesh) return;
    if (Array.isArray(o.material)) return;
    let skip = false;
    for (let p = o.parent; p && p !== root; p = p.parent) if (p.userData.noMerge) skip = true;
    if (skip) return;
    const key = o.material.uuid + (o.castShadow ? 'c' : '') + (o.receiveShadow ? 'r' : '') + (o.renderOrder || 0);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(o);
  });
  for (const [, list] of groups) {
    if (list.length < 2) continue;
    const geos = [];
    for (const o of list) {
      let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
      const keep = ['position', 'normal', 'uv'];
      for (const k of Object.keys(g.attributes)) if (!keep.includes(k)) g.deleteAttribute(k);
      if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
      if (!g.attributes.normal) g.computeVertexNormals();
      g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld));
      geos.push(g);
      remove.push(o);
    }
    const merged = mergeGeometries(geos, false);
    geos.forEach((g) => g.dispose());
    if (!merged) { remove.length -= list.length; continue; }
    const m = new THREE.Mesh(merged, list[0].material);
    m.castShadow = list[0].castShadow; m.receiveShadow = list[0].receiveShadow; m.renderOrder = list[0].renderOrder;
    root.add(m);
  }
  for (const o of remove) { o.parent && o.parent.remove(o); o.geometry.dispose(); }
  return root;
}

export function disposeObject(obj) {
  obj.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
  });
}

// polygon helpers (points as [x,z])
export function polyArea(pts) {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, z1] = pts[i], [x2, z2] = pts[(i + 1) % pts.length];
    a += x1 * z2 - x2 * z1;
  }
  return Math.abs(a) / 2;
}
export function polyLength(pts, closed = false) {
  let L = 0;
  for (let i = 0; i < pts.length - (closed ? 0 : 1); i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    L += Math.hypot(b[0] - a[0], b[1] - a[1]);
  }
  return L;
}
export function centroid(pts) {
  let x = 0, z = 0;
  for (const p of pts) { x += p[0]; z += p[1]; }
  return [x / pts.length, z / pts.length];
}
export function pointInPoly(x, z, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, zi] = pts[i], [xj, zj] = pts[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}
export function segDist(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az;
  const L2 = dx * dx + dz * dz || 1e-9;
  let t = ((px - ax) * dx + (pz - az) * dz) / L2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), pz - (az + t * dz));
}
// Smooth a polyline with Catmull-Rom; returns array of [x,z]
export function smoothPath(pts, closed, perSeg = 8) {
  if (pts.length < 3) return pts.map((p) => [...p]);
  const v = pts.map((p) => new THREE.Vector3(p[0], 0, p[1]));
  const curve = new THREE.CatmullRomCurve3(v, closed, 'centripetal', 0.5);
  const n = Math.max(8, Math.round(curve.getLength() * 1.5), pts.length * perSeg);
  return curve.getSpacedPoints(n).map((p) => [p.x, p.z]).slice(0, closed ? -1 : undefined);
}
