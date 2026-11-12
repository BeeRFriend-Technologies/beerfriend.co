(() => {
  'use strict';
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

  // Body copy stays visible; only the illustrated journey responds to scrolling.
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

  const video = document.querySelector('#product-video');
  if (video) {
    const player = video.closest('.film-player');
    const controls = player.querySelector('.film-controls');
    const toggle = player.querySelector('.film-toggle');
    const sound = player.querySelector('.film-sound');
    let inView = false, userPaused = false, previewActive = window.flightPreview?.active ?? true;
    video.controls = false;
    controls.hidden = false;
    const sync = () => {
      player.classList.toggle('is-playing', !video.paused);
      player.classList.toggle('has-sound', !video.muted);
      toggle.setAttribute('aria-label', video.ended ? '영상 다시 재생' : video.paused ? '영상 재생' : '영상 일시정지');
      sound.setAttribute('aria-label', video.muted ? '영상 소리 켜기' : '영상 음소거');
      sound.setAttribute('aria-pressed', String(!video.muted));
      sound.querySelector('span').textContent = video.muted ? '소리 켜기' : '소리 끄기';
    };
    const play = () => video.play().catch(() => { sync(); });
    toggle.addEventListener('click', () => {
      if (video.paused) { userPaused = false; play(); }
      else { userPaused = true; video.pause(); }
    });
    sound.addEventListener('click', () => { video.muted = !video.muted; sync(); });
    ['play', 'pause', 'ended', 'volumechange'].forEach(event => video.addEventListener(event, sync));
    video.addEventListener('ended', () => { userPaused = true; });
    const autoPlay = () => { if (inView && previewActive && !document.hidden && !userPaused && !reducedMotion.matches) play(); };
    new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting && entry.intersectionRatio >= .55;
      if (inView) autoPlay(); else video.pause();
    }, { threshold: [0, .55] }).observe(video);
    document.addEventListener('visibilitychange', () => { if (document.hidden) video.pause(); else autoPlay(); });
    document.addEventListener('flight-preview-state', event => { previewActive = event.detail.active; if (!previewActive) video.pause(); else autoPlay(); });
    reducedMotion.addEventListener('change', () => { if (reducedMotion.matches) video.pause(); else autoPlay(); });
    sync();
  }
  document.querySelector('#current-year').textContent = new Date().getFullYear();
})();
