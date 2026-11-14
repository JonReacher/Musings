import * as THREE from 'three';
import { std, B, C, blob, beam, mesh, rng, smoothPath, pointInPoly, segDist, polyLength } from './core.js';
import { polyGeo, ribbonGeo, catenary, circlePts } from './geo.js';
import { bulbMat, addPointGlows, emitter, addPool, LIGHT_COLORS } from './fx.js';
import { buildFenceLine, leafMat } from './models_site.js';
import { BUILDERS, surfaceMat, edging, walkPath, lightFixture } from './models_items.js';

const PI = Math.PI;

function samplePath(path, spacing) {
  const out = [];
  let carry = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const [ax, az] = path[i], [bx, bz] = path[i + 1];
    const L = Math.hypot(bx - ax, bz - az);
    let s = carry;
    while (s <= L) {
      const t = L ? s / L : 0;
      out.push([ax + (bx - ax) * t, az + (bz - az) * t, Math.atan2(bz - az, bx - ax)]);
      s += spacing;
    }
    carry = s - L;
  }
  const last = path[path.length - 1];
  if (out.length && Math.hypot(out[out.length - 1][0] - last[0], out[out.length - 1][1] - last[1]) > spacing * 0.5) out.push([last[0], last[1], 0]);
  return out;
}

export const POLY_BUILDERS = {
  fence_line(it) {
    const g = new THREE.Group();
    buildFenceLine(g, it.pts, it.p.style, it.h || 6, false);
    return g;
  },
  walk_path(it, r) {
    const g = new THREE.Group();
    const path = it.p.smooth !== false ? smoothPath(it.pts, false, 6) : it.pts;
    walkPath(g, path, it.w || 3, it.p.material, r, it.p.edging, it.p.spacing);
    return g;
  },
  creek(it, r) {
    const g = new THREE.Group();
    const path = smoothPath(it.pts, false, 8);
    const w = it.w || 3;
    // variable width ribbon
    const geo = ribbonGeo(path, w, 0.04);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i += 2) {
      const k = 0.75 + 0.5 * Math.sin(i * 0.37) * Math.sin(i * 0.11 + 1);
      const mx = (pos.getX(i) + pos.getX(i + 1)) / 2, mz = (pos.getZ(i) + pos.getZ(i + 1)) / 2;
      for (const j of [i, i + 1]) { pos.setX(j, mx + (pos.getX(j) - mx) * k); pos.setZ(j, mz + (pos.getZ(j) - mz) * k); }
    }
    const uv = geo.attributes.uv;
    for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i), pos.getZ(i));
    mesh(geo, surfaceMat(it.p.material || 'river_rock'), g, 0, 0, 0, { cast: false });
    const bm = std('#bfb193', { flatShading: true, roughness: 0.95 });
    const bm2 = std('#9a917f', { flatShading: true, roughness: 0.95 });
    for (const [x, z, a] of samplePath(path, 2.8)) {
      if (r() < 0.35) continue;
      const side = r() < 0.5 ? -1 : 1;
      const off = w * (0.38 + r() * 0.2) * side;
      blob(g, 0.4 + r() * 0.6, r() < 0.5 ? bm : bm2, x - Math.sin(a) * off, 0.12, z + Math.cos(a) * off, 1.2, 0.55, 1, 0);
    }
    return g;
  },
  hedge(it, r) {
    const g = new THREE.Group();
    const path = it.p.smooth ? smoothPath(it.pts, false, 6) : it.pts;
    const w = it.w || 3, h = it.h || 4;
    const v = it.p.variety || 'boxwood';
    const cols = { boxwood: ['#3f6a2c', '#466f31'], privet: ['#4f7a35', '#557f3c'], holly: ['#2f4f26', '#36592b'], flowering: ['#4c7535', '#557f3c'], cypress: ['#2f4a2c', '#35532f'] }[v];
    const sp = v === 'cypress' ? Math.max(2.5, w * 0.9) : Math.max(0.9, w * 0.45);
    for (const [x, z] of samplePath(path, sp)) {
      if (v === 'cypress') { const t = BUILDERS.tree({ w, h, kind: 'cypress' }, r, Math.floor(r() * 1e6)); t.position.set(x, 0, z); g.add(t); continue; }
      blob(g, w / 2, leafMat(cols[Math.floor(r() * 2)]), x + (r() - 0.5) * 0.2, h * 0.5, z + (r() - 0.5) * 0.2, 1, h / w, 1, 1);
      if (v === 'flowering' && r() < 0.8) {
        const fm = std(it.p.bloom || '#f07fa4', { flatShading: true });
        for (let k = 0; k < 3; k++) blob(g, w * 0.08, fm, x + (r() - 0.5) * w * 0.9, h * (0.4 + r() * 0.55), z + (r() - 0.5) * w * 0.9, 1, 1, 1, 0, { cast: false });
      }
    }
    return g;
  },
  string_lights(it) {
    const g = new THREE.Group();
    const H = it.h || 9;
    const pts = it.pts;
    const col = LIGHT_COLORS[it.p.color || 'warm'];
    const multi = it.p.color === 'multi';
    const multiCols = [LIGHT_COLORS.red, LIGHT_COLORS.green, LIGHT_COLORS.blue, LIGHT_COLORS.warm, LIGHT_COLORS.pink];
    const poleM = it.p.pole === 'wood' ? std('#7a5638') : std('#232323', { metalness: 0.5, roughness: 0.5 });
    const poles = it.p.poles || 'all';
    const tops = pts.map(([x, z]) => [x, H, z]);
    pts.forEach(([x, z], i) => {
      if (poles === 'none' || (poles === 'skipFirst' && i === 0)) return;
      if (it.p.pole === 'wood') { B(g, 0.33, H + 0.3, 0.33, poleM, x, 0, z); }
      else { C(g, 0.08, 0.1, H + 0.3, poleM, x, 0, z, { seg: 8 }); }
      if (it.p.base === 'planter') { C(g, 0.9, 0.7, 1.6, std('#2b2b2b'), x, 0, z, { seg: 14 }); blob(g, 0.8, leafMat('#4f7a33'), x, 1.9, z, 1, 0.7, 1, 1); }
    });
    const wire = std('#151515');
    const lb = [];
    const bulbsByCol = new Map();
    let k = 0;
    for (let i = 0; i < tops.length - 1; i++) {
      const a = tops[i], b = tops[i + 1];
      const span = Math.hypot(b[0] - a[0], b[2] - a[2]);
      const sag = (it.p.sag ?? 1) * Math.min(2.5, 0.06 * span + 0.2);
      const n = Math.max(2, Math.round(span / 2));
      const cpts = catenary(a, b, sag, n);
      for (let q = 0; q < cpts.length - 1; q++) beam(g, cpts[q], cpts[q + 1], 0.04, wire, true, { cast: false });
      for (let q = 1; q < cpts.length - (i === tops.length - 2 ? 0 : 1); q++) {
        const c = cpts[q];
        const bc = multi ? multiCols[k++ % multiCols.length] : col;
        const m = bulbMat(bc);
        if (it.p.bulb === 'globe') blob(g, 0.2, m, c[0], c[1] - 0.3, c[2], 1, 1, 1, 1, { cast: false });
        else blob(g, 0.12, m, c[0], c[1] - 0.3, c[2], 1, 1.5, 1, 0, { cast: false });
        if (!bulbsByCol.has(bc)) bulbsByCol.set(bc, []);
        bulbsByCol.get(bc).push(c[0], c[1] - 0.3, c[2]);
      }
      const mid = cpts[Math.floor(cpts.length / 2)];
      emitter(g, [mid[0], mid[1] - 0.6, mid[2]], { color: multi ? LIGHT_COLORS.warm : col, intensity: Math.min(8, 2 + span * 0.25), distance: 16, priority: 2 });
      addPool(g, mid[0], 0, mid[2], multi ? LIGHT_COLORS.warm : col, Math.min(7, span * 0.45 + 1));
    }
    for (const [c, arr] of bulbsByCol) addPointGlows(g, arr, c, it.p.bulb === 'globe' ? 1.6 : 1.2);
    return g;
  },
  light_row(it) {
    const g = new THREE.Group();
    const path = it.p.smooth ? smoothPath(it.pts, false, 6) : it.pts;
    const col = LIGHT_COLORS[it.p.color || 'warm'];
    for (const [x, z] of samplePath(path, it.p.spacing || 6)) lightFixture(g, x, z, it.p.style || 'bollard', it.h || 1.8, col);
    return g;
  },
  area(it, r) {
    const g = new THREE.Group();
    let pts = it.pts;
    if (it.p.smooth) pts = smoothPath(pts, true, 6);
    mesh(polyGeo(pts, 0.04 + (it.layer || 0) * 0.004), surfaceMat(it.p.material || 'mulch_brown'), g, 0, 0, 0, { cast: false });
    edging(g, pts, it.p.edging, true);
    const plants = it.p.plants || 'none';
    if (plants !== 'none') {
      const dens = { light: 3.2, medium: 2.3, full: 1.6 }[it.p.density || 'medium'];
      let minx = Infinity, maxx = -Infinity, minz = Infinity, maxz = -Infinity;
      for (const [x, z] of pts) { minx = Math.min(minx, x); maxx = Math.max(maxx, x); minz = Math.min(minz, z); maxz = Math.max(maxz, z); }
      let count = 0;
      for (let x = minx + dens / 2; x < maxx; x += dens) for (let z = minz + dens / 2; z < maxz; z += dens) {
        if (count > 220) break;
        const px = x + (r() - 0.5) * dens * 0.6, pz = z + (r() - 0.5) * dens * 0.6;
        if (!pointInPoly(px, pz, pts)) continue;
        let edge = Infinity;
        for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; edge = Math.min(edge, segDist(px, pz, a[0], a[1], b[0], b[1])); }
        if (edge < 0.7) continue;
        count++;
        let kind = plants;
        if (plants === 'mixed') kind = ['shrub', 'flowers', 'grass', 'flowers', 'shrub'][Math.floor(r() * 5)];
        if (plants === 'xeriscape') kind = ['succulent', 'grass', 'boulder', 'succulent'][Math.floor(r() * 4)];
        let o;
        const seed = Math.floor(r() * 1e6);
        const rr = rng(seed);
        if (kind === 'shrub' || kind === 'shrubs') o = BUILDERS.shrub({ w: dens * 0.75, h: dens * 0.7, variety: ['boxwood', 'flowering', 'loropetalum', 'salvia'][Math.floor(r() * 4)] }, rr);
        else if (kind === 'grass' || kind === 'grasses') o = BUILDERS.grass_orn({ w: dens * 0.7, h: dens * 0.8, variety: ['muhly', 'fountain', 'feather'][Math.floor(r() * 3)] }, rr);
        else if (kind === 'succulent' || kind === 'succulents') o = BUILDERS.agave({ w: dens * 0.7, variety: ['agave', 'sotol', 'yucca'][Math.floor(r() * 3)] }, rr);
        else if (kind === 'boulder') o = BUILDERS.boulder({ w: dens * 0.6, d: dens * 0.5, h: dens * 0.3, stone: 'limestone' }, rr);
        else if (kind === 'veggies') o = BUILDERS.flowers({ w: dens * 0.5, color: 'yellow' }, rr);
        else o = BUILDERS.flowers({ w: dens * 0.55, color: it.p.bloom || 'mixed' }, rr);
        o.position.set(px, 0.03, pz);
        o.rotation.y = r() * PI * 2;
        g.add(o);
      }
    }
    if (it.p.boulders) {
      const n = Math.max(1, Math.round(Math.sqrt(polyLength(pts, true)) / 2));
      let placed = 0, tries = 0;
      let minx = Infinity, maxx = -Infinity, minz = Infinity, maxz = -Infinity;
      for (const [x, z] of pts) { minx = Math.min(minx, x); maxx = Math.max(maxx, x); minz = Math.min(minz, z); maxz = Math.max(maxz, z); }
      while (placed < n && tries++ < 60) {
        const x = minx + r() * (maxx - minx), z = minz + r() * (maxz - minz);
        if (!pointInPoly(x, z, pts)) continue;
        const o = BUILDERS.boulder({ w: 1.6 + r() * 1.6, d: 1.4 + r() * 1.2, h: 0.9 + r() * 0.8, stone: 'limestone' }, rng(tries * 7));
        o.position.set(x, 0, z); o.rotation.y = r() * 6; g.add(o); placed++;
      }
    }
    return g;
  },
};
