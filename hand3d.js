/* ======================= HAND3D: a real, posable 3D hand, sampled into particles =======================
   Uses hand-model.js (a skinned hand mesh baked from the open "generic-hand" model: 1,360 vertices, 25 joints).
   The hand is posed with forward kinematics (each finger joint curls about the lateral axis), skinned, and sampled at fixed
   points on its surface, so a given dot is always the same spot of skin in every pose. That is what lets the dots morph from
   one pose to the next with fingers that actually bend.

   Model axes: fingers point along -Y, the palm faces -X, the thumb side is -Z.  Screen axes: x right, y down, z towards the viewer. */
window.Hand3D = (() => {
  const D = window.HAND_MODEL; if (!D) return null;
  const S = D.s, nV = D.pos.length / 3, nT = D.idx.length / 3, idx = D.idx, JI = D.ji, JWt = D.jw;
  const P = new Float32Array(nV * 3), NR = new Float32Array(nV * 3);
  for (let i = 0; i < P.length; i++) { P[i] = D.pos[i] / S; NR[i] = D.n[i] / 127; }
  const JN = D.joints.map(j => j.name), JP = D.joints.map(j => [j.p[0] / S, j.p[1] / S, j.p[2] / S]), nJ = JN.length, jid = n => JN.indexOf(n);

  /* ---- tiny 4x4 matrix helpers (column-major) ---- */
  /* the mesh ends in a boxy cuff, like a glove. Cut it off just past the wrist bone: nothing is sampled beyond CUT, and the forearm continues from there. */
  const CUT = (() => { let ymax = -1e9; for (let v = 0; v < nV; v++) ymax = Math.max(ymax, P[v * 3 + 1]); return Math.max(JP[JN.indexOf("wrist")][1] + 0.004, ymax - 0.022); })();
  const I4 = () => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  const mul = (a, b) => { const o = new Array(16); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3]; return o; };
  const trans = (x, y, z) => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1];
  const rotAxis = (ax, ay, az, a) => { const l = Math.hypot(ax, ay, az); ax /= l; ay /= l; az /= l; const c = Math.cos(a), s = Math.sin(a), t = 1 - c;
    return [t * ax * ax + c, t * ax * ay + s * az, t * ax * az - s * ay, 0, t * ax * ay - s * az, t * ay * ay + c, t * ay * az + s * ax, 0, t * ax * az + s * ay, t * ay * az - s * ax, t * az * az + c, 0, 0, 0, 0, 1]; };
  const about = (p, R) => mul(trans(p[0], p[1], p[2]), mul(R, trans(-p[0], -p[1], -p[2])));    // rotate about the point p

  /* ---- finger chains ---- */
  const FING = { index: 'index-finger', middle: 'middle-finger', ring: 'ring-finger', pinky: 'pinky-finger' };
  const CH = {}; for (const k in FING) CH[k] = { j: ['metacarpal', 'phalanx-proximal', 'phalanx-intermediate', 'phalanx-distal', 'tip'].map(s => jid(FING[k] + '-' + s)), from: 1 };
  CH.thumb = { j: ['thumb-metacarpal', 'thumb-phalanx-proximal', 'thumb-phalanx-distal', 'thumb-tip'].map(jid), from: 0 };
  const thumbAxis = (() => { const a = JP[jid('thumb-metacarpal')], b = JP[jid('thumb-tip')], t = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];   // flexion axis = thumb direction x palm normal
    const n = [1, 0, 0]; return [t[1] * n[2] - t[2] * n[1], t[2] * n[0] - t[0] * n[2], t[0] * n[1] - t[1] * n[0]]; })();

  /* pose = { index: [prox, inter, distal], middle: [...], ring: [...], pinky: [...], thumb: [meta, prox, distal], spread: { index: rad, ... } }
     negative angles curl towards the palm */
  function fk(pose) {
    const F = new Array(nJ); for (let i = 0; i < nJ; i++) F[i] = I4();
    for (const name in CH) {
      const ch = CH[name], flex = pose[name] || [], spread = (pose.spread && pose.spread[name]) || 0, ax = name === 'thumb' ? thumbAxis : [0, 0, 1];
      let acc = I4();
      if (spread) acc = about(JP[ch.j[0]], rotAxis(1, 0, 0, spread));                         // fan the finger sideways about its base
      ch.j.forEach((id, i) => {
        if (i >= ch.from && i < ch.j.length - 1) acc = mul(acc, about(JP[id], rotAxis(ax[0], ax[1], ax[2], flex[i - ch.from] || 0)));
        F[id] = acc;
      });
    }
    return F;
  }

  /* ---- skin the whole mesh ---- */
  function skin(F) {
    const V = new Float32Array(nV * 3), N = new Float32Array(nV * 3);
    for (let v = 0; v < nV; v++) {
      const x = P[v * 3], y = P[v * 3 + 1], z = P[v * 3 + 2], nx = NR[v * 3], ny = NR[v * 3 + 1], nz = NR[v * 3 + 2]; let px = 0, py = 0, pz = 0, qx = 0, qy = 0, qz = 0;
      for (let k = 0; k < 4; k++) {
        const w = JWt[v * 4 + k] / 255; if (!w) continue; const m = F[JI[v * 4 + k]];
        px += w * (m[0] * x + m[4] * y + m[8] * z + m[12]); py += w * (m[1] * x + m[5] * y + m[9] * z + m[13]); pz += w * (m[2] * x + m[6] * y + m[10] * z + m[14]);
        qx += w * (m[0] * nx + m[4] * ny + m[8] * nz); qy += w * (m[1] * nx + m[5] * ny + m[9] * nz); qz += w * (m[2] * nx + m[6] * ny + m[10] * nz);
      }
      const l = Math.hypot(qx, qy, qz) || 1; V[v * 3] = px; V[v * 3 + 1] = py; V[v * 3 + 2] = pz; N[v * 3] = qx / l; N[v * 3 + 1] = qy / l; N[v * 3 + 2] = qz / l;
    }
    return { V, N, F };
  }

  /* ---- fixed sample points on the surface (area weighted, deterministic) ---- */
  function samples(count, seed) {
    const area = new Float64Array(nT); let tot = 0;
    for (let t = 0; t < nT; t++) {
      const a = idx[t * 3] * 3, b = idx[t * 3 + 1] * 3, c = idx[t * 3 + 2] * 3;
      const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2], vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2];
      area[t] = Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx) / 2;
      if ((P[a + 1] + P[b + 1] + P[c + 1]) / 3 > CUT) area[t] = 0;                       // the cuff is cut away
      tot += area[t];
    }
    const cum = new Float64Array(nT); let acc = 0; for (let t = 0; t < nT; t++) { acc += area[t]; cum[t] = acc / tot; }
    let s = seed || 7; const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    const tri = new Int32Array(count), U = new Float32Array(count), W = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const r = rnd(); let lo = 0, hi = nT - 1; while (lo < hi) { const mid = (lo + hi) >> 1; if (cum[mid] < r) lo = mid + 1; else hi = mid; }
      let u = rnd(), v = rnd(); if (u + v > 1) { u = 1 - u; v = 1 - v; } tri[i] = lo; U[i] = u; W[i] = v;
    }
    return { tri, u: U, v: W, count };
  }

  /* ---- read the posed surface at the sample points ---- */
  function points(sm, sk) {
    const n = sm.count, X = new Float32Array(n), Y = new Float32Array(n), Z = new Float32Array(n), NX = new Float32Array(n), NY = new Float32Array(n), NZ = new Float32Array(n), V = sk.V, N = sk.N;
    for (let i = 0; i < n; i++) {
      const a = idx[sm.tri[i] * 3] * 3, b = idx[sm.tri[i] * 3 + 1] * 3, c = idx[sm.tri[i] * 3 + 2] * 3, u = sm.u[i], v = sm.v[i], w = 1 - u - v;
      X[i] = V[a] * w + V[b] * u + V[c] * v; Y[i] = V[a + 1] * w + V[b + 1] * u + V[c + 1] * v; Z[i] = V[a + 2] * w + V[b + 2] * u + V[c + 2] * v;
      const nx = N[a] * w + N[b] * u + N[c] * v, ny = N[a + 1] * w + N[b + 1] * u + N[c + 1] * v, nz = N[a + 2] * w + N[b + 2] * u + N[c + 2] * v, l = Math.hypot(nx, ny, nz) || 1;
      NX[i] = nx / l; NY[i] = ny / l; NZ[i] = nz / l;
    }
    return { x: X, y: Y, z: Z, nx: NX, ny: NY, nz: NZ, n };
  }

  /* ---- the forearm: a tapered cylinder continuing from the wrist (rigid) ---- */
  let wrist = null;
  (function fixWristNormals() {                                               // the cut end of the mesh: point its normals outwards, like the arm that continues it
    let ymax = -1e9; for (let v = 0; v < nV; v++) ymax = Math.max(ymax, P[v * 3 + 1]);
    let sx = 0, sz = 0, c = 0; for (let v = 0; v < nV; v++) if (P[v * 3 + 1] > ymax - 0.006) { sx += P[v * 3]; sz += P[v * 3 + 2]; c++; }
    const cx = sx / c, cz = sz / c;
    for (let v = 0; v < nV; v++) { const y = P[v * 3 + 1]; if (y < ymax + 1) continue;
      const w = Math.min(1, (y - (ymax - 0.016)) / 0.012), rx = P[v * 3] - cx, rz = P[v * 3 + 2] - cz, l = Math.hypot(rx, rz) || 1;
      NR[v * 3] = NR[v * 3] * (1 - w) + (rx / l) * w; NR[v * 3 + 1] = NR[v * 3 + 1] * (1 - w); NR[v * 3 + 2] = NR[v * 3 + 2] * (1 - w) + (rz / l) * w;
      const n = Math.hypot(NR[v * 3], NR[v * 3 + 1], NR[v * 3 + 2]) || 1; NR[v * 3] /= n; NR[v * 3 + 1] /= n; NR[v * 3 + 2] /= n; }
  })();
  function wristRing() {
    if (wrist) return wrist;
    const band = (y0, y1) => { let sx = 0, sz = 0, c = 0, mnx = 1e9, mxx = -1e9, mnz = 1e9, mxz = -1e9;
      for (let v = 0; v < nV; v++) { const y = P[v * 3 + 1]; if (y > y0 && y <= y1) { const x = P[v * 3], z = P[v * 3 + 2]; sx += x; sz += z; c++; mnx = Math.min(mnx, x); mxx = Math.max(mxx, x); mnz = Math.min(mnz, z); mxz = Math.max(mxz, z); } }
      return { cx: sx / c, cz: sz / c, rx: (mxx - mnx) / 2, rz: (mxz - mnz) / 2 }; };
    const e = band(CUT - 0.008, CUT + 0.002), m = band(CUT - 0.02, CUT - 0.01);
    return wrist = { y: CUT, cx: e.cx, cz: e.cz, rx: e.rx, rz: e.rz, m };
  }
  // the forearm's cross-section at distance d beyond the wrist: it starts exactly as wide as the cut end of the hand, eases to the natural wrist, then widens
  function armSection(d, length) {
    const w = wristRing(), u = Math.min(1, Math.max(0, d / 0.03)), k = u * u * (3 - 2 * u), g = 1 + 0.55 * Math.max(0, d / length);
    return { cx: w.cx + (w.m.cx - w.cx) * k, cz: w.cz + (w.m.cz - w.cz) * k, rx: (w.rx + (w.m.rx - w.rx) * k) * g, rz: (w.rz + (w.m.rz - w.rz) * k) * g };
  }

  function arm(count, seed, length, opt) {
    const w = wristRing(), sleeve = (opt && opt.sleeve) || 1; let s = seed || 11; const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    const X = new Float32Array(count), Y = new Float32Array(count), Z = new Float32Array(count), NX = new Float32Array(count), NY = new Float32Array(count), NZ = new Float32Array(count), T = new Float32Array(count);
    const ramp = t => { const u = Math.min(1, Math.max(0, t / 0.1)); return u * u * (3 - 2 * u); };      // the sleeve flares out over the first part of the arm
    const cuffN = sleeve > 1 ? Math.round(count * 0.1) : 0, ruckN = sleeve > 1 ? Math.round(count * 0.1) : 0;
    for (let i = 0; i < count; i++) {
      const a = rnd() * 6.2832, ex = Math.cos(a), ez = Math.sin(a);
      if (i >= cuffN && i < cuffN + ruckN) {                                                            // bunched-up folds of the glove just past the cuff
        const ring = (i - cuffN) % 4, d = 0.006 + ring * 0.0085 + Math.sin(a * 3 + ring * 1.7) * 0.0022, y = w.y + d, sec = armSection(d, length), grow = 1 + (sleeve - 1) * ramp(d / 0.04) + 0.025 * Math.sin(a * 5 + ring);
        X[i] = sec.cx + ex * sec.rx * grow; Z[i] = sec.cz + ez * sec.rz * grow; Y[i] = y; const nx = ex / sec.rx, nz = ez / sec.rz, l = Math.hypot(nx, nz); NX[i] = nx / l; NY[i] = 0.35; NZ[i] = nz / l; T[i] = 0.12; continue;
      }
      if (i < cuffN) {                                                                                  // a rolled cuff: a ring around the wrist
        const tube = rnd() * 6.2832, rr = 0.0045, yc = w.y + 0.03, base = sleeve * 1.06 * (1 + 0.55 * (0.03 / length));
        const ox = ex * (w.rx * base + Math.cos(tube) * rr), oz = ez * (w.rz * base + Math.cos(tube) * rr);
        X[i] = w.cx + ox; Z[i] = w.cz + oz; Y[i] = yc + Math.sin(tube) * rr; const nx = ex / w.rx, nz = ez / w.rz, l = Math.hypot(nx, nz); NX[i] = nx / l; NY[i] = Math.sin(tube) * 0.6; NZ[i] = nz / l; T[i] = 0.15; continue;
      }
      const t = rnd();
      const d = t * length, y = w.y + d, sec = armSection(d, length), grow = 1 + (sleeve - 1) * ramp(t * length / 0.04);
      X[i] = sec.cx + ex * sec.rx * grow; Z[i] = sec.cz + ez * sec.rz * grow; Y[i] = y;
      const nx = ex / sec.rx, nz = ez / sec.rz, l = Math.hypot(nx, nz); NX[i] = nx / l; NY[i] = 0; NZ[i] = nz / l; T[i] = t;
    }
    return { x: X, y: Y, z: Z, nx: NX, ny: NY, nz: NZ, n: count, t: T };
  }

  /* ---- placement: model space -> screen space ---- */
  // base: fingers up, palm facing the viewer. Then rotate by rot (degrees about screen x, y, z), scale to pixels, move to pos.
  function place(pts, o) {
    const [rx, ry, rz] = (o.rot || [0, 0, 0]).map(d => d * Math.PI / 180), cx = Math.cos(rx), sx = Math.sin(rx), cy = Math.cos(ry), sy = Math.sin(ry), cz = Math.cos(rz), sz = Math.sin(rz);
    const pv = o.pivot || [0, 0, 0], sc = o.s, mir = o.mirror ? -1 : 1, p = o.pos || [0, 0, 0], n = pts.n;
    const X = new Float32Array(n), Y = new Float32Array(n), Z = new Float32Array(n), NX = new Float32Array(n), NY = new Float32Array(n), NZ = new Float32Array(n);
    const rot = (x, y, z) => {                                         // Rz * Ry * Rx
      let y1 = y * cx - z * sx, z1 = y * sx + z * cx, x1 = x;
      let x2 = x1 * cy + z1 * sy, z2 = -x1 * sy + z1 * cy, y2 = y1;
      return [x2 * cz - y2 * sz, x2 * sz + y2 * cz, z2];
    };
    for (let i = 0; i < n; i++) {
      const mx = pts.x[i] - pv[0], my = pts.y[i] - pv[1], mz = (pts.z[i] - pv[2]) * mir;
      const q = rot(mz, my, -mx); X[i] = p[0] + q[0] * sc; Y[i] = p[1] + q[1] * sc; Z[i] = p[2] + q[2] * sc;       // base mapping: sx = mz, sy = my, sz = -mx
      const r = rot(pts.nz[i] * mir, pts.ny[i], -pts.nx[i]); NX[i] = r[0]; NY[i] = r[1]; NZ[i] = r[2];
    }
    return { x: X, y: Y, z: Z, nx: NX, ny: NY, nz: NZ, n };
  }

  /* ---- where a joint ends up after posing ---- */
  function jointPos(F, name, dx = 0, dy = 0, dz = 0) {
    const id = jid(name), p = JP[id], m = F[id], x = p[0] + dx, y = p[1] + dy, z = p[2] + dz;
    return [m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]];
  }

  /* ---- a syringe, in model space with its axis along Z. (cx, cy) = where the barrel passes (through the curled fingers), needle towards -Z ---- */
  /* the syringe, along any axis: P0 is the plunger end, d the direction the needle points, in the hand's model space */
  function syringe(count, seed, P0, d) {
    let s = seed || 5; const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    const nrm = v => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
    const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
    const up = Math.abs(d[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0], u = nrm(cross(d, up)), v = cross(d, u);
    const X = new Float32Array(count), Y = new Float32Array(count), Z = new Float32Array(count), NX = new Float32Array(count), NY = new Float32Array(count), NZ = new Float32Array(count), K = new Uint8Array(count);   // K: 0 body, 1 needle, 2 blood
    const rb = 0.0105, at = (sv, a, b) => [P0[0] + d[0] * sv + u[0] * a + v[0] * b, P0[1] + d[1] * sv + u[1] * a + v[1] * b, P0[2] + d[2] * sv + u[2] * a + v[2] * b], radial = (ca, sa) => [u[0] * ca + v[0] * sa, u[1] * ca + v[1] * sa, u[2] * ca + v[2] * sa], back = [-d[0], -d[1], -d[2]];
    for (let i = 0; i < count; i++) {
      const r = rnd(), ang = rnd() * 6.2832, ca = Math.cos(ang), sa = Math.sin(ang); let p, n, k = 0;
      if (r < 0.5) { p = at(0.045 + rnd() * 0.063, ca * rb, sa * rb); n = radial(ca, sa); }                                       // barrel wall
      else if (r < 0.68) { const rr = Math.sqrt(rnd()) * rb * 0.8; p = at(0.05 + rnd() * 0.052, ca * rr, sa * rr); n = radial(ca, sa); k = 2; }   // blood
      else if (r < 0.76) { const rr = rb + rnd() * 0.011; p = at(0.045 + (rnd() - 0.5) * 0.003, ca * rr * 1.3, sa * rr * 0.55); n = back; }      // finger flange
      else if (r < 0.88) { if (rnd() < 0.7) { p = at(0.005 + rnd() * 0.04, ca * 0.0032, sa * 0.0032); n = radial(ca, sa); } else { const rr = Math.sqrt(rnd()) * 0.0125; p = at(0.003 + (rnd() - 0.5) * 0.002, ca * rr, sa * rr); n = back; } }   // plunger rod + thumb pad
      else if (r < 0.93) { const t = rnd(), rr = 0.0052 * (1 - t) + 0.0016 * t; p = at(0.108 + t * 0.016, ca * rr, sa * rr); n = radial(ca, sa); }  // hub
      else { p = at(0.124 + rnd() * 0.05, (rnd() - 0.5) * 0.0009, (rnd() - 0.5) * 0.0009); n = u; k = 1; }                                       // needle
      X[i] = p[0]; Y[i] = p[1]; Z[i] = p[2]; NX[i] = n[0]; NY[i] = n[1]; NZ[i] = n[2]; K[i] = k;
    }
    return { x: X, y: Y, z: Z, nx: NX, ny: NY, nz: NZ, k: K, n: count };
  }

  /* the doctor's pen grip: finds finger curls that pinch the barrel between the thumb pad (on top) and the finger tips (underneath), the syringe slanting
     alphaDeg from the finger direction. Returns { pose, P0, d } */
  function grip(alphaDeg) {
    const al = alphaDeg * Math.PI / 180, d = [-Math.sin(al), -Math.cos(al), 0], rb = 0.0105; let best = null;
    const perp = (p, P0) => { const v = [p[0] - P0[0], p[1] - P0[1], p[2] - P0[2]], s = v[0] * d[0] + v[1] * d[1] + v[2] * d[2]; return { q: [v[0] - d[0] * s, v[1] - d[1] * s, v[2] - d[2] * s], s }; };
    const mk = (c1, c2, th) => ({ index: [-0.8 * c1, -1.0 * c1, -0.7 * c1], middle: [-0.85 * c2, -1.05 * c2, -0.75 * c2], ring: [-1.1, -1.3, -0.95], pinky: [-1.2, -1.4, -1.0], thumb: th, spread: { index: -0.05, pinky: 0.1 } });
    for (const a of [-0.5, -0.3, -0.1, 0.1, 0.3]) for (const b of [-0.8, -0.5, -0.2, 0.1, 0.3]) for (const c of [-0.6, -0.3, 0, 0.2]) {
      const th = [a, b, c];
      for (let c1 = 0.2; c1 <= 1.5; c1 += 0.1) {
        const F = fk(mk(c1, 1, th)), tt = jointPos(F, 'thumb-tip'), it = jointPos(F, 'index-finger-tip'), M = [(tt[0] + it[0]) / 2, (tt[1] + it[1]) / 2, (tt[2] + it[2]) / 2], P0 = [M[0] - d[0] * 0.05, M[1] - d[1] * 0.05, M[2] - d[2] * 0.05];
        const qt = perp(tt, P0), qi = perp(it, P0), rt = Math.hypot(...qt.q), ri = Math.hypot(...qi.q), dotp = (qt.q[0] * qi.q[0] + qt.q[1] * qi.q[1] + qt.q[2] * qi.q[2]) / ((rt * ri) || 1);
        const cost = Math.abs(rt - (rb + 0.002)) + Math.abs(ri - (rb + 0.002)) + (dotp > -0.5 ? (dotp + 0.5) * 0.05 : 0) + Math.abs(qt.s - 0.033) * 0.9 + Math.abs(qi.s - 0.066) * 0.9;
        for (let c2 = 0.4; c2 <= 1.6; c2 += 0.2) {
          const mt = jointPos(fk(mk(c1, c2, th)), 'middle-finger-tip'), qm = perp(mt, P0), cm = cost + Math.abs(Math.hypot(...qm.q) - (rb + 0.002)) * 0.7 + Math.abs(qm.s - 0.082) * 0.7 + Math.abs(a) * 0.004 + Math.abs(b) * 0.002;
          if (!best || cm < best.cost) best = { cost: cm, pose: mk(c1, c2, th), P0, d };
        }
      }
    }
    return best;
  }

  /* ---- surface details. kind "skin": fingernails and knuckle creases (a bare hand). kind "glove": wrinkles over the knuckles and folds across the back
         of the hand (a latex glove stretched over it). Returns points with normals and a size factor k. ---- */
  function details(F, kind, count, seed) {
    let sd = seed || 3; const rnd = () => { sd = (sd * 16807) % 2147483647; return sd / 2147483647; };
    const out = [], add = (p, n, k) => out.push([p[0], p[1], p[2], n[0], n[1], n[2], k]);
    const col = (id, c) => [F[id][c * 4], F[id][c * 4 + 1], F[id][c * 4 + 2]], nm = v => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
    const mixp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
    const F4 = ['index-finger', 'middle-finger', 'ring-finger', 'pinky-finger'];
    if (kind === 'skin') {
      for (const [dn, tn] of [...F4.map(f => [f + '-phalanx-distal', f + '-tip']), ['thumb-phalanx-distal', 'thumb-tip']]) {          // fingernails
        const id = jid(dn), a = jointPos(F, dn, 0.0072), b = jointPos(F, tn, 0.0066), along = nm([b[0] - a[0], b[1] - a[1], b[2] - a[2]]), lat = nm(col(id, 2)), nrm = nm(col(id, 0)), c = mixp(a, b, 0.52);
        for (let i = 0; i < 30; i++) { const r = Math.sqrt(rnd()), t = rnd() * 6.2832, u = Math.cos(t) * r, v = Math.sin(t) * r; add([c[0] + along[0] * v * 0.0056 + lat[0] * u * 0.0037, c[1] + along[1] * v * 0.0056 + lat[1] * u * 0.0037, c[2] + along[2] * v * 0.0056 + lat[2] * u * 0.0037], nrm, 0.95); }
      }
      for (const f of F4) for (const j of ['phalanx-proximal', 'phalanx-intermediate']) {                                                  // creases across the knuckles
        const id = jid(f + '-' + j), base = jointPos(F, f + '-' + j, 0.0083), lat = nm(col(id, 2)), along = nm(col(id, 1)), nrm = nm(col(id, 0));
        for (const kk of [-1, 0, 1]) for (let i = 0; i < 8; i++) { const u = (i / 7 - 0.5) * 2 * 0.0052, sag = Math.cos((i / 7 - 0.5) * 3.1) * 0.0007; add([base[0] + along[0] * (kk * 0.0032 + sag) + lat[0] * u, base[1] + along[1] * (kk * 0.0032 + sag) + lat[1] * u, base[2] + along[2] * (kk * 0.0032 + sag) + lat[2] * u], nrm, 0.55); }
      }
    } else {
      for (const f of F4) {                                                                                                                  // glove: stretch wrinkles at every knuckle
        const zk = jointPos(F, f + '-phalanx-proximal')[2];                                                                                   // and folds radiating over the back of the hand
        for (let r = -2; r <= 2; r++) for (let i = 0; i < 12; i++) { const u = i / 11, y = -0.026 + u * 0.062, z = zk * (1 - u * 0.4) + r * 0.0042 * (1 - u * 0.5) + Math.sin(u * 7 + r) * 0.0012; add([handX(y, z) + 0.0014, y, z], [1, 0, 0], 0.6); }
      }
    }
    const n0 = out.length, res = { x: new Float32Array(count), y: new Float32Array(count), z: new Float32Array(count), nx: new Float32Array(count), ny: new Float32Array(count), nz: new Float32Array(count), k: new Float32Array(count), n: count };
    for (let i = 0; i < count; i++) { const o = out[i < n0 ? i : (rnd() * n0) | 0], j = i < n0 ? 0 : 0.0004; res.x[i] = o[0] + (rnd() - 0.5) * j; res.y[i] = o[1] + (rnd() - 0.5) * j; res.z[i] = o[2] + (rnd() - 0.5) * j; res.nx[i] = o[3]; res.ny[i] = o[4]; res.nz[i] = o[5]; res.k[i] = o[6]; }
    return res;
  }

  /* ---- the back of the hand's skin, so veins can lie on it ---- */
  let HF = null; const HC = 0.004, HY0 = -0.14, HZ0 = -0.09, HNY = 56, HNZ = 42;
  function heightField() {
    if (HF) return HF; HF = new Float32Array(HNY * HNZ).fill(-9);
    for (let v = 0; v < nV; v++) { const iy = ((P[v * 3 + 1] - HY0) / HC) | 0, iz = ((P[v * 3 + 2] - HZ0) / HC) | 0; if (iy < 0 || iz < 0 || iy >= HNY || iz >= HNZ) continue; HF[iy * HNZ + iz] = Math.max(HF[iy * HNZ + iz], P[v * 3]); }
    for (let pass = 0; pass < 3; pass++) { const G = HF.slice(); for (let y = 0; y < HNY; y++) for (let z = 0; z < HNZ; z++) if (G[y * HNZ + z] < -5) { let m = -9; for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) { const yy = y + dy, zz = z + dz; if (yy >= 0 && zz >= 0 && yy < HNY && zz < HNZ) m = Math.max(m, G[yy * HNZ + zz]); } HF[y * HNZ + z] = m; } }
    return HF;
  }
  const handX = (y, z) => { const hf = heightField(), iy = Math.max(0, Math.min(HNY - 1, ((y - HY0) / HC) | 0)), iz = Math.max(0, Math.min(HNZ - 1, ((z - HZ0) / HC) | 0)); const v = hf[iy * HNZ + iz]; return (v < -5 ? 0.04 : v) + 0.0014; };

  /* ---- veins: lines on the skin of the back of the hand, following the real pattern. Each finger has two side veins; neighbouring pairs join
         in the gaps between the knuckles, run up the back of the hand into an arch, and from the ends and middle of the arch separate veins
         (radial, middle ones, ulnar) climb the forearm side by side. ---- */
  function veins(F, armLength) {
    let seed = 41; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }, jit = a => (rnd() - 0.5) * a;
    const w = wristRing(), L = armLength || 0.2, dorsal = 0.0105, out = [];
    const add = (cls, pts) => { pts.cls = cls; out.push(pts); };
    const P3 = (n, dx, dz) => jointPos(F, n, dx === undefined ? dorsal : dx, 0, dz || 0);
    const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
    const onHand = (y, z) => [handX(y, z), y, z];                                                      // a point on the skin of the back of the hand
    const armX = (y, z) => { const sec = armSection(Math.max(0, y - w.y), L), q = (z - sec.cz) / sec.rz; return sec.cx + Math.sqrt(Math.max(0.0001, 1 - q * q)) * sec.rx + 0.0016; };
    const onArm = (y, z) => [armX(y, z), y, z];
    const F4 = ['index-finger', 'middle-finger', 'ring-finger', 'pinky-finger'];
    // the arch across the back of the hand (y is negative towards the fingers) and where the three knuckle-gap veins meet it
    const archZ = [-0.027, -0.017, -0.004, 0.011, 0.027, 0.041], archY = [0.006, -0.004, -0.012, -0.012, -0.004, 0.006];
    const archAt = z => { for (let i = 0; i < archZ.length - 1; i++) if (z <= archZ[i + 1]) { const u = (z - archZ[i]) / (archZ[i + 1] - archZ[i]); return archY[i] + (archY[i + 1] - archY[i]) * u; } return archY[archY.length - 1]; };
    add(2, archZ.map((z, i) => onHand(archY[i], z)));
    const fingerVein = (f, side) => {                                                                  // from the fingertip, down the side of a finger, to the knuckle
      const dz = side * 0.0046; return [P3(f + '-tip', dorsal * 0.8, dz * 0.7), P3(f + '-phalanx-distal', undefined, dz), P3(f + '-phalanx-intermediate', undefined, dz), P3(f + '-phalanx-proximal', dorsal + 0.002, dz)];
    };
    const webZ = [], webs = [];
    for (let i = 0; i < 3; i++) {                                                                      // gaps between neighbouring knuckles: two veins merge, one continues
      const a = fingerVein(F4[i], 1), b = fingerVein(F4[i + 1], -1), pa = a[3], pb = b[3], web = mix(pa, pb, 0.5); web[0] += 0.0012; web[1] += 0.008;
      const zc = web[2], run = [];
      for (let k = 1; k <= 4; k++) { const u = k / 4, y = web[1] + (archAt(zc) - web[1]) * u; run.push(onHand(y, zc + Math.sin(u * 3.1 + i) * 0.0016)); }
      add(0, [...a, web, ...run]); add(0, [...b, mix(pb, web, 0.6), web]);
      webZ.push(zc); webs.push(web);
    }
    const idxOuter = fingerVein(F4[0], -1), pinOuter = fingerVein(F4[3], 1);                           // the outer sides run along the edges of the hand into the ends of the arch
    add(0, [...idxOuter, onHand(-0.026, -0.036 + jit(0.002)), onHand(-0.013, -0.03), onHand(archY[0], archZ[0])]);
    add(0, [...pinOuter, onHand(-0.02, 0.05 + jit(0.002)), onHand(-0.008, 0.046), onHand(archY[5], archZ[5])]);
    for (const f of F4) add(0, fingerVein(f, 0).slice(0, 4).map(p => [p[0] + 0.0008, p[1], p[2]]));    // a thin vein down the middle of each finger
    const th = ['thumb-tip', 'thumb-phalanx-distal', 'thumb-phalanx-proximal', 'thumb-metacarpal'].map((n, i) => P3(n, i === 3 ? 0.027 : dorsal, 0));
    add(1, [...th, onHand(-0.004, -0.03), onHand(archY[0], archZ[0])]);
    // up the forearm: radial and ulnar veins at the two sides, two or three finer ones between them, never meeting at a point
    const wy = w.y, rz0 = w.rz;
    const path = (z0, z1, zEnd, ys, wob) => ys.map((y, i) => { const u = i / (ys.length - 1), z = z0 + (z1 - z0) * Math.min(1, u * 1.6) + (zEnd - z1) * Math.max(0, u - 0.4) / 0.6 + Math.sin(u * 5 + wob) * 0.0022; return y < wy ? onHand(y, z) : onArm(y, z); });
    const ys = [0.006, 0.026, 0.05, 0.078, 0.108, 0.14, 0.176];
    add(3, [onHand(archY[0], archZ[0]), ...path(-0.027, -0.021, -0.012, ys.slice(1), 0.3)]);                  // radial (thumb side)
    add(3, [onHand(archY[5], archZ[5]), ...path(0.041, 0.031, 0.02, ys.slice(1), 1.9)]);                      // ulnar (little-finger side)
    add(3, [onHand(archY[2], archZ[2]), ...path(-0.004, -0.004, 0.0, ys.slice(1), 3.1)]);                     // two in the middle
    add(3, [onHand(archY[3], archZ[3]), ...path(0.011, 0.012, 0.01, ys.slice(1), 4.4)]);
    const link = (a, b, y) => add(3, [onArm(y, a), onArm(y + 0.012, (a + b) / 2 + jit(0.002)), onArm(y + 0.024, b)]);        // small links between neighbouring forearm veins
    link(-0.02, -0.004, 0.056); link(0.012, 0.028, 0.07); link(-0.008, 0.01, 0.1);
    return out;
  }

  return { fk, skin, samples, points, arm, place, jid, JP, nV, CH, mul, trans, rotAxis, about, jointPos, syringe, grip, veins, wristRing, details };
})();
