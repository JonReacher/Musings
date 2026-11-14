import { rng as mkrng } from './core.js';
import { BUILDERS, SURFACES, surfaceOptions } from './models_items.js';
import { POLY_BUILDERS } from './models_poly.js';
import { FENCE_STYLES, buildHouse, buildSlab, buildCoveredPatio, buildAC } from './models_site.js';

export const CATEGORIES = [
  { id: 'garden', name: 'Garden' },
  { id: 'pets', name: 'Pets' },
  { id: 'water', name: 'Pools & water' },
  { id: 'structures', name: 'Fences & structures' },
  { id: 'fire', name: 'Fire & grilling' },
  { id: 'seating', name: 'Seating' },
  { id: 'plants', name: 'Plants & trees' },
  { id: 'paths', name: 'Paths & surfaces' },
  { id: 'lighting', name: 'Lighting' },
  { id: 'play', name: 'Play' },
];

const fenceOpts = (keys) => (keys || Object.keys(FENCE_STYLES)).map((k) => [k, FENCE_STYLES[k].label]);
const sel = (key, label, options, def) => ({ key, label, type: 'select', options, def });
const tog = (key, label, def = true) => ({ key, label, type: 'toggle', def });
const rng = (key, label, min, max, step, def, unit = '') => ({ key, label, type: 'range', min, max, step, def, unit });
const col = (key, label, options, def) => ({ key, label, type: 'swatch', options, def });

const WALK_MATS = [['stepping', 'Stepping stones (flagstone)'], ['stepping_round', 'Round stepping stones'], ['stepping_square', 'Square concrete pavers'], ...surfaceOptions(['flagstone_buff', 'flagstone_red', 'flagstone_blue', 'pavers_tan', 'pavers_gray', 'brick', 'slab_gray', 'gravel_pea', 'dg', 'gravel_white', 'concrete', 'deck_cedar', 'mulch_brown'])];
const EDGING = [['none', 'None'], ['steel', 'Steel edging'], ['stone', 'Limestone blocks'], ['brick', 'Brick'], ['boulders', 'Small boulders']];
const LIGHTC = [['warm', 'Warm white'], ['soft', 'Soft white'], ['cool', 'Cool white'], ['amber', 'Amber']];
const CUSHIONS = [['#d9d3c4', 'Sand'], ['#2f4f6f', 'Navy'], ['#7b8a6a', 'Sage'], ['#b5543c', 'Terracotta'], ['#e9e6df', 'White'], ['#3a3a3a', 'Charcoal'], ['#c9a24a', 'Mustard']];
const CHAIRC = [['#3f6f8a', 'Blue'], ['#f1efe9', 'White'], ['#2d5a3d', 'Green'], ['#c84b3a', 'Red'], ['#8a5a36', 'Natural'], ['#2b2b2b', 'Black'], ['#e3b23c', 'Yellow']];

// kind: box (moved/rotated/resized as a footprint), poly (drawn line), area (drawn closed shape)
// resize: 'wd' width+depth, 'diam' uniform circle, 'w' width only, 'none'
export const TYPES = {
  // ---------- existing site ----------
  house: { name: 'House', cat: 'existing', kind: 'box', build: buildHouse, size: { w: 29, d: 38, h: 20 }, resize: 'none', noRotate: true, existingOnly: true },
  slab: { name: 'Concrete patio', cat: 'existing', kind: 'box', build: buildSlab, size: { w: 29, d: 10, h: 0.35 }, resize: 'wd', surfaceH: (it) => it.h, ground: true, existingOnly: true, desc: 'Your 29 × 10 ft concrete pad' },
  covered_patio: { name: 'Covered patio roof', cat: 'existing', kind: 'box', build: buildCoveredPatio, size: { w: 12.5, d: 11, h: 9.6 }, resize: 'wd', min: { w: 6, d: 6 }, existingOnly: true },
  ac_unit: { name: 'AC unit', cat: 'existing', kind: 'box', build: buildAC, size: { w: 3.2, d: 3.2, h: 3 }, resize: 'none', existingOnly: true },

  // ---------- garden ----------
  raised_bed: { name: 'Raised garden bed', cat: 'garden', kind: 'box', builder: 'raised_bed', size: { w: 4, d: 8, h: 1.5 }, resize: 'wd', hEditable: true, min: { w: 2, d: 2, h: 0.5 }, max: { h: 3.5 },
    params: [sel('material', 'Material', [['cedar', 'Cedar'], ['galvanized', 'Galvanized metal'], ['stone', 'Limestone block'], ['composite', 'Gray composite']], 'cedar'), sel('plants', 'Planted with', [['veggies', 'Vegetables'], ['herbs', 'Herbs'], ['flowers', 'Flowers'], ['empty', 'Nothing yet']], 'veggies')], desc: 'Classic 4 × 8 bed; drag the edges to resize' },
  garden_plot: { name: 'In-ground vegetable plot', cat: 'garden', kind: 'box', builder: 'garden_plot', size: { w: 10, d: 12, h: 1 }, resize: 'wd', min: { w: 3, d: 3 }, ground: true,
    params: [sel('crop', 'Crops', [['mixed', 'Mixed vegetables'], ['corn', 'Corn & tall crops'], ['flowers', 'Cut flowers']], 'mixed'), sel('border', 'Border', [['none', 'None'], ['wood', 'Wood timbers'], ['stone', 'Limestone']], 'wood'), sel('fence', 'Critter fence', [['none', 'None'], ['wire', 'Cedar + wire'], ['picket', 'Picket']], 'none')] },
  planter: { name: 'Planter pot', cat: 'garden', kind: 'box', builder: 'planter', size: { w: 2, d: 2, h: 2 }, resize: 'diam', hEditable: true, min: { w: 0.8 }, max: { w: 5 },
    params: [sel('style', 'Pot', [['terracotta', 'Terracotta'], ['black', 'Black glazed'], ['white', 'White'], ['wood', 'Wood box']], 'terracotta'), sel('plant', 'Plant', [['shrub', 'Shrub'], ['flowers', 'Flowers'], ['grass', 'Ornamental grass'], ['succulent', 'Agave'], ['tree', 'Citrus tree']], 'flowers')] },
  trellis_arch: { name: 'Garden arch', cat: 'garden', kind: 'box', builder: 'trellis_arch', size: { w: 4, d: 2, h: 7.5 }, resize: 'w', hEditable: true,
    params: [sel('color', 'Finish', [['wood', 'Cedar'], ['black', 'Black metal'], ['white', 'White']], 'wood'), sel('vine', 'Vine', [['green', 'Green vine'], ['roses', 'Climbing roses'], ['wisteria', 'Wisteria'], ['none', 'None']], 'roses')] },
  greenhouse: { name: 'Greenhouse', cat: 'garden', kind: 'box', builder: 'greenhouse', size: { w: 8, d: 10, h: 8 }, resize: 'wd', hEditable: true, min: { w: 5, d: 5, h: 6.5 } },
  compost_bin: { name: 'Compost bin', cat: 'garden', kind: 'box', builder: 'compost_bin', size: { w: 3, d: 3, h: 3 }, resize: 'wd' },
  rain_barrel: { name: 'Rain barrel', cat: 'garden', kind: 'box', builder: 'rain_barrel', size: { w: 2, d: 2, h: 3 }, resize: 'none', params: [sel('color', 'Color', [['green', 'Green'], ['wood', 'Wood look']], 'green')] },
  flower_bed: { name: 'Draw a flower bed', cat: 'garden', kind: 'area', builder: 'area', draw: true, defaults: { material: 'mulch_brown', edging: 'steel', plants: 'mixed', density: 'medium' }, paramsRef: 'area', desc: 'Click points to outline the bed' },

  // ---------- pets ----------
  dog_run: { name: 'Puppy run', cat: 'pets', kind: 'box', builder: 'enclosure', size: { w: 10, d: 20, h: 4 }, resize: 'wd', hEditable: true, min: { w: 4, d: 4, h: 2.5 }, max: { h: 8 }, ground: false,
    params: [sel('style', 'Fence', fenceOpts(['weldedWire', 'chainlink', 'wireFrame', 'blackMetal', 'pickets', 'cedar', 'horizontal']), 'wireFrame'), sel('ground', 'Ground inside', [['none', 'Leave the grass'], ['turf', 'Artificial turf'], ['gravel_pea', 'Pea gravel'], ['mulch_cedar', 'Cedar mulch'], ['concrete', 'Concrete'], ['dg', 'Decomposed granite']], 'turf'), sel('gate', 'Gate side', [['front', 'Front'], ['back', 'Back'], ['left', 'Left'], ['right', 'Right'], ['none', 'No gate']], 'front'), tog('extras', 'Bowls & toys', true)], desc: 'Fenced run with gate; drag edges to resize' },
  dog_house: { name: 'Dog house', cat: 'pets', kind: 'box', builder: 'dog_house', size: { w: 3, d: 4, h: 3.5 }, resize: 'wd', params: [sel('color', 'Finish', [['wood', 'Cedar'], ['red', 'Barn red'], ['gray', 'Gray']], 'wood')] },
  splash_pool: { name: 'Dog splash pool', cat: 'pets', kind: 'box', builder: 'splash_pool', size: { w: 5, d: 5, h: 1 }, resize: 'diam', params: [sel('color', 'Color', [['blue', 'Blue'], ['pink', 'Pink']], 'blue')] },

  // ---------- water ----------
  pool_round: { name: 'Above-ground pool (round)', cat: 'water', kind: 'box', builder: 'pool_round', size: { w: 18, d: 18, h: 4.33 }, resize: 'diam', hEditable: true, min: { w: 8, h: 2.5 }, max: { w: 33, h: 5 },
    params: [sel('style', 'Wall', [['gray', 'Steel frame, gray'], ['blue', 'Frame, blue'], ['resin', 'Resin, sand'], ['wood', 'Wood-look panels']], 'gray'), tog('ladder', 'Ladder', true), tog('pump', 'Pump', true)], desc: 'Common sizes: 12, 15, 18, 21, 24 ft' },
  pool_oval: { name: 'Above-ground pool (oval)', cat: 'water', kind: 'box', builder: 'pool_oval', size: { w: 15, d: 30, h: 4.33 }, resize: 'wd', hEditable: true, min: { w: 8, d: 10, h: 2.5 }, max: { h: 5 },
    params: [sel('shape', 'Shape', [['oval', 'Oval'], ['rectangle', 'Rectangle frame']], 'oval'), sel('style', 'Wall', [['gray', 'Steel frame, gray'], ['blue', 'Frame, blue'], ['resin', 'Resin, sand'], ['wood', 'Wood-look panels']], 'gray')] },
  stock_tank: { name: 'Stock tank pool', cat: 'water', kind: 'box', builder: 'stock_tank', size: { w: 8, d: 8, h: 2 }, resize: 'diam', hEditable: true, min: { w: 4 }, max: { w: 12 }, params: [tog('deck', 'Gravel ring', true)] },
  hot_tub: { name: 'Hot tub', cat: 'water', kind: 'box', builder: 'hot_tub', size: { w: 7, d: 7, h: 3 }, resize: 'wd', params: [sel('cover', 'Cover', [['open', 'Open'], ['closed', 'Covered']], 'open'), sel('color', 'Cabinet', [['gray', 'Gray'], ['brown', 'Brown']], 'gray')] },
  fountain: { name: 'Fountain', cat: 'water', kind: 'box', builder: 'fountain', size: { w: 4, d: 4, h: 4 }, resize: 'diam', params: [sel('stone', 'Stone', [['gray', 'Gray'], ['limestone', 'Limestone']], 'gray')] },

  // ---------- structures ----------
  fence_line: { name: 'Draw a fence', cat: 'structures', kind: 'poly', builder: 'fence_line', draw: true, size: { h: 6 }, hEditable: true, min: { h: 2 }, max: { h: 10 }, params: [sel('style', 'Style', fenceOpts(), 'cedar')], desc: 'Click points along the fence line; double-click to finish' },
  privacy_area: { name: 'Fenced area', cat: 'structures', kind: 'box', builder: 'enclosure', size: { w: 14, d: 14, h: 6 }, resize: 'wd', hEditable: true, min: { w: 4, d: 4, h: 3 }, max: { h: 9 },
    params: [sel('style', 'Fence', fenceOpts(), 'horizontal'), sel('gate', 'Opening', [['front', 'Front'], ['back', 'Back'], ['left', 'Left'], ['right', 'Right'], ['none', 'None']], 'front'), sel('ground', 'Ground inside', [['none', 'Leave the grass'], ...surfaceOptions(['gravel_pea', 'dg', 'pavers_tan', 'flagstone_buff', 'turf', 'mulch_brown', 'concrete'])], 'none')], desc: 'A sectioned-off area with privacy fencing' },
  privacy_screen: { name: 'Privacy screen panel', cat: 'structures', kind: 'box', builder: 'privacy_screen', size: { w: 8, d: 1, h: 6 }, resize: 'w', hEditable: true, min: { w: 2, h: 3 }, max: { h: 9 },
    params: [sel('style', 'Style', [['horizontal', 'Horizontal cedar'], ['metal', 'Black laser-cut metal'], ['lattice', 'Lattice'], ['living', 'Living green wall']], 'horizontal')] },
  pergola: { name: 'Pergola', cat: 'structures', kind: 'box', builder: 'pergola', size: { w: 12, d: 12, h: 9 }, resize: 'wd', hEditable: true, min: { w: 6, d: 6, h: 7.5 }, max: { h: 12 },
    params: [sel('style', 'Finish', [['cedar', 'Cedar'], ['black', 'Black steel'], ['white', 'White']], 'cedar'), sel('top', 'Top', [['open', 'Open rafters'], ['shade', 'Shade cloth'], ['lights', 'String lights'], ['vines', 'Vines'], ['louvered', 'Louvered']], 'lights')] },
  gazebo: { name: 'Hardtop gazebo', cat: 'structures', kind: 'box', builder: 'gazebo', size: { w: 10, d: 12, h: 8.5 }, resize: 'wd', min: { w: 8, d: 8 },
    params: [col('roof', 'Roof color', [['#2d3a55', 'Navy'], ['#2a2a2a', 'Black'], ['#5a4636', 'Bronze'], ['#3c4a3a', 'Green']], '#2d3a55'), tog('curtains', 'Curtains', false), tog('lights', 'Center light', true)] },
  shade_sail: { name: 'Shade sail', cat: 'structures', kind: 'box', builder: 'shade_sail', size: { w: 14, d: 14, h: 10 }, resize: 'wd',
    params: [sel('shape', 'Shape', [['square', 'Square'], ['triangle', 'Triangle']], 'square'), col('color', 'Fabric', [['#d9c9a3', 'Sand'], ['#6f7d74', 'Sage'], ['#3d4f66', 'Navy'], ['#e9e6df', 'White'], ['#b5543c', 'Terracotta']], '#d9c9a3')] },
  shed: { name: 'Storage shed', cat: 'structures', kind: 'box', builder: 'shed', size: { w: 8, d: 10, h: 8 }, resize: 'wd', hEditable: true, min: { w: 4, d: 4, h: 6 },
    params: [sel('style', 'Style', [['artisan', 'Modern resin (like yours)'], ['barn', 'Red barn'], ['gable', 'Cedar gable']], 'gable')] },
  umbrella: { name: 'Patio umbrella', cat: 'structures', kind: 'box', builder: 'umbrella', size: { w: 9, d: 9, h: 8.5 }, resize: 'diam', min: { w: 6 }, max: { w: 13 },
    params: [col('color', 'Fabric', [['#2f5d73', 'Teal'], ['#d9c9a3', 'Sand'], ['#b5543c', 'Terracotta'], ['#2b2b2b', 'Black'], ['#e9e6df', 'White']], '#2f5d73')] },

  // ---------- fire ----------
  fire_pit: { name: 'Fire pit area', cat: 'fire', kind: 'box', builder: 'fire_pit', size: { w: 16, d: 16, h: 2 }, resize: 'diam', min: { w: 5 }, max: { w: 30 },
    params: [sel('pit', 'Fire pit', [['stone', 'Limestone ring'], ['block', 'Gray block'], ['steel', 'Steel bowl'], ['gas', 'Gas fire table']], 'stone'), rng('pitDiam', 'Pit size', 3, 6, 0.5, 4, 'ft'), sel('pad', 'Ground', [['gravel_pea', 'Pea gravel'], ['flagstone_buff', 'Flagstone'], ['pavers_tan', 'Pavers'], ['dg', 'Decomposed granite'], ['none', 'Grass']], 'gravel_pea'), rng('chairs', 'Chairs', 0, 8, 1, 4), sel('chairStyle', 'Chair style', [['adirondack', 'Adirondack'], ['sling', 'Sling']], 'adirondack'), col('chairColor', 'Chair color', CHAIRC, '#3f6f8a'), tog('lit', 'Fire lit', true)], desc: 'Pit, ground pad, and seating ring; drag the edge to change the pad size' },
  grill: { name: 'Grill', cat: 'fire', kind: 'box', builder: 'grill', size: { w: 5, d: 2.2, h: 4 }, resize: 'none', params: [sel('style', 'Type', [['gas', 'Gas grill'], ['kettle', 'Charcoal kettle'], ['smoker', 'Offset smoker'], ['kamado', 'Kamado'], ['griddle', 'Flat-top griddle']], 'gas')] },
  outdoor_kitchen: { name: 'Outdoor kitchen', cat: 'fire', kind: 'box', builder: 'outdoor_kitchen', size: { w: 10, d: 2.6, h: 3 }, resize: 'w', min: { w: 5 }, max: { w: 24 },
    params: [sel('shape', 'Layout', [['straight', 'Straight'], ['L', 'L-shaped']], 'straight'), rng('ret', 'L return', 3, 12, 0.5, 6, 'ft'), sel('stone', 'Base', [['limestone', 'Limestone'], ['gray', 'Gray stone'], ['brown', 'Brown stone'], ['stucco', 'Stucco']], 'limestone'), sel('counter', 'Counter', [['dark', 'Dark granite'], ['light', 'Light quartz'], ['concrete', 'Concrete']], 'dark'), rng('stools', 'Bar stools', 0, 6, 1, 3)] },
  pizza_oven: { name: 'Pizza oven', cat: 'fire', kind: 'box', builder: 'pizza_oven', size: { w: 4.5, d: 4.5, h: 6 }, resize: 'none' },
  grill_pad: { name: 'Grilling pad', cat: 'fire', kind: 'box', builder: 'surface_pad', size: { w: 10, d: 8, h: 0 }, resize: 'wd', ground: true, defaults: { material: 'pavers_gray', shape: 'rect', edging: 'none' }, paramsRef: 'surface_pad', desc: 'A paved spot for the grill and prep' },

  // ---------- seating ----------
  dining_set: { name: 'Patio dining set', cat: 'seating', kind: 'box', builder: 'dining_set', size: { w: 6, d: 7.5, h: 3 }, resize: 'w', min: { w: 3.5 }, max: { w: 10 },
    params: [sel('shape', 'Table', [['rect', 'Rectangle'], ['round', 'Round']], 'rect'), rng('chairs', 'Chairs', 2, 8, 1, 6), sel('color', 'Finish', [['black', 'Black metal'], ['teak', 'Teak'], ['white', 'White']], 'teak'), col('cushion', 'Cushions', CUSHIONS, '#d9d3c4'), tog('umbrella', 'Umbrella', false)] },
  sectional: { name: 'Outdoor sectional', cat: 'seating', kind: 'box', builder: 'sectional', size: { w: 10, d: 8, h: 3 }, resize: 'wd', min: { w: 6, d: 5 },
    params: [sel('frame', 'Frame', [['wicker', 'Wicker'], ['teak', 'Teak'], ['modern', 'Charcoal modern']], 'wicker'), col('color', 'Cushions', CUSHIONS, '#d9d3c4'), sel('table', 'Center table', [['coffee', 'Coffee table'], ['fire', 'Fire table']], 'fire')] },
  adirondack: { name: 'Adirondack chair', cat: 'seating', kind: 'box', builder: 'adirondack', size: { w: 2.8, d: 3, h: 3.3 }, resize: 'none', params: [col('color', 'Color', CHAIRC, '#3f6f8a')] },
  chaise: { name: 'Chaise lounge', cat: 'seating', kind: 'box', builder: 'chaise', size: { w: 2.4, d: 6.5, h: 3 }, resize: 'none', params: [sel('frame', 'Frame', [['metal', 'Black metal'], ['wood', 'Teak']], 'wood'), col('color', 'Cushion', CUSHIONS, '#e9e6df')] },
  bench: { name: 'Garden bench', cat: 'seating', kind: 'box', builder: 'bench', size: { w: 5, d: 2, h: 3 }, resize: 'w', min: { w: 3 }, max: { w: 10 }, params: [sel('material', 'Material', [['wood', 'Cedar'], ['metal', 'Black metal'], ['stone', 'Limestone slab']], 'wood')] },
  hammock: { name: 'Hammock', cat: 'seating', kind: 'box', builder: 'hammock', size: { w: 13, d: 3.5, h: 4.5 }, resize: 'none', params: [col('color', 'Fabric', [['#c8584a', 'Red'], ['#d9c9a3', 'Natural'], ['#3d6f8a', 'Blue'], ['#5b7a4a', 'Green']], '#d9c9a3')] },
  bistro_set: { name: 'Bistro set', cat: 'seating', kind: 'box', builder: 'bistro_set', size: { w: 3, d: 5, h: 3 }, resize: 'none', params: [col('color', 'Color', [['#1f3b2e', 'Green'], ['#2b2b2b', 'Black'], ['#f1efe9', 'White'], ['#2f4f6f', 'Navy']], '#1f3b2e')] },

  // ---------- plants ----------
  tree_shade: { name: 'Shade tree', cat: 'plants', kind: 'box', builder: 'tree', size: { w: 20, d: 20, h: 22 }, resize: 'diam', hEditable: true, min: { w: 6, h: 8 }, max: { w: 50, h: 45 }, defaults: { kind: 'oak' }, params: [sel('kind', 'Tree', [['oak', 'Live oak'], ['maple', 'Red maple']], 'oak')], desc: 'Canopy width shown; drag to grow it' },
  tree_orn: { name: 'Ornamental tree', cat: 'plants', kind: 'box', builder: 'tree', size: { w: 10, d: 10, h: 13 }, resize: 'diam', hEditable: true, min: { w: 4, h: 5 }, max: { w: 25, h: 25 }, defaults: { kind: 'crape' },
    params: [sel('kind', 'Tree', [['crape', 'Crape myrtle'], ['redbud', 'Redbud'], ['maple', 'Japanese maple']], 'crape'), sel('bloom', 'Bloom (crape myrtle)', [['pink', 'Pink'], ['white', 'White'], ['purple', 'Purple'], ['red', 'Red']], 'pink')] },
  tree_fruit: { name: 'Fruit tree', cat: 'plants', kind: 'box', builder: 'tree', size: { w: 9, d: 9, h: 10 }, resize: 'diam', hEditable: true, min: { w: 4, h: 5 }, max: { w: 20, h: 20 }, defaults: { kind: 'fruit' }, params: [sel('fruit', 'Fruit', [['peach', 'Peach'], ['citrus', 'Citrus'], ['apple', 'Apple'], ['fig', 'Fig']], 'peach')] },
  tree_evergreen: { name: 'Evergreen', cat: 'plants', kind: 'box', builder: 'tree', size: { w: 3.5, d: 3.5, h: 15 }, resize: 'diam', hEditable: true, min: { w: 2, h: 4 }, max: { w: 16, h: 40 }, defaults: { kind: 'cypress' }, params: [sel('kind', 'Shape', [['cypress', 'Italian cypress'], ['pine', 'Pine']], 'cypress')] },
  shrub: { name: 'Shrub', cat: 'plants', kind: 'box', builder: 'shrub', size: { w: 3, d: 3, h: 3 }, resize: 'diam', hEditable: true, min: { w: 1, h: 1 }, max: { w: 10, h: 10 },
    params: [sel('variety', 'Variety', [['boxwood', 'Boxwood'], ['flowering', 'Flowering (pink)'], ['hydrangea', 'Hydrangea'], ['loropetalum', 'Loropetalum'], ['salvia', 'Salvia'], ['rosemary', 'Rosemary'], ['holly', 'Holly']], 'boxwood')] },
  grass_orn: { name: 'Ornamental grass', cat: 'plants', kind: 'box', builder: 'grass_orn', size: { w: 3, d: 3, h: 3 }, resize: 'diam', hEditable: true, min: { w: 1 }, max: { w: 6 },
    params: [sel('variety', 'Variety', [['muhly', 'Pink muhly'], ['fountain', 'Fountain grass'], ['feather', 'Mexican feather grass'], ['fescue', 'Blue fescue']], 'muhly')] },
  agave: { name: 'Agave & yucca', cat: 'plants', kind: 'box', builder: 'agave', size: { w: 3.5, d: 3.5, h: 2.5 }, resize: 'diam', min: { w: 1 }, max: { w: 8 }, params: [sel('variety', 'Plant', [['agave', 'Agave'], ['sotol', 'Sotol'], ['yucca', 'Yucca']], 'agave')] },
  flowers: { name: 'Flower cluster', cat: 'plants', kind: 'box', builder: 'flowers', size: { w: 3, d: 3, h: 1 }, resize: 'diam', min: { w: 1 }, max: { w: 8 }, params: [sel('color', 'Colors', [['mixed', 'Mixed'], ['pink', 'Pinks'], ['yellow', 'Yellows'], ['purple', 'Purples'], ['white', 'White']], 'mixed')] },
  boulder: { name: 'Boulder', cat: 'plants', kind: 'box', builder: 'boulder', size: { w: 3, d: 2.5, h: 1.6 }, resize: 'wd', hEditable: true, min: { w: 0.8, d: 0.8, h: 0.4 }, params: [sel('stone', 'Stone', [['limestone', 'Limestone'], ['granite', 'Granite'], ['sandstone', 'Sandstone']], 'limestone')] },
  bird_bath: { name: 'Bird bath', cat: 'plants', kind: 'box', builder: 'bird_bath', size: { w: 2.2, d: 2.2, h: 3 }, resize: 'none' },
  hedge: { name: 'Draw a hedge', cat: 'plants', kind: 'poly', builder: 'hedge', draw: true, size: { w: 3, h: 4 }, wEditable: true, hEditable: true, min: { w: 1, h: 1 }, max: { w: 8, h: 14 },
    params: [sel('variety', 'Plant', [['boxwood', 'Boxwood'], ['privet', 'Privet'], ['holly', 'Holly'], ['flowering', 'Flowering'], ['cypress', 'Italian cypress row']], 'privet'), tog('smooth', 'Curved', true)], desc: 'Click points along the hedge line' },
  planting_bed: { name: 'Draw a landscape bed', cat: 'plants', kind: 'area', builder: 'area', draw: true, defaults: { material: 'mulch_black', edging: 'stone', plants: 'mixed', density: 'medium', smooth: true }, paramsRef: 'area' },
  rock_garden: { name: 'Draw a rock garden', cat: 'plants', kind: 'area', builder: 'area', draw: true, defaults: { material: 'river_rock', edging: 'none', plants: 'xeriscape', density: 'light', smooth: true, boulders: true }, paramsRef: 'area' },

  // ---------- paths & surfaces ----------
  walk_path: { name: 'Draw a walkway', cat: 'paths', kind: 'poly', builder: 'walk_path', draw: true, size: { w: 3 }, wEditable: true, min: { w: 1.5 }, max: { w: 10 },
    params: [sel('material', 'Material', WALK_MATS, 'stepping'), rng('spacing', 'Stone spacing', 1.5, 3, 0.25, 2, 'ft'), sel('edging', 'Edging', EDGING, 'none'), tog('smooth', 'Curved', true)], desc: 'Click to lay out a path; double-click to finish' },
  walkway: { name: 'Straight walkway', cat: 'paths', kind: 'box', builder: 'walkway', size: { w: 3, d: 16, h: 0 }, resize: 'wd', ground: true, min: { w: 1.5, d: 2 },
    params: [sel('material', 'Material', WALK_MATS, 'flagstone_buff'), rng('spacing', 'Stone spacing', 1.5, 3, 0.25, 2, 'ft'), sel('edging', 'Edging', EDGING, 'steel')] },
  surface_pad: { name: 'Patio or ground pad', cat: 'paths', kind: 'box', builder: 'surface_pad', size: { w: 12, d: 12, h: 0 }, resize: 'wd', ground: true, min: { w: 2, d: 2 },
    params: [sel('material', 'Surface', surfaceOptions(), 'flagstone_buff'), sel('shape', 'Shape', [['rect', 'Rectangle'], ['rounded', 'Rounded'], ['circle', 'Circle / oval']], 'rect'), sel('edging', 'Edging', EDGING, 'none')], desc: 'Pavers, flagstone, gravel, turf, mulch and more' },
  surface_area: { name: 'Draw a custom surface', cat: 'paths', kind: 'area', builder: 'area', draw: true, defaults: { material: 'gravel_pea', edging: 'steel', plants: 'none', smooth: false }, paramsRef: 'area', desc: 'Outline any shape and pick its surface' },
  deck: { name: 'Wood deck', cat: 'paths', kind: 'box', builder: 'deck', size: { w: 12, d: 12, h: 1.5 }, resize: 'wd', hEditable: true, min: { w: 4, d: 4, h: 0.5 }, max: { h: 8 }, surfaceH: (it) => it.h,
    params: [sel('material', 'Boards', [['cedar', 'Cedar'], ['gray', 'Gray composite'], ['walnut', 'Walnut composite']], 'cedar'), sel('railing', 'Railing', [['none', 'None'], ['wood', 'Wood'], ['black', 'Black metal']], 'none')] },
  creek: { name: 'Draw a dry creek bed', cat: 'paths', kind: 'poly', builder: 'creek', draw: true, size: { w: 3 }, wEditable: true, min: { w: 1.5 }, max: { w: 8 }, params: [sel('material', 'Rock', surfaceOptions(['river_rock', 'gravel_pea', 'gravel_gray', 'lava']), 'river_rock')], desc: 'River rock swale with boulders, like the one by your fence' },

  // ---------- lighting ----------
  string_lights: { name: 'Draw string lights', cat: 'lighting', kind: 'poly', builder: 'string_lights', draw: true, size: { h: 9 }, hEditable: true, min: { h: 6 }, max: { h: 16 },
    params: [sel('poles', 'Poles', [['all', 'Pole at every point'], ['skipFirst', 'Start at house or patio'], ['none', 'No poles (trees/structures)']], 'all'), sel('pole', 'Pole type', [['metal', 'Black metal'], ['wood', 'Wood 4×4']], 'metal'), sel('base', 'Pole base', [['none', 'In ground'], ['planter', 'Planter']], 'none'), sel('bulb', 'Bulbs', [['edison', 'Edison'], ['globe', 'Globe']], 'edison'), sel('color', 'Color', [...LIGHTC, ['multi', 'Multicolor']], 'warm'), rng('sag', 'Sag', 0, 2, 0.1, 1)], desc: 'Click each pole spot; double-click to finish' },
  path_light: { name: 'Path light', cat: 'lighting', kind: 'box', builder: 'path_light', size: { w: 0.8, d: 0.8, h: 1.8 }, resize: 'none', hEditable: true, min: { h: 1 }, max: { h: 3.5 }, params: [sel('style', 'Style', [['bollard', 'Bollard'], ['mushroom', 'Mushroom cap'], ['lantern', 'Lantern stake']], 'mushroom'), sel('color', 'Color', LIGHTC, 'warm')] },
  light_row: { name: 'Draw a row of path lights', cat: 'lighting', kind: 'poly', builder: 'light_row', draw: true, size: { h: 1.8 }, hEditable: true, min: { h: 1 }, max: { h: 3.5 },
    params: [rng('spacing', 'Spacing', 3, 15, 0.5, 6, 'ft'), sel('style', 'Style', [['bollard', 'Bollard'], ['mushroom', 'Mushroom cap'], ['lantern', 'Lantern stake']], 'mushroom'), sel('color', 'Color', LIGHTC, 'warm'), tog('smooth', 'Curved', true)] },
  uplight: { name: 'Uplight (trees & walls)', cat: 'lighting', kind: 'box', builder: 'uplight', size: { w: 0.8, d: 0.8, h: 0.6 }, resize: 'none', params: [rng('tilt', 'Aim angle', 45, 90, 5, 75, '°'), rng('reach', 'Reach', 8, 30, 1, 18, 'ft'), sel('color', 'Color', [...LIGHTC, ['blue', 'Moonlight blue']], 'warm')], desc: 'Rotate it to aim; the beam points the way the arrow faces' },
  lamp_post: { name: 'Lamp post', cat: 'lighting', kind: 'box', builder: 'lamp_post', size: { w: 1.2, d: 1.2, h: 7 }, resize: 'none', hEditable: true, min: { h: 5 }, max: { h: 12 }, params: [rng('heads', 'Lanterns', 1, 2, 1, 1), sel('color', 'Color', LIGHTC, 'warm')] },
  tiki_torch: { name: 'Torch', cat: 'lighting', kind: 'box', builder: 'tiki_torch', size: { w: 0.6, d: 0.6, h: 5.5 }, resize: 'none', hEditable: true, min: { h: 3 }, max: { h: 7 }, params: [sel('style', 'Style', [['bamboo', 'Bamboo'], ['metal', 'Black metal']], 'metal')] },

  // ---------- play ----------
  trampoline: { name: 'Trampoline', cat: 'play', kind: 'box', builder: 'trampoline', size: { w: 14, d: 14, h: 9 }, resize: 'diam', min: { w: 8 }, max: { w: 17 }, params: [tog('net', 'Safety net', true), col('color', 'Pad', [['#2f6fb0', 'Blue'], ['#2d8a4e', 'Green'], ['#2b2b2b', 'Black']], '#2f6fb0')] },
  playset: { name: 'Swing set & fort', cat: 'play', kind: 'box', builder: 'playset', size: { w: 18, d: 14, h: 10 }, resize: 'w', min: { w: 12 }, max: { w: 26 }, params: [col('accent', 'Accent', [['#2d8a4e', 'Green'], ['#2f6fb0', 'Blue'], ['#e3b23c', 'Yellow'], ['#c84b3a', 'Red']], '#2d8a4e')] },
  sandbox: { name: 'Sandbox', cat: 'play', kind: 'box', builder: 'sandbox', size: { w: 6, d: 6, h: 1 }, resize: 'wd', min: { w: 3, d: 3 } },
  cornhole: { name: 'Cornhole', cat: 'play', kind: 'box', builder: 'cornhole', size: { w: 2, d: 31, h: 1 }, resize: 'none', params: [col('color', 'Boards', [['#2f5d8a', 'Blue'], ['#c84b3a', 'Red'], ['#2d5a3d', 'Green']], '#2f5d8a')], desc: 'Regulation 27 ft between board fronts' },
  soccer_goal: { name: 'Soccer goal', cat: 'play', kind: 'box', builder: 'soccer_goal', size: { w: 12, d: 4, h: 6 }, resize: 'w', min: { w: 4 }, max: { w: 24 } },
};

// Shared param sets for drawn areas & pads
export const AREA_PARAMS = [
  sel('material', 'Surface', surfaceOptions(), 'mulch_brown'),
  sel('edging', 'Edging', EDGING, 'steel'),
  sel('plants', 'Plants', [['none', 'None'], ['mixed', 'Mixed perennials & shrubs'], ['flowers', 'Flowers'], ['shrubs', 'Shrubs'], ['grasses', 'Ornamental grasses'], ['xeriscape', 'Xeriscape (agave & grasses)']], 'none'),
  sel('density', 'Planting density', [['light', 'Light'], ['medium', 'Medium'], ['full', 'Full']], 'medium'),
  tog('boulders', 'Accent boulders', false),
  tog('smooth', 'Curved edges', false),
];
for (const t of Object.values(TYPES)) {
  if (t.paramsRef === 'area') t.params = AREA_PARAMS;
  if (t.paramsRef === 'surface_pad') t.params = TYPES.surface_pad.params;
}

export function typeDef(type) { return TYPES[type]; }
export function buildFor(item, seed) {
  const t = TYPES[item.type];
  if (!t) return null;
  const p = { ...(t.defaults || {}), ...defaultsOf(t), ...item.p, w: item.w, d: item.d, h: item.h };
  if (t.build) return t.build(p, seed);
  if (t.kind === 'box') return BUILDERS[t.builder](p, seedRng(seed), seed);
  return POLY_BUILDERS[t.builder]({ ...item, p }, seedRng(seed));
}
function seedRng(seed) { return mkrng(seed); }
export function defaultsOf(t) {
  const o = {};
  for (const p of t.params || []) if (p.def !== undefined) o[p.key] = p.def;
  return { ...o, ...(t.defaults || {}) };
}
