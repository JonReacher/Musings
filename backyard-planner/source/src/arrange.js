// Auto-arrange: move what you've added so nothing collides.
// Items sitting on/inside something (a chair on a pad, a sectional under a pergola) move with it as one group.
import { app, rng, pointInPoly, polyArea } from './core.js';
import { TYPES } from './catalog.js';
import { footprint } from './editor.js';

const LINEAR = new Set(['walk_path', 'walkway', 'creek', 'string_lights', 'light_row']);
const FIXED_SOLID = new Set(['fence_line', 'hedge']);
const HOSTS = new Set(['surface_pad', 'grill_pad', 'walkway', 'surface_area', 'flower_bed', 'planting_bed', 'rock_garden', 'deck', 'outdoor_rug', 'putting_green', 'fire_pit', 'pergola', 'gazebo', 'shade_sail', 'dog_run', 'privacy_area', 'chicken_coop', 'half_court', 'dining_set', 'sectional', 'conversation_set', 'garden_plot']);
const TREES = new Set(['tree_shade', 'tree_orn', 'tree_fruit', 'tree_evergreen']);
const POLES = new Set(['umbrella', 'cantilever_umbrella']);
const ZONE = {
  near: ['hot_tub', 'outdoor_kitchen', 'pizza_oven', 'grill_pad', 'grill', 'dining_set', 'bar_set', 'conversation_set', 'sectional', 'pergola', 'cold_plunge', 'outdoor_shower', 'patio_heater', 'sofa', 'bistro_set', 'picnic_table', 'deck'],
  back: ['garden_plot', 'greenhouse', 'compost_bin', 'playset', 'trampoline', 'raised_bed', 'chicken_coop', 'sauna', 'movie_screen', 'hammock', 'half_court', 'koi_pond'],
  edge: ['tree_shade', 'tree_orn', 'tree_fruit', 'tree_evergreen', 'shrub', 'grass_orn', 'agave', 'dog_run', 'dog_house', 'privacy_screen', 'rain_barrel', 'soccer_goal', 'cornhole', 'ladder_toss', 'shed', 'playhouse', 'deck_box', 'bird_feeder', 'uplight', 'lamp_post', 'basketball_hoop', 'dog_agility', 'flower_bed', 'planting_bed', 'rock_garden'],
  center: ['pool_round', 'pool_oval', 'pool_rect', 'stock_tank', 'fire_pit', 'surface_pad', 'putting_green', 'gazebo', 'shade_sail', 'sandbox', 'surface_area', 'outdoor_rug', 'fountain'],
};
const zoneOf = (type) => Object.keys(ZONE).find((z) => ZONE[z].includes(type)) || 'mid';

// ---------- geometry ----------
function hull(points) {
  const pts = points.map((p) => [p[0], p[1]]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (pts.length < 3) return pts;
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [], upper = [];
  for (const p of pts) { while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop(); lower.push(p); }
  for (let i = pts.length - 1; i >= 0; i--) { const p = pts[i]; while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop(); upper.push(p); }
  upper.pop(); lower.pop();
  return lower.concat(upper);
}
function bbox(poly) {
  let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity;
  for (const [x, z] of poly) { if (x < a) a = x; if (z < b) b = z; if (x > c) c = x; if (z > d) d = z; }
  return [a, b, c, d];
}
// convex polygons A, B separated by at least `gap`?
function separated(A, B, gap) {
  for (const P of [A, B]) {
    for (let i = 0; i < P.length; i++) {
      const p1 = P[i], p2 = P[(i + 1) % P.length];
      let nx = -(p2[1] - p1[1]), nz = p2[0] - p1[0];
      const L = Math.hypot(nx, nz); if (L < 1e-9) continue; nx /= L; nz /= L;
      let amin = Infinity, amax = -Infinity, bmin = Infinity, bmax = -Infinity;
      for (const q of A) { const v = q[0] * nx + q[1] * nz; if (v < amin) amin = v; if (v > amax) amax = v; }
      for (const q of B) { const v = q[0] * nx + q[1] * nz; if (v < bmin) bmin = v; if (v > bmax) bmax = v; }
      if (amax + gap <= bmin || bmax + gap <= amin) return true;
    }
  }
  return false;
}
// do any of the convex pieces in A and B overlap by more than `slack`?
const clash = (A, B, slack) => { for (const p of A) for (const q of B) if (!separated(p, q, -slack)) return true; return false; };
const circle = (x, z, r, n = 10) => Array.from({ length: n }, (_, i) => [x + Math.cos((i / n) * Math.PI * 2) * r, z + Math.sin((i / n) * Math.PI * 2) * r]);
// rotate (x,z) the same way three.js rotation.y = a does
const rot = (x, z, a) => [x * Math.cos(a) + z * Math.sin(a), -x * Math.sin(a) + z * Math.cos(a)];
function bufferSeg(a, b, r) {
  const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz) || 1;
  const nx = (-dz / L) * r, nz = (dx / L) * r, tx = (dx / L) * r, tz = (dz / L) * r;
  return [[a[0] + nx - tx, a[1] + nz - tz], [b[0] + nx + tx, b[1] + nz + tz], [b[0] - nx + tx, b[1] - nz + tz], [a[0] - nx - tx, a[1] - nz - tz]];
}

// Flat things you can set furniture on. They only collide with other flat things or with solid
// obstacles, so a chair half on a gravel pad isn't counted as an overlap.
const CANOPY = new Set(['pergola', 'gazebo', 'shade_sail']);
const GROUND = new Set(['surface_pad', 'grill_pad', 'surface_area', 'flower_bed', 'planting_bed', 'rock_garden', 'outdoor_rug', 'putting_green', 'deck', 'garden_plot']);

// what an item occupies on the ground. `roomy` widens trees to roughly their canopy for new placements;
// otherwise a tree is just its trunk.
function solidPoly(it, roomy = true) {
  const t = TYPES[it.type];
  if (TREES.has(it.type)) return circle(it.x, it.z, roomy ? Math.max(1.3, Math.min(it.w * 0.16, 3)) : Math.max(0.6, Math.min(it.w * 0.05, 1.2)));
  if (POLES.has(it.type)) return circle(it.x, it.z, roomy ? 1.4 : 0.6);
  if (t.kind === 'area') return hull(it.pts);
  return hull(footprint(it));
}

// the convex pieces that count as an actual collision: a pergola is its posts, a tree its trunk
function tightPolys(it) {
  if (CANOPY.has(it.type)) return hull(footprint(it)).map(([x, z]) => circle(x, z, 0.35, 6));
  return [solidPoly(it, false)];
}

export function arrange(mode = 'fix', seed = 1) {
  const items = app.items;
  const r = rng(seed * 7919 + 13);
  const fence = items.find((i) => i.type === 'fence_line' && i.existing);
  let bounds = [-11.5, 0, 40, 50], outer = [-11.5, -25, 40, 50];
  if (fence) { const [a, b, c, d] = bbox(fence.pts); bounds = [a + 0.4, 0, c - 0.4, d - 0.4]; outer = [a, b, c, d]; }
  const slab = items.find((i) => i.type === 'slab' && !i.hidden);
  const slabPoly = slab ? footprint(slab) : null;
  const slabBox = slabPoly ? bbox(slabPoly) : null;
  const overlapsSlab = (bb) => slabBox && bb[0] < slabBox[2] && bb[2] > slabBox[0] && bb[1] < slabBox[3] && bb[3] > slabBox[1];

  // ---- candidates and their parents (containment) ----
  const movable = items.filter((i) => !i.existing && !i.locked && !i.hidden && !LINEAR.has(i.type) && !FIXED_SOLID.has(i.type));
  const info = new Map();
  for (const it of movable) {
    const fp = TYPES[it.type].kind === 'box' ? footprint(it) : it.pts;
    const c = TYPES[it.type].kind === 'box' ? [it.x, it.z] : centerOf(it.pts);
    info.set(it.id, { it, fp, area: polyArea(fp), c, roomy: solidPoly(it, true), tight: GROUND.has(it.type) ? [hull(fp)] : tightPolys(it), ground: GROUND.has(it.type) });
  }
  const parentOf = new Map();
  for (const a of info.values()) {
    let best = null;
    for (const b of info.values()) {
      if (a === b || !HOSTS.has(b.it.type)) continue;
      if (b.area < a.area * 1.3) continue;
      if (!pointInPoly(a.c[0], a.c[1], b.fp)) continue;
      if (!best || b.area < best.area) best = b;
    }
    if (best) parentOf.set(a.it.id, best.it.id);
    else if (slabPoly && pointInPoly(a.c[0], a.c[1], slabPoly)) parentOf.set(a.it.id, 'slab');
  }
  // a child that actually collides with a bigger sibling (say a dog run dropped onto the pool's pad)
  // is pulled out of the group so it can move on its own
  const kids = new Map();
  for (const [c, p] of parentOf) if (p !== 'slab') { if (!kids.has(p)) kids.set(p, []); kids.get(p).push(c); }
  for (const list of kids.values()) {
    list.sort((a, b) => info.get(b).area - info.get(a).area);
    const ok = [];
    for (const id of list) {
      const f = info.get(id);
      if (!f.ground && ok.some((o) => !info.get(o).ground && clash(f.tight, info.get(o).tight, 0.25))) { parentOf.delete(id); continue; }
      ok.push(id);
    }
  }
  const rootOf = (id) => { let cur = id, guard = 0; while (parentOf.has(cur) && parentOf.get(cur) !== 'slab' && guard++ < 20) cur = parentOf.get(cur); return cur; };
  const groups = new Map();
  for (const id of info.keys()) { const root = rootOf(id); if (!groups.has(root)) groups.set(root, []); groups.get(root).push(id); }
  const rel = (P, cx, cz) => P.map(([x, z]) => [x - cx, z - cz]);
  const clusters = [...groups.entries()].map(([root, ids]) => {
    const all = [], sol = [], gnd = [];
    for (const id of ids) { const f = info.get(id); all.push(...f.roomy); (f.ground ? gnd : sol).push(...f.tight); }
    const H = hull(all);
    const [a, b, c, d] = bbox(H);
    const cx = (a + c) / 2, cz = (b + d) / 2;
    const rootIt = info.get(root).it;
    return { root, ids, rad: Math.max(...H.map(([x, z]) => Math.hypot(x - cx, z - cz))), full: rel(H, cx, cz), S: sol.map((P) => rel(P, cx, cz)), G: gnd.map((P) => rel(P, cx, cz)), cx, cz, area: polyArea(H), patio: parentOf.get(root) === 'slab', type: rootIt.type, round: TYPES[rootIt.type].resize === 'diam' && ids.length === 1 };
  });

  // ---- fixed obstacles ----
  // full: what new placements keep clear of. solid / ground: what counts as an actual collision.
  const obstacles = [];
  const addObs = (full, solid, ground) => { const bb = bbox(full); obstacles.push({ full, bb, solid, ground, patio: overlapsSlab(bb) }); };
  for (const it of items) {
    if (it.hidden) continue;
    if (info.has(it.id)) continue;
    const t = TYPES[it.type];
    if (it.type === 'slab' || LINEAR.has(it.type)) continue;
    if (it.type === 'covered_patio') {
      const c = Math.cos(it.rot || 0), s = Math.sin(it.rot || 0);
      for (const sx of [-1, 1]) {
        const lx = sx * (it.w / 2 - 1.3), lz = it.d / 2 - 1.2;
        const post = circle(it.x + lx * c + lz * s, it.z - lx * s + lz * c, 0.6, 8);
        addObs(post, [post], null);
      }
      continue;
    }
    if (it.type === 'fence_line' || it.type === 'hedge') {
      if (it.existing && it.type === 'fence_line') continue; // the yard bounds already cover it
      const rad = it.type === 'hedge' ? (it.w || 3) / 2 : 0.3;
      for (let i = 0; i < it.pts.length - 1; i++) { const seg = bufferSeg(it.pts[i], it.pts[i + 1], rad); addObs(seg, [seg], null); }
      continue;
    }
    const full = t.kind === 'area' ? hull(it.pts) : solidPoly(it, true);
    if (it.existing && it.type === 'rock_garden') addObs(full, null, null); // the drainage strip: keep new things off it, but it's only rocks
    else if (GROUND.has(it.type)) addObs(full, null, [full]);
    else addObs(full, tightPolys(it), null);
  }
  if (slabPoly) addObs(slabPoly, null, [slabPoly]);

  // ---- placement ----
  const placed = [], placedPatio = [];
  const GAP = 2.0, GAP_OBS = 1.0;
  const at = (P, x, z, a) => P.map(([hx, hz]) => { const [rx, rz] = rot(hx, hz, a); return [rx + x, rz + z]; });
  const atAll = (L, x, z, a) => L.map((P) => at(P, x, z, a));
  const near = (bb, o, g) => !(bb[2] + g < o[0] || o[2] + g < bb[0] || bb[3] + g < o[1] || o[3] + g < bb[1]);
  // tolerant: is it fine to leave this here? (nothing actually touching). Otherwise: is this a comfortable new spot?
  const feasible = (cl, x, z, a, gapScale, tolerant) => {
    const patio = cl.patio;
    const full = at(cl.full, x, z, a);
    const bb = bbox(full);
    const B = patio ? (tolerant ? slabBox : [slabBox[0] + 0.2, slabBox[1] + 0.2, slabBox[2] - 0.2, slabBox[3] - 0.2]) : tolerant ? outer : bounds;
    if (bb[0] < B[0] - 0.01 || bb[1] < B[1] - 0.01 || bb[2] > B[2] + 0.01 || bb[3] > B[3] + 0.01) return false;
    const others = patio ? placedPatio : placed;
    if (tolerant) {
      const S = atAll(cl.S, x, z, a), G = atAll(cl.G, x, z, a);
      for (const o of obstacles) {
        if (patio && !o.patio) continue;
        if (!near(bb, o.bb, 0.05)) continue;
        if (o.solid && (clash(S, o.solid, 0.1) || clash(G, o.solid, 0.1))) return false;
        if (o.ground && clash(G, o.ground, 0.25)) return false;
      }
      for (const q of others) {
        if (!near(bb, q.bb, 0.05)) continue;
        if (clash(S, q.S, 0.25) || clash(G, q.G, 0.25)) return false;
      }
      return true;
    }
    const g1 = GAP_OBS * gapScale;
    for (const o of obstacles) {
      if (patio && !o.patio) continue;
      if (!near(bb, o.bb, g1)) continue;
      if (!separated(full, o.full, g1)) return false;
    }
    const g2 = (patio ? 1.0 : GAP) * gapScale;
    for (const q of others) {
      if (!near(bb, q.bb, g2)) continue;
      if (!separated(full, q.full, g2)) return false;
    }
    return true;
  };
  const distFence = (x, z) => Math.min(x - bounds[0], bounds[2] - x, bounds[3] - z);
  const score = (cl, x, z, attempt) => {
    const yz = (z - 11) / 36;
    const zone = zoneOf(cl.type);
    let s = 0;
    if (zone === 'near') s = 1 - Math.min(1, Math.max(0, yz));
    else if (zone === 'back') s = Math.min(1, Math.max(0, yz));
    else if (zone === 'edge') s = 1 - Math.min(1, distFence(x, z) / 10);
    else if (zone === 'center') s = 1 - Math.min(1, Math.hypot(x - (bounds[0] + bounds[2]) / 2, z - 28) / 22);
    else s = 0.5;
    let near = 12;
    for (const q of placed) near = Math.min(near, Math.hypot(q.x - x, q.z - z));
    // if an earlier try ran out of room, push the biggest things toward the fences so the middle stays open
    const edge = (d) => 1 - Math.min(1, Math.max(0, d - cl.rad) / 6);
    const hug = attempt && cl.area > 140 ? (edge(Math.min(x - bounds[0], bounds[2] - x)) + edge(bounds[3] - z)) * 3.5 * attempt : 0;
    return s * 10 + near * (attempt ? 0.1 : 0.25) + hug + r() * 3.5;
  };
  // biggest first; things on the patio last (they only shuffle on the patio)
  clusters.sort((a, b) => (a.patio - b.patio) || b.area - a.area);
  const placeAll = (attempt) => {
  placed.length = 0; placedPatio.length = 0;
  const moves = new Map();
  const unplaced = [];
  for (const cl of clusters) {
    const rots = cl.round ? [0] : mode === 'fix' ? [0, Math.PI / 2] : (r() < 0.5 ? [0, Math.PI / 2] : [Math.PI / 2, 0]);
    let best = null;
    // nearest free spot, spiralling out from where the group is now. Staying put only needs
    // the group not to actually touch anything; a new spot gets comfortable walking room.
    const spiral = (gapScale) => {
      let found = null;
      for (const a of rots) {
        for (let rad = 0; rad <= 70 && !(found && rad + (a ? 3 : 0) >= found.d); rad += rad < 12 ? 0.5 : 1) {
          const steps = rad === 0 ? 1 : Math.max(8, Math.round((2 * Math.PI * rad) / 0.75));
          let hit = null;
          for (let k = 0; k < steps; k++) {
            if (rad === 0 && a) break;
            const ang = (k / steps) * Math.PI * 2;
            const x = cl.cx + Math.cos(ang) * rad, z = cl.cz + Math.sin(ang) * rad;
            if (feasible(cl, x, z, a, gapScale, rad === 0)) { hit = { x, z, a, d: rad + (a ? 3 : 0) }; break; }
          }
          if (hit) { if (!found || hit.d < found.d) found = hit; break; }
        }
      }
      return found;
    };
    for (const gapScale of [1, 0.45, 0.15]) {
      if (mode === 'fix') {
        best = spiral(gapScale);
      } else if (gapScale === 0.15) {
        best = spiral(gapScale);
      } else {
        const B = cl.patio ? slabBox : bounds;
        const off = r();
        for (const a of rots) {
          for (let x = B[0] + off; x <= B[2]; x += 1) for (let z = B[1] + off; z <= B[3]; z += 1) {
            if (!feasible(cl, x, z, a, gapScale, false)) continue;
            const sc = cl.patio ? r() : score(cl, x, z, attempt);
            if (!best || sc > best.sc) best = { x, z, a, sc };
          }
        }
      }
      if (best) break;
    }
    if (!best) { unplaced.push(cl); best = { x: cl.cx, z: cl.cz, a: 0 }; }
    const full = at(cl.full, best.x, best.z, best.a);
    (cl.patio ? placedPatio : placed).push({ full, bb: bbox(full), S: atAll(cl.S, best.x, best.z, best.a), G: atAll(cl.G, best.x, best.z, best.a), x: best.x, z: best.z });
    moves.set(cl, best);
  }
  return { moves, unplaced };
  };
  let result = placeAll(0);
  for (let t = 1; mode === 'new' && t < 7 && result.unplaced.length; t++) { const next = placeAll(t); if (next.unplaced.length < result.unplaced.length) result = next; }
  const { moves, unplaced } = result;

  // ---- apply ----
  const next = JSON.parse(JSON.stringify(items));
  const byId = new Map(next.map((i) => [i.id, i]));
  let moved = 0;
  for (const [cl, m] of moves) {
    const dx = m.x - cl.cx, dz = m.z - cl.cz;
    if (Math.abs(dx) < 1e-6 && Math.abs(dz) < 1e-6 && !m.a) continue;
    moved++;
    for (const id of cl.ids) {
      const it = byId.get(id);
      const tf = (x, z) => { const [rx, rz] = rot(x - cl.cx, z - cl.cz, m.a); return [Math.round((rx + m.x) * 4) / 4, Math.round((rz + m.z) * 4) / 4]; };
      if (TYPES[it.type].kind === 'box') { [it.x, it.z] = tf(it.x, it.z); it.rot = (it.rot || 0) + m.a; }
      else it.pts = it.pts.map(([x, z]) => tf(x, z));
    }
  }
  return { items: next, moved, groups: clusters.length, unplaced: unplaced.map((c) => byId.get(c.root)) };
}
function centerOf(pts) { const [a, b, c, d] = bbox(pts); return [(a + c) / 2, (b + d) / 2]; }

// overlap report used by the UI
export function countOverlaps() {
  const res = arrange('fix', 1);
  return res.moved + res.unplaced.length;
}
