/* Kami portfolio renderer: builds every page from /content.json (no build step). */
(() => {
  const root = document.documentElement;
  const COVERS = { purple: 'cover-infinite', green: 'cover-slime', blue: 'cover-multi', red: 'cover-anime' };
  const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#x27;' }[c]));
  const safeUrl = u => { u = String(u || '').trim(); return /^(https?:|mailto:|\/|#|data:image\/)/i.test(u) ? u : (u ? 'https://' + u : '#'); };
  const NAV = [['Work', '/work/'], ['About', '/about/'], ['Skills', '/skills/'], ['Contact', '/contact/']];

  function build(C, page, slug) {
    const P = (C.projects || []).filter(p => p && p.slug);
    const BY = Object.fromEntries(P.map(p => [p.slug, p]));
    const S = C.site || {}, H = C.hero || {}, HM = C.home || {}, CT = C.contact || {};
    const name = esc(S.name || '');
    const now = p => (p.state || 'current') === 'current';
    const roleOf = p => esc(p.role) + (p.role_sub ? ' · ' + esc(p.role_sub) : '');
    const stats = (C.stats || []).map(s => [s.auto ? P.length : (+s.value || 0), s.suffix || '', s.label || '']);
    const discordShort = String(CT.discord || '').replace(/^https?:\/\//, '').replace(/\/$/, '');

    const nav = active => {
      const links = NAV.map(([n, h]) => `<a href="${h}"${n === active ? ' aria-current="page"' : ''}${n === 'Contact' ? ' class="pill"' : ''}>${n}</a>`).join('');
      return `<a class="skip" href="#main">Skip to content</a>
<div class="progress" aria-hidden="true"></div>
<header class="nav" id="top">
  <div class="wrap nav-in">
    <a class="brand" href="/" aria-label="${name}, home">${name}<span class="dot" aria-hidden="true"></span></a>
    <nav aria-label="Main">${links}</nav>
  </div>
</header>
`;
    };
    const FOOT = `<footer class="wrap foot">
  <span>${esc(S.footer)}</span>
  <span class="foot-links"><a href="/work/">Work</a><a href="/about/">About</a><a href="/skills/">Skills</a><a href="/contact/">Contact</a></span>
</footer>
<div class="toast" id="toast" role="status" aria-live="polite"></div>
`;
    const media = (p, size = 'card', vt = true) => {
      const v = vt ? ` data-vt="${esc(p.slug)}"` : '';
      const badge = `<span class="badge${now(p) ? '' : ' badge-done'}">${now(p) ? '<i aria-hidden="true"></i>' : ''}${esc(p.status)}</span>`;
      if (p.image) {
        const sizes = size === 'card' ? '(min-width: 960px) 60vw, 100vw' : '(min-width: 960px) 900px, 100vw';
        const lazy = size === 'card' ? 'loading="lazy" ' : 'fetchpriority="high" ';
        const src = esc(safeUrl(p.image));
        const srcset = p.image_small ? ` srcset="${esc(safeUrl(p.image_small))} 720w, ${src} 1200w" sizes="${sizes}"` : '';
        return `<div class="thumb"${v}><img src="${src}"${srcset} width="1200" height="800" alt="${esc(p.name)} key art" ${lazy}decoding="async">${badge}</div>`;
      }
      return `<div class="thumb cover ${COVERS[p.cover_style] || COVERS.purple}"${v}><span aria-hidden="true">${esc(p.name)}</span>${badge}</div>`;
    };
    const card = (p, feature) => {
      const hl = p.highlights || [];
      let extra = '';
      if (hl.length === 1) extra = `<p class="figure"><strong>${esc(hl[0].value)}</strong> ${esc(hl[0].label)}</p>`;
      else if (hl.length > 1) extra = '<div class="duo">' + hl.map(h => `<p class="figure"><strong>${esc(h.value)}</strong> ${esc(h.label)}</p>`).join('') + '</div>';
      const tags = (p.tags || []).length ? '<ul class="tags">' + p.tags.map(t => `<li>${esc(t)}</li>`).join('') + '</ul>' : '';
      return `<a class="card${feature ? ' card-feature' : ''} reveal" href="/work/${esc(p.slug)}/">
        ${media(p)}
        <div class="body">
          <p class="meta">${roleOf(p)}</p>
          <h3>${esc(p.name)}</h3>
          <p class="desc">${esc(p.short)}</p>
          ${extra}${tags}
          <span class="more">View project <span aria-hidden="true">→</span></span>
        </div>
      </a>`;
    };
    const stat = (n, suf, label) => `<div><dt>${esc(label)}</dt><dd><span class="num" data-count="${n}">${n}</span>${esc(suf)}</dd></div>`;
    const statsDl = cls => `<dl class="${cls}">${stats.map(s => stat(...s)).join('')}</dl>`;
    const timeline = () => '<ol class="timeline reveal" aria-label="Experience">' + P.map(p =>
      `<li><a href="/work/${esc(p.slug)}/"><span class="t-role">${roleOf(p)}</span><span class="t-name">${esc(p.name)}</span><span class="t-state${now(p) ? ' now' : ''}">${esc(p.timeline_label)}</span></a></li>`).join('') + '</ol>';
    const two = (a, b) => esc(a) + (b ? ` <span class="muted">${esc(b)}</span>` : '');
    const pagehead = (kicker, title, sub, back = ['/', 'Home']) => `<div class="page-head wrap">
    <a class="back in d0" href="${back[0]}" data-back><span aria-hidden="true">←</span> ${back[1]}</a>
    <p class="kicker in d1">${kicker}</p>
    <h1 class="page-title in d2">${title}</h1>
    ${sub ? `<p class="page-sub in d3">${esc(sub)}</p>` : ''}
  </div>`;
    const ctaTitle = `${esc(CT.cta_title)}<br><span class="muted">${esc(CT.cta_muted)}</span>`;
    const CTA = `<section class="section wrap">
    <div class="cta-band reveal">
      <h2>${ctaTitle}</h2>
      <div class="contact-actions">
        <a class="btn btn-primary" href="/contact/">Get in touch <span aria-hidden="true">→</span></a>
        <a class="btn btn-ghost" href="${esc(safeUrl(CT.discord))}" target="_blank" rel="noopener">Discord <span aria-hidden="true">↗</span></a>
      </div>
    </div>
  </section>`;
    const MQ = (HM.marquee || []).map(w => String(w || '').trim()).filter(Boolean);
    const marquee = dir => MQ.length ? `<div class="marquee${dir ? ' ' + dir : ''}" aria-hidden="true"><div class="mq-track"><span>${MQ.map(w => esc(w) + ' <i>•</i> ').join('')}</span><span>${MQ.map(w => esc(w) + ' <i>•</i> ').join('')}</span></div></div>` : '';
    const inProj = list => P.filter(p => (list || []).includes(p.slug));
    const out = { title: '', desc: '', html: '' };
    const seo = k => { const s = (C.seo || {})[k] || {}; out.title = s.title || S.name; out.desc = s.description || ''; };

    if (page === 'home') {
      seo('home');
      const feat = inProj(HM.featured);
      const np = BY[H.now_project];
      const nowCard = np ? `
    <a class="now-card in d4" href="/work/${esc(np.slug)}/" aria-label="${esc(H.now_label)}: ${esc(np.name)}">
      <span class="now-cover cover ${np.image ? 'now-img' : (COVERS[np.cover_style] || COVERS.purple)}" aria-hidden="true">${np.image ? `<img src="${esc(safeUrl(np.image_small || np.image))}" alt="" decoding="async">` : `<span>${esc(np.name)}</span>`}</span>
      <span class="now-txt"><span class="now-k"><i aria-hidden="true"></i>${esc(H.now_label)}</span><strong>${esc(np.name)}</strong><span class="now-s">${esc(np.role)}</span></span>
    </a>` : '';
      const bgSrc = H.background_image ? esc(safeUrl(H.background_image)) : '';
      const bgWebp = bgSrc && H.background_image_webp ? `<source type="image/webp" srcset="${esc(safeUrl(H.background_image_webp))}">` : '';
      const heroBg = bgSrc ? `
    <div class="hero-bg" aria-hidden="true"><div class="hero-par" data-hero-par><picture>${bgWebp}<img src="${bgSrc}" alt="" width="2400" height="1260" fetchpriority="high" decoding="async"></picture></div><span class="hero-shade"></span></div>` : '';
      out.html = nav('') + `<main id="main">
  <section class="hero${heroBg ? ' has-bg' : ''}" aria-labelledby="hero-title">${heroBg}
    <div class="wrap hero-in">
    <div class="hero-main">
    <p class="eyebrow in d0"><span class="live" aria-hidden="true"></span>${esc(H.eyebrow)}</p>
    <h1 id="hero-title" class="in d1">${name}</h1>
    <p class="role in d2">${esc(S.title)}</p>
    <p class="lede in d3">${esc(H.tagline)}</p>
    <div class="ctas in d4">
      <a class="btn btn-primary" href="/work/">${esc(H.primary_button)} <span aria-hidden="true">→</span></a>
      <a class="btn btn-ghost" href="/contact/">${esc(H.secondary_button)}</a>
    </div>
    ${statsDl('stats in d5')}
    </div>${nowCard}
    </div>${heroBg ? '\n    <a class="scroll-cue" href="#work" aria-label="Scroll to projects"></a>' : ''}
  </section>

  <section id="work" class="hs" data-hscroll aria-labelledby="work-title">
    <div class="hs-pin">
      ${marquee('')}
      <div class="hs-track">
        <div class="hs-item hs-head sec-head reveal">
          <p class="kicker">${esc(HM.work_kicker)}</p>
          <h2 id="work-title">${esc(HM.work_title)}</h2>
          <p class="sub">${esc(HM.work_sub)}</p>
          <p class="hs-hint" aria-hidden="true"><span></span>Scroll</p>
        </div>
        ${feat.map(p => `<div class="hs-item">${card(p, false)}</div>`).join('\n        ')}
        <div class="hs-item"><a class="hs-end reveal" href="/work/"><span class="hs-end-k">${esc(HM.work_kicker)}</span><strong>View all ${P.length} projects</strong><span class="hs-end-arrow" aria-hidden="true">→</span></a></div>
      </div>
      <div class="hs-bar" aria-hidden="true"><i></i></div>
    </div>
  </section>

  <section id="about" class="section wrap about" aria-labelledby="about-title">
    <div class="sec-head reveal">
      <p class="kicker">${esc(HM.about_kicker)}</p>
      <h2 id="about-title">${esc(HM.about_title)}</h2>
    </div>
    <div class="about-grid">
      <div class="about-copy reveal">
        <p class="big">${esc(HM.about_intro)}</p>
        <p>${esc(HM.about_text)}</p>
        <a class="view-all inline" href="/about/">More about me <span aria-hidden="true">→</span></a>
      </div>
      ${timeline()}
    </div>
  </section>

  <section id="skills" class="section wrap has-mq" aria-labelledby="skills-title">
    ${marquee('rev')}
    <div class="sec-head reveal">
      <p class="kicker">${esc(HM.skills_kicker)}</p>
      <h2 id="skills-title">${esc(HM.skills_title)}</h2>
    </div>
    <div class="skill-sum">
      ${((C.skills || {}).groups || []).map(g => `<div class="skill-chipset reveal"><h3>${esc(g.name)}</h3><ul class="chips">` + (g.items || []).map(it => `<li>${esc(it.name)}</li>`).join('') + '</ul></div>').join('')}
    </div>
    <a class="view-all reveal" href="/skills/">All skills, in depth <span aria-hidden="true">→</span></a>
  </section>

  <section id="contact" class="section wrap contact" aria-labelledby="contact-title">
    <div class="contact-card reveal">
      <p class="kicker">${esc(HM.contact_kicker)}</p>
      <h2 id="contact-title">${ctaTitle}</h2>
      <div class="contact-actions">
        <a class="btn btn-primary" href="mailto:${esc(CT.email)}">Email me</a>
        <a class="btn btn-ghost" href="${esc(safeUrl(CT.discord))}" target="_blank" rel="noopener">Join my Discord <span aria-hidden="true">↗</span></a>
      </div>
      <p class="mail-line"><span id="mail">${esc(CT.email)}</span> <button type="button" class="copy" data-copy="${esc(CT.email)}">Copy</button></p>
      <a class="view-all inline" href="/contact/">Send a project inquiry <span aria-hidden="true">→</span></a>
    </div>
  </section>
</main>
` + FOOT;
    } else if (page === 'work') {
      seo('work'); const W = C.work || {};
      out.html = nav('Work') + `<main id="main" class="page">
  <div class="has-mq mq-head">${marquee('')}${pagehead('Work', two(W.title, W.title_muted), W.sub)}</div>
  <section class="section-tight wrap" aria-label="Projects">
    <div class="grid">
      ${P.length ? card(P[0], true) : ''}
      ${P.slice(1).map(p => card(p)).join('')}
    </div>
  </section>
  <section class="section wrap" aria-labelledby="xp-title">
    <div class="sec-head reveal"><p class="kicker">Experience</p><h2 id="xp-title">${esc(W.timeline_title)}</h2><p class="sub">${esc(W.timeline_sub)}</p></div>
    ${timeline()}
  </section>
  <section class="section wrap" aria-labelledby="res-title">
    <div class="sec-head reveal"><p class="kicker">Results</p><h2 id="res-title">${esc(W.results_title)}</h2></div>
    ${statsDl('stats stats-big reveal')}
  </section>
  ${CTA}
</main>
` + FOOT;
    } else if (page === 'project' && BY[slug]) {
      const p = BY[slug], i = P.indexOf(p), nxt = P[(i + 1) % P.length];
      out.title = `${p.name} · ${S.name}, ${p.role}`; out.desc = p.seo_description || p.short || '';
      const facts = (p.facts || []).map(f => `<div class="in"><dt>${esc(f.label)}</dt><dd>${esc(f.value)}</dd></div>`).join('');
      const pst = (p.stats || []).length ? `<dl class="stats stats-big reveal">${p.stats.map(s => stat(+s.value || 0, s.suffix || '', s.label || '')).join('')}</dl>` : '';
      const list = arr => '<ul class="did">' + arr.map(d => `<li><strong>${esc(d.title)}</strong><span>${esc(d.text)}</span></li>`).join('') + '</ul>';
      let body = '';
      if ((p.responsibilities || []).length) body += `<section class="p-sec reveal"><h2>${esc(p.responsibilities_title || 'What I do on it')}</h2>${list(p.responsibilities)}</section>`;
      if ((p.liveops || []).length) body += `<section class="p-sec reveal"><h2>Live operations</h2><p class="p-note">The live-ops side of the role focused on:</p>${list(p.liveops)}<a class="view-all inline" href="/skills/#live">How I run live ops <span aria-hidden="true">→</span></a></section>`;
      if (p.scope) body += `<section class="p-sec reveal"><h2>Scope</h2><p class="p-note">${esc(p.scope)}</p></section>`;
      const links = (p.links || []).filter(l => l && l.url);
      if (links.length) body += `<section class="p-sec reveal"><h2>Links</h2><div class="p-links">${links.map(l => `<a class="btn btn-ghost" href="${esc(safeUrl(l.url))}" target="_blank" rel="noopener">${esc(l.label || l.url)} <span aria-hidden="true">↗</span></a>`).join('')}</div></section>`;
      if (p.note) body += `<section class="p-sec reveal"><p class="p-note soon">${esc(p.note)}</p></section>`;
      const pad = n => String(n).padStart(2, '0');
      out.html = nav('Work') + `<main id="main" class="page project">
  <div class="page-head wrap">
    <a class="back in d0" href="/work/" data-back><span aria-hidden="true">←</span> All work</a>
  </div>
  <article class="wrap p-wrap">
    <div class="p-media in d1" data-vt="${esc(p.slug)}"><div class="p-par" data-parallax>${media(p, 'hero', false)}</div></div>
    <header class="p-head">
      <p class="kicker p-kick in d2">Project <span class="p-count">${pad(i + 1)} / ${pad(P.length)}</span></p>
      <p class="p-chips in d2"><span class="chip chip-role">${now(p) ? '<i aria-hidden="true"></i>' : ''}${roleOf(p)}</span><span class="chip chip-muted">${esc(p.status)}</span></p>
      <h1 class="p-title in d3">${esc(p.name)}</h1>
      <p class="page-sub in d4">${esc(p.intro)}</p>
    </header>
    <dl class="facts">${facts}</dl>
    ${pst}
    ${body}
    <nav class="p-next reveal" aria-label="More projects">
      <a href="/work/${esc(nxt.slug)}/"><span class="k">Next project</span><strong>${esc(nxt.name)} <span aria-hidden="true">→</span></strong></a>
      <a href="/work/"><span class="k">See everything</span><strong>All work</strong></a>
    </nav>
  </article>
  ${CTA}
</main>
` + FOOT;
    } else if (page === 'about') {
      seo('about'); const A = C.about || {};
      out.html = nav('About') + `<main id="main" class="page">
  ${pagehead('About', two(A.title, A.title_muted))}
  <section class="section-tight wrap about-grid">
    <div class="about-copy reveal">
      <p class="big">${esc(A.intro)}</p>
      ${(A.paragraphs || []).map(t => `<p>${esc(t)}</p>`).join('\n      ')}
    </div>
    ${statsDl('stats stats-col reveal')}
  </section>
  <section class="section wrap" aria-labelledby="how-title">
    <div class="sec-head reveal"><p class="kicker">${esc(A.steps_kicker)}</p><h2 id="how-title">${esc(A.steps_title)}</h2></div>
    <ol class="steps">${(A.steps || []).map((s, k) => `<li class="reveal"><span class="n">${String(k + 1).padStart(2, '0')}</span><h3>${esc(s.title)}</h3><p>${esc(s.text)}</p></li>`).join('')}</ol>
  </section>
  <section class="section wrap" aria-labelledby="xp-title">
    <div class="sec-head reveal"><p class="kicker">Experience</p><h2 id="xp-title">${esc(A.timeline_title)}</h2><p class="sub">${esc(A.timeline_sub)}</p></div>
    ${timeline()}
  </section>
  ${CTA}
</main>
` + FOOT;
    } else if (page === 'skills') {
      seo('skills'); const K = C.skills || {};
      const groups = (K.groups || []).map((g, k) => {
        const gid = esc(g.id || ('g' + (k + 1)));
        const on = inProj(g.projects);
        return `<section class="skill-group skill-deep reveal" id="${gid}" aria-labelledby="g-${gid}">
      <p class="kicker">${String(k + 1).padStart(2, '0')}</p><h2 id="g-${gid}">${esc(g.name)}</h2>
      <ul>${(g.items || []).map(it => `<li><strong>${esc(it.name)}</strong><span>${esc(it.text)}</span></li>`).join('')}</ul>
      ${on.length ? `<p class="used">On: ${on.map(x => `<a href="/work/${esc(x.slug)}/">${esc(x.name)}</a>`).join(' ')}</p>` : ''}
    </section>`;
      }).join('');
      out.html = nav('Skills') + `<main id="main" class="page">
  ${pagehead('Skills', two(K.title, K.title_muted), K.sub)}
  <div class="wrap skills skills-page section-tight">${groups}</div>
  ${CTA}
</main>
` + FOOT;
    } else if (page === 'contact') {
      seo('contact');
      out.html = nav('Contact') + `<main id="main" class="page">
  ${pagehead('Contact', two(CT.title, CT.title_muted), CT.sub)}
  <section class="section-tight wrap contact contact-page">
    <div class="contact-grid">
      <a class="c-tile reveal" href="mailto:${esc(CT.email)}"><span class="k">Email</span><strong>${esc(CT.email)}</strong><span class="go">Write an email <span aria-hidden="true">→</span></span></a>
      <a class="c-tile reveal" href="${esc(safeUrl(CT.discord))}" target="_blank" rel="noopener"><span class="k">Discord</span><strong>${esc(discordShort)}</strong><span class="go">Join the server <span aria-hidden="true">↗</span></span></a>
    </div>
    <p class="mail-line reveal"><span id="mail">${esc(CT.email)}</span> <button type="button" class="copy" data-copy="${esc(CT.email)}">Copy email</button></p>
    <div class="inquiry inquiry-open reveal">
      <h2>${esc(CT.form_title)}</h2>
      <p class="p-note">${esc(CT.form_intro)}</p>
      <form id="inquiry" novalidate data-to="${esc(CT.form_email || CT.email)}">
        <div class="row">
          <label>Name<input name="name" autocomplete="name" required></label>
          <label>Discord or email<input name="contact" required></label>
        </div>
        <div class="row">
          <label>Project name<input name="project"></label>
          <label>Project type<input name="type" placeholder="e.g. Battlegrounds, Tower defense"></label>
        </div>
        <label>Game or group link<input name="website" inputmode="url" placeholder="Optional"></label>
        <label>What do you need?<textarea name="description" rows="4" required></textarea></label>
        <label>Budget
          <select name="budget">${(CT.budgets || []).map(b => `<option>${esc(b)}</option>`).join('')}</select>
        </label>
        <label class="hp" aria-hidden="true">Leave this empty<input name="_honey" tabindex="-1" autocomplete="off"></label>
        <button class="btn btn-primary send" type="submit"><span class="lbl">Send inquiry</span></button>
        <p class="form-note" id="form-note" role="status" aria-live="polite">${esc(CT.form_note)}</p>
      </form>
    </div>
  </section>
</main>
` + FOOT;
    } else {
      out.title = `Not found · ${S.name}`; out.desc = 'This page does not exist.';
      out.html = nav('') + `<main id="main" class="page">
  ${pagehead('404', 'This page <span class="muted">isn’t here.</span>', 'It may have moved. Everything is one tap away below.')}
  <section class="section-tight wrap"><div class="ctas"><a class="btn btn-primary" href="/">Home</a><a class="btn btn-ghost" href="/work/">See my work</a></div></section>
</main>
` + FOOT;
    }
    return out;
  }

  const route = () => {
    const page = document.body.dataset.page || 'home';
    let slug = '';
    if (page === 'project') {
      const m = location.pathname.match(/^\/work\/([^/]+?)(?:\.html)?\/?$/);
      slug = m ? decodeURIComponent(m[1]) : '';
      if (slug === 'project' || slug === 'index') slug = new URLSearchParams(location.search).get('p') || '';
    }
    return { page, slug };
  };

  let rendered = null, hashDone = false;
  function render(C) {
    const { page, slug } = route();
    const out = build(C, page, slug);
    const end = document.getElementById('app-end');
    // remove what a previous render put in <body>, keep scripts and the end marker
    [...document.body.children].forEach(n => { if (n.tagName !== 'SCRIPT' && n !== end && n.tagName !== 'NOSCRIPT' && n.id !== 'kintro') n.remove(); });
    document.body.insertAdjacentHTML('afterbegin', out.html);
    document.querySelectorAll('[data-vt]').forEach(el => { el.style.viewTransitionName = 'p-' + el.dataset.vt; });
    if (out.title) document.title = out.title;
    const md = document.querySelector('meta[name="description"]'); if (md && out.desc) md.setAttribute('content', out.desc);
    rendered = JSON.stringify(C);
    if (typeof window.KamiInit === 'function') window.KamiInit();
    root.classList.add('ready');
    if (!hashDone) { hashDone = true; if (location.hash.length > 1) { const t = document.getElementById(decodeURIComponent(location.hash.slice(1))); if (t) t.scrollIntoView(); } }
  }
  window.KamiRender = render;
  window.KamiBuild = build;

  // ---- where the content comes from
  let preview = null;
  try { if (window.parent !== window && typeof window.parent.KAMI_PREVIEW === 'function') preview = window.parent; } catch (e) {}
  if (preview) {
    root.classList.add('preview');
    render(preview.KAMI_PREVIEW());
    try { preview.KAMI_FRAME_READY && preview.KAMI_FRAME_READY(window); } catch (e) {}
    return;
  }
  const KEY = 'kami-content-v1';
  let cached = null;
  try { cached = JSON.parse(sessionStorage.getItem(KEY) || 'null'); } catch (e) {}
  if (cached) render(cached);   // same-session navigation renders before first paint (keeps the cover morph)
  const p = window.__kamiContent || fetch('/content.json', { cache: 'no-cache' }).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); });
  p.then(C => {
    const s = JSON.stringify(C);
    try { sessionStorage.setItem(KEY, s); } catch (e) {}
    if (s !== rendered) render(C);
  }).catch(() => {
    if (!cached) document.body.insertAdjacentHTML('afterbegin', '<p class="noscript wrap">Couldn’t load this page. Please refresh.</p>');
  });
})();
