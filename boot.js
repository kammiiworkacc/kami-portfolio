document.documentElement.classList.add('js');
addEventListener('pagereveal', e => { if (e.viewTransition) document.documentElement.classList.add('vtnav'); });
// start loading the content as early as possible (render.js uses it)
(() => { let framed = false; try { framed = window.parent !== window && typeof window.parent.KAMI_PREVIEW === 'function'; } catch (e) {}
  if (!framed) window.__kamiContent = fetch('/content.json', { cache: 'no-cache' }).then(r => { if (!r.ok) throw new Error('content ' + r.status); return r.json(); }); })();
