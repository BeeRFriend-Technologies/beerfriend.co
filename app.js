(() => {
  'use strict';
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const animations = new Set();
  const ease = 'cubic-bezier(.16,1,.3,1)';
  function animate(element, frames, options = {}) {
    if (!element || reducedMotion.matches || !element.animate) return;
    const animation = element.animate(frames, { duration: 1000, easing: ease, ...options });
    animations.add(animation);
    animation.finished.catch(() => {}).finally(() => animations.delete(animation));
    return animation;
  }
  reducedMotion.addEventListener('change', () => {
    if (reducedMotion.matches) animations.forEach(animation => animation.finish());
  });

  // Type enters once, then leaves the quote still and readable.
  document.querySelectorAll('.intro-line > span').forEach((line, index) => {
    animate(line, [{ transform: 'translateY(110%) rotateX(28deg)', filter: 'blur(8px)', letterSpacing: '.025em' }, { transform: 'translateY(0) rotateX(0)', filter: 'blur(0)', letterSpacing: '-.065em' }], { duration: 1450, delay: 100 + index * 200, fill: 'backwards' });
  });
  document.querySelectorAll('.quote-continuation, .hero-company, .opening-copy > a').forEach((element, index) => {
    animate(element, [{ opacity: 0, transform: 'translateY(20px)' }, { opacity: 1, transform: 'translateY(0)' }], { delay: 420 + index * 120, duration: 850, fill: 'backwards' });
  });
  const revealTargets = document.querySelectorAll('.company-intro, .company-principles > div, .product-intro, .product-showcase, .culture-heading, .culture-values article, .working-heading, .working-cycle li, .working-notes, .culture-boundary, .team-heading, .team-people article, .careers-heading, .careers-grid, .application');
  const revealObserver = new IntersectionObserver(entries => {
    let order = 0;
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      revealObserver.unobserve(entry.target);
      entry.target.classList.add('is-in-view');
      if (entry.target.contains(document.activeElement)) return;
      const animation = animate(entry.target, [{ opacity: 0, transform: 'translateY(32px)' }, { opacity: 1, transform: 'translateY(0)' }], { delay: Math.min(order++, 3) * 90, duration: 850, fill: 'backwards' });
      if (animation) entry.target.addEventListener('focusin', () => animation.finish(), { once: true });
    });
  }, { threshold: .08 });
  revealTargets.forEach(element => revealObserver.observe(element));

  const hero = document.querySelector('.hero');
  if (hero) {
    let frame = 0, pointerX = 0, pointerY = 0;
    const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
    const update = () => {
      frame = 0;
      const bounds = hero.getBoundingClientRect();
      const progress = reducedMotion.matches ? 0 : Math.max(0, Math.min(1, -bounds.top / bounds.height));
      hero.style.setProperty('--hero-shift', (progress * 90) + 'px');
      hero.style.setProperty('--hero-scale', String(1 - progress * .06));
      hero.style.setProperty('--hero-opacity', String(Math.max(0, 1 - progress * 1.15)));
      document.body.style.setProperty('--sky-x', reducedMotion.matches ? '0px' : (pointerX * 12) + 'px');
      document.body.style.setProperty('--sky-y', reducedMotion.matches ? '0px' : (pointerY * 10 - progress * 18) + 'px');
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
    hero.addEventListener('pointermove', event => {
      if (reducedMotion.matches || !finePointer.matches) return;
      const bounds = hero.getBoundingClientRect();
      pointerX = (event.clientX - bounds.left) / bounds.width - .5;
      pointerY = (event.clientY - bounds.top) / bounds.height - .5;
      hero.style.setProperty('--spot-x', ((pointerX + .5) * 100) + '%');
      hero.style.setProperty('--spot-y', ((pointerY + .5) * 100) + '%');
      schedule();
    }, { passive: true });
    hero.addEventListener('pointerleave', () => { pointerX = 0; pointerY = 0; schedule(); });
    addEventListener('scroll', schedule, { passive: true });
    addEventListener('resize', schedule);
    reducedMotion.addEventListener('change', schedule);
    schedule();
  }
  document.querySelectorAll('.culture-values article, .invitation-section > .button').forEach(element => {
    element.addEventListener('pointermove', event => {
      if (reducedMotion.matches || event.pointerType !== 'mouse') return;
      const bounds = element.getBoundingClientRect();
      element.style.setProperty('--pointer-x', (event.clientX - bounds.left) + 'px');
      element.style.setProperty('--pointer-y', (event.clientY - bounds.top) + 'px');
    }, { passive: true });
  });

  const menuButton = document.querySelector('.menu-toggle');
  const mobileNav = document.querySelector('#mobile-nav');
  function closeMenu() {
    menuButton.setAttribute('aria-expanded', 'false');
    menuButton.setAttribute('aria-label', '메뉴 열기'); mobileNav.hidden = true;
  }
  menuButton.addEventListener('click', () => {
    const open = menuButton.getAttribute('aria-expanded') !== 'true';
    menuButton.setAttribute('aria-expanded', String(open)); menuButton.setAttribute('aria-label', open ? '메뉴 닫기' : '메뉴 열기'); mobileNav.hidden = !open;
  });
  mobileNav.querySelectorAll('a').forEach(link => link.addEventListener('click', closeMenu));
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && !mobileNav.hidden) { closeMenu(); menuButton.focus(); } });
  document.addEventListener('click', event => { if (!mobileNav.hidden && !event.target.closest('.site-header')) closeMenu(); });
  matchMedia('(min-width:961px)').addEventListener('change', event => { if (event.matches) closeMenu(); });

  const slides = document.querySelector('#product-slides');
  if (slides) {
  const slideButtons = [...document.querySelectorAll('[data-slide]')];
  const slideCaption = document.querySelector('#slide-caption');
  const captions = ['문자로 나눈 이야기를, 목소리로 이어갑니다.', '오늘의 이야기도, 모아의 목소리와 함께.'];
  let activeSlide = 0, slideFrame = 0, slideWidth = slides.clientWidth;
  function syncSlide() {
    slideFrame = 0;
    if (!slides.clientWidth || slides.clientWidth !== slideWidth) return;
    activeSlide = Math.max(0, Math.min(slideButtons.length - 1, Math.round(slides.scrollLeft / slides.clientWidth)));
    slideButtons.forEach((button, index) => button.setAttribute('aria-pressed', String(index === activeSlide)));
    if (slideCaption.textContent !== captions[activeSlide]) slideCaption.textContent = captions[activeSlide];
  }
  function showSlide(index) {
    const target = Math.max(0, Math.min(slideButtons.length - 1, index));
    requestAnimationFrame(() => slides.scrollTo({ left: target * slides.clientWidth, behavior: reducedMotion.matches ? 'instant' : 'smooth' }));
  }
  slideButtons.forEach((button, index) => button.addEventListener('click', () => showSlide(index)));
  slides.addEventListener('scroll', () => { if (!slideFrame) slideFrame = requestAnimationFrame(syncSlide); }, { passive: true });
  slides.addEventListener('keydown', event => {
    const target = event.key === 'ArrowRight' ? activeSlide + 1 : event.key === 'ArrowLeft' ? activeSlide - 1 : event.key === 'Home' ? 0 : event.key === 'End' ? slideButtons.length - 1 : null;
    if (target !== null) { event.preventDefault(); showSlide(target); }
  });
  new ResizeObserver(() => {
    if (!slides.clientWidth || slides.clientWidth === slideWidth) return;
    slideWidth = slides.clientWidth;
    slides.scrollTo({ left: activeSlide * slideWidth, behavior: 'instant' });
  }).observe(slides);

  }
  const video = document.querySelector('#product-video');
  if (video) {
    document.addEventListener('visibilitychange', () => { if (document.hidden) video.pause(); });
    new IntersectionObserver(([entry]) => { if (!entry.isIntersecting) video.pause(); }).observe(video);
  }
  document.querySelector('#current-year').textContent = new Date().getFullYear();
})();
