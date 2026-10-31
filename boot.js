document.documentElement.classList.add('js');
addEventListener('pagereveal', e => { if (e.viewTransition) document.documentElement.classList.add('vtnav'); });
// start loading the content as early as possible (render.js uses it)
(() => { let framed = false; try { framed = window.parent !== window && typeof window.parent.KAMI_PREVIEW === 'function'; } catch (e) {}
  if (!framed) window.__kamiContent = fetch('/content.json', { cache: 'no-cache' }).then(r => { if (!r.ok) throw new Error('content ' + r.status); return r.json(); }); })();
// opening intro: home page, first visit this session, motion allowed, not inside the admin preview
(() => { try {
  const p = location.pathname, home = p === '/' || p === '/index.html';
  let framed = false; try { framed = window.parent !== window; } catch (e) { framed = true; }
  if (home && !framed && !location.hash && !sessionStorage.getItem('kami-intro') && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    document.documentElement.dataset.intro = '1'; document.documentElement.classList.add('intro-hold');
  }
} catch (e) {} })();
