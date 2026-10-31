/* Kami v3.1 motion pack: 3D card tilt + gold glare, pinned horizontal projects strip, outlined word marquees,
   image wipe reveals, custom desktop cursor, decoder stats. main.js calls KamiMotion() from KamiInit() after every render.
   Only transform / opacity / clip-path are animated; every loop is requestAnimationFrame and stops when idle or off screen. */
(() => {
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const mq = q => matchMedia(q);

/* ---- custom cursor (desktop, fine pointer only; off under reduced motion). Kami's Arthur cursor:
   normally Dawn's Ballad (Arthur's sword, drawn in our own SVG) with its tip as the hotspot; over links, buttons and cards it
   swaps (scale + crossfade) to the full-body "Grey" chibi pointing at the hotspot (a tiny gold dot), with a soft violet aether
   glow. A light violet particle trail follows movement (pooled, max 10, rAF only while alive). Built once; survives re-renders. */
const Cursor = (() => {
  const root = document.documentElement;
  const fine = mq('(hover: hover) and (pointer: fine)'), rm = mq('(prefers-reduced-motion: reduce)');
  let box = null, dot = null, label = null, parts = [], built = false, active = false, raf = 0, shown = false;
  let tx = -200, ty = -200, rx = -200, ry = -200, last = 0, mode = '', lastSpawn = 0, pi = 0, lastPX = 0, lastPY = 0;
  const PMAX = 10;
  const want = () => fine.matches && !rm.matches && !root.classList.contains('preview');
  const mk = (tag, cls, parent) => { const n = document.createElement(tag); n.className = cls; (parent || document.body).appendChild(n); return n; };
  const build = () => {
    if (built) return; built = true;
    for (let i = 0; i < PMAX; i++) { const s = mk('span', 'cur-p'); s.setAttribute('aria-hidden', 'true'); parts.push({ el: s, life: 0, x: 0, y: 0, vx: 0, vy: 0, s: 1 }); }
    box = mk('div', 'cur-char'); box.setAttribute('aria-hidden', 'true');
    mk('span', 'cur-aura', box);
    const sword = mk('img', 'cur-sword', box); sword.alt = ''; sword.decoding = 'async'; sword.src = '/images/cursor/dawns-ballad.svg';
    const body = mk('img', 'cur-grey', box); body.alt = ''; body.decoding = 'async'; body.src = '/images/cursor/arthur-grey.webp';
    label = mk('b', 'cur-label', box); label.textContent = 'View';
    dot = mk('div', 'cur-dot'); dot.setAttribute('aria-hidden', 'true');
  };
  const spawn = (now) => {
    if (mode === 'text') return;
    const hot = mode === 'link' || mode === 'view';
    if (now - lastSpawn < (hot ? 45 : 80)) return; lastSpawn = now;
    const p = parts[pi++ % PMAX];
    p.life = hot ? 1 : .75; p.x = tx + (hot ? 18 : 10) + (Math.random() - .5) * (hot ? 18 : 8); p.y = ty + (hot ? 22 : 12) + (Math.random() - .5) * (hot ? 18 : 8);
    p.vx = (Math.random() - .5) * 0.03; p.vy = 0.02 + Math.random() * 0.03; p.s = .5 + Math.random() * .7;
  };
  const loop = now => {
    raf = 0;
    const dt = last ? Math.min(64, now - last) : 16.7; last = now;
    rx = tx; ry = ty;   // the hotspot never lags; only the particles drift
    dot.style.transform = `translate3d(${tx}px,${ty}px,0)`;
    box.style.transform = `translate3d(${rx.toFixed(1)}px,${ry.toFixed(1)}px,0)`;
    let alive = false;
    for (const p of parts) {
      if (p.life <= 0) continue;
      p.life -= dt / 650; p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.life <= 0) { p.el.style.opacity = '0'; continue; }
      alive = true;
      p.el.style.transform = `translate3d(${p.x.toFixed(1)}px,${p.y.toFixed(1)}px,0) scale(${(p.s * (0.4 + p.life * 0.6)).toFixed(2)})`;
      p.el.style.opacity = (p.life * 0.7).toFixed(2);
    }
    if (rx !== tx || ry !== ty || alive) raf = requestAnimationFrame(loop); else last = 0;
  };
  const kick = () => { if (!raf) raf = requestAnimationFrame(loop); };
  const setMode = m => { if (m === mode) return; mode = m; root.dataset.cur = m; };
  const TEXT = 'input, textarea, select, [contenteditable]';
  const onMove = e => {
    if (e.pointerType !== 'mouse') { if (shown) hide(); root.classList.remove('has-cursor'); return; }
    if (!root.classList.contains('has-cursor')) root.classList.add('has-cursor');
    tx = e.clientX; ty = e.clientY;
    if (!shown) { rx = tx; ry = ty; shown = true; root.classList.add('cur-shown'); }
    if (Math.abs(tx - lastPX) + Math.abs(ty - lastPY) > 6) { spawn(e.timeStamp || performance.now()); lastPX = tx; lastPY = ty; }
    kick();
  };
  const onOver = e => {
    if (e.pointerType && e.pointerType !== 'mouse') return;
    const t = e.target; if (!t || !t.closest) return;
    if (t.closest(TEXT)) setMode('text');
    else if (t.closest('.card, .hs-end')) { label.textContent = t.closest('.hs-end') ? 'All' : 'View'; setMode('view'); }
    else if (t.closest('a, button, [role=button], label, summary, .copy')) setMode('link');
    else setMode('');
  };
  const hide = () => { shown = false; root.classList.remove('cur-shown'); };
  const onDown = () => root.classList.add('cur-down');
  const onUp = () => root.classList.remove('cur-down');
  const onOut = e => { if (!e.relatedTarget) hide(); };
  const enable = () => {
    if (active) return; active = true; build();
    addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('pointerover', onOver, { passive: true });
    document.addEventListener('pointerdown', onDown, { passive: true });
    document.addEventListener('pointerup', onUp, { passive: true });
    document.addEventListener('mouseout', onOut, { passive: true });
  };
  const disable = () => {
    if (!active) return; active = false;
    removeEventListener('pointermove', onMove); document.removeEventListener('pointerover', onOver);
    document.removeEventListener('pointerdown', onDown); document.removeEventListener('pointerup', onUp);
    document.removeEventListener('mouseout', onOut);
    hide(); root.classList.remove('has-cursor');
  };
  const sync = () => want() ? enable() : disable();
  fine.addEventListener('change', sync); rm.addEventListener('change', sync);
  return { sync };
})();

window.KamiMotion = function ({ signal, onAbort, reduce }) {
  const root = document.documentElement;
  const fine = mq('(hover: hover) and (pointer: fine)').matches;
  const hasIO = 'IntersectionObserver' in window;
  if (document.body) Cursor.sync();

  /* ---- 1. 3D tilt + gold glare on project cards. Mouse: tilt follows the pointer (max 8deg).
     Touch: a gentle tilt (max 4deg) follows the finger while it drags across a card; native scrolling is untouched. */
  if (!reduce) {
    const cards = [...document.querySelectorAll('.card')];
    const live = new Map();
    let raf = 0;
    const run = now => {
      raf = 0; let more = false;
      live.forEach((st, el) => {
        const dt = st.t ? Math.min(64, now - st.t) : 16.7; st.t = now;
        const k = 1 - Math.exp(-dt * (st.touch ? 0.012 : 0.02));
        st.cx += (st.gx - st.cx) * k; st.cy += (st.gy - st.cy) * k; st.co += (st.go - st.co) * k;
        const done = Math.abs(st.gx - st.cx) < 0.002 && Math.abs(st.gy - st.cy) < 0.002 && Math.abs(st.go - st.co) < 0.004;
        if (done) { st.cx = st.gx; st.cy = st.gy; st.co = st.go; }
        const ry = (st.cx - 0.5) * 2 * st.max, rx = (0.5 - st.cy) * 2 * st.max;
        el.style.transform = `perspective(1100px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg)`;
        if (st.glare) { st.glare.style.transform = `translate3d(${((st.cx - 0.5) * 46).toFixed(1)}%,0,0)`; st.glare.style.opacity = st.co.toFixed(3); }
        if (st.leaving && done) { live.delete(el); el.classList.remove('tilt-on'); el.style.transform = ''; if (st.glare) st.glare.style.opacity = ''; }
        else if (!done) more = true;
      });
      if (more) raf = requestAnimationFrame(run);
    };
    const kick = () => { if (!raf) raf = requestAnimationFrame(run); };
    const point = (st, el, x, y) => { const r = st.r || (st.r = el.getBoundingClientRect()); st.gx = clamp((x - r.left) / r.width, 0, 1); st.gy = clamp((y - r.top) / r.height, 0, 1); };
    const start = (el, touch, x, y) => {
      let st = live.get(el);
      if (!st) { st = { cx: .5, cy: .5, co: 0, gx: .5, gy: .5, go: 0, t: 0, glare: el.querySelector('.glare') }; live.set(el, st); }
      st.touch = touch; st.max = touch ? 4 : 8; st.leaving = false; st.go = touch ? .7 : 1; st.r = el.getBoundingClientRect();
      el.classList.add('tilt-on'); point(st, el, x, y); kick();
    };
    const end = el => { const st = live.get(el); if (!st) return; st.gx = .5; st.gy = .5; st.go = 0; st.leaving = true; kick(); };
    addEventListener('scroll', () => live.forEach(st => { st.r = null; }), { passive: true, signal });
    cards.forEach(el => {
      if (!el.querySelector('.glare')) { const g = document.createElement('span'); g.className = 'glare'; g.setAttribute('aria-hidden', 'true'); el.appendChild(g); }
      if (fine) {
        el.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') start(el, false, e.clientX, e.clientY); }, { signal });
        el.addEventListener('pointermove', e => { const st = live.get(el); if (st && !st.touch) { point(st, el, e.clientX, e.clientY); kick(); } }, { passive: true, signal });
        el.addEventListener('pointerleave', () => end(el), { signal });
      }
      el.addEventListener('touchstart', e => { const t = e.touches[0]; if (t) start(el, true, t.clientX, t.clientY); }, { passive: true, signal });
      el.addEventListener('touchmove', e => { const st = live.get(el), t = e.touches[0]; if (st && t) { st.r = null; point(st, el, t.clientX, t.clientY); kick(); } }, { passive: true, signal });
      el.addEventListener('touchend', () => end(el), { passive: true, signal });
      el.addEventListener('touchcancel', () => end(el), { passive: true, signal });
    });
    onAbort(() => { if (raf) cancelAnimationFrame(raf); live.forEach((st, el) => { el.classList.remove('tilt-on'); el.style.transform = ''; }); live.clear(); });
  }

  /* ---- 2. pinned horizontal strip: a tall section, a sticky viewport-high pin inside, and a track moved by translateX from
     the page's own (native) scroll progress. Reduced motion / no support: a native swipe + snap row instead. */
  const hs = document.querySelector('[data-hscroll]');
  if (hs) {
    const pin = hs.querySelector('.hs-pin'), track = hs.querySelector('.hs-track'), bar = hs.querySelector('.hs-bar i');
    const on = !reduce && CSS.supports('position', 'sticky');
    hs.classList.toggle('hs-on', on);
    if (on) {
      let start = 0, range = 1, dist = 0, lastX = null;
      const update = () => {
        const p = clamp((scrollY - start) / range, 0, 1);
        const x = Math.round(p * dist * 10) / 10;
        if (x !== lastX) { track.style.transform = `translate3d(${-x}px,0,0)`; if (bar) bar.style.transform = `scaleX(${p.toFixed(4)})`; lastX = x; }
      };
      const measure = () => {
        hs.style.height = '';
        dist = Math.max(0, track.offsetWidth - pin.clientWidth);
        const ph = pin.offsetHeight;
        hs.style.height = (ph + dist) + 'px';
        start = hs.getBoundingClientRect().top + scrollY;
        range = Math.max(1, dist);
        lastX = null; update();
      };
      addEventListener('scroll', update, { passive: true, signal });
      addEventListener('resize', measure, { passive: true, signal });
      if ('ResizeObserver' in window) { const ro = new ResizeObserver(() => measure()); ro.observe(track); ro.observe(document.body); onAbort(() => ro.disconnect()); }
      measure();
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (!signal.aborted) measure(); });
      // keyboard: tabbing to a card that is off to the side scrolls the page to the point where it is in view
      hs.addEventListener('focusin', e => {
        const c = e.target.closest('.hs-item'); if (!c) return;
        pin.scrollLeft = 0;
        const want = clamp(c.offsetLeft - (pin.clientWidth - c.offsetWidth) / 2, 0, dist);
        scrollTo({ top: start + want, behavior: 'instant' });
      }, { signal });
      onAbort(() => { hs.style.height = ''; track.style.transform = ''; hs.classList.remove('hs-on'); });
    }
  }

  /* ---- 3. outlined word marquees: drift on their own and speed up a little with scroll velocity; run only while on screen */
  const mqs = [...document.querySelectorAll('.marquee')];
  if (mqs.length && !reduce) {
    const state = mqs.map(el => ({ el, tr: el.querySelector('.mq-track'), w: 0, x: 0, dir: el.classList.contains('rev') ? 1 : -1, vis: false }));
    let raf = 0, lastT = 0, lastY = scrollY, vel = 0;
    const measure = () => state.forEach(s => { s.w = s.tr.firstElementChild ? s.tr.firstElementChild.offsetWidth : 0; });
    const loop = now => {
      raf = 0;
      const dt = lastT ? Math.min(64, now - lastT) : 16.7; lastT = now;
      const y = scrollY, dy = Math.abs(y - lastY); lastY = y;
      vel += (Math.min(dy / dt, 6) - vel) * (1 - Math.exp(-dt * 0.006));
      const speed = 0.045 * (1 + Math.min(vel * 1.6, 3.5));   // px per ms
      let any = false;
      state.forEach(s => {
        if (!s.vis || !s.w) return; any = true;
        s.x += s.dir * speed * dt;
        if (s.x <= -s.w) s.x += s.w; else if (s.x > 0) s.x -= s.w;
        s.tr.style.transform = `translate3d(${s.x.toFixed(1)}px,0,0)`;
      });
      if (any) raf = requestAnimationFrame(loop); else lastT = 0;
    };
    measure();
    state.forEach(s => { if (s.dir > 0) s.x = -s.w * 0.5; s.tr.style.transform = `translate3d(${s.x}px,0,0)`; });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (!signal.aborted) measure(); });
    addEventListener('resize', measure, { passive: true, signal });
    if (hasIO) {
      const io = new IntersectionObserver(es => es.forEach(e => {
        const s = state.find(z => z.el === e.target); if (!s) return; s.vis = e.isIntersecting;
        if (s.vis && !raf) { lastY = scrollY; raf = requestAnimationFrame(loop); }
      }), { rootMargin: '100px 0px' });
      state.forEach(s => io.observe(s.el)); onAbort(() => io.disconnect());
    }
    onAbort(() => { if (raf) cancelAnimationFrame(raf); raf = 0; });
  }

  /* ---- 4. image reveal: covers wipe open (clip-path inset) and settle from a slight zoom when they come into view */
  // (the observer watches each thumb's parent: Chrome reports a fully clip-path'd target as never intersecting)
  const thumbs = [...document.querySelectorAll('.thumb')];
  if (!reduce && hasIO && thumbs.length) {
    thumbs.forEach(t => t.classList.add('wipe'));
    const io = new IntersectionObserver(es => es.forEach(e => {
      if (!e.isIntersecting) return;
      e.target.querySelectorAll(':scope > .thumb.wipe').forEach(t => t.classList.add('wiped'));
      io.unobserve(e.target);
    }), { rootMargin: '0px 0px -6% 0px', threshold: 0.12 });
    new Set(thumbs.map(t => t.parentElement)).forEach(p => p && io.observe(p)); onAbort(() => io.disconnect());
  }

  /* ---- 6. decoder stats: each number cycles random digits/glyphs, then locks in left to right on its real value */
  const nums = [...document.querySelectorAll('[data-count]')];
  const GLYPHS = '0123456789#%&$@?/';
  const decode = el => {
    if (root.classList.contains('intro-hold')) {
      if (!el.dataset.wait) { el.dataset.wait = '1'; addEventListener('kami:intro-open', () => decode(el), { once: true, signal }); }
      return;
    }
    if (el.dataset.done) return; el.dataset.done = '1';
    const final = el.dataset.final, n = final.length, dur = 1150 + n * 140;
    const delay = el.closest('.in') && !root.classList.contains('vtnav') ? 260 : 60;
    const t0 = performance.now() + delay;
    let lastSwap = 0;
    el.classList.add('scrambling');
    const tick = now => {
      if (signal.aborted) { el.textContent = final; return; }
      const e = now - t0;
      if (e >= dur) { el.textContent = final; el.classList.remove('scrambling'); return; }
      if (e >= 0 && now - lastSwap > 48) {
        lastSwap = now;
        let s = '';
        for (let i = 0; i < n; i++) {
          const lock = dur * (0.42 + 0.58 * (i + 1) / n);
          s += e >= lock ? final[i] : (Math.random() < 0.78 ? String(Math.floor(Math.random() * 10)) : GLYPHS[Math.floor(Math.random() * GLYPHS.length)]);
        }
        el.textContent = s;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };
  nums.forEach(el => { el.dataset.final = String(el.dataset.count); });
  if (!reduce) {
    nums.forEach(el => { if (el.dataset.done) return; el.style.minWidth = Math.ceil(el.getBoundingClientRect().width) + 'px'; el.textContent = '0'.repeat(el.dataset.final.length); });
    if (hasIO) {
      const cio = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { decode(e.target); cio.unobserve(e.target); } }), { threshold: 0.6 });
      nums.forEach(el => cio.observe(el)); onAbort(() => cio.disconnect());
    } else nums.forEach(decode);
  }
};
})();
