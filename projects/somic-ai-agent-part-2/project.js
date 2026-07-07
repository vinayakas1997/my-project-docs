/* Phase 2: HITL Evaluation & Specialized Ingestion Pipeline — motion effects */
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

  // Metric count-up
  document.querySelectorAll('.metric-count').forEach(el => {
    const to = +(el.dataset.to || 85);
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
});
