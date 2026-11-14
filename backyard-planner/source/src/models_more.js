import * as THREE from 'three';
import { std, B, C, blob, beam, mesh, boxGeo, rng, makeCanvas, toTexture } from './core.js';
import { tex, texTiled } from './textures.js';
import { facesGeo, gableGeo, polyGeo, circlePts, roundedRectPts, stonePts, ribbonGeo } from './geo.js';
import { bulbMat, addGlow, addPool, emitter, addFlames, LIGHT_COLORS, lightState } from './fx.js';
import { buildFenceLine, leafMat, wallWindow } from './models_site.js';
import { BUILDERS, waterMat, poolShell, poolLadder, setFloatsHook } from './models_items.js';

const DS = THREE.DoubleSide;
const PI = Math.PI;
const T = (name, ...a) => std('#ffffff', { map: tex(name, ...a) });
const blackMetal = () => std('#222222', { metalness: 0.5, roughness: 0.5 });
const steel = () => std('#c9cbcc', { metalness: 0.85, roughness: 0.3 });
const FRAMES = { wicker: '#5b4636', teak: '#8a5a36', modern: '#2e2e2e', white: '#ecebe6', black: '#262626' };
const frameMat = (f) => (f === 'teak' ? std('#8a5a36', { roughness: 0.8 }) : f === 'wicker' ? std('#5b4636', { roughness: 0.95 }) : std(FRAMES[f] || '#2e2e2e', { roughness: 0.6, metalness: f === 'black' ? 0.3 : 0 }));

// Upholstered seating run along local x, facing +z (back at -z)
function seatRun(g, x, z, L, depth, ry, fr, cu, opts = {}) {
  const s = new THREE.Group(); s.position.set(x, 0, z); s.rotation.y = ry; g.add(s);
  const seatH = 1.25;
  B(s, L, seatH, depth, fr, 0, 0, 0);
  const n = Math.max(1, Math.round(L / 2.4));
  for (let i = 0; i < n; i++) {
    const cw = (L - (opts.arms ? 1 : 0.15)) / n;
    const cx = -L / 2 + (opts.arms ? 0.5 : 0.075) + cw * (i + 0.5);
    B(s, cw - 0.06, 0.45, depth - 0.75, cu, cx, seatH, 0.3);
    B(s, cw - 0.12, 1.25, 0.5, cu, cx, seatH + 0.35, -depth / 2 + 0.75);
  }
  B(s, L, 1.3, 0.55, fr, 0, seatH, -depth / 2 + 0.27);
  if (opts.arms) for (const sx of [-1, 1]) B(s, 0.5, 0.75, depth, fr, sx * (L / 2 - 0.25), seatH, 0);
  if (opts.pillows) {
    const pm = std(opts.pillows, { roughness: 1 });
    for (const sx of [-1, 1]) mesh(boxGeo(1.0, 1.0, 0.3), pm, s, sx * (L / 2 - 1.1), seatH + 0.95, -depth / 2 + 1.1, { rz: sx * 0.2, rx: -0.2 });
  }
  return s;
}
function coffeeTable(g, x, z, w, d, h, material, ry = 0) {
  const t = new THREE.Group(); t.position.set(x, 0, z); t.rotation.y = ry; g.add(t);
  if (material === 'stone') { B(t, w, h, d, T('stone', 'gray'), 0, 0, 0); return t; }
  if (material === 'concrete') { B(t, w, h, d, T('concrete', '#a7a198'), 0, 0, 0); return t; }
  const top = material === 'glass' ? std('#bcd6dc', { transparent: true, opacity: 0.45, roughness: 0.05, metalness: 0.2, depthWrite: false }) : T('deck', material === 'teak' ? 'cedar' : 'walnut');
  const leg = material === 'glass' ? blackMetal() : frameMat('teak');
  B(t, w, 0.12, d, top, 0, h - 0.12, 0, material === 'glass' ? { noMerge: true } : {});
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) B(t, 0.14, h - 0.12, 0.14, leg, sx * (w / 2 - 0.15), 0, sz * (d / 2 - 0.15));
  B(t, w - 0.3, 0.08, d - 0.3, leg, 0, 0.35, 0);
  return t;
}
function barStool(g, x, z, seat = '#3a2c22') {
  const s = new THREE.Group(); s.position.set(x, 0, z); g.add(s);
  C(s, 0.6, 0.6, 0.18, std(seat), 0, 2.4, 0, { seg: 14 });
  C(s, 0.06, 0.06, 2.4, blackMetal(), 0, 0, 0, { seg: 6 });
  C(s, 0.5, 0.5, 0.06, blackMetal(), 0, 0, 0, { seg: 12 });
  mesh(new THREE.TorusGeometry(0.4, 0.04, 4, 14), blackMetal(), s, 0, 0.9, 0, { rx: PI / 2 });
}
function chicken(g, x, z, ry, color = '#f4f1e8') {
  const c = new THREE.Group(); c.position.set(x, 0, z); c.rotation.y = ry; g.add(c);
  blob(c, 0.32, std(color, { flatShading: true }), 0, 0.42, 0, 1.25, 1, 0.9, 0);
  blob(c, 0.17, std(color, { flatShading: true }), 0.3, 0.75, 0, 1, 1, 1, 0);
  blob(c, 0.07, std('#d8342b'), 0.33, 0.93, 0, 1, 1.2, 0.5, 0, { cast: false });
  mesh(new THREE.ConeGeometry(0.05, 0.14, 4), std('#e8a62a'), c, 0.48, 0.74, 0, { rz: -PI / 2, cast: false });
  for (const sz of [-0.1, 0.1]) beam(c, [0, 0.12, sz], [0, 0.0, sz], 0.03, std('#e8a62a'), true, { cast: false });
}

let _movieTex;
function movieTexture() {
  if (_movieTex) return _movieTex;
  const c = makeCanvas(512, 288), ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, 288);
  g.addColorStop(0, '#1b2a5a'); g.addColorStop(0.55, '#e0794a'); g.addColorStop(0.62, '#f5c46b'); g.addColorStop(1, '#2b2140');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 512, 288);
  ctx.fillStyle = '#fff3c4'; ctx.beginPath(); ctx.arc(330, 165, 34, 0, PI * 2); ctx.fill();
  ctx.fillStyle = '#171427';
  ctx.beginPath(); ctx.moveTo(0, 200); for (let x = 0; x <= 512; x += 32) ctx.lineTo(x, 190 - Math.sin(x * 0.02) * 22 - (x % 64 ? 8 : 0)); ctx.lineTo(512, 288); ctx.lineTo(0, 288); ctx.fill();
  _movieTex = toTexture(c, { repeat: false });
  return _movieTex;
}
let _screenMat;
export function screenMat() {
  if (!_screenMat) _screenMat = new THREE.MeshStandardMaterial({ color: '#f4f4f2', roughness: 0.9, emissive: '#ffffff', emissiveMap: movieTexture(), emissiveIntensity: 0 });
  return _screenMat;
}
let _greenTex;
function puttingTex() {
  if (_greenTex) return _greenTex;
  const S = 256, c = makeCanvas(S), ctx = c.getContext('2d');
  ctx.fillStyle = '#4f9a3a'; ctx.fillRect(0, 0, S, S);
  const r = rng(5);
  for (let i = 0; i < 9000; i++) { const l = r(); ctx.fillStyle = l < 0.5 ? 'rgba(40,110,40,0.5)' : 'rgba(110,170,80,0.45)'; ctx.fillRect(r() * S, r() * S, 1.2, 1.2); }
  for (let i = 0; i < 8; i++) { ctx.fillStyle = i % 2 ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.03)'; ctx.fillRect(0, (i * S) / 8, S, S / 8); }
  _greenTex = toTexture(c);
  _greenTex.repeat.set(1 / 4, 1 / 4);
  return _greenTex;
}
function blobOutline(w, d, r, n = 28, wob = 0.12) {
  const pts = [];
  const ph = r() * 6;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * PI * 2;
    const k = 1 + wob * Math.sin(a * 2 + ph) + wob * 0.6 * Math.sin(a * 3 + ph * 2);
    pts.push([Math.cos(a) * w / 2 * k * 0.92, Math.sin(a) * d / 2 * k * 0.92]);
  }
  return pts;
}

export const MORE_BUILDERS = {
  // ===== furniture =====
  sofa(p) {
    const g = new THREE.Group();
    seatRun(g, 0, 0, p.w, p.d, 0, frameMat(p.frame), std(p.color || '#d9d3c4', { roughness: 0.98 }), { arms: true, pillows: p.pillows !== false ? (p.accent || '#c9a24a') : null });
    return g;
  },
  club_chair(p) {
    const g = new THREE.Group();
    seatRun(g, 0, 0, p.w, p.d, 0, frameMat(p.frame), std(p.color || '#d9d3c4', { roughness: 0.98 }), { arms: true });
    return g;
  },
  coffee_table(p) { const g = new THREE.Group(); coffeeTable(g, 0, 0, p.w, p.d, p.h, p.material); return g; },
  side_table(p) {
    const g = new THREE.Group();
    const m = p.material === 'teak' ? frameMat('teak') : p.material === 'white' ? std('#ecebe6') : blackMetal();
    C(g, p.w / 2, p.w / 2, 0.1, m, 0, p.h - 0.1, 0, { seg: 20 });
    C(g, 0.08, 0.08, p.h - 0.1, m, 0, 0, 0, { seg: 8 });
    C(g, p.w / 2.6, p.w / 2.6, 0.06, m, 0, 0, 0, { seg: 16 });
    return g;
  },
  conversation_set(p) {
    const g = new THREE.Group();
    const { w, d } = p;
    const fr = frameMat(p.frame), cu = std(p.color || '#d9d3c4', { roughness: 0.98 });
    const sofaL = Math.min(7.5, w - 1);
    seatRun(g, 0, -d / 2 + 1.5, sofaL, 3, 0, fr, cu, { arms: true, pillows: p.accent || '#c9a24a' });
    seatRun(g, -w / 2 + 1.5, d / 2 - 2.0, 3, 3, PI * 0.8, fr, cu, { arms: true });
    seatRun(g, w / 2 - 1.5, d / 2 - 2.0, 3, 3, -PI * 0.8, fr, cu, { arms: true });
    if (p.table === 'fire') {
      B(g, 3.6, 1.3, 2.2, T('stone', 'gray'), 0, 0, 0.6);
      const f = addFlames(g, 0, 1.3, 0.6, 0.5, 3); g.userData.ticks = [f.userData.tick];
      emitter(g, [0, 2.2, 0.6], { color: LIGHT_COLORS.fire, intensity: 7, distance: 14, priority: 4, flicker: true, always: true });
    } else coffeeTable(g, 0, 0.6, 3.6, 2.2, 1.4, p.table === 'stone' ? 'stone' : 'teak');
    if (p.rug) mesh(new THREE.PlaneGeometry(w - 0.5, d - 0.5), rugMat(p.rug), g, 0, 0.03, 0, { rx: -PI / 2, cast: false });
    return g;
  },
  daybed(p) {
    const g = new THREE.Group();
    const { w, d } = p;
    const fr = frameMat(p.frame), cu = std(p.color || '#ecebe6', { roughness: 0.98 });
    B(g, w, 1.1, d, fr, 0, 0, 0);
    B(g, w - 0.3, 0.55, d - 0.3, cu, 0, 1.1, 0);
    B(g, w - 0.3, 1.4, 0.5, cu, 0, 1.6, -d / 2 + 0.4);
    const pm = std(p.accent || '#2f4f6f', { roughness: 1 });
    for (const sx of [-1.5, 0, 1.5]) mesh(boxGeo(1.2, 1.2, 0.35), pm, g, sx * (w / 5), 2.3, -d / 2 + 0.9, { rx: -0.25 });
    if (p.canopy !== false) {
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) B(g, 0.22, 7, 0.22, fr, sx * (w / 2 - 0.11), 0, sz * (d / 2 - 0.11));
      for (const sz of [-1, 1]) B(g, w, 0.25, 0.22, fr, 0, 7, sz * (d / 2 - 0.11));
      for (const sx of [-1, 1]) B(g, 0.22, 0.25, d, fr, sx * (w / 2 - 0.11), 7, 0);
      mesh(new THREE.PlaneGeometry(w, d), std(p.color || '#ecebe6', { side: DS, roughness: 1 }), g, 0, 7.3, 0, { rx: -PI / 2 });
      const fab = std('#f4f1ea', { side: DS, roughness: 1, transparent: true, opacity: 0.85 });
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        const pl = new THREE.PlaneGeometry(1.2, 6.4, 6, 1);
        const pos = pl.attributes.position; for (let i = 0; i < pos.count; i++) pos.setZ(i, Math.sin(pos.getX(i) * 7) * 0.08);
        pl.computeVertexNormals();
        mesh(pl, fab, g, sx * (w / 2 - 0.4), 3.75, sz * (d / 2 - 0.2), { ry: sx * 0.6, noMerge: true });
      }
    }
    return g;
  },
  egg_chair(p) {
    const g = new THREE.Group();
    const m = blackMetal();
    C(g, 1.1, 1.2, 0.18, m, 0, 0, 0, { seg: 18 });
    beam(g, [0, 0.15, -0.9], [0, 6.2, -0.9], 0.16, m, true);
    beam(g, [0, 6.2, -0.9], [0, 6.6, 0.2], 0.16, m, true);
    beam(g, [0, 6.55, 0.2], [0, 5.3, 0.2], 0.04, std('#777', { metalness: 0.8 }), true, { cast: false });
    const basket = new THREE.SphereGeometry(1.35, 20, 14, 0, PI * 2, 0, PI * 0.78);
    const wick = std(p.color === 'white' ? '#e8e3d6' : p.color === 'natural' ? '#b48a5a' : '#2a2724', { side: DS, roughness: 0.95, flatShading: true });
    const bm = mesh(basket, wick, g, 0, 3.4, 0.2, { rx: -PI / 2 - 0.35 });
    bm.scale.set(1, 1, 1.25);
    blob(g, 1.0, std(p.cushion || '#d9d3c4', { roughness: 1 }), 0, 2.75, 0.45, 1, 0.35, 0.95, 1);
    blob(g, 0.85, std(p.cushion || '#d9d3c4', { roughness: 1 }), 0, 3.6, -0.2, 0.9, 0.9, 0.35, 1);
    return g;
  },
  porch_swing(p) {
    const g = new THREE.Group();
    const { w, d } = p;
    const fr = p.frame === 'white' ? std('#ecebe6') : frameMat('teak');
    for (const sx of [-1, 1]) {
      beam(g, [sx * w / 2, 0, -d / 2], [sx * w / 2, 7, 0], 0.32, fr);
      beam(g, [sx * w / 2, 0, d / 2], [sx * w / 2, 7, 0], 0.32, fr);
      B(g, 0.3, 0.25, d, fr, sx * w / 2, 0, 0);
    }
    beam(g, [-w / 2, 7, 0], [w / 2, 7, 0], 0.35, fr);
    const seatL = w - 1.6;
    const sw = new THREE.Group(); sw.position.set(0, 1.5, 0); g.add(sw);
    for (let i = 0; i < 4; i++) B(sw, seatL, 0.1, 0.4, fr, 0, 0, -0.75 + i * 0.5);
    const back = new THREE.Group(); back.position.set(0, 0, -1.0); back.rotation.x = -0.25; sw.add(back);
    for (let i = 0; i < 4; i++) B(back, seatL, 0.35, 0.1, fr, 0, 0.3 + i * 0.45, 0);
    for (const sx of [-1, 1]) { B(sw, 0.2, 1.1, 2.0, fr, sx * seatL / 2, 0.1, -0.1); beam(g, [sx * seatL / 2, 2.6, -0.2], [sx * seatL / 2, 7, 0], 0.04, std('#888', { metalness: 0.8 }), true, { cast: false }); }
    B(sw, seatL - 0.3, 0.3, 1.5, std(p.cushion || '#d9d3c4', { roughness: 1 }), 0, 0.1, -0.1);
    if (p.canopy !== false) {
      const fab = std(p.canopyColor || '#3d6f8a', { side: DS, roughness: 1 });
      mesh(facesGeo([[[-w / 2 - 0.3, 7.6, -d / 2 + 0.4], [w / 2 + 0.3, 7.6, -d / 2 + 0.4], [w / 2 + 0.3, 8.2, 0], [-w / 2 - 0.3, 8.2, 0]], [[-w / 2 - 0.3, 8.2, 0], [w / 2 + 0.3, 8.2, 0], [w / 2 + 0.3, 7.6, d / 2 - 0.4], [-w / 2 - 0.3, 7.6, d / 2 - 0.4]]]), fab, g);
    }
    return g;
  },
  rocking_chair(p) {
    const g = new THREE.Group();
    const m = std(p.color || '#ecebe6', { roughness: 0.7 });
    for (const sx of [-1, 1]) {
      const arc = [];
      for (let i = 0; i <= 8; i++) { const z = -1.5 + (i / 8) * 3.0; arc.push([sx * 0.85, 0.1 + z * z * 0.09, z]); }
      for (let i = 0; i < arc.length - 1; i++) beam(g, arc[i], arc[i + 1], 0.12, m);
      B(g, 0.14, 1.5, 0.14, m, sx * 0.85, 0.15, 0.7);
      B(g, 0.14, 3.4, 0.14, m, sx * 0.85, 0.15, -0.75);
      B(g, 0.25, 0.08, 1.9, m, sx * 0.9, 2.2, 0.05);
    }
    for (let i = 0; i < 5; i++) B(g, 1.8, 0.08, 0.3, m, 0, 1.6, -0.6 + i * 0.32);
    for (let i = 0; i < 6; i++) B(g, 0.18, 1.8, 0.06, m, -0.7 + i * 0.28, 1.7, -0.8);
    B(g, 1.9, 0.2, 0.1, m, 0, 3.45, -0.8);
    return g;
  },
  bar_set(p) {
    const g = new THREE.Group();
    const m = p.color === 'teak' ? frameMat('teak') : blackMetal();
    C(g, 1.6, 1.6, 0.12, p.color === 'teak' ? T('deck', 'cedar') : std('#2b2b2b', { roughness: 0.3 }), 0, 3.4, 0, { seg: 22 });
    C(g, 0.12, 0.12, 3.4, m, 0, 0, 0, { seg: 8 });
    C(g, 0.8, 0.8, 0.08, m, 0, 0, 0, { seg: 14 });
    const n = p.stools || 4;
    for (let i = 0; i < n; i++) { const a = (i / n) * PI * 2 + PI / 4; barStool(g, Math.cos(a) * 2.3, Math.sin(a) * 2.3, p.color === 'teak' ? '#8a5a36' : '#3a2c22'); }
    return g;
  },
  picnic_table(p) {
    const g = new THREE.Group();
    const { w } = p;
    const m = p.color === 'red' ? std('#9b3a2e') : p.color === 'green' ? std('#2d5a3d') : T('deck', 'cedar');
    for (let i = 0; i < 5; i++) B(g, w, 0.12, 0.5, m, 0, 2.4, -1.05 + i * 0.52);
    for (const sz of [-1, 1]) for (let i = 0; i < 2; i++) B(g, w, 0.12, 0.45, m, 0, 1.45, sz * (2.15 + i * 0.47 - 0.23));
    for (const sx of [-1, 1]) {
      const x = sx * (w / 2 - 0.8);
      beam(g, [x, 0, -2.4], [x, 2.4, -0.3], 0.25, m);
      beam(g, [x, 0, 2.4], [x, 2.4, 0.3], 0.25, m);
      B(g, 0.25, 0.25, 5.4, m, x, 1.2, 0);
    }
    return g;
  },
  outdoor_rug(p) {
    const g = new THREE.Group();
    mesh(new THREE.PlaneGeometry(p.w, p.d), rugMat(p.pattern || 'stripes', p.color), g, 0, 0.035, 0, { rx: -PI / 2, cast: false });
    return g;
  },
  deck_box(p) {
    const g = new THREE.Group();
    const m = std(p.color === 'brown' ? '#5b4636' : '#6f6d69', { roughness: 0.8 });
    B(g, p.w, p.h - 0.2, p.d, m, 0, 0, 0);
    B(g, p.w + 0.1, 0.2, p.d + 0.1, std(p.color === 'brown' ? '#4a392c' : '#5a5855'), 0, p.h - 0.2, 0);
    return g;
  },
  bean_bags(p) {
    const g = new THREE.Group();
    const cols = [p.color || '#c84b3a', p.color2 || '#3d6f8a'];
    [-1, 1].forEach((s, i) => { const m = std(cols[i], { roughness: 1 }); blob(g, 1.4, m, s * 1.6, 0.7, 0, 1, 0.55, 1, 2); blob(g, 1.0, m, s * 1.6, 1.4, -0.7, 1, 0.7, 0.6, 1); });
    return g;
  },
  cantilever_umbrella(p) {
    const g = new THREE.Group();
    const W = p.w;
    const fab = std(p.color || '#d9c9a3', { roughness: 0.9, side: DS, flatShading: true });
    const m = std('#3a3a3a', { metalness: 0.5, roughness: 0.4 });
    for (const sx of [-1, 1]) B(g, 0.3, 0.3, 3.2, m, sx * 0.9 - W / 2 + 0.2, 0, 0);
    B(g, 2.2, 0.3, 0.3, m, -W / 2 + 0.2, 0, 0);
    const px = -W / 2 + 0.2;
    beam(g, [px, 0.3, 0], [px, 7.8, 0], 0.22, m, true);
    beam(g, [px, 7.6, 0], [0, 8.2, 0], 0.14, m, true);
    const can = new THREE.ConeGeometry(W / 2 * 1.41, 1.2, 4, 1, true);
    can.rotateY(PI / 4);
    mesh(can, fab, g, 0, 8.0, 0);
    return g;
  },
  // ===== water & wellness =====
  pool_rect(p) {
    const g = new THREE.Group();
    const { w, d, h } = p;
    poolShell(g, roundedRectPts(w, d, 0.35, 2), h, p.style, false);
    const longX = w >= d;
    const side = p.ladder === 'short' ? !longX : longX;
    if (side) poolLadder(g, 0, d / 2, h, 0); else poolLadder(g, w / 2, 0, h, PI / 2);
    if (p.floats) poolFloats(g, Math.min(w, d) * 0.3, h);
    return g;
  },
  cold_plunge(p) {
    const g = new THREE.Group();
    const { w, d, h } = p;
    const shell = std(p.color === 'wood' ? '#8a5a36' : '#2f3236', { roughness: 0.5, metalness: p.color === 'wood' ? 0 : 0.3 });
    B(g, w, h, d, p.color === 'wood' ? T('deck', 'cedar') : shell, 0, 0, 0);
    B(g, w - 0.5, 0.05, d - 0.5, std('#e9eef0'), 0, h - 0.02, 0);
    mesh(new THREE.PlaneGeometry(w - 0.6, d - 0.6), waterMat(), g, 0, h - 0.25, 0, { rx: -PI / 2, cast: false, noMerge: true });
    B(g, 1.6, 1.6, 1.4, std('#d9dcde', { metalness: 0.3, roughness: 0.4 }), w / 2 + 1.1, 0, 0);
    return g;
  },
  sauna(p) {
    const g = new THREE.Group();
    const R = p.w / 2, L = p.d;
    const wood = T('deck', p.wood === 'dark' ? 'walnut' : 'cedar');
    const barrel = new THREE.CylinderGeometry(R, R, L, 28, 1, false);
    barrel.rotateX(PI / 2);
    const uv = barrel.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 2 * PI * R, uv.getY(i) * L);
    mesh(barrel, wood, g, 0, R + 0.5, 0);
    const band = std('#2b2b2b', { metalness: 0.6 });
    for (const z of [-L / 2 + 0.8, L / 2 - 0.8]) mesh(new THREE.TorusGeometry(R + 0.03, 0.05, 6, 28), band, g, 0, R + 0.5, z);
    for (const z of [-L / 2 + 1, L / 2 - 1]) B(g, R * 1.6, 0.5, 0.6, wood, 0, 0, z);
    B(g, 2.2, 5.6, 0.12, std('#2f2621'), 0, 0.6, L / 2 + 0.02);
    mesh(new THREE.PlaneGeometry(1.0, 2.8), std('#b9c9cf', { metalness: 0.4, roughness: 0.1 }), g, 0, 3.3, L / 2 + 0.1, { cast: false });
    C(g, 0.25, 0.25, 2.2, std('#3a3a3a', { metalness: 0.6 }), R * 0.4, R * 1.9 + 0.3, -L / 4, { seg: 10 });
    if (p.porch !== false) { B(g, R * 2, 0.25, 2.5, wood, 0, 0, L / 2 + 1.25); }
    return g;
  },
  outdoor_shower(p) {
    const g = new THREE.Group();
    const { w, d } = p;
    const wood = T('deck', 'cedar');
    B(g, w, 0.25, d, wood, 0, 0, 0);
    const sides = [[[-w / 2, -d / 2], [w / 2, -d / 2]], [[-w / 2, -d / 2], [-w / 2, d / 2]], [[w / 2, -d / 2], [w / 2, d / 2]]];
    for (const [a, b] of sides) {
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]); const n = Math.floor(6.2 / 0.45);
      for (let i = 0; i < n; i++) { const grp = new THREE.Group(); grp.position.set((a[0] + b[0]) / 2, 0.8 + i * 0.45, (a[1] + b[1]) / 2); grp.rotation.y = -Math.atan2(b[1] - a[1], b[0] - a[0]); g.add(grp); B(grp, L, 0.36, 0.1, wood, 0, 0, 0); }
    }
    for (const [x, z] of [[-w / 2, -d / 2], [w / 2, -d / 2], [-w / 2, d / 2], [w / 2, d / 2]]) B(g, 0.3, 7.2, 0.3, wood, x, 0, z);
    const ss = steel();
    beam(g, [0, 0.3, -d / 2 + 0.25], [0, 7.4, -d / 2 + 0.25], 0.1, ss, true);
    beam(g, [0, 7.4, -d / 2 + 0.25], [0, 7.4, 0.2], 0.08, ss, true);
    C(g, 0.4, 0.3, 0.12, ss, 0, 7.25, 0.2, { seg: 14 });
    return g;
  },
  koi_pond(p, r) {
    const g = new THREE.Group();
    const out = blobOutline(p.w, p.d, r, 30, 0.14);
    mesh(polyGeo(out, 0.03), std('#20323a', { roughness: 0.3 }), g, 0, 0, 0, { cast: false });
    mesh(polyGeo(out.map(([x, z]) => [x * 0.96, z * 0.96]), 0.18), waterMat(), g, 0, 0, 0, { cast: false, noMerge: true });
    const st = [std('#cdbf9e', { flatShading: true }), std('#a89a80', { flatShading: true }), std('#8e8a83', { flatShading: true })];
    for (let i = 0; i < out.length; i++) { const [x, z] = out[i]; blob(g, 0.55 + r() * 0.35, st[i % 3], x * 1.04, 0.15, z * 1.04, 1.3, 0.6, 1, 0); }
    // waterfall stack
    const [wx, wz] = out[Math.floor(out.length * 0.6)];
    for (let i = 0; i < 4; i++) blob(g, 1.0 - i * 0.18, st[i % 3], wx * 1.05, 0.4 + i * 0.6, wz * 1.05, 1.2, 0.7, 1, 0);
    const lily = leafMat('#4f8a3a');
    for (let i = 0; i < 6; i++) { const a = r() * PI * 2, rr = r() * 0.5; mesh(new THREE.CircleGeometry(0.45, 10, 0.3, PI * 1.85), lily, g, Math.cos(a) * rr * p.w / 2, 0.2, Math.sin(a) * rr * p.d / 2, { rx: -PI / 2, cast: false }); }
    const fishM = std('#f08a2a', { roughness: 0.4, emissive: '#5a2000', emissiveIntensity: 0.3 });
    for (let i = 0; i < 4; i++) { const a = r() * PI * 2, rr = 0.2 + r() * 0.4; const f = blob(g, 0.25, i % 2 ? fishM : std('#f4f1ea'), Math.cos(a) * rr * p.w / 2, 0.12, Math.sin(a) * rr * p.d / 2, 1.8, 0.4, 0.7, 0, { cast: false }); f.rotation.y = r() * 6; }
    return g;
  },
  // ===== fire =====
  patio_heater(p) {
    const g = new THREE.Group();
    const H = p.h || 7.5;
    const m = std(p.color === 'bronze' ? '#5a4636' : '#9ea3a5', { metalness: 0.7, roughness: 0.35 });
    C(g, 0.95, 1.05, 0.35, m, 0, 0, 0, { seg: 18 });
    C(g, 0.6, 0.8, 1.4, m, 0, 0.35, 0, { seg: 18 });
    C(g, 0.12, 0.12, H - 2.6, m, 0, 1.7, 0, { seg: 10 });
    C(g, 0.3, 0.3, 0.6, bulbMat(LIGHT_COLORS.amber), 0, H - 1.0, 0, { seg: 12 });
    const hood = new THREE.ConeGeometry(1.6, 0.6, 20, 1, true);
    mesh(hood, std(p.color === 'bronze' ? '#5a4636' : '#9ea3a5', { metalness: 0.7, roughness: 0.35, side: DS }), g, 0, H - 0.2, 0);
    addGlow(g, 0, H - 0.7, 0, LIGHT_COLORS.amber, 1.8);
    emitter(g, [0, H - 0.8, 0], { color: LIGHT_COLORS.amber, intensity: 6, distance: 12, priority: 2 });
    return g;
  },
  chiminea(p) {
    const g = new THREE.Group();
    const clay = std(p.color === 'black' ? '#2b2826' : '#a8573a', { roughness: 0.9 });
    const prof = [[0, 0], [0.9, 0], [1.1, 0.5], [1.15, 1.2], [0.95, 1.9], [0.5, 2.3], [0.32, 2.6], [0.32, 4.6], [0.4, 4.7], [0, 4.7]].map(([x, y]) => new THREE.Vector2(x, y + 0.6));
    mesh(new THREE.LatheGeometry(prof, 20), clay, g);
    for (let i = 0; i < 3; i++) { const a = (i / 3) * PI * 2; beam(g, [Math.cos(a) * 0.7, 0, Math.sin(a) * 0.7], [Math.cos(a) * 0.5, 0.65, Math.sin(a) * 0.5], 0.1, blackMetal(), true); }
    B(g, 0.9, 0.7, 0.4, std('#1a1512'), 0, 1.2, 0.9);
    const f = addFlames(g, 0, 1.15, 0.6, 0.45, 2); g.userData.ticks = [f.userData.tick];
    emitter(g, [0, 1.8, 1.2], { color: LIGHT_COLORS.fire, intensity: 5, distance: 11, priority: 3, flicker: true, always: true });
    return g;
  },
  // ===== play & fun =====
  movie_screen(p) {
    const g = new THREE.Group();
    const W = p.w, H = W * 9 / 16;
    const fr = blackMetal();
    const bottom = 2.2;
    for (const sx of [-1, 1]) { beam(g, [sx * (W / 2 + 0.25), 0, 0], [sx * (W / 2 + 0.25), bottom + H + 0.3, 0], 0.2, fr, true); beam(g, [sx * (W / 2 + 0.25), 0, -2.2], [sx * (W / 2 + 0.25), bottom + H * 0.6, 0], 0.12, fr, true); }
    B(g, W + 0.6, 0.15, 0.15, fr, 0, bottom + H + 0.15, 0);
    B(g, W + 0.6, 0.15, 0.15, fr, 0, bottom - 0.3, 0);
    const scr = mesh(new THREE.PlaneGeometry(W, H), screenMat(), g, 0, bottom + H / 2, 0.06, { noMerge: true });
    mesh(new THREE.PlaneGeometry(W, H), std('#222', { side: THREE.BackSide }), g, 0, bottom + H / 2, 0.05, { cast: false });
    emitter(g, [0, bottom + H / 2, 3], { color: '#c8d8ff', intensity: 4, distance: 18, priority: 2 });
    if (p.projector !== false) {
      const pz = p.w * 1.1;
      const tbl = new THREE.Group(); tbl.position.set(0, 0, pz); g.add(tbl);
      C(tbl, 0.8, 0.8, 0.08, std('#2b2b2b'), 0, 2.4, 0, { seg: 14 }); C(tbl, 0.06, 0.06, 2.4, fr, 0, 0, 0, { seg: 6 });
      B(tbl, 0.9, 0.35, 0.7, std('#e8e8e8', { roughness: 0.4 }), 0, 2.48, 0);
    }
    return g;
  },
  playhouse(p) {
    const g = new THREE.Group();
    const { w, d } = p;
    const wallC = { blue: '#8fb3d1', yellow: '#f0d27a', white: '#f1efe9', green: '#a9c79a' }[p.color] || '#8fb3d1';
    const wall = std(wallC, { map: tex('lapSiding', '#ffffff') });
    const wallH = 5;
    B(g, w, 0.4, d + 1.5, T('deck', 'cedar'), 0, 0, 0.75);
    B(g, w, wallH, d, wall, 0, 0.4, 0);
    mesh(gableGeo(w, d, 2.4, true), wall, g, 0, wallH + 0.4, 0, { ry: PI / 2 });
    mesh(gableGeo(d + 0.8, w + 0.8, 2.6, false), std(p.roof || '#c84b3a', { side: DS }), g, 0, wallH + 0.42, 0, { ry: PI / 2 });
    B(g, 1.6, 3.8, 0.1, std('#ffffff'), -w / 4, 0.4, d / 2 + 0.02);
    wallWindow(g, w / 4, 2.2, d / 2 + 0.03, 1.4, 1.4, 0, { mullion: false, vbar: true });
    for (const sx of [-1, 1]) B(g, 0.2, 3.8, 0.2, std('#ffffff'), sx * (w / 2 - 0.1), 0.4, d / 2 + 1.35);
    return g;
  },
  ladder_toss(p) {
    const g = new THREE.Group();
    const m = std(p.color === 'blue' ? '#2f6fb0' : '#e8e4da', { roughness: 0.5 });
    for (const s of [-1, 1]) {
      const z = s * (p.d / 2 - 0.8);
      for (const sx of [-1, 1]) { beam(g, [sx * 1.4, 0, z - 0.7], [sx * 1.4, 4.2, z], 0.1, m, true); beam(g, [sx * 1.4, 0, z + 0.7], [sx * 1.4, 4.2, z], 0.1, m, true); }
      for (const y of [1.4, 2.6, 3.8]) beam(g, [-1.4, y, z], [1.4, y, z], 0.08, m, true);
    }
    const bm = std('#e8442b'), bm2 = std('#2f6fb0');
    for (let i = 0; i < 3; i++) { blob(g, 0.15, bm, -0.6 + i * 0.6, 2.4, p.d / 2 - 0.8, 1, 1, 1, 0, { cast: false }); blob(g, 0.15, bm2, -0.4 + i * 0.5, 0.15, -p.d / 2 + 2.5, 1, 1, 1, 0, { cast: false }); }
    return g;
  },
  basketball_hoop(p) {
    const g = new THREE.Group();
    const { w, d } = p;
    if (p.court !== false) {
      mesh(new THREE.PlaneGeometry(w, d), T('concrete', '#bdb6a8'), g, 0, 0.04, 0, { rx: -PI / 2, cast: false });
      const lineM = std('#ffffff', { roughness: 0.6 });
      const lane = Math.min(12, w - 2), laneD = Math.min(15, d - 2);
      for (const sx of [-1, 1]) B(g, 0.15, 0.02, laneD, lineM, sx * lane / 2, 0.045, -d / 2 + laneD / 2);
      B(g, lane, 0.02, 0.15, lineM, 0, 0.045, -d / 2 + laneD);
      const arc = new THREE.RingGeometry(5.85, 6.0, 32, 1, 0, PI);
      mesh(arc, lineM, g, 0, 0.046, -d / 2 + laneD, { rx: -PI / 2, cast: false });
      const three = new THREE.RingGeometry(Math.min(w, d) * 0.48 - 0.15, Math.min(w, d) * 0.48, 40, 1, 0.15, PI - 0.3);
      mesh(three, lineM, g, 0, 0.046, -d / 2 + 4, { rx: -PI / 2, cast: false });
    }
    const m = std('#2b2b2b', { metalness: 0.5 });
    const bz = -d / 2 + (p.court !== false ? 0.5 : d / 2);
    C(g, 0.22, 0.25, 10, m, 0, 0, bz - 1.6, { seg: 10 });
    beam(g, [0, 9.6, bz - 1.6], [0, 9.6, bz], 0.18, m);
    B(g, 6, 3.5, 0.12, std('#eef2f4', { transparent: true, opacity: 0.85, roughness: 0.1 }), 0, 8.2, bz, { noMerge: true });
    B(g, 2, 1.5, 0.13, std('#ffffff'), 0, 8.6, bz + 0.01);
    mesh(new THREE.TorusGeometry(0.75, 0.04, 6, 20), std('#e8551e', { metalness: 0.4 }), g, 0, 10, bz + 0.85, { rx: PI / 2 });
    const net = new THREE.CylinderGeometry(0.75, 0.5, 1.4, 12, 1, true);
    mesh(net, std('#ffffff', { map: texTiled('chainLink', 0.4, 0.4), alphaTest: 0.4, side: DS }), g, 0, 9.3, bz + 0.85, { cast: false });
    return g;
  },
  putting_green(p, r) {
    const g = new THREE.Group();
    const out = blobOutline(p.w, p.d, r, 32, 0.1);
    mesh(polyGeo(out.map(([x, z]) => [x * 1.08, z * 1.08]), 0.035), T('turf', 'lush'), g, 0, 0, 0, { cast: false });
    const green = mesh(polyGeo(out, 0.045), std('#ffffff', { map: puttingTex(), roughness: 0.85 }), g, 0, 0, 0, { cast: false });
    const holes = p.holes || 3;
    for (let i = 0; i < holes; i++) {
      const a = (i / holes) * PI * 2 + 0.6, rr = 0.42;
      const x = Math.cos(a) * p.w / 2 * rr, z = Math.sin(a) * p.d / 2 * rr;
      mesh(new THREE.CircleGeometry(0.2, 14), std('#111'), g, x, 0.05, z, { rx: -PI / 2, cast: false });
      beam(g, [x, 0, z], [x, 4.5, z], 0.05, std('#f2f2f2'), true);
      mesh(facesGeo([[[x, 4.5, z], [x + 1.1, 4.15, z], [x, 3.8, z]]]), std(['#d8342b', '#f2c230', '#2f6fb0'][i % 3], { side: DS }), g, 0, 0, 0, { cast: false });
    }
    for (let i = 0; i < 3; i++) blob(g, 0.08, std('#ffffff'), (r() - 0.5) * p.w * 0.4, 0.13, (r() - 0.5) * p.d * 0.4, 1, 1, 1, 0, { cast: false });
    return g;
  },
  chicken_coop(p, r) {
    const g = new THREE.Group();
    const { w, d } = p;
    const wood = T('deck', 'cedar');
    const red = std(p.color === 'white' ? '#ecebe6' : p.color === 'gray' ? '#8b8d8f' : '#9b3a2e');
    // coop house at the back (-z), raised
    const hw = Math.min(w, 5), hd = Math.min(d * 0.35, 4.5);
    const hz = -d / 2 + hd / 2;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) B(g, 0.3, 2, 0.3, wood, sx * (hw / 2 - 0.15), 0, hz + sz * (hd / 2 - 0.15));
    B(g, hw, 3.2, hd, red, 0, 2, hz);
    mesh(gableGeo(hw, hd, 1.6, true), red, g, 0, 5.2, hz);
    mesh(gableGeo(hw + 0.6, hd + 0.6, 1.7, false), T('shingles', '#3f4447'), g, 0, 5.22, hz);
    B(g, 1.0, 1.2, 0.08, std('#1a1a1a'), 0, 2.2, hz + hd / 2 + 0.01);
    beam(g, [0, 2.2, hz + hd / 2], [0, 0.05, hz + hd / 2 + 2.4], 0.9, wood);
    // run
    const runPts = [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]];
    buildFenceLine(g, runPts, 'wireFrame', 5, true);
    mesh(new THREE.PlaneGeometry(w, d), T('mulch', 'cedar'), g, 0, 0.035, 0, { rx: -PI / 2, cast: false });
    const n = p.hens ?? 4;
    const cols = ['#f4f1e8', '#b5652f', '#2b2b2b', '#c9a46a'];
    for (let i = 0; i < n; i++) chicken(g, (r() - 0.5) * (w - 1.5), hz + hd / 2 + 1 + r() * (d - hd - 2), r() * 6, cols[i % 4]);
    return g;
  },
  dog_agility(p) {
    const g = new THREE.Group();
    const { w, d } = p;
    const tm = std(p.color || '#2f6fb0', { roughness: 0.7, side: DS });
    const tun = new THREE.CylinderGeometry(1.2, 1.2, 8, 18, 6, true, 0, PI * 2);
    const pos = tun.attributes.position;
    for (let i = 0; i < pos.count; i++) { const y = pos.getY(i); const k = 1 + 0.06 * Math.cos(y * 3.2); pos.setX(i, pos.getX(i) * k); pos.setZ(i, pos.getZ(i) * k); }
    tun.computeVertexNormals();
    mesh(tun, tm, g, -w / 2 + 2, 1.1, 0, { rx: PI / 2 });
    const ym = std('#f2c230'), wm = std('#ffffff');
    for (const z of [-d / 2 + 2.5, d / 2 - 2.5]) {
      for (const sx of [-1, 1]) B(g, 0.15, 3, 0.15, wm, 1.5 + sx * 2, 0, z);
      beam(g, [-0.5, 1.8, z], [3.5, 1.8, z], 0.1, ym, true);
    }
    for (let i = 0; i < 6; i++) { const z = -2.5 + i * 1.0; C(g, 0.06, 0.06, 3.2, i % 2 ? ym : wm, w / 2 - 1.5, 0, z, { seg: 6 }); }
    B(g, 0.6, 0.1, 6, std('#2b2b2b'), w / 2 - 1.5, 0, 0);
    return g;
  },
  bird_feeder(p) {
    const g = new THREE.Group();
    const m = blackMetal();
    C(g, 0.05, 0.05, 6, m, 0, 0, 0, { seg: 6 });
    beam(g, [0, 5.8, 0], [0.9, 6.1, 0], 0.05, m, true);
    const fh = new THREE.Group(); fh.position.set(0.9, 4.9, 0); g.add(fh);
    B(fh, 0.7, 0.7, 0.7, std('#c99062'), 0, 0, 0);
    mesh(gableGeo(0.9, 0.9, 0.4, true), std('#2d5a3d', { side: DS }), fh, 0, 0.7, 0);
    blob(g, 0.12, std('#d8342b', { flatShading: true }), 1.35, 5.0, 0.1, 1.3, 0.9, 0.8, 0, { cast: false });
    return g;
  },
};

// pool floats: donut + lounger
export function poolFloats(g, R, H) {
  const wy = H - 0.45;
  mesh(new THREE.TorusGeometry(0.9, 0.35, 10, 20), std('#f06aa0', { roughness: 0.3 }), g, -R * 0.6, wy, R * 0.2, { rx: PI / 2, noMerge: true });
  B(g, 2.2, 0.35, 5.2, std('#f2c230', { roughness: 0.3 }), R * 0.5, wy - 0.1, -R * 0.3, { noMerge: true, ry: 0.5 });
}

const rugCache = new Map();
function rugMat(pattern = 'stripes', color = '#2f4f6f') {
  const key = pattern + color;
  if (!rugCache.has(key)) {
    const S = 256, c = makeCanvas(S), ctx = c.getContext('2d');
    ctx.fillStyle = '#ece6d8'; ctx.fillRect(0, 0, S, S);
    ctx.fillStyle = color;
    if (pattern === 'stripes') for (let i = 0; i < 8; i += 2) ctx.fillRect(0, (i * S) / 8, S, S / 8);
    else if (pattern === 'diamond') { for (let i = -2; i < 6; i++) for (let j = -2; j < 6; j++) { ctx.beginPath(); const x = i * 64 + (j % 2) * 32, y = j * 32; ctx.moveTo(x, y + 16); ctx.lineTo(x + 32, y); ctx.lineTo(x + 64, y + 16); ctx.lineTo(x + 32, y + 32); ctx.fill(); } }
    else { ctx.fillRect(0, 0, S, S); ctx.fillStyle = '#ece6d8'; ctx.fillRect(24, 24, S - 48, S - 48); ctx.fillStyle = color; ctx.fillRect(48, 48, S - 96, S - 96); }
    for (let i = 0; i < 6000; i++) { ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.06})`; ctx.fillRect(Math.random() * S, Math.random() * S, 1, 1); }
    const t = toTexture(c, { repeat: false });
    rugCache.set(key, new THREE.MeshStandardMaterial({ map: t, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2 }));
  }
  return rugCache.get(key);
}

Object.assign(BUILDERS, MORE_BUILDERS);
setFloatsHook(poolFloats);

// screen glow follows the night state
export function updateScreens() {
  if (_screenMat) _screenMat.emissiveIntensity = 0.12 + lightState().lights * 1.1;
}
