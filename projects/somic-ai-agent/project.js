/* RAG project page — motion effects */
document.addEventListener('DOMContentLoaded', () => {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Hero tag stagger
  const heroTags = document.querySelectorAll('.hero-tags-stagger .tag');
  heroTags.forEach((tag, i) => {
    if (reducedMotion) {
      tag.classList.add('tag-visible');
      return;
    }
    setTimeout(() => tag.classList.add('tag-visible'), 200 + i * 80);
  });

  // Pipeline stage cycle (ingest → hub → query)
  const stages = document.querySelectorAll('[data-stage]');
  if (stages.length && !reducedMotion) {
    let active = 0;
    const cycle = () => {
      stages.forEach((el, i) => el.classList.toggle('stage-active', i === active));
      active = (active + 1) % stages.length;
    };
    cycle();
    setInterval(cycle, 2500);
  } else if (stages.length) {
    stages[0]?.classList.add('stage-active');
  }

  // Challenge metric count-up
  document.querySelectorAll('.metric-count').forEach(el => {
    const to = +(el.dataset.to || 70);
    const from = +(el.dataset.from || 45);
    if (reducedMotion) {
      el.textContent = String(to);
      return;
    }
    new IntersectionObserver(entries => {
      if (!entries[0].isIntersecting) return;
      let val = from;
      const step = (to - from) / 40;
      const tick = () => {
        val = Math.min(val + step, to);
        el.textContent = String(Math.round(val));
        if (val < to) requestAnimationFrame(tick);
      };
      tick();
    }, { threshold: 0.5 }).observe(el);
  });

  // Tech stack stagger on reveal
  document.querySelectorAll('.tech-grid .tech-item.reveal').forEach(el => {
    new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) el.classList.add('visible');
    }, { threshold: 0.1 }).observe(el);
  });

  // Architecture diagram — hover preview (CSS) + click pin + dismiss
  const diagram = document.querySelector('.diagram-placeholder');
  const archBlock = diagram?.closest('.content-block');
  let pinned = false;

  const collapseDiagram = () => {
    if (!diagram || !pinned) return;
    pinned = false;
    diagram.classList.remove('diagram-expanded');
    diagram.setAttribute('aria-expanded', 'false');
  };

  diagram?.addEventListener('click', e => {
    e.stopPropagation();
    pinned = !pinned;
    diagram.classList.toggle('diagram-expanded', pinned);
    diagram.setAttribute('aria-expanded', String(pinned));
  });

  document.addEventListener('click', e => {
    if (!pinned || !diagram) return;
    if (!diagram.contains(e.target)) collapseDiagram();
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') collapseDiagram();
  });

  if (archBlock && diagram) {
    new IntersectionObserver(entries => {
      if (!entries[0].isIntersecting) collapseDiagram();
    }, { threshold: 0.2 }).observe(archBlock);
  }
});
