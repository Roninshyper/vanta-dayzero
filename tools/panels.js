
/* the other panels: cards drawn from the store's data, each with its own particle picture; the carousel moves by hand (arrows, swipe, trackpad) */
(() => {
  const D = window.PANELS; if (!D) return;
  const track = document.getElementById('pnTrack'), prev = document.getElementById('pnPrev'), next = document.getElementById('pnNext');
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const plural = { Vitamin: 'Vitamins', Hormone: 'Hormones', Infectious: 'Infectious', Screening: 'Screening' };
  const count = p => p.soon ? 'Coming soon' : p.variants ? p.variants.map(v => v.label[0] + ' ' + v.markers).join(' · ') + ' Markers' : p.markers + ' ' + (p.unit ? p.unit[0].toUpperCase() + p.unit.slice(1) : 'Markers');
  track.innerHTML = D.items.map((p, i) => {
    const inner = '<div class="pn-top"><span>' + esc(plural[p.cat] || p.cat) + '</span><span>' + esc(count(p)) + '</span></div>' +
      '<div class="pn-img"><canvas data-i="' + i + '"></canvas><div class="pn-txt"><h3>' + esc(p.name) + '</h3><p>' + esc(p.body || p.line) + '</p></div></div>' +
      '<div class="pn-foot">' + (p.soon ? '<b class="soon">Coming soon</b>' : '<b>₹' + p.price.toLocaleString('en-IN') + '</b>') + '<span>At your door</span></div>';
    return p.soon ? '<div class="pn-card">' + inner + '</div>' : '<a class="pn-card" href="' + D.linkBase + p.slug + '" target="_blank" rel="noopener">' + inner + '</a>';
  }).join('');

  // ---- the pictures: soft grey tiles with a white particle drawing of each panel's subject
  let sd = 3; const rnd = () => { sd = (sd * 16807) % 2147483647; return sd / 2147483647; };
  function art(cv, i) {
    const dpr = Math.min(devicePixelRatio || 1, 2), W = 348, H = 372; cv.width = W * dpr; cv.height = H * dpr; const c = cv.getContext('2d'); c.scale(dpr, dpr); sd = 11 + i * 7;
    const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#6d6d6d'); g.addColorStop(0.55, '#3a3a3a'); g.addColorStop(1, '#161616'); c.fillStyle = g; c.fillRect(0, 0, W, H);
    const gl = c.createRadialGradient(W * 0.5, H * 0.36, 10, W * 0.5, H * 0.36, W * 0.62); gl.addColorStop(0, 'rgba(255,255,255,.28)'); gl.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = gl; c.fillRect(0, 0, W, H);
    const dot = (x, y, r, a) => { c.globalAlpha = Math.min(1, a); c.beginPath(); c.arc(x, y, r, 0, 6.2832); c.fill(); };
    c.fillStyle = '#fff';
    const line = (a, b, n, r, al) => { for (let k = 0; k < n; k++) { const t = k / n; dot(a[0] + (b[0] - a[0]) * t + (rnd() - .5) * 1.2, a[1] + (b[1] - a[1]) * t + (rnd() - .5) * 1.2, r * (.6 + rnd() * .8), al); } };
    const ring = (x, y, rx, ry, n, r, al, rot = 0) => { for (let k = 0; k < n; k++) { const t = k / n * 6.2832, px = Math.cos(t) * rx, py = Math.sin(t) * ry; dot(x + px * Math.cos(rot) - py * Math.sin(rot) + (rnd() - .5), y + px * Math.sin(rot) + py * Math.cos(rot) + (rnd() - .5), r * (.6 + rnd() * .8), al); } };
    const fill = (x, y, rx, ry, n, r, al, rot = 0) => { for (let k = 0; k < n; k++) { const a = rnd() * 6.2832, d = Math.sqrt(rnd()), px = Math.cos(a) * rx * d, py = Math.sin(a) * ry * d; dot(x + px * Math.cos(rot) - py * Math.sin(rot), y + px * Math.sin(rot) + py * Math.cos(rot), r * (.5 + rnd() * .8), al * (.35 + .65 * d)); } };
    const path = (f, n, w, r, al) => { for (let k = 0; k < n; k++) { const t = k / n, p = f(t), a = rnd() * 6.2832, d = rnd() * w; dot(p[0] + Math.cos(a) * d, p[1] + Math.sin(a) * d, r * (.5 + rnd() * .9), al); } };
    switch (i) {
      case 0: // capsules and bubbles in a liquid
        for (const b of [[110, 120, 74], [260, 90, 40], [300, 230, 54], [70, 260, 30], [200, 210, 24], [150, 40, 18]]) { ring(b[0], b[1], b[2], b[2], 110 + b[2] * 3, .9, .75); fill(b[0] - b[2] * .3, b[1] - b[2] * .35, b[2] * .22, b[2] * .15, 24, .8, .6); }
        fill(205, 150, 46, 22, 700, 1, .9, -.55); ring(205, 150, 46, 22, 160, 1.1, 1, -.55); fill(110, 190, 42, 24, 600, 1, .85, .6); ring(110, 190, 42, 24, 150, 1.1, 1, .6); break;
      case 1: // the thyroid: two lobes and a bridge, over the windpipe
        for (let k = 0; k < 12; k++) ring(174, 40 + k * 22, 26, 5, 40, .9, .8);
        for (const s of [-1, 1]) { fill(174 + s * 62, 170, 42, 78, 1800, 1, .8, s * -.28); ring(174 + s * 62, 170, 42, 78, 260, 1.2, 1, s * -.28); for (let k = 0; k < 40; k++) { const a = rnd() * 6.2832, d = Math.sqrt(rnd()); ring(174 + s * 62 + Math.cos(a) * 30 * d, 170 + Math.sin(a) * 60 * d, 6, 6, 8, .7, .55); } }
        fill(174, 215, 26, 14, 300, 1, .9); break;
      case 2: // test tubes, crossed
        for (const [x, y, rot, L] of [[120, 175, -.95, 230], [215, 190, -.5, 240]]) { const dx = Math.cos(rot), dy = Math.sin(rot); line([x - dx * L / 2, y - dy * L / 2 - 17], [x + dx * L / 2, y + dy * L / 2 - 17], 150, 1, .9); line([x - dx * L / 2, y - dy * L / 2 + 17], [x + dx * L / 2, y + dy * L / 2 + 17], 150, 1, .9); ring(x + dx * L / 2, y + dy * L / 2, 17, 17, 40, 1, .9); fill(x - dx * L / 2, y - dy * L / 2, 20, 20, 160, 1.3, 1); for (let k = 0; k < 5; k++) { const t = .35 + k * .05; fill(x + dx * L * (t - .5), y + dy * L * (t - .5), 11, 14, 60, 1, .45); } }
        break;
      case 3: // a DNA double helix
        for (let s = 0; s < 2; s++) path(t => [174 + Math.sin(t * 18 + s * Math.PI) * 62, 20 + t * 330], 1100, 1.6, 1.4, 1);
        for (let k = 0; k < 30; k++) { const t = k / 30, a = Math.sin(t * 18) * 62; line([174 + a, 20 + t * 330], [174 - a, 20 + t * 330], 18, .9, .55); } break;
      case 4: // the gut: a long folded tube
        path(t => [174 + Math.sin(t * 22) * (110 - t * 40), 30 + t * 310 + Math.sin(t * 40) * 14], 2600, 15, 1.1, .85); path(t => [174 + Math.sin(t * 22) * (110 - t * 40), 30 + t * 310 + Math.sin(t * 40) * 14], 700, 1.5, 1.4, 1); break;
      case 5: // a lattice of cells and crystals
        for (let r = 0; r < 7; r++) for (let q = 0; q < 6; q++) { const x = 40 + q * 56 + (r % 2) * 28, y = 40 + r * 48, s = 22 * (.5 + rnd() * .6); ring(x, y, s, s, 6, 1.4, .9, rnd()); if (rnd() < .35) fill(x, y, s * .6, s * .6, 60, 1.1, .85); } break;
      case 6: // a plate with food
        ring(174, 175, 138, 138, 360, 1.1, .9); ring(174, 175, 98, 98, 260, 1, .6); for (const [x, y, r] of [[130, 140, 34], [215, 130, 26], [190, 215, 40], [120, 220, 22]]) { fill(x, y, r, r, 260, 1.1, .85); ring(x, y, r, r, 70, 1.2, 1); } break;
      case 7: // many traces: a full read-out
        for (let k = 0; k < 9; k++) path(t => [20 + t * 308, 50 + k * 34 + Math.sin(t * (9 + k) + k) * 9 + Math.sin(t * 31 + k * 2) * 3], 340, .6, 1.1, .95 - k * .05); break;
      case 8: // a helix with its methyl marks, inside a clock face
        ring(174, 175, 150, 150, 420, 1.1, .8); for (let k = 0; k < 12; k++) { const a = k / 12 * 6.2832; line([174 + Math.cos(a) * 138, 175 + Math.sin(a) * 138], [174 + Math.cos(a) * 150, 175 + Math.sin(a) * 150], 6, 1, .9); }
        for (let s = 0; s < 2; s++) path(t => [174 + Math.sin(t * 12 + s * Math.PI) * 46, 55 + t * 240], 700, 1.4, 1.3, 1); for (let k = 0; k < 14; k++) { const t = k / 14, a = Math.sin(t * 12) * 46; dot(174 + a, 55 + t * 240, 4.2, 1); dot(174 - a, 55 + t * 240, 2.6, .8); } line([174, 175], [174, 95], 30, 1.2, 1); line([174, 175], [224, 200], 24, 1.2, 1); break;
      default: { // a network of nodes inside a head
        const nodes = []; for (let k = 0; k < 46; k++) { const a = rnd() * 6.2832, d = Math.sqrt(rnd()); nodes.push([174 + Math.cos(a) * 112 * d, 165 + Math.sin(a) * 92 * d]); }
        ring(174, 165, 125, 104, 400, 1, .6); for (const a of nodes) for (const b of nodes) if (a !== b && Math.hypot(a[0] - b[0], a[1] - b[1]) < 56 && rnd() < .5) line(a, b, 9, .7, .55); for (const a of nodes) { fill(a[0], a[1], 4, 4, 14, 1.3, 1); } }
    }
    c.globalAlpha = 1;
  }
  const cvs = [...track.querySelectorAll('canvas')]; const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { art(e.target, +e.target.dataset.i); io.unobserve(e.target); } }), { rootMargin: '300px' }); cvs.forEach(c => io.observe(c));

  // ---- by hand: arrows move one card, swiping or the trackpad move it freely
  const step = () => { const c = track.querySelector('.pn-card'); return c.getBoundingClientRect().width + parseFloat(getComputedStyle(track).columnGap || 20); };
  const upd = () => { const m = track.scrollWidth - track.clientWidth; prev.disabled = track.scrollLeft < 4; next.disabled = track.scrollLeft > m - 4; track.classList.toggle('end', track.scrollLeft > m - 4); };
  prev.addEventListener('click', () => track.scrollBy({ left: -step(), behavior: 'smooth' })); next.addEventListener('click', () => track.scrollBy({ left: step(), behavior: 'smooth' }));
  track.addEventListener('scroll', upd, { passive: true }); addEventListener('resize', upd); upd();
})();
