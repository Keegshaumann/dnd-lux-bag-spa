/* ─────────────────────────────────────────
   D&D Luxury Bag Spa — Main JS
   Nav, mobile menu, smooth scroll, form
   ───────────────────────────────────────── */

document.addEventListener('DOMContentLoaded', () => {

  /* ── Lenis smooth scroll ── */
  if (window.Lenis) {
    const lenis = new Lenis({ lerp: 0.08, smooth: true });
    function raf(time) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }
    requestAnimationFrame(raf);

    /* Let GSAP ScrollTrigger know about Lenis */
    if (window.ScrollTrigger) {
      lenis.on('scroll', window.ScrollTrigger.update);
    }
  }

  /* ── Remove loading class ── */
  document.body.classList.remove('loading');

  /* ── Mobile hamburger ── */
  const hamburger  = document.getElementById('nav-hamburger');
  const mobileNav  = document.getElementById('nav-mobile');
  const mobileLinks = document.querySelectorAll('.mobile-link');

  hamburger?.addEventListener('click', () => {
    const open = hamburger.classList.toggle('open');
    mobileNav.classList.toggle('open', open);
    document.body.style.overflow = open ? 'hidden' : '';
  });

  mobileLinks.forEach((link) => {
    link.addEventListener('click', () => {
      hamburger.classList.remove('open');
      mobileNav.classList.remove('open');
      document.body.style.overflow = '';
    });
  });

  /* ── Smooth scroll for anchor links ── */
  document.querySelectorAll('a[href^="#"]').forEach((a) => {
    a.addEventListener('click', (e) => {
      const id = a.getAttribute('href').slice(1);
      const target = document.getElementById(id);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth' });
      }
    });
  });

  /* ── Contact form submission ── */
  const form = document.getElementById('quote-form');
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('button[type="submit"]');
    const originalText = btn.textContent;
    btn.textContent = 'Sending…';
    btn.disabled = true;

    try {
      const data = new FormData(form);
      const res  = await fetch(form.action, {
        method: 'POST',
        body: data,
        headers: { Accept: 'application/json' },
      });

      if (res.ok) {
        btn.textContent = '✓ Quote Request Sent';
        btn.style.background = '#2a7a4a';
        form.reset();
        setTimeout(() => {
          btn.textContent = originalText;
          btn.style.background = '';
          btn.disabled = false;
        }, 5000);
      } else {
        throw new Error('Form error');
      }
    } catch {
      btn.textContent = 'Error — please WhatsApp us';
      btn.style.background = '#8a2a2a';
      setTimeout(() => {
        btn.textContent = originalText;
        btn.style.background = '';
        btn.disabled = false;
      }, 4000);
    }
  });

  /* ── Easter egg ── */
  initEasterEgg();

});

function initEasterEgg() {
  const PHRASE    = 'may the bridges i burn light my way';
  const VIDEO_ID  = 'PMd1at7OwiE';
  let   buffer    = '';

  window.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === 'Escape') { closeEgg(); return; }
    if (e.key.length !== 1) return;

    buffer = (buffer + e.key.toLowerCase()).slice(-PHRASE.length);
    if (buffer === PHRASE) openEgg();
  });

  function openEgg() {
    if (document.getElementById('egg-overlay')) return;

    const overlay = document.createElement('div');
    overlay.id = 'egg-overlay';
    overlay.innerHTML = `
      <div class="egg-inner">
        <div class="egg-access">ACCESS GRANTED</div>
        <iframe
          src="https://www.youtube.com/embed/${VIDEO_ID}?autoplay=1&rel=0"
          allow="autoplay; fullscreen"
          allowfullscreen
          frameborder="0"
        ></iframe>
        <button class="egg-close" aria-label="Close">&#x2715;</button>
      </div>`;
    document.body.appendChild(overlay);

    requestAnimationFrame(() => overlay.classList.add('egg-visible'));

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeEgg();
    });
    overlay.querySelector('.egg-close').addEventListener('click', closeEgg);
  }

  function closeEgg() {
    const overlay = document.getElementById('egg-overlay');
    if (!overlay) return;
    overlay.classList.remove('egg-visible');
    overlay.addEventListener('transitionend', () => overlay.remove(), { once: true });
  }
}
