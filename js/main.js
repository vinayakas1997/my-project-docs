/* ============================================
   MAIN.JS — Animations, scroll, interactions
   ============================================ */

document.addEventListener('DOMContentLoaded', () => {

  // ── Scroll progress bar ──────────────────
  const progressBar = document.getElementById('progress-bar');
  window.addEventListener('scroll', () => {
    const scrollTop    = window.scrollY;
    const docHeight    = document.documentElement.scrollHeight - window.innerHeight;
    const pct          = (scrollTop / docHeight) * 100;
    progressBar.style.width = pct + '%';
  });

  // ── Navbar scroll state ──────────────────
  const navbar = document.getElementById('navbar');
  window.addEventListener('scroll', () => {
    navbar.classList.toggle('scrolled', window.scrollY > 60);
  });

  // ── Active nav link ──────────────────────
  const sections  = document.querySelectorAll('section[id]');
  const navLinks  = document.querySelectorAll('.nav-links a[href^="#"]');
  const observer  = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        navLinks.forEach(a => a.classList.remove('active'));
        const active = document.querySelector(`.nav-links a[href="#${e.target.id}"]`);
        if (active) active.classList.add('active');
      }
    });
  }, { threshold: 0.4 });
  sections.forEach(s => observer.observe(s));

  // ── Reveal on scroll ────────────────────
  const revealEls = document.querySelectorAll('.reveal, .reveal-left, .reveal-right');
  const revealObs = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('visible');
        revealObs.unobserve(e.target);
      }
    });
  }, { threshold: 0.15 });
  revealEls.forEach(el => revealObs.observe(el));

  // ── Skills tag stagger ───────────────────
  const skillLists = document.querySelectorAll('.skills-list');
  const skillObs   = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('visible');
        const tags = e.target.querySelectorAll('.tag');
        tags.forEach((t, i) => {
          t.style.transitionDelay = `${i * 60}ms`;
        });
        skillObs.unobserve(e.target);
      }
    });
  }, { threshold: 0.2 });
  skillLists.forEach(s => skillObs.observe(s));

  // ── Typewriter effect ────────────────────
  const typeEl = document.getElementById('typewriter');
  if (typeEl) {
    const words  = typeEl.dataset.words.split('|');
    let   wi = 0, ci = 0, deleting = false;

    function type() {
      const word    = words[wi];
      const current = deleting ? word.substring(0, ci--) : word.substring(0, ci++);
      typeEl.textContent = current;

      let delay = deleting ? 60 : 100;
      if (!deleting && ci > word.length) {
        delay   = 1800;
        deleting = true;
      } else if (deleting && ci < 0) {
        deleting = false;
        ci       = 0;
        wi       = (wi + 1) % words.length;
        delay    = 400;
      }
      setTimeout(type, delay);
    }
    setTimeout(type, 1200);
  }

  // ── Cursor glow ──────────────────────────
  const glow = document.getElementById('cursor-glow');
  if (glow && window.innerWidth > 768) {
    document.addEventListener('mousemove', e => {
      glow.style.left = e.clientX + 'px';
      glow.style.top  = e.clientY + 'px';
    });
  }

  // ── Mobile nav toggle ────────────────────
  const toggle  = document.querySelector('.nav-toggle');
  const navMenu = document.querySelector('.nav-links');
  if (toggle) {
    toggle.addEventListener('click', () => {
      navMenu.style.display = navMenu.style.display === 'flex' ? 'none' : 'flex';
    });
  }

  // Close mobile nav on link click
  navLinks.forEach(a => {
    a.addEventListener('click', () => {
      if (window.innerWidth <= 768) {
        navMenu.style.display = 'none';
      }
    });
  });

  // ── Card tilt effect ─────────────────────
  document.querySelectorAll('.project-card').forEach(card => {
    card.addEventListener('mousemove', e => {
      const rect = card.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width  - 0.5;
      const y = (e.clientY - rect.top)  / rect.height - 0.5;
      card.style.transform = `translateY(-8px) rotateY(${x * 6}deg) rotateX(${-y * 4}deg)`;
    });
    card.addEventListener('mouseleave', () => {
      card.style.transform = '';
    });
  });

  // ── Button ripple ────────────────────────
  document.querySelectorAll('.btn').forEach(btn => {
    btn.addEventListener('click', function(e) {
      const ripple = document.createElement('span');
      const rect   = this.getBoundingClientRect();
      const size   = Math.max(rect.width, rect.height);
      ripple.style.cssText = `
        position:absolute; border-radius:50%; pointer-events:none;
        width:${size}px; height:${size}px;
        left:${e.clientX - rect.left - size/2}px;
        top:${e.clientY - rect.top  - size/2}px;
        background:rgba(255,255,255,0.15);
        animation: rippleAnim 0.6s ease-out forwards;
      `;
      this.style.position = 'relative';
      this.style.overflow = 'hidden';
      this.appendChild(ripple);
      setTimeout(() => ripple.remove(), 600);
    });
  });

  // inject ripple keyframe
  const style = document.createElement('style');
  style.textContent = `
    @keyframes rippleAnim {
      from { transform: scale(0); opacity:1; }
      to   { transform: scale(2.5); opacity:0; }
    }
  `;
  document.head.appendChild(style);

  // ── Counter animation ────────────────────
  document.querySelectorAll('.stat-num[data-target]').forEach(el => {
    const obs = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) {
        const target = +el.dataset.target;
        const suffix = el.dataset.suffix || '';
        let   count  = 0;
        const inc    = target / 60;
        const tick   = () => {
          count = Math.min(count + inc, target);
          el.innerHTML = Math.floor(count) + `<span>${suffix}</span>`;
          if (count < target) requestAnimationFrame(tick);
        };
        tick();
        obs.unobserve(el);
      }
    }, { threshold: 0.5 });
    obs.observe(el);
  });

});
