/* ─────────────────────────────────────────
   D&D Luxury Bag Spa — GSAP ScrollTrigger animations
   ───────────────────────────────────────── */

const gsap = window.gsap;
const ScrollTrigger = window.ScrollTrigger;
gsap.registerPlugin(ScrollTrigger);

/* Wait for DOM */
document.addEventListener('DOMContentLoaded', () => {

  /* ── Hero content entrance (CSS-driven, but we
        reset the anim-fade-up class after GSAP takes over) ── */
  const heroItems = document.querySelectorAll('.hero-content .anim-fade-up');
  heroItems.forEach((el, i) => {
    gsap.fromTo(el,
      { opacity: 0, y: 40 },
      { opacity: 1, y: 0, duration: 0.9, delay: 0.2 + i * 0.15, ease: 'power3.out' }
    );
  });

  /* ── Generic scroll-triggered fade-up for all .anim-fade-up outside hero ── */
  const fadeEls = document.querySelectorAll(
    'section:not(#hero) .anim-fade-up'
  );
  fadeEls.forEach((el) => {
    gsap.fromTo(el,
      { opacity: 0, y: 44 },
      {
        opacity: 1,
        y: 0,
        duration: 0.85,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: el,
          start: 'top 88%',
          toggleActions: 'play none none none',
        },
      }
    );
  });

  /* ── Service cards stagger ── */
  gsap.fromTo('.service-card',
    { opacity: 0, y: 50 },
    {
      opacity: 1,
      y: 0,
      duration: 0.8,
      stagger: 0.15,
      ease: 'power3.out',
      scrollTrigger: {
        trigger: '.services-grid',
        start: 'top 80%',
      },
    }
  );

  /* ── Process cards stagger ── */
  gsap.fromTo('.process-card',
    { opacity: 0, y: 40 },
    {
      opacity: 1, y: 0,
      duration: 0.7,
      stagger: 0.12,
      ease: 'power3.out',
      scrollTrigger: { trigger: '.process-cards', start: 'top 78%' },
    }
  );

  /* ── Stat counters ── */
  document.querySelectorAll('.stat-num').forEach((el) => {
    const target  = parseFloat(el.dataset.target);
    const decimal = el.classList.contains('stat-decimal');
    const obj     = { val: 0 };

    ScrollTrigger.create({
      trigger: el,
      start: 'top 85%',
      once: true,
      onEnter: () => {
        gsap.to(obj, {
          val: target,
          duration: 2,
          ease: 'power2.out',
          onUpdate: () => {
            el.textContent = decimal
              ? obj.val.toFixed(1)
              : Math.floor(obj.val).toString();
          },
        });
      },
    });
  });

  /* ── Brand pills stagger ── */
  gsap.fromTo('.brand-pill',
    { opacity: 0, scale: 0.9 },
    {
      opacity: 1,
      scale: 1,
      duration: 0.5,
      stagger: { amount: 0.8, from: 'start' },
      ease: 'power2.out',
      scrollTrigger: {
        trigger: '.brands-grid',
        start: 'top 80%',
      },
    }
  );

  /* ── Before/After slider ── */
  initBeforeAfter();

  /* ── Testimonials carousel ── */
  initTestimonials();

  /* ── Nav background on scroll ── */
  const nav = document.getElementById('nav');
  ScrollTrigger.create({
    trigger: document.body,
    start: 'top -80px',
    onEnter:      () => nav.classList.add('scrolled'),
    onLeaveBack:  () => nav.classList.remove('scrolled'),
  });

});

/* ─── Before/After slider ─── */
function initBeforeAfter() {
  const slider = document.getElementById('ba-slider');
  const after  = slider?.querySelector('.ba-after');
  const handle = document.getElementById('ba-handle');
  if (!slider || !after || !handle) return;

  let dragging  = false;
  let currentPct = 100;

  function setPosition(pct) {
    currentPct = Math.max(2, Math.min(100, pct));
    after.style.clipPath  = `inset(0 ${100 - currentPct}% 0 0)`;
    handle.style.left     = `${currentPct}%`;
  }

  setPosition(100);

  function getPercent(clientX) {
    const rect = slider.getBoundingClientRect();
    return ((clientX - rect.left) / rect.width) * 100;
  }

  function startDrag(e) {
    e.preventDefault();
    dragging = true;
    document.body.style.userSelect = 'none';
    document.body.style.webkitUserSelect = 'none';
  }
  function endDrag() {
    dragging = false;
    document.body.style.userSelect = '';
    document.body.style.webkitUserSelect = '';
  }

  handle.addEventListener('mousedown',  startDrag);
  slider.addEventListener('mousedown',  startDrag);
  window.addEventListener('mouseup',    endDrag);
  window.addEventListener('mousemove',  (e) => { if (dragging) setPosition(getPercent(e.clientX)); });

  handle.addEventListener('touchstart', (e) => { dragging = true; }, { passive: true });
  window.addEventListener('touchend',   endDrag);
  window.addEventListener('touchmove',  (e) => {
    if (dragging) setPosition(getPercent(e.touches[0].clientX));
  }, { passive: true });

  /* Animate in */
  ScrollTrigger.create({
    trigger: '#before-after',
    start: 'top 75%',
    once: true,
    onEnter: () => {
      gsap.fromTo({ pct: 100 }, { pct: 100 }, {
        pct: 50,
        duration: 1.6,
        ease: 'power3.out',
        onUpdate: function() { setPosition(this.targets()[0].pct); },
      });
    },
  });
}

/* ─── Testimonials carousel ─── */
function initTestimonials() {
  const track  = document.getElementById('testi-track');
  const dots   = document.querySelectorAll('.dot');
  const prev   = document.querySelector('.testi-prev');
  const next   = document.querySelector('.testi-next');
  if (!track) return;

  const cards = track.querySelectorAll('.testimonial-card');
  let   current = 0;
  const total   = cards.length;

  function goTo(idx) {
    current = (idx + total) % total;
    const cardW  = cards[0].offsetWidth + 24; // width + gap
    gsap.to(track, {
      x: -current * cardW,
      duration: 0.6,
      ease: 'power3.out',
    });
    dots.forEach((d, i) => d.classList.toggle('active', i === current));
  }

  prev?.addEventListener('click', () => goTo(current - 1));
  next?.addEventListener('click', () => goTo(current + 1));
  dots.forEach((d) => d.addEventListener('click', () => goTo(parseInt(d.dataset.index))));

  /* Auto-advance every 6 s */
  let autoTimer = setInterval(() => goTo(current + 1), 6000);
  track.addEventListener('mouseenter', () => clearInterval(autoTimer));
  track.addEventListener('mouseleave', () => {
    autoTimer = setInterval(() => goTo(current + 1), 6000);
  });

  /* Recalculate on resize */
  window.addEventListener('resize', () => goTo(current));
}
