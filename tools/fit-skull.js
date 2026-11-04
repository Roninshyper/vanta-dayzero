/* Finds where the skull sits inside the statue's head: turn, tilt, centre and size, by fitting skull landmarks against the head's skin points (the nose tip, brow and chin
   must sit just under the skin; the vault, back and sides a little way inside it; nothing may poke out).   run: node tools/fit-skull.js */
const fs = require('fs');
global.window = {}; require('../david-model.js');
const DM = window.DAVID_MODEL, bin = Buffer.from(DM.data, 'base64'), PHI = 22 * Math.PI / 180, cp = Math.cos(PHI), sp = Math.sin(PHI);
const skin = [];
for (let i = 0; i < DM.n; i++) {
  const o = i * 10, y = bin.readUInt16LE(o + 2) / 10; if (y > 540 || y < 120 || !bin[o + 9]) continue;
  const x = bin.readUInt16LE(o) / 10 + 600, z = bin.readUInt16LE(o + 4) / 10 - 400, nx = bin.readInt8(o + 6) / 127, nz = bin.readInt8(o + 8) / 127;
  skin.push([x * cp - z * sp, y, x * sp + z * cp, nx * cp - nz * sp, bin.readInt8(o + 7) / 127, nx * sp + nz * cp]);
}
const sub = skin.filter((_, i) => i % 3 === 0), CELL = 14, grid = new Map(), key = (a, b, c) => a + ',' + b + ',' + c;
sub.forEach((p, i) => { const k = key(Math.floor(p[0] / CELL), Math.floor(p[1] / CELL), Math.floor(p[2] / CELL)); (grid.get(k) || grid.set(k, []).get(k)).push(i); });
function nearest(x, y, z) {
  const cx = Math.floor(x / CELL), cy = Math.floor(y / CELL), cz = Math.floor(z / CELL); let best = -1, bd = 1e9;
  for (let r = 1; r <= 4 && best < 0; r++) for (let a = -r; a <= r; a++) for (let b = -r; b <= r; b++) for (let c = -r; c <= r; c++) {
    const l = grid.get(key(cx + a, cy + b, cz + c)); if (!l) continue;
    for (const i of l) { const p = sub[i], d = (p[0] - x) ** 2 + (p[1] - y) ** 2 + (p[2] - z) ** 2; if (d < bd) { bd = d; best = i; } }
  }
  return best < 0 ? null : { p: sub[best], d: Math.sqrt(bd) };
}
const head = skin.filter(p => p[1] > 160 && p[1] < 480), mean = i => head.reduce((a, p) => a + p[i], 0) / head.length;
const START = { yaw: 28 * Math.PI / 180, pit: 6 * Math.PI / 180, cx: mean(0), cy: 300, cz: mean(2), s: 1.35 };
console.log('head centre of skin points', START.cx.toFixed(0), START.cz.toFixed(0), 'n', head.length);

// the landmarks, in head millimetres (x to the left of the face, y down, z forward)
const faceLM = [{ p: [0, 36, 86], t: 9 }, { p: [0, -2, 82], t: 7 }, { p: [0, 118, 50], t: 8 }, { p: [34, 14, 70], t: 12 }, { p: [-34, 14, 70], t: 12 }, { p: [66, 24, -14], t: 6 }, { p: [-66, 24, -14], t: 6 }, { p: [56, 36, 46], t: 9 }, { p: [-56, 36, 46], t: 9 }, { p: [0, 92, 56], t: 8 }];       // nose tip, brow, chin, the two orbits: target depth under the skin, in pixels
const vault = []; let sd = 5; const rnd = () => { sd = (sd * 16807) % 2147483647; return sd / 2147483647; };
for (let i = 0; i < 160; i++) { const u = rnd() * 6.2832, v = Math.acos(1 - rnd() * 2), x = Math.sin(v) * Math.cos(u), y = -Math.cos(v), z = Math.sin(v) * Math.sin(u); if (z > 0.6) continue; vault.push([x * 76, -18 + y * 84, -10 + z * 98]); }
const place = (P, q) => { const cy_ = Math.cos(q.yaw), sy_ = Math.sin(q.yaw), cpt = Math.cos(q.pit), spt = Math.sin(q.pit), y1 = P[1] * cpt - P[2] * spt, z1 = P[1] * spt + P[2] * cpt, x2 = P[0] * cy_ + z1 * sy_, z2 = -P[0] * sy_ + z1 * cy_; return [q.cx + x2 * q.s, q.cy + y1 * q.s, q.cz + z2 * q.s]; };
function cost(q) {
  let c = 0;
  for (const L of faceLM) { const P = place(L.p, q), n = nearest(P[0], P[1], P[2]); if (!n) { c += 4000; continue; } const sg = (P[0] - n.p[0]) * n.p[3] + (P[1] - n.p[1]) * n.p[4] + (P[2] - n.p[2]) * n.p[5], depth = -sg; c += (depth - L.t) ** 2 * 1.2; }
  for (const V of vault) { const P = place(V, q), n = nearest(P[0], P[1], P[2]); if (!n) { c += 900; continue; } const sg = (P[0] - n.p[0]) * n.p[3] + (P[1] - n.p[1]) * n.p[4] + (P[2] - n.p[2]) * n.p[5], depth = -sg; c += depth < 3 ? (3 - depth) ** 2 * 2 : (depth - 14) ** 2 * 0.05; }
  return c;
}
let best = { ...START }, bc = 1e18;
for (const y0 of [-30, 0, 20, 40, 60, 80]) for (const dz of [-30, 0, 30]) { const q0 = { ...START, yaw: y0 * Math.PI / 180, cz: START.cz + dz }; const c0 = cost(q0); if (c0 < bc) { bc = c0; best = q0; } }
const steps = { yaw: 0.12, pit: 0.06, cx: 14, cy: 14, cz: 14, s: 0.06 };
for (let round = 0; round < 9; round++) {
  for (let it = 0; it < 500; it++) {
    const q = { ...best }; for (const k of Object.keys(steps)) if (rnd() < 0.5) q[k] += (rnd() - 0.5) * 2 * steps[k];
    q.s = Math.max(1.1, Math.min(1.6, q.s)); const c = cost(q); if (c < bc) { bc = c; best = q; }
  }
  for (const k of Object.keys(steps)) steps[k] *= 0.6;
  console.log('round', round, 'cost', bc.toFixed(0));
}
console.log(JSON.stringify({ yawDeg: +(best.yaw * 180 / Math.PI).toFixed(1), pitDeg: +(best.pit * 180 / Math.PI).toFixed(1), cx: +best.cx.toFixed(1), cy: +best.cy.toFixed(1), cz: +best.cz.toFixed(1), s: +best.s.toFixed(3) }));

for (const L of faceLM) { const P = place(L.p, best), n = nearest(P[0], P[1], P[2]); const sg = (P[0] - n.p[0]) * n.p[3] + (P[1] - n.p[1]) * n.p[4] + (P[2] - n.p[2]) * n.p[5]; console.log('landmark', L.p.join(','), 'depth under skin', (-sg).toFixed(1), 'target', L.t); }
