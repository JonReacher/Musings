import * as THREE from 'three';
import { TYPES, buildFor } from './catalog.js';
import { makeItem } from './editor.js';
import { optimize, disposeObject, hashStr } from './core.js';

let R, scene, cam;
const cache = new Map();
const queue = [];
let busy = false;
const SAMPLE = {
  fence_line: [[-7, 0], [7, 0]],
  walk_path: [[-7, 2], [-2, -1], [3, 1], [8, -1.5]],
  creek: [[-8, 2], [-2, -1], [4, 1.5], [9, -1]],
  hedge: [[-7, 0], [7, 0]],
  string_lights: [[-8, 0], [0, 2], [8, 0]],
  light_row: [[-8, 0], [8, 0]],
  area: [[-6, -4], [5, -5], [7, 2], [1, 5], [-5, 3]],
};

function init() {
  R = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  R.setPixelRatio(1);
  R.setSize(240, 180);
  R.toneMapping = THREE.ACESFilmicToneMapping;
  R.toneMappingExposure = 1.05;
  R.shadowMap.enabled = false;
  scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight('#e6efff', '#6b6a4c', 1.6));
  const d = new THREE.DirectionalLight('#fff4e4', 2.4);
  d.position.set(8, 14, 10);
  scene.add(d);
  const disc = new THREE.Mesh(new THREE.CircleGeometry(1, 48), new THREE.MeshStandardMaterial({ color: '#b8c4a4', roughness: 1 }));
  disc.rotation.x = -Math.PI / 2;
  disc.name = 'disc';
  scene.add(disc);
  cam = new THREE.PerspectiveCamera(30, 4 / 3, 0.1, 2000);
}

export function thumb(type, cb) {
  if (cache.has(type)) { cb(cache.get(type)); return; }
  queue.push([type, cb]);
  pump();
}
function pump() {
  if (busy || !queue.length) return;
  busy = true;
  requestAnimationFrame(() => {
    const [type, cb] = queue.shift();
    try {
      if (!cache.has(type)) cache.set(type, render(type));
      cb(cache.get(type));
    } catch (e) { console.warn('thumb failed', type, e); cb(''); }
    busy = false;
    pump();
  });
}
function render(type) {
  if (!R) init();
  const t = TYPES[type];
  const o = {};
  if (t.kind === 'poly') o.pts = SAMPLE[t.builder] || SAMPLE.hedge;
  if (t.kind === 'area') o.pts = SAMPLE.area;
  if (t.kind === 'box') { o.x = 0; o.z = 0; }
  const it = makeItem(type, o);
  if (type === 'house') return '';
  const obj = buildFor(it, hashStr(type));
  optimize(obj);
  if (t.kind === 'box') obj.rotation.y = 0;
  scene.add(obj);
  const box = new THREE.Box3().setFromObject(obj);
  const size = box.getSize(new THREE.Vector3());
  const c = box.getCenter(new THREE.Vector3());
  const disc = scene.getObjectByName('disc');
  const rad = Math.max(size.x, size.z) * 0.62 + 0.4;
  disc.scale.setScalar(rad); disc.position.set(c.x, -0.02, c.z);
  const span = Math.max(size.x * 0.75, size.y * 1.15, size.z * 0.75, 1.2);
  const dist = span / Math.tan((cam.fov * Math.PI) / 360) * 0.95;
  const dir = new THREE.Vector3(0.62, 0.62, 1).normalize();
  if (t.kind !== 'box') dir.set(0.25, 0.9, 0.7).normalize();
  cam.position.copy(c).addScaledVector(dir, dist);
  cam.lookAt(c.x, c.y * 0.85, c.z);
  R.render(scene, cam);
  const url = R.domElement.toDataURL('image/png');
  scene.remove(obj);
  disposeObject(obj);
  return url;
}
