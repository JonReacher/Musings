import * as THREE from 'three';
import { makeCanvas, toTexture, fbmField, rng, hexToRgb } from './core.js';

// Each entry: name -> { tex, tile (feet per repeat) }
const cache = new Map();
let ANISO = 8;
export function setAniso(a) { ANISO = a; }

// Return texture with repeat = 1/tile, so geometry UVs measured in feet map at real scale.
export function tex(name, ...args) {
  const key = name + '|' + args.join('|');
  if (!cache.has(key)) {
    const fn = GEN[name];
    if (!fn) throw new Error('no texture ' + name);
    const { canvas, tile = 1, srgb = true, tileV } = fn(...args);
    const t = toTexture(canvas, { srgb, aniso: ANISO });
    t.repeat.set(1 / tile, 1 / (tileV ?? tile));
    t.userData.tile = tile;
    cache.set(key, t);
  }
  return cache.get(key);
}
// Same image, different repeat
export function texTiled(name, tileU, tileV, ...args) {
  const base = tex(name, ...args);
  const key = 'tiled|' + name + '|' + args.join('|') + '|' + tileU + '|' + tileV;
  if (!cache.has(key)) {
    const t = base.clone();
    t.repeat.set(1 / tileU, 1 / tileV);
    t.needsUpdate = true;
    cache.set(key, t);
  }
  return cache.get(key);
}

let fencePhoto = null;
export function setFencePhoto(dataUrl) { fencePhoto = dataUrl; }

function pixels(size, fn, h = size) {
  const c = makeCanvas(size, h);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, h);
  const d = img.data;
  for (let y = 0; y < h; y++) for (let x = 0; x < size; x++) {
    const [r, g, b, a = 255] = fn(x / size, y / h, x, y);
    const i = (y * size + x) * 4;
    d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = a;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}
const mix = (a, b, t) => a + (b - a) * t;
const mixc = (c1, c2, t) => [mix(c1[0], c2[0], t), mix(c1[1], c2[1], t), mix(c1[2], c2[2], t)];
const shade = (c, k) => [c[0] * k, c[1] * k, c[2] * k];
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));

// draw onto canvas with wrap (for tileable shapes)
function wrapDraw(ctx, size, x, y, r, draw) {
  for (const dx of [-size, 0, size]) for (const dy of [-size, 0, size]) {
    const X = x + dx, Y = y + dy;
    if (X + r < 0 || X - r > size || Y + r < 0 || Y - r > size) continue;
    draw(X, Y);
  }
}

function noiseTex(c1, c2, { size = 256, base = 4, oct = 5, seed = 1, speck = 0.08, contrast = 1 } = {}) {
  const f = fbmField(seed, base, oct);
  const r = rng(seed + 7);
  const A = hexToRgb(c1), Bc = hexToRgb(c2);
  return pixels(size, (u, v) => {
    let n = clamp((f(u, v) - 0.5) * contrast + 0.5);
    const s = 1 + (r() - 0.5) * speck;
    return shade(mixc(A, Bc, n), s);
  });
}

const GEN = {
  concrete(color = '#c3b8a3') {
    const base = hexToRgb(color);
    const f = fbmField(11, 4, 6), r = rng(3);
    const canvas = pixels(512, (u, v) => {
      const n = f(u, v);
      const k = 0.94 + (n - 0.5) * 0.16 + (r() - 0.5) * 0.06;
      return shade(base, k);
    });
    return { canvas, tile: 8 };
  },
  pavers(pattern = 'running', palette = 'tan') {
    const pals = {
      tan: ['#c8ae88', '#b89a72', '#d4bc98', '#a98b66', '#c2a07a'],
      gray: ['#9c9a94', '#86847e', '#aeaca5', '#77756f', '#a3a097'],
      red: ['#9e4f3a', '#8a4433', '#b0604a', '#7c3a2c', '#a55a40'],
      charcoal: ['#5c5b58', '#4d4c49', '#6a6966', '#55524e'],
    };
    const cols = pals[palette] || pals.tan;
    const S = 512, ft = 128; // 4 ft tile
    const c = makeCanvas(S); const ctx = c.getContext('2d');
    ctx.fillStyle = '#b9ad95'; ctx.fillRect(0, 0, S, S);
    const r = rng(pattern.length * 31 + palette.length);
    const brick = (x, y, w, h) => {
      const col = cols[Math.floor(r() * cols.length)];
      ctx.fillStyle = col; ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
      const g = ctx.createLinearGradient(x, y, x, y + h);
      g.addColorStop(0, 'rgba(255,255,255,0.10)'); g.addColorStop(1, 'rgba(0,0,0,0.16)');
      ctx.fillStyle = g; ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
      for (let i = 0; i < (w * h) / 60; i++) {
        ctx.fillStyle = `rgba(${r() < 0.5 ? '0,0,0' : '255,255,255'},${0.05 + r() * 0.06})`;
        ctx.fillRect(x + 2 + r() * (w - 5), y + 2 + r() * (h - 5), 1.5, 1.5);
      }
    };
    if (pattern === 'running') {
      const bw = ft * (8 / 12), bh = ft * (4 / 12) ; // 8x4 in
      for (let row = 0; row < S / bh; row++) {
        const off = (row % 2) * bw / 2;
        for (let x = -bw; x < S + bw; x += bw) brick(x + off, row * bh, bw, bh);
      }
    } else if (pattern === 'basket') {
      const u = ft * (8 / 12);
      for (let gy = 0; gy < S / u; gy++) for (let gx = 0; gx < S / u; gx++) {
        if ((gx + gy) % 2 === 0) { brick(gx * u, gy * u, u, u / 2); brick(gx * u, gy * u + u / 2, u, u / 2); }
        else { brick(gx * u, gy * u, u / 2, u); brick(gx * u + u / 2, gy * u, u / 2, u); }
      }
    } else if (pattern === 'slab') {
      const u = ft * 2; // 24x24
      for (let gy = 0; gy < 2; gy++) for (let gx = 0; gx < 2; gx++) brick(gx * u, gy * u, u, u);
    } else { // ashlar/cobble mix
      const u = ft / 2;
      for (let gy = 0; gy < S / u; gy++) for (let gx = 0; gx < S / u; gx++) brick(gx * u, gy * u, u, u);
    }
    return { canvas: c, tile: 4 };
  },
  flagstone(palette = 'buff') {
    const pals = {
      buff: ['#d6c6a4', '#cbb994', '#e0d2b2', '#bfa984', '#d9c39a'],
      red: ['#b77a5a', '#a86d4f', '#c48a68', '#9c6248', '#b98163'],
      blue: ['#8b9196', '#7b8288', '#9aa0a3', '#6f777d', '#8f8a83'],
    };
    const cols = (pals[palette] || pals.buff).map(hexToRgb);
    const S = 768, N = 26;
    const r = rng(77 + palette.length);
    const pts = [];
    for (let i = 0; i < N; i++) pts.push([r() * S, r() * S, cols[Math.floor(r() * cols.length)], 0.9 + r() * 0.2]);
    const f = fbmField(5, 8, 4);
    const joint = hexToRgb('#8d8270');
    const canvas = pixels(S, (u, v, x, y) => {
      let d1 = 1e9, d2 = 1e9, best = null;
      for (const p of pts) {
        let dx = Math.abs(x - p[0]); dx = Math.min(dx, S - dx);
        let dy = Math.abs(y - p[1]); dy = Math.min(dy, S - dy);
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < d1) { d2 = d1; d1 = d; best = p; } else if (d < d2) d2 = d;
      }
      const n = f(u, v);
      const edge = d2 - d1;
      if (edge < 7 + n * 6) return shade(joint, 0.85 + n * 0.3);
      const k = best[3] * (0.9 + n * 0.2) * (edge < 12 ? 0.9 : 1);
      return shade(best[2], k);
    });
    return { canvas, tile: 7 };
  },
  gravel(palette = 'pea', grain = 1) {
    const pals = {
      pea: ['#b9a88c', '#9f8d72', '#cfc1a6', '#8c7b65', '#a8a097', '#c7b391'],
      dg: ['#c49a6c', '#b88b5d', '#d1aa7f', '#a87a50'],
      white: ['#e3e0d8', '#cfcbc1', '#f0ede6', '#bdb8ad'],
      gray: ['#8e8c86', '#7a7872', '#a5a29b', '#6a6863'],
      river: ['#9a8f80', '#b7aa96', '#7c7468', '#c9bfae', '#8c8a85', '#a59379'],
      lava: ['#7a3a2c', '#5e2c22', '#8f4535', '#4b231c'],
    };
    const cols = pals[palette] || pals.pea;
    const S = 512, c = makeCanvas(S), ctx = c.getContext('2d');
    const r = rng(17 + palette.length * 13 + grain);
    ctx.fillStyle = palette === 'dg' ? '#b48d63' : '#6d6253'; ctx.fillRect(0, 0, S, S);
    const tileFt = palette === 'river' ? 5 : palette === 'dg' ? 2 : 3;
    const pxPerIn = S / (tileFt * 12);
    const minR = (palette === 'river' ? 1.0 : palette === 'dg' ? 0.08 : 0.18) * pxPerIn * grain;
    const maxR = (palette === 'river' ? 2.6 : palette === 'dg' ? 0.25 : 0.45) * pxPerIn * grain;
    const count = Math.floor((S * S) / (Math.PI * ((minR + maxR) / 2) ** 2) * 1.6);
    for (let i = 0; i < count; i++) {
      const x = r() * S, y = r() * S, rad = minR + r() * (maxR - minR);
      const col = cols[Math.floor(r() * cols.length)];
      const ang = r() * Math.PI, ecc = 0.65 + r() * 0.35;
      wrapDraw(ctx, S, x, y, rad, (X, Y) => {
        ctx.save(); ctx.translate(X, Y); ctx.rotate(ang);
        const g = ctx.createRadialGradient(-rad * 0.3, -rad * 0.3, rad * 0.1, 0, 0, rad);
        g.addColorStop(0, col); g.addColorStop(0.75, col); g.addColorStop(1, 'rgba(40,32,25,0.9)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, 0, rad, rad * ecc, 0, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      });
    }
    return { canvas: c, tile: tileFt };
  },
  mulch(color = 'brown') {
    const pals = { brown: ['#5a3c26', '#6e4a2f', '#4a2f1d', '#7d5638'], black: ['#2b2420', '#3a312b', '#1f1a17', '#463b33'], red: ['#6e2f22', '#7f3a2a', '#5a261c', '#8a4532'], cedar: ['#9a6a43', '#8a5b37', '#ad7b52', '#7a4e2f'] };
    const cols = pals[color] || pals.brown;
    const S = 512, c = makeCanvas(S), ctx = c.getContext('2d');
    ctx.fillStyle = cols[2]; ctx.fillRect(0, 0, S, S);
    const r = rng(23 + color.length);
    for (let i = 0; i < 9000; i++) {
      const x = r() * S, y = r() * S, len = 5 + r() * 16, ang = r() * Math.PI * 2, w = 1.2 + r() * 2.6;
      ctx.strokeStyle = cols[Math.floor(r() * cols.length)];
      ctx.globalAlpha = 0.85; ctx.lineWidth = w; ctx.lineCap = 'round';
      wrapDraw(ctx, S, x, y, len, (X, Y) => {
        ctx.beginPath(); ctx.moveTo(X, Y); ctx.lineTo(X + Math.cos(ang) * len, Y + Math.sin(ang) * len); ctx.stroke();
      });
    }
    ctx.globalAlpha = 1;
    return { canvas: c, tile: 4 };
  },
  turf(shadeName = 'lush') {
    const base = shadeName === 'lush' ? ['#4f8a2c', '#5e9a34', '#3f7524', '#6aa63e'] : ['#5d8c35', '#6f9c42', '#4b7a2b', '#7aa84c'];
    const S = 512, c = makeCanvas(S), ctx = c.getContext('2d');
    ctx.fillStyle = base[2]; ctx.fillRect(0, 0, S, S);
    const r = rng(41);
    for (let i = 0; i < 26000; i++) {
      const x = r() * S, y = r() * S, len = 3 + r() * 6;
      ctx.strokeStyle = base[Math.floor(r() * base.length)];
      ctx.lineWidth = 1 + r();
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (r() - 0.5) * 3, y - len); ctx.stroke();
    }
    return { canvas: c, tile: 3 };
  },
  soil() {
    const S = 256;
    const f = fbmField(91, 8, 4), r = rng(5);
    const a = hexToRgb('#3e2a1c'), b = hexToRgb('#5c4130');
    const canvas = pixels(S, (u, v) => {
      const n = f(u, v);
      return shade(mixc(a, b, n), 0.85 + r() * 0.3);
    });
    return { canvas, tile: 3 };
  },
  sand() { return { canvas: noiseTex('#d8c7a0', '#e6d8b6', { seed: 8, speck: 0.12, size: 256 }), tile: 3 }; },
  grassDetail() {
    // grayscale-ish multiplier around 0.5 (shader doubles it)
    const S = 512, c = makeCanvas(S), ctx = c.getContext('2d');
    ctx.fillStyle = 'rgb(128,128,128)'; ctx.fillRect(0, 0, S, S);
    const r = rng(12);
    for (let i = 0; i < 30000; i++) {
      const x = r() * S, y = r() * S, len = 2 + r() * 7;
      const l = 95 + r() * 75;
      ctx.strokeStyle = `rgb(${l},${l + (r() * 12 - 4)},${l - 10})`;
      ctx.lineWidth = 0.8 + r() * 1.2;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (r() - 0.5) * 4, y + (r() - 0.5) * len); ctx.stroke();
    }
    return { canvas: c, tile: 2.5, srgb: false };
  },
  deck(color = 'cedar') {
    const pals = { cedar: ['#a66f45', '#b47b4f', '#94613b', '#bd875a'], gray: ['#8d8984', '#7f7b76', '#99958f', '#86827c'], walnut: ['#6b4a33', '#5d3f2b', '#77543b', '#634430'], white: ['#e8e6e0', '#dedbd3', '#f1efea'], black: ['#2e2d2b', '#383634', '#262523'] };
    const cols = pals[color] || pals.cedar;
    const S = 512, c = makeCanvas(S), ctx = c.getContext('2d');
    const r = rng(color.length * 7);
    const boardPx = S / (48 / 5.75); // 5.5in boards + gap in 4ft
    ctx.fillStyle = '#2a2018'; ctx.fillRect(0, 0, S, S);
    for (let i = 0; i * boardPx < S; i++) {
      const y = i * boardPx;
      // two board pieces per row with a butt joint
      const joint = r() * S;
      for (const [x0, x1] of [[0, joint], [joint, S]]) {
        const col = cols[Math.floor(r() * cols.length)];
        ctx.fillStyle = col; ctx.fillRect(x0 + 1, y + 1.5, x1 - x0 - 2, boardPx - 3);
        for (let k = 0; k < 6; k++) {
          ctx.strokeStyle = `rgba(0,0,0,${0.05 + r() * 0.08})`; ctx.lineWidth = 1;
          const yy = y + 3 + r() * (boardPx - 6);
          ctx.beginPath(); ctx.moveTo(x0, yy);
          for (let x = x0; x < x1; x += 20) ctx.lineTo(x, yy + Math.sin(x * 0.02 + k) * 1.5);
          ctx.stroke();
        }
      }
    }
    return { canvas: c, tile: 4 };
  },
  lapSiding(color = '#dcd8cc') {
    const S = 256, c = makeCanvas(S), ctx = c.getContext('2d');
    ctx.fillStyle = color; ctx.fillRect(0, 0, S, S);
    const rows = 7; // 7in exposure over 4ft ~ 6.86
    const h = S / rows;
    for (let i = 0; i < rows; i++) {
      const y = i * h;
      const g = ctx.createLinearGradient(0, y, 0, y + h);
      g.addColorStop(0, 'rgba(255,255,255,0.05)'); g.addColorStop(0.85, 'rgba(0,0,0,0.03)'); g.addColorStop(1, 'rgba(0,0,0,0.22)');
      ctx.fillStyle = g; ctx.fillRect(0, y, S, h);
    }
    return { canvas: c, tile: 4 };
  },
  boardBatten(color = '#dcd8cc') {
    const S = 256, c = makeCanvas(S), ctx = c.getContext('2d');
    ctx.fillStyle = color; ctx.fillRect(0, 0, S, S);
    const n = 3; // battens every 16in on 4ft
    for (let i = 0; i < n; i++) {
      const x = (i + 0.5) * (S / n);
      ctx.fillStyle = 'rgba(0,0,0,0.13)'; ctx.fillRect(x + 6, 0, 4, S);
      ctx.fillStyle = 'rgba(255,255,255,0.10)'; ctx.fillRect(x - 6, 0, 3, S);
    }
    return { canvas: c, tile: 4 };
  },
  shingles(color = '#45484b') {
    const S = 256, c = makeCanvas(S), ctx = c.getContext('2d');
    const base = hexToRgb(color);
    ctx.fillStyle = color; ctx.fillRect(0, 0, S, S);
    const r = rng(4);
    const rows = 8, h = S / rows;
    for (let i = 0; i < rows; i++) {
      let x = (i % 2) * 18 - 20;
      while (x < S) {
        const w = 18 + r() * 26;
        const k = 0.8 + r() * 0.35;
        ctx.fillStyle = `rgb(${base[0] * k},${base[1] * k},${base[2] * k})`;
        ctx.fillRect(x + 1, i * h + 1, w - 2, h - 2);
        x += w;
      }
      ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(0, i * h + h - 3, S, 3);
    }
    for (let i = 0; i < 4000; i++) { ctx.fillStyle = `rgba(255,255,255,${r() * 0.08})`; ctx.fillRect(r() * S, r() * S, 1, 1); }
    return { canvas: c, tile: 4 };
  },
  stone(palette = 'limestone') {
    const pals = { limestone: ['#d3c6a6', '#c4b592', '#ddd2b6', '#b9a988', '#cbbd9b'], gray: ['#9a9890', '#8a8880', '#aaa79e', '#7d7b74'], brown: ['#9b7d5f', '#8a6d51', '#ab8d6d', '#7c624a'] };
    const cols = pals[palette] || pals.limestone;
    const S = 512, ft = 128, c = makeCanvas(S), ctx = c.getContext('2d');
    ctx.fillStyle = '#7b7264'; ctx.fillRect(0, 0, S, S);
    const r = rng(palette.length * 3 + 9);
    let y = 0;
    const rowHs = [];
    while (y < S) { const h = Math.min(S - y, ft * (0.25 + r() * 0.4)); rowHs.push([y, h]); y += h; }
    for (const [yy, h] of rowHs) {
      let x = -r() * ft;
      while (x < S) {
        const w = ft * (0.5 + r() * 1.1);
        const col = cols[Math.floor(r() * cols.length)];
        ctx.fillStyle = col;
        ctx.fillRect(x + 3, yy + 3, w - 6, h - 6);
        const g = ctx.createLinearGradient(0, yy, 0, yy + h);
        g.addColorStop(0, 'rgba(255,255,255,0.12)'); g.addColorStop(1, 'rgba(0,0,0,0.18)');
        ctx.fillStyle = g; ctx.fillRect(x + 3, yy + 3, w - 6, h - 6);
        for (let k = 0; k < 40; k++) { ctx.fillStyle = `rgba(0,0,0,${r() * 0.1})`; ctx.fillRect(x + 3 + r() * (w - 8), yy + 3 + r() * (h - 8), 2, 2); }
        // wrap horizontally
        if (x + w > S) { ctx.fillStyle = col; ctx.fillRect(x + 3 - S, yy + 3, w - 6, h - 6); }
        x += w;
      }
    }
    return { canvas: c, tile: 4 };
  },
  brick() {
    const GENp = GEN.pavers('running', 'red');
    return GENp;
  },
  shedWall(color = '#b9b7b0') {
    const S = 256, c = makeCanvas(S), ctx = c.getContext('2d');
    ctx.fillStyle = color; ctx.fillRect(0, 0, S, S);
    const r = rng(2);
    for (let i = 0; i < 12; i++) { // 4in grooves on 4ft
      const x = i * (S / 12);
      ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(x, 0, 2, S);
      ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(x + 2, 0, 2, S);
    }
    for (let i = 0; i < 3000; i++) { ctx.fillStyle = `rgba(0,0,0,${r() * 0.05})`; ctx.fillRect(r() * S, r() * S, 1, 3); }
    return { canvas: c, tile: 4 };
  },
  water() {
    const S = 512;
    const f = fbmField(33, 4, 5), g2 = fbmField(57, 8, 3);
    const deep = hexToRgb('#2b86b5'), light = hexToRgb('#7fd3ea');
    const canvas = pixels(S, (u, v) => {
      const n = f(u, v), m = g2(u, v);
      const caust = Math.pow(1 - Math.abs(n - m) * 2.2, 6);
      return mixc(deep, light, clamp(caust * 0.8 + n * 0.25));
    });
    return { canvas, tile: 6 };
  },
  fabric(color = '#d9d4c7') {
    return { canvas: noiseTex(color, color, { seed: 3, speck: 0.08, size: 128 }), tile: 2 };
  },
  bark(color = '#5a4a3c') {
    const S = 256, c = makeCanvas(S), ctx = c.getContext('2d');
    ctx.fillStyle = color; ctx.fillRect(0, 0, S, S);
    const r = rng(19);
    for (let i = 0; i < 260; i++) {
      const x = r() * S, w = 2 + r() * 5;
      ctx.fillStyle = `rgba(0,0,0,${0.12 + r() * 0.2})`;
      ctx.beginPath(); ctx.moveTo(x, 0);
      for (let y = 0; y <= S; y += 16) ctx.lineTo(x + Math.sin(y * 0.05 + i) * 4, y);
      ctx.lineTo(x + w, S); ctx.lineTo(x + w, 0); ctx.fill();
    }
    return { canvas: c, tile: 2 };
  },
  // ---- fence styles (u: 8ft bay, v: full panel height unless tileV) ----
  fenceWeathered() {
    const c = makeCanvas(512, 384);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#7d7568'; ctx.fillRect(0, 0, 512, 384);
    if (fencePhoto && fencePhoto.complete) ctx.drawImage(fencePhoto, 0, 0, 512, 384);
    return { canvas: c, tile: 8, tileV: 1 };
  },
  fenceCedar(color = 'cedar') {
    const cols = color === 'stained' ? ['#7a4a2c', '#6d4126', '#85533a', '#734629'] : ['#c58c5c', '#b77f52', '#d39b6b', '#ad7347', '#c99062'];
    const W = 512, H = 384, c = makeCanvas(W, H), ctx = c.getContext('2d');
    const r = rng(8 + color.length);
    const n = 17;
    const pw = W / n;
    for (let i = 0; i < n; i++) {
      ctx.fillStyle = cols[Math.floor(r() * cols.length)];
      ctx.fillRect(i * pw, 0, pw, H);
      for (let k = 0; k < 5; k++) {
        ctx.strokeStyle = `rgba(60,30,10,${0.06 + r() * 0.08})`; ctx.lineWidth = 1;
        const x = i * pw + 3 + r() * (pw - 6);
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.bezierCurveTo(x + 3, H * 0.3, x - 3, H * 0.6, x + 1, H); ctx.stroke();
      }
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(i * pw, 0, 1.5, H);
    }
    return { canvas: c, tile: 8, tileV: 1 };
  },
  fenceHorizontal(color = 'cedar') {
    const cols = color === 'black' ? ['#2c2b29', '#353331', '#2a2826'] : color === 'gray' ? ['#8f8b85', '#9a968f', '#86827c'] : ['#b9784a', '#a86a40', '#c48556', '#9c6139'];
    const S = 256, c = makeCanvas(S), ctx = c.getContext('2d');
    ctx.clearRect(0, 0, S, S);
    const r = rng(15 + color.length);
    const board = S / (12 / 6); // 6in pitch per 1ft tile: 5.5 board + 0.5 gap
    for (let i = 0; i < 2; i++) {
      const y = i * board;
      ctx.fillStyle = cols[Math.floor(r() * cols.length)];
      ctx.fillRect(0, y, S, board * (5.4 / 6));
      ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fillRect(0, y, S, 3);
      ctx.fillStyle = 'rgba(0,0,0,0.15)'; ctx.fillRect(0, y + board * (5.4 / 6) - 3, S, 3);
    }
    return { canvas: c, tile: 4, tileV: 1 };
  },
  fenceVinyl() {
    const W = 512, H = 384, c = makeCanvas(W, H), ctx = c.getContext('2d');
    ctx.fillStyle = '#f2f1ec'; ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 12; i++) {
      const x = i * (W / 12);
      ctx.fillStyle = 'rgba(0,0,0,0.07)'; ctx.fillRect(x, 0, 2, H);
    }
    return { canvas: c, tile: 8, tileV: 1 };
  },
  chainLink() {
    const S = 128, c = makeCanvas(S), ctx = c.getContext('2d');
    ctx.clearRect(0, 0, S, S);
    ctx.strokeStyle = '#c8ccce'; ctx.lineWidth = 3.2;
    const n = 6; // 2in diamonds on 1 ft
    const s = S / n;
    for (let i = -n; i <= 2 * n; i++) {
      ctx.beginPath(); ctx.moveTo(i * s, 0); ctx.lineTo(i * s + S, S); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(i * s, 0); ctx.lineTo(i * s - S, S); ctx.stroke();
    }
    return { canvas: c, tile: 1 };
  },
  weldedWire(color = 'galv') {
    const S = 128, c = makeCanvas(S), ctx = c.getContext('2d');
    ctx.clearRect(0, 0, S, S);
    ctx.fillStyle = color === 'black' ? '#262626' : '#b9bdbf';
    const cols = 6, rows = 3; // 2x4 in on 1ft
    for (let i = 0; i < cols; i++) ctx.fillRect(i * (S / cols), 0, 3, S);
    for (let j = 0; j < rows; j++) ctx.fillRect(0, j * (S / rows), S, 3);
    return { canvas: c, tile: 1 };
  },
  metalPicket() {
    const S = 128, c = makeCanvas(S), ctx = c.getContext('2d');
    ctx.clearRect(0, 0, S, S);
    ctx.fillStyle = '#1f1f1f';
    const n = 3; // ~4in spacing
    for (let i = 0; i < n; i++) ctx.fillRect(i * (S / n) + S / n / 2 - 5, 0, 10, S);
    return { canvas: c, tile: 1, tileV: 1 };
  },
  lattice(color = '#e9e6de') {
    const S = 128, c = makeCanvas(S), ctx = c.getContext('2d');
    ctx.clearRect(0, 0, S, S);
    ctx.strokeStyle = color; ctx.lineWidth = 14; ctx.lineCap = 'square';
    for (let k = -2; k <= 2; k++) {
      ctx.beginPath(); ctx.moveTo(k * S, 0); ctx.lineTo(k * S + S, S); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(k * S, 0); ctx.lineTo(k * S - S, S); ctx.stroke();
    }
    return { canvas: c, tile: 0.5 };
  },
  screenPattern() { // laser cut metal screen
    const S = 256, c = makeCanvas(S), ctx = c.getContext('2d');
    ctx.fillStyle = '#2b2a28'; ctx.fillRect(0, 0, S, S);
    ctx.globalCompositeOperation = 'destination-out';
    const r = rng(9);
    for (let i = 0; i < 70; i++) {
      const x = r() * S, y = r() * S, rr = 6 + r() * 16, a = r() * Math.PI;
      wrapDraw(ctx, S, x, y, rr * 2, (X, Y) => {
        ctx.beginPath(); ctx.ellipse(X, Y, rr * 1.8, rr * 0.5, a, 0, Math.PI * 2); ctx.fill();
      });
    }
    ctx.globalCompositeOperation = 'source-over';
    return { canvas: c, tile: 2 };
  },
  // ---- lights ----
  glow() {
    const S = 128, c = makeCanvas(S), ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.15, 'rgba(255,255,255,0.6)');
    g.addColorStop(0.45, 'rgba(255,255,255,0.12)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
    return { canvas: c, tile: 1, srgb: false };
  },
  pool() {
    const S = 128, c = makeCanvas(S), ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(0.4, 'rgba(255,255,255,0.45)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
    return { canvas: c, tile: 1, srgb: false };
  },
  beamGrad() {
    const c = makeCanvas(8, 128), ctx = c.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 0, 128);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,255,255,0.35)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 8, 128);
    return { canvas: c, tile: 1, srgb: false };
  },
  flame() {
    const W = 64, H = 128, c = makeCanvas(W, H), ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(W / 2, H * 0.8, 2, W / 2, H * 0.7, H * 0.7);
    g.addColorStop(0, 'rgba(255,250,200,1)'); g.addColorStop(0.25, 'rgba(255,190,60,0.95)'); g.addColorStop(0.6, 'rgba(240,90,20,0.6)'); g.addColorStop(1, 'rgba(200,40,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(W / 2, 0); ctx.bezierCurveTo(W * 0.9, H * 0.45, W, H * 0.8, W / 2, H); ctx.bezierCurveTo(0, H * 0.8, W * 0.1, H * 0.45, W / 2, 0); ctx.fill();
    return { canvas: c, tile: 1, srgb: false };
  },
};

// Load the photo fence image asynchronously; re-render texture when ready.
export function loadFencePhoto(dataUrl, onReady) {
  const img = new Image();
  img.onload = () => {
    fencePhoto = img;
    const t = cache.get('fenceWeathered|');
    if (t) {
      const ctx = t.image.getContext('2d');
      ctx.drawImage(img, 0, 0, 512, 384);
      t.needsUpdate = true;
    }
    onReady && onReady();
  };
  img.src = dataUrl;
}
