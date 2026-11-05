
/* the biomarker section: the page is pinned and your scroll drives, in turn, the list on the right and the title wheel on the left */
(() => {
  const B = window.BIOMARKERS; if (!B) return;
  const $ = id => document.getElementById(id), sec = $('bm'), pin = sec.querySelector('.bm-pin'), wheel = $('wheel'), list = $('pList'), inner = $('pInner'), q = $('bmq');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches, S = B.systems, N = S.length, clamp = (v, a = 0, b = 1) => v < a ? a : v > b ? b : v;
  const IC = {
    metabolic: '<path d="M20 11a8 8 0 0 0-14.4-3.6L4 9"/><path d="M4 4v5h5"/><path d="M4 13a8 8 0 0 0 14.4 3.6L20 15"/><path d="M20 20v-5h-5"/>',
    cardiovascular: '<path d="M20.8 5a5.2 5.2 0 0 0-7.4 0L12 6.4 10.6 5A5.2 5.2 0 0 0 3.2 12.4l1.4 1.4L12 21l7.4-7.2 1.4-1.4a5.2 5.2 0 0 0 0-7.4z"/><path d="M7 12.5h2.6l1.4-3 2 5 1.3-2H17"/>',
    hormonal: '<circle cx="6.5" cy="7" r="2.6"/><circle cx="17.5" cy="9" r="2"/><circle cx="11" cy="17.5" r="3"/><path d="M9.1 7.4l6.4 1.2"/><path d="M7.6 9.5l2.2 5.2"/><path d="M16.4 10.7l-3.6 4.8"/>',
    nutrients: '<path d="M5 19c0-8 5-13 14-14 0 9-5 14-13 14-.4 0-.7 0-1-.1z"/><path d="M5 19c3-4 6-7 10-9"/>',
    liver: '<path d="M3.5 9.6c0-1.9 1.5-3.1 3.3-3.1H15c3.4 0 5.5 2.3 5.5 5.3 0 3.7-3.1 6.4-7 6.4-2.2 0-3.5-.6-4.9-1.7L6.2 17c-1.7-1-2.7-2.5-2.7-4.3z"/><path d="M9.6 8c.2 1.9 1.3 3.3 3.2 4.1"/>',
    thyroid: '<ellipse cx="8" cy="12" rx="3.3" ry="5.2" transform="rotate(10 8 12)"/><ellipse cx="16" cy="12" rx="3.3" ry="5.2" transform="rotate(-10 16 12)"/><path d="M11 13.5h2"/><path d="M12 3.5v4M12 17v3.5"/>',
    kidney: '<path d="M9 4.2C5.6 4.6 4 7.8 4 11.4 4 15.4 6.6 20 9.8 20c2.1 0 3.2-1.6 3.2-3.5 0-1.3-1-1.8-1-3.1S13 11.6 13 10c0-3.2-1.8-6.2-4-5.8z"/><path d="M15.4 7.6c1.9.5 3.1 2 3.6 4M15.6 15.6c1.4-.3 2.5-1.1 3.2-2.4"/>',
    immunity: '<path d="M12 21.5s7.5-3.7 7.5-9.7V5.6L12 2.8 4.5 5.6v6.2c0 6 7.5 9.7 7.5 9.7z"/><circle cx="12" cy="11" r="2.6"/><path d="M12 6.8v1.6M12 13.6v1.6M7.8 11h1.6M14.6 11h1.6"/>',
    inflammation: '<path d="M12 3c.7 3.2 4.8 5 4.8 9.6a4.8 4.8 0 0 1-9.6 0c0-2.1 1-3.3 2-4.3.1 1.6.8 2.5 2 2.9C10.8 9.7 10.5 6.1 12 3z"/>',
    'blood-health': '<circle cx="8.5" cy="9" r="4.2"/><circle cx="16.3" cy="11.5" r="3.6"/><circle cx="10.5" cy="17.3" r="3.4"/><circle cx="8.5" cy="9" r="1.3"/><circle cx="16.3" cy="11.5" r="1.1"/><circle cx="10.5" cy="17.3" r="1"/>',
    'toxin-exposure': '<path d="M9.5 3.5h5"/><path d="M10.5 3.5v5.2L5 18.2c-.7 1.3.2 2.8 1.7 2.8h10.6c1.5 0 2.4-1.5 1.7-2.8l-5.5-9.5V3.5"/><path d="M7.7 15h8.6"/>'
  };
  const icon = id => '<svg viewBox="0 0 24 24">' + (IC[id] || '') + '</svg>';
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const cnt = s => s.markers.reduce((a, m) => a + (m.c || 1), 0);

  // the wheel's titles
  const labels = S.map(s => { const e = document.createElement('div'); e.className = 'wl'; e.textContent = s.name; wheel.appendChild(e); return e; });
  const selEl = wheel.querySelector('.sel'), selTile = selEl.querySelector('.tile'), ring = wheel.querySelector('circle');
  let G = { R: 400, cx: -120, cy: 300, step: 13 * Math.PI / 180 };

  let shown = -1, free = false, searchW = null;
  const rowHtml = (m, sub, si) => '<div class="p-row"' + (si != null ? ' data-s="' + si + '"' : '') + '><div class="hd"><span class="nm">' + esc(m.n) + (sub ? '<small>' + esc(sub) + '</small>' : '') + '</span><span class="un">' + esc(m.u) + '</span><span class="pl"></span></div><div class="bd"><div>' + esc(m.w || '') + (m.r ? '<div class="rd">' + m.r.map(x => '<i>' + esc(x) + '</i>').join('') + '</div>' : '') + '</div></div></div>';
  function render(i) {
    shown = i; const s = S[i];
    $('pIcon').innerHTML = icon(s.id); $('pName').innerHTML = esc(s.name) + '<em>' + cnt(s) + '</em>'; $('pIntro').textContent = s.intro;
    inner.innerHTML = s.markers.map(m => rowHtml(m)).join('');
    selTile.innerHTML = icon(s.id);
  }
  inner.addEventListener('click', e => {
    const hd = e.target.closest('.hd'); if (!hd) return; const row = hd.parentNode, bd = row.querySelector('.bd'), open = row.classList.toggle('open');
    bd.style.maxHeight = open ? bd.scrollHeight + 'px' : 0; measure();
  });

  // searching: one list across every system, scrolled by hand
  let query = '';
  function search() {
    query = q.value.trim().toLowerCase(); free = !!query; list.classList.toggle('free', free); list.scrollTop = 0;
    if (!query) { searchW = null; shown = -2; inner.style.transform = ''; return; }
    const hits = []; S.forEach((s, si) => s.markers.forEach(m => { if ((m.n + ' ' + s.name).toLowerCase().includes(query)) hits.push([m, s.name, si]); }));
    $('pName').innerHTML = 'Results<em>' + hits.length + '</em>'; $('pIntro').textContent = 'Across all ' + N + ' systems.'; $('pIcon').innerHTML = '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/></svg>';
    searchW = hits.length ? hits[0][2] : null; inner.innerHTML = hits.length ? hits.map(h => rowHtml(h[0], h[1], h[2])).join('') : '<p class="p-empty">No biomarker matches “' + esc(q.value.trim()) + '”.</p>'; inner.style.transform = '';
  }
  list.addEventListener('scroll', () => { if (!free) return; for (const r of inner.querySelectorAll('.p-row[data-s]')) if (r.offsetTop + r.offsetHeight > list.scrollTop + 4) { searchW = +r.dataset.s; break; } });
  q.addEventListener('input', () => { q.parentNode.classList.toggle('has', !!q.value); search(); });
  q.parentNode.querySelector('.clr').addEventListener('click', () => { q.value = ''; q.dispatchEvent(new Event('input')); q.focus(); });

  // geometry and the scroll plan: for each system, its list scrolls first, then it holds, then the wheel turns to the next one
  let rowH = 64, vh = innerHeight, plan = [], total = 0, top0 = 0;
  const HOLD = () => vh * 0.22, TURN = () => vh * 0.5;
  function measure() {
    vh = innerHeight; const cs = getComputedStyle(pin); rowH = Math.max(44, Math.min(70, vh * 0.075)); pin.style.setProperty('--row', rowH + 'px');
    const bw = wheel.clientWidth, bh = wheel.clientHeight, R = Math.min(bw * 0.84, bh * 0.66);
    G = { R, cx: bw - R - R * 0.69 + R * 0.69 - R * 0.0 - (bw - R * 0.69) + (bw - R * 0.69) - R * 0.31 * 0 , cy: bh * 0.5, step: 13 * Math.PI / 180 };
    G.cx = -0.31 * R + (bw * 0.0); G.edge = G.cx + R;
    wheel.style.setProperty('--wf', Math.max(14, Math.min(20, R * 0.046)) + 'px'); wheel.style.setProperty('--tile', Math.max(44, Math.min(64, R * 0.16)) + 'px');
    const svg = wheel.querySelector('svg.ring'); ring.setAttribute('cx', G.cx); ring.setAttribute('cy', G.cy); ring.setAttribute('r', R);
    const vp = list.clientHeight, slack = innerWidth < 901 ? 30 : 150; plan = []; total = 0;
    S.forEach((s, i) => { const ovf = Math.max(0, s.markers.length * rowH - vp + (s.markers.length * rowH > vp ? slack : 0)), turn = i < N - 1 ? TURN() : 0; plan.push({ ovf, hold: HOLD(), turn, start: total }); total += ovf + HOLD() + turn; });
    sec.style.height = (pin.offsetHeight + total) + 'px'; top0 = sec.getBoundingClientRect().top + scrollY;
  }

  // scroll -> target wheel position and list offset
  let wTarget = 0, wCur = 0, offTarget = 0, segI = 0, lastScroll = -1;
  const ease = t => t * t * (3 - 2 * t);
  function fromScroll() {
    const y = clamp(scrollY - top0, 0, total); let i = N - 1;
    for (let k = 0; k < N; k++) if (y < plan[k].start + plan[k].ovf + plan[k].hold + plan[k].turn || k === N - 1) { i = k; break; }
    const p = plan[i], qy = y - p.start; segI = i;
    wTarget = i + (p.turn ? ease(clamp((qy - p.ovf - p.hold) / p.turn)) : 0); offTarget = Math.min(qy, p.ovf);
  }
  function listOffset(ai) { const p = plan[ai]; if (!p) return 0; return segI === ai ? offTarget : segI < ai ? 0 : p.ovf; }

  function frame() {
    requestAnimationFrame(frame); if (!vis) return;
    fromScroll(); if (free && searchW != null) wTarget = searchW; wCur += (wTarget - wCur) * (reduce ? 1 : 0.16); if (Math.abs(wTarget - wCur) < 0.0005) wCur = wTarget;
    const ai = clamp(Math.round(wCur), 0, N - 1), d = Math.abs(wCur - ai);
    if (!free && ai !== shown) render(ai);
    if (!free) { const o = listOffset(ai); inner.style.transform = 'translate3d(0,' + (-o) + 'px,0)'; const f = clamp(1 - d * 2.4); $('pIcon').parentNode.style.opacity = $('pIntro').style.opacity = list.style.opacity = f; list.style.opacity = Math.max(f, 0); }
    else list.style.opacity = 1;
    // the wheel
    const R = G.R + R_GAP(), cx = G.cx, cy = G.cy;
    labels.forEach((el, i) => {
      const dd = i - wCur, a = dd * G.step, ad = Math.abs(dd);
      if (ad > 5.6) { el.style.opacity = 0; el.style.visibility = 'hidden'; return; }
      el.style.visibility = ''; const x = cx + R * Math.cos(a), y = cy + R * Math.sin(a);
      el.style.transform = 'translate3d(' + x.toFixed(1) + 'px,' + (y - el.offsetHeight / 2).toFixed(1) + 'px,0)';
      el.style.opacity = (ad < 0.5 ? 0 : 0.5 / (0.9 + ad * 0.9)) * (ad < 1 ? 0.5 + ad * 0.5 : 1) * 1;
      if (ad < 0.5) el.style.opacity = clamp(ad * 2) * 0.36;
    });
    const sy = cy - selTile.offsetHeight / 2; selEl.style.transform = 'translate3d(' + (G.edge - R_TILE() - selTile.offsetWidth / 2 + selTile.offsetWidth * 0.0) + 'px,' + sy + 'px,0)'; selEl.style.opacity = 1; if (free && selTile.dataset.i != ai) { selTile.dataset.i = ai; selTile.innerHTML = icon(S[ai].id); }
    const pill = selEl.querySelector('.pill'); pill.style.left = (R_TILE() + selTile.offsetWidth / 2 - pill.offsetWidth / 2) + 'px';
    selEl.querySelector('b').style.opacity = 1;
    // the title beside the pill follows the nearest system
    selLabel.textContent = S[ai].name; selLabel.style.opacity = clamp(1 - d * 2.4);
  }
  const R_GAP = () => G.R * 0.073, R_TILE = () => G.R * 0.16;
  const selLabel = document.createElement('div'); selLabel.className = 'wl'; selLabel.style.cursor = 'default'; wheel.appendChild(selLabel);
  // the selected title sits on the arc at the wheel's middle row, next to the pill
  const placeSel = () => { selLabel.style.transform = 'translate3d(' + (G.edge + R_GAP()) + 'px,' + G.cy + 'px,0) translateY(-50%)'; };
  const _frame = frame; // keep the selected label glued to the arc
  labels.forEach((el, i) => el.addEventListener('click', () => { const p = plan[i]; if (p) scrollTo({ top: top0 + p.start + 2, behavior: 'smooth' }); }));

  let vis = true; new IntersectionObserver(([e]) => { vis = e.isIntersecting; }).observe(sec);
  let rt; addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { measure(); placeSel(); }, 120); });
  const start = () => { render(0); search(); measure(); placeSel(); requestAnimationFrame(frame); };
  (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(() => setTimeout(start, 60));
})();
