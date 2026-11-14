import * as THREE from 'three';
import { tex } from './textures.js';
import { mesh } from './core.js';

// Shared, globally-animated materials for lights, glows, windows, flames.
const glowSprites = new Map();
const pointGlows = new Map();
const pools = new Map();
const bulbs = new Map();
const beams = new Map();
export const LIGHT_COLORS = {
  warm: '#ffc875', soft: '#ffdca8', cool: '#e6f0ff', amber: '#ff9a3c', multi: '#ffd27a', fire: '#ff8a2a',
  red: '#ff5a4a', green: '#6dff8a', blue: '#6aa8ff', pink: '#ff8ad8',
};
let state = { lights: 0, night: 0 };

export function glowSpriteMat(color) {
  if (!glowSprites.has(color)) {
    glowSprites.set(color, new THREE.SpriteMaterial({ map: tex('glow'), color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0, fog: false }));
  }
  return glowSprites.get(color);
}
export function pointGlowMat(color, size = 1.2) {
  const key = color + size;
  if (!pointGlows.has(key)) {
    pointGlows.set(key, new THREE.PointsMaterial({ map: tex('glow'), color, size, sizeAttenuation: true, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0, fog: false }));
  }
  return pointGlows.get(key);
}
export function poolMat(color) {
  if (!pools.has(color)) {
    pools.set(color, new THREE.MeshBasicMaterial({ map: tex('pool'), color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0, polygonOffset: true, polygonOffsetFactor: -4, fog: false }));
  }
  return pools.get(color);
}
export function bulbMat(color) {
  if (!bulbs.has(color)) {
    bulbs.set(color, new THREE.MeshStandardMaterial({ color: '#fff6e0', emissive: new THREE.Color(color), emissiveIntensity: 0.0, roughness: 0.3 }));
  }
  return bulbs.get(color);
}
export function beamMat(color) {
  if (!beams.has(color)) beams.set(color, new THREE.MeshBasicMaterial({ color, map: tex('beamGrad'), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0, side: THREE.DoubleSide, fog: false }));
  return beams.get(color);
}
export const windowGlass = new THREE.MeshStandardMaterial({ color: '#2d4248', roughness: 0.12, metalness: 0.35, emissive: new THREE.Color('#ffb860'), emissiveIntensity: 0 });

export function flameMat() {
  const m = new THREE.MeshBasicMaterial({ map: tex('flame'), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, side: THREE.DoubleSide, fog: false });
  return m;
}

// Add a glow sprite (local position)
export function addGlow(parent, x, y, z, color, size = 1.5) {
  const s = new THREE.Sprite(glowSpriteMat(color));
  s.position.set(x, y, z);
  s.scale.set(size, size, size);
  s.userData.noMerge = true;
  s.raycast = () => {};
  parent.add(s);
  return s;
}
export function addPool(parent, x, y, z, color, radius = 3) {
  const m = mesh(new THREE.CircleGeometry(radius, 24), poolMat(color), parent, x, y + 0.04, z, { rx: -Math.PI / 2, cast: false, receive: false });
  m.raycast = () => {};
  m.renderOrder = 2;
  return m;
}
export function addPointGlows(parent, positions, color, size = 1.2) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  const p = new THREE.Points(g, pointGlowMat(color, size));
  p.userData.noMerge = true;
  p.raycast = () => {};
  parent.add(p);
  return p;
}
export function emitter(group, p, o = {}) {
  (group.userData.emitters ||= []).push({ p, color: o.color || LIGHT_COLORS.warm, intensity: o.intensity ?? 6, distance: o.distance ?? 14, priority: o.priority ?? 1, kind: o.kind || 'point', dir: o.dir, angle: o.angle, flicker: o.flicker, always: o.always });
}

// Flames: a few crossed planes with flicker animation
export function addFlames(parent, x, y, z, size = 1, count = 3) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.userData.noMerge = true;
  const mats = [];
  for (let i = 0; i < count; i++) {
    const m = flameMat();
    mats.push(m);
    for (let k = 0; k < 2; k++) {
      const pl = new THREE.Mesh(new THREE.PlaneGeometry(size * 0.7, size * 1.4), m);
      pl.position.set((Math.random() - 0.5) * size * 0.5, size * 0.6, (Math.random() - 0.5) * size * 0.5);
      pl.rotation.y = k * Math.PI / 2 + i * 0.7;
      pl.raycast = () => {};
      g.add(pl);
    }
  }
  const seed = Math.random() * 100;
  g.userData.tick = (t) => {
    g.children.forEach((c, i) => {
      const s = 0.85 + 0.25 * Math.sin(t * 9 + i * 1.7 + seed) * Math.sin(t * 5.3 + i);
      c.scale.set(1, s, 1);
      c.position.y = size * 0.6 * s;
    });
  };
  parent.add(g);
  return g;
}

export function setLightState(lights, night) {
  state.lights = lights; state.night = night;
  for (const m of glowSprites.values()) m.opacity = lights * 0.9;
  for (const m of pointGlows.values()) m.opacity = lights;
  for (const m of pools.values()) m.opacity = lights * 0.55;
  for (const m of bulbs.values()) m.emissiveIntensity = 0.15 + lights * 3.2;
  for (const m of beams.values()) m.opacity = lights * 0.16;
  windowGlass.emissiveIntensity = night * 0.55;
}
export function lightState() { return state; }
