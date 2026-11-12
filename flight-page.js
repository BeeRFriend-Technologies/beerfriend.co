(() => {
  'use strict';
  const embedded = new URLSearchParams(location.search).has('preview');
  const world = document.querySelector('.flight-world');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let previewActive = !embedded, rendererEnabled = true, controller;
  const clamp = value => Math.min(1, Math.max(0, value));
  document.documentElement.style.scrollBehavior = 'auto';

  // The comparison shell preserves a reading location, not a replay of the intro.
  const sections = [...document.querySelectorAll('main > section[id], footer')];
  function capture() {
    const top = scrollY;
    let section = sections[0];
    for (const item of sections) {
      if (item.getBoundingClientRect().top + top <= top + Math.min(120, innerHeight * .15)) section = item;
    }
    return { id: section?.id || 'footer', offset: section ? (top - (section.getBoundingClientRect().top + top)) / Math.max(1, section.offsetHeight) : 0 };
  }
  function setActive(active, state) {
    previewActive = active;
    if (active && state) {
      const section = state.id === 'footer' ? document.querySelector('footer') : document.getElementById(state.id);
      if (section) scrollTo({ top: section.getBoundingClientRect().top + scrollY + state.offset * section.offsetHeight, behavior: 'instant' });
    }
    controller?.activate(active);
    document.dispatchEvent(new CustomEvent('flight-preview-state', { detail: { active } }));
  }
  window.flightPreview = { capture, setActive, get active() { return previewActive; } };

  window.createFlightLoop = ({ canvas, resize, draw }) => {
    let width = 0, height = 0, distance = 1, target = 0, progress = 0;
    let frame = 0, lastDraw = 0, dirty = true, snap = true, frames = 0, lastScroll = scrollY;
    const canDraw = () => previewActive && rendererEnabled && !document.hidden;
    function cancel() { cancelAnimationFrame(frame); frame = 0; }
    function measure() {
      const w = Math.max(1, world.clientWidth), h = Math.max(1, world.clientHeight);
      if (width !== w || height !== h) { width = w; height = h; resize(w, h); dirty = true; }
      distance = Math.max(1, document.documentElement.scrollHeight - innerHeight);
      target = reduced.matches ? 0 : clamp(scrollY / distance);
    }
    function render(now) {
      frame = 0;
      if (!canDraw()) return;
      const interval = width <= 720 ? 40 : 32;
      if (!snap && now - lastDraw < interval) { frame = requestAnimationFrame(render); return; }
      const dt = Math.min(64, now - lastDraw || interval);
      lastDraw = now;
      const delta = target - progress;
      progress = snap || reduced.matches || Math.abs(delta) < .00015 ? target : progress + delta * (1 - Math.exp(-dt / 54));
      snap = false; dirty = false;
      draw(progress, reduced.matches ? 0 : now / 1000);
      canvas.dataset.frames = String(++frames);
      canvas.dataset.progress = progress.toFixed(5);
      const shade = Math.min(1, Math.max(0, (progress - .025) / .085));
      world.style.setProperty('--reading-shade', shade.toFixed(3));
      document.body.classList.add('scene-ready');
      document.querySelector('.journey')?.classList.add('scene-ready');
      if (Math.abs(target - progress) > .00001 || dirty) schedule();
    }
    function schedule() { if (!frame && canDraw()) frame = requestAnimationFrame(render); }
    function requestDraw() { dirty = true; measure(); schedule(); }
    function activate(active) {
      cancel();
      if (active && canDraw()) { measure(); progress = target; snap = true; dirty = true; render(performance.now()); }
    }
    controller = { activate };
    addEventListener('scroll', () => {
      const next = scrollY;
      // Navigation and restored tabs jump immediately; native wheel/touch scrolls track smoothly.
      if (Math.abs(next - lastScroll) > height * .65) snap = true;
      lastScroll = next;
      const nextTarget = reduced.matches ? 0 : clamp(next / distance);
      if (target !== nextTarget) { target = nextTarget; schedule(); }
    }, { passive: true });
    document.addEventListener('click', event => {
      if (event.target.closest('a[href^="#"]')) snap = true;
    }, { capture: true });
    const observer = new ResizeObserver(() => { dirty = true; if (canDraw()) { measure(); snap = true; schedule(); } });
    observer.observe(world); observer.observe(document.body);
    addEventListener('resize', () => { measure(); snap = true; dirty = true; schedule(); }, { passive: true });
    document.addEventListener('visibilitychange', () => activate(!document.hidden));
    reduced.addEventListener('change', () => { snap = true; requestDraw(); });
    document.fonts?.ready.then(requestDraw);
    measure(); schedule();
    document.querySelector('.journey')?.classList.add('is-enhanced');
    return { requestDraw, setEnabled(value) { rendererEnabled = value; activate(value); } };
  };
})();
