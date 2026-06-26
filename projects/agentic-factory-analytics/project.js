/* EDAS project page — motion effects */
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

  document.querySelectorAll('.diagram-placeholder').forEach(diagram => {
    const archBlock = diagram.closest('.content-block');
    let pinned = false;

    const collapseDiagram = () => {
      if (!pinned) return;
      pinned = false;
      diagram.classList.remove('diagram-expanded');
      diagram.setAttribute('aria-expanded', 'false');
    };

    diagram.addEventListener('click', e => {
      e.stopPropagation();
      document.querySelectorAll('.diagram-placeholder.diagram-expanded').forEach(other => {
        if (other !== diagram) {
          other.classList.remove('diagram-expanded');
          other.setAttribute('aria-expanded', 'false');
        }
      });
      pinned = !pinned;
      diagram.classList.toggle('diagram-expanded', pinned);
      diagram.setAttribute('aria-expanded', String(pinned));
    });

    if (archBlock) {
      new IntersectionObserver(entries => {
        if (!entries[0].isIntersecting) collapseDiagram();
      }, { threshold: 0.2 }).observe(archBlock);
    }
  });

  document.addEventListener('click', e => {
    if (!e.target.closest('.diagram-placeholder')) {
      document.querySelectorAll('.diagram-placeholder.diagram-expanded').forEach(d => {
        d.classList.remove('diagram-expanded');
        d.setAttribute('aria-expanded', 'false');
      });
    }
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.diagram-placeholder.diagram-expanded').forEach(d => {
        d.classList.remove('diagram-expanded');
        d.setAttribute('aria-expanded', 'false');
      });
    }
  });
});
