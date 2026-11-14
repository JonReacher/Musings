import * as THREE from 'three';
import { app } from './core.js';
import { loadFencePhoto } from './textures.js';
import { initScene, buildContext, applySun, render, S, resize, adaptQuality } from './scene.js';
import { initPointer, labels, setItems, resetHistory, tick, on } from './editor.js';
import { initWalk, updateWalk, setView, refreshRoofs, flyTo } from './views.js';
import { loadStore, initLayouts, currentLayout, saveSoon, store, switchLayout } from './store.js';
import { select, E } from './editor.js';
import { applySettings } from './ui.js';
import { initUI, setPhotos, wirePhotoBar, updateCompass, layoutPhotoOverlay } from './ui.js';
import { thumb } from './thumbs.js';
import { TYPES } from './catalog.js';
import { updateScreens } from './models_more.js';
import { arrange, countOverlaps } from './arrange.js';
import { buildBom, totals } from './bom.js';
import { setMoveLock, makeItem, commit } from './editor.js';

function readAssets() {
  try { return JSON.parse(document.getElementById('assets').textContent); } catch (e) { return { photos: [], fence: null }; }
}

async function boot() {
  const assets = readAssets();
  if (assets.fence) await new Promise((res) => loadFencePhoto(assets.fence, res));

  const stage = document.getElementById('stage');
  // register our pointer handler first (capture) so item drags win over camera orbit
  initScene(stage);
  const dom = S.renderer.domElement;
  initPointer(dom);
  initWalk(dom);
  dom.addEventListener('contextmenu', (e) => e.preventDefault());
  labels.init(document.getElementById('labels'));

  const saved = loadStore();
  app.settings = { month: new Date().getMonth() + 1, hour: 14, lat: 30, facing: 180, lightsMode: 'auto', lawn: 'asis', neighbors: true, shadows: true, grid: false, ...(saved && saved.settings) };
  initLayouts(saved);
  setItems(JSON.parse(JSON.stringify(currentLayout().items)), { keepSelection: false });
  resetHistory();
  buildContext(app.settings.neighbors);
  S.sun.castShadow = app.settings.shadows !== false;
  applySun(app.settings);

  initUI();
  setPhotos(assets.photos || []);
  wirePhotoBar();
  S.onResize = layoutPhotoOverlay;

  setView('orbit', { pos: [-60, 120, 140], target: [13, 0, 20] });
  refreshRoofs();
  resize();

  let last = performance.now();
  const loop = (now) => {
    const rawMs = now - last;
    const dt = Math.min(0.1, rawMs / 1000);
    if (!document.hidden) adaptQuality(rawMs);
    last = now;
    const t = now / 1000;
    if (S.camMode === 'orbit') S.controls.update();
    if (S.camMode === 'plan') S.orthoControls.update();
    updateWalk(dt);
    tick(t);
    updateCompass();
    updateScreens();
    render(t);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);

  requestAnimationFrame(() => {
    document.getElementById('loading').classList.add('done');
    setTimeout(() => flyTo('overview', 1600), 150);
  });
  window.__yard = { app, S, store, switchLayout, setView, applySettings, select, E, flyTo, arrange, countOverlaps, buildBom, totals, setMoveLock, makeItem, setItems, commit, TYPES, thumbAll: () => Promise.all(Object.keys(TYPES).map((t) => new Promise((res) => thumb(t, (u) => res([t, u]))))) };
}

boot().catch((e) => {
  console.error(e);
  const l = document.getElementById('loading');
  l.innerHTML = 'Something went wrong while building the 3D scene.<small>' + (e && e.message ? e.message : e) + '. Try a recent version of Chrome, Edge, Safari or Firefox.</small>';
});
