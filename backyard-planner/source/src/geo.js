import * as THREE from 'three';

const UP = new THREE.Vector3(0, 1, 0);

// Build geometry from convex polygon faces. UVs are planar per-face in feet.
export function facesGeo(faces, center = null) {
  const pos = [], nor = [], uv = [];
  for (let face of faces) {
    face = face.map((p) => (p.isVector3 ? p : new THREE.Vector3(...p)));
    let n = new THREE.Vector3().subVectors(face[1], face[0]).cross(new THREE.Vector3().subVectors(face[2], face[0]));
    if (n.lengthSq() < 1e-12) continue;
    n.normalize();
    if (center) {
      const fc = face.reduce((a, p) => a.add(p), new THREE.Vector3()).multiplyScalar(1 / face.length);
      if (n.dot(fc.sub(center)) < 0) { face = face.slice().reverse(); n.negate(); }
    }
    let u = new THREE.Vector3().crossVectors(UP, n);
    if (u.lengthSq() < 1e-6) u.set(1, 0, 0); else u.normalize();
    const v = new THREE.Vector3().crossVectors(n, u).normalize();
    for (let i = 1; i < face.length - 1; i++) {
      for (const p of [face[0], face[i], face[i + 1]]) {
        pos.push(p.x, p.y, p.z); nor.push(n.x, n.y, n.z); uv.push(p.dot(u), p.dot(v));
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  return g;
}

// Hip roof over rectangle w (x) by d (z), eave at y=0.
export function hipRoofGeo(w, d, rise) {
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  let faces;
  if (d >= w) {
    const r = d / 2 - w / 2;
    const A = V(-w / 2, 0, -d / 2), B = V(w / 2, 0, -d / 2), C = V(w / 2, 0, d / 2), D = V(-w / 2, 0, d / 2);
    const R1 = V(0, rise, -r), R2 = V(0, rise, r);
    faces = [[B, C, R2, R1], [D, A, R1, R2], [A, B, R1], [C, D, R2], [A, D, C, B]];
  } else {
    const r = w / 2 - d / 2;
    const A = V(-w / 2, 0, -d / 2), B = V(w / 2, 0, -d / 2), C = V(w / 2, 0, d / 2), D = V(-w / 2, 0, d / 2);
    const R1 = V(-r, rise, 0), R2 = V(r, rise, 0);
    faces = [[A, B, R2, R1], [C, D, R1, R2], [D, A, R1], [B, C, R2], [A, D, C, B]];
  }
  return facesGeo(faces, V(0, rise * 0.3, 0));
}
// Pyramid (square-ish) roof
export function pyramidGeo(w, d, rise) {
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const A = V(-w / 2, 0, -d / 2), B = V(w / 2, 0, -d / 2), C = V(w / 2, 0, d / 2), D = V(-w / 2, 0, d / 2), P = V(0, rise, 0);
  return facesGeo([[A, B, P], [B, C, P], [C, D, P], [D, A, P], [A, D, C, B]], V(0, rise * 0.3, 0));
}
// Half hip attached to a wall at z = -d/2 (ridge runs away from wall)
export function halfHipGeo(w, d, rise) {
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const BL = V(-w / 2, 0, -d / 2), BR = V(w / 2, 0, -d / 2), FR = V(w / 2, 0, d / 2), FL = V(-w / 2, 0, d / 2);
  const rf = Math.max(-d / 2 + 0.01, d / 2 - w / 2);
  const Rb = V(0, rise, -d / 2), Rf = V(0, rise, rf);
  return facesGeo([[BL, FL, Rf, Rb], [FR, BR, Rb, Rf], [FL, FR, Rf], [BL, Rb, BR], [BL, BR, FR, FL]], V(0, rise * 0.3, 0));
}
// Gable roof: ridge along z, slopes to x = ±w/2
export function gableGeo(w, d, rise, withEnds = true) {
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const A = V(-w / 2, 0, -d / 2), B = V(w / 2, 0, -d / 2), C = V(w / 2, 0, d / 2), D = V(-w / 2, 0, d / 2);
  const R1 = V(0, rise, -d / 2), R2 = V(0, rise, d / 2);
  const faces = [[B, C, R2, R1], [D, A, R1, R2], [A, D, C, B]];
  if (withEnds) faces.push([A, B, R1], [C, D, R2]);
  return facesGeo(faces, V(0, rise * 0.3, 0));
}
// Flat ribbon along path (points [x,z]) with width; uv: u across (ft), v along (ft)
export function ribbonGeo(path, width, y = 0, closed = false) {
  const n = path.length;
  if (n < 2) return null;
  const pos = [], uv = [], idx = [];
  let along = 0;
  const pts = closed ? [...path, path[0]] : path;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const prev = pts[Math.max(0, i - 1)], next = pts[Math.min(pts.length - 1, i + 1)];
    let tx = next[0] - prev[0], tz = next[1] - prev[1];
    const L = Math.hypot(tx, tz) || 1; tx /= L; tz /= L;
    const nx = -tz, nz = tx;
    if (i > 0) along += Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]);
    pos.push(p[0] + nx * width / 2, y, p[1] + nz * width / 2, p[0] - nx * width / 2, y, p[1] - nz * width / 2);
    uv.push(0, along, width, along);
    if (i > 0) { const a = (i - 1) * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
// Flat polygon (points [x,z]) at height y with world-feet UVs
export function polyGeo(pts, y = 0) {
  const shape = new THREE.Shape(pts.map((p) => new THREE.Vector2(p[0], -p[1])));
  const g = new THREE.ShapeGeometry(shape, 4);
  g.rotateX(-Math.PI / 2);
  g.translate(0, y, 0);
  // uv from x,z
  const pos = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i), pos.getZ(i));
  return g;
}
// Extruded polygon slab (top at y=h), world UVs
export function slabGeo(pts, h, bottom = 0) {
  const shape = new THREE.Shape(pts.map((p) => new THREE.Vector2(p[0], -p[1])));
  const g = new THREE.ExtrudeGeometry(shape, { depth: h - bottom, bevelEnabled: false, steps: 1 });
  g.rotateX(-Math.PI / 2);
  g.translate(0, bottom, 0);
  const pos = g.attributes.position, uv = g.attributes.uv, nrm = g.attributes.normal;
  for (let i = 0; i < pos.count; i++) {
    if (Math.abs(nrm.getY(i)) > 0.5) uv.setXY(i, pos.getX(i), pos.getZ(i));
    else uv.setXY(i, pos.getX(i) + pos.getZ(i), pos.getY(i));
  }
  return g;
}
// Wall strip along closed outline (for pools etc.) with height h; uv u along (ft) v up (ft)
export function wallStripGeo(outline, h, y0 = 0) {
  const pos = [], uv = [], idx = [];
  const pts = [...outline, outline[0]];
  let along = 0;
  for (let i = 0; i < pts.length; i++) {
    if (i > 0) along += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    pos.push(pts[i][0], y0, pts[i][1], pts[i][0], y0 + h, pts[i][1]);
    uv.push(along, 0, along, h);
    if (i > 0) { const a = (i - 1) * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
export function stadium(w, d, seg = 12) {
  // capsule outline: straight sides along longer axis
  const pts = [];
  const long = Math.max(w, d), short = Math.min(w, d);
  const r = short / 2, half = long / 2 - r;
  for (let i = 0; i <= seg; i++) { const a = -Math.PI / 2 + (i / seg) * Math.PI; pts.push([half + Math.cos(a) * r, Math.sin(a) * r]); }
  for (let i = 0; i <= seg; i++) { const a = Math.PI / 2 + (i / seg) * Math.PI; pts.push([-half + Math.cos(a) * r, Math.sin(a) * r]); }
  return d > w ? pts.map(([x, z]) => [z, x]) : pts;
}
export function circlePts(r, seg = 40, cx = 0, cz = 0) {
  const pts = [];
  for (let i = 0; i < seg; i++) { const a = (i / seg) * Math.PI * 2; pts.push([cx + Math.cos(a) * r, cz + Math.sin(a) * r]); }
  return pts;
}
export function roundedRectPts(w, d, r, seg = 6) {
  r = Math.min(r, w / 2, d / 2);
  const pts = [];
  const cs = [[w / 2 - r, d / 2 - r, 0], [-w / 2 + r, d / 2 - r, Math.PI / 2], [-w / 2 + r, -d / 2 + r, Math.PI], [w / 2 - r, -d / 2 + r, Math.PI * 1.5]];
  for (const [cx, cz, a0] of cs) for (let i = 0; i <= seg; i++) { const a = a0 + (i / seg) * Math.PI / 2; pts.push([cx + Math.cos(a) * r, cz + Math.sin(a) * r]); }
  return pts;
}
// Irregular stone outline
export function stonePts(r, rnd, seg = 9, irregular = 0.25) {
  const pts = [];
  for (let i = 0; i < seg; i++) {
    const a = (i / seg) * Math.PI * 2 + (rnd() - 0.5) * 0.3;
    const rr = r * (1 - irregular / 2 + rnd() * irregular);
    pts.push([Math.cos(a) * rr, Math.sin(a) * rr]);
  }
  return pts;
}
export function catenary(a, b, sag, n = 12) {
  const out = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - sag * 4 * t * (1 - t), a[2] + (b[2] - a[2]) * t]);
  }
  return out;
}
