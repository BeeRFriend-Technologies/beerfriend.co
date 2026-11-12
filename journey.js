(() => {
  'use strict';
  const journey = document.querySelector('.journey');
  const canvas = document.querySelector('#flight-scene');
  const context = canvas?.getContext('2d', { alpha: false });
  if (!journey || !context) return;

  const stage = journey.querySelector('.journey-stage');
  const panels = [...journey.querySelectorAll('[data-flight-panel]')];
  const stops = [...journey.querySelectorAll('[data-flight-stop]')];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const clamp = (n, a = 0, b = 1) => Math.min(b, Math.max(a, n));
  const mix = (a, b, t) => a + (b - a) * t;
  const smooth = (a, b, n) => { const t = clamp((n - a) / (b - a)); return t * t * (3 - 2 * t); };
  let seed = 41;
  const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const stars = Array.from({ length: 155 }, () => ({ x: random(), y: random(), r: .25 + random() * 1.1, a: .15 + random() * .65 }));
  const clouds = Array.from({ length: 20 }, () => ({ x: random(), y: random(), r: .12 + random() * .18 }));
  const sparks = Array.from({ length: 35 }, () => ({ x: random() - .5, y: random(), s: random() }));
  let width = 1, height = 1, mobile = false, progress = 0, target = 0;
  let visible = true, frame = 0, lastDraw = 0, moon = null, earth = null, activePanel = -1;
  let start = 0, distance = 1;
  const rocket = new Image(); rocket.src = 'assets/launch-vehicle.svg';
  const moonMap = new Image(); moonMap.src = 'assets/moon-map.jpg';
  const earthImage = new Image(); earthImage.src = 'assets/earth-globe.jpg';

  const smoke = document.createElement('canvas'); smoke.width = smoke.height = 128;
  const sc = smoke.getContext('2d');
  const sg = sc.createRadialGradient(64, 64, 0, 64, 64, 64);
  sg.addColorStop(0, 'rgba(160,166,179,.42)'); sg.addColorStop(.4, 'rgba(135,145,166,.16)'); sg.addColorStop(1, 'rgba(125,135,160,0)');
  sc.fillStyle = sg; sc.fillRect(0, 0, 128, 128);

  // Project the credited longitude/latitude color map once, then reuse the shaded sphere.
  function makeMoon(image) {
    const source = document.createElement('canvas'); source.width = image.width; source.height = image.height;
    const src = source.getContext('2d', { willReadFrequently: true }); src.drawImage(image, 0, 0);
    const data = src.getImageData(0, 0, source.width, source.height).data;
    const sphere = document.createElement('canvas'); sphere.width = sphere.height = 640;
    const out = sphere.getContext('2d'); const pixels = out.createImageData(640, 640);
    for (let y = 0; y < 640; y++) for (let x = 0; x < 640; x++) {
      const nx = (x + .5 - 320) / 320, ny = (y + .5 - 320) / 320;
      const rr = nx * nx + ny * ny; if (rr > 1) continue;
      const nz = Math.sqrt(1 - rr);
      const u = Math.floor((Math.atan2(nx, nz) / (2 * Math.PI) + .5) * source.width) % source.width;
      const v = Math.min(source.height - 1, Math.floor((Math.asin(ny) / Math.PI + .5) * source.height));
      const si = (v * source.width + u) * 4, di = (y * 640 + x) * 4;
      const light = .12 + .98 * Math.max(0, -.58 * nx - .32 * ny + .74 * nz);
      pixels.data[di] = Math.min(255, data[si] * light * 1.18);
      pixels.data[di + 1] = Math.min(255, data[si + 1] * light * 1.19);
      pixels.data[di + 2] = Math.min(255, data[si + 2] * light * 1.22);
      pixels.data[di + 3] = Math.min(255, (1 - Math.sqrt(rr)) * 320 * 255);
    }
    out.putImageData(pixels, 0, 0); return sphere;
  }
  moonMap.onload = () => { moon = makeMoon(moonMap); schedule(); };
  earthImage.onload = () => { earth = earthImage; schedule(); };
  rocket.onload = schedule;

  function glow(x, y, radius, color, strength = 1) {
    if (radius < 1 || strength <= 0) return;
    const g = context.createRadialGradient(x, y, 0, x, y, radius);
    g.addColorStop(0, color); g.addColorStop(1, 'transparent');
    context.save(); context.globalAlpha *= strength; context.fillStyle = g;
    context.fillRect(x - radius, y - radius, radius * 2, radius * 2); context.restore();
  }

  function drawEarth(p) {
    const alpha = smooth(.24, .39, p); if (!alpha) return;
    const pullback = smooth(.32, .82, p);
    const r = mix(Math.max(width * .85, height), Math.min(width, height) * .13, pullback);
    const x = mix(width * .5, width * .13, pullback), y = mix(height * .9 + r * .86, height * .81, pullback);
    context.save(); context.globalAlpha = alpha;
    glow(x, y, r * 1.07, 'rgba(76,151,229,.42)');
    context.beginPath(); context.arc(x, y, r, 0, Math.PI * 2); context.clip();
    if (earth) context.drawImage(earth, earth.width * .058, earth.height * .058, earth.width * .884, earth.height * .884, x - r, y - r, r * 2, r * 2);
    else { context.fillStyle = '#28465c'; context.fillRect(x - r, y - r, r * 2, r * 2); }
    const shadow = context.createLinearGradient(x - r, y - r, x + r, y + r);
    shadow.addColorStop(0, 'rgba(4,8,17,.1)'); shadow.addColorStop(.6, 'rgba(4,8,17,.5)'); shadow.addColorStop(1, 'rgba(4,8,17,.98)');
    context.fillStyle = shadow; context.fillRect(x - r, y - r, r * 2, r * 2); context.restore();
    context.save(); context.globalAlpha = alpha * .5; context.strokeStyle = '#8bb7e3'; context.lineWidth = Math.max(1, r * .003);
    context.beginPath(); context.arc(x, y, r, Math.PI * 1.1, Math.PI * 1.8); context.stroke(); context.restore();
  }

  function drawGround(p, time, rocketX) {
    const lift = smooth(.07, .42, p), alpha = 1 - smooth(.27, .43, p);
    if (!alpha) return;
    const ground = height * (mobile ? .78 : .84);
    context.save(); context.globalAlpha = alpha; context.translate(0, lift * height * .85);
    glow(rocketX, ground, Math.min(width * .5, 420), 'rgba(213,134,70,.4)', 1 - lift * .5);
    for (let layer = 0; layer < 3; layer++) {
      context.beginPath(); context.moveTo(0, height * 1.3);
      for (let x = 0; x <= width + 20; x += 20) {
        const hill = Math.sin(x / width * 9 + layer) * 12 + Math.sin(x / width * 24 + layer) * 5;
        context.lineTo(x, ground + layer * 22 + hill * (1 - Math.exp(-Math.pow((x - rocketX) / 130, 2))));
      }
      context.lineTo(width, height * 1.3); context.closePath();
      context.fillStyle = ['#19202a', '#121923', '#0b111a'][layer]; context.fill();
    }
    // A road and lit pad locate the launch on solid ground, before the camera climbs.
    context.fillStyle = '#1b2027'; context.beginPath(); context.moveTo(rocketX - 28, ground); context.lineTo(rocketX + 28, ground);
    context.lineTo(rocketX + width * .15, height * 1.3); context.lineTo(rocketX - width * .2, height * 1.3); context.fill();
    context.fillStyle = '#685546'; context.fillRect(rocketX - 36, ground - 3, 72, 4);
    for (let n = 0; n < 10; n++) {
      const x = rocketX + (n - 5) * (mobile ? 18 : 38), y = ground + 19 + Math.abs(n - 5) * 4;
      glow(x, y, 8, 'rgba(240,184,100,.55)'); context.fillStyle = '#c69b61'; context.fillRect(x, y, 1.5, 1.5);
    }
    const towerH = Math.min(height * .2, 188), tx = rocketX - (mobile ? 30 : 43), tw = mobile ? 13 : 18;
    context.strokeStyle = '#6b6560'; context.lineWidth = 1;
    context.strokeRect(tx - tw, ground - towerH, tw, towerH);
    for (let i = 0; i < 8; i++) {
      const y = ground - i * towerH / 8;
      context.beginPath(); context.moveTo(tx - tw, y); context.lineTo(tx, y - towerH / 8); context.moveTo(tx, y); context.lineTo(tx - tw, y - towerH / 8); context.stroke();
    }
    context.beginPath(); context.moveTo(tx, ground - towerH * .85); context.lineTo(rocketX - 6, ground - towerH * .85); context.stroke();
    glow(tx - tw / 2, ground - towerH, 15, 'rgba(230,97,55,.4)');
    context.fillStyle = '#d47a54'; context.fillRect(tx - tw / 2, ground - towerH - 2, 2, 2);
    const ignition = .35 + smooth(0, .08, p) * .65;
    for (let n = 0; n < 16; n++) {
      const k = ((time * .07 + n / 16) % 1), side = n % 2 ? 1 : -1;
      const size = 30 + k * (mobile ? 90 : 160);
      context.globalAlpha = alpha * ignition * (1 - k) * .48;
      context.drawImage(smoke, rocketX + side * k * size * 1.6 - size / 2, ground - size * .38 + k * 12, size, size * .55);
    }
    context.restore();
  }

  function drawRocket(p, time, moonX, moonY, moonR) {
    const launch = smooth(.015, .28, p), cruise = smooth(.58, 1, p);
    const originX = width * (mobile ? .75 : .76), originY = height * (mobile ? .78 : .84);
    // After liftoff the vehicle stays near the camera's anchor while the world recedes.
    const midX = width * (mobile ? .68 : .74), midY = height * (mobile ? .63 : .59);
    const x = mix(mix(originX, midX, launch), moonX - moonR * .82, cruise);
    const y = mix(mix(originY, midY, launch), moonY + moonR * .82, cruise);
    const rocketHeight = mix(Math.min(height * (mobile ? height < 700 ? .17 : .21 : .28), 260), mobile ? 64 : 88, smooth(.3, 1, p));
    const rotation = smooth(.3, .95, p) * .92;
    context.save(); context.translate(x, y); context.rotate(rotation);
    const throttle = .12 + smooth(0, .06, p) * .88;
    const flameLength = (rocketHeight * .85) * throttle * (1 - smooth(.85, 1, p) * .8);
    const flameWidth = rocketHeight * .07;
    glow(0, 6, rocketHeight * .6, 'rgba(255,173,91,.22)', throttle);
    const flicker = reduced.matches ? 1 : 1 + .08 * Math.sin(time * 17) + .05 * Math.sin(time * 31);
    const flame = context.createLinearGradient(0, -4, 0, flameLength);
    flame.addColorStop(0, '#ffffe6'); flame.addColorStop(.18, '#ffe7ab'); flame.addColorStop(.5, '#e99a54'); flame.addColorStop(1, 'rgba(208,97,51,0)');
    context.fillStyle = flame; context.beginPath(); context.moveTo(-flameWidth / 2, -4);
    context.bezierCurveTo(-flameWidth * 1.2, flameLength * .2, -flameWidth * .7, flameLength * .65, 0, flameLength * flicker);
    context.bezierCurveTo(flameWidth * .7, flameLength * .65, flameWidth * 1.2, flameLength * .2, flameWidth / 2, -4); context.fill();
    context.fillStyle = '#fff5d2';
    sparks.forEach(s => {
      const v = (s.y + time * .65) % 1; context.globalAlpha = (1 - v) * throttle * .45;
      context.fillRect(s.x * flameWidth * 2.5 * v, v * flameLength, s.s + .4, 1 + v * 3);
    });
    context.globalAlpha = 1;
    if (rocket.complete && rocket.naturalWidth) context.drawImage(rocket, -rocketHeight * .1, -rocketHeight, rocketHeight * .2, rocketHeight);
    context.restore();
    return { x, y };
  }

  function draw(p, time) {
    const space = smooth(.18, .53, p);
    context.fillStyle = '#060b14'; context.fillRect(0, 0, width, height);
    const sky = context.createLinearGradient(0, 0, 0, height);
    sky.addColorStop(0, 'rgba(9,16,29,0)'); sky.addColorStop(.7, `rgba(32,53,75,${.65 * (1 - space)})`); sky.addColorStop(1, `rgba(77,74,67,${.35 * (1 - space)})`);
    context.fillStyle = sky; context.fillRect(0, 0, width, height);
    stars.forEach(s => {
      const x = s.x * width, y = (s.y * height + p * height * .24) % height;
      context.globalAlpha = s.a * (.2 + space * .8); context.fillStyle = '#cdd6e6';
      context.fillRect(x, y, s.r, s.r);
    }); context.globalAlpha = 1;
    drawEarth(p);
    const moonApproach = smooth(.48, 1, p);
    const compact = mobile && height < 700;
    const moonR = mix(mobile ? 9 : 16, Math.min(width * (mobile ? compact ? .26 : .31 : .2), height * .285), moonApproach);
    const moonX = mix(width * .83, width * (mobile ? .72 : .78), moonApproach);
    const moonY = mix(height * .21, height * (mobile ? compact ? .68 : .61 : .45), moonApproach);
    context.save(); context.globalAlpha = .28 + space * .72;
    if (moon) context.drawImage(moon, moonX - moonR, moonY - moonR, moonR * 2, moonR * 2);
    else { context.fillStyle = '#96938d'; context.beginPath(); context.arc(moonX, moonY, moonR, 0, Math.PI * 2); context.fill(); }
    context.restore();
    drawGround(p, time, width * (mobile ? .75 : .76));
    drawRocket(p, time, moonX, moonY, moonR);
    const cloudAlpha = smooth(.07, .19, p) * (1 - smooth(.29, .49, p));
    if (cloudAlpha > 0) {
      clouds.forEach(c => {
        const size = c.r * Math.max(width, height), y = c.y * height * 1.6 + (p - .27) * height * 3;
        context.globalAlpha = cloudAlpha * .36; context.drawImage(smoke, c.x * width - size / 2, y - size / 2, size * 2, size);
      }); context.globalAlpha = 1;
    }
    const bottom = context.createLinearGradient(0, height * .8, 0, height);
    bottom.addColorStop(0, 'transparent'); bottom.addColorStop(1, 'rgba(6,11,20,.82)');
    context.fillStyle = bottom; context.fillRect(0, height * .8, width, height * .2);
  }

  function updateCopy(p) {
    const phases = [1 - smooth(.12, .25, p), smooth(.26, .37, p) * (1 - smooth(.58, .7, p)), smooth(.7, .83, p)];
    const next = p < .26 ? 0 : p < .7 ? 1 : 2;
    panels.forEach((panel, i) => {
      const amount = phases[i];
      panel.style.opacity = String(amount);
      panel.style.transform = `translate3d(0,${(1 - amount) * (p > [0, .5, 1][i] ? -36 : 36)}px,0)`;
      if (activePanel !== next) { panel.inert = i !== next; panel.setAttribute('aria-hidden', String(i !== next)); }
    });
    if (activePanel !== next) {
      stops.forEach((button, i) => { if (i === next) button.setAttribute('aria-current', 'step'); else button.removeAttribute('aria-current'); });
      activePanel = next;
    }
    journey.style.setProperty('--flight-progress', String(.02 + p * .98));
    journey.dataset.flightPhase = ['earth', 'atmosphere', 'moon'][next];
  }

  function tick(now) {
    frame = 0;
    if (!visible || document.hidden) return;
    if (now - lastDraw >= 32 || reduced.matches) {
      lastDraw = now;
      progress = reduced.matches ? 0 : Math.abs(target - progress) < .0004 ? target : mix(progress, target, .22);
      draw(progress, reduced.matches ? 0 : now / 1000); updateCopy(progress);
      journey.classList.add('scene-ready');
    }
    if (!reduced.matches) frame = requestAnimationFrame(tick);
  }
  function schedule() { if (!frame && visible && !document.hidden) frame = requestAnimationFrame(tick); }
  function readScroll() { target = reduced.matches ? 0 : clamp((scrollY - start) / distance); schedule(); }
  function resize() {
    width = stage.clientWidth; height = stage.clientHeight; mobile = width <= 720;
    const dpr = Math.min(devicePixelRatio || 1, mobile ? 1.5 : 1.8);
    canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    start = scrollY + journey.getBoundingClientRect().top; distance = Math.max(1, journey.offsetHeight - height);
    readScroll();
  }
  journey.classList.add('is-enhanced');
  stops.forEach(button => button.addEventListener('click', () => {
    scrollTo({ top: start + distance * Number(button.dataset.flightStop), behavior: reduced.matches ? 'instant' : 'smooth' });
  }));
  new ResizeObserver(resize).observe(stage);
  new IntersectionObserver(([entry]) => { const wasVisible = visible; visible = entry.isIntersecting; if (visible) { readScroll(); if (!wasVisible) progress = target; schedule(); } else { cancelAnimationFrame(frame); frame = 0; } }).observe(journey);
  addEventListener('scroll', readScroll, { passive: true });
  document.addEventListener('visibilitychange', () => { if (document.hidden) { cancelAnimationFrame(frame); frame = 0; } else schedule(); });
  reduced.addEventListener('change', () => { progress = target = 0; activePanel = -1; resize(); });
  resize();
})();
