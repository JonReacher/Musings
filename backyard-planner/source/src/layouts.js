import { makeItem } from './editor.js';
import { uid } from './core.js';

const PI = Math.PI;
// Your yard as measured from the photos (feet). x runs across the yard from the house's
// left-rear corner (as seen from the yard); z runs out from the back wall of the house.
export function existingItems() {
  const ex = (type, o) => ({ ...makeItem(type, o), existing: true, locked: true });
  return [
    ex('house', { x: 14.5, z: -19, w: 29, d: 38, h: 20, name: 'House' }),
    ex('slab', { x: 14.5, z: 5, w: 29, d: 10, h: 0.55, name: 'Concrete patio (29 × 10)' }),
    ex('covered_patio', { x: 13.25, z: 5.6, w: 12.3, d: 11.2, h: 9.8, name: 'Covered patio' }),
    ex('shed', { x: 32.9, z: 42.7, w: 7, d: 9, h: 7.7, rot: -PI / 2, p: { style: 'artisan' }, name: 'Your shed' }),
    ex('fence_line', { pts: [[0, -20], [-11.5, -20], [-11.5, 50], [40, 50], [40, -22.5], [29, -22.5]], h: 6, p: { style: 'weathered' }, name: 'Existing wood fence' }),
    ex('rock_garden', { pts: [[-11.5, 3.5], [-8.9, 4.5], [-8.5, 12], [-8.8, 21], [-8.4, 28], [-9.1, 34], [-11.5, 34.5]], p: { material: 'river_rock', edging: 'none', plants: 'none', smooth: true, boulders: false }, name: 'River rock drainage strip' }),
    ex('ac_unit', { x: -2.4, z: -5, name: 'AC unit' }),
  ];
}

function ideaFamily() {
  const it = (type, o) => makeItem(type, o);
  return [
    it('pool_round', { x: 2.5, z: 35.5, w: 18, d: 18, p: { style: 'gray' } }),
    it('surface_pad', { x: 2.5, z: 35.5, w: 24, d: 24, p: { material: 'gravel_pea', shape: 'circle', edging: 'steel' } }),
    it('chaise', { x: 15.5, z: 31, rot: -PI / 2 + 0.3, p: { color: '#e9e6df' } }),
    it('chaise', { x: 15.5, z: 35, rot: -PI / 2 + 0.15, p: { color: '#e9e6df' } }),
    it('fire_pit', { x: 17.5, z: 21, w: 14, d: 14, p: { pit: 'stone', chairs: 5, pad: 'flagstone_buff', chairColor: '#3f6f8a' } }),
    it('dog_run', { x: 35.5, z: 23, w: 8, d: 20, h: 4, p: { style: 'wireFrame', ground: 'turf', gate: 'left' } }),
    it('dog_house', { x: 37.2, z: 30.5, rot: -PI / 2 }),
    it('walk_path', { pts: [[11, 10.6], [12, 14], [14.5, 16.5]], w: 2.6, p: { material: 'stepping', smooth: true } }),
    it('walk_path', { pts: [[4, 10.6], [4.5, 17], [3.5, 22.5]], w: 2.6, p: { material: 'stepping', smooth: true } }),
    it('string_lights', { pts: [[19.6, 10.6], [26.5, 15], [26.5, 28], [9, 27.5], [7.5, 12.5]], h: 9.5, p: { poles: 'skipFirst', color: 'warm' } }),
    it('grill', { x: 25, z: 3.2, p: { style: 'gas' } }),
    it('dining_set', { x: 13.8, z: 4.6, w: 6, rot: 0, p: { color: 'teak', chairs: 6 } }),
    it('light_row', { pts: [[2.5, 12], [2.8, 19]], h: 1.8, p: { spacing: 6, style: 'mushroom' } }),
    it('tree_orn', { x: -6, z: 16, w: 10, h: 13, p: { kind: 'crape', bloom: 'pink' } }),
    it('planting_bed', { pts: [[-3, 10.8], [3, 10.8], [2, 13.5], [-2, 14], [-4, 12.5]], p: { material: 'mulch_black', edging: 'stone', plants: 'mixed', smooth: true } }),
  ];
}
function ideaGarden() {
  const it = (type, o) => makeItem(type, o);
  return [
    it('surface_pad', { x: 1.5, z: 36, w: 20, d: 15, p: { material: 'dg', shape: 'rect', edging: 'steel' } }),
    it('raised_bed', { x: -4.5, z: 37, w: 4, d: 8, p: { material: 'galvanized', plants: 'veggies' } }),
    it('raised_bed', { x: 1.5, z: 37, w: 4, d: 8, p: { material: 'galvanized', plants: 'flowers' } }),
    it('raised_bed', { x: 7.5, z: 37, w: 4, d: 8, p: { material: 'galvanized', plants: 'herbs' } }),
    it('trellis_arch', { x: 1.5, z: 28.5, w: 4.5, d: 2, h: 7.5, p: { color: 'black', vine: 'roses' } }),
    it('bird_bath', { x: 10, z: 31 }),
    it('compost_bin', { x: -8.5, z: 44.5 }),
    it('rain_barrel', { x: -8.5, z: 30.5 }),
    it('walk_path', { pts: [[6, 10.6], [4.5, 17], [2, 22.5], [1.5, 27.5]], w: 3, p: { material: 'flagstone_buff', smooth: true, edging: 'none' } }),
    it('surface_pad', { x: 20, z: 22, w: 15, d: 15, p: { material: 'flagstone_buff', shape: 'rounded', edging: 'none' } }),
    it('pergola', { x: 20, z: 22, w: 12, d: 12, h: 9, p: { style: 'black', top: 'lights' } }),
    it('sectional', { x: 20, z: 22, w: 10, d: 8, rot: PI, p: { frame: 'modern', color: '#7b8a6a', table: 'fire' } }),
    it('privacy_screen', { x: 27.2, z: 22, w: 10, h: 6.5, rot: PI / 2, p: { style: 'horizontal' } }),
    it('outdoor_kitchen', { x: 24.2, z: 1.6, w: 9, rot: 0, p: { shape: 'straight', stone: 'limestone', stools: 0 } }),
    it('hedge', { pts: [[-8, 48], [3, 48.2], [14, 48], [24, 48]], w: 3, h: 5, p: { variety: 'privet', smooth: false } }),
    it('tree_orn', { x: 31.5, z: 12, w: 11, h: 14, p: { kind: 'crape', bloom: 'white' } }),
    it('tree_fruit', { x: -6.5, z: 18, w: 9, h: 10, p: { fruit: 'peach' } }),
    it('planting_bed', { pts: [[28, 31], [38.5, 31], [38.5, 35.5], [33, 36], [28.5, 34]], p: { material: 'mulch_cedar', edging: 'steel', plants: 'mixed', smooth: true } }),
    it('uplight', { x: 30, z: 15.5, rot: PI, p: { tilt: 80 } }),
    it('light_row', { pts: [[7.8, 13], [6.3, 18.5], [4, 24]], h: 1.6, p: { spacing: 5.5, style: 'bollard', smooth: true } }),
  ];
}

// ---------- more ideas, each built around a different design approach ----------
const it = (type, o) => makeItem(type, o);
const ARC = PI / 2;

function ideaHillCountry() {
  return [
    it('walk_path', { pts: [[13.5, 10.6], [11, 17], [13, 24], [12.5, 27.5]], w: 4, p: { material: 'dg', smooth: true, edging: 'steel' } }),
    it('fire_pit', { x: 12.5, z: 34.5, w: 15, d: 15, p: { pit: 'stone', pad: 'dg', chairs: 4, chairStyle: 'adirondack', chairColor: '#8a5a36' } }),
    it('rock_garden', { pts: [[23, 14], [33, 12.5], [39.5, 16], [39.5, 30], [31, 33.5], [24.5, 26]], p: { material: 'gravel_gray', plants: 'xeriscape', density: 'medium', boulders: true, smooth: true, edging: 'none' } }),
    it('creek', { pts: [[-7, 20], [-3, 27], [-4.5, 35], [-6.5, 44]], w: 3.5, p: { material: 'river_rock' } }),
    it('planting_bed', { pts: [[8, 44.5], [22, 43], [26.5, 46], [26.5, 48.8], [8, 48.8]], p: { material: 'gravel_pea', plants: 'grasses', density: 'medium', edging: 'steel', smooth: true } }),
    it('tree_shade', { x: 3, z: 44, w: 16, h: 20, p: { kind: 'oak' } }),
    it('uplight', { x: 5, z: 40.5, rot: PI, p: { tilt: 70, reach: 18 } }),
    it('tree_orn', { x: 31, z: 10.5, w: 9, h: 11, p: { kind: 'redbud' } }),
    it('agave', { x: -4, z: 13, w: 3.5, p: { variety: 'agave' } }),
    it('agave', { x: -6.5, z: 16.5, w: 3, p: { variety: 'yucca' } }),
    it('grass_orn', { x: -3.2, z: 17.2, w: 3, h: 3, p: { variety: 'muhly' } }),
    it('grass_orn', { x: 2, z: 13.5, w: 2.5, h: 2.5, p: { variety: 'feather' } }),
    it('boulder', { x: 0.5, z: 16.5, w: 3.5, d: 2.6, h: 1.6, p: { stone: 'limestone' } }),
    it('bench', { x: -4.5, z: 40, w: 5, rot: ARC, p: { material: 'stone' } }),
    it('light_row', { pts: [[15.6, 11.5], [13.2, 17], [15, 23]], h: 1.6, p: { spacing: 6, style: 'bollard', smooth: true } }),
  ];
}
function ideaModern() {
  return [
    it('surface_pad', { x: 14.5, z: 19, w: 20, d: 16, p: { material: 'slab_charcoal', shape: 'rect', edging: 'steel' } }),
    it('pergola', { x: 14.5, z: 19, w: 14, d: 12, h: 9.5, p: { style: 'black', top: 'louvered' } }),
    it('sectional', { x: 14.5, z: 19.5, w: 11, d: 8, rot: PI, p: { frame: 'modern', color: '#e9e6df', table: 'fire' } }),
    it('privacy_screen', { x: 4.2, z: 19, w: 10, h: 7, rot: ARC, p: { style: 'metal' } }),
    it('privacy_screen', { x: 24.8, z: 19, w: 10, h: 7, rot: ARC, p: { style: 'horizontal' } }),
    it('walkway', { x: 14.5, z: 34.5, w: 3.5, d: 15, p: { material: 'slab_gray', edging: 'steel' } }),
    it('surface_pad', { x: 8.75, z: 44.4, w: 34.5, d: 6, p: { material: 'gravel_white', shape: 'rect', edging: 'steel' } }),
    it('hedge', { pts: [[-7, 48.7], [25, 48.7]], w: 2.4, h: 14, p: { variety: 'cypress' } }),
    it('chaise', { x: 4, z: 44.1, rot: PI, p: { frame: 'metal', color: '#e9e6df' } }),
    it('chaise', { x: 8, z: 44.1, rot: PI, p: { frame: 'metal', color: '#e9e6df' } }),
    it('tree_orn', { x: 31, z: 17, w: 11, h: 11, p: { kind: 'maple' } }),
    it('uplight', { x: 29, z: 18.5, rot: PI / 2, p: { tilt: 72, reach: 16 } }),
    it('planter', { x: 2, z: 12, w: 2.8, h: 3, p: { style: 'black', plant: 'grass' } }),
    it('planter', { x: 27, z: 12, w: 2.8, h: 3, p: { style: 'black', plant: 'grass' } }),
    it('light_row', { pts: [[12.2, 28], [12.2, 42]], h: 2.2, p: { spacing: 4.5, style: 'bollard', smooth: false } }),
    it('dining_set', { x: 13.25, z: 4.8, w: 7, p: { color: 'black', chairs: 6, cushion: '#3a3a3a' } }),
  ];
}
function ideaZen() {
  return [
    it('deck', { x: 14.5, z: 12.6, w: 20, d: 4, h: 0.8, p: { material: 'walnut', railing: 'none' } }),
    it('surface_area', { pts: [[3, 24], [24, 21.5], [30, 29], [26, 39.5], [7, 41.5], [-1, 33.5]], p: { material: 'gravel_white', edging: 'none', plants: 'none', smooth: true } }),
    it('boulder', { x: 12, z: 30, w: 4.2, d: 3.2, h: 2.4, p: { stone: 'granite' } }),
    it('boulder', { x: 17.5, z: 34.5, w: 2.6, d: 2, h: 1.4, p: { stone: 'granite' } }),
    it('boulder', { x: 8, z: 36, w: 2, d: 1.8, h: 1.1, p: { stone: 'granite' } }),
    it('walk_path', { pts: [[5, 14.8], [2, 19], [-1, 24], [-3.5, 30], [-4.5, 37]], w: 2.6, p: { material: 'stepping', smooth: true, spacing: 2 } }),
    it('bench', { x: -5.8, z: 39.5, w: 5, rot: ARC, p: { material: 'wood' } }),
    it('tree_orn', { x: 27, z: 25, w: 12, h: 12, p: { kind: 'maple' } }),
    it('tree_orn', { x: -5, z: 20, w: 8, h: 9, p: { kind: 'maple' } }),
    it('tree_evergreen', { x: 34, z: 30, w: 9, h: 18, p: { kind: 'pine' } }),
    it('fountain', { x: 22.5, z: 41.5, w: 3.4, h: 3.5, p: { stone: 'gray' } }),
    it('hedge', { pts: [[-8, 47.5], [26, 47.5]], w: 3, h: 7, p: { variety: 'holly', smooth: false } }),
    it('shrub', { x: 4, z: 26, w: 2.6, h: 2, p: { variety: 'boxwood' } }),
    it('shrub', { x: 28.5, z: 35.5, w: 3, h: 2.4, p: { variety: 'boxwood' } }),
    it('shrub', { x: 17, z: 22.5, w: 2, h: 1.6, p: { variety: 'boxwood' } }),
    it('path_light', { x: 1, z: 22, h: 2.4, p: { style: 'lantern' } }),
    it('path_light', { x: -2, z: 33, h: 2.4, p: { style: 'lantern' } }),
  ];
}
function ideaCottage() {
  return [
    it('walk_path', { pts: [[10, 10.6], [8, 18], [12, 25], [18, 30.5], [20, 37.5]], w: 3.5, p: { material: 'flagstone_buff', smooth: true, edging: 'brick' } }),
    it('flower_bed', { pts: [[21, 12], [33, 11], [39.5, 15], [39.5, 25], [31, 26.5], [24, 21]], p: { material: 'mulch_brown', edging: 'stone', plants: 'flowers', density: 'full', smooth: true } }),
    it('flower_bed', { pts: [[-8.3, 12], [4, 12], [5, 18], [1, 25], [-8.3, 27]], p: { material: 'mulch_brown', edging: 'stone', plants: 'mixed', density: 'full', smooth: true } }),
    it('garden_plot', { x: 31.5, z: 32.5, w: 12, d: 9, p: { crop: 'mixed', border: 'wood', fence: 'picket' } }),
    it('trellis_arch', { x: 8.6, z: 15.5, w: 5, d: 2, h: 7.5, rot: 0.15, p: { color: 'white', vine: 'roses' } }),
    it('bird_bath', { x: 17, z: 23 }),
    it('surface_pad', { x: 20.5, z: 41.5, w: 9, d: 9, p: { material: 'flagstone_buff', shape: 'circle', edging: 'brick' } }),
    it('bistro_set', { x: 20.5, z: 41.5, rot: 0.5, p: { color: '#1f3b2e' } }),
    it('tree_fruit', { x: -3.5, z: 37, w: 10, h: 11, p: { fruit: 'apple' } }),
    it('tree_orn', { x: 7, z: 44, w: 9, h: 11, p: { kind: 'redbud' } }),
    it('hedge', { pts: [[-8, 48.4], [25, 48.4]], w: 3, h: 5, p: { variety: 'flowering', smooth: false } }),
    it('shrub', { x: -4, z: 7.5, w: 3.5, h: 3.5, p: { variety: 'hydrangea' } }),
    it('shrub', { x: 33, z: 6, w: 3.5, h: 3.5, p: { variety: 'hydrangea' } }),
    it('planter', { x: 2, z: 8, w: 2, h: 2, p: { style: 'terracotta', plant: 'flowers' } }),
    it('planter', { x: 27, z: 8, w: 2, h: 2, p: { style: 'terracotta', plant: 'flowers' } }),
    it('adirondack', { x: -2, z: 31.2, rot: ARC - 0.3, p: { color: '#f1efe9' } }),
    it('adirondack', { x: -2.5, z: 34.6, rot: ARC + 0.2, p: { color: '#f1efe9' } }),
  ];
}
function ideaKids() {
  return [
    it('surface_pad', { x: 17.5, z: 31.5, w: 21, d: 17, p: { material: 'mulch_cedar', shape: 'rounded', edging: 'steel' } }),
    it('playset', { x: 17.5, z: 31.5, w: 18, d: 14, p: { accent: '#2d8a4e' } }),
    it('trampoline', { x: -1, z: 39, w: 14, d: 14, p: { color: '#2f6fb0' } }),
    it('sandbox', { x: 5, z: 17, w: 6, d: 6 }),
    it('shade_sail', { x: 5, z: 18, w: 13, d: 12, p: { shape: 'triangle', color: '#e3b23c' } }),
    it('soccer_goal', { x: 36, z: 22, w: 12, d: 4, h: 6, rot: -ARC }),
    it('walk_path', { pts: [[18, 10.6], [18, 16.5], [17.5, 22]], w: 2.4, p: { material: 'stepping_round', smooth: true, spacing: 2 } }),
    it('tree_shade', { x: 34, z: 33.5, w: 17, h: 20, p: { kind: 'oak' } }),
    it('adirondack', { x: 1, z: 27, rot: 0.4, p: { color: '#c84b3a' } }),
    it('adirondack', { x: 4.5, z: 27.5, rot: 0.2, p: { color: '#e3b23c' } }),
    it('dining_set', { x: 24.5, z: 5, w: 5, p: { shape: 'round', chairs: 4, color: 'white', umbrella: true, umbrellaColor: '#e3b23c' } }),
  ];
}
function ideaEntertainer() {
  return [
    it('surface_pad', { x: 14.5, z: 19, w: 30, d: 16, p: { material: 'pavers_gray', shape: 'rect', edging: 'none' } }),
    it('outdoor_kitchen', { x: 21.5, z: 13.8, w: 14, d: 2.6, p: { shape: 'L', ret: 8, stone: 'limestone', counter: 'dark', stools: 3 } }),
    it('pizza_oven', { x: 3, z: 14, w: 4.5, d: 4.5 }),
    it('dining_set', { x: 9, z: 21.5, w: 9, p: { shape: 'rect', chairs: 8, color: 'teak', cushion: '#d9d3c4' } }),
    it('surface_pad', { x: 13, z: 37, w: 17, d: 17, p: { material: 'flagstone_buff', shape: 'circle', edging: 'none' } }),
    it('sectional', { x: 13, z: 37.5, w: 11, d: 9, rot: PI, p: { frame: 'wicker', color: '#2f4f6f', table: 'fire' } }),
    it('string_lights', { pts: [[0, 11.5], [29, 16], [0, 21.5], [29, 26.5]], h: 10, p: { poles: 'all', bulb: 'globe', color: 'warm' } }),
    it('cornhole', { x: -4.5, z: 33.5, rot: 0, p: { color: '#c84b3a' } }),
    it('lamp_post', { x: 0, z: 28, h: 8 }),
    it('lamp_post', { x: 29.5, z: 28, h: 8 }),
    it('planter', { x: 29, z: 11.5, w: 2.4, h: 2.4, p: { style: 'black', plant: 'tree' } }),
    it('tree_orn', { x: 32, z: 34, w: 11, h: 14, p: { kind: 'crape', bloom: 'purple' } }),
    it('patio_heater', { x: 3.5, z: 8.4 }),
    it('patio_heater', { x: 25.5, z: 8.4 }),
  ];
}
function ideaResort() {
  return [
    it('pool_oval', { x: 8, z: 38.5, w: 24, d: 12, h: 4.33, p: { shape: 'rectangle', style: 'wood' } }),
    it('deck', { x: 8, z: 28.4, w: 24, d: 8, h: 3.6, rot: PI, p: { material: 'walnut', railing: 'none' } }),
    it('chaise', { x: -1, z: 28.6, p: { frame: 'wood', color: '#e9e6df' } }),
    it('chaise', { x: 3, z: 28.6, p: { frame: 'wood', color: '#e9e6df' } }),
    it('chaise', { x: 7, z: 28.6, p: { frame: 'wood', color: '#e9e6df' } }),
    it('umbrella', { x: 13, z: 28, w: 9, d: 9, p: { color: '#e9e6df' } }),
    it('surface_pad', { x: 26, z: 17, w: 11, d: 11, p: { material: 'slab_gray', shape: 'rect', edging: 'none' } }),
    it('hot_tub', { x: 26, z: 17, w: 7, d: 7, rot: -ARC, p: { cover: 'open', color: 'gray' } }),
    it('privacy_screen', { x: 31.8, z: 16.8, w: 11, h: 7, rot: ARC, p: { style: 'horizontal' } }),
    it('privacy_screen', { x: 26, z: 22.8, w: 11, h: 7, p: { style: 'horizontal' } }),
    it('hedge', { pts: [[-8, 48.2], [22, 48.2]], w: 3.5, h: 14, p: { variety: 'cypress' } }),
    it('walkway', { x: 8, z: 17.6, w: 4, d: 13, p: { material: 'slab_gray', edging: 'steel' } }),
    it('light_row', { pts: [[5.4, 12.5], [5.4, 23]], h: 2, p: { spacing: 5, style: 'bollard' } }),
    it('lamp_post', { x: -4.6, z: 23.6, h: 7 }),
    it('lamp_post', { x: 19.8, z: 24.4, h: 7 }),
    it('planter', { x: 18, z: 30.5, w: 2.4, h: 2.5, p: { style: 'white', plant: 'grass' } }),
    it('grass_orn', { x: 31, z: 29, w: 3, h: 3.5, p: { variety: 'fountain' } }),
    it('grass_orn', { x: 34.5, z: 31, w: 3, h: 3.5, p: { variety: 'fountain' } }),
  ];
}
function ideaHomestead() {
  return [
    it('garden_plot', { x: 4, z: 30, w: 12, d: 16, p: { crop: 'mixed', border: 'wood', fence: 'wire' } }),
    it('raised_bed', { x: 16, z: 20, w: 4, d: 8, p: { material: 'galvanized', plants: 'veggies' } }),
    it('raised_bed', { x: 21, z: 20, w: 4, d: 8, p: { material: 'galvanized', plants: 'veggies' } }),
    it('raised_bed', { x: 16, z: 30, w: 4, d: 8, p: { material: 'galvanized', plants: 'flowers' } }),
    it('raised_bed', { x: 21, z: 30, w: 4, d: 8, p: { material: 'galvanized', plants: 'veggies' } }),
    it('raised_bed', { x: 25.5, z: 12.8, w: 6, d: 3, p: { material: 'cedar', plants: 'herbs' } }),
    it('greenhouse', { x: 20.5, z: 42.5, w: 8, d: 10, h: 8 }),
    it('compost_bin', { x: 26.5, z: 47.5, w: 3, d: 3, h: 3 }),
    it('compost_bin', { x: 26.5, z: 44, w: 3, d: 3, h: 3 }),
    it('rain_barrel', { x: 27, z: 38, p: { color: 'wood' } }),
    it('tree_fruit', { x: 35, z: 13.5, w: 8, h: 10, p: { fruit: 'peach' } }),
    it('tree_fruit', { x: 35, z: 22.5, w: 8, h: 10, p: { fruit: 'citrus' } }),
    it('tree_fruit', { x: 35, z: 31.5, w: 8, h: 10, p: { fruit: 'apple' } }),
    it('walk_path', { pts: [[13.5, 10.6], [12.5, 25], [12, 37.5]], w: 3, p: { material: 'dg', smooth: false, edging: 'none' } }),
    it('flower_bed', { pts: [[-8.3, 12], [-3.5, 12], [-3.5, 20], [-8.3, 20]], p: { material: 'mulch_brown', edging: 'none', plants: 'flowers', density: 'full', smooth: true } }),
    it('chicken_coop', { x: -3, z: 44.5, rot: ARC, p: { color: 'red', hens: 4 } }),
  ];
}
function ideaDogs() {
  return [
    it('dog_run', { x: 32, z: 24, w: 14, d: 22, h: 4.5, p: { style: 'wireFrame', ground: 'turf', gate: 'left', extras: true } }),
    it('dog_house', { x: 36.5, z: 31.5, rot: -ARC }),
    it('splash_pool', { x: 29, z: 30, w: 5, d: 5 }),
    it('walk_path', { pts: [[0.5, 10.8], [-5.5, 16], [-6.8, 30], [-5, 43.5], [8, 46.8], [21, 46], [25.5, 38.5]], w: 3, p: { material: 'gravel_pea', smooth: true, edging: 'steel' } }),
    it('tree_shade', { x: 8, z: 30, w: 20, h: 22, p: { kind: 'oak' } }),
    it('bench', { x: 9, z: 37.5, w: 5, rot: PI, p: { material: 'wood' } }),
    it('adirondack', { x: 18, z: 18, rot: ARC, p: { color: '#2d5a3d' } }),
    it('adirondack', { x: 18.5, z: 21.8, rot: ARC, p: { color: '#2d5a3d' } }),
    it('raised_bed', { x: 15, z: 43.5, w: 6, d: 3, h: 2.2, p: { material: 'cedar', plants: 'herbs' } }),
    it('light_row', { pts: [[-3.3, 16.5], [-4.3, 30], [-2.8, 41.5]], h: 1.6, p: { spacing: 7, style: 'mushroom', smooth: true } }),
    it('dog_agility', { x: 17.6, z: 31.5, p: { color: '#2f6fb0' } }),
  ];
}
function ideaBudget() {
  return [
    it('surface_pad', { x: 15, z: 22.5, w: 18, d: 18, p: { material: 'gravel_pea', shape: 'rounded', edging: 'steel' } }),
    it('fire_pit', { x: 15, z: 22.5, w: 12, d: 12, p: { pit: 'steel', pad: 'none', chairs: 4, chairStyle: 'sling', chairColor: '#3d3d3d' } }),
    it('walkway', { x: 15, z: 13.5, w: 2.5, d: 5, p: { material: 'stepping_square', spacing: 2, edging: 'none' } }),
    it('stock_tank', { x: -2, z: 37, w: 8, d: 8, h: 2, p: { deck: true } }),
    it('string_lights', { pts: [[18.1, 10.4], [25, 31], [6, 31], [7.6, 11.2]], h: 9, p: { poles: 'skipFirst', bulb: 'edison', color: 'warm' } }),
    it('planter', { x: 2, z: 12, w: 2.6, h: 2.4, p: { style: 'black', plant: 'grass' } }),
    it('planter', { x: 27, z: 12, w: 2.6, h: 2.4, p: { style: 'black', plant: 'grass' } }),
    it('planting_bed', { pts: [[29.6, 0.5], [38.5, 0.5], [38.5, 9], [29.6, 9]], p: { material: 'mulch_black', edging: 'steel', plants: 'shrubs', density: 'medium', smooth: false } }),
    it('tree_orn', { x: 33, z: 22, w: 10, h: 12, p: { kind: 'crape', bloom: 'red' } }),
    it('hammock', { x: 30, z: 33, rot: 0, p: { color: '#3d6f8a' } }),
  ];
}
function ideaMediterranean() {
  return [
    it('surface_pad', { x: 14.5, z: 21, w: 24, d: 20, p: { material: 'brick', shape: 'rect', edging: 'none' } }),
    it('fountain', { x: 14.5, z: 22, w: 5, d: 5, h: 4.5, p: { stone: 'limestone' } }),
    it('surface_pad', { x: 14.5, z: 38, w: 16, d: 14, p: { material: 'gravel_pea', shape: 'rect', edging: 'brick' } }),
    it('pergola', { x: 14.5, z: 38, w: 12, d: 12, h: 9, p: { style: 'cedar', top: 'vines' } }),
    it('dining_set', { x: 14.5, z: 38, w: 8, p: { shape: 'rect', chairs: 8, color: 'teak', cushion: '#b5543c' } }),
    it('planter', { x: 4, z: 13, w: 2.6, h: 2.4, p: { style: 'terracotta', plant: 'tree' } }),
    it('planter', { x: 25, z: 13, w: 2.6, h: 2.4, p: { style: 'terracotta', plant: 'tree' } }),
    it('planter', { x: 4, z: 29, w: 2.6, h: 2.4, p: { style: 'terracotta', plant: 'tree' } }),
    it('planter', { x: 25, z: 29, w: 2.6, h: 2.4, p: { style: 'terracotta', plant: 'tree' } }),
    it('tree_fruit', { x: 33, z: 18, w: 9, h: 10, p: { fruit: 'fig' } }),
    it('tree_fruit', { x: 33, z: 29.5, w: 9, h: 10, p: { fruit: 'citrus' } }),
    it('shrub', { x: -3.5, z: 16, w: 2.6, h: 2, p: { variety: 'rosemary' } }),
    it('shrub', { x: -3.5, z: 21, w: 2.6, h: 2, p: { variety: 'salvia' } }),
    it('shrub', { x: -3.5, z: 26, w: 2.6, h: 2, p: { variety: 'rosemary' } }),
    it('hedge', { pts: [[-8, 48.2], [25, 48.2]], w: 3, h: 6, p: { variety: 'holly', smooth: false } }),
    it('lamp_post', { x: 2, z: 31.5, h: 7 }),
    it('lamp_post', { x: 27, z: 31.5, h: 7 }),
  ];
}
function ideaPollinator() {
  return [
    it('flower_bed', { pts: [[20, 12], [39.5, 12], [39.5, 36.5], [28, 37.5], [22, 30]], p: { material: 'mulch_brown', edging: 'none', plants: 'flowers', density: 'full', smooth: true } }),
    it('planting_bed', { pts: [[-8.3, 12], [12, 12], [10, 22], [4, 30], [-8.3, 33.5]], p: { material: 'mulch_brown', edging: 'none', plants: 'mixed', density: 'full', smooth: true } }),
    it('walk_path', { pts: [[15, 10.6], [16, 20], [13.5, 30], [15, 39.5]], w: 3, p: { material: 'stepping', smooth: true, spacing: 2 } }),
    it('bird_bath', { x: 18, z: 33 }),
    it('bird_bath', { x: 27, z: 23 }),
    it('creek', { pts: [[-6.5, 37], [1, 40.5], [9, 44], [19, 45]], w: 3, p: { material: 'river_rock' } }),
    it('tree_orn', { x: 4, z: 41, w: 10, h: 12, p: { kind: 'redbud' } }),
    it('bench', { x: 21, z: 41.5, w: 5, rot: PI, p: { material: 'wood' } }),
    it('shrub', { x: 25.5, z: 40.5, w: 3, h: 3, p: { variety: 'salvia' } }),
    it('hedge', { pts: [[-8, 48.5], [24, 48.5]], w: 3, h: 5, p: { variety: 'flowering', smooth: false } }),
    it('rain_barrel', { x: 27.2, z: 38 }),
  ];
}
function ideaNight() {
  return [
    it('surface_pad', { x: 14.5, z: 21, w: 26, d: 20, p: { material: 'flagstone_blue', shape: 'rounded', edging: 'none' } }),
    it('sectional', { x: 14.5, z: 22, w: 12, d: 9, rot: PI, p: { frame: 'modern', color: '#e9e6df', table: 'fire' } }),
    it('string_lights', { pts: [[2, 12], [27, 15], [2, 21], [27, 24], [2, 30]], h: 10, p: { poles: 'all', bulb: 'globe', color: 'soft' } }),
    it('tree_orn', { x: 33, z: 15, w: 11, h: 13, p: { kind: 'crape', bloom: 'white' } }),
    it('tree_orn', { x: -4, z: 39, w: 10, h: 12, p: { kind: 'crape', bloom: 'white' } }),
    it('tree_shade', { x: 31, z: 31, w: 16, h: 19, p: { kind: 'oak' } }),
    it('uplight', { x: 31, z: 12.5, rot: 0, p: { tilt: 75, reach: 16 } }),
    it('uplight', { x: -1.5, z: 38, rot: -ARC, p: { tilt: 75, reach: 14 } }),
    it('uplight', { x: 27.5, z: 29, rot: ARC, p: { tilt: 70, reach: 20, color: 'blue' } }),
    it('flower_bed', { pts: [[-8.3, 12], [0, 12], [0.5, 30], [-8.3, 31]], p: { material: 'mulch_black', edging: 'stone', plants: 'flowers', bloom: 'white', density: 'full', smooth: true } }),
    it('walk_path', { pts: [[14.5, 31], [12, 38], [14, 45.5]], w: 3, p: { material: 'flagstone_blue', smooth: true } }),
    it('light_row', { pts: [[12, 32.5], [9.8, 38.5], [11.5, 45]], h: 2.2, p: { spacing: 5, style: 'lantern', smooth: true } }),
    it('lamp_post', { x: 0.5, z: 32, h: 8, p: { heads: 2 } }),
    it('lamp_post', { x: 28.5, z: 32, h: 8, p: { heads: 2 } }),
    it('tiki_torch', { x: 20, z: 44 }),
    it('tiki_torch', { x: 24, z: 41 }),
    it('shrub', { x: 21.5, z: 37, w: 3, h: 3, p: { variety: 'flowering', bloom: '#f4f1ec' } }),
    it('bench', { x: 14, z: 47, w: 5, rot: PI, p: { material: 'stone' } }),
  ];
}

function ideaWellness() {
  return [
    it('deck', { x: 0.5, z: 43, w: 21, d: 11, h: 0.8, p: { material: 'cedar', railing: 'none' } }),
    it('sauna', { x: -6, z: 43.6, w: 7, d: 8, rot: PI, p: { wood: 'cedar', porch: true } }),
    it('cold_plunge', { x: 1.5, z: 44.5, p: { color: 'wood' } }),
    it('outdoor_shower', { x: 8, z: 45.5, w: 4, d: 4 }),
    it('walk_path', { pts: [[10.5, 10.6], [9.5, 19], [6, 28], [3.5, 37.2]], w: 2.8, p: { material: 'stepping_square', smooth: true, spacing: 2.2 } }),
    it('koi_pond', { x: -1.5, z: 24, w: 10, d: 7 }),
    it('surface_pad', { x: 21, z: 32, w: 14, d: 14, p: { material: 'gravel_white', shape: 'circle', edging: 'steel' } }),
    it('daybed', { x: 21, z: 32, rot: PI, p: { frame: 'teak', color: '#e9e6df', accent: '#7b8a6a', canopy: true } }),
    it('egg_chair', { x: 27.4, z: 14.2, rot: -ARC + 0.4, p: { color: 'natural', cushion: '#e9e6df' } }),
    it('egg_chair', { x: 21.4, z: 14.6, rot: -ARC - 0.2, p: { color: 'natural', cushion: '#e9e6df' } }),
    it('hedge', { pts: [[13, 48.3], [27, 48.3]], w: 3.5, h: 9, p: { variety: 'privet', smooth: false } }),
    it('tree_orn', { x: 33, z: 25, w: 10, h: 12, p: { kind: 'redbud' } }),
    it('grass_orn', { x: 5, z: 29.5, w: 3, h: 3.5, p: { variety: 'fountain' } }),
    it('grass_orn', { x: -5, z: 30.5, w: 3, h: 3.5, p: { variety: 'fountain' } }),
    it('shrub', { x: 14, z: 39, w: 3, h: 3, p: { variety: 'rosemary' } }),
    it('light_row', { pts: [[12.2, 13], [11.2, 20], [8, 28], [5.6, 35]], h: 1.6, p: { spacing: 6, style: 'mushroom', smooth: true } }),
    it('uplight', { x: 31, z: 22, rot: 0, p: { tilt: 75, reach: 14 } }),
    it('bird_feeder', { x: 29.5, z: 36 }),
    it('planter', { x: 2.5, z: 12, w: 2.4, h: 2.4, p: { style: 'black', plant: 'grass' } }),
  ];
}
function ideaGameDay() {
  return [
    it('movie_screen', { x: 13, z: 46.8, w: 14, rot: PI, p: { projector: true } }),
    it('outdoor_rug', { x: 13, z: 37.5, w: 12, d: 7, p: { pattern: 'stripes', color: '#2f4f6f' } }),
    it('bean_bags', { x: 9.5, z: 37.5, rot: 0, p: { color: '#c84b3a', color2: '#f2c230' } }),
    it('bean_bags', { x: 16.5, z: 37.5, rot: 0, p: { color: '#3f6f8a', color2: '#2d8a4e' } }),
    it('putting_green', { x: 30.5, z: 21, w: 14, d: 9, p: { holes: 3 } }),
    it('ladder_toss', { x: -5, z: 24, rot: 0 }),
    it('cornhole', { x: 22.5, z: 32, rot: ARC, p: { color: '#c84b3a' } }),
    it('bar_set', { x: 22.4, z: 6.2, p: { color: 'black', stools: 4 } }),
    it('grill', { x: 26.2, z: 1.7, p: { style: 'kamado' } }),
    it('grill', { x: 3, z: 1.7, p: { style: 'griddle' } }),
    it('patio_heater', { x: 3.5, z: 8.3 }),
    it('patio_heater', { x: 27.3, z: 8.3 }),
    it('picnic_table', { x: 3, z: 33, w: 8, rot: ARC, p: { color: 'natural' } }),
    it('string_lights', { pts: [[19.6, 10.6], [27, 28], [27, 41], [-1, 41], [-1, 28], [7.4, 10.6]], h: 10, p: { poles: 'skipFirst', bulb: 'globe', color: 'warm' } }),
    it('deck_box', { x: 30, z: 11.5, rot: PI }),
    it('tree_shade', { x: 33.5, z: 34, w: 14, h: 18, p: { kind: 'oak' } }),
  ];
}

const EXAMPLES = [
  ['family', 'Idea: pool, pup & fire pit', 'A round pool, a fire pit circle and a fenced puppy run, tied together with stepping stones and string lights.', ideaFamily],
  ['garden', 'Idea: garden retreat', 'Raised beds and a rose arch on decomposed granite, plus a black steel pergola lounge screened with cedar slats.', ideaGarden],
  ['hill', 'Idea: Hill Country xeriscape', 'Native Texas plants, limestone and decomposed granite. Very little lawn to water or mow.', ideaHillCountry],
  ['modern', 'Idea: modern minimalist', 'Clean lines and a few strong materials: charcoal slabs, black steel, white gravel and a wall of cypress.', ideaModern],
  ['zen', 'Idea: zen garden', 'Raked gravel, stone, a low wood deck and a few carefully placed trees. A quiet place to sit.', ideaZen],
  ['cottage', 'Idea: cottage garden', 'Abundant flowers, a curving path and a picket-fenced vegetable patch. Relaxed and a little wild.', ideaCottage],
  ['kids', 'Idea: kids’ play yard', 'Room to run, with the swing set, trampoline and shaded sandbox all in view of the patio.', ideaKids],
  ['entertain', 'Idea: entertainer’s yard', 'Cook, eat and lounge in one flow: an L-shaped kitchen, dining for eight, a fire-table lounge and lawn games under lights.', ideaEntertainer],
  ['resort', 'Idea: backyard resort', 'A rectangular pool with a raised sun deck, loungers, and a screened hot tub near the house.', ideaResort],
  ['homestead', 'Idea: edible homestead', 'Grow as much food as the space allows: beds, an orchard row, a greenhouse and compost a few steps from the kitchen.', ideaHomestead],
  ['dogs', 'Idea: dog-friendly yard', 'A big shady run with turf, a splash pool, and a pea gravel sniffing loop where paws wear paths anyway.', ideaDogs],
  ['budget', 'Idea: simple and budget-friendly', 'A few inexpensive moves that change the most: gravel, a steel fire bowl, a stock tank pool and string lights.', ideaBudget],
  ['med', 'Idea: Mediterranean courtyard', 'Warm brick, a central fountain, potted citrus and a vine-covered pergola for long dinners.', ideaMediterranean],
  ['pollinator', 'Idea: pollinator garden', 'Dense flowers, grasses and water for birds and butterflies, with a stepping-stone path through the middle.', ideaPollinator],
  ['wellness', 'Idea: backyard spa', 'Sauna, cold plunge and outdoor shower on a cedar deck at the back, a koi pond along the way, and a canopy daybed to rest in.', ideaWellness],
  ['gameday', 'Idea: game day and movie nights', 'A big screen at the back fence with bean bags on a rug, lawn games, a putting green and a patio bar with heaters for cool nights.', ideaGameDay],
  ['night', 'Idea: night garden', 'Made to be seen after dark: white blooms, uplit trees, lanterns, torches and a glowing fire table. Try it with Evening.', ideaNight],
];
export const EXAMPLE_KEYS = EXAMPLES.map((e) => e[0]);

export function defaultLayouts() {
  const base = existingItems();
  const clone = () => JSON.parse(JSON.stringify(base)).map((i) => ({ ...i, id: uid() }));
  return [
    { id: uid(), name: 'My yard today', items: clone() },
    ...EXAMPLES.map(([ex, name, desc, fn]) => ({ id: uid(), ex, name, desc, items: [...clone(), ...fn()] })),
  ];
}
