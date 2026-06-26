/* Robotic Hand project page — motion effects */
document.addEventListener('DOMContentLoaded', () => {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  document.querySelectorAll('.hero-tags-stagger .tag').forEach((tag, i) => {
    if (reducedMotion) {
      tag.classList.add('tag-visible');
      return;
    }
    setTimeout(() => tag.classList.add('tag-visible'), 200 + i * 80);
  });

  document.querySelectorAll('.tech-grid .tech-item.reveal').forEach(el => {
    new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) el.classList.add('visible');
    }, { threshold: 0.1 }).observe(el);
  });
});
