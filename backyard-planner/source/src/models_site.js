import * as THREE from 'three';
import { std, B, C, blob, beam, mesh, boxGeo, rng } from './core.js';
import { tex, texTiled } from './textures.js';
import { facesGeo, hipRoofGeo, halfHipGeo, pyramidGeo, gableGeo, catenary } from './geo.js';
import { windowGlass, bulbMat, addPointGlows, emitter, addGlow, LIGHT_COLORS } from './fx.js';

const DS = THREE.DoubleSide;
export const COL = {
  siding: '#dcd8cc', trim: '#ece7da', bronze: '#463a31', roof: '#4a4d50', door: '#2f3337', concrete: '#c3b8a3',
};
const texMat = (color, name, args = [], o = {}) => std(color, { map: tex(name, ...args), ...o });

// ---------- windows & doors (facing +z, bottom-center at origin) ----------
export function wallWindow(parent, x, y, z, w, h, ry = 0, opts = {}) {
  const g = new THREE.Group();
  const trim = std(COL.trim, { roughness: 0.6 });
  const t = 0.28, dpt = 0.14;
  B(g, w + t * 2, t, dpt, trim, 0, -t, 0);
  B(g, w + t * 2, t, dpt, trim, 0, h, 0);
  B(g, t, h, dpt, trim, -w / 2 - t / 2, 0, 0);
  B(g, t, h, dpt, trim, w / 2 + t / 2, 0, 0);
  B(g, w + t * 2 + 0.3, 0.12, 0.3, trim, 0, -t - 0.12, 0.05);
  mesh(new THREE.PlaneGeometry(w, h), windowGlass, g, 0, h / 2, 0.02, { cast: false });
  if (opts.mullion !== false) B(g, w, 0.12, 0.08, trim, 0, h / 2 - 0.06, 0.03);
  if (opts.vbar) B(g, 0.1, h, 0.08, trim, 0, 0, 0.03);
  g.position.set(x, y, z); g.rotation.y = ry;
  parent.add(g);
  return g;
}
export function wallDoor(parent, x, y, z, w = 3, h = 7, ry = 0) {
  const g = new THREE.Group();
  const trim = std(COL.trim, { roughness: 0.6 });
  B(g, w, h, 0.12, std(COL.door, { roughness: 0.5 }), 0, 0, 0);
  mesh(new THREE.PlaneGeometry(w * 0.5, h * 0.42), windowGlass, g, 0, h * 0.62, 0.07, { cast: false });
  B(g, 0.25, h + 0.25, 0.16, trim, -w / 2 - 0.12, 0, 0);
  B(g, 0.25, h + 0.25, 0.16, trim, w / 2 + 0.12, 0, 0);
  B(g, w + 0.5, 0.25, 0.16, trim, 0, h, 0);
  C(g, 0.06, 0.06, 0.25, std('#b8b4ac', { metalness: 0.8, roughness: 0.3 }), w / 2 - 0.35, h * 0.45, 0.12, { rx: Math.PI / 2 });
  g.position.set(x, y, z); g.rotation.y = ry;
  parent.add(g);
  return g;
}

// ---------- House (local origin = footprint center; rear wall at +z) ----------
export function buildHouse(p) {
  const g = new THREE.Group();
  const W = p.w, D = p.d;
  const f1 = 10.5, f2 = 9.5;
  const lap = texMat('#ffffff', 'lapSiding', [COL.siding]);
  const bb = texMat('#ffffff', 'boardBatten', [COL.siding]);
  const trim = std(COL.trim, { roughness: 0.6 });
  const bronze = std(COL.bronze, { roughness: 0.55, metalness: 0.2 });
  B(g, W + 0.2, 0.45, D + 0.2, texMat('#ffffff', 'concrete', ['#b9b2a5']), 0, -0.1, 0);
  B(g, W, f1, D, lap, 0, 0.35, 0);
  B(g, W + 0.3, 0.5, D + 0.3, trim, 0, f1 + 0.2, 0);
  B(g, W, f2, D, bb, 0, f1 + 0.6, 0);
  const eave = f1 + 0.6 + f2;
  // fascia + roof
  const ov = 1.4;
  B(g, W + ov * 2, 0.7, D + ov * 2, bronze, 0, eave - 0.6, 0);
  mesh(hipRoofGeo(W + ov * 2 + 0.1, D + ov * 2 + 0.1, 7.2), texMat('#ffffff', 'shingles', [COL.roof]), g, 0, eave + 0.1, 0);
  // soffit
  mesh(new THREE.PlaneGeometry(W + ov * 2, D + ov * 2), std('#5a4c40'), g, 0, eave - 0.6, 0, { rx: Math.PI / 2, cast: false });
  const rz = D / 2 + 0.03;
  const cx = (wx) => wx - 14.5; // photo-derived positions measured from house's left (west) corner
  // first floor, rear
  wallWindow(g, cx(7.0), 3.0, rz, 2.6, 5.0);
  wallWindow(g, cx(10.1), 3.0, rz, 2.6, 5.0);
  wallDoor(g, cx(15.0), 0.35, rz, 3, 7.4);
  wallWindow(g, cx(22.0), 3.0, rz, 2.6, 5.0);
  wallWindow(g, cx(25.1), 3.0, rz, 2.6, 5.0);
  // second floor, rear
  wallWindow(g, cx(5.8), 13.6, rz, 2.8, 4.6);
  wallWindow(g, cx(14.5), 17.2, rz, 3.6, 1.8, 0, { mullion: false, vbar: true });
  wallWindow(g, cx(23.0), 13.6, rz, 2.8, 4.6);
  // side windows
  for (const sx of [-1, 1]) {
    const ry = sx * Math.PI / 2, x = sx * (W / 2 + 0.03);
    wallWindow(g, x, 3.0, D / 2 - 7, 2.6, 4.6, ry);
    wallWindow(g, x, 13.6, D / 2 - 6, 2.6, 4.6, ry);
    wallWindow(g, x, 13.6, -D / 2 + 9, 2.6, 4.6, ry);
  }
  // gutters & downspouts
  B(g, W + ov * 2, 0.4, 0.4, bronze, 0, eave - 0.8, D / 2 + ov);
  for (const dx of [-W / 2 - ov + 0.4, W / 2 + ov - 0.4]) {
    B(g, 0.3, eave - 0.6, 0.3, bronze, dx * 0.985, 0.2, D / 2 + 0.25);
  }
  B(g, 0.3, eave - 0.6 - 12.6, 0.3, bronze, cx(12.3), 12.6, D / 2 + 0.25);
  // AC pad & front
  return g;
}

// ---------- Concrete slab ----------
export function buildSlab(p) {
  const g = new THREE.Group();
  B(g, p.w, p.h, p.d, texMat('#ffffff', 'concrete', [COL.concrete]), 0, 0, 0);
  return g;
}

// ---------- Covered patio (back edge at -d/2 touches house) ----------
export function buildCoveredPatio(p) {
  const g = new THREE.Group();
  const { w, d } = p;
  const eave = p.h;
  const bronze = std('#3c3530', { roughness: 0.55, metalness: 0.15 });
  const inset = 1.3;
  const postX = w / 2 - inset, postZ = d / 2 - 1.2;
  for (const sx of [-1, 1]) {
    B(g, 0.62, eave - 0.9, 0.62, bronze, sx * postX, 0, postZ);
    B(g, 0.85, 0.5, 0.85, bronze, sx * postX, 0, postZ);
  }
  // beams
  B(g, 2 * postX + 0.7, 0.9, 0.5, bronze, 0, eave - 1.3, postZ);
  for (const sx of [-1, 1]) B(g, 0.5, 0.9, postZ + d / 2, bronze, sx * postX, eave - 1.3, (postZ - d / 2) / 2);
  // ceiling
  mesh(new THREE.PlaneGeometry(w - 0.4, d - 0.2), std('#3a332e', { roughness: 0.9, side: DS }), g, 0, eave - 0.35, 0, { rx: Math.PI / 2, cast: false });
  // fascia & roof
  B(g, w, 0.5, 0.25, bronze, 0, eave - 0.5, d / 2 - 0.12);
  for (const sx of [-1, 1]) B(g, 0.25, 0.5, d, bronze, sx * (w / 2 - 0.12), eave - 0.5, 0);
  const roof = mesh(halfHipGeo(w, d, 3.8), texMat('#ffffff', 'shingles', [COL.roof]), g, 0, eave, 0);
  roof.userData.noMerge = true;
  roof.userData.isRoof = true;
  // ceiling lantern + string lights
  const lantern = new THREE.Group();
  B(lantern, 0.7, 0.9, 0.7, std('#222'), 0, -0.9, 0);
  B(lantern, 0.55, 0.65, 0.55, bulbMat(LIGHT_COLORS.warm), 0, -0.8, 0);
  lantern.position.set(0, eave - 0.35, 0);
  g.add(lantern);
  emitter(g, [0, eave - 1.4, 0], { intensity: 10, distance: 18, priority: 3 });
  const lb = [];
  const y0 = eave - 0.9;
  const runs = [
    [[-postX, y0, postZ], [postX, y0, postZ]],
    [[-postX, y0, -d / 2 + 0.2], [-postX, y0, postZ]],
    [[postX, y0, -d / 2 + 0.2], [postX, y0, postZ]],
    [[-w / 2 + 0.4, y0 + 0.3, -d / 2 + 0.4], [w / 2 - 0.4, y0 + 0.3, -d / 2 + 0.4]],
  ];
  const wire = std('#151515');
  for (const [a, b] of runs) {
    const pts = catenary(a, b, 0.6, 10);
    for (let i = 0; i < pts.length - 1; i++) beam(g, pts[i], pts[i + 1], 0.04, wire, true, { cast: false });
    for (let i = 1; i < pts.length - 1; i++) {
      const q = pts[i];
      blob(g, 0.13, bulbMat(LIGHT_COLORS.warm), q[0], q[1] - 0.25, q[2], 1, 1.3, 1, 0, { cast: false });
      lb.push(q[0], q[1] - 0.25, q[2]);
    }
  }
  addPointGlows(g, lb, LIGHT_COLORS.warm, 1.1);
  emitter(g, [0, y0, postZ], { intensity: 5, distance: 14, priority: 2 });
  return g;
}

// ---------- Shed (doors on local +z face) ----------
export function buildShed(p) {
  const g = new THREE.Group();
  const { w, d, h } = p;
  const style = p.style || 'artisan';
  if (style === 'artisan') {
    const wall = texMat('#ffffff', 'shedWall', ['#c3c1ba']);
    const dark = std('#3d3e40', { roughness: 0.7 });
    const back = h - 1.6;
    B(g, w, back, d, wall, 0, 0, 0);
    // window band (sloped top), approximated with faces
    const V = (x, y, z) => new THREE.Vector3(x, y, z);
    const yb = back;
    const band = facesGeo([
      [V(-w / 2, yb, d / 2), V(w / 2, yb, d / 2), V(w / 2, h, d / 2), V(-w / 2, h, d / 2)],
      [V(w / 2, yb, d / 2), V(w / 2, yb, -d / 2), V(w / 2, h - 0.45, -d / 2), V(w / 2, h, d / 2)],
      [V(-w / 2, yb, -d / 2), V(-w / 2, yb, d / 2), V(-w / 2, h, d / 2), V(-w / 2, h - 0.45, -d / 2)],
      [V(-w / 2, yb, -d / 2), V(w / 2, yb, -d / 2), V(w / 2, h - 0.45, -d / 2), V(-w / 2, h - 0.45, -d / 2)],
    ], V(0, yb, 0));
    mesh(band, dark, g);
    const frost = std('#c9d3d6', { roughness: 0.25, metalness: 0.1, emissive: '#000' });
    for (let i = 0; i < 3; i++) B(g, w / 3 - 0.35, 0.95, 0.06, frost, -w / 3 + i * (w / 3), yb + 0.3, d / 2 + 0.01);
    for (const sx of [-1, 1]) for (let i = 0; i < 3; i++) B(g, 0.06, 0.8, d / 3 - 0.4, frost, sx * (w / 2 + 0.01), yb + 0.3, d / 2 - d / 6 - i * d / 3);
    // pent roof
    const rv = [V(-w / 2 - 0.5, h + 0.12, d / 2 + 0.5), V(w / 2 + 0.5, h + 0.12, d / 2 + 0.5), V(w / 2 + 0.5, h - 0.4, -d / 2 - 0.4), V(-w / 2 - 0.5, h - 0.4, -d / 2 - 0.4)];
    mesh(facesGeo([rv, [...rv].reverse()]), std('#333436', { roughness: 0.6, side: DS }), g);
    // doors
    const dw = Math.min(w - 1.6, 4.6);
    const door = std('#45474a', { roughness: 0.6 });
    B(g, dw, back - 0.4, 0.1, door, 0, 0.1, d / 2 + 0.02);
    const groove = std('#36383a');
    for (const s of [-1, 1]) {
      for (const fx of [0.2, 0.5, 0.8]) B(g, 0.06, back * 0.3, 0.04, groove, s * dw / 2 * fx, back * 0.6, d / 2 + 0.08);
      for (const fx of [0.3, 0.7]) B(g, 0.06, back * 0.45, 0.04, groove, s * dw / 2 * fx, 0.5, d / 2 + 0.08);
      B(g, dw / 2 - 0.2, 0.06, 0.04, groove, s * dw / 4, back * 0.55, d / 2 + 0.08);
    }
    B(g, 0.05, back - 0.4, 0.05, groove, 0, 0.1, d / 2 + 0.08);
    for (const s of [-1, 1]) B(g, 0.12, 0.6, 0.12, std('#1e1e1e'), s * 0.18, back * 0.42, d / 2 + 0.12);
  } else if (style === 'barn') {
    const red = std('#8e3b2f', { roughness: 0.8 });
    const white = std('#efece6');
    const wallH = h * 0.62;
    B(g, w, wallH, d, red, 0, 0, 0);
    const V = (x, y, z) => new THREE.Vector3(x, y, z);
    const g1 = [[-w / 2, wallH], [-w * 0.32, h * 0.88], [0, h + 0.4], [w * 0.32, h * 0.88], [w / 2, wallH]];
    const faces = [];
    for (const zz of [d / 2, -d / 2]) faces.push([...g1.map(([x, y]) => V(x, y, zz))]);
    mesh(facesGeo(faces, V(0, wallH, 0)), red, g);
    const roofM = texMat('#ffffff', 'shingles', ['#3f3f3f'], { side: DS });
    for (let i = 0; i < g1.length - 1; i++) {
      const [x1, y1] = g1[i], [x2, y2] = g1[i + 1];
      const e = 0.4;
      mesh(facesGeo([[V(x1 * 1.04, y1, -d / 2 - e), V(x2 * 1.04, y2 + 0.05, -d / 2 - e), V(x2 * 1.04, y2 + 0.05, d / 2 + e), V(x1 * 1.04, y1, d / 2 + e)]]), roofM, g);
    }
    const dw = Math.min(w * 0.55, 5);
    B(g, dw, wallH * 0.95, 0.1, red, 0, 0, d / 2 + 0.03);
    for (const s of [-1, 1]) {
      beam(g, [s * dw / 2, 0.2, d / 2 + 0.1], [0, wallH * 0.92, d / 2 + 0.1], 0.18, white);
      B(g, 0.2, wallH * 0.95, 0.12, white, s * dw / 2, 0, d / 2 + 0.1);
    }
    B(g, dw, 0.2, 0.12, white, 0, wallH * 0.95 - 0.2, d / 2 + 0.1);
  } else {
    const wood = texMat('#ffffff', 'deck', ['cedar']);
    const wallH = h - 1.8;
    B(g, w, wallH, d, wood, 0, 0, 0);
    mesh(gableGeo(w, d, 1.8, true), wood, g, 0, wallH, 0);
    const roofM = texMat('#ffffff', 'shingles', ['#4b4f52'], { side: DS });
    const rg = gableGeo(w + 1, d + 1, 2.0, false);
    mesh(rg, roofM, g, 0, wallH + 0.05, 0);
    B(g, Math.min(w * 0.5, 4), wallH * 0.85, 0.1, std('#6b4a32'), 0, 0, d / 2 + 0.03);
    wallWindow(g, w / 2 + 0.03, wallH * 0.45, 0, 1.8, 1.6, Math.PI / 2);
  }
  return g;
}

// ---------- Fences ----------
export const FENCE_STYLES = {
  weathered: { label: 'Weathered wood (yours)', kind: 'board', tex: 'fenceWeathered', post: '#6f665a', postSize: 0.33, rails: '#6e675d' },
  cedar: { label: 'New cedar privacy', kind: 'board', tex: 'fenceCedar', texArgs: ['cedar'], post: '#a77048', postSize: 0.33, rails: '#a87249' },
  stained: { label: 'Dark stained wood', kind: 'board', tex: 'fenceCedar', texArgs: ['stained'], post: '#5f3a24', postSize: 0.33, rails: '#5f3a24' },
  horizontal: { label: 'Horizontal cedar slats', kind: 'alpha', tex: 'fenceHorizontal', texArgs: ['cedar'], tileU: 4, perFoot: true, post: '#2a2927', postSize: 0.33 },
  horizontalBlack: { label: 'Horizontal black slats', kind: 'alpha', tex: 'fenceHorizontal', texArgs: ['black'], tileU: 4, perFoot: true, post: '#1e1e1e', postSize: 0.33 },
  vinyl: { label: 'White vinyl privacy', kind: 'board', tex: 'fenceVinyl', post: '#f4f3ee', postSize: 0.42, cap: true },
  latticeTop: { label: 'Cedar with lattice top', kind: 'lattice', tex: 'fenceCedar', texArgs: ['cedar'], post: '#a77048', postSize: 0.33, rails: '#a87249' },
  wireFrame: { label: 'Cedar frame + wire panel', kind: 'frameWire', post: '#a77048', postSize: 0.33 },
  chainlink: { label: 'Chain link', kind: 'alpha', tex: 'chainLink', tileU: 1, perFoot: true, post: '#a9aeb1', round: true, topRail: true },
  weldedWire: { label: 'Welded wire', kind: 'alpha', tex: 'weldedWire', texArgs: ['galv'], tileU: 1, perFoot: true, post: '#8b8f91', round: true, topRail: true },
  blackMetal: { label: 'Black metal picket', kind: 'alpha', tex: 'metalPicket', tileU: 1, perFoot: false, post: '#1f1f1f', postSize: 0.2, metalRails: true },
  pickets: { label: 'White picket', kind: 'picket', post: '#f2f1ec', postSize: 0.33 },
};

function fenceMats(style, h) {
  const S = FENCE_STYLES[style] || FENCE_STYLES.weathered;
  if (S.kind === 'board' || S.kind === 'lattice') {
    return { S, panel: std('#ffffff', { map: texTiled(S.tex, 8, S.kind === 'lattice' ? h - 1.1 : h, ...(S.texArgs || [])), roughness: 0.9 }) };
  }
  if (S.kind === 'alpha') {
    const t = texTiled(S.tex, S.tileU, S.perFoot ? (S.tex === 'fenceHorizontal' ? 1 : 1) : h, ...(S.texArgs || []));
    return { S, panel: std('#ffffff', { map: t, alphaTest: 0.5, side: DS, roughness: 0.7, metalness: S.round ? 0.5 : 0.1 }) };
  }
  return { S };
}

// Build a fence along points (array of [x,z]); posts every <= 8ft
export function buildFenceLine(g, pts, style = 'weathered', h = 6, closed = false, opts = {}) {
  const { S, panel } = fenceMats(style, h);
  const postM = std(S.post, { roughness: S.round ? 0.4 : 0.85, metalness: S.round || S.metalRails ? 0.5 : 0 });
  const railM = std(S.rails || S.post, { roughness: 0.85 });
  const segs = [];
  const P = closed ? [...pts, pts[0]] : pts;
  const postsAt = [];
  for (let i = 0; i < P.length - 1; i++) {
    const [ax, az] = P[i], [bx, bz] = P[i + 1];
    const L = Math.hypot(bx - ax, bz - az);
    if (L < 0.05) continue;
    const skip = opts.gaps && opts.gaps[i];
    const n = Math.max(1, Math.ceil(L / 8 - 0.01));
    for (let k = 0; k < n; k++) {
      const t0 = k / n, t1 = (k + 1) / n;
      const x0 = ax + (bx - ax) * t0, z0 = az + (bz - az) * t0, x1 = ax + (bx - ax) * t1, z1 = az + (bz - az) * t1;
      if (!skip) segs.push([x0, z0, x1, z1]);
      postsAt.push([x0, z0]);
    }
    if (i === P.length - 2 && !closed) postsAt.push([bx, bz]);
  }
  const y0 = opts.y0 || 0;
  for (const [x0, z0, x1, z1] of segs) fencePanel(g, x0, z0, x1, z1, h, S, panel, railM, y0);
  for (const [x, z] of postsAt) {
    if (S.round) C(g, 0.1, 0.1, h + 0.1, postM, x, y0, z, { seg: 10 });
    else {
      const ps = S.postSize || 0.33;
      B(g, ps, h + 0.15, ps, postM, x, y0, z);
      if (S.cap) B(g, ps + 0.12, 0.15, ps + 0.12, postM, x, y0 + h + 0.15, z);
    }
  }
  return g;
}

export function fencePanel(g, x0, z0, x1, z1, h, S, panel, railM, y0 = 0) {
  const L = Math.hypot(x1 - x0, z1 - z0);
  const ang = -Math.atan2(z1 - z0, x1 - x0);
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  const grp = new THREE.Group();
  grp.position.set(cx, y0, cz); grp.rotation.y = ang;
  g.add(grp);
  if (S.kind === 'board') {
    mesh(boxGeo(L, h - 0.25, 0.07), panel, grp, 0, 0.25 + (h - 0.25) / 2, 0);
    if (S.rails) for (const ry of [1.0, h - 1.2]) B(grp, L, 0.3, 0.13, railM, 0, ry, -0.1);
  } else if (S.kind === 'lattice') {
    mesh(boxGeo(L, h - 1.35, 0.07), panel, grp, 0, 0.25 + (h - 1.35) / 2, 0);
    const lat = std('#ffffff', { map: texTiled('lattice', 0.5, 0.5, '#c99062'), alphaTest: 0.5, side: DS });
    mesh(new THREE.PlaneGeometry(L, 0.9), lat, grp, 0, h - 0.6, 0);
    for (const ry of [h - 1.15, h - 0.12]) B(grp, L, 0.14, 0.14, railM, 0, ry, 0);
    for (const ry of [1.0]) B(grp, L, 0.3, 0.13, railM, 0, ry, -0.1);
  } else if (S.kind === 'alpha') {
    const pl = new THREE.PlaneGeometry(L, h - 0.2);
    const uv = pl.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * L, uv.getY(i) * (S.perFoot ? h - 0.2 : 1));
    mesh(pl, panel, grp, 0, 0.1 + (h - 0.2) / 2, 0);
    if (S.topRail) C(grp, 0.07, 0.07, L, std(S.post, { metalness: 0.5, roughness: 0.4 }), 0, 0, 0, { rz: Math.PI / 2, seg: 8 }).position.y = h - 0.05;
    if (S.metalRails) for (const ry of [0.4, h - 0.45]) B(grp, L, 0.1, 0.1, std('#1f1f1f', { metalness: 0.5, roughness: 0.5 }), 0, ry, 0);
  } else if (S.kind === 'frameWire') {
    const wood = std('#a87249');
    B(grp, L, 0.3, 0.3, wood, 0, h - 0.3, 0);
    B(grp, L, 0.3, 0.3, wood, 0, 0.2, 0);
    const wire = std('#ffffff', { map: texTiled('weldedWire', 0.5, 0.5, 'black'), alphaTest: 0.5, side: DS, metalness: 0.4 });
    const pl = new THREE.PlaneGeometry(L - 0.2, h - 0.8);
    mesh(pl, wire, grp, 0, 0.5 + (h - 0.8) / 2, 0);
  } else if (S.kind === 'picket') {
    const white = std('#f2f1ec');
    const n = Math.floor(L / 0.5);
    for (let i = 0; i < n; i++) {
      const x = -L / 2 + 0.25 + i * (L / n);
      B(grp, 0.3, h - 0.3, 0.06, white, x, 0.2, 0);
      mesh(new THREE.ConeGeometry(0.21, 0.3, 4), white, grp, x, h - 0.1 + 0.05, 0, { ry: Math.PI / 4 }).scale.set(1, 1, 0.3);
    }
    for (const ry of [0.8, h - 0.9]) B(grp, L, 0.25, 0.1, white, 0, ry, -0.08);
  }
  return grp;
}

// ---------- Trees ----------
const LEAF = {
  oak: ['#2f4623', '#37522a', '#2a3f1f', '#40592f'],
  maple: ['#9b2f22', '#b13a26', '#862a20', '#c24a2c'],
  crape: ['#4d6b35', '#567a3b'],
  pine: ['#2f4a2c', '#35532f', '#2a4227'],
  fruit: ['#4f7a33', '#5a8a3a', '#466e2e'],
  redbud: ['#5d7e3a', '#6a8a43'],
};
export function leafMat(c) { return std(c, { flatShading: true, roughness: 0.95 }); }

export function buildTree(p, seed = 1) {
  const g = new THREE.Group();
  const r = rng(seed);
  const spread = p.w, H = p.h;
  const kind = p.kind || 'oak';
  const barkM = std('#ffffff', { map: tex('bark', kind === 'crape' ? '#9d8a78' : '#4f4439') });
  if (kind === 'cypress') {
    C(g, 0.25, 0.35, H * 0.25, barkM, 0, 0, 0, { seg: 7 });
    const n = 6;
    for (let i = 0; i < n; i++) {
      const t = i / n;
      blob(g, spread / 2 * (1 - t * 0.55), leafMat(LEAF.pine[i % 3]), (r() - 0.5) * 0.3, H * (0.2 + t * 0.7), (r() - 0.5) * 0.3, 1, 1.6, 1, 1);
    }
    return g;
  }
  if (kind === 'pine') {
    C(g, 0.3, 0.5, H * 0.3, barkM, 0, 0, 0, { seg: 7 });
    for (let i = 0; i < 4; i++) {
      const t = i / 4;
      mesh(new THREE.ConeGeometry(spread / 2 * (1 - t * 0.7), H * 0.35, 9), leafMat(LEAF.pine[i % 3]), g, 0, H * (0.3 + t * 0.55), 0);
    }
    return g;
  }
  const multi = kind === 'crape' || kind === 'maple' || kind === 'redbud';
  const trunks = multi ? 3 + Math.floor(r() * 2) : 1;
  const trunkH = H * (kind === 'oak' ? 0.32 : 0.4);
  const tr = kind === 'oak' ? Math.max(0.35, spread * 0.035) : Math.max(0.12, spread * 0.02);
  const tips = [];
  for (let t = 0; t < trunks; t++) {
    const a = (t / trunks) * Math.PI * 2 + r();
    const lean = multi ? 0.25 + r() * 0.2 : (r() - 0.5) * 0.15;
    const top = [Math.cos(a) * lean * trunkH, trunkH, Math.sin(a) * lean * trunkH];
    beam(g, [0, 0, 0], top, tr * 2 * (multi ? 0.8 : 1), barkM, true, { seg: 8 });
    // branches
    const nb = kind === 'oak' ? 4 : 2;
    for (let b = 0; b < nb; b++) {
      const ba = a + (b / nb) * Math.PI * 2 + r() * 0.8;
      const reach = spread * (kind === 'oak' ? 0.36 : 0.28) * (0.7 + r() * 0.4);
      const tip = [top[0] + Math.cos(ba) * reach, top[1] + H * (kind === 'oak' ? 0.22 : 0.35) * (0.6 + r() * 0.5), top[2] + Math.sin(ba) * reach];
      beam(g, top, tip, tr * (multi ? 0.9 : 1.1), barkM, true, { seg: 6 });
      tips.push(tip);
    }
  }
  const leaves = LEAF[kind] || LEAF.oak;
  const nBlobs = kind === 'oak' ? 16 : 10;
  const canopyY = H * (kind === 'oak' ? 0.62 : 0.7);
  for (let i = 0; i < nBlobs; i++) {
    const a = r() * Math.PI * 2, rad = Math.sqrt(r()) * spread * 0.36;
    const x = Math.cos(a) * rad, z = Math.sin(a) * rad;
    const y = canopyY + (1 - rad / (spread * 0.4)) * H * 0.18 + (r() - 0.5) * H * 0.1;
    const s = spread * (0.15 + r() * 0.09);
    blob(g, s, leafMat(leaves[Math.floor(r() * leaves.length)]), x, Math.min(y, H - s * 0.5), z, 1, kind === 'oak' ? 0.62 : 0.8, 1, 1);
  }
  for (const tip of tips) blob(g, spread * 0.16, leafMat(leaves[0]), tip[0], tip[1], tip[2], 1, 0.7, 1, 1);
  if (p.flowers) {
    const fm = std(p.flowers, { flatShading: true, roughness: 0.9 });
    for (let i = 0; i < 34; i++) {
      const a = r() * Math.PI * 2, rad = Math.sqrt(r()) * spread * 0.4;
      blob(g, spread * (0.035 + r() * 0.03), fm, Math.cos(a) * rad, canopyY + H * 0.08 + r() * H * 0.16, Math.sin(a) * rad, 1, 0.8, 1, 0, { cast: false });
    }
  }
  if (p.fruit) {
    const fm = std(p.fruit, { roughness: 0.5 });
    for (let i = 0; i < 26; i++) {
      const a = r() * Math.PI * 2, rad = spread * (0.3 + r() * 0.12);
      blob(g, 0.17, fm, Math.cos(a) * rad, canopyY - H * 0.05 + r() * H * 0.18, Math.sin(a) * rad, 1, 1, 1, 0, { cast: false });
    }
  }
  return g;
}

// ---------- Neighbor context ----------
export function buildNeighborHouse(w, d, stories, color, roofColor = '#55585b', stone = false) {
  const g = new THREE.Group();
  const H = stories * 9.5;
  const m = stone ? std('#ffffff', { map: tex('stone', 'limestone') }) : std('#ffffff', { map: tex('lapSiding', color) });
  B(g, w, H, d, m, 0, 0, 0);
  B(g, w + 2.4, 0.5, d + 2.4, std('#4a4038'), 0, H - 0.4, 0);
  mesh(hipRoofGeo(w + 2.4, d + 2.4, Math.min(w, d) * 0.22), std('#ffffff', { map: tex('shingles', roofColor) }), g, 0, H, 0);
  return g;
}
export function buildGazeboTop(w, d, h, roofColor = '#2d3a55') {
  const g = new THREE.Group();
  const post = std('#2b2a28', { metalness: 0.4, roughness: 0.5 });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) B(g, 0.35, h, 0.35, post, sx * (w / 2 - 0.3), 0, sz * (d / 2 - 0.3));
  for (const sz of [-1, 1]) B(g, w, 0.35, 0.3, post, 0, h - 0.35, sz * (d / 2 - 0.3));
  for (const sx of [-1, 1]) B(g, 0.3, 0.35, d, post, sx * (w / 2 - 0.3), h - 0.35, 0);
  const roofM = std(roofColor, { metalness: 0.5, roughness: 0.45, side: DS });
  mesh(pyramidGeo(w + 1.2, d + 1.2, 3.2), roofM, g, 0, h, 0);
  mesh(pyramidGeo(w * 0.35, d * 0.35, 1.2), roofM, g, 0, h + 3.0, 0);
  C(g, 0.12, 0.12, 0.6, post, 0, h + 2.4, 0);
  return g;
}
export function buildAC() {
  const g = new THREE.Group();
  B(g, 3.2, 0.25, 3.2, std('#b5afa4'), 0, 0, 0);
  B(g, 2.8, 2.8, 2.8, std('#c9c7c0', { metalness: 0.3, roughness: 0.5 }), 0, 0.25, 0);
  C(g, 1.1, 1.1, 0.1, std('#2a2a2a'), 0, 3.05, 0);
  return g;
}
