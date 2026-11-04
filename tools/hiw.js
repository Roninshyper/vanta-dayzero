
/* how it works: the pictures on the right change by themselves */
(() => {
  const sec = document.getElementById('hiw'), imgs = [...sec.querySelectorAll('.hiw-card img')], nums = [...sec.querySelectorAll('.hiw-badge b')], dots = [...sec.querySelectorAll('.hiw-dots i')];
  let k = 0, timer = null, vis = false; const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const go = n => { k = (n + imgs.length) % imgs.length; imgs.forEach((e, i) => e.classList.toggle('on', i === k)); nums.forEach((e, i) => e.classList.toggle('on', i === k)); dots.forEach((e, i) => e.classList.toggle('on', i === k)); };
  const arm = () => { clearInterval(timer); if (vis && !reduce) timer = setInterval(() => go(k + 1), 4500); };
  dots.forEach((d, i) => d.addEventListener('click', () => { go(i); arm(); }));
  new IntersectionObserver(([e]) => { vis = e.isIntersecting; arm(); }, { threshold: 0.25 }).observe(sec);
})();
