// motion.js
// Animation is an extra, never a requirement. Everything here checks that
// GSAP/Lenis actually loaded and that the user hasn't asked for reduced
// motion, and quietly does nothing otherwise.

(function (root) {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let lenis = null;

  function ready() {
    return !reduced && typeof window.gsap !== 'undefined';
  }

  // Smooth scrolling on the landing page only. App screens use normal
  // scrolling because that's what people expect inside an app.
  function startSmoothScroll() {
    if (reduced || lenis || typeof window.Lenis === 'undefined') return;
    lenis = new window.Lenis({ lerp: 0.1 });
    if (window.ScrollTrigger && window.gsap) {
      // keep ScrollTrigger in step with Lenis, as the Lenis docs describe
      lenis.on('scroll', window.ScrollTrigger.update);
      window.gsap.ticker.add(time => lenis.raf(time * 1000));
      window.gsap.ticker.lagSmoothing(0);
    } else {
      const loop = time => { lenis.raf(time); requestAnimationFrame(loop); };
      requestAnimationFrame(loop);
    }
  }

  function stopSmoothScroll() {
    if (lenis) { lenis.destroy(); lenis = null; }
  }

  function landing() {
    startSmoothScroll();
    if (!ready()) return;
    const gsap = window.gsap;
    if (window.ScrollTrigger) gsap.registerPlugin(window.ScrollTrigger);

    // headline lines rise in, then the card stack deals itself out
    gsap.from('.hero h1', { y: 40, opacity: 0, duration: 0.8, ease: 'power3.out' });
    gsap.from('.hero p, .hero-actions, .badge', { y: 20, opacity: 0, duration: 0.6, delay: 0.2, stagger: 0.08, ease: 'power2.out' });
    gsap.from('.hero-card, .held-card', { y: 60, opacity: 0, duration: 0.7, delay: 0.3, stagger: 0.1, ease: 'back.out(1.4)' });

    if (window.ScrollTrigger) {
      gsap.utils.toArray('.step, .safety-item, .cat-row').forEach(el => {
        gsap.from(el, { y: 40, opacity: 0, duration: 0.6, ease: 'power2.out', scrollTrigger: { trigger: el, start: 'top 88%' } });
      });
    }
  }

  // feed cards slide up one after another, like dealing cards
  function stack(selector) {
    stopSmoothScroll();
    if (!ready()) return;
    window.gsap.from(selector, { y: 30, opacity: 0, duration: 0.45, stagger: 0.06, ease: 'power2.out' });
  }

  function screen() {
    stopSmoothScroll();
    if (!ready()) return;
    window.gsap.from('#root .app > *', { y: 16, opacity: 0, duration: 0.35, stagger: 0.04, ease: 'power2.out' });
  }

  function cleanup() {
    if (window.ScrollTrigger) window.ScrollTrigger.getAll().forEach(t => t.kill());
  }

  root.Motion = { landing, stack, screen, cleanup };
})(window);
