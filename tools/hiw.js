
/* how it works: the pictures on the right change by themselves */
(() => {
  const sec = document.getElementById('hiw'), imgs = [...sec.querySelectorAll('.hiw-card img')], nums = [...sec.querySelectorAll('.hiw-badge b')], dots = [...sec.querySelectorAll('.hiw-dots i')];
  let k = 0, timer = null, vis = false; const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const go = n => { k = (n + imgs.length) % imgs.length; imgs.forEach((e, i) => e.classList.toggle('on', i === k)); nums.forEach((e, i) => e.classList.toggle('on', i === k)); dots.forEach((e, i) => e.classList.toggle('on', i === k)); };
  const arm = () => { clearInterval(timer); if (vis && !reduce) timer = setInterval(() => go(k + 1), 4500); };
  dots.forEach((d, i) => d.addEventListener('click', () => { go(i); arm(); }));
  new IntersectionObserver(([e]) => { vis = e.isIntersecting; arm(); }, { threshold: 0.25 }).observe(sec);
  // the picture is as tall as the text beside it, and as wide as that height asks for
  const hl = sec.querySelector('.hiw-l'), hr = sec.querySelector('.hiw-r');
  const fit = () => { if (!matchMedia('(min-width: 901px)').matches) { hr.style.width = ''; hr.style.height = ''; return; } const inner = hl.parentNode, cs = getComputedStyle(inner), avail = inner.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) - hl.offsetWidth - parseFloat(cs.columnGap || 0), want = (hl.querySelector('.hiw-steps').lastElementChild.querySelector('p').getBoundingClientRect().bottom - hl.querySelector('.kick').getBoundingClientRect().top) * 733 / 916; const w = Math.round(Math.max(260, Math.min(want, avail, 500))); hr.style.width = w + 'px'; hr.style.height = Math.round(w * 916 / 733) + 'px'; };
  fit(); addEventListener('resize', fit); if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit); addEventListener('load', fit);

})();
