/* Kami portfolio interactions. render.js calls KamiInit() after every render; a re-render tears the last run down first. */
(() => {
let last = null;
window.KamiInit = function () {
  if (last) last.abort();
  const ac = new AbortController(); last = ac;
  const signal = ac.signal;
  const onAbort = fn => signal.addEventListener('abort', fn);
  const root = document.documentElement;
  const preview = root.classList.contains('preview');
  const reduce = preview || matchMedia('(prefers-reduced-motion: reduce)').matches;
  const nav = document.querySelector('.nav');
  const bar = document.querySelector('.progress');
  const par = reduce ? null : document.querySelector('[data-parallax]');
  const parBox = par && par.parentElement;

  // ---- one rAF-throttled scroll loop: progress bar (scaleX), nav state, hero parallax
  let maxY = 1, parH = 0, parEnd = 0, ticking = false, lastScrolled = null, lastP = -1;
  const measure = () => {
    maxY = Math.max(1, document.documentElement.scrollHeight - innerHeight);
    if (par) { parH = parBox.offsetHeight; parEnd = parBox.offsetTop + parH; }
    frame();
  };
  const frame = () => {
    ticking = false;
    const y = scrollY;
    const s = y > 12;
    if (s !== lastScrolled) { nav.classList.toggle('scrolled', s); lastScrolled = s; }
    if (bar) { const p = Math.min(1, Math.max(0, y / maxY)); if (Math.abs(p - lastP) > 0.0005) { bar.style.transform = `scaleX(${p.toFixed(4)})`; lastP = p; } }
    if (par && y < parEnd + 40) {
      const t = Math.min(parH * 0.1, Math.max(0, y * 0.22));
      par.style.transform = `translate3d(0,${t.toFixed(1)}px,0) scale(1.12)`;
    }
  };
  addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(frame); } }, { passive: true, signal });
  addEventListener('resize', measure, { passive: true, signal });
  if ('ResizeObserver' in window) { const ro = new ResizeObserver(measure); ro.observe(document.body); onAbort(() => ro.disconnect()); }
  if (par) par.style.transform = 'translate3d(0,0,0) scale(1.12)';
  measure();

  // ---- desktop only: magnetic buttons + cards, soft cursor glow on cards
  const fine = matchMedia('(hover: hover) and (pointer: fine)');
  if (!reduce && fine.matches) {
    const SPECS = [
      ['.btn-primary, .btn-ghost', 0.28, 7, 2, false],
      ['.view-all:not(.inline)', 0.22, 6, 0, false],
      ['.card, .now-card', 0.035, 6, 5, true],
      ['.c-tile, .p-next a', 0.05, 6, 4, true],
      ['.skill-group, .skill-chipset, .steps li', 0, 0, 0, true],
    ];
    const live = new Map();
    let raf = 0, stale = true;
    const run = () => {
      raf = 0;
      live.forEach((st, el) => {
        if (stale || !st.r) st.r = el.getBoundingClientRect();
        const r = st.r, x = st.x - r.left, y = st.y - r.top;
        if (st.k) {
          const cl = v => Math.max(-st.max, Math.min(st.max, v));
          const dx = cl((x - r.width / 2) * st.k), dy = cl((y - r.height / 2) * st.k) - st.lift;
          el.style.translate = `${dx.toFixed(1)}px ${dy.toFixed(1)}px`;
        }
        if (st.glow) st.glow.style.translate = `${x.toFixed(0)}px ${y.toFixed(0)}px`;
      });
      stale = false;
    };
    addEventListener('scroll', () => { stale = true; }, { passive: true, signal });
    SPECS.forEach(([sel, k, max, lift, glow]) => document.querySelectorAll(sel).forEach(el => {
      let g = null;
      if (glow) { g = document.createElement('span'); g.className = 'glow'; g.setAttribute('aria-hidden', 'true'); el.appendChild(g); }
      el.addEventListener('pointerenter', e => {
        if (signal.aborted || e.pointerType !== 'mouse') return;
        live.set(el, { k, max, lift, glow: g, x: e.clientX, y: e.clientY, r: el.getBoundingClientRect() });
        if (g) { const r = live.get(el).r; g.style.transition = 'opacity .45s'; g.style.translate = `${e.clientX - r.left}px ${e.clientY - r.top}px`; void g.offsetWidth; g.style.transition = ''; }
        el.classList.add('mag-on');
        if (!raf) raf = requestAnimationFrame(run);
      });
      el.addEventListener('pointermove', e => {
        const st = live.get(el); if (!st) return;
        st.x = e.clientX; st.y = e.clientY;
        if (!raf) raf = requestAnimationFrame(run);
      }, { passive: true, signal });
      el.addEventListener('pointerleave', () => {
        live.delete(el); el.classList.remove('mag-on');
        if (k) el.style.translate = '';
      });
    }));
  }

  // ---- count-up: runs when each number comes into view (on load and on scroll)
  const counters = [...document.querySelectorAll('[data-count]')];
  const fmt = n => String(n);
  const runCount = el => {
    if (el.dataset.done) return; el.dataset.done = '1';
    const end = +el.dataset.count, dur = end > 20 ? 1700 : 1100;
    const delay = el.closest('.in') && !root.classList.contains('vtnav') ? 250 : 60;
    const t0 = performance.now() + delay;
    const ease = p => p >= 1 ? 1 : 1 - Math.pow(2, -10 * p);   // expo-out: fast start, soft landing
    const tick = now => {
      const p = Math.min(1, Math.max(0, (now - t0) / dur));
      el.textContent = fmt(Math.round(end * ease(p)));
      if (p < 1) requestAnimationFrame(tick); else el.textContent = fmt(end);
    };
    requestAnimationFrame(tick);
  };
  if (!reduce) {
    counters.forEach(el => { el.style.minWidth = Math.ceil(el.getBoundingClientRect().width) + 'px'; el.textContent = '0'; });
    if ('IntersectionObserver' in window) {
      const cio = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { runCount(e.target); cio.unobserve(e.target); } }), { threshold: 0.6 });
      counters.forEach(el => cio.observe(el)); onAbort(() => cio.disconnect());
    } else counters.forEach(runCount);
  }

  // ---- reveal on scroll
  const items = document.querySelectorAll('.reveal');
  if (reduce || !('IntersectionObserver' in window)) items.forEach(el => el.classList.add('seen'));
  else {
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('seen'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    items.forEach(el => io.observe(el)); onAbort(() => io.disconnect());
  }

  // ---- page transitions: native cross-page view transitions where supported, a soft fade elsewhere
  const nativeVT = 'onpagereveal' in window && CSS.supports && CSS.supports('view-transition-name: a');
  const internal = a => a && a.origin === location.origin && !a.target && !a.hasAttribute('download') && a.pathname !== location.pathname && !a.href.startsWith('mailto:');
  document.addEventListener('click', e => {
    if (e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = e.target.closest('a'); if (!a) return;
    // back button: return to where you were if you came from this site
    if (a.hasAttribute('data-back')) {
      let ref = null; try { ref = document.referrer && new URL(document.referrer); } catch {}
      if (ref && ref.origin === location.origin && ref.pathname === a.pathname && history.length > 1) { e.preventDefault(); history.back(); return; }
    }
    if (nativeVT || reduce || !internal(a)) return;
    e.preventDefault(); root.classList.add('leaving');
    setTimeout(() => { location.href = a.href; }, 170);
  }, { signal });
  addEventListener('pageshow', e => { if (e.persisted) root.classList.remove('leaving'); }, { signal });

  // ---- warm the next page on intent so it opens instantly
  const warmed = new Set();
  const warm = e => {
    const a = e.target.closest && e.target.closest('a'); if (!internal(a) || warmed.has(a.pathname)) return;
    warmed.add(a.pathname); const l = document.createElement('link'); l.rel = 'prefetch'; l.href = a.pathname; document.head.appendChild(l);
  };
  if (!preview) {
    document.addEventListener('pointerover', warm, { passive: true, signal });
    document.addEventListener('touchstart', warm, { passive: true, signal });
  }

  // ---- toast + copy
  const toast = document.getElementById('toast'); let tt;
  const say = m => { if (!toast) return; toast.textContent = m; toast.classList.add('show'); clearTimeout(tt); tt = setTimeout(() => toast.classList.remove('show'), 2200); };
  document.querySelectorAll('[data-copy]').forEach(b => b.addEventListener('click', async () => {
    const v = b.dataset.copy;
    try { await navigator.clipboard.writeText(v); }
    catch { const m = document.getElementById('mail'); if (m) { const r = document.createRange(); r.selectNodeContents(m); const s = getSelection(); s.removeAllRanges(); s.addRange(r); try { document.execCommand('copy'); } catch {} } }
    say('Email copied');
  }));

  // ---- inquiry form -> sends in-page to Kami's inbox via FormSubmit (no backend, no mail app)
  const f = document.getElementById('inquiry');
  if (f) {
    const TO = f.dataset.to || 'kammii.workacc@gmail.com';
    const note = document.getElementById('form-note');
    const btn = f.querySelector('button[type=submit]');
    const lbl = btn.querySelector('.lbl');
    const idle = note.textContent;
    let busy = false, revert;
    const setNote = (kind, build) => {
      note.className = 'form-note' + (kind ? ' ' + kind : '');
      note.textContent = ''; build(note);
      if (kind) { note.classList.remove('pop'); void note.offsetWidth; note.classList.add('pop'); }
    };
    const fail = () => setNote('is-error', n => {
      n.append('Couldn\u2019t send that just now. Please email me directly at ');
      const a = document.createElement('a'); a.href = 'mailto:' + TO; a.textContent = TO; n.append(a, '.');
    });
    f.addEventListener('submit', async e => {
      e.preventDefault();
      if (busy) return;
      let ok = true;
      f.querySelectorAll('[required]').forEach(i => { const bad = !i.value.trim(); i.classList.toggle('bad', bad); if (bad && ok) { i.focus(); ok = false; } });
      if (!ok) { setNote('is-warn', n => n.append('Fill in your name, how to reach you, and what you need.')); return; }
      const d = Object.fromEntries(new FormData(f));
      const t = k => (d[k] || '').trim();
      const payload = {
        'Name': t('name'),
        'Discord or email': t('contact'),
        'Project name': t('project') || '-',
        'Project type': t('type') || '-',
        'Game or group link': t('website') || '-',
        'What they need': t('description'),
        'Budget': t('budget') || '-',
        _subject: 'New project inquiry: ' + (t('project') || 'from ' + t('name')),
        _template: 'table',
        _captcha: 'false',
        _honey: d._honey || ''
      };
      if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t('contact'))) payload._replyto = t('contact');
      busy = true; clearTimeout(revert);
      btn.disabled = true; btn.classList.remove('is-sent'); btn.classList.add('is-loading'); btn.setAttribute('aria-busy', 'true');
      lbl.textContent = 'Sending\u2026'; setNote('', n => n.append('Sending your inquiry\u2026'));
      const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), 90000);
      const slow = setTimeout(() => setNote('', n => n.append('Still sending, hang tight\u2026')), 8000);
      let sent = false;
      try {
        const r = await fetch('https://formsubmit.co/ajax/' + TO, {
          method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify(payload), signal: ctl.signal
        });
        const j = await r.json().catch(() => ({}));
        sent = r.ok && (j.success === true || j.success === 'true');
      } catch { sent = false; }
      clearTimeout(to); clearTimeout(slow);
      busy = false; btn.disabled = false; btn.classList.remove('is-loading'); btn.removeAttribute('aria-busy');
      if (sent) {
        f.reset(); f.querySelectorAll('.bad').forEach(i => i.classList.remove('bad'));
        btn.classList.add('is-sent'); lbl.textContent = 'Sent \u2713';
        setNote('is-sent', n => { const s = document.createElement('strong'); s.textContent = 'Sent \u2713'; n.append(s, ' I\u2019ll get back to you soon.'); });
        revert = setTimeout(() => { btn.classList.remove('is-sent'); lbl.textContent = 'Send inquiry'; }, 4000);
      } else { lbl.textContent = 'Send inquiry'; fail(); }
    });
    f.querySelectorAll('[required]').forEach(i => i.addEventListener('input', () => i.classList.remove('bad')));
    f.addEventListener('input', () => { if (note.classList.contains('is-warn') || note.classList.contains('is-sent')) setNote('', n => n.append(idle)); }, { passive: true });
  }
};
if (document.documentElement.classList.contains('ready')) window.KamiInit();
})();
