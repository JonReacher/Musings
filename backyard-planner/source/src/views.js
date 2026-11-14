import * as THREE from 'three';
import { S } from './scene.js';
import { app } from './core.js';
import { E, emit, groundPoint, pickItem, getItem } from './editor.js';

// Approximate camera spots for each photo (feet; x across the yard from the house's left corner, z away from the house)
export const PHOTO_POSES = {
  '20261114_100031': { pos: [-4.51, 3.72, 3.39], look: [1.24, 1.91, 32.78], up: [0.0076, 0.9982, 0.0603], label: 'From beside the patio, looking out' },
  '20261114_100035': { pos: [-6.97, 4.5, 5.4], look: [22.75, 1.15, 7.79], up: [0.06, 0.998, -0.0214], label: 'Along the patio' },
  '20261114_100051': { pos: [-7.67, 5.74, 46.04], look: [8.53, 1.69, 21.13], up: [0.07, 0.9908, -0.1154], label: 'From the back corner' },
  '20261114_100105': { pos: [20.69, 4.83, 47.66], look: [50.39, 2.14, 44.39], up: [0.0868, 0.9957, -0.0308], label: 'At the shed' },
  '20261114_100114': { pos: [33.09, 4.93, 32.74], look: [23.06, 1.34, 4.69], up: [-0.055, 0.9927, -0.1074], label: 'From the left side of the yard' },
  '20261114_100127': { pos: [37.54, 4.86, -0.82], look: [15.04, 1.65, 18.76], up: [-0.0956, 0.994, 0.0533], label: 'From the corner by the house' },
};
const PHOTO_VFOV = 58.9; // 23mm-equivalent phone camera, 4:3

let walk = { yaw: 0, pitch: 0, keys: new Set(), look: null };
const saved = { orbit: null };

export function setView(mode, opts = {}) {
  const prev = S.camMode;
  if (prev === 'orbit') saved.orbit = { pos: S.persp.position.clone(), target: S.controls.target.clone() };
  S.camMode = mode;
  S.controls.enabled = mode === 'orbit';
  S.orthoControls.enabled = mode === 'plan';
  S.grid.visible = mode === 'plan' || !!app.settings.grid;
  document.body.dataset.view = mode;
  setRoofsVisible(mode !== 'plan');
  if (mode === 'plan') {
    S.camera = S.ortho;
    if (!S.planInit) { S.planInit = true; S.orthoControls.target.set(14, 0, 21); S.ortho.position.set(14, 300, 21); S.ortho.zoom = 1.05; S.ortho.updateProjectionMatrix(); S.orthoControls.update(); }
  } else {
    S.camera = S.persp;
  }
  if (mode === 'orbit') {
    S.persp.fov = 50; S.persp.updateProjectionMatrix();
    if (opts.pos) { S.persp.position.set(...opts.pos); S.controls.target.set(...opts.target); }
    else if (saved.orbit && prev !== 'orbit') { S.persp.position.copy(saved.orbit.pos); S.controls.target.copy(saved.orbit.target); }
    S.controls.update();
  }
  if (mode === 'walk') {
    S.persp.fov = 62; S.persp.updateProjectionMatrix();
    const start = opts.pos || [14.5, 5.4, 8.5];
    S.persp.position.set(start[0], start[1], start[2]);
    walk.yaw = opts.yaw ?? 0; walk.pitch = -0.08;
    applyWalk();
  }
  if (mode === 'photo') {
    const pose = PHOTO_POSES[opts.photo];
    S.persp.position.set(...pose.pos);
    S.persp.up.set(...(pose.up || [0, 1, 0]));
    S.persp.lookAt(new THREE.Vector3(...pose.look));
    S.persp.up.set(0, 1, 0);
    fitPhotoFov();
  }
  emit('view', mode);
}
export function fitPhotoFov() {
  const w = S.container.clientWidth, h = S.container.clientHeight;
  // the photo box: 4:3 contained in the viewport
  const boxH = Math.min(h, (w * 3) / 4);
  const v = 2 * Math.atan(Math.tan((PHOTO_VFOV * Math.PI) / 360) * (h / boxH)) * 180 / Math.PI;
  S.persp.fov = v;
  S.persp.updateProjectionMatrix();
  return { boxW: boxH * 4 / 3, boxH };
}
function setRoofsVisible(v) {
  for (const obj of app.objects.values()) for (const r of obj.userData.roofs || []) r.visible = v;
}
export function refreshRoofs() { setRoofsVisible(S.camMode !== 'plan'); }

function applyWalk() {
  const dir = new THREE.Vector3(Math.sin(walk.yaw) * Math.cos(walk.pitch), Math.sin(walk.pitch), Math.cos(walk.yaw) * Math.cos(walk.pitch));
  S.persp.lookAt(S.persp.position.clone().add(dir));
}
export function initWalk(dom) {
  dom.addEventListener('pointerdown', (ev) => {
    if (S.camMode !== 'walk' || ev.button !== 0 || E.mode !== 'select') return;
    setTimeout(() => { if (S.dragging) return; walk.look = { x: ev.clientX, y: ev.clientY, yaw: walk.yaw, pitch: walk.pitch }; }, 0);
  });
  window.addEventListener('pointermove', (ev) => {
    if (!walk.look || S.camMode !== 'walk' || S.dragging) return;
    walk.yaw = walk.look.yaw - (ev.clientX - walk.look.x) * 0.004;
    walk.pitch = Math.max(-1.2, Math.min(1.2, walk.look.pitch - (ev.clientY - walk.look.y) * 0.004));
    applyWalk();
  });
  window.addEventListener('pointerup', () => { walk.look = null; });
  dom.addEventListener('wheel', (ev) => {
    if (S.camMode !== 'walk') return;
    ev.preventDefault();
    const f = new THREE.Vector3(Math.sin(walk.yaw), 0, Math.cos(walk.yaw));
    S.persp.position.addScaledVector(f, -Math.sign(ev.deltaY) * 1.5);
  }, { passive: false });
  window.addEventListener('keydown', (ev) => {
    if (S.camMode !== 'walk' || isTyping(ev)) return;
    const k = ev.key.toLowerCase();
    if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'q', 'e'].includes(k)) { walk.keys.add(k); ev.preventDefault(); ev.stopPropagation(); }
  }, true);
  window.addEventListener('keyup', (ev) => walk.keys.delete(ev.key.toLowerCase()));
  window.addEventListener('blur', () => walk.keys.clear());
}
export function isTyping(ev) { const t = ev.target; return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable); }
export function updateWalk(dt) {
  if (S.camMode !== 'walk' || !walk.keys.size) return;
  const sp = (walk.keys.has('shift') ? 14 : 7) * dt;
  const f = new THREE.Vector3(Math.sin(walk.yaw), 0, Math.cos(walk.yaw));
  const r = new THREE.Vector3(-Math.cos(walk.yaw), 0, Math.sin(walk.yaw));
  const k = walk.keys;
  if (k.has('w') || k.has('arrowup')) S.persp.position.addScaledVector(f, sp);
  if (k.has('s') || k.has('arrowdown')) S.persp.position.addScaledVector(f, -sp);
  if (k.has('a')) S.persp.position.addScaledVector(r, -sp);
  if (k.has('d')) S.persp.position.addScaledVector(r, sp);
  if (k.has('arrowleft') || k.has('q')) walk.yaw += dt * 1.6;
  if (k.has('arrowright') || k.has('e')) walk.yaw -= dt * 1.6;
  applyWalk();
}

// Camera presets for the 3D view
export const PRESETS = {
  overview: { pos: [9, 72, 76], target: [14, 0, 22] },
  patio: { pos: [14.5, 14, -6], target: [14.5, 0, 30] },
  back: { pos: [14, 18, 74], target: [14, 2, 14] },
  left: { pos: [62, 30, 26], target: [12, 0, 22] },
};
export function flyTo(preset, ms = 700) {
  const p = PRESETS[preset] || preset;
  if (S.camMode !== 'orbit') setView('orbit');
  const from = { pos: S.persp.position.clone(), target: S.controls.target.clone() };
  const to = { pos: new THREE.Vector3(...p.pos), target: new THREE.Vector3(...p.target) };
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce || ms === 0) { S.persp.position.copy(to.pos); S.controls.target.copy(to.target); S.controls.update(); return; }
  const t0 = performance.now();
  const stepFn = () => {
    const t = Math.min(1, (performance.now() - t0) / ms);
    const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    S.persp.position.lerpVectors(from.pos, to.pos, e);
    S.controls.target.lerpVectors(from.target, to.target, e);
    S.controls.update();
    if (t < 1) requestAnimationFrame(stepFn);
  };
  stepFn();
}
export function focusItem(it) {
  if (!it) return;
  let cx, cz, size;
  if (it.pts) { const xs = it.pts.map((p) => p[0]), zs = it.pts.map((p) => p[1]); cx = (Math.min(...xs) + Math.max(...xs)) / 2; cz = (Math.min(...zs) + Math.max(...zs)) / 2; size = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...zs) - Math.min(...zs)); }
  else { cx = it.x; cz = it.z; size = Math.max(it.w, it.d, it.h || 0); }
  if (S.camMode === 'plan') { S.orthoControls.target.set(cx, 0, cz); S.ortho.position.set(cx, 300, cz); S.ortho.zoom = Math.min(6, Math.max(0.6, 60 / (size + 10))); S.ortho.updateProjectionMatrix(); S.orthoControls.update(); return; }
  const dir = S.persp.position.clone().sub(S.controls.target).normalize();
  const dist = Math.max(14, size * 1.9);
  flyTo({ pos: [cx + dir.x * dist, Math.max(6, dir.y * dist), cz + dir.z * dist], target: [cx, 1, cz] }, 500);
}
