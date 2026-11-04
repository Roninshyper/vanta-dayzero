/* Sculpts a full anatomical x-ray to sit inside the David bust, from signed-distance shapes and curves, and writes organs-model.js.   run: node tools/bake-anatomy.js
   Everything is placed by anatomical landmarks (the jugular notch, the nipple line, the skull base), so the lungs, heart, ribs, spine and skull land where they would in a body.
   Local anatomy is in millimetres: x to the patient's left (the viewer's right), y down from the jugular notch, z forward.
   Kinds: 12 shoulder and arm bones (only the lens shows them), 0 lung, 1 heart and great vessels, 2 airways and oesophagus, 4 bone, 5 brain, 6 blood vessels (flowing), 7 nerves (flowing). Kinds 6 and 7 carry a path position and phase in the normal bytes. */
const fs = require('fs'), path = require('path');
const sq = v => v * v, clamp = (v, a, b) => v < a ? a : v > b ? b : v, lerp = (a, b, t) => a + (b - a) * t;
const smin = (a, b, k) => { const h = clamp(0.5 + 0.5 * (b - a) / k, 0, 1); return b + (a - b) * h - k * h * (1 - h); }, smax = (a, b, k) => -smin(-a, -b, k);
const sph = (x, y, z, cx, cy, cz, r) => Math.sqrt(sq(x - cx) + sq(y - cy) + sq(z - cz)) - r;
const ell = (x, y, z, cx, cy, cz, rx, ry, rz) => (Math.sqrt(sq((x - cx) / rx) + sq((y - cy) / ry) + sq((z - cz) / rz)) - 1) * Math.min(rx, ry, rz);
const cap = (x, y, z, a, b, r1, r2) => { const px = x - a[0], py = y - a[1], pz = z - a[2], dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], t = clamp((px * dx + py * dy + pz * dz) / (dx * dx + dy * dy + dz * dz), 0, 1); return Math.sqrt(sq(px - dx * t) + sq(py - dy * t) + sq(pz - dz * t)) - (r1 + (r2 - r1) * t); };
const nrm = v => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; }, sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
let sd = 17; const rnd = () => { sd = (sd * 16807) % 2147483647; return sd / 2147483647; };
// an ellipsoid with its own axes (u, v, w unit vectors): for the heart, which lies tilted
const ellF = (x, y, z, c, u, v, w, r) => { const d = [x - c[0], y - c[1], z - c[2]]; return (Math.sqrt(sq(dot(d, u) / r[0]) + sq(dot(d, v) / r[1]) + sq(dot(d, w) / r[2])) - 1) * Math.min(r[0], r[1], r[2]); };

/* ============ the statue's own body, measured from the baked bust: where its back and front are at every height ============ */
global.window = {}; require('../david-model.js');
const DM = window.DAVID_MODEL, dbin = Buffer.from(DM.data, 'base64'), PHI = 22 * Math.PI / 180, cp = Math.cos(PHI), sp = Math.sin(PHI);
const skin = []; for (let i = 0; i < DM.n; i++) { const o = i * 10, x = dbin.readUInt16LE(o) / 10 + 600, z = dbin.readUInt16LE(o + 4) / 10 - 400; skin.push([x * cp - z * sp, dbin.readUInt16LE(o + 2) / 10, x * sp + z * cp, dbin.readInt8(o + 8) / 127]); }   // statue frame: xs, y, zs, normal z
const XC = 960;                                                                  // the body's midline, in the statue frame
const ZB = [[560, 241], [640, 223], [720, 217], [800, 211], [880, 215], [960, 232], [1040, 250]], ZF = [[560, 475], [640, 489], [720, 526], [800, 556], [880, 571], [960, 584], [1040, 590]];
const prof = (T, y) => { if (y <= T[0][0]) return T[0][1]; for (let i = 0; i < T.length - 1; i++) if (y <= T[i + 1][0]) return lerp(T[i][1], T[i + 1][1], (y - T[i][0]) / (T[i + 1][0] - T[i][0])); return T[T.length - 1][1]; };
const YN = 660, KX = 1.4, KY = 1.25;                                             // the jugular notch is at y 660; the nipple line (190 mm lower) lands at about y 898
const mapT = (x, y, z) => { const ys = YN + y * KY, zb = prof(ZB, ys) + 8, zf = prof(ZF, ys) - 18; return [XC + x * KX, ys, zb + (z + 200) / 225 * (zf - zb)]; };
const jacT = y => { const ys = YN + y * KY; return [KX, KY, (prof(ZF, ys) - prof(ZB, ys) - 26) / 225]; };

/* ============ the thorax, in millimetres ============ */
function lungR(x, y, z) {
  let d = ell(x, y, z, -82, 105, -88, 62, 130, 80);
  d = smin(d, ell(x, y, z, -64, -4, -70, 36, 38, 32), 22);                       // the apex, reaching above the collarbone
  d = smax(d, -sph(x, y, z, -86, 332, -92, 120), 14);                            // the base is concave, over the dome of the diaphragm
  d = smax(d, -ell(x, y, z, -8, 100, -72, 34, 112, 60), 14);                     // the inner face against the mediastinum
  d = smax(d, -cap(x, y, z, [-152, 18, -152], [-72, 188, -26], 1.8, 1.8), 2.4);  // oblique fissure
  d = smax(d, -cap(x, y, z, [-152, 96, -60], [-62, 106, -26], 1.6, 1.6), 2.2);   // horizontal fissure: three lobes
  return d;
}
function lungL(x, y, z) {
  let d = ell(x, y, z, 82, 112, -88, 58, 132, 78);
  d = smin(d, ell(x, y, z, 64, -2, -70, 34, 38, 32), 22);
  d = smax(d, -sph(x, y, z, 86, 346, -92, 120), 14);
  d = smax(d, -ell(x, y, z, 8, 100, -72, 34, 112, 60), 14);
  d = smax(d, -ell(x, y, z, 52, 160, -36, 50, 58, 52), 18);                      // the cardiac notch: the heart lies against this lung
  d = smax(d, -cap(x, y, z, [152, 20, -152], [74, 190, -26], 1.8, 1.8), 2.4);    // oblique fissure: two lobes
  return d;
}
const lungs = (x, y, z) => Math.min(lungR(x, y, z), lungL(x, y, z));

const tubes = [];                                                                // airways: [a, b, r1, r2]
tubes.push([[0, -84, -50], [0, 60, -88], 9.5, 9]);                               // the trachea, from the larynx to the carina (about the fourth thoracic vertebra)
tubes.push([[0, -70, -56], [0, 70, -108], 8, 8], [[0, 70, -108], [14, 250, -128], 8, 8]);   // the oesophagus behind it
function branch(a, dir, len, r, depth) {
  const b = [a[0] + dir[0] * len, a[1] + dir[1] * len, a[2] + dir[2] * len]; tubes.push([a, b, r, r * 0.88]);
  if (depth <= 0) return;
  for (let k = 0; k < 3; k++) {
    const sp2 = (k - 1) * 0.8 + (rnd() - 0.5) * 0.35, sz = (rnd() - 0.5) * 0.9, nd = [dir[0] + Math.sign(dir[0] || 1) * 0.12 + sp2 * 0.8, dir[1] * 0.8 + 0.38, dir[2] + sz]; const l = Math.hypot(...nd);
    branch(b, [nd[0] / l, nd[1] / l, nd[2] / l], len * (0.74 + rnd() * 0.1), r * 0.72, depth - 1);
  }
}
branch([0, 60, -88], nrm([-0.82, 0.5, -0.1]), 52, 7.2, 3);                       // right main bronchus: shorter and steeper
branch([0, 60, -88], nrm([0.9, 0.34, -0.1]), 62, 6.6, 3);                        // left main bronchus: longer and flatter
const airways = (x, y, z) => { let d = 1e9; for (const t of tubes) d = Math.min(d, cap(x, y, z, t[0], t[1], t[2], t[3])); return d + 0.9 * Math.sin(y * 0.9) * (Math.abs(x) < 14 && y < 55 && y > -90 ? 1 : 0); };   // cartilage rings on the trachea

// the heart: lies tilted, its apex pointing down, forwards and to the left (the fifth intercostal space), its base back and to the right
const HB = [4, 92, -84], HA = [88, 192, -26], HU = nrm(sub(HA, HB)), HV = nrm(cross([0, 0, 1], HU)), HW = nrm(cross(HU, HV)), HM = [(HB[0] + HA[0]) / 2, (HB[1] + HA[1]) / 2, (HB[2] + HA[2]) / 2];
function heart(x, y, z) {
  let d = ellF(x, y, z, [HM[0] + 14, HM[1] - 4, HM[2] - 8], HU, HV, HW, [60, 34, 32]);       // the left ventricle: the long muscular wall to the left and back
  d = smin(d, ellF(x, y, z, [HM[0] - 22, HM[1] - 2, HM[2] + 14], HU, HV, HW, [52, 34, 26]), 12);   // the right ventricle in front
  d = smin(d, ell(x, y, z, -30, 122, -70, 24, 34, 24), 12);                        // the right atrium
  d = smin(d, ell(x, y, z, 14, 96, -98, 28, 20, 22), 10);                          // the left atrium, at the back
  d = smin(d, cap(x, y, z, [-2, 94, -66], [8, 30, -74], 15, 13), 8);               // the ascending aorta
  d = smin(d, cap(x, y, z, [8, 30, -74], [30, 44, -112], 13, 12), 8);              // the arch, curving back…
  d = smin(d, cap(x, y, z, [30, 44, -112], [28, 80, -124], 12, 11), 8);            // …and down along the spine
  d = smin(d, cap(x, y, z, [12, 100, -22], [10, 64, -70], 11, 9.5), 6);            // the pulmonary trunk
  d = smin(d, cap(x, y, z, [10, 64, -70], [-48, 78, -92], 7.5, 6), 5);             // to the right lung
  d = smin(d, cap(x, y, z, [10, 64, -70], [58, 88, -98], 7.5, 6), 5);              // and to the left
  d = smin(d, cap(x, y, z, [-34, 34, -44], [-34, 112, -64], 8.5, 8), 5);           // the superior vena cava, into the right atrium
  d = smin(d, cap(x, y, z, [-30, 140, -72], [-30, 250, -108], 9, 8.5), 5);         // the inferior vena cava
  for (const sgn of [[-44, 80, -94], [-48, 98, -92], [56, 88, -98], [60, 106, -96]]) d = smin(d, cap(x, y, z, [14, 96, -98], sgn, 4.5, 3.8), 3);     // the pulmonary veins
  for (const c of [[[8, 92, -14], [34, 128, -4], 2.6], [[34, 128, -4], [62, 168, -8], 2.2], [[-14, 100, -24], [-34, 130, -34], 2.8], [[-34, 130, -34], [-26, 166, -50], 2.4]])
    d = smin(d, cap(x, y, z, c[0], c[1], c[2], c[2]), 2);                          // the coronary arteries, in the grooves of the heart
  return d;
}

/* the skeleton of the thorax */
const groups = [];
const ribbon = (x, y, z, a, b, rw, rt) => {                                      // a segment with a flat cross-section: wide up and down, thin front to back
  const tx = b[0] - a[0], ty = b[1] - a[1], tz = b[2] - a[2], L = Math.hypot(tx, ty, tz) || 1, t = [tx / L, ty / L, tz / L], px = x - a[0], py = y - a[1], pz = z - a[2], sS = clamp(px * t[0] + py * t[1] + pz * t[2], 0, L);
  const qx = px - t[0] * sS, qy = py - t[1] * sS, qz = pz - t[2] * sS; let u = [-t[0] * t[1], 1 - t[1] * t[1], -t[2] * t[1]]; const ul = Math.hypot(u[0], u[1], u[2]) || 1; u = [u[0] / ul, u[1] / ul, u[2] / ul];
  const nn = cross(t, u), du = qx * u[0] + qy * u[1] + qz * u[2], dn = qx * nn[0] + qy * nn[1] + qz * nn[2];
  return (Math.sqrt(sq(du / rw) + sq(dn / rt)) - 1) * Math.min(rw, rt);
};
function group(prims, rib, vert) {
  let cx = 0, cy = 0, cz = 0, n = 0; for (const p of prims) for (const q of [p.a || p.c, p.b].filter(Boolean)) { cx += q[0]; cy += q[1]; cz += q[2]; n++; } cx /= n; cy /= n; cz /= n;
  let R = 0; for (const p of prims) { const m = Math.max(p.r1 || 0, p.r2 || 0, ...(p.rr || [0])); for (const q of [p.a || p.c, p.b].filter(Boolean)) R = Math.max(R, Math.hypot(q[0] - cx, q[1] - cy, q[2] - cz) + m + 6); }
  groups.push({ c: [cx, cy, cz], R, prims, rib, vert });
}
const C = (a, b, r1, r2) => ({ t: 0, a, b, r1, r2 }), E = (c, rr) => ({ t: 1, c, rr }), RB = (a, b, rw, rt) => ({ t: 2, a, b, r1: rw, r2: rw, rw, rt });
const zsp = j => j <= 8 ? -105 - 9 * (j - 1) : -177 + 4 * (j - 8);               // where the spine lies at each thoracic level
const AXr = [58, 86, 110, 128, 141, 149, 152, 148, 138, 126, 118, 104], YA = [14, 38, 62, 86, 108, 130, 150, 192, 214, 232, 246, 258];   // each rib: half width, and the height of its front end
const LATD = [28, 42, 56, 68, 78, 86, 92, 92, 90, 86, 80, 74], UEND = [1, 1, 1, 1, 1, 1, 1, 0.86, 0.84, 0.82, 0.5, 0.4];                          // how far each rib drops from the spine to the side of the chest
const ribPoint = (i, side, u) => { const yT = -30 + 22 * (i - 1), zb = zsp(i) - 2, zf = i <= 7 ? 8 : 8 - (i - 7) * 8, az = (zf - zb) / 2, zc = (zf + zb) / 2, th = Math.PI * u * UEND[i - 1]; return [side * (14 + (AXr[i - 1] - 14) * Math.sin(th)), lerp(yT, YA[i - 1], u) + (LATD[i - 1] - (YA[i - 1] - yT) * 0.5) * Math.sin(th), zc - az * Math.cos(th)]; };
for (let i = 1; i <= 12; i++) for (const side of [-1, 1]) {
  const prims = [], K = 26; let prev = null;
  for (let k = 0; k <= K; k++) { const u = 0.05 + 0.92 * k / K, p = ribPoint(i, side, u), rw = u > 0.8 ? 3.6 : u < 0.14 ? 5.5 : 6 - 1.6 * Math.abs(u - 0.5), rt = u > 0.8 ? 2.4 : 2.9; if (prev) prims.push(RB(prev.p, p, (prev.rw + rw) / 2, (prev.rt + rt) / 2)); prev = { p, rw, rt }; }   // an arc from the spine round the side to the sternum, thinning into cartilage
  group(prims, true);
}
group([E([0, 22, 4], [28, 24, 7]), E([0, 98, 6], [16, 52, 6]), C([0, 150, 6], [0, 172, 4], 4.5, 2.5)]);        // the sternum: manubrium, body, xiphoid process
for (let j = 1; j <= 12; j++) { const y = -30 + 22 * (j - 1), z = zsp(j); group([E([0, y, z], [22, 9, 17]), C([0, y, z - 12], [0, y + 14, z - 46], 4.2, 2.6), C([20, y, z - 4], [46, y - 4, z - 16], 5, 3.6), C([-20, y, z - 4], [-46, y - 4, z - 16], 5, 3.6)], false, true); }   // thoracic vertebrae with their spinous and transverse processes
const bonesOf = (want, vw) => (x, y, z) => {
  let d = 1e9;
  for (const g of groups) {
    if (!!g.rib !== want || !!g.vert !== !!vw) continue;
    const dc = Math.hypot(x - g.c[0], y - g.c[1], z - g.c[2]) - g.R; if (dc > 30) { d = Math.min(d, dc); continue; }
    for (const p of g.prims) d = Math.min(d, p.t === 2 ? ribbon(x, y, z, p.a, p.b, p.rw, p.rt) : p.t ? ell(x, y, z, p.c[0], p.c[1], p.c[2], p.rr[0], p.rr[1], p.rr[2]) : cap(x, y, z, p.a, p.b, p.r1, p.r2));
  }
  return d;
};
const thorBones = bonesOf(false), thorRibs = bonesOf(true), thorVerts = bonesOf(false, true);

/* ============ the neck, directly in statue pixels: the cervical spine from the first thoracic vertebra up to the skull base, and the upper airway ============ */
const NECK_TOP = 396, NECK_BASE = 618;
const neckBones = (x, y, z) => {
  let d = 1e9;
  for (let k = 0; k < 7; k++) {
    const u = k / 6, cy = lerp(NECK_TOP, NECK_BASE, u), cz = lerp(338, 272, u) + 14 * Math.sin(Math.PI * u), cx = XC - 4, sc = lerp(0.8, 1, u);
    if (Math.abs(y - cy) > 60) continue;
    d = Math.min(d, ell(x, y, z, cx, cy, cz, 25 * sc, 12, 19 * sc), cap(x, y, z, [cx, cy, cz - 12], [cx, cy + 12, cz - 38], 5, 3), cap(x, y, z, [cx + 22 * sc, cy, cz - 2], [cx + 44 * sc, cy - 2, cz - 12], 4, 3), cap(x, y, z, [cx - 22 * sc, cy, cz - 2], [cx - 44 * sc, cy - 2, cz - 12], 4, 3));
  }
  return d;
};
const neckAir = (x, y, z) => Math.min(cap(x, y, z, [XC, 505, 388], [XC, 560, 388], 15, 13.5), sph(x, y, z, XC, 520, 396, 18), cap(x, y, z, [XC, 452, 372], [XC, 470, 372], 20, 16)) + 1.1 * Math.sin(y * 0.55) * (y > 520 ? 1 : 0);   // the trachea, the larynx and the hyoid

/* ============ the shoulders and arms, directly in statue pixels ============
   The bust is not a stiff T-pose: the viewer's-left arm hangs at the side, the viewer's-right arm is held out and bent, the forearm brought up and forward to the shoulder with the hand at the collarbone.
   The axes below were measured from the statue's own skin (the middle of every cross-section), so each bone runs down the middle of the limb. Kind 12: only the lens reveals them. */
const agroups = [];
function agroup(prims) { const q = []; for (const p of prims) { q.push(p.a || p.c); if (p.b) q.push(p.b); } let cx = 0, cy = 0, cz = 0; for (const p of q) { cx += p[0]; cy += p[1]; cz += p[2]; } cx /= q.length; cy /= q.length; cz /= q.length; let R = 0; for (const p of prims) { const m = Math.max(p.r1 || 0, p.r2 || 0, ...(p.rr || [0])); for (const v of [p.a || p.c, p.b].filter(Boolean)) R = Math.max(R, Math.hypot(v[0] - cx, v[1] - cy, v[2] - cz) + m + 6); } agroups.push({ c: [cx, cy, cz], R, prims }); }
const chain = (P, r) => { for (let i = 0; i < P.length - 1; i++) agroup([C(P[i], P[i + 1], r[Math.min(i, r.length - 1)], r[Math.min(i + 1, r.length - 1)])]); };
const ARM = {
  L: { head: [738, 712, 372], shaft: [[738, 714, 372], [726, 724, 372], [705, 760, 373], [689, 800, 375], [675, 840, 379], [674, 880, 386], [672, 920, 394], [668, 960, 398], [662, 1000, 403], [658, 1046, 407]], clav: [[944, 672, 462], [900, 656, 455], [842, 642, 430], [790, 636, 402], [748, 634, 380]], blade: [812, 765, 266], spine: [[872, 708, 262], [830, 694, 266], [790, 676, 300], [760, 652, 350], [748, 634, 378]], neck: [[792, 742, 295], [742, 714, 362]] },
  R: { head: [1192, 665, 334], shaft: [[1192, 667, 334], [1225, 690, 336], [1260, 720, 338], [1290, 760, 350], [1323, 800, 358], [1359, 840, 372], [1388, 880, 386], [1412, 920, 418], [1428, 958, 434]], clav: [[976, 672, 462], [1020, 656, 452], [1080, 640, 425], [1135, 632, 392], [1180, 628, 356]], blade: [1112, 742, 266], spine: [[1048, 698, 262], [1090, 686, 266], [1130, 670, 296], [1162, 648, 330], [1180, 628, 354]], neck: [[1130, 702, 290], [1192, 665, 334]] }
};
const FORE = [[1430, 962, 440], [1410, 935, 470], [1395, 915, 497], [1381, 880, 531], [1352, 840, 580], [1327, 800, 619], [1291, 760, 654], [1250, 722, 656], [1244, 692, 650]];   // the right forearm, from the elbow up to the wrist
for (const key of ['L', 'R']) {
  const A = ARM[key];
  agroup([E(A.head, [25, 25, 25])]);                                               // the head of the humerus
  chain(A.shaft, [16.5, 16, 15.5, 15, 14.5, 14.5, 14.5, 14.5, 14.5, 14.5]);        // the shaft, down the middle of the upper arm
  chain(A.clav, [6.5, 6, 6, 6.5, 7]);                                              // the collarbone's gentle S
  agroup([E(A.blade, [58, 92, 6.5])]);                                             // the shoulder blade, lying on the back of the ribs
  chain(A.spine, [5.5, 6, 7, 7.5, 8]);                                             // its spine, running out to the acromion
  chain(A.neck, [9, 12]);                                                          // the neck of the blade, to the socket
}
{ const end = ARM.R.shaft[ARM.R.shaft.length - 1]; agroup([E([end[0] + 4, end[1] + 6, end[2] - 4], [21, 12, 15])]); }   // the condyles at the elbow
agroup([E([1438, 976, 438], [14, 16, 14])]);                                     // the point of the elbow (olecranon)
for (let i = 0; i < FORE.length - 1; i++) {                                        // the two bones of the forearm, side by side
  const a = FORE[i], b = FORE[i + 1], d = nrm(sub(b, a)), o = nrm(cross(d, [0, 1, 0])), w = lerp(10, 8, i / (FORE.length - 2));
  const off = (p, k) => [p[0] + o[0] * w * k, p[1] + o[1] * w * k, p[2] + o[2] * w * k];
  agroup([C(off(a, 1), off(b, 1), lerp(8, 5, i / (FORE.length - 1)), lerp(8, 5, (i + 1) / (FORE.length - 1)))]);        // the ulna, thick at the elbow
  agroup([C(off(a, -1), off(b, -1), lerp(5.5, 7, i / (FORE.length - 1)), lerp(5.5, 7, (i + 1) / (FORE.length - 1)))]);   // the radius, thick at the wrist
}
agroup([E([1240, 676, 648], [17, 13, 14])]);                                       // the wrist
for (const [kx, kz] of [[1222, 640], [1210, 630], [1198, 622], [1186, 614]]) {     // the hand: four long bones to the knuckles, and the fingers curled up along the shoulder
  chain([[1240, 676, 648], [kx, 640, kz + 6]], [3.6]); chain([[kx, 640, kz + 6], [kx - 8, 600, kz + 24], [kx - 14, 572, kz + 36]], [3, 2.6, 2.2]);
}
const armBones = (x, y, z) => {
  let d = 1e9;
  for (const g of agroups) {
    const dc = Math.hypot(x - g.c[0], y - g.c[1], z - g.c[2]) - g.R; if (dc > 30) { d = Math.min(d, dc); continue; }
    for (const p of g.prims) d = Math.min(d, p.t ? ell(x, y, z, p.c[0], p.c[1], p.c[2], p.rr[0], p.rr[1], p.rr[2]) : cap(x, y, z, p.a, p.b, p.r1, p.r2));
  }
  return d;
};

/* ============ the head, in head millimetres: skull and brain ============ */
const HC = [949.4, 314.6, 437.7], HS = 1.367, YAW = 29.9 * Math.PI / 180, PIT = 6.9 * Math.PI / 180,   // found by tools/fit-skull.js: the skull sits just under the statue's face
     cyw = Math.cos(YAW), syw = Math.sin(YAW), cpt = Math.cos(PIT), spt = Math.sin(PIT);
const mapH = (x, y, z) => { const y1 = y * cpt - z * spt, z1 = y * spt + z * cpt, x2 = x * cyw + z1 * syw, z2 = -x * syw + z1 * cyw; return [HC[0] + x2 * HS, HC[1] + y1 * HS, HC[2] + z2 * HS]; };
const torus = (x, y, z, c, R, r) => { const q = Math.hypot(x - c[0], y - c[1]) - R; return Math.sqrt(q * q + sq(z - c[2])) - r; };
function skull(x, y, z) {
  let d = ell(x, y, z, 0, -18, -10, 76, 84, 98);                                 // the smooth dome of the cranium
  d = smin(d, ell(x, y, z, 0, -30, 40, 58, 40, 40), 24);                         // the forehead
  d = smin(d, ell(x, y, z, 0, 46, 38, 46, 36, 30), 14);                          // the upper jaw
  for (const sg of [-1, 1]) {
    d = smin(d, cap(x, y, z, [sg * 10, -4, 78], [sg * 50, -8, 66], 5.5, 6), 5);                   // the brow ridge
    d = smin(d, torus(x, y, z, [sg * 33, 12, 64], 18, 4.6), 5);                                   // the thick rim of the orbit
    d = smax(d, -sph(x, y, z, sg * 33, 12, 68, 16), 5);                                           // the deep, round socket
    d = smin(d, sph(x, y, z, sg * 52, 34, 50, 15), 8);                                            // the cheekbone
    d = smin(d, cap(x, y, z, [sg * 56, 28, 40], [sg * 74, 28, -16], 6, 6.5), 5);                  // the zygomatic arch, back to the ear
    d = smin(d, sph(x, y, z, sg * 63, 66, -16, 9), 6);                                            // the mastoid process
    d = smin(d, cap(x, y, z, [sg * 64, 22, -18], [sg * 62, 80, -10], 9, 11), 6);                  // the wide ramus of the jaw
    d = smin(d, cap(x, y, z, [sg * 62, 80, -10], [sg * 54, 94, 10], 11, 10), 6);                  // the angle
    d = smin(d, cap(x, y, z, [sg * 54, 94, 10], [sg * 26, 110, 46], 10, 9.5), 6);                 // the body of the mandible
  }
  d = smin(d, cap(x, y, z, [26, 112, 46], [-26, 112, 46], 9.5, 9.5), 6);          // the chin
  d = smin(d, cap(x, y, z, [0, -2, 78], [0, 24, 82], 4.5, 5), 4);                // the bridge of the nose
  d = smax(d, -smin(ell(x, y, z, 0, 42, 74, 9.5, 15, 14), ell(x, y, z, 0, 28, 77, 5.5, 9, 12), 6), 3);   // the pear-shaped nasal opening
  d = smin(d, cap(x, y, z, [0, 24, 76], [0, 54, 72], 1.9, 1.9), 1.5);            // the nasal septum
  d = smax(d, -ell(x, y, z, 0, 82, 12, 46, 14, 36), 8);                          // the hollow between the jaws
  return d;
}
const teeth = (x, y, z) => { let d = 1e9; for (const row of [[63, 0.8], [83, 0.0]]) for (let k = -7; k <= 7; k++) { const cx = k * 3.9, cz = 58 - 0.7 * k * k * 0.5 - row[1] * 2; d = Math.min(d, ell(x, y, z, cx, row[0], cz, 3.5, 7, 3.2)); } return d; };
// winding ridges and grooves, like the surface of a brain: a field whose zero lines are the sulci
const gyri = (x, y, z) => Math.sin(0.2 * x + 2.1 * Math.sin(0.13 * y + 0.11 * z)) + Math.sin(0.17 * y + 2.1 * Math.sin(0.12 * z + 0.1 * x)) + Math.sin(0.15 * z + 2.1 * Math.sin(0.14 * x + 0.12 * y));
function brain(x, y, z) {
  let d = 1e9;
  for (const sg of [-1, 1]) {
    d = Math.min(d, ell(x, y, z, sg * 35, -28, -10, 40, 51, 82));                 // each cerebral hemisphere, longer than it is wide
    d = smin(d, ell(x, y, z, sg * 47, 8, -6, 24, 20, 40), 14);                     // the temporal lobe, bulging low at the side
    d = smax(d, -cap(x, y, z, [sg * 60, -4, 28], [sg * 78, -16, -26], 1.7, 1.7), 1.6);   // the lateral sulcus, between the temporal and frontal lobes
  }
  d = smax(d, -cap(x, y, z, [0, -96, -96], [0, 24, 64], 2.3, 2.3), 1.6);          // the longitudinal fissure
  const cb = smin(d, ell(x, y, z, 0, 18, -72, 52, 22, 30), 8);                    // the cerebellum, tucked under the back
  d = smin(cb, cap(x, y, z, [0, 10, -34], [0, 84, -52], 13, 9), 6);               // the brain stem
  const fold = y > 6 && z < -50 ? 1.1 * Math.sin(y * 1.15) : 1.0 * gyri(x, y, z);    // fine parallel ridges under the back, winding gyri elsewhere
  return d + fold;
}
const brainKeep = (x, y, z) => { if (y > 6 && z < -50) return 0.7; return 0.16 + 0.84 * smoothstepB(Math.abs(gyri(x, y, z)), 0.12, 0.85); };
function smoothstepB(v, a, b) { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }

/* ============ sampling ============ */
function sample(sdf, box, count, kind, cell, map, jac, keepP) {
  const c = cell, nx = Math.ceil((box[1] - box[0]) / c), ny = Math.ceil((box[3] - box[2]) / c), nz = Math.ceil((box[5] - box[4]) / c), cells = [];
  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const x = box[0] + (i + 0.5) * c, y = box[2] + (j + 0.5) * c, z = box[4] + (k + 0.5) * c; if (Math.abs(sdf(x, y, z)) < c * 0.9) cells.push([x, y, z]); }
  const grad = (x, y, z) => { const e = c * 0.28, a = sdf(x + e, y, z) - sdf(x - e, y, z), b = sdf(x, y + e, z) - sdf(x, y - e, z), cc = sdf(x, y, z + e) - sdf(x, y, z - e), l = Math.hypot(a, b, cc) || 1; return [a / l, b / l, cc / l]; };
  const out = []; let guard = 0;
  while (out.length < count && guard++ < 12 && cells.length) {
    const per = Math.max(0.5, (count - out.length) / cells.length);
    for (const cl of cells) {
      let m = Math.floor(per) + (rnd() < per - Math.floor(per) ? 1 : 0);
      while (m-- > 0) {
        let x = cl[0] + (rnd() - 0.5) * c, y = cl[1] + (rnd() - 0.5) * c, z = cl[2] + (rnd() - 0.5) * c;
        for (let it = 0; it < 3; it++) { const d = sdf(x, y, z), n = grad(x, y, z); x -= n[0] * d; y -= n[1] * d; z -= n[2] * d; }
        if (Math.abs(sdf(x, y, z)) > c * 0.15 || Math.abs(x - cl[0]) > c * 0.75 || Math.abs(y - cl[1]) > c * 0.75 || Math.abs(z - cl[2]) > c * 0.75) continue;
        if (keepP && rnd() > keepP(x, y, z)) continue; const n = grad(x, y, z), P = map(x, y, z), J = jac ? jac(y) : null; let q = J ? [n[0] / J[0], n[1] / J[1], n[2] / J[2]] : n; q = nrm(q); out.push([P[0], P[1], P[2], q[0], q[1], q[2], kind]);
        if (out.length >= count) break;
      }
      if (out.length >= count) break;
    }
  }
  return out;
}
const ID = (x, y, z) => [x, y, z];

/* ============ curves: blood vessels and nerves, as points along smooth paths that the page animates as flowing pulses ============ */
function smoothPath(pts, per) { const out = [], n = pts.length; for (let i = 0; i < n - 1; i++) { const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(n - 1, i + 2)]; for (let j = 0; j < per; j++) { const t = j / per, t2 = t * t, t3 = t2 * t, q = [0, 0, 0]; for (let c = 0; c < 3; c++) q[c] = 0.5 * ((2 * p1[c]) + (-p0[c] + p2[c]) * t + (2 * p0[c] - 5 * p1[c] + 4 * p2[c] - p3[c]) * t2 + (-p0[c] + 3 * p1[c] - 3 * p2[c] + p3[c]) * t3); out.push(q); } } out.push(pts[n - 1].slice()); return out; }
const curves = [];                                                               // { pts (statue frame), kind, width }
const T = (x, y, z) => mapT(x, y, z), H2 = (x, y, z) => mapH(x, y, z);
const addCurve = (pts, kind, w) => curves.push({ pts: smoothPath(pts, 7), kind, w: w || 1.4 });
for (const sg of [-1, 1]) {
  const nk = (dx, y, dz) => [XC + sg * dx, y, dz];
  addCurve([T(sg * 10, 8, -40), T(sg * 18, -20, -50), nk(40, 600, 372), nk(42, 520, 380), nk(40, 450, 392)], 6, 2.2);   // the internal carotid, up to the base of the brain
  addCurve([T(sg * 24, 6, -34), nk(54, 600, 360), nk(54, 520, 366), nk(52, 450, 378)], 6, 2.4);                                                       // the jugular vein
  addCurve([nk(36, 440, 384), nk(36, 450, 380), nk(36, 520, 372), nk(36, 600, 362), T(sg * 30, 20, -62), T(sg * 32, 70, -96), T(sg * 40, 118, -100), T(sg * 28, 168, -110)], 7, 1.2);           // the vagus nerve, beside the carotid and down into the chest
  {
    const A = ARM[sg < 0 ? 'L' : 'R'], sh = A.shaft, mx = -sg * 11, mz = 17, along = sh.map(p => [p[0] + mx, p[1], p[2] + mz]), vv = sh.map(p => [p[0] + mx * 1.4, p[1], p[2] + mz * 1.5]), vn = sh.map(p => [p[0] - mx * 0.8, p[1], p[2] + mz * 1.9]);
    addCurve([nk(26, 560, 316), T(sg * 44, 0, -88), [along[0][0] + sg * 14, along[0][1] - 18, along[0][2] - 10], ...along], 7, 1.4);      // the brachial plexus, and the nerve down the arm
    addCurve([T(sg * 14, 24, -50), T(sg * 70, 12, -40), [vv[0][0] + sg * 24, vv[0][1] - 24, vv[0][2] + 4], ...vv], 6, 2.6);                // the subclavian and brachial artery
    addCurve([T(sg * 20, 32, -44), T(sg * 80, 22, -34), [vn[0][0] + sg * 28, vn[0][1] - 14, vn[0][2] + 14], ...vn], 6, 2);                 // and the vein beside it
    if (sg > 0) { addCurve([along[along.length - 1], ...FORE.slice(1, 7).map(p => [p[0] + 9, p[1], p[2] + 10])], 7, 1.2); addCurve([vv[vv.length - 1], ...FORE.slice(1, 7).map(p => [p[0] - 8, p[1], p[2] + 12])], 6, 2); }   // on down the forearm
  }                        // the brachial plexus, and the nerve down the arm
  for (let i = 1; i <= 0; i++) {                                                 // (the intercostal nerves are left out: beside the ribs they read as extra lines)
    const pts = []; for (let k = 0; k <= 8; k++) { const p = ribPoint(i, sg, 0.1 + 0.86 * k / 8); pts.push(T(p[0] * 0.97, p[1] + 7, p[2] * 0.97)); }
    addCurve(pts, 7, 0.9); if (i % 2 === 0) addCurve(pts.map(p => [p[0], p[1] + 5, p[2]]), 6, 1.1);
  }
}
addCurve([[XC - 4, 408, 352], [XC - 4, 430, 346], [XC - 4, 520, 320], [XC - 4, 600, 292], ...Array.from({ length: 12 }, (_, i) => T(0, -24 + i * 22, zsp(i + 1) + 4)), T(0, 250, -180)], 14, 2.4);    // the spinal cord
for (let j = 1; j <= 12; j++) for (const sg of [-1, 1]) addCurve([T(0, -24 + (j - 1) * 22, zsp(j) + 2), T(sg * 24, -20 + (j - 1) * 22, zsp(j) - 8), T(sg * 52, -12 + (j - 1) * 22, zsp(j) - 6)], 7, 1);   // and its nerve roots
addCurve([T(24, 90, -124), T(26, 140, -130), T(28, 200, -134), T(28, 300, -134)], 6, 3);                                                                                                           // the aorta's long descent
// the venous network just under the skin of the chest and shoulders, grown as branching trees over the statue's own surface
const HF = new Map(); for (const p of skin) { if (p[3] < 0.3) continue; const k = Math.round(p[0] / 10) + ',' + Math.round(p[1] / 10); if (!HF.has(k) || p[2] > HF.get(k)) HF.set(k, p[2]); }
const hf = (x, y) => { let best = null; for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) { const v = HF.get((Math.round(x / 10) + dx) + ',' + (Math.round(y / 10) + dy)); if (v !== undefined && (best === null || v > best)) best = v; } return best; };
function vein(x, y, ang, len, depth, w) {
  const pts = []; let px = x, py = y;
  for (let s = 0; s < len; s++) {
    const z = hf(px, py); if (z === null || px < 690 || px > 1230 || py > 1020 || py < 610) break; pts.push([px, py, z - 5]);
    ang += (rnd() - 0.5) * 0.35; px += Math.cos(ang) * 11; py += Math.sin(ang) * 11;
    if (depth > 0 && s > 3 && rnd() < 0.16) vein(px, py, ang + (rnd() < 0.5 ? -1 : 1) * (0.5 + rnd() * 0.5), Math.floor(len * 0.6), depth - 1, w * 0.7);
  }
  if (pts.length > 3) addCurve(pts, 6, Math.max(0.8, w));
}
for (const sg of [-1, 1]) for (let k = 0; k < 5; k++) vein(XC + sg * (50 + k * 40), 668 + k * 6, sg < 0 ? Math.PI * (0.42 + k * 0.05) : Math.PI * (0.58 - k * 0.05), 22, 3, 1.5);
for (const sg of [-1, 1]) for (let k = 0; k < 3; k++) vein(XC + sg * (190 + k * 20), 700 + k * 40, Math.PI * (0.5 + sg * 0.1), 14, 2, 1.2);

function nerveTree(p, dir, len, depth, w) {                                    // a nerve that forks as it runs out through the body (statue pixels)
  const pts = [p.slice()]; let q = p.slice(), d = dir.slice();
  for (let k = 0; k < len; k++) {
    d = nrm([d[0] + (rnd() - 0.5) * 0.5, d[1] + (rnd() - 0.5) * 0.35 + 0.05, d[2] + (rnd() - 0.5) * 0.4]); q = [q[0] + d[0] * 11, q[1] + d[1] * 11, q[2] + d[2] * 11]; pts.push(q.slice());
    if (depth > 0 && k > 2 && rnd() < 0.2) nerveTree(q, nrm([d[0] + (rnd() - 0.5) * 1.1, d[1] + (rnd() - 0.5) * 0.6, d[2] + (rnd() - 0.5) * 0.9]), Math.floor(len * 0.65), depth - 1, w * 0.8);
  }
  addCurve(pts, 7, Math.max(0.7, w));
}
for (let j = 1; j <= 12; j += 1) for (const sg of [-1, 1]) {
  const root = T(sg * 14, -24 + (j - 1) * 22, zsp(j) - 6);
  nerveTree(root, nrm([sg * 1, 0.25, 0.55]), 9, 2, 1.1);
}
for (const sg of [-1, 1]) for (let k = 0; k < 4; k++) nerveTree(T(sg * 40, -6 + k * 8, -92), nrm([sg * 1, 0.3, 0.2]), 12, 2, 1.2);
// nerves branching off along both arms, the right forearm and the hand, and up the neck: signals run through the whole body
for (const key of ['L', 'R']) { const sh = ARM[key].shaft, dirx = key === 'L' ? -1 : 1; for (let i = 1; i < sh.length - 1; i++) nerveTree([sh[i][0] + dirx * 8, sh[i][1], sh[i][2] + 14], nrm([dirx * 0.7, 0.35, 0.5]), 7, 1, 1.0); }
for (let i = 1; i < FORE.length - 1; i++) nerveTree([FORE[i][0] + 6, FORE[i][1], FORE[i][2] + 12], nrm([0.4, -0.3, 0.6]), 6, 1, 0.9);
for (const sg of [-1, 1]) for (let k = 0; k < 4; k++) nerveTree([XC + sg * 40, 560 - k * 42, 372 - k * 6], nrm([sg * 0.8, -0.1, 0.5]), 7, 1, 1.0);              // the shoulders' nerves
// (nothing moves inside the head: the skull and the folded brain stay still)

function curvePoints(cv, spacing) {
  const out = [], P = cv.pts; let len = 0; const L = [0]; for (let i = 1; i < P.length; i++) { len += Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1], P[i][2] - P[i - 1][2]); L.push(len); }
  const n = Math.max(2, Math.floor(len / spacing)), ph = rnd();
  for (let k = 0; k < n; k++) {
    const d = k / (n - 1) * len; let i = 1; while (i < P.length - 1 && L[i] < d) i++; const t = clamp((d - L[i - 1]) / Math.max(1e-6, L[i] - L[i - 1]), 0, 1), a = P[i - 1], b = P[i], jr = cv.w * 0.5;
    out.push([lerp(a[0], b[0], t) + (rnd() - 0.5) * jr, lerp(a[1], b[1], t) + (rnd() - 0.5) * jr, lerp(a[2], b[2], t) + (rnd() - 0.5) * jr, (d / 330 % 1) * 0.99, ph, 0, cv.kind]);   // bytes: distance along the path (in 330 px cycles) and a phase
  }
  return out;
}

/* ============ bake ============ */
const pts = [].concat(
  sample(lungs, [-170, 170, -20, 240, -180, 8], 26000, 0, 4, T, jacT),
  sample(heart, [-60, 130, 10, 230, -140, 30], 5200, 1, 3.4, T, jacT),
  sample(airways, [-100, 120, -100, 260, -160, -20], 4200, 2, 3.2, T, jacT),
  sample(thorBones, [-230, 230, -40, 270, -190, 40], 3200, 4, 3.6, T, jacT),
  sample(thorVerts, [-230, 230, -40, 270, -190, 40], 5000, 13, 3.4, T, jacT),
  sample(thorRibs, [-230, 230, -40, 270, -190, 40], 12000, 10, 3.2, T, jacT, (x, y, z) => z > -92 ? 1 : 0.2),
  sample(armBones, [570, 1500, 590, 1050, 200, 720], 30000, 12, 4.2, ID, null),
  sample(neckBones, [XC - 80, XC + 80, 360, 640, 240, 380], 2200, 4, 5, ID, null),
  sample(neckAir, [XC - 40, XC + 40, 430, 570, 340, 440], 1100, 2, 4, ID, null),
  sample(skull, [-100, 100, -110, 150, -120, 110], 17000, 8, 3.2, H2, null, (x, y, z) => (y < -6 && z < 46 && Math.abs(x) < 78) ? 0.26 : 1),
  sample(skull, [-100, 100, -20, 150, -40, 110], 9000, 8, 3, H2, null, (x, y, z) => (y > -2 || z > 52) ? 1 : 0),   // the face: orbits, cheekbones, nose, jaws, a little denser so they read as bone
  sample(teeth, [-50, 50, 55, 100, 30, 70], 2400, 8, 2.2, H2, null),
  sample(brain, [-90, 90, -96, 100, -120, 100], 16000, 5, 2.6, H2, null, brainKeep));
let nCurve = 0;
for (const cv of curves) { const cp2 = curvePoints(cv, cv.kind === 7 ? 3.2 : cv.kind === 9 ? 2.2 : 3); for (const p of cp2) pts.push(p); nCurve += cp2.length; }
console.log('points', pts.length, '(of which on curves', nCurve + ')');

/* statue frame -> hero pixels: the same turn the bust was baked with */
const n = pts.length, buf = Buffer.alloc(n * 10);
pts.forEach((p, i) => {
  const xs = p[0], zs = p[2], x = xs * cp + zs * sp, z = -xs * sp + zs * cp, k = p[6], o = i * 10;
  buf.writeUInt16LE(Math.round(clamp((x - 600) * 10, 0, 65535)), o); buf.writeUInt16LE(Math.round(clamp(p[1] * 10, 0, 65535)), o + 2); buf.writeUInt16LE(Math.round(clamp((z + 400) * 10, 0, 65535)), o + 4);
  if (k >= 6) { buf.writeInt8(Math.round(clamp(p[3], 0, 1) * 127), o + 6); buf.writeInt8(Math.round(p[4] * 127), o + 7); buf.writeInt8(0, o + 8); }
  else { const q = nrm([p[3], p[4], p[5]]), nxr = q[0] * cp + q[2] * sp, nzr = -q[0] * sp + q[2] * cp; buf.writeInt8(Math.round(nxr * 127), o + 6); buf.writeInt8(Math.round(q[1] * 127), o + 7); buf.writeInt8(Math.round(nzr * 127), o + 8); }
  buf.writeUInt8(k, o + 9);
});
fs.writeFileSync(path.join(__dirname, '..', 'organs-model.js'), '/* generated by tools/bake-anatomy.js: lungs, heart, airways, skeleton, skull, brain, blood vessels and nerves as ' + n + ' points, placed inside the bust */\nwindow.ORGAN_MODEL = { n: ' + n + ', data: "' + buf.toString('base64') + '" };\n');
console.log('baked', n, 'points,', Math.round(buf.length * 1.34 / 1024), 'KB');
