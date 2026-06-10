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


// ── Hero Canvas — 3D Atom/Particle Orbit ─────────────────
(function initHeroCanvas() {
  const canvas = document.getElementById('hero-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  function resize() {
    const wrap = canvas.parentElement;
    canvas.width  = wrap.offsetWidth;
    canvas.height = wrap.offsetHeight;
  }
  resize();
  window.addEventListener('resize', resize, { passive: true });

  // Atom node definition
  const nodes = [];
  const NUM_NODES = 55;
  const cx = () => canvas.width  * 0.42;
  const cy = () => canvas.height * 0.38;

  class Node {
    constructor() { this.reset(); }
    reset() {
      // random spherical orbit
      this.orbitR  = 60  + Math.random() * 220;
      this.theta   = Math.random() * Math.PI * 2;
      this.phi     = Math.random() * Math.PI * 2;
      this.speed   = (0.002 + Math.random() * 0.006) * (Math.random() < 0.5 ? 1 : -1);
      this.tiltX   = (Math.random() - 0.5) * 1.2;
      this.tiltY   = (Math.random() - 0.5) * 1.2;
      this.size    = 1.2 + Math.random() * 2.2;
      this.hue     = Math.random() < 0.6 ? 263 : 161; // violet or emerald
      this.opacity = 0.25 + Math.random() * 0.65;
    }
    update() { this.theta += this.speed; }
    get3D() {
      // project onto tilted ellipse
      const x3 = Math.cos(this.theta) * this.orbitR;
      const y3 = Math.sin(this.theta) * this.orbitR * 0.38;
      const rx = x3 * Math.cos(this.tiltY) - y3 * Math.sin(this.tiltX);
      const ry = x3 * Math.sin(this.tiltY) + y3 * Math.cos(this.tiltX);
      // depth for size/opacity scaling
      const depth = (Math.sin(this.theta) + 1) / 2;
      return { x: rx, y: ry, depth };
    }
    draw(offsetX, offsetY) {
      const { x, y, depth } = this.get3D();
      const sx = offsetX + x;
      const sy = offsetY + y;
      const scale = 0.5 + depth * 0.7;
      const alpha = this.opacity * (0.3 + depth * 0.7);
      const r     = this.size * scale;

      // glow
      const grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, r * 4);
      grad.addColorStop(0, `hsla(${this.hue}, 80%, 65%, ${alpha})`);
      grad.addColorStop(1, `hsla(${this.hue}, 80%, 65%, 0)`);
      ctx.beginPath();
      ctx.arc(sx, sy, r * 4, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();

      // core dot
      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${this.hue}, 90%, 72%, ${alpha * 1.4})`;
      ctx.fill();
    }
  }

  for (let i = 0; i < NUM_NODES; i++) nodes.push(new Node());

  // draw faint orbit rings
  function drawRings(ox, oy) {
    const rings = [
      { r: 90,  tilt: 0.25, alpha: 0.06 },
      { r: 155, tilt: -0.4, alpha: 0.05 },
      { r: 220, tilt: 0.15, alpha: 0.04 },
    ];
    rings.forEach(ring => {
      ctx.save();
      ctx.translate(ox, oy);
      ctx.rotate(ring.tilt);
      ctx.scale(1, 0.38);
      ctx.beginPath();
      ctx.arc(0, 0, ring.r, 0, Math.PI * 2);
      ctx.strokeStyle = `hsla(263, 70%, 58%, ${ring.alpha})`;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();
    });
  }

  // mouse parallax
  let mouseX = 0, mouseY = 0;
  document.addEventListener('mousemove', e => {
    mouseX = (e.clientX / window.innerWidth  - 0.5) * 28;
    mouseY = (e.clientY / window.innerHeight - 0.5) * 14;
  }, { passive: true });

  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const ox = cx() + mouseX;
    const oy = cy() + mouseY;

    drawRings(ox, oy);

    // sort by depth so back nodes render first
    const sorted = [...nodes].sort((a, b) => {
      return a.get3D().depth - b.get3D().depth;
    });
    sorted.forEach(n => { n.update(); n.draw(ox, oy); });

    requestAnimationFrame(animate);
  }
  animate();
})();
