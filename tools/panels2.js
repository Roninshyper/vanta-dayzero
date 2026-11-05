/* the other panels: cards drawn from the store's data, three on screen at a time, each with one quiet line drawing; the carousel moves by hand (arrows, swipe, trackpad) */
(() => {
  const D = window.PANELS; if (!D) return;
  const track = document.getElementById('pnTrack'), prev = document.getElementById('pnPrev'), next = document.getElementById('pnNext');
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const plural = { Vitamin: 'Vitamins', Hormone: 'Hormones', Infectious: 'Infectious', Screening: 'Screening' };
  const count = p => p.soon ? 'Coming soon' : p.variants ? p.variants.map(v => v.label[0] + ' ' + v.markers).join(' · ') + ' Markers' : p.markers + ' ' + (p.unit ? p.unit[0].toUpperCase() + p.unit.slice(1) : 'Markers');
  track.innerHTML = D.items.map((p, i) => {
    const inner = '<div class="pn-top"><span>' + esc(plural[p.cat] || p.cat) + '</span><span>' + esc(count(p)) + '</span></div>' +
      '<div class="pn-img"><canvas data-i="' + i + '"></canvas></div>' +
      '<div class="pn-txt"><h3>' + esc(p.name) + '</h3><p>' + esc(p.line || p.body) + '</p></div>' +
      '<div class="pn-foot">' + (p.soon ? '<b class="soon">Coming soon</b>' : '<b>₹' + p.price.toLocaleString('en-IN') + '</b>') + '<span>At your door</span></div>';
    return p.soon ? '<div class="pn-card">' + inner + '</div>' : '<a class="pn-card" href="' + D.linkBase + p.slug + '" target="_blank" rel="noopener">' + inner + '</a>';
  }).join('');

  // ---- the pictures: one thin white drawing per panel, on a flat dark tile, with plenty of empty space
  let sd = 3; const rnd = () => { sd = (sd * 16807) % 2147483647; return sd / 2147483647; };
  function art(cv, i) {
    const dpr = Math.min(devicePixelRatio || 1, 2), W = 360, H = 240; cv.width = W * dpr; cv.height = H * dpr; const c = cv.getContext('2d'); c.scale(dpr, dpr); sd = 11 + i * 7;
    c.fillStyle = '#121212'; c.fillRect(0, 0, W, H);
    const gl = c.createRadialGradient(W / 2, H / 2, 4, W / 2, H / 2, W * 0.5); gl.addColorStop(0, 'rgba(255,255,255,.075)'); gl.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = gl; c.fillRect(0, 0, W, H);
    const dot = (x, y, r, a) => { c.globalAlpha = Math.min(1, a); c.beginPath(); c.arc(x, y, r, 0, 6.2832); c.fill(); };
    c.fillStyle = '#fff';
    const line = (a, b, n, al = .8) => { for (let k = 0; k <= n; k++) { const t = k / n; dot(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, .8, al); } };
    const ring = (x, y, rx, ry, n, al = .8, rot = 0) => { for (let k = 0; k < n; k++) { const t = k / n * 6.2832, px = Math.cos(t) * rx, py = Math.sin(t) * ry; dot(x + px * Math.cos(rot) - py * Math.sin(rot), y + px * Math.sin(rot) + py * Math.cos(rot), .8, al); } };
    const speck = (x, y, rx, ry, n, al = .5, rot = 0) => { for (let k = 0; k < n; k++) { const a = rnd() * 6.2832, d = Math.sqrt(rnd()), px = Math.cos(a) * rx * d, py = Math.sin(a) * ry * d; dot(x + px * Math.cos(rot) - py * Math.sin(rot), y + px * Math.sin(rot) + py * Math.cos(rot), .7, al * (.4 + .6 * d)); } };
    const path = (f, n, al = .85) => { for (let k = 0; k <= n; k++) dot(...f(k / n), .85, al); };
    const cx = W / 2, cy = H / 2;
    switch (i) {
      case 0: ring(cx - 28, cy + 6, 46, 46, 150); ring(cx + 52, cy - 24, 24, 24, 80); ring(cx + 40, cy + 36, 14, 14, 50); speck(cx - 28, cy + 6, 24, 24, 120, .35); break;   // bubbles
      case 1: ring(cx - 42, cy, 34, 54, 150, .85, .26); ring(cx + 42, cy, 34, 54, 150, .85, -.26); line([cx - 12, cy + 18], [cx + 12, cy + 18], 16); speck(cx - 42, cy, 22, 40, 90, .3, .26); speck(cx + 42, cy, 22, 40, 90, .3, -.26); break;   // the thyroid
      case 2: { const a = [cx - 62, cy + 52], b = [cx + 50, cy - 56], d = [(b[0] - a[0]) / 150, (b[1] - a[1]) / 150], nx = -d[1] * 150 / 78 * 11, ny = d[0] * 150 / 78 * 11; line([a[0] + nx, a[1] + ny], [b[0] + nx, b[1] + ny], 120); line([a[0] - nx, a[1] - ny], [b[0] - nx, b[1] - ny], 120); ring(b[0], b[1], 11, 11, 40); ring(a[0], a[1], 11, 11, 40, .8); speck((a[0] + b[0]) / 2 - 14, (a[1] + b[1]) / 2 + 14, 9, 22, 50, .4, .74); break; }   // one test tube
      case 3: for (let s = 0; s < 2; s++) path(t => [cx + Math.sin(t * 12.5 + s * Math.PI) * 36, 24 + t * 192], 320); for (let k = 1; k < 8; k++) { const t = k / 8, a = Math.sin(t * 12.5) * 36; line([cx + a, 24 + t * 192], [cx - a, 24 + t * 192], 10, .4); } break;   // a DNA helix
      case 4: path(t => [cx + Math.sin(t * 15) * (74 - t * 20), 24 + t * 192], 480, .8); break;   // the gut, as one line
      case 5: for (const [x, y] of [[0, 0], [1, 0], [-1, 0], [.5, 1], [-.5, 1], [.5, -1], [-.5, -1]]) ring(cx + x * 58, cy + y * 50, 30, 30, 6, .9, 0.52); break;   // cells in a lattice
      case 6: ring(cx, cy, 82, 82, 220); ring(cx, cy, 52, 52, 140, .45); dot(cx - 14, cy - 10, 3, .9); dot(cx + 20, cy + 6, 2.4, .8); dot(cx - 4, cy + 22, 2, .7); break;   // a plate
      case 7: for (let k = 0; k < 5; k++) path(t => [34 + t * (W - 68), 62 + k * 28 + Math.sin(t * (7 + k * 1.5) + k) * 7], 200, .9 - k * .12); break;   // a few traces
      case 8: for (let s = 0; s < 2; s++) path(t => [cx + Math.sin(t * 9 + s * Math.PI) * 30, 28 + t * 184], 260); for (let k = 1; k < 6; k++) { const t = k / 6; dot(cx + Math.sin(t * 9) * 30, 28 + t * 184, 3.2, .95); } ring(cx, cy, 94, 94, 260, .28); break;   // a helix with its marks, in a clock ring
      default: { const nodes = [[-90, -20], [-52, -54], [-30, 12], [4, -28], [30, 44], [58, -8], [92, 20], [8, 30], [-58, 40], [60, -58]]; for (let a = 0; a < nodes.length; a++) for (let b = a + 1; b < nodes.length; b++) { const d = Math.hypot(nodes[a][0] - nodes[b][0], nodes[a][1] - nodes[b][1]); if (d < 74) line([cx + nodes[a][0], cy + nodes[a][1]], [cx + nodes[b][0], cy + nodes[b][1]], Math.round(d / 3), .35); } for (const n of nodes) { ring(cx + n[0], cy + n[1], 4.5, 4.5, 14, 1); } }   // a small network
    }
    c.globalAlpha = 1;
  }
  const cvs = [...track.querySelectorAll('canvas')]; const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { art(e.target, +e.target.dataset.i); io.unobserve(e.target); } }), { rootMargin: '300px' }); cvs.forEach(c => io.observe(c));

  // ---- by hand: the arrows move one card, swiping or the trackpad move it freely
  const step = () => { const c = track.querySelector('.pn-card'); return c.getBoundingClientRect().width + parseFloat(getComputedStyle(track).columnGap || 20); };
  const upd = () => { const m = track.scrollWidth - track.clientWidth; prev.disabled = track.scrollLeft < 4; next.disabled = track.scrollLeft > m - 4; };
  prev.addEventListener('click', () => track.scrollBy({ left: -step(), behavior: 'smooth' })); next.addEventListener('click', () => track.scrollBy({ left: step(), behavior: 'smooth' }));
  track.addEventListener('scroll', upd, { passive: true }); addEventListener('resize', upd); upd();
})();
