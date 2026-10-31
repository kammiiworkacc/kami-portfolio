/* Kami portfolio admin: edit content.json with forms, preview live, publish to GitHub (contents API). */
(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const K = { token: 'kami-admin-token', settings: 'kami-admin-settings', draft: 'kami-admin-draft', pass: 'kami-admin-pass', unlocked: 'kami-admin-unlocked' };
  const API = 'https://api.github.com';
  const store = {
    get: (k, d = null) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } },
    del: k => { try { localStorage.removeItem(k); } catch (e) {} }
  };
  const clone = o => JSON.parse(JSON.stringify(o));
  const el = (tag, attrs = {}, ...kids) => {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'class') n.className = v; else if (k === 'text') n.textContent = v;
      else if (k.startsWith('on')) n.addEventListener(k.slice(2), v); else n.setAttribute(k, v === true ? '' : v);
    }
    kids.flat().forEach(c => c != null && n.append(c));
    return n;
  };
  const slugify = s => String(s || '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);

  // ---------- toasts
  const toast = (msg, kind = '', ms = 4200, link) => {
    const t = el('div', { class: 'toast ' + kind, role: kind === 'err' ? 'alert' : 'status' }, el('span', { text: msg }));
    if (link) t.firstChild.append(' ', el('a', { href: link.href, target: '_blank', rel: 'noopener', text: link.text }));
    $('#toasts').append(t);
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 320); }, ms);
  };

  // ---------- state
  let config = { owner: '', repo: '', branch: 'main', site_url: '', passcode_sha256: '' };
  let settings = {};
  let token = store.get(K.token, '');
  let content = null;     // the draft being edited
  let base = '';          // JSON of the last loaded / published content
  let uploads = {};       // repo path -> { dataUrl }  (images not yet committed)
  let tab = 'profile';
  let openProject = -1;

  const sha256 = async s => { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('kami-admin:' + s)); return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join(''); };
  const b64utf8 = s => { const bytes = new TextEncoder().encode(s); let bin = ''; for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(bin); };
  const unb64utf8 = b => { const bin = atob(String(b).replace(/\s/g, '')); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return new TextDecoder().decode(u); };
  const repoPath = () => `/repos/${encodeURIComponent(settings.owner)}/${encodeURIComponent(settings.repo)}`;

  // ---------- GitHub
  class GHError extends Error { constructor(status, msg) { super(msg); this.status = status; } }
  const gh = async (path, opts = {}) => {
    let r;
    try {
      r = await fetch(API + path, { ...opts, headers: { 'Accept': 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'Authorization': 'Bearer ' + token, ...(opts.body ? { 'Content-Type': 'application/json' } : {}) } });
    } catch (e) { throw new GHError(0, 'Can’t reach GitHub. Check your internet and try again.'); }
    let j = null; try { j = await r.json(); } catch (e) {}
    if (!r.ok) throw new GHError(r.status, (j && j.message) || ('GitHub answered ' + r.status));
    return j;
  };
  const friendly = e => {
    const s = e.status;
    if (s === 401) return 'GitHub didn’t accept your token. It may have expired: make a new one and connect again (Settings).';
    if (s === 403) return 'Your token can’t write to this repo. Give it “Contents: Read and write” for ' + settings.repo + '.';
    if (s === 404) return 'Repo not found: check the username, repo name and branch in Settings, and that the token has access to it.';
    if (s === 409) return 'Someone else changed the repo at the same moment. Try Save & publish again.';
    if (s === 422) return 'GitHub refused the file: ' + e.message;
    return e.message || 'Something went wrong. Try again.';
  };
  const getFile = async path => {
    try { return await gh(`${repoPath()}/contents/${path}?ref=${encodeURIComponent(settings.branch)}`); }
    catch (e) { if (e.status === 404) return null; throw e; }
  };
  const putFile = async (path, b64, message, retry = true, isNew = false) => {
    const cur = isNew ? null : await getFile(path);
    const body = { message, content: b64, branch: settings.branch };
    if (cur && cur.sha) body.sha = cur.sha;
    try { return await gh(`${repoPath()}/contents/${path}`, { method: 'PUT', body: JSON.stringify(body) }); }
    catch (e) { if (retry && (e.status === 409 || e.status === 422)) return putFile(path, b64, message, false, false); throw e; }
  };

  // ---------- draft persistence
  let saveT;
  const persist = () => {
    clearTimeout(saveT);
    saveT = setTimeout(() => {
      const isDirty = dirty();
      if (!isDirty) { store.del(K.draft); return; }
      if (!store.set(K.draft, { content, uploads, base })) {
        store.set(K.draft, { content, uploads: {}, base });
        toast('Your new image is too big to keep if you close this page. Publish soon so it isn’t lost.', 'err', 6000);
      }
    }, 300);
  };
  const dirty = () => JSON.stringify(content) !== base || Object.keys(uploads).length > 0;
  const changed = (rerenderPreview = true) => {
    $('#dirty').hidden = !dirty();
    persist();
    if (rerenderPreview) refreshPreview();
  };

  // ---------- preview
  const frame = () => $('#frame');
  let frameWin = null, pvT;
  const previewContent = () => {
    const c = clone(content);
    const swap = v => (uploads[v] ? uploads[v].dataUrl : v);
    (c.projects || []).forEach(p => { p.image = swap(p.image); p.image_small = swap(p.image_small); });
    if (c.hero) { c.hero.background_image = swap(c.hero.background_image); if (uploads[(content.hero || {}).background_image]) c.hero.background_image_webp = ''; }
    return c;
  };
  window.KAMI_PREVIEW = previewContent;
  window.KAMI_FRAME_READY = w => { frameWin = w; syncPageSelect(); };
  const refreshPreview = () => {
    clearTimeout(pvT);
    pvT = setTimeout(() => {
      try { if (frameWin && !frameWin.closed && frameWin.KamiRender) { frameWin.KamiRender(previewContent()); return; } } catch (e) {}
      frame().src = frame().src;
    }, 220);
  };
  const pages = () => [['/', 'Home'], ['/work/', 'Work'], ...(content.projects || []).map(p => ['/work/' + p.slug + '/', '· ' + (p.name || p.slug)]), ['/about/', 'About'], ['/skills/', 'Skills'], ['/contact/', 'Contact']];
  const fillPageSelect = () => {
    const s = $('#pv-page'); const cur = s.value;
    s.replaceChildren(...pages().map(([v, t]) => el('option', { value: v, text: t })));
    if (cur) s.value = cur;
  };
  const syncPageSelect = () => { try { const p = frameWin.location.pathname; if ([...$('#pv-page').options].some(o => o.value === p)) $('#pv-page').value = p; } catch (e) {} };
  const goPreview = path => { if (!path) return; try { if (frameWin && frameWin.location.pathname === path) return; } catch (e) {} frameWin = null; frame().src = path; $('#pv-page').value = path; };

  // ---------- form builder
  const field = (obj, f) => {
    const id = 'f' + Math.random().toString(36).slice(2, 9);
    if (f.t === 'check') {
      const cb = el('input', { type: 'checkbox', id, onchange: () => { obj[f.k] = cb.checked; changed(); f.after && f.after(); } });
      cb.checked = !!obj[f.k];
      return el('label', { class: 'check', for: id }, cb, f.label);
    }
    let input;
    if (f.t === 'select') {
      const opts = typeof f.options === 'function' ? f.options() : f.options;
      input = el('select', { id }, ...opts.map(([v, t]) => el('option', { value: v, text: t })));
      input.value = obj[f.k] == null ? '' : obj[f.k];
      input.addEventListener('change', () => { obj[f.k] = input.value; changed(); f.after && f.after(); });
    } else {
      input = el(f.multi ? 'textarea' : 'input', { id, placeholder: f.ph || null, rows: f.multi ? (f.rows || 3) : null, inputmode: f.t === 'number' ? 'decimal' : (f.t === 'email' ? 'email' : (f.t === 'url' ? 'url' : null)), spellcheck: f.t === 'url' || f.t === 'email' ? 'false' : null, autocapitalize: f.t === 'url' || f.t === 'email' ? 'off' : null });
      input.value = obj[f.k] == null ? '' : obj[f.k];
      input.addEventListener('input', () => {
        obj[f.k] = f.t === 'number' ? (input.value.trim() === '' ? 0 : (parseFloat(input.value) || 0)) : input.value;
        f.oninput && f.oninput(input.value, input);
        changed();
      });
      if (f.onchange) input.addEventListener('change', () => f.onchange(input.value, input));
    }
    const lab = el('label', { for: id }, f.label, input);
    if (f.hint) lab.append(el('span', { class: 'hint', text: f.hint }));
    return lab;
  };
  const projChecks = (obj, k, label) => {
    const wrap = el('div', { class: 'checks' });
    const set = new Set(obj[k] || []);
    (content.projects || []).forEach(p => {
      const id = 'c' + Math.random().toString(36).slice(2, 9);
      const cb = el('input', { type: 'checkbox', id });
      cb.checked = set.has(p.slug);
      cb.addEventListener('change', () => {
        const cur = new Set(obj[k] || []); cb.checked ? cur.add(p.slug) : cur.delete(p.slug);
        obj[k] = content.projects.map(x => x.slug).filter(s => cur.has(s)); changed();
      });
      wrap.append(el('label', { class: 'check', for: id }, cb, p.name || p.slug));
    });
    return el('div', { class: 'list' }, el('div', { class: 'list-head' }, el('h3', { text: label })), wrap);
  };
  const strings = (obj, f) => {
    const box = el('div', { class: 'list' });
    const draw = () => {
      if (!Array.isArray(obj[f.k])) obj[f.k] = [];
      const arr = obj[f.k];
      box.replaceChildren(el('div', { class: 'list-head' }, el('h3', { text: f.label })));
      if (f.hint) box.append(el('p', { class: 'hint', text: f.hint }));
      arr.forEach((v, i) => {
        const inp = el(f.multi ? 'textarea' : 'input', { 'aria-label': f.label + ' ' + (i + 1), rows: f.multi ? 4 : null });
        inp.value = v; inp.addEventListener('input', () => { arr[i] = inp.value; changed(); });
        box.append(el('div', { class: 'row-inline' }, inp,
          el('button', { type: 'button', class: 'icon-btn', title: 'Move up', 'aria-label': 'Move up', disabled: i === 0 || null, onclick: () => { [arr[i - 1], arr[i]] = [arr[i], arr[i - 1]]; changed(); draw(); } }, '↑'),
          el('button', { type: 'button', class: 'icon-btn del', title: 'Remove', 'aria-label': 'Remove', onclick: () => { arr.splice(i, 1); changed(); draw(); } }, '✕')));
      });
      box.append(el('button', { type: 'button', class: 'btn ghost small add', onclick: () => { arr.push(''); changed(); draw(); const last = box.querySelectorAll('input,textarea'); last.length && last[last.length - 1].focus(); } }, '+ ' + (f.add || 'Add')));
    };
    draw();
    return box;
  };
  const list = (obj, f) => {
    const box = el('div', { class: 'list' });
    const draw = () => {
      if (!Array.isArray(obj[f.k])) obj[f.k] = [];
      const arr = obj[f.k];
      box.replaceChildren(el('div', { class: 'list-head' }, el('h3', { text: f.label })));
      if (f.hint) box.append(el('p', { class: 'hint', text: f.hint }));
      arr.forEach((it, i) => {
        const bar = el('div', { class: 'item-bar' }, el('span', { class: 'num', text: (f.itemName || 'Item') + ' ' + (i + 1) }),
          el('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Move up', title: 'Move up', disabled: i === 0 || null, onclick: () => { [arr[i - 1], arr[i]] = [arr[i], arr[i - 1]]; changed(); draw(); } }, '↑'),
          el('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Move down', title: 'Move down', disabled: i === arr.length - 1 || null, onclick: () => { [arr[i + 1], arr[i]] = [arr[i], arr[i + 1]]; changed(); draw(); } }, '↓'),
          el('button', { type: 'button', class: 'icon-btn del', 'aria-label': 'Remove', title: 'Remove', onclick: () => { arr.splice(i, 1); changed(); draw(); } }, '✕'));
        box.append(el('div', { class: 'item' }, bar, el('div', { class: 'fgrid' + (f.two ? ' two' : '') }, ...f.item.map(sf => render1(it, sf)))));
      });
      box.append(el('button', { type: 'button', class: 'btn ghost small add', onclick: () => { arr.push(clone(f.blank)); changed(); draw(); } }, '+ ' + (f.add || 'Add')));
    };
    draw();
    return box;
  };
  const render1 = (obj, f) => {
    if (f.t === 'strings') return strings(obj, f);
    if (f.t === 'list') return list(obj, f);
    if (f.t === 'projects') return projChecks(obj, f.k, f.label);
    if (f.t === 'custom') return f.render(obj);
    return field(obj, f);
  };
  const section = (title, hint, obj, fields, two) => el('section', { class: 'sec' }, el('h2', { text: title }), hint ? el('p', { class: 'hint', text: hint }) : null,
    el('div', { class: 'fgrid' + (two ? ' two' : '') }, ...fields.map(f => render1(obj, f))));

  // ---------- slug references
  const renameSlug = (from, to) => {
    if (!from || from === to) return;
    const fix = arr => (arr || []).map(s => (s === from ? to : s));
    if (content.hero.now_project === from) content.hero.now_project = to;
    content.home.featured = fix(content.home.featured);
    (content.skills.groups || []).forEach(g => { g.projects = fix(g.projects); });
  };
  const dropSlug = slug => {
    if (content.hero.now_project === slug) content.hero.now_project = '';
    content.home.featured = (content.home.featured || []).filter(s => s !== slug);
    (content.skills.groups || []).forEach(g => { g.projects = (g.projects || []).filter(s => s !== slug); });
  };

  // ---------- images
  const readImage = file => new Promise((res, rej) => {
    const url = URL.createObjectURL(file); const img = new Image();
    img.onload = () => res({ img, url }); img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('That file isn’t an image I can read.')); };
    img.src = url;
  });
  const encode = (img, maxW) => {
    const scale = Math.min(1, maxW / img.naturalWidth);
    const w = Math.max(1, Math.round(img.naturalWidth * scale)), h = Math.max(1, Math.round(img.naturalHeight * scale));
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    cv.getContext('2d').drawImage(img, 0, 0, w, h);
    let d = cv.toDataURL('image/webp', 0.84), ext = 'webp';
    if (!d.startsWith('data:image/webp')) { d = cv.toDataURL('image/jpeg', 0.86); ext = 'jpg'; }
    return { dataUrl: d, ext };
  };
  const addImage = async (p, file) => {
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) { toast('That image is over 15 MB. Pick a smaller one.', 'err'); return; }
    const { img, url } = await readImage(file);
    const big = encode(img, 1600), small = encode(img, 720);
    URL.revokeObjectURL(url);
    const stamp = Date.now().toString(36);
    const name = (slugify(p.name) || 'project') + '-' + stamp;
    const pathBig = `/images/${name}.${big.ext}`, pathSmall = `/images/${name}-720.${small.ext}`;
    [p.image, p.image_small].forEach(old => { if (uploads[old]) delete uploads[old]; });
    uploads[pathBig] = { dataUrl: big.dataUrl }; uploads[pathSmall] = { dataUrl: small.dataUrl };
    p.image = pathBig; p.image_small = pathSmall;
    toast('Image added. It goes live when you publish.', 'ok', 3000);
  };
  const imgSrc = v => (uploads[v] ? uploads[v].dataUrl : v);

  // ---------- hero background image
  const heroBgEditor = () => {
    const H = content.hero;
    const box = el('div', { class: 'cover-ed hero-bg-ed' });
    const clearOld = () => { [H.background_image, H.background_image_webp].forEach(o => { if (uploads[o]) delete uploads[o]; }); };
    const draw = () => {
      const prev = el('div', { class: 'cover-prev hero-bg-prev' });
      if (H.background_image) prev.append(el('img', { src: imgSrc(H.background_image), alt: '' })); else prev.textContent = 'No background image';
      const file = el('input', { type: 'file', accept: 'image/*', 'aria-label': 'Upload hero background image' });
      file.addEventListener('change', async () => {
        const f = file.files[0]; if (!f) return;
        try {
          if (f.size > 15 * 1024 * 1024) { toast('That image is over 15 MB. Pick a smaller one.', 'err'); return; }
          const { img, url } = await readImage(f);
          const big = encode(img, 2400); URL.revokeObjectURL(url);
          clearOld();
          const path = `/images/hero-${Date.now().toString(36)}.${big.ext}`;
          uploads[path] = { dataUrl: big.dataUrl };
          H.background_image = path; H.background_image_webp = '';
          toast('Background added. It goes live when you publish.', 'ok', 3000);
          changed(); draw(); goPreview('/');
        } catch (e) { toast(e.message, 'err'); }
      });
      const urlIn = el('input', { type: 'url', placeholder: 'https://… or /images/…', value: uploads[H.background_image] ? '' : (H.background_image || ''), spellcheck: 'false', autocapitalize: 'off' });
      urlIn.addEventListener('change', () => { clearOld(); H.background_image = urlIn.value.trim(); H.background_image_webp = ''; changed(); draw(); });
      box.replaceChildren(prev,
        el('div', { class: 'btn-row' },
          el('span', { class: 'btn ghost small file-btn' }, H.background_image ? 'Replace image' : 'Upload image', file),
          H.background_image ? el('button', { type: 'button', class: 'btn ghost small danger', onclick: () => { clearOld(); H.background_image = ''; H.background_image_webp = ''; changed(); draw(); } }, 'Remove image') : null),
        el('label', {}, 'Or paste an image link', urlIn));
    };
    draw();
    return el('section', { class: 'sec' }, el('h2', { text: 'Hero background' }), el('p', { class: 'hint', text: 'The big image behind your name on the home page. Wide pictures work best (at least 1600 px across). It’s darkened automatically so your text stays readable.' }), box);
  };

  // ---------- project editor
  const COVER_OPTS = [['purple', 'Purple'], ['green', 'Green'], ['blue', 'Blue'], ['red', 'Red']];
  const coverEditor = p => {
    const box = el('div', { class: 'cover-ed' });
    const draw = () => {
      const prev = el('div', { class: 'cover-prev th-' + (p.cover_style || 'purple') });
      if (p.image) prev.append(el('img', { src: imgSrc(p.image_small || p.image) || imgSrc(p.image), alt: '' })); else prev.textContent = p.name || 'Project';
      const file = el('input', { type: 'file', accept: 'image/*', 'aria-label': 'Upload cover image' });
      file.addEventListener('change', async () => { try { await addImage(p, file.files[0]); changed(); draw(); drawHead(); } catch (e) { toast(e.message, 'err'); } });
      const urlIn = el('input', { type: 'url', placeholder: 'https://… or /images/…', value: uploads[p.image] ? '' : (p.image || ''), spellcheck: 'false', autocapitalize: 'off' });
      urlIn.addEventListener('change', () => { const v = urlIn.value.trim(); if (uploads[p.image]) delete uploads[p.image]; if (uploads[p.image_small]) delete uploads[p.image_small]; p.image = v; p.image_small = ''; changed(); draw(); drawHead(); });
      box.replaceChildren(prev,
        el('div', { class: 'btn-row' },
          el('span', { class: 'btn ghost small file-btn' }, p.image ? 'Replace image' : 'Upload image', file),
          p.image ? el('button', { type: 'button', class: 'btn ghost small danger', onclick: () => { [p.image, p.image_small].forEach(o => { if (uploads[o]) delete uploads[o]; }); p.image = ''; p.image_small = ''; changed(); draw(); drawHead(); } }, 'Remove image') : null),
        el('label', {}, 'Or paste an image link', urlIn),
        p.image ? null : field(p, { k: 'cover_style', t: 'select', label: 'Name cover colour (used when there’s no image)', options: COVER_OPTS, after: () => { draw(); drawHead(); } }));
    };
    let drawHead = () => {};
    box._setHead = fn => { drawHead = fn; };
    draw();
    return box;
  };
  const projectFields = p => [
    { k: 'name', label: 'Game name', oninput: v => { if (p._new) { const old = p.slug; p.slug = uniqueSlug(slugify(v) || 'project', p); renameSlug(old, p.slug); p._slugWas = p.slug; const s = document.getElementById('slug-' + p._uid); if (s) s.value = p.slug; clearTimeout(navT); navT = setTimeout(() => { fillPageSelect(); goPreview('/work/' + p.slug + '/'); }, 700); } } },
    { k: 'slug', label: 'Page address (/work/…)', hint: 'Lowercase letters, numbers and dashes.', t: 'url', onchange: (v, inp) => { const old = p._slugWas || ''; const nv = uniqueSlug(slugify(v) || slugify(p.name) || 'project', p); p.slug = nv; inp.value = nv; delete p._new; renameSlug(old, nv); p._slugWas = nv; changed(); fillPageSelect(); goPreview('/work/' + nv + '/'); } },
    { k: 'role', label: 'Your role', ph: 'Project Lead' },
    { k: 'role_sub', label: 'Second role (optional)', ph: 'Live Operations' },
    { k: 'state', t: 'select', label: 'Current or former?', options: [['current', 'Current (gold dot)'], ['former', 'Former']] },
    { k: 'status', label: 'Status badge', ph: 'In development' },
    { k: 'timeline_label', label: 'Timeline label', ph: 'Now / Before' },
    { t: 'custom', render: () => el('p', { class: 'sub-h', text: 'Cover' }) },
    { t: 'custom', render: obj => obj._cover },
    { t: 'custom', render: () => el('p', { class: 'sub-h', text: 'Card' }) },
    { k: 'short', label: 'Short line on the card', multi: true, rows: 2 },
    { k: 'tags', t: 'strings', label: 'Tags', add: 'Add tag' },
    { k: 'highlights', t: 'list', label: 'Big numbers on the card', itemName: 'Number', add: 'Add number', two: true, blank: { value: '', label: '' }, item: [{ k: 'value', label: 'Number', ph: '85M+' }, { k: 'label', label: 'Label', ph: 'visits' }] },
    { t: 'custom', render: () => el('p', { class: 'sub-h', text: 'Project page' }) },
    { k: 'intro', label: 'Intro paragraph', multi: true, rows: 4 },
    { k: 'facts', t: 'list', label: 'Facts', itemName: 'Fact', add: 'Add fact', two: true, blank: { label: '', value: '' }, item: [{ k: 'label', label: 'Label', ph: 'Role' }, { k: 'value', label: 'Value', ph: 'Project Lead' }] },
    { k: 'stats', t: 'list', label: 'Stats (count up)', itemName: 'Stat', add: 'Add stat', blank: { value: 0, suffix: '', label: '' }, item: [{ k: 'value', t: 'number', label: 'Number', ph: '85' }, { k: 'suffix', label: 'After the number', ph: 'M+' }, { k: 'label', label: 'Label', ph: 'Visits' }] },
    { k: 'responsibilities_title', label: 'Responsibilities heading', ph: 'What I do on it' },
    { k: 'responsibilities', t: 'list', label: 'Responsibilities', itemName: 'Responsibility', add: 'Add responsibility', blank: { title: '', text: '' }, item: [{ k: 'title', label: 'Title' }, { k: 'text', label: 'Text', multi: true, rows: 2 }] },
    { k: 'liveops', t: 'list', label: 'Live operations (optional)', itemName: 'Live-ops item', add: 'Add live-ops item', blank: { title: '', text: '' }, item: [{ k: 'title', label: 'Title' }, { k: 'text', label: 'Text', multi: true, rows: 2 }] },
    { k: 'scope', label: 'Scope (optional)', multi: true, rows: 2 },
    { k: 'links', t: 'list', label: 'Links (Roblox game, group, trailer…)', itemName: 'Link', add: 'Add link', two: true, blank: { label: '', url: '' }, item: [{ k: 'label', label: 'Button text', ph: 'Play on Roblox' }, { k: 'url', t: 'url', label: 'Link', ph: 'https://www.roblox.com/games/…' }] },
    { k: 'note', label: 'Small note at the bottom (optional)', ph: 'More coming soon.' },
    { k: 'seo_description', label: 'Link preview description', multi: true, rows: 2, hint: 'Shown by Google and in shared links.' }
  ];
  let uid = 0, navT;
  const uniqueSlug = (s, self) => { let out = s, n = 2; while ((content.projects || []).some(p => p !== self && p.slug === out)) out = s + '-' + n++; return out; };
  const drawProjects = () => {
    const wrap = el('div', { class: 'list' });
    const arr = content.projects;
    arr.forEach((p, i) => {
      if (!p._uid) Object.defineProperty(p, '_uid', { value: ++uid, enumerable: false, writable: true });
      Object.defineProperty(p, '_slugWas', { value: p.slug, enumerable: false, writable: true, configurable: true });
      const thumb = el('div');
      const titleBox = el('div', { class: 'proj-title' });
      const drawHead = () => {
        thumb.className = 'proj-thumb th-' + (p.cover_style || 'purple');
        thumb.replaceChildren(p.image ? el('img', { src: imgSrc(p.image_small || p.image), alt: '' }) : (p.name || '').slice(0, 14));
        titleBox.replaceChildren(el('strong', { text: p.name || 'Untitled project' }), el('span', { text: [p.role, p.state === 'former' ? 'former' : 'current'].filter(Boolean).join(' · ') }));
      };
      drawHead();
      const open = i === openProject;
      const card = el('div', { class: 'proj' + (open ? ' open' : '') });
      const head = el('div', { class: 'proj-head', role: 'button', tabindex: '0', 'aria-expanded': String(open) }, thumb, titleBox,
        el('div', { class: 'proj-tools' },
          el('button', { type: 'button', class: 'icon-btn', title: 'Move up', 'aria-label': 'Move ' + p.name + ' up', disabled: i === 0 || null, onclick: e => { e.stopPropagation(); [arr[i - 1], arr[i]] = [arr[i], arr[i - 1]]; if (openProject === i) openProject--; else if (openProject === i - 1) openProject++; changed(); fillPageSelect(); drawPanel(); } }, '↑'),
          el('button', { type: 'button', class: 'icon-btn', title: 'Move down', 'aria-label': 'Move ' + p.name + ' down', disabled: i === arr.length - 1 || null, onclick: e => { e.stopPropagation(); [arr[i + 1], arr[i]] = [arr[i], arr[i + 1]]; if (openProject === i) openProject++; else if (openProject === i + 1) openProject--; changed(); fillPageSelect(); drawPanel(); } }, '↓'),
          el('button', { type: 'button', class: 'icon-btn del', title: 'Delete', 'aria-label': 'Delete ' + p.name, onclick: e => { e.stopPropagation(); if (!confirm('Delete “' + (p.name || 'this project') + '” from your portfolio?')) return; arr.splice(i, 1); dropSlug(p.slug); [p.image, p.image_small].forEach(o => { if (uploads[o]) delete uploads[o]; }); openProject = -1; changed(); fillPageSelect(); drawPanel(); toast('Project removed. Publish to make it live.', '', 3000); } }, '✕')));
      const toggle = () => { openProject = open ? -1 : i; drawPanel(); if (!open) goPreview('/work/' + p.slug + '/'); };
      head.addEventListener('click', toggle);
      head.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });
      card.append(head);
      if (open) {
        const cov = coverEditor(p); cov._setHead(drawHead);
        Object.defineProperty(p, '_cover', { value: cov, enumerable: false, configurable: true, writable: true });
        const fields = projectFields(p).map(f => {
          const n = render1(p, f);
          if (f.k === 'slug') n.querySelector('input').id = 'slug-' + p._uid;
          if (f.k === 'name' || f.k === 'role' || f.k === 'state') n.addEventListener('input', drawHead), n.addEventListener('change', drawHead);
          return n;
        });
        card.append(el('div', { class: 'proj-body' }, el('div', { class: 'fgrid' }, ...fields)));
      }
      wrap.append(card);
    });
    wrap.append(el('button', { type: 'button', class: 'btn primary add', onclick: () => {
      const p = { slug: '', name: 'New project', role: 'Project Lead', role_sub: '', state: 'current', status: 'In development', timeline_label: 'Now', image: '', image_small: '', cover_style: 'purple', short: '', tags: [], highlights: [], intro: '', seo_description: '', facts: [{ label: 'Role', value: 'Project Lead' }], stats: [], responsibilities_title: 'What I do on it', responsibilities: [], liveops: [], scope: '', note: '', links: [] };
      p.slug = uniqueSlug('new-project', p);
      Object.defineProperty(p, '_new', { value: true, enumerable: false, configurable: true, writable: true });
      arr.push(p); openProject = arr.length - 1; changed(); fillPageSelect(); drawPanel(); goPreview('/work/' + p.slug + '/');
      setTimeout(() => { const n = document.querySelector('.proj.open input'); if (n) { n.focus(); n.select(); } }, 60);
    } }, '+ Add project'));
    return el('section', { class: 'sec' }, el('h2', { text: 'Projects' }), el('p', { class: 'hint', text: 'Tap a project to edit it. Use ↑ ↓ to reorder; the order here is the order on your site.' }), wrap);
  };

  // ---------- sections
  const projOptions = () => [['', '— None —'], ...(content.projects || []).map(p => [p.slug, p.name || p.slug])];
  const TABS = {
    profile: ['Profile', '/', () => [
      section('You', 'Your name and title appear at the top of every page.', content.site, [{ k: 'name', label: 'Name' }, { k: 'title', label: 'Title under your name', ph: 'Project Lead' }, { k: 'footer', label: 'Footer text' }], true),
      section('Hero', 'The first thing visitors see.', content.hero, [{ k: 'eyebrow', label: 'Small line above your name' }, { k: 'tagline', label: 'Tagline', multi: true, rows: 2 }, { k: 'primary_button', label: 'Main button' }, { k: 'secondary_button', label: 'Second button' }]),
      heroBgEditor(),
      section('Hero numbers', 'These count up when the page opens.', content, [{ k: 'stats', t: 'list', label: 'Numbers', itemName: 'Number', add: 'Add number', blank: { value: 0, suffix: '', label: '', auto: false }, item: [{ k: 'value', t: 'number', label: 'Number', ph: '85' }, { k: 'suffix', label: 'After the number', ph: 'M+' }, { k: 'label', label: 'Label', ph: 'Project visits' }, { k: 'auto', t: 'check', label: 'Use my number of projects automatically' }] }]),
      section('“Now leading” card', 'The small card next to your name on the home page.', content.hero, [{ k: 'now_label', label: 'Card label', ph: 'Now leading' }, { k: 'now_project', t: 'select', label: 'Project', options: projOptions }], true)
    ]],
    projects: ['Projects', '/work/', () => [drawProjects()]],
    home: ['Home page', '/', () => [
      section('Selected projects', null, content.home, [{ k: 'work_kicker', label: 'Small label' }, { k: 'work_title', label: 'Heading' }, { k: 'work_sub', label: 'Text', multi: true, rows: 2 }, { k: 'featured', t: 'projects', label: 'Show these on the home page (the first is the big card)' }]),
      section('About preview', null, content.home, [{ k: 'about_kicker', label: 'Small label' }, { k: 'about_title', label: 'Heading' }, { k: 'about_intro', label: 'Big line' }, { k: 'about_text', label: 'Text', multi: true, rows: 3 }]),
      section('Big scrolling words', 'The huge outlined words that drift behind the projects strip, the skills section and the top of the Work page. One word or short phrase per line; dots are added between them.', content.home, [{ k: 'marquee', t: 'strings', label: 'Words', add: 'Add word' }]),
      section('Skills & contact', null, content.home, [{ k: 'skills_kicker', label: 'Skills label' }, { k: 'skills_title', label: 'Skills heading' }, { k: 'contact_kicker', label: 'Contact label' }], true)
    ]],
    about: ['About', '/about/', () => [
      section('About page', null, content.about, [{ k: 'title', label: 'Heading' }, { k: 'title_muted', label: 'Heading, grey part' }], true),
      section('Your story', null, content.about, [{ k: 'intro', label: 'Big line' }, { k: 'paragraphs', t: 'strings', label: 'Paragraphs', multi: true, add: 'Add paragraph' }]),
      section('How I work', null, content.about, [{ k: 'steps_kicker', label: 'Small label' }, { k: 'steps_title', label: 'Heading' }, { k: 'steps', t: 'list', label: 'Steps', itemName: 'Step', add: 'Add step', blank: { title: '', text: '' }, item: [{ k: 'title', label: 'Title' }, { k: 'text', label: 'Text', multi: true, rows: 2 }] }]),
      section('Timeline', 'The timeline lists your projects in order, using each project’s role and timeline label.', content.about, [{ k: 'timeline_title', label: 'Heading' }, { k: 'timeline_sub', label: 'Text' }], true),
      section('Work page', null, content.work, [{ k: 'title', label: 'Heading' }, { k: 'title_muted', label: 'Heading, grey part' }, { k: 'sub', label: 'Text', multi: true, rows: 2 }, { k: 'timeline_title', label: 'Timeline heading' }, { k: 'timeline_sub', label: 'Timeline text' }, { k: 'results_title', label: 'Numbers heading' }])
    ]],
    skills: ['Skills', '/skills/', () => [
      section('Skills page', null, content.skills, [{ k: 'title', label: 'Heading' }, { k: 'title_muted', label: 'Heading, grey part' }, { k: 'sub', label: 'Text', multi: true, rows: 2 }]),
      section('Skill groups', null, content.skills, [{ k: 'groups', t: 'list', label: 'Groups', itemName: 'Group', add: 'Add skill group', blank: { id: '', name: '', items: [], projects: [] }, item: [
        { k: 'name', label: 'Group name' },
        { k: 'items', t: 'list', label: 'Skills', itemName: 'Skill', add: 'Add skill', blank: { name: '', text: '' }, item: [{ k: 'name', label: 'Skill' }, { k: 'text', label: 'Description', multi: true, rows: 2 }] },
        { k: 'projects', t: 'projects', label: 'Used on' }] }])
    ]],
    contact: ['Contact', '/contact/', () => [
      section('How to reach you', null, content.contact, [{ k: 'email', t: 'email', label: 'Email' }, { k: 'discord', t: 'url', label: 'Discord invite link' }, { k: 'form_email', t: 'email', label: 'Form sends to', hint: 'A new address needs one “Activate” click in the first email FormSubmit sends.' }], true),
      section('Contact sections', null, content.contact, [{ k: 'cta_title', label: 'Call to action' }, { k: 'cta_muted', label: 'Call to action, grey part' }, { k: 'title', label: 'Contact page heading' }, { k: 'title_muted', label: 'Heading, grey part' }, { k: 'sub', label: 'Contact page text', multi: true, rows: 2 }]),
      section('Inquiry form', null, content.contact, [{ k: 'form_title', label: 'Form heading' }, { k: 'form_intro', label: 'Form text', multi: true, rows: 3 }, { k: 'form_note', label: 'Note under the button' }, { k: 'budgets', t: 'strings', label: 'Budget options', add: 'Add option' }])
    ]],
    seo: ['Link previews', '/', () => ['home', 'work', 'about', 'skills', 'contact'].map(k => {
      content.seo[k] = content.seo[k] || { title: '', description: '' };
      return section(k[0].toUpperCase() + k.slice(1) + ' page', k === 'home' ? 'Browser tab title and description. (Shared link cards use the defaults built into the page files.)' : null, content.seo[k], [{ k: 'title', label: 'Title' }, { k: 'description', label: 'Description', multi: true, rows: 2 }]);
    })],
    settings: ['Settings', null, () => [settingsPanel()]]
  };
  const settingsPanel = () => {
    const s = el('section', { class: 'sec' }, el('h2', { text: 'GitHub & publishing' }));
    const status = el('div', { class: 'kv' }, token ? el('span', { class: 'pill-ok', text: 'Connected' }) : el('span', { class: 'pill-off', text: 'Not connected' }), el('span', { class: 'muted', text: `${settings.owner || '?'} / ${settings.repo || '?'} · ${settings.branch}` }));
    const repoFields = el('div', { class: 'fgrid two' },
      field(settings, { k: 'owner', label: 'GitHub username', t: 'url', oninput: () => store.set(K.settings, settings) }),
      field(settings, { k: 'repo', label: 'Repo name', t: 'url', oninput: () => store.set(K.settings, settings) }),
      field(settings, { k: 'branch', label: 'Branch', t: 'url', oninput: () => store.set(K.settings, settings) }),
      field(settings, { k: 'site_url', label: 'Live site address (optional)', t: 'url', ph: 'https://…vercel.app', oninput: () => store.set(K.settings, settings) }));
    s.append(status, repoFields, el('div', { class: 'btn-row' },
      el('button', { type: 'button', class: 'btn ghost', onclick: () => openConnect() }, token ? 'Change token' : 'Connect GitHub'),
      token ? el('button', { type: 'button', class: 'btn ghost danger', onclick: signOut }, 'Sign out') : null,
      el('button', { type: 'button', class: 'btn ghost', onclick: () => reload(true) }, 'Reload from GitHub')));
    const s2 = el('section', { class: 'sec' }, el('h2', { text: 'This device' }), el('p', { class: 'hint', text: 'Your token and passcode live only in this browser. The passcode just hides the editor; the token is what protects your site.' }),
      el('div', { class: 'btn-row' },
        el('button', { type: 'button', class: 'btn ghost', onclick: changePass }, 'Change passcode'),
        el('button', { type: 'button', class: 'btn ghost', onclick: downloadJson }, 'Download content.json backup'),
        el('button', { type: 'button', class: 'btn ghost danger', onclick: discard }, 'Discard unsaved changes'),
        el('button', { type: 'button', class: 'btn ghost', onclick: lock }, 'Lock editor')));
    return el('div', { class: 'list' }, s, s2);
  };
  const drawTabs = () => {
    $('#tabs').replaceChildren(...Object.entries(TABS).map(([k, [label]]) => el('button', { type: 'button', class: 'tab', role: 'tab', 'aria-selected': String(k === tab), onclick: () => { if (tab === k) return; tab = k; openProject = -1; drawTabs(); drawPanel(); const pv = TABS[k][1]; if (pv) goPreview(pv); scrollTo({ top: 0 }); } }, label)));
    const cur = $('#tabs [aria-selected=true]'); if (cur) cur.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  };
  const drawPanel = () => { const y = scrollY; $('#panel').replaceChildren(...TABS[tab][2]()); scrollTo({ top: y }); };

  // ---------- actions
  const signOut = () => { token = ''; store.del(K.token); toast('Signed out. Your token was removed from this browser.', 'ok'); drawPanel(); };
  const lock = () => { sessionStorage.removeItem(K.unlocked); location.reload(); };
  const discard = () => { if (!confirm('Throw away all changes you haven’t published?')) return; content = JSON.parse(base); uploads = {}; store.del(K.draft); openProject = -1; changed(); fillPageSelect(); drawPanel(); $('#banner').hidden = true; toast('Changes discarded.', 'ok'); };
  const downloadJson = () => { const a = el('a', { href: URL.createObjectURL(new Blob([JSON.stringify(content, null, 2)], { type: 'application/json' })), download: 'content.json' }); document.body.append(a); a.click(); a.remove(); };
  const changePass = async () => {
    const a = prompt('New passcode (4+ characters):'); if (!a) return;
    if (a.length < 4) { toast('Use at least 4 characters.', 'err'); return; }
    if (prompt('Type it again:') !== a) { toast('Those didn’t match.', 'err'); return; }
    store.set(K.pass, await sha256(a)); toast('Passcode changed on this device. It’s saved to your repo on your next publish.', 'ok', 5000);
  };

  const validate = () => {
    const seen = new Set();
    for (const p of content.projects || []) {
      if (!p.name || !p.name.trim()) return 'Every project needs a name.';
      if (!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(p.slug || '')) return `“${p.name}” needs a page address made of lowercase letters, numbers and dashes.`;
      if (p.slug === 'project' || p.slug === 'index') return `“${p.name}” can’t use the address “${p.slug}”.`;
      if (seen.has(p.slug)) return `Two projects use the address “${p.slug}”.`;
      seen.add(p.slug);
    }
    if (!content.site.name || !content.site.name.trim()) return 'Your name can’t be empty.';
    return '';
  };

  let busy = false;
  const setBusy = (btn, on, label) => { btn.classList.toggle('is-busy', on); btn.disabled = on; if (label) btn.querySelector('.lbl').textContent = label; };
  const publish = async () => {
    if (busy) return;
    const bad = validate(); if (bad) { toast(bad, 'err', 6000); return; }
    if (!token) { openConnect(true); return; }
    if (!settings.owner || !settings.repo) { toast('Add your GitHub username and repo name in Settings.', 'err'); return; }
    const btn = $('#publish'); busy = true; setBusy(btn, true, 'Publishing…');
    try {
      const used = new Set([...(content.projects || []).flatMap(p => [p.image, p.image_small]), (content.hero || {}).background_image]);
      const todo = Object.keys(uploads).filter(k => used.has(k));
      let n = 0;
      for (const path of todo) {
        n++; btn.querySelector('.lbl').textContent = `Uploading image ${n}/${todo.length}…`;
        await putFile(path.replace(/^\//, ''), uploads[path].dataUrl.split(',')[1], `Add image ${path.split('/').pop()} (via admin)`, true, true);
      }
      btn.querySelector('.lbl').textContent = 'Publishing…';
      const json = JSON.stringify(content, null, 2) + '\n';
      await putFile('content.json', b64utf8(json), 'Update portfolio content (via admin)');
      const passHash = store.get(K.pass, '');
      const want = { owner: settings.owner, repo: settings.repo, branch: settings.branch, site_url: settings.site_url || '', passcode_sha256: passHash || config.passcode_sha256 || '' };
      if (['owner', 'repo', 'branch', 'site_url', 'passcode_sha256'].some(k => (config[k] || '') !== (want[k] || ''))) {
        try { await putFile('admin/config.json', b64utf8(JSON.stringify(want, null, 2) + '\n'), 'Update admin settings (via admin)'); config = want; } catch (e) { /* content is live; settings can wait */ }
      }
      base = JSON.stringify(content); uploads = {}; store.del(K.draft); changed(false); $('#banner').hidden = true;
      toast('Published ✓ live in ~1 min', 'ok', 6000, settings.site_url ? { href: settings.site_url, text: 'Open site' } : null);
    } catch (e) {
      toast(friendly(e), 'err', 8000);
      if (e.status === 401) { /* keep the token so they can see Settings; they can replace it */ }
    } finally { busy = false; setBusy(btn, false, 'Save & publish'); }
  };

  // ---------- connect modal
  let afterConnect = false;
  const openConnect = (thenPublish = false) => {
    afterConnect = thenPublish;
    $('#c-token').value = ''; $('#c-owner').value = settings.owner || ''; $('#c-repo').value = settings.repo || ''; $('#c-branch').value = settings.branch || 'main'; $('#c-err').textContent = '';
    $('#connect').hidden = false; setTimeout(() => $('#c-token').focus(), 50);
  };
  const connect = async e => {
    e.preventDefault();
    const btn = $('#c-go'); const t = $('#c-token').value.trim();
    if (!t) { $('#c-err').textContent = 'Paste your token first.'; return; }
    const prevToken = token; token = t;
    setBusy(btn, true, 'Checking…'); $('#c-err').textContent = '';
    try {
      let owner = $('#c-owner').value.trim();
      if (!owner) { const me = await gh('/user'); owner = me.login; }
      settings.owner = owner; settings.repo = $('#c-repo').value.trim() || settings.repo; settings.branch = $('#c-branch').value.trim() || 'main';
      const repo = await gh(repoPath());
      if (repo.permissions && repo.permissions.push === false) throw new GHError(403, 'no push');
      store.set(K.token, t); store.set(K.settings, settings);
      $('#connect').hidden = true; toast('Connected to GitHub ✓', 'ok', 3000);
      if (tab === 'settings') drawPanel();
      if (afterConnect) publish();
    } catch (err) {
      token = prevToken;
      $('#c-err').textContent = err.status ? friendly(err) : (err.message || 'Couldn’t connect.');
    } finally { setBusy(btn, false, 'Connect'); }
  };

  // ---------- loading content
  const reload = async (force = false) => {
    if (force && dirty() && !confirm('Reloading replaces your unpublished changes. Continue?')) return;
    try {
      let loaded = null;
      if (token && settings.owner && settings.repo) {
        try { const f = await getFile('content.json'); if (f && f.content) loaded = JSON.parse(unb64utf8(f.content)); }
        catch (e) { if (force) toast(friendly(e), 'err', 6000); }
      }
      if (!loaded) { const r = await fetch('/content.json', { cache: 'no-cache' }); loaded = await r.json(); }
      base = JSON.stringify(loaded); content = loaded; uploads = {}; store.del(K.draft);
      if (force) toast('Loaded the latest published content.', 'ok', 3000);
      openProject = -1; changed(); fillPageSelect(); drawPanel();
    } catch (e) { toast('Couldn’t load your content. Refresh to try again.', 'err', 8000); }
  };
  const normalize = c => {
    c.site = c.site || {}; c.hero = c.hero || {}; c.home = c.home || {}; c.work = c.work || {}; c.about = c.about || {};
    c.skills = c.skills || { groups: [] }; c.skills.groups = c.skills.groups || []; c.contact = c.contact || {}; c.seo = c.seo || {};
    c.stats = c.stats || []; c.projects = c.projects || [];
    return c;
  };
  const boot = async () => {
    settings = { owner: config.owner, repo: config.repo, branch: config.branch || 'main', site_url: config.site_url || '', ...store.get(K.settings, {}) };
    const draft = store.get(K.draft);
    let published = null;
    try { const r = await fetch('/content.json', { cache: 'no-cache' }); published = await r.json(); } catch (e) {}
    if (token && settings.owner && settings.repo) {
      try { const f = await getFile('content.json'); if (f && f.content) published = JSON.parse(unb64utf8(f.content)); }
      catch (e) { toast(friendly(e), 'err', 7000); }
    }
    if (!published && !draft) { toast('Couldn’t load your content. Refresh to try again.', 'err', 9000); return; }
    if (draft && draft.content) {
      content = normalize(draft.content); uploads = draft.uploads || {}; base = published ? JSON.stringify(published) : (draft.base || '');
      if (dirty()) {
        const b = $('#banner'); b.hidden = false;
        b.replaceChildren(el('span', { text: 'You have unpublished changes from last time.' }),
          el('button', { type: 'button', class: 'btn ghost small', onclick: () => { b.hidden = true; } }, 'Keep editing'),
          el('button', { type: 'button', class: 'btn ghost small danger', onclick: discard }, 'Discard them'));
      }
    } else { content = normalize(published); base = JSON.stringify(published); }
    $('#shell').hidden = false;
    drawTabs(); drawPanel(); fillPageSelect(); changed(false);
    frame().src = '/';
  };

  // ---------- passcode gate (cosmetic: the GitHub token is the real lock)
  const gate = async () => {
    try { const r = await fetch('/admin/config.json', { cache: 'no-cache' }); if (r.ok) config = { ...config, ...(await r.json()) }; } catch (e) {}
    if (sessionStorage.getItem(K.unlocked) === '1') return boot();
    const hash = store.get(K.pass, '') || config.passcode_sha256 || '';
    const creating = !hash;
    const g = $('#gate'); g.hidden = false;
    if (creating) { $('#gate-title').textContent = 'Create a passcode'; $('#gate-sub').textContent = 'You’ll type this to open the editor on this device.'; $('#gate-pass2').hidden = false; $('#gate-btn').textContent = 'Create & open'; $('#gate-pass').autocomplete = 'new-password'; }
    setTimeout(() => $('#gate-pass').focus(), 50);
    $('#gate-form').addEventListener('submit', async e => {
      e.preventDefault();
      const a = $('#gate-pass').value;
      if (creating) {
        if (a.length < 4) { $('#gate-err').textContent = 'Use at least 4 characters.'; return; }
        if (a !== $('#gate-pass2').value) { $('#gate-err').textContent = 'Those don’t match.'; return; }
        store.set(K.pass, await sha256(a));
      } else if (await sha256(a) !== hash) { $('#gate-err').textContent = 'Wrong passcode.'; $('#gate-pass').select(); return; }
      sessionStorage.setItem(K.unlocked, '1'); g.hidden = true; boot();
    });
  };

  // ---------- wiring
  $('#publish').addEventListener('click', publish);
  $('#connect-form').addEventListener('submit', connect);
  $('#c-cancel').addEventListener('click', () => { $('#connect').hidden = true; });
  $('#open-preview').addEventListener('click', () => { document.body.classList.add('show-preview'); refreshPreview(); });
  $('#close-preview').addEventListener('click', () => document.body.classList.remove('show-preview'));
  $('#pv-page').addEventListener('change', e => goPreview(e.target.value));
  frame().addEventListener('load', () => { try { frameWin = frame().contentWindow; syncPageSelect(); } catch (e) {} });
  addEventListener('keydown', e => { if ((e.metaKey || e.ctrlKey) && e.key === 's') { e.preventDefault(); publish(); } if (e.key === 'Escape') { $('#connect').hidden = true; document.body.classList.remove('show-preview'); } });
  window.__kamiAdmin = { get content() { return content; }, get uploads() { return uploads; }, publish };
  gate();
})();
