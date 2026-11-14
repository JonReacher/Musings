import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { app } from './core.js';
import { tex, setAniso } from './textures.js';
import { setLightState, lightState } from './fx.js';
import { buildNeighborHouse, buildGazeboTop, buildTree } from './models_site.js';
import { waterMat } from './models_items.js';

export const S = {}; // scene singletons

const GLSL_NOISE = `
float yhash(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
float yvnoise(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.-2.*f);
  return mix(mix(yhash(i),yhash(i+vec2(1,0)),u.x), mix(yhash(i+vec2(0,1)),yhash(i+vec2(1,1)),u.x), u.y); }
float yfbm(vec2 p){ float s=0., a=.5; for(int i=0;i<5;i++){ s+=a*yvnoise(p); p=p*2.03+vec2(1.7,9.2); a*=.5;} return s; }
`;

export function initScene(container) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
  S.maxPR = Math.min(window.devicePixelRatio, 1.75);
  S.pr = S.maxPR;
  renderer.setPixelRatio(S.pr);
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  container.appendChild(renderer.domElement);
  setAniso(Math.min(8, renderer.capabilities.getMaxAnisotropy()));
  S.renderer = renderer;

  const scene = new THREE.Scene();
  S.scene = scene;
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.5;

  const aspect = container.clientWidth / container.clientHeight;
  S.persp = new THREE.PerspectiveCamera(50, aspect, 0.3, 3000);
  S.persp.position.set(-30, 42, 78);
  S.ortho = new THREE.OrthographicCamera(-50 * aspect, 50 * aspect, 50, -50, -500, 2000);
  S.ortho.position.set(12, 300, 18);
  S.ortho.up.set(0, 0, 1);
  S.ortho.lookAt(12, 0, 18);
  S.camera = S.persp;

  // lights
  S.hemi = new THREE.HemisphereLight('#cfe3ff', '#5b5a3c', 0.9);
  scene.add(S.hemi);
  const sun = new THREE.DirectionalLight('#fff3e0', 2.6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  const sc = sun.shadow.camera;
  sc.left = -62; sc.right = 62; sc.top = 62; sc.bottom = -62; sc.near = 1; sc.far = 400;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.04;
  sun.shadow.radius = 2.5;
  sun.target.position.set(12, 0, 18);
  scene.add(sun, sun.target);
  S.sun = sun;

  // light pool for fixtures
  S.pointPool = [];
  for (let i = 0; i < 9; i++) {
    const l = new THREE.PointLight('#ffc875', 0, 12, 2);
    l.castShadow = false;
    scene.add(l); S.pointPool.push(l);
  }
  S.spotPool = [];
  for (let i = 0; i < 3; i++) {
    const l = new THREE.SpotLight('#ffc875', 0, 20, 0.45, 0.6, 1.6);
    scene.add(l, l.target); S.spotPool.push(l);
  }

  buildSky(scene);
  buildGround(scene);
  buildGrid(scene);
  S.context = new THREE.Group();
  scene.add(S.context);
  S.itemsRoot = new THREE.Group();
  scene.add(S.itemsRoot);
  S.overlay = new THREE.Group();
  scene.add(S.overlay);

  // controls
  const controls = new OrbitControls(S.persp, renderer.domElement);
  controls.target.set(14, 0, 20);
  controls.enableDamping = true;
  controls.dampingFactor = 0.12;
  controls.maxPolarAngle = Math.PI * 0.495;
  controls.minDistance = 3;
  controls.maxDistance = 400;
  controls.zoomToCursor = true;
  controls.screenSpacePanning = false;
  controls.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
  S.controls = controls;
  const oc = new OrbitControls(S.ortho, renderer.domElement);
  oc.enableRotate = false;
  oc.screenSpacePanning = true;
  oc.zoomToCursor = true;
  oc.target.set(12, 0, 18);
  oc.mouseButtons = { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
  oc.minZoom = 0.3; oc.maxZoom = 12;
  oc.enabled = false;
  S.orthoControls = oc;

  // post
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, S.persp));
  const bloom = new UnrealBloomPass(new THREE.Vector2(container.clientWidth / 2, container.clientHeight / 2), 0.7, 0.45, 0.82);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  S.composer = composer; S.bloom = bloom; S.renderPass = composer.passes[0];

  S.container = container;
  window.addEventListener('resize', resize);
  new ResizeObserver(resize).observe(container);
  return S;
}

// adaptive resolution: keep the frame rate smooth on modest GPUs
let ftAcc = 0, ftN = 0;
export function adaptQuality(dtMs) {
  ftAcc += dtMs; ftN++;
  if (ftN < 45) return;
  const avg = ftAcc / ftN; ftAcc = 0; ftN = 0;
  let pr = S.pr;
  if (avg > 30 && pr > 0.75) pr = Math.max(0.75, pr - 0.25);
  else if (avg < 14 && pr < S.maxPR) pr = Math.min(S.maxPR, pr + 0.25);
  if (pr !== S.pr) { S.pr = pr; S.renderer.setPixelRatio(pr); S.composer.setPixelRatio(pr); resize(); }
}
export function resize() {
  const c = S.container;
  const w = c.clientWidth, h = c.clientHeight;
  if (!w || !h) return;
  S.renderer.setSize(w, h);
  S.composer.setSize(w, h);
  S.persp.aspect = w / h;
  S.persp.updateProjectionMatrix();
  const half = S.orthoHalf || 40;
  S.ortho.left = -half * w / h; S.ortho.right = half * w / h; S.ortho.top = half; S.ortho.bottom = -half;
  S.ortho.updateProjectionMatrix();
  if (S.onResize) S.onResize();
}

// ---------------- sky ----------------
function buildSky(scene) {
  const geo = new THREE.SphereGeometry(1500, 32, 16);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { topColor: { value: new THREE.Color() }, horizonColor: { value: new THREE.Color() }, sunDir: { value: new THREE.Vector3(0, 1, 0) }, sunColor: { value: new THREE.Color() }, cloudColor: { value: new THREE.Color() }, night: { value: 0 }, time: { value: 0 }, cloudiness: { value: 0.5 } },
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position = p.xyww; }`,
    fragmentShader: GLSL_NOISE + `
      uniform vec3 topColor, horizonColor, sunDir, sunColor, cloudColor; uniform float night, time, cloudiness;
      varying vec3 vDir;
      float h3(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,37.719)))*43758.5453); }
      void main(){
        vec3 d = normalize(vDir);
        float h = max(d.y, 0.0);
        vec3 col = mix(horizonColor, topColor, pow(h, 0.5));
        if (d.y < 0.0) col = horizonColor * 0.92;
        float sd = max(dot(d, sunDir), 0.0);
        col += sunColor * (pow(sd, 900.0) * 6.0 + pow(sd, 10.0) * 0.28);
        if (d.y > 0.0) {
          vec2 uv = d.xz / (d.y + 0.12) * 0.9 + vec2(time * 0.004, time * 0.001);
          float c = yfbm(uv * 1.3);
          c = smoothstep(0.62 - cloudiness * 0.25, 0.86, c) * smoothstep(0.0, 0.2, d.y);
          vec3 cc = cloudColor * (0.82 + 0.25 * yfbm(uv * 3.0)) + sunColor * pow(sd, 6.0) * 0.4;
          col = mix(col, cc, c * 0.9);
          vec3 sp = floor(d * 380.0);
          float s = h3(sp);
          col += vec3(step(0.9988, s)) * night * (0.6 + 0.4 * sin(time * 2.0 + s * 50.0)) * (1.0 - c);
        }
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const sky = new THREE.Mesh(geo, mat);
  sky.frustumCulled = false;
  sky.renderOrder = -10;
  scene.add(sky);
  S.sky = sky;
  scene.fog = new THREE.Fog('#cfe2f2', 220, 1100);
}

// ---------------- lawn ----------------
function buildGround(scene) {
  const geo = new THREE.PlaneGeometry(1200, 1200, 1, 1);
  geo.rotateX(-Math.PI / 2);
  const detail = tex('grassDetail');
  const mat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.97, metalness: 0 });
  const uniforms = { detailMap: { value: detail }, lawnHealth: { value: 0 } };
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vYW;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvYW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vYW; uniform sampler2D detailMap; uniform float lawnHealth;\n' + GLSL_NOISE)
      .replace('#include <map_fragment>', `
        vec2 wp = vYW.xz;
        float big = yfbm(wp * 0.045 + 3.1);
        float mid = yfbm(wp * 0.16 + 7.7);
        float ptch = smoothstep(0.38, 0.62, big * 0.75 + mid * 0.35);
        vec3 green = mix(vec3(0.062, 0.095, 0.022), vec3(0.095, 0.14, 0.035), mid);
        vec3 dry = mix(vec3(0.20, 0.155, 0.075), vec3(0.27, 0.21, 0.11), yvnoise(wp * 0.7));
        vec3 lush = mix(vec3(0.038, 0.105, 0.012), vec3(0.06, 0.15, 0.022), mid);
        vec3 lawn = mix(mix(green, dry, ptch * 0.8), lush, lawnHealth);
        vec3 det = texture2D(detailMap, wp / 2.5).rgb * 2.0;
        float far = clamp(length(vYW.xz - vec2(12.0, 18.0)) / 220.0, 0.0, 1.0);
        diffuseColor.rgb *= mix(lawn * det, lawn, far * 0.6);
      `);
  };
  mat.customProgramCacheKey = () => 'lawn-v1';
  const ground = new THREE.Mesh(geo, mat);
  ground.receiveShadow = true;
  ground.name = 'ground';
  scene.add(ground);
  S.ground = ground;
  S.lawnUniforms = uniforms;
}

function buildGrid(scene) {
  const pos = [], posMaj = [];
  const x0 = -24, x1 = 52, z0 = -24, z1 = 62;
  for (let x = x0; x <= x1; x++) (x % 5 === 0 ? posMaj : pos).push(x, 0, z0, x, 0, z1);
  for (let z = z0; z <= z1; z++) (z % 5 === 0 ? posMaj : pos).push(x0, 0, z, x1, 0, z);
  const mk = (arr, color, op) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
    const l = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color, transparent: true, opacity: op, depthWrite: false }));
    l.position.y = 0.09; l.renderOrder = 3; l.raycast = () => {};
    return l;
  };
  const grid = new THREE.Group();
  grid.add(mk(pos, '#ffffff', 0.12), mk(posMaj, '#ffffff', 0.32));
  grid.visible = false;
  scene.add(grid);
  S.grid = grid;
}

// ---------------- neighborhood context ----------------
export function buildContext(show = true) {
  const g = S.context;
  while (g.children.length) g.remove(g.children[0]);
  if (!show) return;
  const add = (o, x, z, ry = 0) => { o.position.set(x, 0, z); o.rotation.y = ry; o.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; m.raycast = () => {}; } }); g.add(o); };
  add(buildNeighborHouse(34, 40, 2, '#ddd7c6', '#6f6963'), 36, 93);
  add(buildNeighborHouse(44, 34, 1, '#e6e1d3', '#736c64'), 2, 90);
  add(buildGazeboTop(12, 12, 8.5), 2, 63);
  add(buildNeighborHouse(40, 34, 1, '#e3dccb', '#736c64'), -46, 86);
  add(buildNeighborHouse(36, 46, 1, '#d8d0bc', '#6f6963', true), -46, -2);
  add(buildNeighborHouse(36, 46, 1, '#e0dbcd', '#736c64'), 72, -6);
  add(buildNeighborHouse(10, 8, 0.85, '#d9d4c8', '#3c3d3f'), 47, 42);
  add(buildNeighborHouse(29, 38, 2, '#e0dccf'), 14.5, -78);
  // big trees beyond the fence (live oaks seen in the photos)
  const trees = [[47, 58, 30, 27, 11], [-28, 53, 30, 27, 12], [53, 16, 24, 24, 13], [-30, -12, 24, 24, 14], [-24, 24, 18, 22, 15]];
  for (const [x, z, w, h, s] of trees) add(buildTree({ w, h, kind: 'oak' }, s), x, z, s);
}

// ---------------- sun position ----------------
export function sunPosition(month, hour, lat) {
  const doy = Math.round((month - 1) * 30.44 + 15);
  const decl = 23.44 * Math.sin((2 * Math.PI * (284 + doy)) / 365) * Math.PI / 180;
  const phi = lat * Math.PI / 180;
  const H = (hour - 12) * 15 * Math.PI / 180;
  const sinEl = Math.sin(phi) * Math.sin(decl) + Math.cos(phi) * Math.cos(decl) * Math.cos(H);
  const el = Math.asin(sinEl);
  const az = Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(phi) - Math.tan(decl) * Math.cos(phi)) + Math.PI; // from north, clockwise
  return { el, az };
}
// world direction for a compass bearing (radians), given which way the yard faces (degrees)
export function bearingToWorld(bearingRad, facingDeg, el = 0) {
  const d = bearingRad - facingDeg * Math.PI / 180;
  return new THREE.Vector3(-Math.sin(d) * Math.cos(el), Math.sin(el), Math.cos(d) * Math.cos(el));
}

const C = (h) => new THREE.Color(h);
const PAL = [
  // elev(deg), top, horizon, sun color, sun intensity, hemi sky, hemi ground, hemi int, cloud
  [-18, C('#03060f'), C('#0b1222'), C('#000000'), 0, C('#1d2b4a'), C('#0d0f10'), 0.32, C('#151b29')],
  [-7, C('#0b1430'), C('#2a3456'), C('#000000'), 0, C('#3a4a78'), C('#141412'), 0.38, C('#2a3045')],
  [-2, C('#2a3b6e'), C('#d9876a'), C('#ff8a50'), 0.0, C('#7f8fc0'), C('#3a3226'), 0.55, C('#8c6d77')],
  [4, C('#4f78b8'), C('#f3b07a'), C('#ffb46b'), 1.3, C('#b6c6e6'), C('#5a4e36'), 0.75, C('#f0c2a0')],
  [14, C('#4a84cc'), C('#d8e6f0'), C('#ffe2b8'), 2.3, C('#cfe0ff'), C('#5b5a3c'), 0.9, C('#f4f1ee')],
  [40, C('#3c7bd0'), C('#cfe2f2'), C('#fff6ea'), 2.8, C('#d4e4ff'), C('#5b5a3c'), 1.0, C('#ffffff')],
];
function palette(elDeg) {
  if (elDeg <= PAL[0][0]) return PAL[0];
  for (let i = 0; i < PAL.length - 1; i++) {
    const a = PAL[i], b = PAL[i + 1];
    if (elDeg <= b[0]) {
      const t = (elDeg - a[0]) / (b[0] - a[0]);
      return a.map((v, k) => (k === 0 ? elDeg : v.isColor ? v.clone().lerp(b[k], t) : v + (b[k] - v) * t));
    }
  }
  return PAL[PAL.length - 1];
}

export function applySun(settings) {
  const { month, hour, lat, facing } = settings;
  const { el, az } = sunPosition(month, hour, lat);
  const elDeg = el * 180 / Math.PI;
  const P = palette(elDeg);
  const sky = S.sky.material.uniforms;
  sky.topColor.value.copy(P[1]); sky.horizonColor.value.copy(P[2]);
  sky.sunColor.value.copy(P[3]);
  sky.cloudColor.value.copy(P[8]);
  const sdir = bearingToWorld(az, facing, el);
  sky.sunDir.value.copy(sdir);
  const night = 1 - THREE.MathUtils.smoothstep(elDeg, -8, 1);
  sky.night.value = night;
  S.scene.fog.color.copy(P[2]).lerp(P[1], 0.15);
  S.hemi.color.copy(P[5]); S.hemi.groundColor.copy(P[6]); S.hemi.intensity = P[7];
  const target = S.sun.target.position;
  if (elDeg > -1.5) {
    S.sun.color.copy(P[3]);
    S.sun.intensity = P[4] * THREE.MathUtils.smoothstep(elDeg, -1.5, 3);
    S.sun.position.copy(target).addScaledVector(sdir, 180);
    if (S.sun.position.y < 2) S.sun.position.y = 2;
  } else {
    // moonlight
    const mdir = bearingToWorld(az + Math.PI, facing, 0.75);
    S.sun.color.set('#9fb4ff');
    S.sun.intensity = 0.35 * THREE.MathUtils.smoothstep(-elDeg, 1.5, 8);
    S.sun.position.copy(target).addScaledVector(mdir, 180);
  }
  S.scene.environmentIntensity = 0.12 + 0.5 * (1 - night);
  let lights = 1 - THREE.MathUtils.smoothstep(elDeg, -3, 5);
  if (settings.lightsMode === 'on') lights = 1;
  if (settings.lightsMode === 'off') lights = 0;
  setLightState(lights, night);
  S.darkness = 1 - THREE.MathUtils.smoothstep(elDeg, -6, 8);
  S.lightsFactor = lights;
  S.lawnUniforms.lawnHealth.value = settings.lawn === 'lush' ? 1 : settings.lawn === 'healthy' ? 0.55 : 0;
  S.renderer.toneMappingExposure = 1.0 + night * 0.35;
  return { elDeg, azDeg: az * 180 / Math.PI };
}

// ---------------- fixture light assignment ----------------
const _v = new THREE.Vector3(), _d = new THREE.Vector3();
export function updateFixtureLights(t) {
  const lf = S.lightsFactor || 0;
  const dark = S.darkness || 0;
  const cam = S.camera.position;
  const list = [];
  for (const [id, obj] of app.objects) {
    if (!obj.visible || !obj.userData.emitters) continue;
    for (const e of obj.userData.emitters) {
      const f = e.always ? 0.12 + 0.88 * dark : lf;
      if (f < 0.01) continue;
      _v.set(e.p[0], e.p[1], e.p[2]);
      obj.localToWorld(_v);
      list.push({ e, f, pos: _v.clone(), obj, d: _v.distanceTo(cam) });
    }
  }
  list.sort((a, b) => b.e.priority - a.e.priority || a.d - b.d);
  let pi = 0, si = 0;
  for (const it of list) {
    const e = it.e;
    let I = e.intensity * it.f;
    if (e.flicker) I *= 0.82 + 0.18 * Math.sin(t * 13 + it.pos.x) * Math.sin(t * 7.3 + it.pos.z);
    if (e.kind === 'spot') {
      if (si >= S.spotPool.length) continue;
      const l = S.spotPool[si++];
      l.position.copy(it.pos); l.color.set(e.color); l.intensity = I; l.distance = e.distance; l.angle = e.angle || 0.45;
      _d.set(e.dir[0], e.dir[1], e.dir[2]).applyQuaternion(it.obj.quaternion);
      l.target.position.copy(it.pos).addScaledVector(_d, 10);
      l.target.updateMatrixWorld();
    } else {
      if (pi >= S.pointPool.length) continue;
      const l = S.pointPool[pi++];
      l.position.copy(it.pos); l.color.set(e.color); l.intensity = I; l.distance = e.distance;
    }
  }
  for (; pi < S.pointPool.length; pi++) S.pointPool[pi].intensity = 0;
  for (; si < S.spotPool.length; si++) S.spotPool[si].intensity = 0;
}

export function render(t) {
  const sky = S.sky;
  sky.position.copy(S.camera.position);
  sky.material.uniforms.time.value = t;
  const wt = waterMat().map;
  if (wt) { wt.offset.x = Math.sin(t * 0.15) * 0.08; wt.offset.y = t * 0.012; }
  updateFixtureLights(t);
  if ((S.lightsFactor || 0) > 0.02 || (S.darkness || 0) > 0.4) {
    S.renderPass.camera = S.camera;
    S.bloom.strength = 0.25 + 0.55 * Math.max(S.lightsFactor || 0, S.darkness || 0);
    S.composer.render();
  } else {
    S.renderer.render(S.scene, S.camera);
  }
}
