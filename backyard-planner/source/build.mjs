import { build } from 'esbuild';
import fs from 'fs';
const res = await build({ entryPoints: ['src/main.js'], bundle: true, minify: true, format: 'iife', target: 'es2020', write: false, legalComments: 'none' });
let js = res.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const font = (file, fam, w) => `@font-face{font-family:'${fam}';font-style:normal;font-weight:${w};font-display:swap;src:url(data:font/woff2;base64,${fs.readFileSync(file).toString('base64')}) format('woff2');}`;
const fonts = [400, 500, 600, 700].map((w) => font(`node_modules/@fontsource/bricolage-grotesque/files/bricolage-grotesque-latin-${w}-normal.woff2`, 'Bricolage Grotesque', w)).join('\n')
  + '\n' + font('node_modules/@fontsource/architects-daughter/files/architects-daughter-latin-400-normal.woff2', 'Architects Daughter', 400);
let assets;
if (fs.existsSync('assets/assets.json')) assets = fs.readFileSync('assets/assets.json', 'utf8');
else { const prev = fs.readFileSync('../index.html', 'utf8'); assets = prev.match(/<script id="assets" type="application\/json">([\s\S]*?)<\/script>/)[1]; }
if (process.env.NO_PHOTOS) { const a = JSON.parse(assets); a.photos = []; assets = JSON.stringify(a); }
let html = fs.readFileSync('template.html', 'utf8');
html = html.replace('/*FONTS*/', () => fonts).replace('/*ASSETS*/', () => assets).replace('/*APP*/', () => js);
const out = process.env.OUT || '../index.html';
fs.mkdirSync(out.split('/').slice(0, -1).join('/') || '.', { recursive: true });
fs.writeFileSync(out, html);
console.log('bytes', html.length, 'js', js.length);
