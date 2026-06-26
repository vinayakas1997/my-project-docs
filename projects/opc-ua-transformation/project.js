/* IIoT project page — motion effects */
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
