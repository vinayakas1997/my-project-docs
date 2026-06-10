/* ============================================
   MAIN.JS — Premium interactions & animations
   ============================================ */

document.addEventListener('DOMContentLoaded', () => {

  // ── Scroll progress bar ─────────────────
  const progressBar = document.getElementById('progress-bar');
  window.addEventListener('scroll', () => {
    const pct = window.scrollY / (document.documentElement.scrollHeight - window.innerHeight) * 100;
    if (progressBar) progressBar.style.width = pct + '%';
  }, { passive: true });

  // ── Capsule Navbar scroll state ─────────
  const navbar = document.getElementById('navbar');
  window.addEventListener('scroll', () => {
    if (navbar) navbar.classList.toggle('scrolled', window.scrollY > 80);
  }, { passive: true });

  // ── Mobile nav toggle ───────────────────
  const toggle  = document.querySelector('.nav-toggle');
  const navMenu = document.querySelector('.nav-links');
  if (toggle && navMenu) {
    toggle.addEventListener('click', () => navMenu.classList.toggle('open'));
  }

  // ── Active nav link ─────────────────────
  const sections = document.querySelectorAll('section[id]');
  const navLinks  = document.querySelectorAll('.nav-links a[href^="#"]');
  new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        navLinks.forEach(a => a.classList.remove('active'));
        const a = document.querySelector(`.nav-links a[href="#${e.target.id}"]`);
        if (a) a.classList.add('active');
      }
    });
  }, { threshold: 0.4 }).observe && sections.forEach(s =>
    new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          navLinks.forEach(a => a.classList.remove('active'));
          const a = document.querySelector(`.nav-links a[href="#${e.target.id}"]`);
          if (a) a.classList.add('active');
        }
      });
    }, { threshold: 0.4 }).observe(s)
  );

  // ── Scroll reveal ───────────────────────
  const revealObs = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('visible');
        revealObs.unobserve(e.target);
      }
    });
  }, { threshold: 0.12 });
  document.querySelectorAll('.reveal, .reveal-left, .reveal-right')
    .forEach(el => revealObs.observe(el));

  // ── Skills stagger ──────────────────────
  const skillObs = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('visible');
        e.target.querySelectorAll('.tag').forEach((t, i) => {
          t.style.transitionDelay = `${i * 55}ms`;
        });
        skillObs.unobserve(e.target);
      }
    });
  }, { threshold: 0.2 });
  document.querySelectorAll('.skills-list').forEach(s => skillObs.observe(s));

  // ── Typewriter ──────────────────────────
  const typeEl = document.getElementById('typewriter');
  if (typeEl) {
    const words = typeEl.dataset.words.split('|');
    let wi = 0, ci = 0, deleting = false;
    function type() {
      const word = words[wi];
      typeEl.textContent = deleting ? word.substring(0, ci--) : word.substring(0, ci++);
      let delay = deleting ? 55 : 95;
      if (!deleting && ci > word.length)  { delay = 2000; deleting = true; }
      else if (deleting && ci < 0)         { deleting = false; ci = 0; wi = (wi + 1) % words.length; delay = 350; }
      setTimeout(type, delay);
    }
    setTimeout(type, 1300);
  }

  // ── Context-aware cursor glow ───────────
  const glow = document.getElementById('cursor-glow');
  if (glow && window.innerWidth > 768) {
    document.addEventListener('mousemove', e => {
      glow.style.left = e.clientX + 'px';
      glow.style.top  = e.clientY + 'px';
    }, { passive: true });

    // Change glow state on hover targets
    document.querySelectorAll('a, button, .btn').forEach(el => {
      el.addEventListener('mouseenter', () => glow.classList.add('on-link'));
      el.addEventListener('mouseleave', () => glow.classList.remove('on-link'));
    });
    document.querySelectorAll('.project-card').forEach(el => {
      el.addEventListener('mouseenter', () => glow.classList.add('on-card'));
      el.addEventListener('mouseleave', () => glow.classList.remove('on-card'));
    });
  }

  // ── Spotlight cards ─────────────────────
  document.querySelectorAll('.project-card').forEach(card => {
    card.addEventListener('mousemove', e => {
      const rect = card.getBoundingClientRect();
      card.style.setProperty('--mouse-x', `${e.clientX - rect.left}px`);
      card.style.setProperty('--mouse-y', `${e.clientY - rect.top}px`);
    });
  });

  // ── Magnetic buttons ────────────────────
  document.querySelectorAll('.btn-magnetic').forEach(btn => {
    const wrap = btn.closest('.btn-magnetic-wrap') || btn;
    btn.addEventListener('mousemove', e => {
      const rect = btn.getBoundingClientRect();
      const x = (e.clientX - rect.left - rect.width  / 2) * 0.28;
      const y = (e.clientY - rect.top  - rect.height / 2) * 0.28;
      btn.style.transform = `translate(${x}px, ${y}px)`;
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.transform = '';
      btn.style.transition = 'transform 0.5s var(--ease)';
      setTimeout(() => btn.style.transition = '', 500);
    });
  });

  // ── Button ripple ────────────────────────
  const rippleStyle = document.createElement('style');
  rippleStyle.textContent = `@keyframes rippleAnim { from{transform:scale(0);opacity:1} to{transform:scale(2.8);opacity:0} }`;
  document.head.appendChild(rippleStyle);

  document.querySelectorAll('.btn').forEach(btn => {
    btn.addEventListener('click', e => {
      const r = document.createElement('span');
      const rect = btn.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height);
      r.style.cssText = `position:absolute;border-radius:50%;pointer-events:none;
        width:${size}px;height:${size}px;
        left:${e.clientX-rect.left-size/2}px;top:${e.clientY-rect.top-size/2}px;
        background:rgba(255,255,255,0.18);animation:rippleAnim 0.65s ease-out forwards;`;
      btn.appendChild(r);
      setTimeout(() => r.remove(), 650);
    });
  });

  // ── Counter animation ────────────────────
  document.querySelectorAll('.stat-num[data-target]').forEach(el => {
    new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) {
        const target = +el.dataset.target;
        const suffix = el.dataset.suffix || '';
        let count = 0, inc = target / 55;
        const tick = () => {
          count = Math.min(count + inc, target);
          el.innerHTML = `${Math.floor(count)}<span>${suffix}</span>`;
          if (count < target) requestAnimationFrame(tick);
        };
        tick();
      }
    }, { threshold: 0.6 }).observe(el);
  });

  // ── Animated data flow in diagrams ───────
  document.querySelectorAll('.diag-arrow').forEach((arrow, i) => {
    const pulse = document.createElement('span');
    pulse.className = 'data-pulse';
    pulse.style.cssText = `
      position:absolute; font-size:0.6rem; top:50%;
      transform:translateY(-50%);
      animation: dataFlow 2.5s ${i * 0.6}s infinite linear;
      pointer-events:none;
    `;
    pulse.textContent = '⚡';
    arrow.style.position = 'relative';
    arrow.appendChild(pulse);
  });

  const flowStyle = document.createElement('style');
  flowStyle.textContent = `
    @keyframes dataFlow {
      0%   { left:0%;   opacity:0; }
      10%  { opacity:1; }
      90%  { opacity:1; }
      100% { left:100%; opacity:0; }
    }
  `;
  document.head.appendChild(flowStyle);

});
