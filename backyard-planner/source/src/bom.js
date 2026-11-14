// Bill of materials and rough cost estimate. Prices are typical 2026 US figures:
// [do it yourself (materials / retail), hired out (installed)]. Every unit price can be edited in the app.
import { polyArea, polyLength, smoothPath, fmtFt } from './core.js';
import { TYPES, CATEGORIES } from './catalog.js';
import { SURFACES } from './models_items.js';
import { FENCE_STYLES } from './models_site.js';

const SURF = {
  pavers_tan: [6, 18], pavers_gray: [6, 18], pavers_basket: [6.5, 19], slab_gray: [8, 22], slab_charcoal: [8.5, 23], brick: [7, 21],
  flagstone_buff: [12, 30], flagstone_red: [13, 32], flagstone_blue: [14, 34], gravel_pea: [1.5, 5], gravel_white: [2, 6], gravel_gray: [1.5, 5],
  dg: [1.75, 5.5], river_rock: [2.5, 7], lava: [3, 7.5], mulch_brown: [0.75, 2], mulch_black: [0.8, 2.1], mulch_red: [0.8, 2.1], mulch_cedar: [0.9, 2.3],
  turf: [4, 12], sod: [0.9, 2.2], concrete: [4.5, 9], concrete_stain: [5.5, 12], deck_cedar: [15, 35], deck_gray: [22, 48], deck_walnut: [24, 52],
  sand: [1, 3], soil: [1, 3],
};
const EDGE = { steel: ['Steel edging', 3.5, 9], stone: ['Limestone block edging', 6, 15], brick: ['Brick edging', 4, 11], boulders: ['Small boulder edging', 8, 18] };
const FENCE = { weathered: [25, 40], cedar: [25, 40], stained: [28, 45], horizontal: [32, 55], horizontalBlack: [35, 60], vinyl: [25, 40], latticeTop: [30, 48], wireFrame: [14, 30], chainlink: [10, 24], weldedWire: [4, 12], blackMetal: [28, 50], pickets: [15, 30] };
const STEP = { stepping: ['Flagstone stepping stones', 15, 40], stepping_round: ['Round stepping stones', 12, 35], stepping_square: ['Square concrete pavers', 9, 30] };
const POOL_STYLE = { gray: [1, 'steel frame'], blue: [0.8, 'frame'], resin: [1.4, 'resin'], wood: [1.6, 'wood-look'] };

const r2 = (v) => Math.round(v * 100) / 100;
const L = (key, label, qty, unit, diy, pro) => ({ key, label, qty, unit, diy: r2(diy), pro: r2(pro ?? diy) });
const surf = (m, area) => (SURF[m] && area > 0.5 ? L('surf:' + m, (SURFACES[m] || { label: m }).label, Math.round(area), 'sq ft', ...SURF[m]) : null);
const edge = (k, len) => (EDGE[k] && len > 0.5 ? L('edge:' + k, EDGE[k][0], Math.round(len), 'lin ft', EDGE[k][1], EDGE[k][2]) : null);
function fence(style, len, h = 6) {
  const base = FENCE[style] || FENCE.cedar;
  const hh = Math.round(h);
  const k = Math.pow(hh / 6, 0.8);
  const label = `${(FENCE_STYLES[style] || { label: style }).label}, ${hh} ft`;
  return L(`fence:${style}:${hh}`, label, Math.round(len), 'lin ft', base[0] * k, base[1] * k);
}
const each = (key, label, qty, diy, pro) => (qty > 0 ? L(key, label, qty, 'each', diy, pro) : null);
const ellipseArea = (w, d) => (Math.PI * w * d) / 4;
const PLANT = { tree_shade: ['Shade tree, 30 gal', 250, 650], tree_orn: ['Ornamental tree, 15 gal', 150, 400], tree_fruit: ['Fruit tree, 15 gal', 120, 320], tree_evergreen: ['Evergreen, 15 gal', 90, 260], shrub: ['Shrub, 3 gal', 30, 80], grass_orn: ['Ornamental grass, 3 gal', 25, 65], agave: ['Agave or yucca, 5 gal', 40, 90], flowers: ['Flowering perennials (flat)', 30, 75], bird_bath: ['Bird bath', 150, 150], bird_feeder: ['Bird feeder and pole', 70, 70] };
const LOWV = new Set(['path_light', 'light_row', 'uplight']);

function poolKit(it, mult = 1) {
  const st = POOL_STYLE[it.p.style] || POOL_STYLE.gray;
  const area = it.type === 'pool_round' ? ellipseArea(it.w, it.w) : it.type === 'pool_oval' && it.p.shape !== 'rectangle' ? it.w * it.d * 0.9 : it.w * it.d;
  const diy = (400 + 6 * area) * st[0] * mult;
  const pro = diy + 1500 + 4 * area;
  const size = it.type === 'pool_round' ? `${fmtFt(it.w)} round` : `${fmtFt(it.w)} × ${fmtFt(it.d)}`;
  return L(`pool:${it.type}:${Math.round(it.w)}x${Math.round(it.d)}:${it.p.style}`, `Above-ground pool kit, ${size}, ${st[1]}`, 1, 'each', Math.round(diy / 10) * 10, Math.round(pro / 10) * 10);
}
function plantsForArea(it, area) {
  const plants = it.p.plants || 'none';
  if (plants === 'none') return [];
  const dens = { light: 3.2, medium: 2.3, full: 1.6 }[it.p.density || 'medium'];
  const n = Math.max(1, Math.round((area / (dens * dens)) * 0.7));
  const label = { mixed: 'Perennials and shrubs', flowers: 'Flowering perennials', shrubs: 'Shrubs, 3 gal', grasses: 'Ornamental grasses', xeriscape: 'Agave, grasses and accent rocks' }[plants] || 'Plants';
  return [L('plants:' + plants, label, n, 'each', plants === 'xeriscape' ? 35 : 28, plants === 'xeriscape' ? 80 : 70)];
}

export function linesFor(it) {
  const p = it.p || {};
  const t = TYPES[it.type];
  const out = [];
  const push = (...ls) => ls.forEach((l) => l && out.push(l));
  switch (it.type) {
    // surfaces & paths
    case 'surface_pad': case 'grill_pad': {
      const area = p.shape === 'circle' ? ellipseArea(it.w, it.d) : p.shape === 'rounded' ? it.w * it.d * 0.95 : it.w * it.d;
      const per = p.shape === 'circle' ? Math.PI * (it.w + it.d) / 2 : 2 * (it.w + it.d);
      push(surf(p.material, area), edge(p.edging, per));
      break;
    }
    case 'surface_area': case 'flower_bed': case 'planting_bed': case 'rock_garden': {
      const pts = p.smooth ? smoothPath(it.pts, true, 6) : it.pts;
      const area = polyArea(pts);
      push(surf(p.material || 'mulch_brown', area), edge(p.edging, polyLength(pts, true)), ...plantsForArea(it, area));
      if (p.boulders) push(each('boulder', 'Accent boulders', Math.max(1, Math.round(Math.sqrt(polyLength(pts, true)) / 2)), 120, 350));
      break;
    }
    case 'walkway': case 'walk_path': {
      const len = it.type === 'walkway' ? it.d : polyLength(p.smooth !== false ? smoothPath(it.pts, false, 6) : it.pts);
      const w = it.w || 3;
      if (STEP[p.material]) { const n = Math.max(1, Math.floor(len / Math.max(1.2, p.spacing || 2))); push(L('step:' + p.material, STEP[p.material][0], n, 'each', STEP[p.material][1], STEP[p.material][2])); }
      else push(surf(p.material, len * w), edge(p.edging, len * 2));
      break;
    }
    case 'creek': {
      const len = polyLength(smoothPath(it.pts, false, 8));
      push(surf(p.material || 'river_rock', len * (it.w || 3)), each('creek:boulders', 'Boulders along the banks', Math.max(2, Math.round(len / 4)), 100, 250));
      break;
    }
    case 'deck': {
      const m = { cedar: ['Cedar decking', 18, 45], gray: ['Gray composite decking', 26, 60], walnut: ['Walnut composite decking', 28, 65] }[p.material || 'cedar'];
      push(L('deck:' + (p.material || 'cedar'), m[0] + ' (framed)', Math.round(it.w * it.d), 'sq ft', m[1], m[2]));
      if (p.railing && p.railing !== 'none') push(L('deck:rail:' + p.railing, p.railing === 'black' ? 'Black metal railing' : 'Wood railing', Math.round(2 * it.w + 2 * it.d - Math.min(4, it.w * 0.4)), 'lin ft', 30, 75));
      if (it.h > 0.7) push(each('deck:steps', 'Deck steps', 1, 150, 400));
      break;
    }
    case 'outdoor_rug': push(L('rug', 'Outdoor rug', Math.round(it.w * it.d), 'sq ft', 3, 3)); break;
    case 'putting_green': push(L('putting', 'Putting green turf, base and fringe', Math.round(ellipseArea(it.w, it.d)), 'sq ft', 7, 20), each('putting:cups', 'Cups and flags', 1, 60, 60)); break;
    // fences & enclosures
    case 'fence_line': push(fence(p.style, polyLength(it.pts), it.h)); break;
    case 'dog_run': case 'privacy_area': {
      const gate = p.gate && p.gate !== 'none' ? Math.min(4, (p.gate === 'front' || p.gate === 'back' ? it.w : it.d) - 1) : 0;
      push(fence(p.style, 2 * (it.w + it.d) - gate, it.h), gate ? each('gate', 'Gate', 1, 150, 400) : null);
      if (p.ground && p.ground !== 'none') push(surf(p.ground, it.w * it.d));
      if (it.type === 'dog_run' && p.extras) push(each('pet:bowls', 'Bowls and toys', 1, 40, 40));
      break;
    }
    case 'privacy_screen': {
      const m = { horizontal: ['Horizontal cedar screen', 45, 90], metal: ['Laser-cut metal screen', 80, 140], lattice: ['Lattice screen', 20, 50], living: ['Living wall screen with plants', 90, 170] }[p.style || 'horizontal'];
      push(L('screen:' + p.style, m[0], Math.round(it.w), 'lin ft', m[1], m[2]));
      break;
    }
    case 'chicken_coop': push(each('coop', 'Chicken coop', 1, 800, 1600), fence('wireFrame', 2 * (it.w + it.d), 5)); if (p.hens) push(each('hens', 'Pullets', p.hens, 25, 25)); break;
    // structures
    case 'pergola': {
      const area = it.w * it.d;
      const louv = p.top === 'louvered';
      const m = louv ? ['Louvered aluminum pergola', 70, 120] : { cedar: ['Cedar pergola', 16, 45], black: ['Black steel pergola', 25, 50], white: ['White vinyl pergola', 20, 45] }[p.style || 'cedar'];
      push(L('pergola:' + (louv ? 'louvered' : p.style), m[0], Math.round(area), 'sq ft', m[1], m[2]));
      if (p.top === 'shade') push(L('pergola:shade', 'Shade cloth', Math.round(area), 'sq ft', 4, 7));
      if (p.top === 'lights') push(L('lights:string', 'String lights', Math.round(Math.max(2, Math.round(it.w / 3)) * it.d * 1.1), 'ft', 1.5, 4.5));
      if (p.top === 'vines') push(each('vines', 'Climbing vines, 5 gal', 4, 35, 80));
      break;
    }
    case 'gazebo': push(L('gazebo', 'Hardtop gazebo', Math.round(it.w * it.d), 'sq ft', 20, 35)); if (p.curtains) push(each('gazebo:curtains', 'Curtains and netting', 1, 150, 150)); if (p.lights) push(each('gazebo:light', 'Center light', 1, 80, 250)); break;
    case 'shade_sail': { const area = p.shape === 'triangle' ? it.w * it.d / 2 : it.w * it.d; push(L('sail', 'Shade sail fabric', Math.round(area), 'sq ft', 3.5, 6), each('sail:post', 'Steel posts with footings', p.shape === 'triangle' ? 3 : 4, 300, 700)); break; }
    case 'shed': { const m = { artisan: ['Resin storage shed', 28, 40], barn: ['Barn-style shed', 35, 65], gable: ['Cedar gable shed', 40, 75] }[p.style || 'gable']; push(L('shed:' + p.style, m[0], Math.round(it.w * it.d), 'sq ft', m[1], m[2])); break; }
    case 'umbrella': push(each('umbrella', 'Market umbrella and base', 1, 250, 250)); break;
    case 'cantilever_umbrella': push(each('umbrella:offset', 'Offset umbrella and base', 1, 600, 600)); break;
    // water
    case 'pool_round': push(poolKit(it), p.floats ? each('floats', 'Pool floats', 1, 60, 60) : null); break;
    case 'pool_oval': case 'pool_rect': push(poolKit(it, 1.25), p.floats ? each('floats', 'Pool floats', 1, 60, 60) : null); break;
    case 'stock_tank': { const k = (it.w / 8) ** 2; push(each('stocktank:' + Math.round(it.w), `Stock tank pool, ${fmtFt(it.w)}, with pump`, 1, 900 * k, 1800 * k)); if (p.deck) push(surf('gravel_pea', ellipseArea(it.w + 4.4, it.w + 4.4) - ellipseArea(it.w, it.w))); break; }
    case 'hot_tub': push(each('hottub', 'Hot tub, 5 to 6 person', 1, 7500, 10500)); break;
    case 'cold_plunge': push(each('plunge', 'Cold plunge with chiller', 1, 3500, 5000)); break;
    case 'sauna': push(each('sauna:' + Math.round(it.d), `Barrel sauna, ${fmtFt(it.d)} long`, 1, 6500 * (it.d / 8), 10000 * (it.d / 8))); break;
    case 'outdoor_shower': push(each('shower', 'Outdoor shower and enclosure', 1, 600, 1800)); break;
    case 'koi_pond': push(L('pond', 'Pond liner, rock and excavation', Math.round(ellipseArea(it.w, it.d)), 'sq ft', 15, 45), each('pond:pump', 'Pump, filter and waterfall kit', 1, 250, 250)); break;
    case 'fountain': push(each('fountain', 'Fountain', 1, 400, 1000)); break;
    case 'splash_pool': push(each('splash', 'Dog splash pool', 1, 40, 40)); break;
    // fire & grill
    case 'fire_pit': {
      const pit = { stone: ['Limestone fire pit kit', 450, 1600], block: ['Block fire pit kit', 300, 1100], steel: ['Steel fire bowl', 250, 300], gas: ['Gas fire table', 1300, 2800] }[p.pit || 'stone'];
      push(L('fire:' + p.pit, pit[0], 1, 'each', pit[1], pit[2]));
      if (p.pad && p.pad !== 'none') push(surf(p.pad, ellipseArea(it.w, it.w) - ellipseArea(p.pitDiam || 4, p.pitDiam || 4)));
      if (p.chairs) push(p.chairStyle === 'sling' ? each('chair:sling', 'Sling chairs', p.chairs, 110, 110) : each('chair:adirondack', 'Adirondack chairs', p.chairs, 200, 200));
      break;
    }
    case 'grill': { const g = { gas: ['Gas grill', 650, 750], kettle: ['Charcoal kettle', 220, 250], smoker: ['Offset smoker', 900, 1000], kamado: ['Kamado grill', 1300, 1400], griddle: ['Flat-top griddle', 500, 600] }[p.style || 'gas']; push(L('grill:' + p.style, g[0], 1, 'each', g[1], g[2])); break; }
    case 'outdoor_kitchen': { const len = it.w + (p.shape === 'L' ? (p.ret || 6) : 0); push(L('kitchen', 'Outdoor kitchen island', Math.round(len), 'lin ft', 450, 1200), each('kitchen:grill', 'Built-in grill', 1, 1800, 2200), each('stool', 'Bar stools', p.stools || 0, 130, 130)); break; }
    case 'pizza_oven': push(each('pizza', 'Pizza oven on stone base', 1, 1800, 4500)); break;
    case 'patio_heater': push(each('heater', 'Patio heater', 1, 280, 300)); break;
    case 'chiminea': push(each('chiminea', 'Chiminea', 1, 180, 180)); break;
    // furniture
    case 'dining_set': {
      const fin = p.color || 'teak';
      push(each('table:' + fin, `Dining table (${fin})`, 1, { teak: 1500, black: 600, white: 500 }[fin] || 700), each('chair:' + fin, 'Dining chairs', p.chairs || 6, fin === 'teak' ? 350 : 150), p.umbrella ? each('umbrella', 'Market umbrella and base', 1, 250, 250) : null);
      break;
    }
    case 'sectional': push(L('sectional:' + (p.frame || 'wicker'), 'Sectional sofa', Math.round(it.w + it.d), 'lin ft', 280, 280), p.table === 'fire' ? each('firetable', 'Fire table', 1, 900, 1000) : p.table !== false ? each('coffeetable', 'Coffee table', 1, 350, 350) : null); break;
    case 'conversation_set': push(each('convo', 'Sofa, two lounge chairs and table', 1, 2400, 2400), p.table === 'fire' ? each('firetable', 'Fire table upgrade', 1, 900, 1000) : null, p.rug && p.rug !== 'none' ? L('rug', 'Outdoor rug', Math.round((it.w - 0.5) * (it.d - 0.5)), 'sq ft', 3, 3) : null); break;
    case 'sofa': push(L('sofa', 'Outdoor sofa', Math.round(it.w), 'lin ft', 190, 190)); break;
    case 'club_chair': push(each('clubchair', 'Lounge chair', 1, 500, 500)); break;
    case 'coffee_table': push(each('coffeetable:' + p.material, 'Coffee table', 1, { teak: 400, walnut: 450, stone: 700, concrete: 500, glass: 300 }[p.material] || 400)); break;
    case 'side_table': push(each('sidetable', 'Side table', 1, 150)); break;
    case 'daybed': push(each('daybed', 'Canopy daybed', 1, 2200, 2400)); break;
    case 'egg_chair': push(each('eggchair', 'Hanging egg chair with stand', 1, 450, 450)); break;
    case 'porch_swing': push(each('swing', 'Swing bench with frame', 1, 1100, 1300)); break;
    case 'rocking_chair': push(each('rocker', 'Rocking chair', 1, 250)); break;
    case 'bar_set': push(each('bartable', 'Bar-height table', 1, 450), each('stool', 'Bar stools', p.stools || 4, 130)); break;
    case 'picnic_table': push(each('picnic', 'Picnic table', 1, 500, 550)); break;
    case 'deck_box': push(each('deckbox', 'Storage deck box', 1, 200)); break;
    case 'bean_bags': push(each('beanbag', 'Bean bag loungers', 2, 160)); break;
    case 'adirondack': push(each('chair:adirondack', 'Adirondack chair', 1, 200)); break;
    case 'chaise': push(each('chaise:' + (p.frame || 'wood'), 'Chaise lounge', 1, p.frame === 'metal' ? 300 : 450)); break;
    case 'bench': push(each('bench:' + (p.material || 'wood'), 'Garden bench', 1, { wood: 300, metal: 350, stone: 900 }[p.material || 'wood'], p.material === 'stone' ? 1100 : undefined)); break;
    case 'hammock': push(each('hammock', 'Hammock with stand', 1, 300)); break;
    case 'bistro_set': push(each('bistro', 'Bistro set', 1, 300)); break;
    // garden
    case 'raised_bed': {
      const m = { cedar: [8, 20], galvanized: [6, 16], stone: [18, 40], composite: [10, 24] }[p.material || 'cedar'];
      push(L('bed:' + (p.material || 'cedar'), `Raised bed (${p.material || 'cedar'})`, Math.round(it.w * it.d), 'sq ft', m[0], m[1]));
      push(L('soil:bulk', 'Raised bed soil', Math.max(0.25, Math.round((it.w * it.d * Math.max(0.3, it.h - 0.15)) / 27 * 4) / 4), 'cu yd', 50, 90));
      if (p.plants !== 'empty') push(each('starts', 'Plant starts', 1, 40, 40));
      break;
    }
    case 'garden_plot': {
      const per = 2 * (it.w + it.d);
      push(L('amend', 'Compost and soil amendment', Math.round(it.w * it.d), 'sq ft', 0.6, 2), L('seeds', 'Seeds and starts', Math.round(it.w * it.d), 'sq ft', 1, 1));
      if (p.border === 'wood' || p.border === 'stone') push(L('border:' + p.border, p.border === 'wood' ? 'Timber border' : 'Limestone border', Math.round(per), 'lin ft', p.border === 'wood' ? 4 : 8, p.border === 'wood' ? 10 : 18));
      if (p.fence === 'wire') push(fence('wireFrame', per + 3.2, 4)); else if (p.fence === 'picket') push(fence('pickets', per + 3.2, 3));
      break;
    }
    case 'planter': push(each('pot:' + Math.round(it.w), `Planter, ${fmtFt(it.w)}`, 1, 50 + 40 * it.w), each('pot:plant:' + p.plant, 'Plant for planter', 1, p.plant === 'tree' ? 90 : 30, p.plant === 'tree' ? 150 : 60)); break;
    case 'trellis_arch': push(each('arch', 'Garden arch', 1, 250, 450), p.vine && p.vine !== 'none' ? each('vines', 'Climbing vines, 5 gal', 2, 35, 80) : null); break;
    case 'greenhouse': push(L('greenhouse', 'Greenhouse kit', Math.round(it.w * it.d), 'sq ft', 22, 45)); break;
    case 'compost_bin': push(each('compost', 'Compost bin', 1, 150)); break;
    case 'rain_barrel': push(each('rainbarrel', 'Rain barrel and stand', 1, 130)); break;
    // pets & play
    case 'dog_house': push(each('doghouse', 'Dog house', 1, 250)); break;
    case 'dog_agility': push(each('agility', 'Dog agility set', 1, 300)); break;
    case 'trampoline': push(each('tramp:' + Math.round(it.w), `Trampoline, ${fmtFt(it.w)}`, 1, 500 * (it.w / 14) ** 2, 650 * (it.w / 14) ** 2)); break;
    case 'playset': push(each('playset', 'Swing set and fort', 1, 2200, 3800)); break;
    case 'sandbox': push(each('sandbox', 'Sandbox and play sand', 1, 180, 400)); break;
    case 'cornhole': push(each('cornhole', 'Cornhole boards', 1, 180)); break;
    case 'soccer_goal': push(each('goal', 'Soccer goal', 1, 150)); break;
    case 'playhouse': push(each('playhouse', 'Playhouse', 1, 1200, 2500)); break;
    case 'ladder_toss': push(each('laddertoss', 'Ladder toss set', 1, 70)); break;
    case 'basketball_hoop': push(each('hoop', 'In-ground basketball hoop', 1, 900, 1800)); break;
    case 'half_court': push(each('hoop', 'In-ground basketball hoop', 1, 900, 1800), surf('concrete', it.w * it.d), each('court:paint', 'Court line paint', 1, 60, 300)); break;
    case 'movie_screen': push(each('movie:' + Math.round(it.w), `Movie screen, ${fmtFt(it.w)} wide`, 1, 200 + 15 * it.w, 250 + 15 * it.w), p.projector !== false ? each('projector', 'Outdoor projector and speaker', 1, 700, 700) : null); break;
    // lighting
    case 'path_light': push(each('light:path', 'Low-voltage path light', 1, 45, 160)); break;
    case 'light_row': { const n = Math.max(1, Math.floor(polyLength(it.pts) / (p.spacing || 6)) + 1); push(each('light:path', 'Low-voltage path lights', n, 45, 160)); break; }
    case 'uplight': push(each('light:up', 'Low-voltage uplight', 1, 70, 200)); break;
    case 'lamp_post': push(each('light:post', 'Lamp post with wiring', 1, 400, 1200)); break;
    case 'tiki_torch': push(each('torch', 'Torch', 1, 35)); break;
    case 'string_lights': {
      const len = polyLength(it.pts) * 1.15;
      const poles = p.poles === 'none' ? 0 : it.pts.length - (p.poles === 'skipFirst' ? 1 : 0);
      push(L('lights:string', 'String lights', Math.round(len), 'ft', 1.5, 4.5), each('lights:pole', 'Light poles', poles, 70, 250));
      break;
    }
    // plants
    case 'hedge': {
      const len = polyLength(it.pts);
      const cyp = p.variety === 'cypress';
      const n = Math.max(2, Math.round(len / (cyp ? Math.max(2.5, (it.w || 3) * 0.9) : Math.max(1.5, (it.w || 3) * 0.6))));
      push(each('hedge:' + (cyp ? 'cypress' : 'shrub'), cyp ? 'Italian cypress, 15 gal' : 'Hedge shrubs, 3 gal', n, cyp ? 90 : 30, cyp ? 260 : 80));
      break;
    }
    case 'boulder': { const k = Math.max(0.4, (it.w * it.d * it.h) / 12); push(each('boulder:' + Math.round(k * 10), 'Boulder', 1, 120 * k, 350 * k)); break; }
    default:
      if (PLANT[it.type]) { const pl = PLANT[it.type]; push(L('plant:' + it.type, pl[0], 1, 'each', pl[1], pl[2])); }
  }
  return out;
}

// Items of the same kind and name are combined into one entry (two patio heaters → one row, qty 2).
export function buildBom(items) {
  const groups = new Map();
  let lowV = false;
  for (const it of items) {
    if (it.existing || it.hidden) continue;
    const t = TYPES[it.type];
    if (!t) continue;
    if (LOWV.has(it.type)) lowV = true;
    const lines = linesFor(it);
    if (!lines.length) continue;
    const cat = t.cat;
    if (!groups.has(cat)) groups.set(cat, new Map());
    const name = it.name || t.name.replace(/^Draw (an? )?/, '').replace(/^./, (c) => c.toUpperCase());
    const g = groups.get(cat);
    const k = it.type + '|' + name;
    if (!g.has(k)) g.set(k, { item: it, name, count: 0, lines: [] });
    const e = g.get(k);
    e.count++;
    for (const l of lines) {
      const same = e.lines.find((x) => x.key === l.key && x.unit === l.unit && x.label === l.label);
      if (same) same.qty = r2(same.qty + l.qty);
      else e.lines.push({ ...l });
    }
  }
  for (const [cat, g] of groups) groups.set(cat, [...g.values()]);
  if (lowV) {
    if (!groups.has('lighting')) groups.set('lighting', []);
    groups.get('lighting').push({ item: null, name: 'Lighting system', count: 1, lines: [L('light:transformer', 'Low-voltage transformer and cable', 1, 'each', 180, 500)] });
  }
  return CATEGORIES.filter((c) => groups.has(c.id)).map((c) => ({ cat: c.id, name: c.name, entries: groups.get(c.id) }));
}
export function unitPrice(line, mode, overrides = {}) {
  const k = mode + ':' + line.key;
  return overrides[k] ?? (mode === 'diy' ? line.diy : line.pro);
}
export function totals(bom, mode, overrides) {
  let total = 0;
  const byCat = {};
  for (const g of bom) {
    let s = 0;
    for (const e of g.entries) for (const l of e.lines) s += l.qty * unitPrice(l, mode, overrides);
    byCat[g.cat] = s; total += s;
  }
  return { total, byCat };
}
export const money = (v) => '$' + Math.round(v).toLocaleString('en-US');
