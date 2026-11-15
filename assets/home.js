/* jonragland.com — home page animation.
   Everything is drawn from the current time alone (no stored state), so any moment can be shown
   by adding ?t=SECONDS to the address, which freezes the animation there. */
(() => {
  'use strict';
  const cvs = document.getElementById('stage');
  if (!cvs) return;
  const ctx = cvs.getContext('2d');

  /* ------------------------------------------------------------------ basics */
  let W = 0, H = 0, DPR = 1, U = 1, SU = 1, LW = 1.4;
  const TAU = Math.PI * 2;
  const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const seg = (t, a, b) => clamp((t - a) / (b - a));
  const ss = t => t * t * (3 - 2 * t);
  const eio = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const eout = t => 1 - Math.pow(1 - t, 3);
  const ein = t => t * t * t;
  const hash = n => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
  const rng = seed => { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 1000003) / 1000003; }; };
  const noise1 = x => { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return lerp(hash(i), hash(i + 1), u); };

  const FM = '"STIX Two Math", "Cambria Math", "STIX Two Text", serif';
  const FT = '"STIX Two Text", Georgia, serif';
  const FD = '"IBM Plex Sans Condensed", "Arial Narrow", sans-serif';
  const FMONO = '"IBM Plex Mono", ui-monospace, monospace';
  const FONTS = {
    eg: '"Noto Sans Egyptian Hieroglyphs"', cu: '"Noto Sans Cuneiform"', mu: '"Noto Music"', my: '"Noto Sans Mayan Numerals"',
    ph: '"Noto Sans Phoenician"', ru: '"Noto Sans Runic"', de: '"Noto Serif Devanagari"', ar: '"Noto Naskh Arabic"',
    he: '"Noto Serif Hebrew"', sc: '"Noto Serif SC"', m: FM, t: FT
  };

  let layoutKey = '';
  let dprCap = 2;
  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, dprCap);
    W = Math.max(1, innerWidth); H = Math.max(1, innerHeight);
    cvs.width = Math.round(W * DPR); cvs.height = Math.round(H * DPR);
    U = Math.min(W, H);
    SU = Math.max(U, Math.min(H, W * 1.2));
    LW = clamp(U / 560, 1.1, 2.1);
    layoutKey = '';
  }
  resize();
  addEventListener('resize', () => { resize(); if (frozen !== null) render(frozen); });

  /* ------------------------------------------------------------------ path helpers (screen space) */
  // Centripetal Catmull-Rom: smooth curve through points without loops or cusps
  function crc(P, n = 8) {
    const N = P.length; if (N < 2) return P.slice();
    const out = [];
    const d = (a, b) => Math.max(1e-4, Math.sqrt(Math.hypot(b[0] - a[0], b[1] - a[1])));
    for (let i = 0; i < N - 1; i++) {
      const p1 = P[i], p2 = P[i + 1];
      const p0 = i > 0 ? P[i - 1] : [2 * p1[0] - p2[0], 2 * p1[1] - p2[1]];
      const p3 = i < N - 2 ? P[i + 2] : [2 * p2[0] - p1[0], 2 * p2[1] - p1[1]];
      const t1 = d(p0, p1), t2 = t1 + d(p1, p2), t3 = t2 + d(p2, p3);
      for (let j = 0; j < n; j++) {
        const t = t1 + (t2 - t1) * j / n;
        const A = (a, b, ta, tb) => { const w = tb - ta || 1e-6; return [((tb - t) * a[0] + (t - ta) * b[0]) / w, ((tb - t) * a[1] + (t - ta) * b[1]) / w]; };
        const A1 = A(p0, p1, 0, t1), A2 = A(p1, p2, t1, t2), A3 = A(p2, p3, t2, t3);
        out.push(A(A(A1, A2, 0, t2), A(A2, A3, t1, t3), t1, t2));
      }
    }
    out.push([P[N - 1][0], P[N - 1][1]]);
    return out;
  }
  function lens(P) { const L = [0]; for (let i = 1; i < P.length; i++) L.push(L[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1])); return L; }
  // Stroke the part of a polyline between fractions a and b of its length; returns the end point
  function path(P, a = 0, b = 1, close = false) {
    if (b <= a || P.length < 2) return null;
    const L = lens(P), T = L[L.length - 1], A = a * T, B = b * T;
    ctx.beginPath(); let started = false, tip = null;
    for (let i = 1; i < P.length; i++) {
      const l0 = L[i - 1], l1 = L[i];
      if (l1 < A) continue; if (l0 > B) break;
      const p0 = P[i - 1], p1 = P[i], w = l1 - l0 || 1e-6;
      if (!started) { const u = clamp((A - l0) / w); ctx.moveTo(lerp(p0[0], p1[0], u), lerp(p0[1], p1[1], u)); started = true; }
      if (l1 <= B) { ctx.lineTo(p1[0], p1[1]); tip = p1; }
      else { const u = clamp((B - l0) / w); tip = [lerp(p0[0], p1[0], u), lerp(p0[1], p1[1], u)]; ctx.lineTo(tip[0], tip[1]); break; }
    }
    if (close && b >= 1) ctx.closePath();
    ctx.stroke();
    return tip;
  }
  function poly(P, close = false) { ctx.beginPath(); P.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); if (close) ctx.closePath(); }
  function resample(P, n) {
    const L = lens(P), T = L[L.length - 1], out = []; let j = 1;
    for (let i = 0; i < n; i++) {
      const s = T * i / (n - 1);
      while (j < P.length - 1 && L[j] < s) j++;
      const w = L[j] - L[j - 1] || 1e-6, u = clamp((s - L[j - 1]) / w);
      out.push([lerp(P[j - 1][0], P[j][0], u), lerp(P[j - 1][1], P[j][1], u)]);
    }
    return out;
  }
  function glowDot(x, y, r, a) {
    if (a <= 0) return;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(255,255,255,${a})`); g.addColorStop(0.25, `rgba(255,255,255,${a * 0.35})`); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  }
  const white = a => `rgba(255,255,255,${clamp(a)})`;

  /* ------------------------------------------------------------------ timeline (seconds) */
  const T = {
    line: [0.5, 2.3], trace: [2.3, 6.9], sit: [8.7, 10.1], look: [9.35, 10.9],
    up: [11.0, 14.8], sym: [13.4, 17.6], helix: [15.0, 17.6], boom: 19.7,
    fall: [20.3, 21.9], down: [21.0, 24.6], land: [23.7, 25.9],
    wave1: [22.4, 8.6], wave2: [26.2, 8.6], plane: [26.6, 30.4], morph: [30.3, 33.3],
    draw: [33.0, 38.2], zoom: [38.2, 40.9], rocket: [39.6, 41.3], smoke: [39.8, 43.2], LOOP: 44.2
  };
  const SKY = -1.65;
  function camY(t) {
    let y = lerp(0, SKY, eio(seg(t, ...T.up)));
    if (t > T.down[0]) y = lerp(SKY, 0, eio(seg(t, ...T.down)));
    return y;
  }

  /* ================================================================== RABBIT (rigged single-line drawing) */
  // Rest pose: crouched rabbit facing right, ground at y = 0, up is negative. Each point: x, y, then bone/weight pairs.
  const RAB_OUT = [
    [-150, 0, 'R', 1], [-161, -21, 'R', 1], [-171, -36, 'R', 1], [-184, -44, 'R', 1], [-187, -60, 'R', 1],
    [-171, -70, 'R', 0.85, 'T', 0.15], [-158, -94, 'R', 0.6, 'T', 0.4], [-130, -118, 'T', 0.65, 'R', 0.35], [-88, -129, 'T', 1], [-46, -124, 'T', 0.6, 'C', 0.4],
    [-10, -114, 'C', 1], [14, -109, 'C', 0.6, 'H', 0.4], [28, -121, 'H', 1], [33, -139, 'H', 0.5, 'E1', 0.5],
    [25, -186, 'E1', 1], [26, -236, 'E1', 1], [38, -261, 'E1', 1], [52, -238, 'E1', 1], [54, -190, 'E1', 1], [50, -150, 'E1', 0.5, 'H', 0.5],
    [58, -157, 'E2', 0.5, 'H', 0.5], [70, -202, 'E2', 1], [85, -233, 'E2', 1], [97, -220, 'E2', 1], [89, -180, 'E2', 1], [76, -146, 'E2', 0.5, 'H', 0.5],
    [95, -134, 'H', 1], [116, -118, 'H', 1], [128, -104, 'H', 1], [126, -95, 'H', 1], [115, -88, 'H', 1], [99, -82, 'H', 1],
    [82, -77, 'H', 0.5, 'C', 0.5], [73, -62, 'C', 1], [74, -40, 'F', 0.6, 'C', 0.4], [76, -17, 'F', 1], [81, -5, 'F', 1], [95, 0, 'F', 1]
  ];
  const RAB_HAUNCH = [[-130, -22, 'R', 1], [-136, -52, 'R', 0.8, 'T', 0.2], [-116, -82, 'R', 0.5, 'T', 0.5], [-82, -90, 'T', 0.6, 'R', 0.4],
    [-56, -72, 'T', 0.5, 'R', 0.5], [-47, -48, 'R', 0.6, 'T', 0.4]];
  // Back of the front paw and the belly: hidden while crouched, revealed as it sits up
  const RAB_BELLY = [[95, 0, 'F', 1], [84, 0, 'F', 1], [72, 0, 'F', 0.5, 'C', 0.5], [60, 0, 'C', 0.7, 'T', 0.3], [48, 0, 'T', 0.6, 'C', 0.4], [38, 0, 'R', 0.6, 'T', 0.4], [30, 0, 'R', 1]];
  // Small corrections applied in proportion to how far it has sat up (rounder belly, hind foot forward)
  const BELLY_SIT = [[-3, -4], [-2, -2], [-20, 21], [-27, 66], [-9, 105], [10, 35], [42, 0]];
  const OUT_SIT = { 9: [-6, 0], 10: [-8, -2], 11: [-5, 0], 32: [5, 0], 34: [4, -3], 35: [10, -13], 36: [10, -11], 37: [-3, -4] };
  const RAB_EAR = [[37, -152, 'E1', 1], [35, -198, 'E1', 1], [39, -236, 'E1', 1]];
  const RAB_WHISK = [[[118, -97], [162, -108]], [[118, -95], [160, -92]], [[116, -93], [150, -78]]];
  const RAB_EYE = [97, -118];
  const PIV = { T: [-122, -100], C: [-30, -116], H: [42, -104], E1: [40, -146], E2: [66, -150], F: [68, -66] };
  const PAR = { T: 'R', C: 'T', H: 'C', E1: 'H', E2: 'H', F: 'C' };
  const rotM = (p, a) => { const c = Math.cos(a), s = Math.sin(a); return [c, s, -s, c, p[0] - c * p[0] + s * p[1], p[1] - s * p[0] - c * p[1]]; };
  const mul = (m, n) => [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1], m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3], m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]];
  const app = (m, x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
  function bones(a) { const M = { R: [1, 0, 0, 1, 0, 0] }; for (const b of ['T', 'C', 'H', 'E1', 'E2', 'F']) M[b] = mul(M[PAR[b]], rotM(PIV[b], a[b] || 0)); return M; }
  function skin(pts, M, off, k = 0) { return pts.map((q, j) => { let x = 0, y = 0; for (let i = 2; i < q.length; i += 2) { const p = app(M[q[i]], q[0], q[1]); x += p[0] * q[i + 1]; y += p[1] * q[i + 1]; } const o = off && off[j]; return o ? [x + o[0] * k, y + o[1] * k] : [x, y]; }); }
  function rabbitAngles(t) {
    const sit = eio(seg(t, ...T.sit)), look = eio(seg(t, ...T.look));
    const wob = (a, b, f, amp) => (t > a && t < b ? Math.sin((t - a) * f) * amp * Math.sin(seg(t, a, b) * Math.PI) : 0);
    const tw = wob(7.75, 8.55, 26, 0.11), tw2 = wob(12.3, 12.95, 24, 0.09);
    const lagS = Math.sin(seg(t, 8.7, 10.5) * Math.PI) * 0.17, lagL = Math.sin(seg(t, 9.35, 11.3) * Math.PI) * 0.13;
    const breathe = Math.sin(t * 2.4) * 0.006;
    return { T: -0.95 * sit + breathe, C: -0.26 * sit, H: 0.42 * sit - 0.06 * look + 0.05 * Math.sin(seg(t, 11.8, 12.9) * Math.PI), E1: tw + lagS + lagL * 0.7 + 0.1 * look, E2: -tw * 0.7 + tw2 + lagS * 0.8 + lagL * 0.5 + 0.06 * look, F: 0.95 * sit, sit, look };
  }
  function drawRabbit(t, cy) {
    if (t > 15.5) return;
    const rs = Math.min(W * 0.0024, H * 0.00145), ox = W / 2 + 22 * rs, oy = H / 2 + (0.24 - cy) * U;
    const S = p => [ox + p[0] * rs, oy + p[1] * rs];
    const A = rabbitAngles(t), M = bones(A);
    const outCtl = skin(RAB_OUT, M, OUT_SIT, A.sit).map(S), belly = skin(RAB_BELLY, M, BELLY_SIT, A.sit).map(S);
    // one continuous line: outline, round the front paw, belly, to the hind foot
    const out = crc(outCtl.concat(belly.slice(1)), 10);
    const Lc = lens(out), toeF = Lc[(outCtl.length - 1) * 10] / Lc[Lc.length - 1];
    ctx.save();
    ctx.strokeStyle = '#fff'; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.lineWidth = LW * 1.15; ctx.shadowColor = 'rgba(255,255,255,0.55)'; ctx.shadowBlur = 7 * DPR;
    let tip = null;
    const start = out[0];
    const lp = eio(seg(t, ...T.line));
    if (lp > 0) tip = path([[-20, start[1]], [lerp(-20, start[0], lp), start[1]]]);
    const x = seg(t, ...T.trace);
    const gp = eout(seg(t, 6.75, 7.7));
    if (x > 0) tip = path(out, 0, toeF * (0.55 * eio(x) + 0.45 * x) + (1 - toeF) * gp);
    // Ground continues to the right from the front paw (crouched) or the hind foot (sitting)
    const toe = outCtl[outCtl.length - 1], hind = belly[belly.length - 1];
    const gx = lerp(toe[0], hind[0], A.sit);
    if (gp > 0) path([[gx, start[1]], [lerp(gx, W + 20, gp), start[1]]]);
    ctx.lineWidth = LW;
    const hp = seg(t, 6.2, 7.2);
    if (hp > 0) path(crc(skin(RAB_HAUNCH, M).map(S), 10), 0, eio(hp));
    const ep = seg(t, 6.6, 7.3);
    if (ep > 0) { ctx.lineWidth = LW * 0.8; path(crc(skin(RAB_EAR, M).map(S), 10), 0, eio(ep)); }
    // Whiskers twitch a little while it looks up
    const wp = seg(t, 6.9, 7.6);
    if (wp > 0) {
      ctx.lineWidth = LW * 0.7; ctx.shadowBlur = 3 * DPR;
      const tw = Math.sin(t * 9) * 3 * A.look;
      RAB_WHISK.forEach((w, i) => { const pts = skin([[w[0][0], w[0][1], 'H', 1], [w[1][0], w[1][1] + tw * (i - 1), 'H', 1]], M).map(S); path(pts, 0, eio(clamp(wp * 1.3 - i * 0.15))); });
    }
    ctx.shadowBlur = 0;
    // Eye
    const ea = seg(t, 6.9, 7.25);
    if (ea > 0) {
      const blink = [8.25, 11.6, 13.05].some(b => t > b && t < b + 0.16) ? 0.12 : 1;
      const e = S(app(M.H, RAB_EYE[0], RAB_EYE[1])), ang = A.T + A.C + A.H;
      ctx.fillStyle = white(ea);
      ctx.beginPath(); ctx.ellipse(e[0], e[1], 5.5 * rs, 4.6 * rs * blink, ang - 0.2, 0, TAU); ctx.fill();
      if (blink === 1) { ctx.fillStyle = 'rgba(0,0,0,0.9)'; ctx.beginPath(); ctx.arc(e[0] + 1.6 * rs, e[1] - 1.4 * rs, 1.3 * rs, 0, TAU); ctx.fill(); }
    }
    if (tip && (x > 0 && x < 1 || lp > 0 && lp < 1)) glowDot(tip[0], tip[1], 16, 0.9);
    ctx.restore();
  }

  /* ================================================================== SYMBOLS OF KNOWLEDGE */
  // Rich text: [text, pos] where pos 0 = baseline, 1 = superscript, -1 = subscript; {fr:[num, den]} = stacked fraction
  const fr = (n, d) => ({ fr: [n, d] });
  // In priority order: when the screen is small, the first ones get the space
  const E = (eq, sz = 'M') => ({ eq, s: sz }), X = (tx, f, sz = 'L') => ({ tx, f, s: sz }), Dg = dr => ({ dr, s: 'D' });
  const SYMS = [
    E([['𝑒', 0], ['𝑖𝜋', 1], [' + 1 = 0', 0]], 'B'), X('𓂀', 'eg'), E([['∇ ⋅ 𝐄 = ', 0], fr('𝜌', '𝜀₀')], 'B'), X('𝄞', 'mu'),
    E([['𝑖ℏ ', 0], fr('∂𝜓', '∂𝑡'), [' = 𝐻̂𝜓', 0]], 'B'), Dg('benzene'), X('知', 'sc'), E([['𝑃(𝐴|𝐵) = ', 0], fr('𝑃(𝐵|𝐴) 𝑃(𝐴)', '𝑃(𝐵)')]),
    X('𒀭', 'cu'), Dg('spiral'), E([['∫ 𝑒', 0], ['−𝑥²', 1], [' 𝑑𝑥 = √𝜋', 0]]), X('𐤀𐤁𐤂𐤃', 'ph', 'M'), Dg('feynman'),
    E([['𝐺', 0], ['𝜇𝜈', -1], [' + Λ𝑔', 0], ['𝜇𝜈', -1], [' = ', 0], fr('8𝜋𝐺', '𝑐⁴'), [' 𝑇', 0], ['𝜇𝜈', -1]]), X('𝋠', 'my'), Dg('staff'),
    E([['∮ 𝐁 ⋅ 𝑑𝐥 = 𝜇₀𝐼', 0]]), X('ज्ञान', 'de', 'M'), Dg('icosa'), E([['𝑥 = ', 0], fr('−𝑏 ± √(𝑏² − 4𝑎𝑐)', '2𝑎')]), X('𓋹', 'eg'),
    E([['𝜁(𝑠) = ∑ 𝑛', 0], ['−𝑠', 1]]), X('σοφία', 't', 'M'), Dg('element'), E([['𝐹 = 𝐺 ', 0], fr('𝑚₁𝑚₂', '𝑟²')]), X('علم', 'ar', 'M'),
    Dg('lorenz'), E([['∀𝜀 > 0 ∃𝛿 > 0', 0]]), X('𓆣', 'eg'), E([['𝐸² = (𝑝𝑐)² + (𝑚𝑐²)²', 0]]), X('חכמה', 'he', 'M'), Dg('euclid'),
    E([['𝐻 = −∑ 𝑝', 0], ['𝑖', -1], [' log 𝑝', 0], ['𝑖', -1]]), X('ᚠᚢᚦᚨᚱᚲ', 'ru', 'M'), Dg('orbit'), E([['𝜑 = ', 0], fr('1 + √5', '2')]),
    X('𒐕𒐖𒐗', 'cu', 'M'), E([['𝑒 = ∑ ', 0], fr('1', '𝑛!')]), X('𓅃', 'eg'), E([['𝜆𝑥. 𝑥', 0]]), X('道', 'sc'),
    ...['∞', '∑', '∫', '∂', '∇', '𝜋', 'ℏ', '𝜓', 'Ω'].map(c => E([[c, 0]], 'L')),
    ...['1 1 2 3 5 8 13 21 34', '2 3 5 7 11 13 17 19', '3.14159265…', '6.02214076 × 10²³', '299 792 458', '1 / 137.036', '1.6180339…', '0 1 1 0 1 0 0 1', 'MMXXVI', '2.718281828…'].map(c => X(c, 't', 'S')),
    ...['𓇳', '𓊽', '𓁹', '𓃭', '𓀀', '𓆓', '𓈖'].map(c => X(c, 'eg')), X('𒈗', 'cu'), X('𒆠', 'cu'), X('𝋲', 'my'),
    ...['𝄢', '♫', '𝅘𝅥𝅮', '♭', '𝄐'].map(c => X(c, 'mu')), E([['ℵ₀', 0]], 'L'), E([['∴', 0]], 'L'), E([['∅', 0]], 'L')
  ];
  const SIZE = { B: 0.064, L: 0.09, M: 0.048, S: 0.03, D: 0.15 };
  const MINPX = { B: 26, L: 38, M: 21, S: 14, D: 66 };

  function eqMetrics(sym, fs) {
    ctx.font = `${fs}px ${FM}`;
    let w = 0, hasFr = false;
    const parts = [];
    for (const s of sym.eq) {
      if (s.fr) {
        hasFr = true; const f2 = fs * 0.78; ctx.font = `${f2}px ${FM}`;
        const wn = ctx.measureText(s.fr[0]).width, wd = ctx.measureText(s.fr[1]).width, ww = Math.max(wn, wd) + fs * 0.2;
        parts.push({ fr: s.fr, x: w, w: ww, fs: f2, wn, wd }); w += ww; ctx.font = `${fs}px ${FM}`;
      } else {
        const f2 = s[1] ? fs * 0.66 : fs; ctx.font = `${f2}px ${FM}`;
        const ww = ctx.measureText(s[0]).width;
        parts.push({ t: s[0], x: w, w: ww, fs: f2, dy: s[1] === 1 ? -fs * 0.42 : s[1] === -1 ? fs * 0.24 : 0 }); w += ww;
        ctx.font = `${fs}px ${FM}`;
      }
    }
    return { parts, w, h: fs * (hasFr ? 2.1 : 1.35) };
  }
  // Text with a "written-on" outline, then filled
  function writeText(drawFn, wp, fp, fs) {
    if (wp > 0 && fp < 1) {
      const D = fs * 3.2;
      ctx.setLineDash([D * wp + 0.01, D]); ctx.lineDashOffset = 0;
      ctx.lineWidth = Math.max(0.6, fs / 60); ctx.strokeStyle = white(1 - fp * 0.9);
      drawFn('stroke');
      ctx.setLineDash([]);
    }
    if (fp > 0) { ctx.fillStyle = white(fp); drawFn('fill'); }
  }
  function drawEq(m, wp, fp, fs) {
    const x0 = -m.w / 2;
    writeText(mode => {
      for (const p of m.parts) {
        if (p.fr) {
          ctx.font = `${p.fs}px ${FM}`;
          const cx = x0 + p.x + p.w / 2, gap = fs * 0.12;
          if (mode === 'fill') { ctx.fillText(p.fr[0], cx - p.wn / 2, -gap - fs * 0.12); ctx.fillText(p.fr[1], cx - p.wd / 2, gap + fs * 0.62); ctx.fillRect(x0 + p.x + fs * 0.06, -fs * 0.02 + fs * 0.2 - 0.5, p.w - fs * 0.12, Math.max(1, fs / 26)); }
          else { ctx.strokeText(p.fr[0], cx - p.wn / 2, -gap - fs * 0.12); ctx.strokeText(p.fr[1], cx - p.wd / 2, gap + fs * 0.62); }
        } else {
          ctx.font = `${p.fs}px ${FM}`;
          if (mode === 'fill') ctx.fillText(p.t, x0 + p.x, fs * 0.33 + p.dy); else ctx.strokeText(p.t, x0 + p.x, fs * 0.33 + p.dy);
        }
      }
    }, wp, fp, fs);
  }

  // Line drawings of knowledge, unit box ~[-0.5, 0.5], drawn progressively (wp 0..1)
  const lorenz = (() => { let x = 0.1, y = 0, z = 0; const P = []; for (let i = 0; i < 5200; i++) { const dt = 0.006, dx = 10 * (y - x), dy = x * (28 - z) - y, dz = x * y - 8 / 3 * z; x += dx * dt; y += dy * dt; z += dz * dt; if (i > 200 && i % 3 === 0) P.push([x / 48, -(z - 25) / 48]); } return P; })();
  const ICO = (() => { const p = (1 + Math.sqrt(5)) / 2, v = []; for (const a of [-1, 1]) for (const b of [-p, p]) { v.push([0, a, b], [a, b, 0], [b, 0, a]); } const e = []; for (let i = 0; i < v.length; i++) for (let j = i + 1; j < v.length; j++) { const d = Math.hypot(v[i][0] - v[j][0], v[i][1] - v[j][1], v[i][2] - v[j][2]); if (Math.abs(d - 2) < 0.01) e.push([i, j]); } return { v, e }; })();
  function drawDiagram(name, s, wp, t) {
    const L = (P, a = 0, b = 1) => path(P.map(p => [p[0] * s, p[1] * s]), a, b);
    const arc = (cx, cy, r, a0, a1, n = 48) => { const P = []; for (let i = 0; i <= n; i++) { const a = lerp(a0, a1, i / n); P.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); } return P; };
    const W8 = (k, n) => clamp(wp * n - k); // staggered progress for part k of n
    ctx.lineWidth = Math.max(1, s / 120); ctx.strokeStyle = '#fff'; ctx.fillStyle = '#fff';
    switch (name) {
      case 'benzene': {
        const hex = []; for (let i = 0; i <= 6; i++) hex.push([Math.cos(i * TAU / 6 + Math.PI / 6) * 0.42, Math.sin(i * TAU / 6 + Math.PI / 6) * 0.42]);
        L(hex, 0, W8(0, 2)); L(arc(0, 0, 0.26, 0, TAU), 0, W8(1, 2)); break;
      }
      case 'element': {
        L([[-0.42, -0.5], [0.42, -0.5], [0.42, 0.5], [-0.42, 0.5], [-0.42, -0.5]], 0, W8(0, 1.4));
        const a = W8(0.4, 1.4);
        if (a > 0) {
          ctx.fillStyle = white(a); ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
          ctx.font = `${s * 0.13}px ${FT}`; ctx.fillText('6', -0.34 * s, -0.33 * s);
          ctx.font = `${s * 0.46}px ${FT}`; ctx.textAlign = 'center'; ctx.fillText('C', 0, 0.12 * s);
          ctx.font = `${s * 0.11}px ${FT}`; ctx.fillText('Carbon', 0, 0.29 * s); ctx.fillText('12.011', 0, 0.42 * s);
        }
        break;
      }
      case 'euclid': {
        const r = 0.28; L(arc(-r / 2, 0.08, r, 0, TAU), 0, W8(0, 3)); L(arc(r / 2, 0.08, r, Math.PI, Math.PI + TAU), 0, W8(1, 3));
        L([[-r / 2, 0.08], [r / 2, 0.08], [0, 0.08 - r * Math.sqrt(3) / 2], [-r / 2, 0.08]], 0, W8(2, 3));
        if (wp > 0.9) { ctx.globalAlpha *= seg(wp, 0.9, 1); for (const p of [[-r / 2, 0.08], [r / 2, 0.08], [0, 0.08 - r * Math.sqrt(3) / 2]]) { ctx.beginPath(); ctx.arc(p[0] * s, p[1] * s, Math.max(1.5, s / 70), 0, TAU); ctx.fill(); } }
        break;
      }
      case 'spiral': {
        // golden rectangles and spiral
        const phi = 1.618034; let x = -0.5, y = -0.309, w = 1, h = 0.618; const rects = [], sp = [];
        for (let i = 0; i < 8; i++) {
          rects.push([x, y, w, h]);
          const sq = Math.min(w, h), k = i % 4;
          let cx, cy, a0;
          if (k === 0) { cx = x + sq; cy = y + sq; a0 = Math.PI; x += sq; w -= sq; }
          else if (k === 1) { cx = x; cy = y + sq; a0 = -Math.PI / 2; y += sq; h -= sq; }
          else if (k === 2) { cx = x + w - sq; cy = y; a0 = 0; w -= sq; }
          else { cx = x + sq; cy = y + h - sq; a0 = Math.PI / 2; h -= sq; }
          for (let j = 0; j <= 16; j++) { const a = a0 + Math.PI / 2 * j / 16; sp.push([cx + Math.cos(a) * sq, cy + Math.sin(a) * sq]); }
        }
        ctx.globalAlpha *= 0.55; rects.slice(0, 6).forEach((r, i) => L([[r[0], r[1]], [r[0] + r[2], r[1]], [r[0] + r[2], r[1] + r[3]], [r[0], r[1] + r[3]], [r[0], r[1]]], 0, W8(i * 0.12, 1.6))); ctx.globalAlpha /= 0.55;
        void phi; L(sp, 0, W8(0.5, 1.5)); break;
      }
      case 'feynman': {
        L([[-0.45, -0.38], [-0.15, 0]], 0, W8(0, 4)); L([[-0.45, 0.38], [-0.15, 0]], 0, W8(0, 4));
        const wv = []; for (let i = 0; i <= 60; i++) { const u = i / 60; wv.push([lerp(-0.15, 0.15, u), Math.sin(u * TAU * 4) * 0.05]); } L(wv, 0, W8(1, 4));
        L([[0.15, 0], [0.45, -0.38]], 0, W8(2, 4)); L([[0.15, 0], [0.45, 0.38]], 0, W8(2, 4));
        if (wp > 0.8) {
          ctx.globalAlpha *= seg(wp, 0.8, 1);
          const arrow = (x1, y1, x2, y2) => { const mx = (x1 + x2) / 2 * s, my = (y1 + y2) / 2 * s, a = Math.atan2(y2 - y1, x2 - x1), r = s * 0.05; ctx.beginPath(); ctx.moveTo(mx + Math.cos(a) * r, my + Math.sin(a) * r); ctx.lineTo(mx + Math.cos(a + 2.5) * r, my + Math.sin(a + 2.5) * r); ctx.lineTo(mx + Math.cos(a - 2.5) * r, my + Math.sin(a - 2.5) * r); ctx.closePath(); ctx.fill(); };
          arrow(-0.45, -0.38, -0.15, 0); arrow(-0.15, 0, -0.45, 0.38); arrow(0.15, 0, 0.45, -0.38); arrow(0.45, 0.38, 0.15, 0);
          ctx.font = `italic ${s * 0.12}px ${FM}`; ctx.textAlign = 'center'; ctx.fillText('𝛾', 0, -0.12 * s);
          ctx.fillText('𝑒⁻', -0.47 * s, -0.43 * s); ctx.fillText('𝑒⁺', -0.47 * s, 0.53 * s);
        }
        break;
      }
      case 'icosa': {
        const a = t * 0.5, b = 0.5 + t * 0.21, ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b);
        const P = ICO.v.map(v => { const x = v[0] * ca - v[2] * sa, z = v[0] * sa + v[2] * ca, y = v[1] * cb - z * sb; return [x * 0.26, y * 0.26]; });
        ICO.e.forEach(([i, j], k) => L([P[i], P[j]], 0, clamp(wp * 1.6 - k / ICO.e.length * 0.6)));
        break;
      }
      case 'orbit': {
        L(arc(0, 0, 0.45, 0, TAU).map(p => [p[0], p[1] * 0.42]), 0, W8(0, 2));
        if (wp > 0.3) { const a = seg(wp, 0.3, 1); ctx.globalAlpha *= a; ctx.beginPath(); ctx.arc(-0.2 * s, 0, s * 0.045, 0, TAU); ctx.fill();
          const pa = t * 0.9, px = Math.cos(pa) * 0.45, py = Math.sin(pa) * 0.45 * 0.42; ctx.beginPath(); ctx.arc(px * s, py * s, s * 0.022, 0, TAU); ctx.fill();
          ctx.globalAlpha *= 0.5; L([[-0.2, 0], [px, py]]); }
        break;
      }
      case 'staff': {
        for (let i = 0; i < 5; i++) L([[-0.5, -0.16 + i * 0.08], [0.5, -0.16 + i * 0.08]], 0, W8(i * 0.1, 1.5));
        const a = seg(wp, 0.5, 1);
        if (a > 0) {
          ctx.globalAlpha *= a; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
          ctx.font = `${s * 0.42}px ${FONTS.mu}`; ctx.fillText('𝄞', -0.4 * s, 0.13 * s);
          const notes = [[-0.18, 0.04], [-0.04, -0.04], [0.1, 0], [0.24, -0.08], [0.38, 0.08]];
          notes.forEach(([x, y]) => { ctx.beginPath(); ctx.ellipse(x * s, y * s, s * 0.032, s * 0.024, -0.35, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.moveTo(x * s + s * 0.03, y * s); ctx.lineTo(x * s + s * 0.03, y * s - s * 0.2); ctx.stroke(); });
        }
        break;
      }
      case 'lorenz': { ctx.lineWidth = Math.max(0.6, s / 260); ctx.globalAlpha *= 0.85; L(lorenz, 0, wp); break; }
    }
  }

  // Layout: place symbols without overlap, sized to the screen
  let placed = [];
  function layoutSymbols() {
    const key = `${W}x${H}:${fontsReady}`;
    if (key === layoutKey) return;
    layoutKey = key; placed = [];
    const R = rng(4242), boxes = [];
    const landscape = W > H * 1.05;
    const hb = helixBox();
    boxes.push([hb[0] - U * 0.02, hb[1] - U * 0.02, hb[2] + U * 0.04, hb[3] + U * 0.04]);
    boxes.push([W - 230, 0, 230, 74]); // keep clear of the button
    const pad = U * 0.03, mx = W * 0.035, my = H * 0.055, centres = [], maxN = Math.round(W * H / (U * U) * 21);
    SYMS.forEach((s, i) => {
      const fs = Math.max(MINPX[s.s], SIZE[s.s] * SU * (0.9 + R() * 0.2));
      let w, h, m = null;
      if (s.eq) { m = eqMetrics(s, fs); w = m.w; h = m.h; }
      else if (s.tx) { ctx.font = `${fs}px ${FONTS[s.f]}`; w = ctx.measureText(s.tx).width; h = fs * 1.3; }
      else { w = h = fs; }
      if (w > W - 2 * mx || placed.length >= maxN) return;
      // best of several non-overlapping candidates: the one farthest from what is already placed
      let best = null, bestD = -1;
      for (let k = 0, found = 0; k < 160 && found < 14; k++) {
        const x = mx + w / 2 + R() * (W - 2 * mx - w), y = my + h / 2 + R() * (H - 2 * my - h);
        if (boxes.some(b => x - w / 2 - pad < b[0] + b[2] && x + w / 2 + pad > b[0] && y - h / 2 - pad < b[1] + b[3] && y + h / 2 + pad > b[1])) continue;
        found++;
        let dmin = 1e9; for (const c of centres) dmin = Math.min(dmin, Math.hypot(x - c[0], (y - c[1]) * 1.3));
        if (dmin > bestD) { bestD = dmin; best = [x, y]; }
      }
      if (!best) return;
      const [x, y] = best;
      boxes.push([x - w / 2, y - h / 2, w, h]); centres.push([x, y]);
      const z = { B: 1, L: 1, D: 0.95, M: 0.82, S: 0.62 }[s.s];
      placed.push({ s, i, x, y, w, h, fs, m, z, ph: R() * TAU, ta: 0, tf: 0, tl: 0, land: 0, spin: (R() - 0.5) * 1.4, vx: (R() - 0.5) * 0.06 });
    });
    // Appearance order: roughly outward from the middle, with some randomness
    placed.forEach(p => { p.k = Math.hypot((p.x - W / 2) / W, (p.y - H / 2) / H) + R() * 0.35; });
    const sorted = placed.slice().sort((a, b) => a.k - b.k);
    sorted.forEach((p, n) => { p.ta = lerp(T.sym[0], T.sym[1], n / Math.max(1, sorted.length - 1)); });
    placed.forEach(p => {
      p.tf = lerp(T.fall[0], T.fall[1], R());
      p.tl = lerp(T.land[0], T.land[1], R()) ;
      p.land = clamp(0.15 + 0.75 * (p.z - 0.55) / 0.45 + (R() - 0.5) * 0.25, 0.05, 0.98);
    });
    void landscape;
  }

  /* ---------------- stars */
  const STARS = (() => { const R = rng(77), s = []; for (let i = 0; i < 320; i++) s.push({ x: R(), y: R(), z: 0.35 + R() * 0.65, r: 0.4 + Math.pow(R(), 3) * 1.6, ph: R() * TAU, f: 0.6 + R() * 2.2 }); return s; })();
  const skyOffset = (cy, z) => (SKY - cy) * U * (0.55 + 0.45 * z);
  function drawStars(t, cy) {
    const a0 = seg(t, 11.4, 13.6) * (1 - seg(t, 21.2, 23.0));
    if (a0 <= 0) return;
    for (const s of STARS) {
      const y = s.y * H * 1.1 - H * 0.05 + skyOffset(cy, s.z);
      if (y < -10 || y > H + 10) continue;
      const tw = 0.55 + 0.45 * Math.sin(t * s.f + s.ph) * Math.sin(t * s.f * 0.37 + s.ph * 2);
      const a = a0 * tw * (0.35 + 0.65 * s.z);
      ctx.fillStyle = white(a); ctx.beginPath(); ctx.arc(s.x * W, y, s.r * (DPR > 1 ? 0.8 : 1), 0, TAU); ctx.fill();
      if (s.r > 1.6) glowDot(s.x * W, y, s.r * 5, a * 0.35);
    }
  }

  /* ---------------- fall and splash */
  const horizonY = () => H * 0.36;
  const heroBase = () => H * 0.955;
  function landY(p, cy) { return lerp(horizonY() + H * 0.03, heroBase() - H * 0.05, p.land) - cy * U; }
  function symbolPos(p, t, cy) {
    const flo = Math.sin(t * 0.55 + p.ph) * U * 0.006;
    let x = p.x, y = p.y + skyOffset(cy, p.z) + flo, r = 0;
    if (t > p.tf) {
      const yS = p.y + skyOffset(camY(p.tl), p.z), yL = landY(p, camY(p.tl));
      const g = (yL - yS) / Math.pow(p.tl - p.tf, 2);
      const d = t - p.tf;
      y = p.y + skyOffset(cy, p.z) + g * d * d;
      x = p.x + p.vx * W * d;
      r = p.spin * Math.pow(d / (p.tl - p.tf), 1.5);
    }
    return [x, y, r];
  }
  function drawSplash(x, y, size, d, a, seed) {
    if (d < 0 || d > 1.3) return;
    const s = size, k = 1 - d / 1.3;
    ctx.strokeStyle = white(a * k); ctx.lineWidth = LW * 0.8;
    // ripples
    for (let i = 0; i < 2; i++) {
      const dd = d - i * 0.18; if (dd <= 0) continue;
      const rx = s * (0.25 + 1.6 * eout(clamp(dd / 1.1))), ry = rx * 0.16;
      ctx.globalAlpha = (1 - seg(dd, 0.2, 1.1)); ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, TAU); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    // crown and droplets
    const n = 9;
    for (let i = 0; i < n; i++) {
      const h1 = hash(seed * 13 + i), h2 = hash(seed * 7 + i * 3);
      const ang = -Math.PI / 2 + (i / (n - 1) - 0.5) * 2.2 + (h1 - 0.5) * 0.3;
      const v = s * (1.6 + h2 * 1.8), g = s * 7;
      const px = x + Math.cos(ang) * v * d * 0.8, py = y + Math.sin(ang) * v * d + g * d * d;
      const vx = Math.cos(ang) * v * 0.8, vy = Math.sin(ang) * v + 2 * g * d, n2 = Math.hypot(vx, vy) || 1;
      if (py > y + 2) continue;
      ctx.strokeStyle = white(a * k); ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px - vx / n2 * s * 0.18, py - vy / n2 * s * 0.18); ctx.stroke();
    }
  }

  /* ---------------- DNA helix */
  const HELIX = (() => { const R = rng(31), P = []; const pairs = [['A', 'T'], ['T', 'A'], ['G', 'C'], ['C', 'G']]; for (let i = 0; i < 12; i++) { const pr = pairs[Math.floor(R() * 4)]; P.push({ a: pr[0], b: pr[1], ra: R(), rb: R(), rc: R(), rd: R() }); } return P; })();
  function helixBox() {
    const landscape = W > H * 1.05;
    if (landscape) { const len = Math.min(W * 0.5, U * 0.95), r = U * 0.08; return [W / 2 - len / 2, H * 0.5 - r * 1.3, len, r * 2.6, 1]; }
    const len = Math.min(H * 0.5, U * 1.2), r = Math.min(W * 0.13, U * 0.17); return [W / 2 - r * 1.3, H * 0.47 - len / 2, r * 2.6, len, 0];
  }
  function drawHelix(t, cy) {
    if (t < T.helix[0] - 0.5 || t > T.land[1] + 1) return;
    const [bx, by, bw, bh, horiz] = helixBox();
    const off = skyOffset(cy, 1);
    const cx = bx + bw / 2, cyy = by + bh / 2 + off;
    const len = horiz ? bw : bh, rad = (horiz ? bh : bw) / 2.6;
    const N = HELIX.length, rot = (t - 15) * 1.05 + Math.max(0, t - 19.2) * 2.5;
    const squeeze = 1 - 0.12 * ss(seg(t, 19.1, T.boom));
    const mk = (u, side) => { // u in [0,1] along axis
      const ph = u * TAU * 1.55 + rot + (side ? Math.PI * 0.78 : 0), r = rad * squeeze;
      const along = (u - 0.5) * len, across = Math.cos(ph) * r, depth = Math.sin(ph);
      return horiz ? [cx + along, cyy + across, depth] : [cx + across, cyy + along, depth];
    };
    const form = seg(t, T.helix[0], T.helix[0] + 1.6), lines = seg(t, T.helix[0] + 0.9, T.helix[1]), boom = t - T.boom;
    const fs = Math.max(14, SU * 0.032);
    if (boom < 0) {
      // backbones
      ctx.lineWidth = LW;
      for (const side of [0, 1]) {
        const P = []; for (let i = 0; i <= 120; i++) P.push(mk(i / 120, side));
        for (let i = 1; i < P.length; i++) {
          const a = (0.3 + 0.7 * (P[i][2] * 0.5 + 0.5)) * clamp(lines * 1.4 - (i / P.length) * 0.4);
          if (a <= 0) continue;
          ctx.strokeStyle = white(a); ctx.beginPath(); ctx.moveTo(P[i - 1][0], P[i - 1][1]); ctx.lineTo(P[i][0], P[i][1]); ctx.stroke();
        }
      }
      // rungs, letters, node stars
      HELIX.forEach((bp, i) => {
        const u = (i + 0.5) / N, p = mk(u, 0), q = mk(u, 1);
        const app2 = seg(form, i / N * 0.6, i / N * 0.6 + 0.4);
        glowDot(p[0], p[1], 10, app2 * (1 - lines) * 0.9); glowDot(q[0], q[1], 10, app2 * (1 - lines) * 0.9);
        const la = clamp(lines * 1.6 - 0.4 - i / N * 0.3);
        if (la <= 0) return;
        const m1 = [lerp(p[0], q[0], 0.3), lerp(p[1], q[1], 0.3)], m2 = [lerp(p[0], q[0], 0.7), lerp(p[1], q[1], 0.7)];
        ctx.strokeStyle = white(la * 0.55); ctx.lineWidth = LW * 0.8;
        ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(m1[0], m1[1]); ctx.moveTo(m2[0], m2[1]); ctx.lineTo(q[0], q[1]); ctx.stroke();
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        for (const [pt, L, d] of [[m1, bp.a, p[2]], [m2, bp.b, q[2]]]) {
          const sc = 0.75 + 0.25 * (d * 0.5 + 0.5);
          ctx.font = `${fs * sc}px ${FT}`; ctx.fillStyle = white(la * (0.45 + 0.55 * (d * 0.5 + 0.5)));
          ctx.fillText(L, pt[0], pt[1]);
        }
      });
    } else {
      // Explosion: letters fly apart, then fall with everything else
      const flash = Math.exp(-boom * 5);
      if (boom < 1.4) {
        for (const [dl, al] of [[0, 0.75], [0.12, 0.35]]) {
          const b2 = boom - dl; if (b2 <= 0) continue;
          const r = U * (0.03 + 1.1 * eout(clamp(b2 / 1.3)));
          ctx.strokeStyle = white(al * (1 - seg(b2, 0.1, 1.3))); ctx.lineWidth = LW * (1.6 - b2);
          ctx.beginPath(); ctx.ellipse(cx, cyy, r, r * (horiz ? 0.62 : 1.5), 0, 0, TAU); ctx.stroke();
        }
        glowDot(cx, cyy, U * 0.12, flash * 0.9);
      }
      HELIX.forEach((bp, i) => {
        const u = (i + 0.5) / N;
        [[bp.a, 0, bp.ra, bp.rb], [bp.b, 1, bp.rc, bp.rd]].forEach(([L, side, r1, r2]) => {
          const p0 = mk(u, side), mid = [lerp(p0[0], cx, 0.0), lerp(p0[1], cyy, 0.0)];
          let dx = mid[0] - cx + (r1 - 0.5) * U * 0.2, dy = mid[1] - cyy + (r2 - 0.5) * U * 0.2; const n = Math.hypot(dx, dy) || 1; dx /= n; dy /= n;
          const dist = U * (0.25 + r1 * 0.45) * (1 - Math.exp(-boom * 2.6));
          let x = mid[0] + dx * dist, y = mid[1] + dy * dist;
          // fall into the sea
          const tf = T.fall[1] - 0.3 + r2 * 0.4, tl = T.land[0] + 0.2 + r1 * (T.land[1] - T.land[0] - 0.3);
          let rotz = (r2 - 0.5) * 6 * (1 - Math.exp(-boom * 1.5));
          if (t > tf) {
            const yAt = c => mid[1] - skyOffset(cy, 1) + skyOffset(c, 1) + dy * U * (0.25 + r1 * 0.45);
            const yS = yAt(camY(tl)), yL = lerp(horizonY() + H * 0.05, heroBase() - H * 0.12, r2) - camY(tl) * U;
            const g = (yL - yS) / Math.pow(tl - tf, 2), d = t - tf;
            y += g * d * d;
            if (t > tl) { drawSplash(x, yL - camY(t) * U + camY(tl) * U, fs, t - tl, 1, i * 2 + side); return; }
          }
          ctx.save(); ctx.translate(x, y); ctx.rotate(rotz);
          ctx.font = `${fs * 1.5}px ${FT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillStyle = '#fff'; ctx.fillText(L, 0, 0);
          ctx.restore();
        });
        // backbone fragments
        const fa = 1 - seg(boom, 0.2, 1.4);
        if (fa > 0) {
          for (const side of [0, 1]) {
            const pa = mk(u - 0.5 / N, side), pb = mk(u + 0.5 / N, side), m = [(pa[0] + pb[0]) / 2, (pa[1] + pb[1]) / 2];
            let dx = m[0] - cx, dy = m[1] - cyy; const n = Math.hypot(dx, dy) || 1; dx /= n; dy /= n;
            const dist = U * (0.15 + hash(i * 5 + side) * 0.5) * (1 - Math.exp(-boom * 3));
            const rr = (hash(i * 9 + side) - 0.5) * 3 * boom;
            ctx.save(); ctx.translate(m[0] + dx * dist, m[1] + dy * dist); ctx.rotate(rr);
            ctx.strokeStyle = white(fa * 0.8); ctx.lineWidth = LW;
            ctx.beginPath(); ctx.moveTo(pa[0] - m[0], pa[1] - m[1]); ctx.quadraticCurveTo(0, 0, pb[0] - m[0], pb[1] - m[1]); ctx.stroke();
            ctx.restore();
          }
        }
      });
    }
  }

  function drawSymbols(t, cy) {
    if (t < T.sym[0] - 1 || t > T.land[1] + 1.5) return;
    layoutSymbols();
    for (const p of placed) {
      const st = t - p.ta;
      if (st < -2.2) continue;
      const [x, y, r] = symbolPos(p, t, cy);
      if (t > p.tl) { drawSplash(x, landY(p, cy), p.fs * (p.s.s === 'L' || p.s.s === 'D' ? 0.8 : 1.1), t - p.tl, 0.9, p.i); continue; }
      if (y < -p.h || y > H + p.h) continue;
      // star that becomes the symbol
      const starA = seg(t, 11.6, 13.6) * (1 - seg(st, 0.25, 0.9));
      if (starA > 0) {
        const flare = Math.sin(seg(st, -0.35, 0.55) * Math.PI);
        glowDot(x, y, 10 + flare * 26, starA * (0.55 + 0.45 * flare));
        if (flare > 0.02) { ctx.strokeStyle = white(flare * 0.6); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x - 22 * flare, y); ctx.lineTo(x + 22 * flare, y); ctx.moveTo(x, y - 22 * flare); ctx.lineTo(x, y + 22 * flare); ctx.stroke(); }
      }
      if (st <= 0) continue;
      const wp = eio(seg(st, 0, p.s.dr ? 1.6 : 1.1)), fp = ss(seg(st, 0.75, 1.5));
      const sc = 1 + 0.06 * (1 - eout(seg(st, 0, 1.2)));
      ctx.save(); ctx.translate(x, y); ctx.rotate(r); ctx.scale(sc, sc);
      ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left'; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      if (p.s.eq) drawEq(p.m, wp, fp, p.fs);
      else if (p.s.tx) {
        ctx.font = `${p.fs}px ${FONTS[p.s.f]}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        writeText(mode => (mode === 'fill' ? ctx.fillText(p.s.tx, 0, 0) : ctx.strokeText(p.s.tx, 0, 0)), wp, fp, p.fs);
      } else drawDiagram(p.s.dr, p.fs, wp, t);
      ctx.restore();
    }
  }

  /* ================================================================== SEA AND SURF */
  // A plunging breaker in local units of its height (y up). p: 0 swell → 0.35 lip throws → 0.66 tube → crash.
  function waveGeom(p, t) {
    const hf = p < 0.32 ? 0.35 + 0.65 * eio(p / 0.32) : p < 0.69 ? 1 : 1 - 0.8 * eio(seg(p, 0.69, 1));
    const steep = eio(seg(p, 0.06, 0.36)), s = eio(seg(p, 0.3, 0.68));
    const R = 0.42 * hf, cx = (0.06 + 0.16 * s) * hf, cy = hf - R, sweep = Math.PI * 1.08 * s;
    const backL = 2.1;
    const back = [];
    for (let i = 0; i <= 28; i++) { const u = i / 28; back.push([-backL + (backL + cx) * u, hf * Math.pow(Math.sin(u * Math.PI / 2), 2.4) + 0.012 * Math.sin(u * 9 + t * 1.3) * (1 - u)]); }
    // lip: a tightening arc from the crest, thick at the crest and thin at the tip
    const outer = [], inner = [], n = 26;
    for (let i = 0; i <= n; i++) {
      const k = i / n, a = Math.PI / 2 - sweep * k, r = R * (1 - 0.18 * k * s);
      const th = (0.17 * hf) * Math.pow(1 - k, 0.9) * clamp((s - 0.04) * 3.2) + 0.003;
      outer.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
      inner.push([cx + Math.cos(a) * (r - th), cy + Math.sin(a) * (r - th)]);
    }
    // face: from under the crest, hollowing out into a tube, down to the trough
    const top = inner[0];
    const tubeCtl = [top, [cx - 0.13 * hf, 0.66 * hf], [cx - 0.1 * hf, 0.36 * hf], [cx + 0.02 * hf, 0.13 * hf], [cx + 0.3 * hf, 0.015 * hf], [cx + 0.55 * hf, 0]];
    const frontCtl = [[cx, hf], [cx + 0.2 * lerp(2.4, 0.9, steep) * hf, 0.62 * hf], [cx + 0.45 * lerp(2.4, 0.9, steep) * hf, 0.22 * hf], [cx + 0.8 * lerp(2.4, 0.9, steep) * hf, 0.03 * hf], [cx + lerp(2.4, 0.9, steep) * hf, 0]];
    const tube = resample(crc(tubeCtl, 8), 30), front = resample(crc(frontCtl, 8), 30);
    const face = tube.map((q, i) => [lerp(front[i][0], q[0], s), lerp(front[i][1], q[1], s)]);
    const baseX = face[face.length - 1][0];
    return { hf, s, R, cx, cy, back, outer, inner, face, baseX, tip: outer[n] };
  }
  function offsetPath(P, d) { // offset a polyline to its left (in screen space) by d
    return P.map((q, i) => { const a = P[Math.max(0, i - 1)], b = P[Math.min(P.length - 1, i + 1)]; let tx = b[0] - a[0], ty = b[1] - a[1]; const n = Math.hypot(tx, ty) || 1; return [q[0] + ty / n * d, q[1] - tx / n * d]; });
  }
  function drawWave(o) {
    const { x0, base, h, p, t, a, detail, seed, dur } = o;
    if (p < 0 || p > 1.3 || a <= 0) return;
    const g = waveGeom(clamp(p), t);
    const S = q => [x0 + q[0] * h, base - q[1] * h];
    const body = clamp(1 - seg(p, 0.76, 0.98));
    const outerPath = g.back.concat(g.outer.slice(1)).map(S);                 // back → crest → over the lip → tip
    const innerPath = g.face.slice().reverse().concat(g.inner.slice(1)).map(S); // trough → face → under the lip → tip
    const backBase = S([-2.1, 0]), faceBase = S([g.baseX, 0]);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    // the body of the wave, and the tube, hide what is behind them
    const bodyPoly = outerPath.concat(innerPath.slice().reverse(), [[faceBase[0], base + 2], [backBase[0], base + 2]]);
    ctx.fillStyle = '#000'; poly(bodyPoly, true); ctx.fill();
    if (g.s > 0.02) { poly(innerPath.concat([[S(g.tip)[0], base], [faceBase[0], base]]), true); ctx.fill(); }
    if (body > 0) {
      if (detail > 0) {
        // contour lines inside the water, following the face and wrapping into the lip
        ctx.save(); poly(bodyPoly, true); ctx.clip();
        const gap = h * 0.055;
        for (let k = 1; k <= 7; k++) {
          const L = offsetPath(innerPath, gap * k * (1 + k * 0.08));
          const al = a * body * detail * (0.62 - k * 0.06) * (0.25 + 0.75 * seg(g.s, 0.12, 0.5));
          if (al <= 0) continue;
          ctx.strokeStyle = white(al); ctx.lineWidth = LW * (0.95 - k * 0.06);
          // break the lines up a little so they read as drawn
          const n2 = L.length; let st = null;
          for (let i = 0; i < n2; i++) {
            const on = noise1(i * 0.35 + k * 7.3 + seed) > 0.18;
            if (on && st === null) st = i;
            if ((!on || i === n2 - 1) && st !== null) { if (i - st > 2) path(L.slice(st, i + 1)); st = null; }
          }
        }
        // a few lines down the back
        for (let k = 1; k <= 3; k++) {
          const L = offsetPath(outerPath.slice(0, 29), -gap * k * 1.3).slice(6, 27);
          ctx.strokeStyle = white(a * body * detail * (0.35 - k * 0.07)); ctx.lineWidth = LW * 0.7; path(L);
        }
        ctx.restore();
        // inside the tube: the far wall curling away
        if (g.s > 0.45) {
          ctx.save(); poly(innerPath.concat([[S(g.tip)[0], base], [faceBase[0], base]]), true); ctx.clip();
          for (let k = 1; k <= 3; k++) {
            ctx.strokeStyle = white(a * body * detail * 0.28 * seg(g.s, 0.45, 0.9) * (1 - k * 0.22)); ctx.lineWidth = LW * 0.6;
            path(offsetPath(innerPath, -h * 0.05 * k).slice(8));
          }
          ctx.restore();
        }
      }
      const dis = seg(p, 0.68, 0.92);
      // after the crash the outline breaks apart into fragments of water
      const broken = (P, w8, k0) => {
        if (dis <= 0) { path(P); return; }
        const R2 = resample(P, 160); let st = null;
        for (let i = 0; i < R2.length; i++) {
          const on = noise1(i * 0.22 + k0 + p * 30) > dis * 0.95;
          if (on && st === null) st = i;
          if ((!on || i === R2.length - 1) && st !== null) { if (i - st > 1) path(R2.slice(st, i + 1)); st = null; }
        }
        void w8;
      };
      ctx.strokeStyle = white(a * body); ctx.lineWidth = LW * (1.15 + 0.55 * detail); broken(outerPath, 1, seed);
      ctx.lineWidth = LW * (1.0 + 0.35 * detail); broken(innerPath, 1, seed + 50);
    }
    // water surface in front of the wave
    ctx.strokeStyle = white(a * 0.75); ctx.lineWidth = LW * (0.8 + 0.3 * detail);
    ctx.beginPath(); ctx.moveTo(faceBase[0], base); for (let x = faceBase[0]; x < W + 20; x += 10) ctx.lineTo(x, base + Math.sin(x * 0.03 + t * 2 + seed) * 1.1); ctx.stroke();
    // spray blown back off the crest
    const feather = seg(p, 0.2, 0.36) * (1 - seg(p, 0.62, 0.74));
    if (feather > 0 && detail > 0.3) {
      ctx.lineWidth = LW * 0.6;
      for (let i = 0; i < 34; i++) {
        const ph = (t * (0.55 + hash(seed + i) * 0.5) + hash(seed * 3 + i)) % 1;
        const ox = g.cx - hash(i + seed * 7) * 0.22, oy = g.hf * (1 - Math.pow(Math.max(0, g.cx - ox), 2) * 1.2) + 0.01;
        const px = ox - ph * (0.35 + hash(i * 3 + seed) * 0.45), py = oy + ph * (0.16 + 0.08 * hash(i)) - ph * ph * 0.04;
        const P = S([px, py]); ctx.strokeStyle = white(a * feather * (1 - ph) * 0.85);
        ctx.beginPath(); ctx.moveTo(P[0], P[1]); ctx.lineTo(P[0] + h * 0.035, P[1] + h * 0.006); ctx.stroke();
      }
    }
    // droplets thrown from the lip
    if (g.s > 0.08 && p < 0.74 && detail > 0.3) {
      for (let i = 0; i < 22; i++) {
        const k = 0.35 + 0.65 * hash(seed + i * 1.7), j = Math.floor(k * (g.outer.length - 1)), pt = g.outer[j];
        const ph = (t * 1.1 + hash(i * 2 + seed)) % 1;
        const P = S([pt[0] + ph * 0.1 * (0.5 + hash(i)), pt[1] + ph * 0.07 - ph * ph * 0.16]);
        ctx.fillStyle = white(a * (1 - ph) * 0.9); ctx.beginPath(); ctx.arc(P[0], P[1], Math.max(0.7, LW * 0.75 * (1 - ph * 0.6)), 0, TAU); ctx.fill();
      }
    }
    // the crash: spray, spit from the tube, rolling whitewater
    if (p > 0.66) {
      const tau = (p - 0.66) * dur, imp = S([g.tip[0], 0]);
      ctx.lineWidth = LW * 0.9;
      for (let i = 0; i < 90 * detail; i++) {
        const ang = -Math.PI * (0.2 + 0.55 * hash(seed + i * 3.3)), v = h * (1.2 + 2.0 * hash(seed + i * 5.1)), d = tau * (0.85 + 0.3 * hash(i)) - hash(i * 1.7) * 0.25;
        if (d > 1.7 || d < 0) continue;
        const px = imp[0] + Math.cos(ang) * v * d * 0.8 + h * 0.35 * d, py = imp[1] + Math.sin(ang) * v * d + h * 1.5 * d * d;
        const vx = Math.cos(ang) * v * 0.8 + h * 0.35, vy = Math.sin(ang) * v + 3 * h * d, nn = Math.hypot(vx, vy) || 1;
        if (py > base) continue;
        ctx.strokeStyle = white(a * (1 - d / 1.7));
        ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px - vx / nn * h * (0.04 + 0.06 * hash(i * 2.3)), py - vy / nn * h * (0.04 + 0.06 * hash(i * 2.3))); ctx.stroke();
        if (i % 2) { ctx.fillStyle = white(a * (1 - d / 1.7)); ctx.beginPath(); ctx.arc(px + vx / nn * 4, py + vy / nn * 4, Math.max(0.7, LW * 0.6), 0, TAU); ctx.fill(); }
      }
      if (tau < 0.9 && detail > 0.5) {
        const tc = S([g.cx - 0.02, g.hf * 0.36]);
        for (let i = 0; i < 14; i++) {
          const d = tau * (1.2 + hash(i * 7 + seed)), px = tc[0] + d * h * 2.2, py = tc[1] + (hash(i + seed) - 0.5) * h * 0.18 + d * d * h * 0.5;
          ctx.strokeStyle = white(a * (1 - tau / 0.9)); ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px - h * 0.14, py - h * 0.008); ctx.stroke();
        }
      }
      drawFoam(imp[0], base, h, tau, a * (1 - seg(tau, 2.4, 3.6)), seed, t);
      // streaks of foam on the surface in front
      ctx.lineWidth = LW * 0.7;
      for (let i = 0; i < 16; i++) {
        const k = hash(seed + i * 5.9), x1 = imp[0] + (k - 0.2) * h * 1.6 + tau * h * 0.3, y1 = base - 3 - hash(i * 3.1 + seed) * h * 0.05, ln = h * (0.06 + 0.16 * hash(i + seed * 2));
        ctx.strokeStyle = white(a * (1 - seg(tau, 2.4, 3.6)) * 0.6 * seg(tau, 0.3, 0.9)); ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 + ln, y1 + 1); ctx.stroke();
      }
    }
  }
  // Whitewater after a wave crashes: a low band of churning froth running forward on the water
  function drawFoam(x, base, h, tau, a, seed, t) {
    if (a <= 0 || tau <= 0) return;
    const grow = eout(clamp(tau / 1.1)), settle = 1 - 0.65 * seg(tau, 1.2, 3.4);
    const x1 = x - h * (0.25 + 0.4 * grow), x2 = x + h * (0.3 + 0.8 * grow) + tau * h * 0.32;
    const env = u => Math.pow(Math.sin(Math.PI * clamp(u)), 0.8) * (0.1 + 0.22 * grow) * settle * (0.75 + 0.25 * noise1(u * 6 + seed));
    const top = []; for (let i = 0; i <= 60; i++) { const u = i / 60; top.push([lerp(x1, x2, u), base - env(u) * h]); }
    ctx.fillStyle = '#000'; poly(top.concat([[x2, base + 2], [x1, base + 2]]), true); ctx.fill();
    const step = Math.floor(t * 12); // the froth flickers like boiling water
    ctx.lineWidth = LW * 0.75;
    for (let i = 0; i < 70; i++) {
      const hs = seed * 13 + i * 7.1 + (i % 3 === 0 ? step * 0.37 : 0);
      const u = hash(hs), v = Math.pow(hash(hs + 1.3), 0.7), X = lerp(x1, x2, u) + tau * h * 0.05 * hash(hs + 2);
      const Y = base - env(u) * h * v, ln = h * (0.02 + 0.05 * hash(hs + 3)) * (1 - v * 0.5);
      ctx.strokeStyle = white(a * (0.35 + 0.65 * v));
      ctx.beginPath(); ctx.moveTo(X, Y); ctx.quadraticCurveTo(X + ln * 0.5, Y - ln * 0.25 * (hash(hs + 4) - 0.3), X + ln, Y); ctx.stroke();
    }
    ctx.strokeStyle = white(a * 0.9); ctx.lineWidth = LW * 0.9;
    let on = false; ctx.beginPath();
    top.forEach((q, i) => { if (noise1(i * 0.5 + seed + step * 0.05) > 0.3) { if (!on) { ctx.moveTo(q[0], q[1]); on = true; } else ctx.lineTo(q[0], q[1]); } else on = false; });
    ctx.stroke();
    for (let i = 0; i < 40; i++) {
      const ph = (t * 0.8 + hash(i + seed)) % 1, u = hash(seed + i * 1.3), X = lerp(x1, x2, u) + ph * h * 0.06, Y = base - env(u) * h - ph * h * 0.16 * grow + ph * ph * h * 0.09;
      ctx.fillStyle = white(a * (1 - ph) * 0.85); ctx.beginPath(); ctx.arc(X, Y, Math.max(0.7, LW * 0.55), 0, TAU); ctx.fill();
    }
  }
  // Clouds of smoke: only the outer outline of a group of circles, plus a few inner folds
  function drawCloud(circles, a, folds, lw = 2.2) {
    if (a <= 0 || !circles.length) return;
    ctx.lineWidth = LW * lw; ctx.strokeStyle = white(a);
    for (const c of circles) { ctx.beginPath(); ctx.arc(c[0], c[1], c[2], 0, TAU); ctx.stroke(); }
    ctx.fillStyle = '#000';
    for (const c of circles) { ctx.beginPath(); ctx.arc(c[0], c[1], c[2], 0, TAU); ctx.fill(); }
    if (folds) {
      ctx.lineWidth = LW * 0.7; ctx.strokeStyle = white(a * 0.38);
      circles.forEach((c, i) => { if (i % 2) return; ctx.beginPath(); ctx.arc(c[0] + c[2] * 0.12, c[1] + c[2] * 0.14, c[2] * 0.7, Math.PI * 1.08, Math.PI * 1.6); ctx.stroke(); if (i % 4 === 0) { ctx.beginPath(); ctx.arc(c[0] - c[2] * 0.25, c[1] + c[2] * 0.3, c[2] * 0.35, Math.PI * 1.15, Math.PI * 1.75); ctx.stroke(); } });
    }
  }
  function drawSea(t, cy) {
    const a = seg(t, 21.6, 23.4) * (1 - seg(t, 30.8, 32.6));
    if (a <= 0) return;
    const off = -cy * U;
    ctx.save(); ctx.translate(0, off);
    const hy = horizonY(), hb = heroBase();
    ctx.lineCap = 'round';
    // horizon
    ctx.strokeStyle = white(a * 0.7); ctx.lineWidth = LW * 0.8; ctx.beginPath(); ctx.moveTo(0, hy); ctx.lineTo(W, hy); ctx.stroke();
    // swell lines broken into crests, closer together toward the horizon
    const K = 22;
    for (let k = 0; k < K; k++) {
      const d = Math.pow((k + 1) / K, 2.1), y0 = hy + (hb - hy) * d * 0.78;
      const amp = 0.6 + d * 7, f = 0.004 / (0.25 + d), sp = 0.08 + d * 0.5;
      ctx.lineWidth = LW * (0.5 + d * 0.7); ctx.strokeStyle = white(a * (0.2 + 0.65 * d));
      let on = false; ctx.beginPath();
      for (let x = -10; x <= W + 10; x += 5) {
        const n = noise1(x * f + t * sp + k * 17.3), y = y0 + Math.sin(x * f * 6 + t * (0.6 + d) + k) * amp * 0.5 - (n > 0.6 ? (n - 0.6) * amp * 2.2 : 0);
        if (n > 0.48) { if (!on) { ctx.moveTo(x, y); on = true; } else ctx.lineTo(x, y); } else on = false;
      }
      ctx.stroke();
    }
    // mid-distance breakers
    const hh = Math.min(H * 0.42, W * 0.62);
    const midBase = hy + (hb - hy) * 0.42;
    [[0.05, 0.31, 0.0], [0.62, 0.27, 2.9], [0.32, 0.22, 5.3]].forEach(([fx, sc, off2], i) => {
      const dur = 7.5, p = ((t + off2) % dur) / dur;
      drawWave({ x0: W * fx + p * W * 0.12, base: midBase - i * H * 0.02, h: hh * sc, p, t, a: a * 0.75, detail: 0.35, seed: 50 + i * 11 + Math.floor((t + off2) / dur), dur });
    });
    // the big ones
    const w2p = (t - T.wave2[0]) / T.wave2[1];
    drawWave({ x0: W * 0.02 + (t - T.wave2[0]) * W * 0.045, base: hb - H * 0.12, h: hh * 0.62, p: w2p, t, a: a * 0.9, detail: 0.7, seed: 7, dur: T.wave2[1] });
    ctx.restore();
  }
  function drawHero(t, cy) {
    const a = seg(t, 21.6, 23.4) * (1 - seg(t, 30.8, 32.6));
    if (a <= 0) return;
    ctx.save(); ctx.translate(0, -cy * U);
    const hh = Math.min(H * 0.42, W * 0.62), w1p = (t - T.wave1[0]) / T.wave1[1];
    drawWave({ x0: W * (W > H ? 0.18 : 0.12) + (t - T.wave1[0]) * W * 0.04, base: heroBase(), h: hh, p: w1p, t, a, detail: 1, seed: 3, dur: T.wave1[1] });
    ctx.restore();
  }

  /* ================================================================== F-117A NIGHTHAWK (faceted 3D model, metres) */
  // Body axes: x forward, y starboard, z up. Nose at x = +10.05, tail tips at x = -10.04 (length 20.09 m), span 13.21 m.
  const JET = (() => {
    const V = {};
    const v = (n, x, y, z) => { V[n] = [x, y, z]; if (y !== 0) V[n + '_'] = [x, -y, z]; };
    v('n0', 10.05, 0, 0); v('le1', 4.6, 2.26, 0); v('lm', -1.0, 4.58, 0); v('wt', -5.9, 6.605, 0); v('wtt', -7.25, 6.605, 0); v('ten', -4.6, 3.35, 0);
    v('ex', -8.65, 2.45, 0.05); v('ec', -8.45, 0, 0.1);
    v('r1', 6.9, 0, 0.55); v('cb1', 5.9, 0.55, 0.62); v('c1', 5.0, 0, 1.05); v('c2', 2.7, 0, 1.12); v('cb2', 2.1, 0.72, 0.85);
    v('s1', 6.4, 1.05, 0.32); v('s2', 1.4, 1.62, 0.6); v('s3', -3.4, 1.78, 0.58); v('s4', -6.7, 1.55, 0.36); v('s5', -8.6, 2.2, 0.2);
    v('d1', 1.5, 0, 1.08); v('k1', 1.2, 0.92, 0.98); v('d2', -3.0, 0, 1.0); v('k2', -3.2, 1.0, 0.9); v('d3', -6.6, 0, 0.62); v('k3', -6.6, 0.95, 0.55); v('d4', -8.4, 0, 0.32);
    v('b1', 6.4, 0, -0.42); v('bs1', 5.0, 1.3, -0.32); v('b2', 0.5, 0, -0.9); v('bs2', -0.8, 2.2, -0.55); v('b3', -6.0, 0, -0.78); v('bs3', -6.0, 2.05, -0.45); v('b4', -8.4, 0, -0.2);
    v('rf', -4.9, 0.95, 0.88); v('rr', -8.0, 0.98, 0.5); v('tr', -10.04, 2.6, 1.98); v('tf', -7.9, 2.5, 2.0);
    const F = [];
    const f = (hint, ...ns) => { F.push({ hint, v: ns }); if (ns.some(n => V[n + '_'])) F.push({ hint, v: ns.map(n => (V[n + '_'] ? n + '_' : n)).reverse() }); };
    // upper
    f('U', 'n0', 'r1', 's1'); f('U', 'n0', 's1', 'le1'); f('U', 'r1', 'c1', 'cb1'); f('U', 'cb1', 'c1', 'c2', 'cb2'); f('U', 'r1', 'cb1', 's1');
    f('U', 's1', 'cb1', 'cb2', 's2'); f('U', 'c2', 'd1', 'k1', 'cb2'); f('U', 'cb2', 'k1', 's2');
    f('U', 'd1', 'd2', 'k2', 'k1'); f('U', 'd2', 'd3', 'k3', 'k2'); f('U', 'k3', 'd3', 'd4', 's5', 's4');
    f('U', 'k1', 'k2', 's3', 's2'); f('U', 'k2', 'k3', 's4', 's3');
    f('U', 'le1', 's1', 's2', 'lm'); f('U', 'lm', 's2', 's3', 'ten', 'wtt', 'wt'); f('U', 'ten', 's3', 's4', 's5', 'ex'); f('U', 's5', 'd4', 'ec', 'ex');
    // lower
    f('L', 'n0', 'le1', 'bs1', 'b1'); f('L', 'b1', 'bs1', 'bs2', 'b2'); f('L', 'b2', 'bs2', 'bs3', 'b3'); f('L', 'b3', 'bs3', 'ex', 'ec', 'b4');
    f('L', 'le1', 'lm', 'bs2', 'bs1'); f('L', 'lm', 'wt', 'wtt', 'ten', 'bs3', 'bs2'); f('L', 'ten', 'ex', 'bs3');
    // V-tail (two-sided)
    f('T', 'rf', 'tf', 'tr', 'rr');
    // edge → faces map, for heavier silhouette lines
    const E = new Map();
    F.forEach((fc, i) => fc.v.forEach((n, j) => { const m = fc.v[(j + 1) % fc.v.length], k = n < m ? n + '|' + m : m + '|' + n; if (!E.has(k)) E.set(k, []); E.get(k).push(i); }));
    return { V, F, E };
  })();
  const M3 = {
    mul: (a, b) => { const r = []; for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) r[i * 3 + j] = a[i * 3] * b[j] + a[i * 3 + 1] * b[3 + j] + a[i * 3 + 2] * b[6 + j]; return r; },
    rx: a => { const c = Math.cos(a), s = Math.sin(a); return [1, 0, 0, 0, c, -s, 0, s, c]; },
    ry: a => { const c = Math.cos(a), s = Math.sin(a); return [c, 0, s, 0, 1, 0, -s, 0, c]; },
    rz: a => { const c = Math.cos(a), s = Math.sin(a); return [c, -s, 0, s, c, 0, 0, 0, 1]; },
    toQ(m) {
      const tr = m[0] + m[4] + m[8]; let w, x, y, z;
      if (tr > 0) { const S = Math.sqrt(tr + 1) * 2; w = 0.25 * S; x = (m[7] - m[5]) / S; y = (m[2] - m[6]) / S; z = (m[3] - m[1]) / S; }
      else if (m[0] > m[4] && m[0] > m[8]) { const S = Math.sqrt(1 + m[0] - m[4] - m[8]) * 2; w = (m[7] - m[5]) / S; x = 0.25 * S; y = (m[1] + m[3]) / S; z = (m[2] + m[6]) / S; }
      else if (m[4] > m[8]) { const S = Math.sqrt(1 + m[4] - m[0] - m[8]) * 2; w = (m[2] - m[6]) / S; x = (m[1] + m[3]) / S; y = 0.25 * S; z = (m[5] + m[7]) / S; }
      else { const S = Math.sqrt(1 + m[8] - m[0] - m[4]) * 2; w = (m[3] - m[1]) / S; x = (m[2] + m[6]) / S; y = (m[5] + m[7]) / S; z = 0.25 * S; }
      return [w, x, y, z];
    },
    fromQ([w, x, y, z]) { return [1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w), 2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w), 2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]; },
    slerp(a, b, t) {
      let d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3]; if (d < 0) { b = b.map(v => -v); d = -d; }
      if (d > 0.9995) { const r = a.map((v, i) => lerp(v, b[i], t)), n = Math.hypot(...r); return r.map(v => v / n); }
      const th = Math.acos(d), s = Math.sin(th); return a.map((v, i) => (Math.sin((1 - t) * th) * v + Math.sin(t * th) * b[i]) / s);
    }
  };
  // Views: body → view (X right, Y up, Z into the screen)
  const R_PLAN = [-1, 0, 0, 0, 1, 0, 0, 0, -1];   // from above, nose left, starboard up
  const R_SIDE = [-1, 0, 0, 0, 0, 1, 0, 1, 0];    // from port, nose left
  const R_FRONT = [0, -1, 0, 0, 0, 1, -1, 0, 0];  // from the front
  // proj: { cx, cy, k (px per metre at the model centre), D (camera distance, m) }
  function drawJet(R, pr, opt = {}) {
    const { V, F, E } = JET, P = {}, Q = {};
    for (const n in V) {
      const [x, y, z] = V[n];
      const X = R[0] * x + R[1] * y + R[2] * z, Y = R[3] * x + R[4] * y + R[5] * z, Z = R[6] * x + R[7] * y + R[8] * z;
      const s = pr.k * pr.D / (pr.D + Z);
      Q[n] = [X, Y, Z]; P[n] = [pr.cx + X * s, pr.cy - Y * s, Z];
    }
    const vis = F.map(fc => {
      const a = Q[fc.v[0]], b = Q[fc.v[1]], c = Q[fc.v[2]];
      let nx = (b[1] - a[1]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[1] - a[1]), ny = (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]), nz = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
      if (fc.hint === 'T') return true;
      const hz = fc.hint === 'U' ? 1 : -1, hv = [R[2] * hz, R[5] * hz, R[8] * hz];
      if (nx * hv[0] + ny * hv[1] + nz * hv[2] < 0) { nx = -nx; ny = -ny; nz = -nz; }
      const cxm = fc.v.reduce((s, n) => s + Q[n][0], 0) / fc.v.length, cym = fc.v.reduce((s, n) => s + Q[n][1], 0) / fc.v.length, czm = fc.v.reduce((s, n) => s + Q[n][2], 0) / fc.v.length;
      return nx * cxm + ny * cym + nz * (czm + pr.D) < 0;
    });
    const order = F.map((fc, i) => i).filter(i => vis[i]).sort((i, j) => {
      const d = k => F[k].v.reduce((s, n) => s + Q[n][2], 0) / F[k].v.length; return d(j) - d(i);
    });
    const lw = opt.lw || LW, a = opt.a == null ? 1 : opt.a;
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    for (const i of order) {
      const fc = F[i];
      ctx.fillStyle = '#000'; poly(fc.v.map(n => P[n]), true); ctx.fill();
      fc.v.forEach((n, j) => {
        const m = fc.v[(j + 1) % fc.v.length], key = n < m ? n + '|' + m : m + '|' + n, adj = E.get(key);
        const sil = fc.hint === 'T' || adj.length < 2 || adj.some(k => !vis[k]);
        ctx.strokeStyle = white(a * (sil ? 1 : 0.62)); ctx.lineWidth = sil ? lw * 1.45 : lw * 0.75;
        ctx.beginPath(); ctx.moveTo(P[n][0], P[n][1]); ctx.lineTo(P[m][0], P[m][1]); ctx.stroke();
      });
    }
    return P;
  }

  /* ---------------- flight across the sky, then into the drawing */
  function flightState(t) {
    const u = eout(seg(t, ...T.plane));
    const land = W > H * 1.05;
    const cx = lerp(W * 1.12, W * (land ? 0.36 : 0.42), u), cy = lerp(horizonY() - H * 0.06, H * (land ? 0.17 : 0.2), eio(seg(t, T.plane[0], T.plane[1])));
    const k = lerp(U * 0.0035, U * 0.021, Math.pow(u, 1.4));
    const yaw = lerp(0.62, 0.28, u), belly = lerp(0.42, 0.74, u), bank = Math.sin(t * 0.7) * 0.04 + lerp(0.1, -0.06, u);
    // base: side view from port, nose left; turn the nose toward the viewer, tilt to show the underside, bank
    const R = M3.mul(M3.rx(belly), M3.mul(M3.ry(yaw), M3.mul(M3.rz(bank), R_SIDE)));
    return { R, pr: { cx, cy, k, D: 55 } };
  }
  function drawLayout() {
    const land = W > H * 1.05, m = Math.max(14, U * 0.022);
    if (land) {
      const k = Math.min(W * 0.44 / 20.09, H * 0.46 / 13.21);
      return { land, m, k, plan: [W * 0.37, H * 0.39], side: [W * 0.37, H * 0.8], front: [W * 0.8, H * 0.39] };
    }
    const k = Math.min(W * 0.78 / 20.09, H * 0.24 / 13.21);
    return { land, m, k, plan: [W * 0.5, H * 0.27], side: [W * 0.5, H * 0.53], front: [W * 0.5, H * 0.69] };
  }
  function drawJetScene(t) {
    if (t < T.plane[0] || t > T.smoke[1]) return;
    const L = drawLayout();
    const mp = eio(seg(t, ...T.morph));
    // zoom into the cockpit detail at the end
    const zp = seg(t, ...T.zoom), Z = Math.exp(Math.pow(zp, 2.2) * Math.log(9));
    const det = detailPoint(L);
    ctx.save();
    if (Z > 1.0001) { ctx.translate(det[0], det[1]); ctx.scale(Z, Z); ctx.translate(-det[0], -det[1]); }
    const lw = LW / Math.sqrt(Z);
    if (mp < 1) {
      const fs = flightState(Math.min(t, T.morph[0]));
      const R = M3.fromQ(M3.slerp(M3.toQ(fs.R), M3.toQ(R_PLAN), mp));
      const pr = { cx: lerp(fs.pr.cx, L.plan[0], mp), cy: lerp(fs.pr.cy, L.plan[1], mp), k: Math.exp(lerp(Math.log(fs.pr.k), Math.log(L.k), mp)), D: Math.exp(lerp(Math.log(fs.pr.D), Math.log(9000), mp)) };
      drawJet(R, pr, { lw });
    } else {
      drawTechnical(t, L, lw, Z);
    }
    ctx.restore();
  }
  function detailPoint(L) { return [L.side[0] - 5.4 * L.k, L.side[1] - 0.95 * L.k]; }

  /* ---------------- technical drawing */
  const DIM = { len: '20.09 m  [65′ 11″]', span: '13.21 m  [43′ 4″]', ht: '3.78 m  [12′ 5″]' };
  function txt(s, x, y, size, a, align = 'center', base = 'middle', rot = 0, font = FD) {
    if (a <= 0) return;
    ctx.save(); ctx.translate(x, y); if (rot) ctx.rotate(rot);
    ctx.font = `500 ${size}px ${font}`; ctx.fillStyle = white(a); ctx.textAlign = align; ctx.textBaseline = base;
    if ('letterSpacing' in ctx) ctx.letterSpacing = `${size * 0.08}px`;
    ctx.fillText(s, 0, 0); if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
    ctx.restore();
  }
  function arrowHead(x, y, ang, s, a) { ctx.fillStyle = white(a); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - Math.cos(ang - 0.28) * s, y - Math.sin(ang - 0.28) * s); ctx.lineTo(x - Math.cos(ang + 0.28) * s, y - Math.sin(ang + 0.28) * s); ctx.closePath(); ctx.fill(); }
  function dimLine(x1, y1, x2, y2, off, label, p, lw, fsz) {
    if (p <= 0) return;
    const ang = Math.atan2(y2 - y1, x2 - x1), nx = -Math.sin(ang), ny = Math.cos(ang);
    const a1 = [x1 + nx * off, y1 + ny * off], a2 = [x2 + nx * off, y2 + ny * off];
    const ext = Math.sign(off) * 6;
    ctx.strokeStyle = white(0.75 * p); ctx.lineWidth = lw * 0.7;
    path([[x1 + nx * Math.sign(off) * 4, y1 + ny * Math.sign(off) * 4], [a1[0] + nx * ext, a1[1] + ny * ext]], 0, p);
    path([[x2 + nx * Math.sign(off) * 4, y2 + ny * Math.sign(off) * 4], [a2[0] + nx * ext, a2[1] + ny * ext]], 0, p);
    const mid = [(a1[0] + a2[0]) / 2, (a1[1] + a2[1]) / 2], e = eio(p);
    const b1 = [lerp(mid[0], a1[0], e), lerp(mid[1], a1[1], e)], b2 = [lerp(mid[0], a2[0], e), lerp(mid[1], a2[1], e)];
    ctx.strokeStyle = white(0.9 * p); ctx.beginPath(); ctx.moveTo(b1[0], b1[1]); ctx.lineTo(b2[0], b2[1]); ctx.stroke();
    if (p > 0.6) { const aa = seg(p, 0.6, 0.9); arrowHead(b1[0], b1[1], ang + Math.PI, fsz * 0.75, aa); arrowHead(b2[0], b2[1], ang, fsz * 0.75, aa); }
    let ra = ang; if (ra > Math.PI / 2 || ra < -Math.PI / 2) ra += Math.PI;
    txt(label, mid[0] + nx * Math.sign(off) * fsz * 0.9, mid[1] + ny * Math.sign(off) * fsz * 0.9, fsz, seg(p, 0.7, 1), 'center', 'middle', ra);
  }
  // Dimensions with extension lines from the real extreme points to a dimension line at a fixed position
  function dimAxis(p1, p2, at, vertical, label, p, lw, fsz, textSide = 1) {
    if (p <= 0) return;
    const gapE = 5, over = 7;
    ctx.strokeStyle = white(0.7 * p); ctx.lineWidth = lw * 0.6;
    for (const q of [p1, p2]) {
      if (vertical) { const dir = Math.sign(at - q[0]) || 1; path([[q[0] + dir * gapE, q[1]], [at + dir * over, q[1]]], 0, p); }
      else { const dir = Math.sign(at - q[1]) || 1; path([[q[0], q[1] + dir * gapE], [q[0], at + dir * over]], 0, p); }
    }
    const A = vertical ? [at, p1[1]] : [p1[0], at], B = vertical ? [at, p2[1]] : [p2[0], at];
    const mid = [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2], e = eio(p);
    const a1 = [lerp(mid[0], A[0], e), lerp(mid[1], A[1], e)], b1 = [lerp(mid[0], B[0], e), lerp(mid[1], B[1], e)];
    ctx.strokeStyle = white(0.9 * p); ctx.lineWidth = lw * 0.7; ctx.beginPath(); ctx.moveTo(a1[0], a1[1]); ctx.lineTo(b1[0], b1[1]); ctx.stroke();
    const ang = Math.atan2(B[1] - A[1], B[0] - A[0]);
    if (p > 0.6) { const aa = seg(p, 0.6, 0.9); arrowHead(a1[0], a1[1], ang + Math.PI, fsz * 0.75, aa); arrowHead(b1[0], b1[1], ang, fsz * 0.75, aa); }
    if (vertical) txt(label, at + textSide * fsz * 0.95, mid[1], fsz, seg(p, 0.7, 1), 'center', 'middle', textSide > 0 ? Math.PI / 2 : -Math.PI / 2);
    else txt(label, mid[0], at + textSide * fsz * 0.95, fsz, seg(p, 0.7, 1));
  }
  function drawTechnical(t, L, lw, Z) {
    const d = t - T.draw[0], k = L.k, fsz = clamp(U * 0.0165, 9.5, 14);
    const P = drawJet(R_PLAN, { cx: L.plan[0], cy: L.plan[1], k, D: 9000 }, { lw });
    // sheet border with zone marks
    const bp = eio(seg(d, 0, 1.2)), m = L.m;
    ctx.strokeStyle = white(0.85); ctx.lineWidth = lw * 1.2;
    path([[m, m], [W - m, m], [W - m, H - m], [m, H - m], [m, m]], 0, bp);
    ctx.lineWidth = lw * 0.6;
    path([[m + 10, m + 10], [W - m - 10, m + 10], [W - m - 10, H - m - 10], [m + 10, H - m - 10], [m + 10, m + 10]], 0, bp);
    const zA = seg(d, 0.8, 1.6);
    if (zA > 0) {
      const nz = L.land ? 8 : 4, nzy = L.land ? 6 : 8;
      for (let i = 1; i < nz; i++) { const x = lerp(m + 10, W - m - 10, i / nz); ctx.strokeStyle = white(zA * 0.6); ctx.beginPath(); ctx.moveTo(x, m); ctx.lineTo(x, m + 10); ctx.moveTo(x, H - m - 10); ctx.lineTo(x, H - m); ctx.stroke(); }
      for (let i = 1; i < nzy; i++) { const y = lerp(m + 10, H - m - 10, i / nzy); ctx.beginPath(); ctx.moveTo(m, y); ctx.lineTo(m + 10, y); ctx.moveTo(W - m - 10, y); ctx.lineTo(W - m, y); ctx.stroke(); }
      for (let i = 0; i < nz; i++) { const x = lerp(m + 10, W - m - 10, (i + 0.5) / nz); txt(String(nz - i), x, m + 5.5, 8, zA * 0.7); txt(String(nz - i), x, H - m - 4.5, 8, zA * 0.7); }
      for (let i = 0; i < nzy; i++) { const y = lerp(m + 10, H - m - 10, (i + 0.5) / nzy); txt('ABCDEFGH'[i], m + 5.5, y, 8, zA * 0.7); txt('ABCDEFGH'[i], W - m - 5, y, 8, zA * 0.7); }
    }
    // centre lines
    const cl = seg(d, 0.3, 1.3);
    ctx.setLineDash([16, 4, 3, 4]); ctx.strokeStyle = white(0.55); ctx.lineWidth = lw * 0.6;
    path([[L.plan[0] - 11.2 * k, L.plan[1]], [L.plan[0] + 11.2 * k, L.plan[1]]], 0, cl);
    ctx.setLineDash([]);
    // side and front elevations, revealed like a plotter
    const reveal = (cx, cy, wv, hv, p, fn) => {
      if (p <= 0) return;
      ctx.save(); ctx.beginPath(); ctx.rect(cx - wv / 2 - 10, cy - hv / 2 - 10, (wv + 20) * eio(p), hv + 20); ctx.clip(); fn(); ctx.restore();
      if (p < 1) { const x = cx - wv / 2 - 10 + (wv + 20) * eio(p); ctx.strokeStyle = white(0.5); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, cy - hv / 2 - 14); ctx.lineTo(x, cy + hv / 2 + 14); ctx.stroke(); }
    };
    const gearZ = -1.8;
    reveal(L.side[0], L.side[1], 21 * k, 4.4 * k, seg(d, 0.6, 2.0), () => {
      drawJet(R_SIDE, { cx: L.side[0], cy: L.side[1], k, D: 9000 }, { lw });
      // landing gear
      ctx.strokeStyle = white(0.85); ctx.lineWidth = lw;
      for (const [gx, z0, r] of [[5.2, -0.4, 0.33], [-1.6, -0.7, 0.42]]) {
        const X = L.side[0] - gx * k, y0 = L.side[1] - z0 * k, y1 = L.side[1] - (gearZ + r) * k;
        ctx.beginPath(); ctx.moveTo(X, y0); ctx.lineTo(X, y1); ctx.stroke();
        ctx.beginPath(); ctx.arc(X, y1, r * k, 0, TAU); ctx.stroke(); ctx.beginPath(); ctx.arc(X, y1, r * k * 0.45, 0, TAU); ctx.stroke();
      }
      ctx.strokeStyle = white(0.45); ctx.setLineDash([2, 4]); ctx.beginPath(); ctx.moveTo(L.side[0] - 11 * k, L.side[1] - gearZ * k); ctx.lineTo(L.side[0] + 11 * k, L.side[1] - gearZ * k); ctx.stroke(); ctx.setLineDash([]);
    });
    reveal(L.front[0], L.front[1], 14 * k, 4.4 * k, seg(d, 1.1, 2.4), () => {
      drawJet(R_FRONT, { cx: L.front[0], cy: L.front[1], k, D: 9000 }, { lw });
      ctx.strokeStyle = white(0.85); ctx.lineWidth = lw;
      for (const [gy, z0, r] of [[0, -0.4, 0.33], [1.9, -0.7, 0.42], [-1.9, -0.7, 0.42]]) {
        const X = L.front[0] - gy * k, y0 = L.front[1] - z0 * k, y1 = L.front[1] - (gearZ + r) * k;
        ctx.beginPath(); ctx.moveTo(X, y0); ctx.lineTo(X, y1 - r * k); ctx.stroke();
        ctx.strokeRect(X - 0.13 * k, y1 - r * k, 0.26 * k, 2 * r * k);
      }
    });
    // dimensions
    const cxp = L.plan[0], cyp = L.plan[1], cxs = L.side[0], cys = L.side[1], cxf = L.front[0], cyf = L.front[1];
    dimAxis([cxp - 10.05 * k, cyp], [cxp + 10.04 * k, cyp - 2.6 * k], cyp - 6.605 * k - fsz * 2.4, false, DIM.len, seg(d, 1.6, 2.6), lw, fsz, -1);
    dimAxis([cxp + 7.25 * k, cyp - 6.605 * k], [cxp + 7.25 * k, cyp + 6.605 * k], cxp + 10.04 * k + fsz * 3, true, DIM.span, seg(d, 1.9, 2.9), lw, fsz, 1);
    dimAxis([cxs + 10.04 * k, cys - 1.98 * k], [cxs + 9.0 * k, cys - gearZ * k], cxs + 10.04 * k + fsz * 3, true, DIM.ht, seg(d, 2.3, 3.2), lw, fsz, 1);
    dimAxis([cxf - 6.605 * k, cyf], [cxf + 6.605 * k, cyf], cyf - gearZ * k + fsz * 2.4, false, DIM.span, seg(d, 2.6, 3.5), lw, fsz, 1);
    // leading-edge sweep, on the port wing: reference line square to the centreline, and the 67.5° between it and the edge
    const sw = seg(d, 2.8, 3.8);
    if (sw > 0) {
      const le = [L.plan[0] + 4.0 * k, L.plan[1] + (10.05 - 4.0) * Math.tan(22.5 * Math.PI / 180) * k];
      void le;
      const lx = L.plan[0] - 4.0 * k, ly = L.plan[1] + (10.05 - 4.0) * Math.tan(22.5 * Math.PI / 180) * k;
      ctx.strokeStyle = white(0.55 * sw); ctx.lineWidth = lw * 0.6; ctx.setLineDash([5, 4]);
      path([[lx, ly], [lx, ly + 3.6 * k]], 0, sw); ctx.setLineDash([]);
      const r = 2.8 * k, a0 = Math.PI / 2, a1 = a0 - (67.5 * Math.PI / 180) * eio(sw);
      ctx.strokeStyle = white(0.85 * sw); ctx.lineWidth = lw * 0.7;
      ctx.beginPath(); ctx.arc(lx, ly, r, a1, a0, false); ctx.stroke();
      if (sw > 0.5) { arrowHead(lx + Math.cos(a1) * r, ly + Math.sin(a1) * r, a1 - Math.PI / 2, fsz * 0.6, seg(sw, 0.5, 0.8)); }
      const am = (a0 + a1) / 2;
      txt('67.5°', lx + Math.cos(am) * (r + fsz * 1.9), ly + Math.sin(am) * (r + fsz * 1.2), fsz, seg(sw, 0.6, 1));
    }
    // callouts
    const co = seg(d, 3.2, 4.4);
    const callout = (px, py, tx2, ty2, label, align, i) => {
      const p = seg(co, i * 0.15, i * 0.15 + 0.5); if (p <= 0) return;
      ctx.strokeStyle = white(0.7 * p); ctx.lineWidth = lw * 0.6;
      ctx.fillStyle = white(p); ctx.beginPath(); ctx.arc(px, py, 2.2, 0, TAU); ctx.fill();
      path([[px, py], [tx2, ty2], [tx2 + (align === 'left' ? 1 : -1) * fsz * 1.2, ty2]], 0, p);
      txt(label, tx2 + (align === 'left' ? 1 : -1) * fsz * 1.6, ty2, fsz * 0.92, seg(p, 0.6, 1), align, 'middle');
    };
    callout(P.le1[0] - 1.8 * k, (P.le1[1] + P.n0[1]) / 2 - 0.2 * k, L.plan[0] - 9 * k, L.plan[1] - 4.6 * k, 'FACETED SURFACES', 'right', 0);
    callout(L.plan[0] + 4.6 * k, L.plan[1] - 3.35 * k, L.plan[0] + 0.6 * k, L.plan[1] - 5.4 * k, 'W-SHAPED TRAILING EDGE', 'right', 1);
    callout(P.tf[0] + 0.3 * k, P.tf[1], L.plan[0] + 7.0 * k, L.plan[1] - 5.3 * k, 'RUDDERVATORS', 'left', 2);
    callout(L.plan[0] + 8.55 * k, L.plan[1] + 1.6 * k, L.plan[0] + 6.4 * k, L.plan[1] + 8.1 * k, 'PLATYPUS EXHAUST', 'left', 3);
    // view titles
    const vt = seg(d, 2.0, 3.0), under = (x, y, s) => { txt(s, x, y, fsz * 1.05, vt); ctx.strokeStyle = white(vt * 0.8); ctx.lineWidth = lw * 0.7; ctx.beginPath(); ctx.moveTo(x - s.length * fsz * 0.33, y + fsz * 0.85); ctx.lineTo(x + s.length * fsz * 0.33, y + fsz * 0.85); ctx.stroke(); };
    under(L.plan[0], L.plan[1] + 6.605 * k + fsz * 3.2, 'PLAN');
    under(L.side[0], L.side[1] + 2.4 * k + fsz * 2.2, 'SIDE ELEVATION');
    under(L.front[0], L.front[1] - gearZ * k + fsz * 5.2, 'FRONT ELEVATION');
    // detail circle around the cockpit
    const dc = seg(d, 4.2, 5.0);
    if (dc > 0) {
      const dp = detailPoint(L), r = 1.9 * k;
      ctx.strokeStyle = white(0.9); ctx.lineWidth = lw * 0.8; ctx.setLineDash([10, 4, 2, 4]);
      ctx.beginPath(); ctx.arc(dp[0], dp[1], r, -Math.PI / 2, -Math.PI / 2 + TAU * eio(dc)); ctx.stroke(); ctx.setLineDash([]);
      txt('A', dp[0] - r * 0.8, dp[1] - r * 1.05, fsz * 1.3, seg(dc, 0.6, 1), 'center', 'middle', 0, FD);
    }
    // title block
    const tb = seg(d, 3.6, 5.0);
    if (tb > 0 && Z < 3) {
      const bw = Math.min(L.land ? 360 : W - 2 * m - 20, W * 0.4 + (L.land ? 0 : W)), bh = Math.max(84, fsz * 7.2), bx = W - m - 10 - bw, by = H - m - 10 - bh;
      ctx.strokeStyle = white(0.85); ctx.lineWidth = lw * 0.8;
      path([[bx, by + bh], [bx, by], [bx + bw, by]], 0, eio(tb));
      const r1 = by + bh * 0.42, r2 = by + bh * 0.71, c1 = bx + bw * 0.5;
      path([[bx, r1], [bx + bw, r1]], 0, seg(tb, 0.2, 0.6)); path([[bx, r2], [bx + bw, r2]], 0, seg(tb, 0.3, 0.7)); path([[c1, r1], [c1, by + bh]], 0, seg(tb, 0.4, 0.8));
      const ta = seg(tb, 0.5, 1);
      txt('F-117A NIGHTHAWK', bx + 10, by + bh * 0.15, fsz * 1.25, ta, 'left'); txt('GENERAL ARRANGEMENT — THREE VIEW', bx + 10, by + bh * 0.31, fsz * 0.8, ta * 0.8, 'left');
      txt('DRAWN  J. RAGLAND', bx + 10, (r1 + r2) / 2, fsz * 0.8, ta, 'left'); txt('DWG  JR-117-001', c1 + 10, (r1 + r2) / 2, fsz * 0.8, ta, 'left');
      txt('UNITS  m [ft-in]', bx + 10, (r2 + by + bh) / 2, fsz * 0.8, ta, 'left'); txt('SCALE  NTS   SHEET 1/1', c1 + 10, (r2 + by + bh) / 2, fsz * 0.8, ta, 'left');
      // third-angle projection symbol
      const sx = bx + bw - 34, sy = by + bh * 0.2, s = 9;
      if (ta > 0) {
        ctx.strokeStyle = white(ta * 0.9); ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(sx - s * 2.2, sy - s * 0.5); ctx.lineTo(sx - s * 0.8, sy - s * 0.9); ctx.lineTo(sx - s * 0.8, sy + s * 0.9); ctx.lineTo(sx - s * 2.2, sy + s * 0.5); ctx.closePath(); ctx.stroke();
        ctx.beginPath(); ctx.arc(sx + s * 0.8, sy, s * 0.9, 0, TAU); ctx.stroke(); ctx.beginPath(); ctx.arc(sx + s * 0.8, sy, s * 0.45, 0, TAU); ctx.stroke();
      }
    }
  }

  /* ================================================================== ROCKET */
  function rocketPos(t) {
    const p = seg(t, ...T.rocket), rw = Math.min(W * 0.3, H * 0.26), len = rw * 9.6, travel = H + len + rw * 3;
    return { p, rw, len, travel, yTop: H + rw * 0.4 - travel * (0.35 * p + 0.65 * Math.pow(p, 2.2)) };
  }
  function drawRocket(t) {
    const { p, rw, len, yTop } = rocketPos(t);
    if (p <= 0 || p >= 1) return;
    const cx = W / 2 + Math.sin(t * 13) * 2;
    const Y = f => yTop + f * rw, X = f => cx + f * rw;
    ctx.save(); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    const lw = LW * 1.2;
    // plume
    const eng = Y(9.25), fl = rw * (4.5 + 0.6 * Math.sin(t * 57) + 0.4 * Math.sin(t * 31));
    ctx.strokeStyle = '#fff'; ctx.lineWidth = lw;
    for (const [w0, w1, lenK, a] of [[0.55, 1.6, 1, 0.9], [0.4, 0.9, 0.82, 0.8], [0.25, 0.45, 0.6, 1]]) {
      ctx.strokeStyle = white(a);
      ctx.beginPath(); ctx.moveTo(X(-w0), eng); ctx.bezierCurveTo(X(-w1), eng + fl * 0.35 * lenK, X(-w1 * 0.7), eng + fl * 0.8 * lenK, X(0), eng + fl * lenK);
      ctx.bezierCurveTo(X(w1 * 0.7), eng + fl * 0.8 * lenK, X(w1), eng + fl * 0.35 * lenK, X(w0), eng); ctx.stroke();
    }
    for (let i = 0; i < 4; i++) { const y = eng + rw * (0.6 + i * 0.75), w = rw * (0.2 - i * 0.03); ctx.strokeStyle = white(0.85 - i * 0.15); ctx.beginPath(); ctx.moveTo(cx, y - rw * 0.3); ctx.lineTo(cx + w, y); ctx.lineTo(cx, y + rw * 0.3); ctx.lineTo(cx - w, y); ctx.closePath(); ctx.stroke(); }
    glowDot(cx, eng + rw * 0.4, rw * 1.6, 0.9);
    // engine bells
    ctx.fillStyle = '#000'; ctx.lineWidth = lw;
    for (const bx of [-0.33, 0, 0.33]) { ctx.beginPath(); ctx.moveTo(X(bx - 0.1), Y(8.85)); ctx.lineTo(X(bx - 0.17), Y(9.3)); ctx.lineTo(X(bx + 0.17), Y(9.3)); ctx.lineTo(X(bx + 0.1), Y(8.85)); ctx.closePath(); ctx.fill(); ctx.strokeStyle = '#fff'; ctx.stroke(); }
    // fins
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(X(s * 0.5), Y(7.7)); ctx.lineTo(X(s * 0.86), Y(8.6)); ctx.lineTo(X(s * 0.86), Y(9.15)); ctx.lineTo(X(s * 0.5), Y(8.85)); ctx.closePath(); ctx.fill(); ctx.stroke(); }
    // body: first stage, interstage, second stage, adapter, service module, capsule, escape tower
    const body = [[0, 0.95], [0.18, 1.2], [0.35, 1.58], [0.35, 2.15], [0.5, 2.55], [0.5, 4.35], [0.5, 4.65], [0.5, 8.85]];
    ctx.beginPath(); body.forEach(([x, y], i) => (i ? ctx.lineTo(X(x), Y(y)) : ctx.moveTo(X(x), Y(y)))); for (let i = body.length - 1; i >= 0; i--) ctx.lineTo(X(-body[i][0]), Y(body[i][1])); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.lineWidth = lw * 0.6;
    for (const yy of [1.58, 2.15, 2.55, 3.4, 4.35, 4.65, 5.6, 7.8, 8.85]) { const w = yy < 2.2 ? 0.35 : 0.5; ctx.beginPath(); ctx.moveTo(X(-w), Y(yy)); ctx.lineTo(X(w), Y(yy)); ctx.stroke(); }
    for (const xx of [-0.25, 0, 0.25]) { ctx.strokeStyle = white(0.45); ctx.beginPath(); ctx.moveTo(X(xx), Y(4.65)); ctx.lineTo(X(xx), Y(8.85)); ctx.stroke(); }
    ctx.strokeStyle = '#fff';
    // roll-pattern panels (hatched)
    for (const [y0, y1, side] of [[5.6, 6.7, -1], [6.7, 7.8, 1], [2.55, 3.4, 1]]) {
      ctx.save(); ctx.beginPath(); ctx.rect(side < 0 ? X(-0.5) : X(0), Y(y0), rw * 0.5, (y1 - y0) * rw); ctx.clip();
      ctx.strokeStyle = white(0.5); ctx.lineWidth = lw * 0.5;
      for (let k = -2; k < 14; k++) { ctx.beginPath(); ctx.moveTo(X(-0.6), Y(y0) + k * rw * 0.12); ctx.lineTo(X(0.6), Y(y0) + k * rw * 0.12 - rw * 0.6); ctx.stroke(); }
      ctx.restore();
    }
    ctx.lineWidth = lw * 0.6;
    for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(X(-0.24 + i * 0.16), Y(1.85), rw * 0.03, 0, TAU); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(X(-0.06), Y(0.95)); ctx.lineTo(X(-0.06), Y(0.1)); ctx.lineTo(X(0.06), Y(0.1)); ctx.lineTo(X(0.06), Y(0.95)); ctx.stroke();
    for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(X(-0.06), Y(0.95 - i * 0.21)); ctx.lineTo(X(0.06), Y(0.74 - i * 0.21)); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(X(0), Y(-0.25)); ctx.lineTo(X(0.08), Y(0.1)); ctx.lineTo(X(-0.08), Y(0.1)); ctx.closePath(); ctx.fill(); ctx.stroke();
    // speed lines
    ctx.strokeStyle = white(0.55); ctx.lineWidth = 1;
    for (let i = 0; i < 18; i++) { const x = cx + (hash(i * 3.3) - 0.5) * rw * 5, ln = rw * (2 + hash(i * 7.7) * 4), y = yTop + hash(i * 1.9) * len * 1.2; if (Math.abs(x - cx) < rw * 0.95) continue; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + ln); ctx.stroke(); }
    ctx.restore();
  }
  function drawSmoke(t) {
    if (t < T.smoke[0] || t > T.smoke[1]) return;
    const { rw, yTop, travel } = rocketPos(t);
    const exhaust = yTop + 9.3 * rw, big = Math.max(W, H);
    const circles = [];
    for (let i = 0; i < 90; i++) {
      const v = hash(i * 1.37), y0 = H * (1.08 - v * 1.2), side = hash(i * 7.1) - 0.5;
      // when did the engines pass this height?
      let born = null;
      for (let k = 0; k <= 40; k++) { const tt = lerp(T.rocket[0], T.rocket[1], k / 40); if (rocketPos(tt).yTop + 9.3 * rw < y0) { born = tt; break; } }
      if (born === null || t < born) continue;
      const g = eout(seg(t, born, born + 2.1)), drift = Math.sin(t * 0.8 + i) * 6;
      const cx = W / 2 + side * rw * 1.1 + side * big * 0.75 * g + drift, cy = y0 + rw * 0.3 - g * big * 0.05 * (0.5 + hash(i * 2.3));
      circles.push([cx, cy, rw * 0.32 + big * (0.05 + 0.13 * hash(i * 3.9)) * g]);
    }
    void exhaust; void travel;
    const fade = 1 - seg(t, 42.0, 43.1);
    drawCloud(circles, fade, true, 1.8);
  }
  /* ================================================================== FRAME */
  function render(t) {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    const shake = seg(t, 39.7, 40.2) * (1 - seg(t, 41.0, 41.8));
    if (shake > 0) ctx.translate((hash(Math.floor(t * 60)) - 0.5) * 14 * shake, (hash(Math.floor(t * 60) + 7) - 0.5) * 14 * shake);
    const cy = camY(t);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    drawRabbit(t, cy);
    drawStars(t, cy);
    drawSea(t, cy);
    drawSymbols(t, cy);
    drawHelix(t, cy);
    drawHero(t, cy);
    // plane in the sky over the surf, then the drawing
    drawJetScene(t);
    drawSmoke(t);
    drawRocket(t);
  }

  /* ================================================================== CLOCK */
  let fontsReady = 0;
  const families = ['STIX Two Math', 'STIX Two Text', 'Noto Sans Egyptian Hieroglyphs', 'Noto Sans Cuneiform', 'Noto Music', 'Noto Sans Mayan Numerals', 'Noto Sans Phoenician', 'Noto Sans Runic', 'Noto Serif Devanagari', 'Noto Naskh Arabic', 'Noto Serif Hebrew', 'Noto Serif SC', 'IBM Plex Sans Condensed', 'IBM Plex Mono'];
  const fontLoads = families.map(f => (document.fonts ? document.fonts.load(`40px "${f}"`, f.includes('Egyptian') ? '𓂀' : f.includes('Cuneiform') ? '𒀭' : f.includes('Music') ? '𝄞' : f.includes('Mayan') ? '𝋠' : f.includes('Phoenician') ? '𐤀' : f.includes('Runic') ? 'ᚠ' : f.includes('Devanagari') ? 'ज' : f.includes('Arabic') ? 'ع' : f.includes('Hebrew') ? 'ח' : f.includes('SC') ? '知' : f.includes('Math') ? '∮' : 'A').then(() => { fontsReady++; layoutKey = ''; }).catch(() => {}) : Promise.resolve()));
  const params = new URLSearchParams(location.search);
  let frozen = params.has('t') ? parseFloat(params.get('t')) || 0 : null;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  if (frozen !== null) {
    Promise.all(fontLoads).then(() => { layoutKey = ''; render(frozen); document.documentElement.dataset.ready = '1'; });
    window.__seek = s => { frozen = s; render(s); };
    return;
  }
  let t = -0.3, last = performance.now(), slow = 0, frames = 0;
  function tick(now) {
    const raw = (now - last) / 1000, dt = Math.min(0.05, raw); last = now;
    // if this device struggles, draw at standard resolution so the motion stays smooth
    if (document.visibilityState === 'visible' && raw < 0.5) { frames++; if (raw > 0.026) slow++; if (frames >= 90) { if (slow > 45 && dprCap > 1) { dprCap = 1; resize(); } frames = slow = 0; } }
    if (reduce.matches) render(11.4);
    else { t += dt; if (t >= T.LOOP) t -= T.LOOP; render(Math.max(0, t)); }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
})();
