import * as THREE from 'three';
import { std, B, C, blob, beam, mesh, boxGeo, rng } from './core.js';
import { tex, texTiled } from './textures.js';
import { facesGeo, gableGeo, pyramidGeo, polyGeo, wallStripGeo, stadium, circlePts, roundedRectPts, stonePts, catenary, ribbonGeo } from './geo.js';
import { bulbMat, addPointGlows, addGlow, addPool, emitter, addFlames, beamMat, LIGHT_COLORS } from './fx.js';
import { buildFenceLine, FENCE_STYLES, fencePanel, buildTree, leafMat, buildShed, buildGazeboTop, wallWindow } from './models_site.js';

const DS = THREE.DoubleSide;
const T = (name, ...a) => std('#ffffff', { map: tex(name, ...a) });
const steel = () => std('#c9cbcc', { metalness: 0.85, roughness: 0.3 });
const blackMetal = () => std('#222222', { metalness: 0.5, roughness: 0.5 });
const PI = Math.PI;

// ---------------- surface materials ----------------
export const SURFACES = {
  pavers_tan: { label: 'Pavers, tan blend', m: () => T('pavers', 'running', 'tan') },
  pavers_gray: { label: 'Pavers, gray blend', m: () => T('pavers', 'running', 'gray') },
  pavers_basket: { label: 'Pavers, basket weave', m: () => T('pavers', 'basket', 'tan') },
  slab_gray: { label: 'Large gray slabs', m: () => T('pavers', 'slab', 'gray') },
  slab_charcoal: { label: 'Large charcoal slabs', m: () => T('pavers', 'slab', 'charcoal') },
  brick: { label: 'Red brick', m: () => T('pavers', 'running', 'red') },
  flagstone_buff: { label: 'Flagstone, limestone buff', m: () => T('flagstone', 'buff') },
  flagstone_red: { label: 'Flagstone, desert red', m: () => T('flagstone', 'red') },
  flagstone_blue: { label: 'Flagstone, bluestone', m: () => T('flagstone', 'blue') },
  gravel_pea: { label: 'Pea gravel', m: () => T('gravel', 'pea', 1) },
  gravel_white: { label: 'White marble chips', m: () => T('gravel', 'white', 1) },
  gravel_gray: { label: 'Gray crushed stone', m: () => T('gravel', 'gray', 1.3) },
  dg: { label: 'Decomposed granite', m: () => T('gravel', 'dg', 1) },
  river_rock: { label: 'River rock', m: () => T('gravel', 'river', 1) },
  lava: { label: 'Red lava rock', m: () => T('gravel', 'lava', 1.4) },
  mulch_brown: { label: 'Mulch, brown', m: () => T('mulch', 'brown') },
  mulch_black: { label: 'Mulch, black', m: () => T('mulch', 'black') },
  mulch_red: { label: 'Mulch, red', m: () => T('mulch', 'red') },
  mulch_cedar: { label: 'Mulch, cedar', m: () => T('mulch', 'cedar') },
  turf: { label: 'Artificial turf', m: () => T('turf', 'lush') },
  sod: { label: 'Fresh sod', m: () => T('turf', 'natural') },
  concrete: { label: 'Concrete', m: () => T('concrete', '#c9c0ad') },
  concrete_stain: { label: 'Stained concrete', m: () => T('concrete', '#a98d72') },
  deck_cedar: { label: 'Cedar boards', m: () => T('deck', 'cedar') },
  deck_gray: { label: 'Gray composite', m: () => T('deck', 'gray') },
  deck_walnut: { label: 'Walnut composite', m: () => T('deck', 'walnut') },
  sand: { label: 'Play sand', m: () => T('sand') },
  soil: { label: 'Garden soil', m: () => T('soil') },
};
export const surfaceOptions = (keys) => (keys || Object.keys(SURFACES)).map((k) => [k, SURFACES[k].label]);
export function surfaceMat(k) {
  const s = SURFACES[k] || SURFACES.pavers_tan;
  const m = s.m();
  m.polygonOffset = true; m.polygonOffsetFactor = -1; m.polygonOffsetUnits = -2;
  return m;
}

// ---------------- small helpers ----------------
function slats(g, w, d, n, mat, y, th = 0.08, gap = 0.08, along = 'x') {
  const pitch = (along === 'x' ? d : w) / n;
  for (let i = 0; i < n; i++) {
    const o = -((along === 'x' ? d : w) / 2) + pitch * (i + 0.5);
    if (along === 'x') B(g, w, th, pitch - gap, mat, 0, y, o); else B(g, pitch - gap, th, d, mat, o, y, 0);
  }
}
export function adirondack(g, x, z, ry, color = '#3f6f8a') {
  const c = new THREE.Group();
  const m = std(color, { roughness: 0.7 });
  // seat (sloped back)
  const seat = new THREE.Group(); seat.rotation.x = -0.12; seat.position.set(0, 1.3, 0.3); c.add(seat);
  for (let i = 0; i < 6; i++) B(seat, 2.0, 0.08, 0.26, m, 0, 0, -0.9 + i * 0.32);
  // back
  const back = new THREE.Group(); back.rotation.x = -0.38; back.position.set(0, 1.2, -0.8); c.add(back);
  for (let i = 0; i < 5; i++) { const h = 2.6 - Math.abs(i - 2) * 0.2; B(back, 0.33, h, 0.08, m, -0.84 + i * 0.42, 0, 0); }
  B(back, 2.2, 0.25, 0.1, m, 0, 0.8, -0.06);
  // arms & legs
  for (const s of [-1, 1]) {
    B(c, 0.45, 0.08, 2.6, m, s * 1.25, 2.05, 0.1);
    B(c, 0.22, 2.05, 0.22, m, s * 1.1, 0, 1.1);
    beam(c, [s * 1.0, 0, -1.2], [s * 1.0, 1.4, 1.2], 0.2, m);
  }
  c.position.set(x, 0, z); c.rotation.y = ry;
  g.add(c);
  return c;
}
function slingChair(g, x, z, ry, color = '#3d3d3d') {
  const c = new THREE.Group();
  const f = blackMetal();
  const fab = std(color, { roughness: 0.9, side: DS });
  for (const s of [-1, 1]) {
    beam(c, [s * 0.9, 0, 0.9], [s * 0.9, 1.4, -0.7], 0.08, f, true);
    beam(c, [s * 0.9, 0, -0.9], [s * 0.9, 3.1, -1.0], 0.08, f, true);
    beam(c, [s * 0.9, 2.0, 0.8], [s * 0.9, 2.0, -0.9], 0.08, f, true);
  }
  mesh(facesGeo([[[-0.85, 1.35, 0.8], [0.85, 1.35, 0.8], [0.85, 1.2, -0.75], [-0.85, 1.2, -0.75]], [[-0.85, 1.25, -0.8], [0.85, 1.25, -0.8], [0.85, 3.0, -1.0], [-0.85, 3.0, -1.0]]]), fab, c);
  c.position.set(x, 0, z); c.rotation.y = ry;
  g.add(c); return c;
}
function diningChair(g, x, z, ry, color = '#2c2c2c', cushion = null) {
  const c = new THREE.Group();
  const m = std(color, { roughness: 0.6, metalness: 0.2 });
  B(c, 1.5, 0.12, 1.5, m, 0, 1.45, 0);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) B(c, 0.1, 1.45, 0.1, m, sx * 0.65, 0, sz * 0.65);
  B(c, 1.5, 1.4, 0.1, m, 0, 1.55, -0.7);
  if (cushion) B(c, 1.35, 0.18, 1.35, std(cushion, { roughness: 0.95 }), 0, 1.57, 0.03);
  c.position.set(x, 0, z); c.rotation.y = ry;
  g.add(c); return c;
}
function plantClump(g, x, z, r, kind, rnd, y = 0) {
  const greens = ['#4f7a33', '#5d8a3c', '#43692c', '#6a9446'];
  const gm = leafMat(greens[Math.floor(rnd() * greens.length)]);
  if (kind === 'flower') {
    blob(g, r, gm, x, y + r * 0.55, z, 1, 0.7, 1, 0);
    const cols = ['#e8506a', '#f2c230', '#ffffff', '#b15ad6', '#ff8a3d', '#e94f9b', '#6b8cff'];
    const fm = std(cols[Math.floor(rnd() * cols.length)], { flatShading: true });
    for (let i = 0; i < 5; i++) { const a = rnd() * PI * 2, rr = rnd() * r * 0.8; blob(g, r * 0.28, fm, x + Math.cos(a) * rr, y + r * 0.9 + rnd() * r * 0.2, z + Math.sin(a) * rr, 1, 1, 1, 0, { cast: false }); }
  } else if (kind === 'veg') {
    blob(g, r, gm, x, y + r * 0.6, z, 1, 0.8, 1, 0);
    if (rnd() < 0.5) { const fm = std(rnd() < 0.6 ? '#d6362b' : '#e9b52a'); for (let i = 0; i < 4; i++) blob(g, r * 0.2, fm, x + (rnd() - 0.5) * r * 1.4, y + r * (0.4 + rnd() * 0.6), z + (rnd() - 0.5) * r * 1.4, 1, 1, 1, 0, { cast: false }); }
  } else if (kind === 'herb') {
    for (let i = 0; i < 3; i++) blob(g, r * 0.55, gm, x + (rnd() - 0.5) * r, y + r * 0.4, z + (rnd() - 0.5) * r, 1, 1.1, 1, 0);
  } else if (kind === 'tall') {
    beam(g, [x, y, z], [x, y + r * 6, z], 0.05, std('#7a6a52'), true, { cast: false });
    for (let i = 0; i < 3; i++) blob(g, r * 0.7, gm, x, y + r * (1.5 + i * 1.5), z, 1, 1.2, 1, 0);
  } else {
    blob(g, r, gm, x, y + r * 0.7, z, 1, 0.85, 1, 1);
  }
}
function scatterInRect(w, d, spacing, rnd, jitter = 0.35) {
  const pts = [];
  for (let x = -w / 2 + spacing / 2; x < w / 2; x += spacing) for (let z = -d / 2 + spacing / 2; z < d / 2; z += spacing) {
    pts.push([x + (rnd() - 0.5) * spacing * jitter, z + (rnd() - 0.5) * spacing * jitter]);
  }
  return pts;
}

// ---------------- builders by type ----------------
export const BUILDERS = {
  // ===== GARDEN =====
  raised_bed(p, r) {
    const g = new THREE.Group();
    const { w, d, h } = p;
    const th = p.material === 'stone' ? 0.45 : 0.15;
    const m = p.material === 'galvanized' ? std('#aeb3b5', { metalness: 0.8, roughness: 0.35 })
      : p.material === 'stone' ? T('stone', 'limestone') : p.material === 'composite' ? T('deck', 'gray') : T('deck', 'cedar');
    B(g, w, h, th, m, 0, 0, d / 2 - th / 2); B(g, w, h, th, m, 0, 0, -d / 2 + th / 2);
    B(g, th, h, d - th * 2, m, w / 2 - th / 2, 0, 0); B(g, th, h, d - th * 2, m, -w / 2 + th / 2, 0, 0);
    if (p.material === 'galvanized') for (const sx of [-1, 1]) for (const sz of [-1, 1]) C(g, 0.12, 0.12, h + 0.05, std('#8d9294', { metalness: 0.7 }), sx * (w / 2 - 0.05), 0, sz * (d / 2 - 0.05), { seg: 8 });
    mesh(new THREE.PlaneGeometry(w - th * 2, d - th * 2), T('soil'), g, 0, h - 0.12, 0, { rx: -PI / 2, cast: false });
    if (p.plants !== 'empty') {
      const kind = p.plants === 'flowers' ? 'flower' : p.plants === 'herbs' ? 'herb' : 'veg';
      const sp = kind === 'herb' ? 0.8 : 1.15;
      for (const [x, z] of scatterInRect(w - th * 2 - 0.3, d - th * 2 - 0.3, sp, r, 0.2)) plantClump(g, x, z, sp * 0.38, kind, r, h - 0.12);
    }
    return g;
  },
  garden_plot(p, r) {
    const g = new THREE.Group();
    const { w, d } = p;
    mesh(new THREE.PlaneGeometry(w, d), surfaceMat('soil'), g, 0, 0.04, 0, { rx: -PI / 2, cast: false });
    const alongZ = d >= w;
    const rowSp = 2.0;
    const span = alongZ ? w : d, len = alongZ ? d : w;
    const rows = Math.max(1, Math.floor((span - 0.6) / rowSp));
    const kinds = p.crop === 'flowers' ? ['flower'] : p.crop === 'corn' ? ['tall'] : ['veg', 'veg', 'herb', 'tall'];
    for (let i = 0; i < rows; i++) {
      const o = -span / 2 + (span - (rows - 1) * rowSp) / 2 + i * rowSp;
      const kind = kinds[i % kinds.length];
      const sp = kind === 'tall' ? 0.9 : 1.2;
      for (let t = -len / 2 + 0.6; t < len / 2 - 0.4; t += sp) {
        const x = alongZ ? o : t, z = alongZ ? t : o;
        plantClump(g, x + (r() - 0.5) * 0.15, z + (r() - 0.5) * 0.15, kind === 'tall' ? 0.3 : 0.42, kind, r, 0.05);
      }
    }
    if (p.border === 'wood' || p.border === 'stone') {
      const m = p.border === 'wood' ? T('deck', 'cedar') : T('stone', 'limestone');
      const t = 0.3, h = p.border === 'wood' ? 0.6 : 0.5;
      B(g, w, h, t, m, 0, 0, d / 2); B(g, w, h, t, m, 0, 0, -d / 2); B(g, t, h, d, m, w / 2, 0, 0); B(g, t, h, d, m, -w / 2, 0, 0);
    }
    if (p.fence && p.fence !== 'none') {
      const pts = [[-w / 2 - 0.4, -d / 2 - 0.4], [w / 2 + 0.4, -d / 2 - 0.4], [w / 2 + 0.4, d / 2 + 0.4], [-w / 2 - 0.4, d / 2 + 0.4]];
      buildFenceLine(g, pts, p.fence === 'picket' ? 'pickets' : 'wireFrame', p.fence === 'picket' ? 3 : 4, true);
    }
    return g;
  },
  planter(p, r) {
    const g = new THREE.Group();
    const D = p.w, H = p.h;
    const m = { terracotta: std('#b4623f', { roughness: 0.9 }), black: std('#262626', { roughness: 0.5 }), white: std('#eeece6', { roughness: 0.4 }), wood: T('deck', 'cedar') }[p.style] || std('#b4623f');
    if (p.style === 'wood') B(g, D, H, D, m, 0, 0, 0);
    else { C(g, D / 2, D / 2 * 0.75, H, m, 0, 0, 0, { seg: 20 }); C(g, D / 2 + 0.06, D / 2 + 0.06, 0.15, m, 0, H - 0.15, 0, { seg: 20 }); }
    mesh(new THREE.CircleGeometry(D / 2 - 0.08, 16), T('soil'), g, 0, H - 0.1, 0, { rx: -PI / 2, cast: false });
    const k = p.plant;
    if (k === 'tree') { const t = buildTree({ w: D * 1.6, h: H + D * 2.2, kind: 'fruit', fruit: '#f2a516' }, 5); t.position.y = H - 0.1; t.scale.setScalar(0.9); g.add(t); }
    else if (k === 'grass') BUILDERS.grass_orn({ w: D * 0.9, h: D * 1.1, variety: 'fountain' }, r).children.slice().forEach((c) => { c.position.y += H; g.add(c); });
    else if (k === 'succulent') BUILDERS.agave({ w: D * 0.9, variety: 'agave' }, r).children.slice().forEach((c) => { c.position.y += H; g.add(c); });
    else plantClump(g, 0, 0, D * 0.42, k === 'flowers' ? 'flower' : 'shrub', r, H - 0.1);
    return g;
  },
  trellis_arch(p, r) {
    const g = new THREE.Group();
    const { w, d, h } = p;
    const m = p.color === 'black' ? blackMetal() : p.color === 'white' ? std('#f1efe9') : T('deck', 'cedar');
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) B(g, 0.25, h - w / 2, 0.25, m, sx * w / 2, 0, sz * (d / 2 - 0.15));
      for (let y = 1; y < h - w / 2; y += 0.9) B(g, 0.12, 0.12, d, m, sx * w / 2, y, 0);
    }
    for (const sz of [-1, 1]) {
      const arch = new THREE.Mesh(new THREE.TorusGeometry(w / 2, 0.12, 6, 16, PI), m);
      arch.position.set(0, h - w / 2, sz * (d / 2 - 0.15)); arch.castShadow = true; g.add(arch);
    }
    for (let i = 0; i <= 6; i++) { const a = (i / 6) * PI; B(g, 0.1, 0.1, d, m, Math.cos(a) * w / 2, h - w / 2 + Math.sin(a) * w / 2 - 0.05, 0); }
    if (p.vine !== 'none') {
      const lm = leafMat('#4a7032');
      const fm = p.vine === 'roses' ? std('#d63a5a', { flatShading: true }) : p.vine === 'wisteria' ? std('#a98ad8', { flatShading: true }) : null;
      for (let i = 0; i < 26; i++) {
        const t = r();
        let x, y;
        if (t < 0.5) { const a = r() * PI; x = Math.cos(a) * w / 2; y = h - w / 2 + Math.sin(a) * w / 2; }
        else { x = (r() < 0.5 ? -1 : 1) * w / 2; y = r() * (h - w / 2); }
        blob(g, 0.45 + r() * 0.3, lm, x, y, (r() - 0.5) * d, 1, 1, 1, 0);
        if (fm && r() < 0.6) blob(g, 0.18, fm, x + (r() - 0.5) * 0.4, y + (r() - 0.5) * 0.4, (r() - 0.5) * d, 1, 1, 1, 0, { cast: false });
      }
    }
    return g;
  },
  greenhouse(p) {
    const g = new THREE.Group();
    const { w, d, h } = p;
    const wallH = h - 2.2;
    const fr = std('#d5d8da', { metalness: 0.7, roughness: 0.35 });
    const glass = std('#e6f2f5', { transparent: true, opacity: 0.32, roughness: 0.05, metalness: 0.1, side: DS, depthWrite: false });
    const box = mesh(boxGeo(w, wallH, d), glass, g, 0, wallH / 2, 0, { cast: false });
    box.userData.noMerge = true;
    const roof = mesh(gableGeo(w, d, h - wallH, true), glass, g, 0, wallH, 0, { cast: false });
    roof.userData.noMerge = true;
    for (const sx of [-1, 1]) for (let z = -d / 2; z <= d / 2 + 0.01; z += d / Math.ceil(d / 2.5)) {
      B(g, 0.12, wallH, 0.12, fr, sx * w / 2, 0, z);
      beam(g, [sx * w / 2, wallH, z], [0, h, z], 0.12, fr);
    }
    for (const sz of [-1, 1]) for (let x = -w / 2; x <= w / 2 + 0.01; x += w / 3) B(g, 0.12, wallH, 0.12, fr, x, 0, sz * d / 2);
    beam(g, [0, h, -d / 2], [0, h, d / 2], 0.14, fr);
    for (const sx of [-1, 1]) { B(g, 0.12, 0.12, d, fr, sx * w / 2, wallH, 0); B(g, 1.6, 0.15, d - 2, T('deck', 'cedar'), sx * (w / 2 - 1.1), 2.6, 0); for (let i = 0; i < 5; i++) plantClump(g, sx * (w / 2 - 1.1), -d / 2 + 1.5 + i * (d - 3) / 4, 0.35, i % 2 ? 'flower' : 'veg', rng(i + 3), 2.75); }
    return g;
  },
  compost_bin(p) {
    const g = new THREE.Group();
    const { w, d, h } = p;
    const m = T('deck', 'cedar');
    for (let y = 0.1; y < h; y += 0.45) {
      B(g, w, 0.32, 0.1, m, 0, y, d / 2); B(g, w, 0.32, 0.1, m, 0, y, -d / 2);
      B(g, 0.1, 0.32, d, m, w / 2, y, 0); B(g, 0.1, 0.32, d, m, -w / 2, y, 0);
    }
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) B(g, 0.25, h, 0.25, m, sx * w / 2, 0, sz * d / 2);
    mesh(new THREE.PlaneGeometry(w - 0.2, d - 0.2), T('mulch', 'brown'), g, 0, h * 0.6, 0, { rx: -PI / 2 });
    return g;
  },
  rain_barrel(p) {
    const g = new THREE.Group();
    const R = p.w / 2, H = p.h;
    const m = std(p.color === 'wood' ? '#7b5636' : '#3b4a33', { roughness: 0.6 });
    B(g, R * 2.2, 0.7, R * 2.2, T('stone', 'gray'), 0, 0, 0);
    C(g, R, R * 0.92, H, m, 0, 0.7, 0, { seg: 20 });
    C(g, R * 1.01, R * 1.01, 0.12, std('#2a2a2a'), 0, 0.7 + H * 0.25, 0, { seg: 20 });
    C(g, R * 1.01, R * 1.01, 0.12, std('#2a2a2a'), 0, 0.7 + H * 0.75, 0, { seg: 20 });
    C(g, 0.06, 0.06, 0.4, steel(), 0, 1.0, R, { rx: PI / 2 });
    return g;
  },

  // ===== PETS =====
  enclosure(p, r) {
    const g = new THREE.Group();
    const { w, d, h } = p;
    if (p.ground && p.ground !== 'none') mesh(polyGeo([[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]], 0.035), surfaceMat(p.ground), g, 0, 0, 0, { cast: false });
    const S = FENCE_STYLES[p.style] || FENCE_STYLES.weldedWire;
    const corners = [[-w / 2, d / 2], [w / 2, d / 2], [w / 2, -d / 2], [-w / 2, -d / 2]]; // front side first (+z)
    const sides = { front: 0, right: 1, back: 2, left: 3 };
    const gateSide = sides[p.gate] ?? -1;
    const gateW = Math.min(4, (gateSide % 2 === 0 ? w : d) - 1);
    const pts = [];
    for (let i = 0; i < 4; i++) {
      const a = corners[i], b = corners[(i + 1) % 4];
      pts.push(a);
      if (i === gateSide) {
        const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
        const t0 = (L - gateW) / 2 / L, t1 = (L + gateW) / 2 / L;
        pts.push([a[0] + (b[0] - a[0]) * t0, a[1] + (b[1] - a[1]) * t0], [a[0] + (b[0] - a[0]) * t1, a[1] + (b[1] - a[1]) * t1]);
      }
    }
    const gaps = {};
    if (gateSide >= 0) gaps[gateSide + 1] = true;
    buildFenceLine(g, pts, p.style, h, true, { gaps });
    if (gateSide >= 0) {
      const a = pts[gateSide + 1], b = pts[gateSide + 2];
      // gate leaf, slightly ajar
      const gw = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const grp = new THREE.Group();
      grp.position.set(a[0], 0, a[1]);
      grp.rotation.y = -Math.atan2(b[1] - a[1], b[0] - a[0]) + 0.35;
      g.add(grp);
      const frame = std(S.round ? '#9ea3a5' : S.post, { metalness: S.round ? 0.5 : 0 });
      const panelM = S.kind === 'alpha' ? std('#ffffff', { map: texTiled(S.tex, S.tileU, 1, ...(S.texArgs || [])), alphaTest: 0.5, side: DS }) : S.kind === 'board' ? std('#ffffff', { map: texTiled(S.tex, 8, h, ...(S.texArgs || [])) }) : std('#a87249');
      const pl = S.kind === 'alpha' ? new THREE.PlaneGeometry(gw - 0.2, h - 0.5) : boxGeo(gw - 0.2, h - 0.5, 0.07);
      if (S.kind === 'alpha') { const uv = pl.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (gw - 0.2), uv.getY(i) * (h - 0.5)); }
      mesh(pl, panelM, grp, gw / 2, 0.2 + (h - 0.5) / 2, 0);
      for (const y of [0.25, h - 0.3]) B(grp, gw - 0.1, 0.12, 0.12, frame, gw / 2, y, 0);
      for (const x of [0.05, gw - 0.05]) B(grp, 0.12, h - 0.3, 0.12, frame, x, 0.2, 0);
    }
    if (p.extras === true || p.extras === 'dog') {
      const bowl = std('#b9bcbe', { metalness: 0.8, roughness: 0.3 });
      C(g, 0.4, 0.3, 0.25, bowl, -w / 2 + 1, 0.04, -d / 2 + 1, { seg: 14 });
      C(g, 0.4, 0.3, 0.25, bowl, -w / 2 + 2, 0.04, -d / 2 + 1, { seg: 14 });
      const toy = std('#e85a2b');
      blob(g, 0.2, toy, w / 4, 0.2, d / 5, 1, 1, 1, 1);
    }
    return g;
  },
  dog_house(p) {
    const g = new THREE.Group();
    const { w, d, h } = p;
    const m = p.color === 'red' ? std('#9b3a2e') : p.color === 'gray' ? std('#8b8d8f') : T('deck', 'cedar');
    const wallH = h * 0.6;
    B(g, w, 0.3, d, std('#5a4532'), 0, 0, 0);
    B(g, w, wallH, d, m, 0, 0.3, 0);
    mesh(gableGeo(w, d, h - wallH - 0.3, true), m, g, 0, wallH + 0.3, 0, { ry: PI / 2 });
    mesh(gableGeo(d + 0.6, w + 0.6, h - wallH - 0.2, false), T('shingles', '#3f4447'), g, 0, wallH + 0.32, 0, { ry: PI / 2 });
    B(g, w * 0.4, wallH * 0.75, 0.05, std('#1a1a1a'), 0, 0.3, d / 2 + 0.01);
    return g;
  },
  splash_pool(p) {
    const g = new THREE.Group();
    const R = p.w / 2;
    const shell = std(p.color === 'blue' ? '#3a8fd8' : '#e8618c', { roughness: 0.4, side: DS });
    C(g, R, R * 0.95, 0.9, shell, 0, 0, 0, { seg: 28, open: true });
    mesh(new THREE.TorusGeometry(R, 0.08, 6, 28), shell, g, 0, 0.9, 0, { rx: PI / 2 });
    mesh(new THREE.CircleGeometry(R * 0.97, 28), waterMat(), g, 0, 0.6, 0, { rx: -PI / 2, cast: false, noMerge: true });
    mesh(new THREE.CircleGeometry(R * 0.95, 28), shell, g, 0, 0.05, 0, { rx: -PI / 2, cast: false });
    return g;
  },

  // ===== POOLS & WATER =====
  pool_round(p, r) {
    const g = new THREE.Group();
    const R = p.w / 2, H = p.h;
    poolShell(g, circlePts(R, 56), H, p.style, true);
    if (p.ladder !== false) poolLadder(g, 0, R, H);
    if (p.pump !== false) { B(g, 1.2, 1.1, 1.0, std('#2e3d4f', { roughness: 0.5 }), R * 0.72, 0, R * 0.72 + 0.8, { ry: PI / 4 }); }
    return g;
  },
  pool_oval(p) {
    const g = new THREE.Group();
    const { w, d, h } = p;
    const outline = p.shape === 'rectangle' ? roundedRectPts(w, d, 0.4, 2) : stadium(w, d, 14);
    poolShell(g, outline, h, p.style, false);
    poolLadder(g, 0, d / 2, h, w > d ? 0 : 0);
    return g;
  },
  stock_tank(p) {
    const g = new THREE.Group();
    const R = p.w / 2, H = p.h;
    const galv = std('#b7bcbd', { metalness: 0.85, roughness: 0.38, side: DS });
    const wall = new THREE.CylinderGeometry(R, R, H, 64, 6, true);
    const pos = wall.attributes.position;
    for (let i = 0; i < pos.count; i++) { const x = pos.getX(i), z = pos.getZ(i), a = Math.atan2(z, x); const k = 1 + 0.012 * Math.sin(a * 48); pos.setX(i, x * k); pos.setZ(i, z * k); }
    wall.computeVertexNormals();
    mesh(wall, galv, g, 0, H / 2, 0);
    mesh(new THREE.TorusGeometry(R + 0.04, 0.09, 8, 48), galv, g, 0, H, 0, { rx: PI / 2 });
    mesh(new THREE.CircleGeometry(R, 40), waterMat(), g, 0, H - 0.3, 0, { rx: -PI / 2, cast: false, noMerge: true });
    mesh(new THREE.CircleGeometry(R, 40), std('#9fa4a5', { metalness: 0.7 }), g, 0, 0.05, 0, { rx: -PI / 2, cast: false });
    if (p.deck) { mesh(polyGeo(circlePts(R + 2.2, 40), 0.03), surfaceMat('gravel_pea'), g, 0, 0, 0, { cast: false }); }
    return g;
  },
  hot_tub(p) {
    const g = new THREE.Group();
    const { w, d, h } = p;
    const cab = p.color === 'brown' ? T('deck', 'walnut') : T('deck', 'gray');
    B(g, w, h - 0.25, d, cab, 0, 0, 0);
    if (p.cover === 'closed') {
      B(g, w - 0.1, 0.45, d - 0.1, std('#4a4744', { roughness: 0.8 }), 0, h - 0.25, 0);
      B(g, w - 0.1, 0.06, 0.1, std('#2f2d2b'), 0, h + 0.2, 0);
    } else {
      const shell = std('#e9eaec', { roughness: 0.25 });
      B(g, w, 0.25, 0.4, shell, 0, h - 0.25, d / 2 - 0.2); B(g, w, 0.25, 0.4, shell, 0, h - 0.25, -d / 2 + 0.2);
      B(g, 0.4, 0.25, d - 0.8, shell, w / 2 - 0.2, h - 0.25, 0); B(g, 0.4, 0.25, d - 0.8, shell, -w / 2 + 0.2, h - 0.25, 0);
      mesh(new THREE.PlaneGeometry(w - 0.8, d - 0.8), waterMat(), g, 0, h - 0.4, 0, { rx: -PI / 2, cast: false, noMerge: true });
      emitter(g, [0, h - 0.6, 0], { color: '#7fd8ff', intensity: 2.5, distance: 7, priority: 1 });
    }
    B(g, 2.6, 0.7, 1.3, cab, 0, 0, d / 2 + 0.75);
    B(g, 2.6, 0.7, 0.7, cab, 0, 0.7, d / 2 + 0.45);
    return g;
  },
  fountain(p) {
    const g = new THREE.Group();
    const R = p.w / 2;
    const st = T('stone', p.stone || 'gray');
    C(g, R, R, 0.8, st, 0, 0, 0, { seg: 24 });
    mesh(new THREE.CircleGeometry(R - 0.2, 24), waterMat(), g, 0, 0.7, 0, { rx: -PI / 2, cast: false, noMerge: true });
    C(g, 0.35, 0.5, p.h * 0.55, st, 0, 0.2, 0, { seg: 12 });
    C(g, R * 0.55, R * 0.25, 0.4, st, 0, p.h * 0.6, 0, { seg: 18 });
    mesh(new THREE.CircleGeometry(R * 0.5, 18), waterMat(), g, 0, p.h * 0.6 + 0.38, 0, { rx: -PI / 2, cast: false, noMerge: true });
    C(g, 0.12, 0.15, p.h * 0.35, st, 0, p.h * 0.6 + 0.3, 0);
    blob(g, 0.25, waterMat(), 0, p.h * 0.95 + 0.4, 0, 1, 1.4, 1, 1, { noMerge: true });
    return g;
  },

  // ===== STRUCTURES =====
  privacy_screen(p, r) {
    const g = new THREE.Group();
    const { w, h } = p;
    const post = p.style === 'horizontal' ? std('#2a2927') : p.style === 'metal' ? blackMetal() : T('deck', 'cedar');
    for (const sx of [-1, 1]) { B(g, 0.35, h + 0.2, 0.35, post, sx * w / 2, 0, 0); B(g, 1.2, 0.2, 1.2, post, sx * w / 2, 0, 0); }
    if (p.style === 'living') {
      B(g, w, h - 0.6, 0.25, T('deck', 'cedar'), 0, 0.4, 0);
      const greens = ['#4a7032', '#567d3a', '#3e6229', '#62894a'];
      for (let x = -w / 2 + 0.4; x < w / 2; x += 0.55) for (let y = 0.7; y < h - 0.2; y += 0.55) blob(g, 0.36, leafMat(greens[Math.floor(r() * 4)]), x + (r() - 0.5) * 0.15, y, 0.22, 1, 1, 0.6, 0);
      return g;
    }
    const tx = p.style === 'metal' ? texTiled('screenPattern', 2, 2) : p.style === 'lattice' ? texTiled('lattice', 0.5, 0.5, '#c99062') : texTiled('fenceHorizontal', 4, 1, 'cedar');
    const m = std('#ffffff', { map: tx, alphaTest: 0.5, side: DS, metalness: p.style === 'metal' ? 0.4 : 0 });
    const pl = new THREE.PlaneGeometry(w - 0.35, h - 0.3);
    const uv = pl.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (w - 0.35), uv.getY(i) * (h - 0.3));
    mesh(pl, m, g, 0, 0.15 + (h - 0.3) / 2, 0);
    B(g, w, 0.18, 0.3, post, 0, h - 0.1, 0);
    return g;
  },
  pergola(p, r) {
    const g = new THREE.Group();
    const { w, d, h } = p;
    const m = p.style === 'black' ? std('#262626', { metalness: 0.4, roughness: 0.5 }) : p.style === 'white' ? std('#f2f0ea', { roughness: 0.6 }) : T('deck', 'cedar');
    const ps = 0.5;
    const nz = d > 14 ? 3 : 2, nx = w > 14 ? 3 : 2;
    const xs = Array.from({ length: nx }, (_, i) => -w / 2 + ps / 2 + 0.6 + i * (w - ps - 1.2) / (nx - 1));
    const zs = Array.from({ length: nz }, (_, i) => -d / 2 + ps / 2 + 0.6 + i * (d - ps - 1.2) / (nz - 1));
    for (const x of [xs[0], xs[xs.length - 1]]) for (const z of zs) { B(g, ps, h - 0.7, ps, m, x, 0, z); B(g, ps + 0.3, 0.6, ps + 0.3, m, x, 0, z); }
    for (const x of [xs[0], xs[xs.length - 1]]) for (const o of [-0.32, 0.32]) B(g, 0.18, 0.75, d + 1.2, m, x + o, h - 1.1, 0);
    const nr = Math.round((d + 0.6) / 1.4);
    for (let i = 0; i <= nr; i++) B(g, w + 1.6, 0.6, 0.17, m, 0, h - 0.35, -d / 2 - 0.3 + i * (d + 0.6) / nr);
    if (p.top === 'louvered') {
      for (let x = -w / 2 + 0.4; x < w / 2; x += 0.7) mesh(boxGeo(0.62, 0.06, d + 0.6), m, g, x, h + 0.3, 0, { rz: 0.5 });
    } else {
      const np = Math.round((w + 1.2) / 0.9);
      for (let i = 0; i <= np; i++) B(g, 0.13, 0.16, d + 1.0, m, -w / 2 - 0.6 + i * (w + 1.2) / np, h + 0.25, 0);
    }
    if (p.top === 'shade') {
      const fab = std(p.fabric || '#d9cdb4', { roughness: 0.95, side: DS });
      mesh(new THREE.PlaneGeometry(w + 0.4, d + 0.4), fab, g, 0, h + 0.45, 0, { rx: -PI / 2 });
    }
    if (p.top === 'vines') {
      const lm = ['#4a7032', '#567d3a', '#3e6229'];
      for (let i = 0; i < 40; i++) blob(g, 0.8 + r() * 0.6, leafMat(lm[i % 3]), (r() - 0.5) * (w + 1), h + 0.5 + r() * 0.3, (r() - 0.5) * (d + 1), 1, 0.5, 1, 0);
      for (const x of [xs[0], xs[xs.length - 1]]) for (const z of zs) for (let y = 1; y < h; y += 1.6) blob(g, 0.5, leafMat(lm[0]), x + 0.3, y, z, 1, 1.2, 1, 0);
    }
    if (p.top === 'lights' || p.lights) {
      const lb = [];
      const wire = std('#151515');
      const n = Math.max(2, Math.round(w / 3));
      for (let i = 0; i < n; i++) {
        const x = -w / 2 + 1 + i * (w - 2) / (n - 1);
        const pts = catenary([x, h - 0.4, -d / 2 + 0.6], [x, h - 0.4, d / 2 - 0.6], 0.7, 10);
        for (let k = 0; k < pts.length - 1; k++) beam(g, pts[k], pts[k + 1], 0.04, wire, true, { cast: false });
        for (let k = 1; k < pts.length - 1; k++) { blob(g, 0.14, bulbMat(LIGHT_COLORS.warm), pts[k][0], pts[k][1] - 0.25, pts[k][2], 1, 1.3, 1, 0, { cast: false }); lb.push(pts[k][0], pts[k][1] - 0.25, pts[k][2]); }
      }
      addPointGlows(g, lb, LIGHT_COLORS.warm, 1.2);
      emitter(g, [0, h - 1.2, 0], { intensity: 9, distance: 18, priority: 2 });
      addPool(g, 0, 0, 0, LIGHT_COLORS.warm, Math.max(w, d) * 0.6);
    }
    return g;
  },
  gazebo(p) {
    const g = buildGazeboTop(p.w, p.d, p.h, p.roof || '#2d3a55');
    if (p.curtains) {
      const fab = std('#efe9dc', { roughness: 1, side: DS });
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        const pl = new THREE.PlaneGeometry(1.6, p.h - 0.6, 6, 1);
        const pos = pl.attributes.position; for (let i = 0; i < pos.count; i++) pos.setZ(i, Math.sin(pos.getX(i) * 6) * 0.08);
        pl.computeVertexNormals();
        mesh(pl, fab, g, sx * (p.w / 2 - 1.0), (p.h - 0.6) / 2 + 0.1, sz * (p.d / 2 - 0.3));
      }
    }
    if (p.lights) {
      emitter(g, [0, p.h - 0.6, 0], { intensity: 8, distance: 16, priority: 2 });
      B(g, 0.6, 0.6, 0.6, bulbMat(LIGHT_COLORS.warm), 0, p.h - 0.8, 0);
      addGlow(g, 0, p.h - 0.5, 0, LIGHT_COLORS.warm, 2.4);
    }
    return g;
  },
  shade_sail(p) {
    const g = new THREE.Group();
    const { w, d } = p;
    const post = std('#3a3a3a', { metalness: 0.6, roughness: 0.4 });
    const corners = p.shape === 'triangle'
      ? [[-w / 2, 9, d / 2], [w / 2, 10.5, d / 2], [0, 8, -d / 2]]
      : [[-w / 2, 9.5, -d / 2], [w / 2, 8, -d / 2], [w / 2, 9.5, d / 2], [-w / 2, 8, d / 2]];
    for (const c of corners) { C(g, 0.17, 0.2, c[1] + 0.6, post, c[0] * 1.08, 0, c[2] * 1.08, { seg: 10 }); beam(g, [c[0] * 1.08, c[1] + 0.3, c[2] * 1.08], c, 0.03, std('#999'), true, { cast: false }); }
    // subdivided sail with sag
    const fab = std(p.color || '#d9c9a3', { roughness: 0.95, side: DS });
    const N = 10, pos = [], idx = [];
    const ctr = corners.reduce((a, c) => [a[0] + c[0] / corners.length, a[1] + c[1] / corners.length, a[2] + c[2] / corners.length], [0, 0, 0]);
    let base = 0;
    for (let k = 0; k < corners.length; k++) {
      const A = corners[k], Bc = corners[(k + 1) % corners.length];
      for (let i = 0; i <= N; i++) for (let j = 0; j <= N - i; j++) {
        const u = i / N, v = j / N, wgt = 1 - u - v;
        const x = ctr[0] * wgt + A[0] * u + Bc[0] * v, z = ctr[2] * wgt + A[2] * u + Bc[2] * v;
        let y = ctr[1] * wgt + A[1] * u + Bc[1] * v;
        y -= 0.9 * wgt * (1 - wgt) * 2 + 0.25 * u * v * 4;
        pos.push(x, y, z);
      }
      const row = (i) => { let s = 0; for (let t = 0; t < i; t++) s += N + 1 - t; return s; };
      for (let i = 0; i < N; i++) for (let j = 0; j < N - i; j++) {
        const a = base + row(i) + j, b = base + row(i + 1) + j, c = a + 1;
        idx.push(a, b, c);
        if (j < N - i - 1) idx.push(c, b, b + 1);
      }
      base += (N + 1) * (N + 2) / 2;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(pos.length / 3 * 2), 2));
    geo.setIndex(idx); geo.computeVertexNormals();
    mesh(geo, fab, g);
    return g;
  },
  shed(p) { return buildShed(p); },
  umbrella(p) {
    const g = new THREE.Group();
    const R = p.w / 2;
    const fab = std(p.color || '#2f5d73', { roughness: 0.9, side: DS, flatShading: true });
    C(g, 0.8, 0.9, 0.35, std('#2b2b2b'), 0, 0, 0, { seg: 16 });
    C(g, 0.07, 0.07, 8.1, std('#d8d4ca', { metalness: 0.4 }), 0, 0.3, 0, { seg: 8 });
    const can = new THREE.ConeGeometry(R, 1.5, 8, 1, true);
    mesh(can, fab, g, 0, 7.6, 0);
    C(g, 0.15, 0.15, 0.4, fab, 0, 8.3, 0, { seg: 8 });
    return g;
  },

  // ===== FIRE & GRILL =====
  fire_pit(p, r) {
    const g = new THREE.Group();
    const padR = p.w / 2;
    if (p.pad && p.pad !== 'none') mesh(polyGeo(circlePts(padR, 48), 0.035), surfaceMat(p.pad), g, 0, 0, 0, { cast: false });
    const pr = (p.pitDiam || 4) / 2;
    let fireY = 0.9;
    if (p.pit === 'steel') {
      const cor = std('#5a3b2a', { metalness: 0.6, roughness: 0.65, side: DS });
      const bowl = new THREE.SphereGeometry(pr, 24, 10, 0, PI * 2, PI / 2, PI / 2 * 0.75);
      mesh(bowl, cor, g, 0, 1.6, 0);
      C(g, 0.4, 0.8, 0.6, cor, 0, 0, 0, { seg: 14 });
      fireY = 1.1;
    } else if (p.pit === 'gas') {
      B(g, pr * 2.2, 1.9, pr * 1.3, T('stone', 'gray'), 0, 0, 0);
      B(g, pr * 2.3, 0.15, pr * 1.4, std('#3a3a3a', { roughness: 0.4 }), 0, 1.9, 0);
      B(g, pr * 1.3, 0.1, pr * 0.4, std('#cfc8bd'), 0, 2.0, 0);
      fireY = 2.05;
    } else {
      const st = p.pit === 'block' ? T('stone', 'gray') : T('stone', 'limestone');
      const ring = new THREE.Group();
      const n = p.pit === 'block' ? 14 : 18;
      for (let lay = 0; lay < 3; lay++) for (let i = 0; i < n; i++) {
        const a = (i + lay * 0.5) / n * PI * 2;
        mesh(boxGeo(pr * 2 * PI / n * 0.95, 0.4, 0.7), st, ring, Math.cos(a) * pr, 0.2 + lay * 0.42, Math.sin(a) * pr, { ry: -a + PI / 2 });
      }
      g.add(ring);
      mesh(new THREE.TorusGeometry(pr, 0.42, 4, 24), st, g, 0, 1.32, 0, { rx: PI / 2 }).scale.set(1, 1, 0.25);
      mesh(new THREE.CircleGeometry(pr - 0.3, 20), std('#1d1a17'), g, 0, 0.1, 0, { rx: -PI / 2, cast: false });
      C(g, pr - 0.3, pr - 0.3, 0.9, std('#222', { side: DS }), 0, 0.1, 0, { open: true, seg: 20 });
      fireY = 0.35;
      // logs
      for (let i = 0; i < 4; i++) beam(g, [Math.cos(i * 1.6) * 0.8, fireY, Math.sin(i * 1.6) * 0.8], [-Math.cos(i * 1.6) * 0.3, fireY + 0.5, -Math.sin(i * 1.6) * 0.3], 0.3, std('#3a2a1e'), true);
    }
    if (p.lit !== false) {
      const f = addFlames(g, 0, fireY, 0, p.pit === 'gas' ? 0.7 : 1.2, p.pit === 'gas' ? 4 : 3);
      g.userData.ticks = [f.userData.tick];
      emitter(g, [0, fireY + 1.2, 0], { color: LIGHT_COLORS.fire, intensity: 14, distance: 22, priority: 5, flicker: true, always: true });
      addPool(g, 0, 0, 0, LIGHT_COLORS.fire, Math.min(padR + 3, 10));
    }
    const nc = p.chairs || 0;
    const cr = Math.max(pr + 3.2, Math.min(padR - 1.3, pr + 4.5));
    for (let i = 0; i < nc; i++) {
      const a = (i / nc) * PI * 2 + PI / 2;
      const x = Math.cos(a) * cr, z = Math.sin(a) * cr;
      const ry = Math.atan2(-x, -z);
      if (p.chairStyle === 'sling') slingChair(g, x, z, ry, p.chairColor || '#3d3d3d'); else adirondack(g, x, z, ry, p.chairColor || '#3f6f8a');
    }
    return g;
  },
  grill(p) {
    const g = new THREE.Group();
    const st = p.style || 'gas';
    const ss = steel(), blk = std('#1e1e1e', { roughness: 0.5, metalness: 0.3 });
    if (st === 'gas') {
      B(g, 2.6, 2.8, 1.8, blk, 0, 0.3, 0);
      B(g, 2.5, 2.4, 0.06, ss, 0, 0.45, 0.91);
      for (const s of [-1, 1]) { B(g, 1.3, 0.1, 1.7, ss, s * 2.0, 3.0, 0); C(g, 0.25, 0.25, 0.15, blk, s * 1.1, 0.05, 0.7, { rx: PI / 2 }); }
      B(g, 2.6, 0.25, 1.8, ss, 0, 3.0, 0);
      const lid = new THREE.CylinderGeometry(0.9, 0.9, 2.6, 16, 1, false, 0, PI);
      mesh(lid, ss, g, 0, 3.25, -0.05, { rz: PI / 2 });
      C(g, 0.06, 0.06, 1.6, ss, 0, 3.9, 0.95, { rz: PI / 2 }).position.set(0, 3.95, 0.95);
    } else if (st === 'kettle') {
      const sph = new THREE.SphereGeometry(1.1, 20, 12, 0, PI * 2, PI / 2, PI / 2);
      mesh(sph, blk, g, 0, 2.6, 0);
      mesh(new THREE.SphereGeometry(1.1, 20, 10, 0, PI * 2, 0, PI / 2.2), blk, g, 0, 2.6, 0);
      for (let i = 0; i < 3; i++) { const a = i / 3 * PI * 2; beam(g, [Math.cos(a) * 1.0, 0, Math.sin(a) * 1.0], [Math.cos(a) * 0.6, 1.8, Math.sin(a) * 0.6], 0.09, ss, true); }
    } else if (st === 'smoker') {
      const bar = new THREE.CylinderGeometry(0.85, 0.85, 3.4, 18);
      mesh(bar, blk, g, -0.4, 3.0, 0, { rz: PI / 2 });
      B(g, 1.4, 1.4, 1.4, blk, 2.0, 2.3, 0);
      C(g, 0.2, 0.2, 2.2, blk, -1.8, 3.6, 0, { seg: 10 });
      for (const sx of [-1.8, 1.0]) for (const sz of [-0.6, 0.6]) B(g, 0.12, 2.3, 0.12, blk, sx, 0, sz);
      B(g, 3.4, 0.08, 1.4, ss, -0.4, 1.2, 0);
    } else if (st === 'kamado') {
      mesh(new THREE.SphereGeometry(1.15, 22, 16), std('#2e5a3a', { roughness: 0.35 }), g, 0, 2.6, 0).scale.set(1, 1.2, 1);
      for (let i = 0; i < 4; i++) { const a = i / 4 * PI * 2 + PI / 4; beam(g, [Math.cos(a) * 0.9, 0, Math.sin(a) * 0.9], [Math.cos(a) * 0.7, 1.6, Math.sin(a) * 0.7], 0.1, ss, true); }
      for (const s of [-1, 1]) B(g, 1.0, 0.08, 1.2, std('#6b4a33'), s * 1.8, 2.5, 0);
    } else {
      B(g, 4.6, 2.6, 1.9, blk, 0, 0.3, 0);
      B(g, 3.6, 0.15, 1.8, std('#2b2b2b', { metalness: 0.6, roughness: 0.3 }), 0, 2.9, 0);
      for (const s of [-1, 1]) B(g, 0.5, 0.1, 1.8, ss, s * 2.05, 2.9, 0);
    }
    return g;
  },
  outdoor_kitchen(p, r) {
    const g = new THREE.Group();
    const { w, d, h } = p;
    const base = p.stone === 'stucco' ? std('#e6ddcd', { roughness: 0.95 }) : T('stone', p.stone || 'limestone');
    const top = std(p.counter === 'light' ? '#ddd6c8' : p.counter === 'concrete' ? '#a7a198' : '#2a2a2b', { roughness: 0.3 });
    const ss = steel();
    const seg = (x, z, L, D, ry) => {
      const s = new THREE.Group(); s.position.set(x, 0, z); s.rotation.y = ry; g.add(s);
      B(s, L, h - 0.15, D, base, 0, 0, 0);
      B(s, L + 0.3, 0.15, D + 0.4, top, 0, h - 0.15, 0.1);
      return s;
    };
    const main = seg(0, 0, w, d, 0);
    // grill insert
    const gx = -w / 2 + 2.3;
    B(main, 3.0, 0.2, d - 0.5, ss, gx, h, -0.05);
    mesh(new THREE.CylinderGeometry(0.75, 0.75, 3.0, 14, 1, false, 0, PI), ss, main, gx, h + 0.2, -0.1, { rz: PI / 2 });
    B(main, 2.6, 1.8, 0.06, ss, gx, 0.6, d / 2 + 0.01);
    if (w > 7) { B(main, 1.8, 1.8, 0.06, ss, w / 2 - 1.6, 0.6, d / 2 + 0.01); B(main, 1.4, 0.05, 1.0, std('#d0d2d3', { metalness: 0.9, roughness: 0.2 }), w / 2 - 1.6, h + 0.01, 0); C(main, 0.04, 0.04, 0.8, ss, w / 2 - 1.6, h, -0.5); }
    if (p.shape === 'L') {
      const L2 = p.ret || 6;
      seg(w / 2 - d / 2, d / 2 + L2 / 2, L2, d, PI / 2);
    }
    const ns = p.stools || 0;
    for (let i = 0; i < ns; i++) {
      const x = -w / 2 + (i + 0.5) * w / ns;
      const s = new THREE.Group(); s.position.set(x, 0, -d / 2 - 1.2); g.add(s);
      C(s, 0.6, 0.6, 0.18, std('#3a2c22'), 0, 2.4, 0, { seg: 14 });
      C(s, 0.06, 0.06, 2.4, blackMetal(), 0, 0, 0, { seg: 6 });
      C(s, 0.5, 0.5, 0.06, blackMetal(), 0, 0, 0, { seg: 12 });
      mesh(new THREE.TorusGeometry(0.4, 0.04, 4, 14), blackMetal(), s, 0, 0.9, 0, { rx: PI / 2 });
    }
    return g;
  },
  pizza_oven(p) {
    const g = new THREE.Group();
    const { w, d } = p;
    B(g, w, 3.0, d, T('stone', 'limestone'), 0, 0, 0);
    B(g, w + 0.3, 0.2, d + 0.3, std('#7c766d'), 0, 3.0, 0);
    const dome = new THREE.SphereGeometry(Math.min(w, d) * 0.45, 22, 12, 0, PI * 2, 0, PI / 2);
    mesh(dome, std('#b06c4b', { roughness: 0.95 }), g, 0, 3.2, -0.1);
    B(g, 1.3, 0.9, 0.5, std('#1a1512'), 0, 3.2, Math.min(w, d) * 0.42);
    C(g, 0.25, 0.25, 1.6, std('#2b2b2b'), 0.3, 4.8, -0.4, { seg: 10 });
    return g;
  },

  // ===== SEATING =====
  dining_set(p, r) {
    const g = new THREE.Group();
    const { w, d } = p;
    const m = p.color === 'teak' ? std('#8a5a36') : p.color === 'white' ? std('#ecebe6') : std('#2b2b2b', { metalness: 0.3, roughness: 0.5 });
    const n = p.chairs || 6;
    if (p.shape === 'round') {
      C(g, w / 2, w / 2, 0.15, m, 0, 2.35, 0, { seg: 28 });
      C(g, 0.2, 0.25, 2.35, m, 0, 0, 0, { seg: 10 }); C(g, 0.9, 0.9, 0.1, m, 0, 0, 0, { seg: 16 });
      for (let i = 0; i < n; i++) { const a = (i / n) * PI * 2; const R = w / 2 + 0.6; diningChair(g, Math.cos(a) * R, Math.sin(a) * R, Math.atan2(-Math.cos(a), -Math.sin(a)), p.color === 'teak' ? '#8a5a36' : '#2c2c2c', p.cushion); }
    } else {
      const tw = w, td = 3.2;
      B(g, tw, 0.15, td, m, 0, 2.35, 0);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) B(g, 0.2, 2.35, 0.2, m, sx * (tw / 2 - 0.4), 0, sz * (td / 2 - 0.4));
      const side = Math.floor((n - (n >= 6 ? 2 : 0)) / 2);
      for (let i = 0; i < side; i++) {
        const x = -tw / 2 + (i + 0.5) * tw / side;
        diningChair(g, x, td / 2 + 0.6, PI, p.color === 'teak' ? '#8a5a36' : '#2c2c2c', p.cushion);
        diningChair(g, x, -td / 2 - 0.6, 0, p.color === 'teak' ? '#8a5a36' : '#2c2c2c', p.cushion);
      }
      if (n >= 6) { diningChair(g, tw / 2 + 0.7, 0, -PI / 2, p.color === 'teak' ? '#8a5a36' : '#2c2c2c', p.cushion); diningChair(g, -tw / 2 - 0.7, 0, PI / 2, p.color === 'teak' ? '#8a5a36' : '#2c2c2c', p.cushion); }
    }
    if (p.umbrella) { const u = BUILDERS.umbrella({ w: 9, color: p.umbrellaColor || '#2f5d73' }); u.children.forEach((c) => { if (c.position.y < 0.5) c.visible = false; }); g.add(u); }
    return g;
  },
  adirondack(p) { const g = new THREE.Group(); adirondack(g, 0, 0, 0, p.color); return g; },
  chaise(p) {
    const g = new THREE.Group();
    const fr = p.frame === 'wood' ? std('#8a5a36') : std('#2b2b2b', { metalness: 0.3 });
    const cu = std(p.color || '#e8e2d4', { roughness: 0.95 });
    B(g, 2.3, 0.15, 6.4, fr, 0, 1.0, 0);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) B(g, 0.15, 1.0, 0.15, fr, sx * 1.0, 0, sz * 2.9);
    B(g, 2.1, 0.35, 4.2, cu, 0, 1.15, 1.0);
    const back = new THREE.Group(); back.position.set(0, 1.2, -1.2); back.rotation.x = -0.75; g.add(back);
    B(back, 2.1, 0.35, 2.2, cu, 0, 0, -1.1);
    B(back, 2.3, 0.12, 2.3, fr, 0, -0.12, -1.1);
    return g;
  },
  sectional(p) {
    const g = new THREE.Group();
    const { w, d } = p;
    const fr = p.frame === 'wicker' ? std('#5b4636', { roughness: 0.95 }) : p.frame === 'teak' ? std('#8a5a36') : std('#2e2e2e', { roughness: 0.6 });
    const cu = std(p.color || '#d9d3c4', { roughness: 0.98 });
    const depth = 2.8;
    const run = (x, z, L, ry) => {
      const s = new THREE.Group(); s.position.set(x, 0, z); s.rotation.y = ry; g.add(s);
      B(s, L, 1.2, depth, fr, 0, 0, 0);
      B(s, L - 0.1, 0.45, depth - 0.7, cu, 0, 1.2, 0.3);
      B(s, L, 1.4, 0.6, fr, 0, 1.2, -depth / 2 + 0.3);
      B(s, L - 0.2, 1.3, 0.55, cu, 0, 1.6, -depth / 2 + 0.85);
    };
    run(0, -d / 2 + depth / 2, w, 0);
    run(-w / 2 + depth / 2, depth / 2, d - depth, PI / 2);
    for (const s of [1]) B(g, 0.6, 2.0, depth, fr, s * (w / 2 - 0.3), 0, -d / 2 + depth / 2);
    B(g, 0.6 + depth, 2.0, 0.6, fr, -w / 2 + depth / 2 - 0.3 + 0.3, 0, d / 2 - 0.3);
    if (p.table !== false) { B(g, Math.min(4, w - depth - 1.5), 1.3, Math.min(2.5, d - depth - 1.5), p.table === 'fire' ? T('stone', 'gray') : std('#7b5a3f'), (depth) / 2 + 0.2, 0, depth / 2 + 0.3); }
    if (p.table === 'fire') { const f = addFlames(g, depth / 2 + 0.2, 1.3, depth / 2 + 0.3, 0.55, 3); g.userData.ticks = [f.userData.tick]; emitter(g, [depth / 2, 2.3, depth / 2], { color: LIGHT_COLORS.fire, intensity: 7, distance: 14, priority: 4, flicker: true, always: true }); }
    return g;
  },
  bench(p) {
    const g = new THREE.Group();
    const { w } = p;
    const m = p.material === 'stone' ? T('stone', 'limestone') : p.material === 'metal' ? blackMetal() : T('deck', 'cedar');
    if (p.material === 'stone') { B(g, w, 0.35, 1.5, m, 0, 1.25, 0); for (const s of [-1, 1]) B(g, 0.6, 1.25, 1.2, m, s * (w / 2 - 0.6), 0, 0); return g; }
    for (let i = 0; i < 4; i++) B(g, w, 0.1, 0.32, m, 0, 1.45, -0.6 + i * 0.4);
    for (const s of [-1, 1]) { B(g, 0.2, 1.45, 0.2, m, s * (w / 2 - 0.3), 0, 0.55); B(g, 0.2, 3.0, 0.2, m, s * (w / 2 - 0.3), 0, -0.7); }
    for (let i = 0; i < 3; i++) B(g, w, 0.32, 0.08, m, 0, 1.9 + i * 0.38, -0.72);
    return g;
  },
  hammock(p) {
    const g = new THREE.Group();
    const L = p.w;
    const fr = std('#7a5638');
    for (const s of [-1, 1]) {
      beam(g, [s * (L / 2 - 2.2), 0.1, 0], [s * L / 2, 4.2, 0], 0.3, fr);
      B(g, 0.4, 0.3, 3, fr, s * (L / 2 - 2.2), 0, 0);
    }
    B(g, L - 4.2, 0.3, 0.4, fr, 0, 0, 0);
    const fab = std(p.color || '#c8584a', { roughness: 0.95, side: DS });
    const pos = [], idx = [], N = 16;
    for (let i = 0; i <= N; i++) {
      const t = i / N, x = -L / 2 + 1 + (L - 2) * t;
      const y = 4.0 - Math.sin(t * PI) * 2.0;
      const wdt = 0.3 + Math.sin(t * PI) * 1.6;
      pos.push(x, y + 0.2, -wdt, x, y - 0.1 * Math.sin(t * PI), 0, x, y + 0.2, wdt);
      if (i > 0) { const a = (i - 1) * 3; idx.push(a, a + 3, a + 1, a + 1, a + 3, a + 4, a + 1, a + 4, a + 2, a + 2, a + 4, a + 5); }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(pos.length / 3 * 2), 2));
    geo.setIndex(idx); geo.computeVertexNormals();
    mesh(geo, fab, g);
    return g;
  },
  bistro_set(p) {
    const g = new THREE.Group();
    const m = std(p.color || '#1f3b2e', { metalness: 0.4, roughness: 0.5 });
    C(g, 1.0, 1.0, 0.08, m, 0, 2.4, 0, { seg: 20 }); C(g, 0.08, 0.08, 2.4, m, 0, 0, 0, { seg: 8 }); C(g, 0.6, 0.6, 0.06, m, 0, 0, 0, { seg: 12 });
    diningChair(g, 0, 1.7, PI, p.color || '#1f3b2e'); diningChair(g, 0, -1.7, 0, p.color || '#1f3b2e');
    return g;
  },

  // ===== PLANTS =====
  tree(p, r, seed) {
    const kind = p.kind || 'oak';
    const flowers = kind === 'crape' ? ({ pink: '#e8609a', white: '#f4f1ec', purple: '#9b5ac8', red: '#c8304a' }[p.bloom] || '#e8609a') : kind === 'redbud' ? '#d466b4' : null;
    const fruit = kind === 'fruit' ? ({ peach: '#f29b4b', citrus: '#f2b316', apple: '#c8302a', fig: '#5a3a5a' }[p.fruit] || '#f29b4b') : null;
    return buildTree({ w: p.w, h: p.h, kind: kind === 'fruit' ? 'fruit' : kind, flowers, fruit }, seed);
  },
  shrub(p, r) {
    const g = new THREE.Group();
    const R = p.w / 2, H = p.h;
    const v = p.variety || 'boxwood';
    const cols = { boxwood: ['#3f6a2c', '#4a7633'], flowering: ['#4c7535', '#557f3c'], holly: ['#2f4f26', '#36592b'], rosemary: ['#5d7a5a', '#6a8766'], hydrangea: ['#4f7a35', '#5a8a3c'], loropetalum: ['#5a2e3a', '#6b3646'], salvia: ['#5a7d3d', '#668a46'] }[v] || ['#4a7633'];
    const n = v === 'boxwood' ? 1 : 4;
    if (n === 1) blob(g, R, leafMat(cols[0]), 0, H * 0.5, 0, 1, H / (2 * R), 1, 2);
    else for (let i = 0; i < n; i++) { const a = i / n * PI * 2; blob(g, R * 0.7, leafMat(cols[i % 2]), Math.cos(a) * R * 0.35, H * 0.45 + r() * H * 0.1, Math.sin(a) * R * 0.35, 1, H / (2 * R) * 1.1, 1, 1); }
    const fc = { flowering: '#f07fa4', hydrangea: '#7b9be8', salvia: '#7a55c8', loropetalum: '#e46aa6' }[v];
    if (fc || p.bloom) {
      const fm = std(p.bloom || fc, { flatShading: true });
      for (let i = 0; i < 14; i++) { const a = r() * PI * 2, el = r() * PI * 0.45; blob(g, R * (v === 'hydrangea' ? 0.22 : 0.13), fm, Math.cos(a) * Math.cos(el) * R * 0.95, H * 0.5 + Math.sin(el) * H * 0.5, Math.sin(a) * Math.cos(el) * R * 0.95, 1, 1, 1, 0, { cast: false }); }
    }
    return g;
  },
  grass_orn(p, r) {
    const g = new THREE.Group();
    const R = p.w / 2, H = p.h;
    const v = p.variety || 'muhly';
    const col = { muhly: '#6c7f4a', fountain: '#7f8a4c', fescue: '#7fa0a6', feather: '#b9b07a', lemongrass: '#7fa04a' }[v];
    const m = leafMat(col);
    const n = 26;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * PI * 2 + r() * 0.3, tilt = 0.15 + r() * 0.45;
      const blade = new THREE.ConeGeometry(0.08, H * (0.7 + r() * 0.3), 3);
      const mm = mesh(blade, m, g, Math.cos(a) * R * 0.15, H * 0.4, Math.sin(a) * R * 0.15);
      mm.rotation.set(Math.sin(a) * tilt, 0, -Math.cos(a) * tilt);
    }
    blob(g, R * 0.5, m, 0, H * 0.2, 0, 1, 0.6, 1, 0);
    if (v === 'muhly' || v === 'fountain' || v === 'feather') {
      const pm = std(v === 'muhly' ? '#d98ab9' : v === 'feather' ? '#e8dfb8' : '#c8b48a', { transparent: true, opacity: 0.5, roughness: 1, depthWrite: false });
      for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; blob(g, R * 0.42, pm, Math.cos(a) * R * 0.45, H * (0.78 + r() * 0.15), Math.sin(a) * R * 0.45, 1, 0.75, 1, 1, { cast: false, noMerge: true }); }
    }
    return g;
  },
  agave(p, r) {
    const g = new THREE.Group();
    const R = p.w / 2;
    const v = p.variety || 'agave';
    if (v === 'yucca') {
      C(g, 0.18, 0.25, R * 1.6, std('#6b5a44'), 0, 0, 0, { seg: 7 });
      for (let i = 0; i < 40; i++) { const a = r() * PI * 2, el = (r() - 0.2) * 1.4; const L = R * 0.9; beam(g, [0, R * 1.6, 0], [Math.cos(a) * Math.cos(el) * L, R * 1.6 + Math.sin(el) * L, Math.sin(a) * Math.cos(el) * L], 0.07, leafMat('#5b7a4a')); }
      return g;
    }
    const col = v === 'sotol' ? '#8aa29a' : '#7f9ea4';
    const m = leafMat(col);
    const n = v === 'sotol' ? 40 : 18;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * PI * 2 * 2.618 + r() * 0.2;
      const fromVert = 0.35 + (i / n) * 0.9; // inner leaves upright, outer leaves spread
      const L = R * (0.75 + (i / n) * 0.45);
      const leaf = new THREE.ConeGeometry(v === 'sotol' ? 0.05 : R * 0.15, L, 4);
      leaf.translate(0, L / 2, 0); leaf.scale(1, 1, 0.35);
      const holder = new THREE.Group(); holder.rotation.y = a; g.add(holder);
      mesh(leaf, m, holder, 0, 0.05, 0, { rz: -fromVert });
    }
    return g;
  },
  flowers(p, r) {
    const g = new THREE.Group();
    const R = p.w / 2;
    const cols = { mixed: ['#e8506a', '#f2c230', '#ffffff', '#b15ad6', '#ff8a3d'], pink: ['#f07fa4', '#e8506a', '#f4b6cc'], yellow: ['#f2c230', '#ffdc5a', '#f59a1b'], purple: ['#9b5ac8', '#7a55c8', '#c6a2f0'], white: ['#ffffff', '#f4f1e6'] }[p.color || 'mixed'];
    const n = Math.max(3, Math.round(R * R * 3));
    for (let i = 0; i < n; i++) {
      const a = r() * PI * 2, rr = Math.sqrt(r()) * R;
      const x = Math.cos(a) * rr, z = Math.sin(a) * rr;
      blob(g, 0.35, leafMat('#557f3a'), x, 0.25, z, 1, 0.7, 1, 0);
      const fm = std(cols[i % cols.length], { flatShading: true });
      for (let k = 0; k < 3; k++) blob(g, 0.11, fm, x + (r() - 0.5) * 0.4, 0.55 + r() * 0.2, z + (r() - 0.5) * 0.4, 1, 1, 1, 0, { cast: false });
    }
    return g;
  },
  boulder(p, r) {
    const g = new THREE.Group();
    const geo = new THREE.IcosahedronGeometry(1, 1);
    const pos = geo.attributes.position;
    const nmap = new Map();
    for (let i = 0; i < pos.count; i++) {
      const key = pos.getX(i).toFixed(3) + pos.getY(i).toFixed(3) + pos.getZ(i).toFixed(3);
      if (!nmap.has(key)) nmap.set(key, 0.8 + r() * 0.35);
      const k = nmap.get(key);
      pos.setXYZ(i, pos.getX(i) * k, Math.max(-0.2, pos.getY(i)) * k, pos.getZ(i) * k);
    }
    geo.computeVertexNormals();
    const m = std(p.stone === 'granite' ? '#8d8a85' : p.stone === 'sandstone' ? '#b98a5e' : '#cdbf9e', { flatShading: true, roughness: 0.95 });
    const b = mesh(geo, m, g, 0, p.h * 0.18, 0);
    b.scale.set(p.w / 2, p.h, p.d / 2);
    return g;
  },
  bird_bath(p) {
    const g = new THREE.Group();
    const st = T('stone', 'limestone');
    C(g, 0.6, 0.7, 0.3, st, 0, 0, 0); C(g, 0.22, 0.32, 2.2, st, 0, 0.3, 0, { seg: 10 });
    C(g, 1.1, 0.5, 0.4, st, 0, 2.5, 0, { seg: 18 });
    mesh(new THREE.CircleGeometry(0.95, 18), waterMat(), g, 0, 2.86, 0, { rx: -PI / 2, cast: false, noMerge: true });
    return g;
  },

  // ===== SURFACES =====
  surface_pad(p) {
    const g = new THREE.Group();
    const { w, d } = p;
    const pts = p.shape === 'circle' ? circlePts(w / 2, 48).map(([x, z]) => [x, z * d / w]) : p.shape === 'rounded' ? roundedRectPts(w, d, Math.min(w, d) * 0.25, 6) : [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]];
    mesh(polyGeo(pts, 0.04 + (p.layer || 0) * 0.004), surfaceMat(p.material), g, 0, 0, 0, { cast: false });
    edging(g, pts, p.edging, true);
    return g;
  },
  walkway(p, r) {
    const g = new THREE.Group();
    const { w, d } = p;
    const path = [[0, -d / 2], [0, d / 2]];
    walkPath(g, path, w, p.material, r, p.edging, p.spacing);
    return g;
  },
  deck(p) {
    const g = new THREE.Group();
    const { w, d, h } = p;
    const m = T('deck', p.material || 'cedar');
    const top = new THREE.Group(); g.add(top);
    B(top, w, 0.12, d, m, 0, h - 0.12, 0);
    const fasc = std(p.material === 'gray' ? '#77736e' : p.material === 'walnut' ? '#5a3e2b' : '#94613b');
    for (const sz of [-1, 1]) B(g, w, Math.max(0.3, h - 0.12), 0.08, fasc, 0, 0, sz * (d / 2 - 0.04));
    for (const sx of [-1, 1]) B(g, 0.08, Math.max(0.3, h - 0.12), d, fasc, sx * (w / 2 - 0.04), 0, 0);
    if (p.railing && p.railing !== 'none') {
      const rm = p.railing === 'black' ? blackMetal() : fasc;
      const runs = [[[-w / 2, -d / 2], [w / 2, -d / 2]], [[w / 2, -d / 2], [w / 2, d / 2]], [[-w / 2, d / 2], [-w / 2, -d / 2]]];
      const sw = Math.min(4, w * 0.4);
      runs.push([[-w / 2, d / 2], [-sw / 2, d / 2]], [[sw / 2, d / 2], [w / 2, d / 2]]);
      for (const [a, b] of runs) {
        const L = Math.hypot(b[0] - a[0], b[1] - a[1]); const n = Math.max(1, Math.ceil(L / 6));
        for (let i = 0; i <= n; i++) { const t = i / n; B(g, 0.3, 3.2, 0.3, rm, a[0] + (b[0] - a[0]) * t, h, a[1] + (b[1] - a[1]) * t); }
        beam(g, [a[0], h + 3.1, a[1]], [b[0], h + 3.1, b[1]], 0.25, rm);
        const nb = Math.floor(L / 0.45);
        for (let i = 1; i < nb; i++) { const t = i / nb; beam(g, [a[0] + (b[0] - a[0]) * t, h + 0.2, a[1] + (b[1] - a[1]) * t], [a[0] + (b[0] - a[0]) * t, h + 3.0, a[1] + (b[1] - a[1]) * t], 0.07, rm, p.railing === 'black'); }
      }
    }
    if (h > 0.7) {
      const steps = Math.ceil(h / 0.6);
      const sw = Math.min(4, w * 0.4);
      for (let i = 0; i < steps - 1; i++) B(g, sw, h - (i + 1) * (h / steps), 1.0, m, 0, 0, d / 2 + 0.5 + i * 1.0);
    }
    return g;
  },

  // ===== LIGHTING =====
  path_light(p) {
    const g = new THREE.Group();
    lightFixture(g, 0, 0, p.style || 'bollard', p.h || 1.8, LIGHT_COLORS[p.color || 'warm']);
    return g;
  },
  uplight(p) {
    const g = new THREE.Group();
    const col = LIGHT_COLORS[p.color || 'warm'];
    const tilt = ((p.tilt ?? 75) * PI) / 180;
    B(g, 0.4, 0.15, 0.4, std('#2b2b2b'), 0, 0, 0);
    const head = new THREE.Group(); head.position.set(0, 0.35, 0); head.rotation.x = -(PI / 2 - tilt); g.add(head);
    C(head, 0.16, 0.2, 0.5, std('#3a2f25', { metalness: 0.6 }), 0, -0.1, 0, { seg: 10 });
    C(head, 0.14, 0.14, 0.03, bulbMat(col), 0, 0.4, 0, { seg: 10 });
    const reach = p.reach || 18;
    const cone = new THREE.ConeGeometry(reach * 0.3, reach, 20, 1, true);
    cone.translate(0, -reach / 2, 0); cone.rotateX(PI);
    const cm = mesh(cone, beamMat(col), head, 0, 0.45, 0, { cast: false, receive: false, noMerge: true });
    cm.raycast = () => {};
    const dir = [0, Math.sin(tilt), Math.cos(tilt)];
    emitter(g, [0, 0.6, 0.1], { color: col, intensity: 60, distance: reach * 1.6, priority: 3, kind: 'spot', dir, angle: 0.42 });
    addGlow(g, 0, 0.6, 0.1, col, 1.0);
    return g;
  },
  lamp_post(p) {
    const g = new THREE.Group();
    const H = p.h || 7;
    const col = LIGHT_COLORS[p.color || 'warm'];
    const m = blackMetal();
    C(g, 0.4, 0.5, 0.6, m, 0, 0, 0, { seg: 10 });
    C(g, 0.12, 0.14, H - 1.4, m, 0, 0.6, 0, { seg: 10 });
    const n = p.heads === 2 ? 2 : 1;
    for (let i = 0; i < n; i++) {
      const x = n === 2 ? (i ? 1 : -1) * 1.0 : 0;
      if (n === 2) beam(g, [0, H - 1.0, 0], [x, H - 0.9, 0], 0.1, m);
      B(g, 0.9, 1.2, 0.9, bulbMat(col), x, H - 1.3, 0);
      mesh(new THREE.ConeGeometry(0.75, 0.5, 4), m, g, x, H + 0.1, 0, { ry: PI / 4 });
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) B(g, 0.06, 1.2, 0.06, m, x + sx * 0.45, H - 1.3, sz * 0.45);
      addGlow(g, x, H - 0.7, 0, col, 2.6);
    }
    emitter(g, [0, H - 0.7, 0], { color: col, intensity: 14, distance: 22, priority: 3 });
    addPool(g, 0, 0, 0, col, 6);
    return g;
  },
  tiki_torch(p) {
    const g = new THREE.Group();
    const H = p.h || 5.5;
    C(g, 0.07, 0.09, H, std('#b49b6c', { roughness: 0.9 }), 0, 0, 0, { seg: 7 });
    C(g, 0.22, 0.18, 0.5, std(p.style === 'metal' ? '#2b2b2b' : '#8a6a3c', { metalness: p.style === 'metal' ? 0.6 : 0 }), 0, H - 0.3, 0, { seg: 10 });
    const f = addFlames(g, 0, H + 0.15, 0, 0.45, 2);
    g.userData.ticks = [f.userData.tick];
    emitter(g, [0, H + 0.6, 0], { color: LIGHT_COLORS.fire, intensity: 5, distance: 12, priority: 2, flicker: true, always: true });
    addPool(g, 0, 0, 0, LIGHT_COLORS.fire, 3);
    return g;
  },

  // ===== PLAY =====
  trampoline(p) {
    const g = new THREE.Group();
    const R = p.w / 2;
    const fr = std('#9aa0a3', { metalness: 0.7, roughness: 0.35 });
    const padC = std(p.color || '#2f6fb0', { roughness: 0.7 });
    mesh(new THREE.TorusGeometry(R, 0.1, 6, 40), fr, g, 0, 3.0, 0, { rx: PI / 2 });
    mesh(new THREE.CircleGeometry(R - 0.8, 36), std('#1a1a1a', { roughness: 0.8 }), g, 0, 2.95, 0, { rx: -PI / 2 });
    const ring = new THREE.RingGeometry(R - 0.85, R + 0.1, 40, 1);
    mesh(ring, padC, g, 0, 3.08, 0, { rx: -PI / 2 });
    const legs = 6;
    for (let i = 0; i < legs; i++) {
      const a = i / legs * PI * 2;
      beam(g, [Math.cos(a - 0.2) * R, 0, Math.sin(a - 0.2) * R], [Math.cos(a) * R, 3.0, Math.sin(a) * R], 0.12, fr, true);
      beam(g, [Math.cos(a + 0.2) * R, 0, Math.sin(a + 0.2) * R], [Math.cos(a) * R, 3.0, Math.sin(a) * R], 0.12, fr, true);
    }
    if (p.net !== false) {
      const np = 8;
      for (let i = 0; i < np; i++) { const a = i / np * PI * 2; C(g, 0.06, 0.06, 6.0, std('#202020'), Math.cos(a) * (R - 0.05), 3.0, Math.sin(a) * (R - 0.05), { seg: 6 }); }
      const net = new THREE.CylinderGeometry(R - 0.1, R - 0.1, 5.8, 40, 1, true);
      const uv = net.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 2 * PI * R, uv.getY(i) * 5.8);
      mesh(net, std('#ffffff', { map: texTiled('chainLink', 0.6, 0.6), alphaTest: 0.4, side: DS, color: '#333' }), g, 0, 3.0 + 2.9, 0, { cast: false });
      mesh(new THREE.TorusGeometry(R - 0.1, 0.06, 4, 40), std('#202020'), g, 0, 8.8, 0, { rx: PI / 2 });
    }
    return g;
  },
  playset(p, r) {
    const g = new THREE.Group();
    const { w, d } = p;
    const wood = T('deck', 'cedar');
    const accent = std(p.accent || '#2d8a4e', { roughness: 0.6 });
    // tower at -x end
    const tw = 5, td = 5, ph = 5;
    const tx = -w / 2 + tw / 2, tz = -d / 2 + td / 2 + 0.2;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) B(g, 0.35, ph + 4.5, 0.35, wood, tx + sx * (tw / 2 - 0.2), 0, tz + sz * (td / 2 - 0.2));
    B(g, tw, 0.2, td, wood, tx, ph, tz);
    for (const sz of [-1, 1]) for (let i = 0; i < 6; i++) B(g, 0.12, 2.6, 0.12, wood, tx - tw / 2 + 0.5 + i * 0.8, ph + 0.2, tz + sz * (td / 2 - 0.2));
    mesh(gableGeo(tw + 0.6, td + 0.6, 2.6, true), accent, g, tx, ph + 4.5, tz, { ry: PI / 2 });
    // slide off front (+z)
    const slide = new THREE.Group(); slide.position.set(tx, ph, tz + td / 2); slide.rotation.x = 0.62; g.add(slide);
    B(slide, 1.8, 0.1, 8.5, accent, 0, 0, 4.25);
    for (const s of [-1, 1]) B(slide, 0.1, 0.5, 8.5, accent, s * 0.9, 0, 4.25);
    // ladder / rock wall on -x side
    mesh(boxGeo(0.25, 6.0, tw - 0.5), wood, g, tx - tw / 2 - 0.9, 2.8, tz, { rz: -0.3 });
    for (let i = 0; i < 8; i++) blob(g, 0.2, std(['#e8442b', '#f2c230', '#3a7fd8'][i % 3]), tx - tw / 2 - 1.05 + i * 0.07, 0.8 + i * 0.6, tz + (r() - 0.5) * 3, 1, 1, 1, 0);
    // swing beam along +x
    const bx0 = tx + tw / 2, bx1 = w / 2 - 0.4, by = 8.5;
    beam(g, [bx0, by, tz], [bx1, by, tz], 0.45, wood);
    for (const sz of [-1, 1]) beam(g, [bx1, by, tz], [bx1, 0, tz + sz * 3.2], 0.35, wood);
    const ns = Math.max(1, Math.floor((bx1 - bx0 - 1) / 2.6));
    for (let i = 0; i < ns; i++) {
      const x = bx0 + 1.4 + i * 2.6;
      for (const s of [-1, 1]) beam(g, [x + s * 0.8, by, tz], [x + s * 0.8, 1.7, tz], 0.04, std('#999', { metalness: 0.8 }), true, { cast: false });
      B(g, 1.9, 0.12, 0.6, std('#222'), x, 1.6, tz);
    }
    return g;
  },
  sandbox(p) {
    const g = new THREE.Group();
    const { w, d } = p;
    const m = T('deck', 'cedar');
    B(g, w, 0.9, 0.35, m, 0, 0, d / 2 - 0.17); B(g, w, 0.9, 0.35, m, 0, 0, -d / 2 + 0.17);
    B(g, 0.35, 0.9, d - 0.7, m, w / 2 - 0.17, 0, 0); B(g, 0.35, 0.9, d - 0.7, m, -w / 2 + 0.17, 0, 0);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) B(g, 0.9, 0.12, 0.9, m, sx * (w / 2 - 0.45), 0.9, sz * (d / 2 - 0.45));
    mesh(new THREE.PlaneGeometry(w - 0.7, d - 0.7), T('sand'), g, 0, 0.6, 0, { rx: -PI / 2, cast: false });
    blob(g, 0.6, T('sand'), 0.5, 0.6, 0.3, 1, 0.5, 1, 1);
    return g;
  },
  cornhole(p) {
    const g = new THREE.Group();
    const d = p.d;
    const m = std(p.color || '#2f5d8a'), wood = T('deck', 'cedar');
    for (const s of [-1, 1]) {
      const b = new THREE.Group(); b.position.set(0, 0, s * (d / 2 - 2)); b.rotation.y = s > 0 ? PI : 0; g.add(b);
      const slab = new THREE.Group(); slab.rotation.x = -0.24; slab.position.set(0, 0.25, 0); b.add(slab);
      B(slab, 2, 0.15, 4, m, 0, 0, 0);
      mesh(new THREE.CircleGeometry(0.25, 16), std('#111'), slab, 0, 0.16, -1, { rx: -PI / 2, cast: false });
      B(b, 0.15, 1.0, 0.15, wood, 0.8, 0, -1.8); B(b, 0.15, 1.0, 0.15, wood, -0.8, 0, -1.8);
    }
    return g;
  },
  soccer_goal(p) {
    const g = new THREE.Group();
    const { w, d, h } = p;
    const wm = std('#f2f2f2', { metalness: 0.3 });
    beam(g, [-w / 2, 0, d / 2], [-w / 2, h, d / 2], 0.25, wm, true); beam(g, [w / 2, 0, d / 2], [w / 2, h, d / 2], 0.25, wm, true);
    beam(g, [-w / 2, h, d / 2], [w / 2, h, d / 2], 0.25, wm, true);
    for (const s of [-1, 1]) beam(g, [s * w / 2, h, d / 2], [s * w / 2, 0, -d / 2], 0.15, wm, true);
    beam(g, [-w / 2, 0, -d / 2], [w / 2, 0, -d / 2], 0.15, wm, true);
    const net = std('#ffffff', { map: texTiled('chainLink', 0.5, 0.5), alphaTest: 0.4, side: DS });
    const V = (x, y, z) => new THREE.Vector3(x, y, z);
    mesh(facesGeo([[V(-w / 2, h, d / 2), V(w / 2, h, d / 2), V(w / 2, 0, -d / 2), V(-w / 2, 0, -d / 2)], [V(-w / 2, 0, d / 2), V(-w / 2, h, d / 2), V(-w / 2, 0, -d / 2)], [V(w / 2, 0, d / 2), V(w / 2, 0, -d / 2), V(w / 2, h, d / 2)]]), net, g, 0, 0, 0, { cast: false });
    return g;
  },
};

// ---------------- shared sub-builders ----------------
let _water;
export function waterMat() {
  if (!_water) _water = new THREE.MeshStandardMaterial({ color: '#ffffff', map: tex('water'), roughness: 0.08, metalness: 0.0, transparent: true, opacity: 0.9, emissive: '#0a3550', emissiveIntensity: 0.25 });
  return _water;
}
function poolShell(g, outline, H, style = 'gray', round = true) {
  const wallCol = { gray: '#8e9498', blue: '#2f5f99', resin: '#d8cfbf', wood: '#7a5a3e', white: '#e8e8e4' }[style] || '#8e9498';
  const wallM = style === 'wood' ? std('#ffffff', { map: tex('deck', 'walnut'), side: DS }) : std(wallCol, { roughness: 0.55, metalness: style === 'gray' ? 0.35 : 0.1, side: DS });
  const liner = std('#5db4dc', { roughness: 0.6, side: DS });
  mesh(wallStripGeo(outline, H - 0.1, 0), wallM, g);
  const inner = outline.map(([x, z]) => { const L = Math.hypot(x, z) || 1; return [x - (x / L) * 0.06, z - (z / L) * 0.06]; });
  mesh(wallStripGeo(inner, H - 0.15, 0.02), liner, g, 0, 0, 0, { cast: false });
  mesh(polyGeo(inner, 0.03), liner, g, 0, 0, 0, { cast: false });
  mesh(polyGeo(inner, H - 0.55), waterMat(), g, 0, 0, 0, { cast: false, noMerge: true });
  // top rail
  const railM = std(style === 'resin' ? '#cfc6b4' : style === 'blue' ? '#e9ecef' : wallCol, { roughness: 0.45, metalness: style === 'gray' ? 0.4 : 0.1 });
  const ribbon = ribbonGeo(outline, 0.55, H, true);
  if (ribbon) mesh(ribbon, railM, g, 0, 0, 0);
  // legs / uprights
  const per = outline.length;
  const L = outline.reduce((s, p, i) => s + Math.hypot(outline[(i + 1) % per][0] - p[0], outline[(i + 1) % per][1] - p[1]), 0);
  const nLegs = Math.max(8, Math.round(L / 3.8));
  let acc = 0, next = 0, k = 0;
  for (let i = 0; i < per && k < nLegs; i++) {
    const a = outline[i], b = outline[(i + 1) % per];
    const seg = Math.hypot(b[0] - a[0], b[1] - a[1]);
    while (next <= acc + seg && k < nLegs) {
      const t = (next - acc) / seg;
      const x = a[0] + (b[0] - a[0]) * t, z = a[1] + (b[1] - a[1]) * t;
      const Ln = Math.hypot(x, z) || 1;
      B(g, 0.3, H, 0.3, railM, x + (x / Ln) * 0.18, 0, z + (z / Ln) * 0.18);
      k++; next += L / nLegs;
    }
    acc += seg;
  }
}
function poolLadder(g, x, z, H) {
  const m = std('#cfd2d4', { metalness: 0.6, roughness: 0.35 });
  const l = new THREE.Group(); l.position.set(x, 0, z); g.add(l);
  for (const s of [-1, 1]) {
    beam(l, [s * 0.9, 0, 2.2], [s * 0.9, H + 1.2, 0.0], 0.15, m, true);
    beam(l, [s * 0.9, 0, -2.0], [s * 0.9, H + 1.2, 0.0], 0.15, m, true);
  }
  for (let i = 1; i <= 3; i++) {
    const t = i / 4;
    B(l, 1.8, 0.1, 0.5, m, 0, (H + 1.2) * t - 0.05, 2.2 * (1 - t));
    B(l, 1.8, 0.1, 0.5, m, 0, (H + 1.2) * t - 0.05, -2.0 * (1 - t));
  }
  B(l, 1.8, 0.15, 0.7, m, 0, H + 1.1, 0);
}
export function lightFixture(g, x, z, style, H, col, y = 0) {
  const m = std('#2b2620', { metalness: 0.5, roughness: 0.5 });
  if (style === 'mushroom') {
    C(g, 0.05, 0.06, H, m, x, y, z, { seg: 8 });
    mesh(new THREE.ConeGeometry(0.55, 0.3, 14), m, g, x, y + H + 0.05, z);
    C(g, 0.12, 0.12, 0.15, bulbMat(col), x, y + H - 0.2, z, { seg: 8 });
  } else if (style === 'lantern') {
    C(g, 0.04, 0.04, H - 0.5, m, x, y, z, { seg: 6 });
    B(g, 0.38, 0.5, 0.38, bulbMat(col), x, y + H - 0.5, z);
    mesh(new THREE.ConeGeometry(0.32, 0.22, 4), m, g, x, y + H + 0.1, z, { ry: PI / 4 });
  } else {
    C(g, 0.2, 0.22, H - 0.35, m, x, y, z, { seg: 10 });
    C(g, 0.19, 0.19, 0.3, bulbMat(col), x, y + H - 0.35, z, { seg: 10 });
    C(g, 0.25, 0.25, 0.08, m, x, y + H - 0.05, z, { seg: 10 });
  }
  addGlow(g, x, y + H - 0.15, z, col, 0.9);
  addPool(g, x, y, z, col, style === 'mushroom' ? 3.2 : 2.6);
  emitter(g, [x, y + H - 0.1, z], { color: col, intensity: 3, distance: 9, priority: 1 });
}
export function edging(g, pts, kind, closed = true) {
  if (!kind || kind === 'none') return;
  const P = closed ? [...pts, pts[0]] : pts;
  const m = kind === 'steel' ? std('#3c3027', { metalness: 0.6, roughness: 0.6 }) : kind === 'brick' ? T('pavers', 'running', 'red') : kind === 'boulders' ? std('#cdbf9e', { flatShading: true }) : T('stone', 'limestone');
  const r = rng(pts.length * 17 + 3);
  for (let i = 0; i < P.length - 1; i++) {
    const [ax, az] = P[i], [bx, bz] = P[i + 1];
    const L = Math.hypot(bx - ax, bz - az); if (L < 0.01) continue;
    const ang = -Math.atan2(bz - az, bx - ax);
    if (kind === 'steel') mesh(boxGeo(L + 0.02, 0.22, 0.03), m, g, (ax + bx) / 2, 0.11, (az + bz) / 2, { ry: ang, cast: false });
    else if (kind === 'boulders') {
      for (let t = 0; t < L; t += 1.6 + r()) blob(g, 0.45 + r() * 0.35, m, ax + (bx - ax) * t / L, 0.1, az + (bz - az) * t / L, 1.2, 0.6, 1, 0);
    } else mesh(boxGeo(L + 0.3, kind === 'brick' ? 0.2 : 0.35, kind === 'brick' ? 0.4 : 0.6), m, g, (ax + bx) / 2, kind === 'brick' ? 0.1 : 0.17, (az + bz) / 2, { ry: ang });
  }
}
export function walkPath(g, path, width, material, r, edge, spacing = 2) {
  if (material === 'stepping' || material === 'stepping_round' || material === 'stepping_square') {
    // discrete stones along the path
    let total = 0; const seglen = [];
    for (let i = 0; i < path.length - 1; i++) { const L = Math.hypot(path[i + 1][0] - path[i][0], path[i + 1][1] - path[i][1]); seglen.push(L); total += L; }
    const stoneM = material === 'stepping_square' ? T('concrete', '#b7b0a3') : T('flagstone', 'buff');
    const sp = Math.max(1.2, spacing || 2);
    const n = Math.max(1, Math.floor(total / sp));
    const off = (total - (n - 1) * sp) / 2;
    for (let k = 0; k < n; k++) {
      let s = off + k * sp, i = 0;
      while (i < seglen.length - 1 && s > seglen[i]) { s -= seglen[i]; i++; }
      const a = path[i], b = path[i + 1];
      const t = Math.min(1, s / (seglen[i] || 1));
      const x = a[0] + (b[0] - a[0]) * t, z = a[1] + (b[1] - a[1]) * t;
      const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
      let outline;
      if (material === 'stepping_round') outline = circlePts(width * 0.42, 18);
      else if (material === 'stepping_square') outline = [[-width * 0.4, -0.85], [width * 0.4, -0.85], [width * 0.4, 0.85], [-width * 0.4, 0.85]].map(([u, v]) => [u * Math.cos(ang + PI / 2) - v * Math.sin(ang + PI / 2), u * Math.sin(ang + PI / 2) + v * Math.cos(ang + PI / 2)]);
      else outline = stonePts(width * 0.42, r, 8, 0.35).map(([u, v]) => [u, v * 0.8]);
      const pts = outline.map(([u, v]) => [x + u + (r() - 0.5) * 0.15, z + v]);
      const geo = new THREE.ExtrudeGeometry(new THREE.Shape(pts.map((p) => new THREE.Vector2(p[0], -p[1]))), { depth: 0.12, bevelEnabled: false });
      geo.rotateX(-PI / 2);
      const pos = geo.attributes.position, uv = geo.attributes.uv;
      for (let q = 0; q < pos.count; q++) uv.setXY(q, pos.getX(q), pos.getZ(q));
      mesh(geo, stoneM, g, 0, 0.0, 0, { cast: false });
    }
    return;
  }
  const geo = ribbonGeo(path, width, 0.045);
  if (!geo) return;
  const m = surfaceMat(material);
  if (material.startsWith('pavers') || material === 'brick' || material.startsWith('deck') || material.startsWith('slab')) {
    // ribbon UVs (across, along) keep pattern aligned with path direction
    mesh(geo, m, g, 0, 0, 0, { cast: false });
  } else {
    // world UVs for organic materials
    const pos = geo.attributes.position, uv = geo.attributes.uv;
    for (let q = 0; q < pos.count; q++) uv.setXY(q, pos.getX(q), pos.getZ(q));
    mesh(geo, m, g, 0, 0, 0, { cast: false });
  }
  if (edge && edge !== 'none') {
    const left = [], right = [];
    for (let i = 0; i < path.length; i++) {
      const prev = path[Math.max(0, i - 1)], next = path[Math.min(path.length - 1, i + 1)];
      let tx = next[0] - prev[0], tz = next[1] - prev[1]; const L = Math.hypot(tx, tz) || 1; tx /= L; tz /= L;
      left.push([path[i][0] - tz * width / 2, path[i][1] + tx * width / 2]);
      right.push([path[i][0] + tz * width / 2, path[i][1] - tx * width / 2]);
    }
    edging(g, left, edge, false); edging(g, right, edge, false);
  }
}
