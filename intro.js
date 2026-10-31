/* KAMI opening: the wordmark rises, a katana line cuts it straight across, the halves shear apart and open onto the hero.
   Runs on the home page, first visit per session, only when motion is allowed (boot.js decides). Tap, click or any key skips. */
(() => {
  const root = document.documentElement;
  if (root.dataset.intro !== '1') return;
  try { sessionStorage.setItem('kami-intro', '1'); } catch (e) {}

  const name = ((document.title || '').split('\u00b7')[0] || 'Kami').trim() || 'Kami';
  const word = name.toUpperCase();
  const mk = (tag, cls) => { const n = document.createElement(tag); if (cls) n.className = cls; return n; };
  const wordmark = () => {
    const w = mk('div', 'ki-word'), m = mk('span', 'ki-mask');
    [...word].forEach(ch => { const l = mk('span', 'ki-l'); l.textContent = ch; m.appendChild(l); });
    w.appendChild(m); return w;
  };
  const box = mk('div'); box.id = 'kintro'; box.setAttribute('aria-hidden', 'true');
  const halves = ['ki-top', 'ki-bot'].map(c => { const h = mk('div', 'ki-half ' + c), i = mk('div', 'ki-in'); i.appendChild(wordmark()); h.appendChild(i); box.appendChild(h); return h; });
  const cut = mk('i', 'ki-cut'), hint = mk('span', 'ki-hint');
  hint.textContent = 'Tap to skip';
  box.append(cut, hint);
  document.body.appendChild(box);
  const size = () => { const vh = box.clientHeight; halves.forEach(h => { h.firstChild.style.height = vh + 'px'; }); };
  size(); addEventListener('resize', size, { passive: true });
  root.classList.add('intro-built');

  const words = halves.map(h => h.querySelector('.ki-word'));
  const letters = halves.map(h => [...h.querySelectorAll('.ki-l')]);
  const EXPO = 'cubic-bezier(.16,1,.3,1)', SLASH = 'cubic-bezier(.75,0,.25,1)', IN = 'cubic-bezier(.6,0,.9,.4)';
  const anims = new Set();
  const play = (el, kf, o) => { const a = el.animate(kf, Object.assign({ fill: 'both' }, o)); anims.add(a); return a; };
  const wait = ms => new Promise(res => setTimeout(res, ms));
  let stage = 'rise', skipped = false, finished = false, opened = false;

  const finish = () => {
    if (finished) return; finished = true;
    removeEventListener('resize', size);
    anims.forEach(a => { try { a.cancel(); } catch (e) {} });
    box.remove();
    delete root.dataset.intro; root.classList.remove('intro-built', 'intro-hold');
    dispatchEvent(new Event('kami:intro-done'));
  };
  const open = (fast) => {
    if (opened) return; opened = true; stage = 'split';
    // the hero starts coming in underneath as the halves part
    root.classList.remove('intro-hold');
    dispatchEvent(new Event('kami:intro-open'));
    const d = fast ? 520 : 760;
    play(cut, [{ opacity: 1 }, { opacity: 0 }], { duration: fast ? 160 : 360, easing: 'ease-out' });
    play(halves[0], [{ transform: 'translate3d(0,0,0)' }, { transform: 'translate3d(-3%,-101%,0)' }], { duration: d, easing: SLASH });
    play(halves[1], [{ transform: 'translate3d(0,0,0)' }, { transform: 'translate3d(3%,101%,0)' }], { duration: d, easing: SLASH });
    play(words[0], [{ transform: 'translate3d(-2.5%,0,0)' }, { transform: 'translate3d(-9%,0,0)' }], { duration: d, easing: IN });
    play(words[1], [{ transform: 'translate3d(2.5%,0,0)' }, { transform: 'translate3d(9%,0,0)' }], { duration: d, easing: IN });
    setTimeout(finish, d + 30);
  };
  const skip = () => {
    if (skipped || finished) return; skipped = true;
    if (stage === 'split') { anims.forEach(a => { a.playbackRate = 2; }); return; }
    anims.forEach(a => { try { a.finish(); } catch (e) {} });
    play(words[0], [{ transform: 'translate3d(0,0,0)' }, { transform: 'translate3d(-2.5%,0,0)' }], { duration: 120, easing: 'ease-out' });
    play(words[1], [{ transform: 'translate3d(0,0,0)' }, { transform: 'translate3d(2.5%,0,0)' }], { duration: 120, easing: 'ease-out' });
    play(cut, [{ transform: 'scaleX(0)', opacity: 1 }, { transform: 'scaleX(1)', opacity: 1 }], { duration: 120, easing: IN });
    setTimeout(() => open(true), 110);
  };
  box.addEventListener('pointerdown', skip);
  addEventListener('keydown', skip, { once: true });

  const heroImg = () => document.querySelector('.hero-bg img');
  const imgReady = () => new Promise(res => {
    const t0 = performance.now();
    const check = () => {
      const im = heroImg();
      if (!im && performance.now() - t0 > 900) return res();     // no hero image (e.g. removed in admin): don't wait for it
      if (im && im.complete) return (im.decode ? im.decode().catch(() => {}) : Promise.resolve()).then(res);
      if (im) { im.addEventListener('load', () => res(), { once: true }); im.addEventListener('error', () => res(), { once: true }); return; }
      setTimeout(check, 50);
    };
    check();
  });
  const fontReady = Promise.race([
    document.fonts && document.fonts.load ? document.fonts.load('800 100px "Inter Tight"', word).catch(() => {}) : Promise.resolve(),
    wait(600)
  ]);
  const imgGate = Promise.race([imgReady(), wait(2200)]);

  (async () => {
    await fontReady;
    if (skipped) return;
    box.classList.add('go');
    // 1) the letters rise out of a mask, staggered
    letters.forEach(ls => ls.forEach((l, i) => play(l, [{ transform: 'translate3d(0,108%,0)' }, { transform: 'translate3d(0,0,0)' }], { duration: 640, delay: 40 + i * 55, easing: EXPO })));
    play(hint, [{ opacity: 0 }, { opacity: .55 }], { duration: 400, delay: 500, easing: 'ease-out' });
    await wait(40 + (word.length - 1) * 55 + 520);
    await imgGate;                                   // the background should be there before we cut
    if (skipped) return;
    // 2) the katana line: one fast stroke across, left to right
    stage = 'cut';
    play(cut, [{ transform: 'scaleX(0)', opacity: 1 }, { transform: 'scaleX(1)', opacity: 1 }], { duration: 230, easing: IN });
    await wait(215);
    if (skipped) return;
    // 3) the slip: the two halves shear along the cut
    play(words[0], [{ transform: 'translate3d(0,0,0)' }, { transform: 'translate3d(-2.5%,0,0)' }], { duration: 260, easing: 'cubic-bezier(.2,.9,.3,1)' });
    play(words[1], [{ transform: 'translate3d(0,0,0)' }, { transform: 'translate3d(2.5%,0,0)' }], { duration: 260, easing: 'cubic-bezier(.2,.9,.3,1)' });
    play(hint, [{ opacity: .55 }, { opacity: 0 }], { duration: 200, easing: 'ease-out' });
    await wait(150);
    if (skipped) return;
    // 4) the split: halves part vertically and reveal the hero
    open(false);
  })();
  // never leave the page covered
  setTimeout(finish, 6000);
})();
