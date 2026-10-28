/* Customer storefront */
(async function () {
  'use strict';
  const J = window.Jersey, DB = window.DB;
  const { esc, inr, safeUrl } = J;
  const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
  const ls = { get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } } };
  const WA_SVG = '<svg class="wa-ic" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2c-1.5 0-3-.4-4.3-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.4.1-.7.3-.2.3-.9.9-.9 2.2s.9 2.5 1 2.7c.1.2 1.8 2.8 4.4 3.9 1.6.7 2.3.8 3.1.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.5-.3z"/></svg>';

  let SETTINGS = { ...DB.DEFAULT_SETTINGS };
  let PRODUCTS = [];
  let wish = ls.get('ss_wish', []).map(String);
  let cart = ls.get('ss_cart', []).filter(i => i && i.title);
  let filter = 'all', sortBy = 'featured', query = '';
  let pending = null; // what to do after login: 'checkout' | 'orders'

  /* ---------- small UI helpers ---------- */
  let tt; function toast(m) { const t = $('#toast'); t.textContent = m; t.classList.add('show'); clearTimeout(tt); tt = setTimeout(() => t.classList.remove('show'), 2600); }
  const root = document.documentElement;
  root.setAttribute('data-theme', 'light'); // customer store always uses the white theme
  $('#menuBtn').onclick = () => $('#navLinks').classList.toggle('open');
  $$('#navLinks a').forEach(a => a.addEventListener('click', () => $('#navLinks').classList.remove('open')));
  $('#yr').textContent = new Date().getFullYear();

  function openLayer(el) { $$('.drawer.open,.modal.open').forEach(x => x !== el && x.classList.remove('open')); $('#overlay').classList.add('show'); el.classList.add('open'); document.body.style.overflow = 'hidden'; }
  function closeAll() { $('#overlay').classList.remove('show'); $$('.drawer.open,.modal.open').forEach(x => x.classList.remove('open')); document.body.style.overflow = ''; }
  $('#overlay').onclick = closeAll;
  document.addEventListener('click', e => { if (e.target.closest('[data-close]')) closeAll(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeAll(); });
  document.addEventListener('click', e => {
    const o = e.target.closest('[data-open]'); if (!o) return; e.preventDefault(); $('#navLinks').classList.remove('open');
    if (o.dataset.open === 'orders') openOrders(); else if (o.dataset.open === 'account') openAccount();
  });
  function copy(text, msg) {
    const done = () => toast(msg);
    const fallback = () => { const t = document.createElement('textarea'); t.value = text; document.body.appendChild(t); t.select(); try { document.execCommand('copy'); done(); } catch (e) { prompt('Copy this:', text); } t.remove(); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, fallback); else fallback();
  }
  function download(blob, name) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); }
  const busy = (btn, on, label) => { if (!btn) return; if (on) { btn.dataset.label = btn.innerHTML; btn.disabled = true; btn.style.opacity = .7; btn.innerHTML = label || 'Please wait…'; } else { btn.disabled = false; btn.style.opacity = ''; btn.innerHTML = btn.dataset.label || btn.innerHTML; } };

  /* ---------- settings ---------- */
  function applySettings() {
    const name = SETTINGS.store_name || 'Sixer Studio';
    $('#storeName').textContent = name.toUpperCase();
    $('#logoMark').textContent = name.trim()[0] ? name.trim()[0].toUpperCase() : 'S';
    $$('.js-store').forEach(e => e.textContent = name);
    $$('footer .logo-mark').forEach(e => e.textContent = $('#logoMark').textContent);
    document.title = name + ' — Custom Cricket Jerseys';
    $('#announce').textContent = SETTINGS.announcement || '';
    $('#announce').style.display = SETTINGS.announcement ? '' : 'none';
    const wa = J.waNumber(SETTINGS.whatsapp);
    $('#ctaWa').href = wa ? J.waLink(wa, `Hi ${name}! I have a question about custom jerseys.`) : '#';
    $('#ctaWa').onclick = e => { if (!wa) { e.preventDefault(); toast('WhatsApp number not set yet (Admin → Settings)'); } };
    S.premiumExtra = 50;
    renderStudio(false); teamSummary();
  }
  if (DB.mode === 'demo') $('#demoBar').innerHTML = `<div class="demo-bar">🧪 Demo mode — bookings are saved only in this browser. ${DB.configError ? '<b>Could not load the database library — check your internet.</b>' : 'Connect Supabase in <code>js/config.js</code> to go live.'}</div>`;

  /* ---------- hero ---------- */
  let heroI = 0; const heroNames = ['ARJUN', 'MEERA', 'KABIR', 'ZOYA'];
  const heroDesigns = [['sash', ['#0a1f44', '#c6ff1a', '#ffffff'], 'polo'], ['chevron', ['#111111', '#e63946', '#f1faee'], 'polo'], ['fade', ['#ff4d2e', '#ffb800', '#ffffff'], 'polo'], ['split', ['#5a189a', '#ff9e00', '#ffffff'], 'round'], ['wave', ['#006d77', '#83c5be', '#edf6f9'], 'polo']];
  function hero() { const d = heroDesigns[heroI % heroDesigns.length]; const el = $('#heroJersey'); el.style.opacity = 0; setTimeout(() => { el.innerHTML = J.svg({ pattern: d[0], c: d[1], collar: d[2], side: heroI % 2 ? 'back' : 'front', team: 'SIXERS XI', name: heroNames[heroI % 4], number: String(7 + heroI * 9 % 90) }); el.style.opacity = 1; }, 250); heroI++; }
  hero(); setInterval(hero, 3200);

  /* ---------- shop ---------- */
  const heartSVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z"/></svg>';
  const disc = p => p.mrp && p.mrp > p.price ? Math.round((1 - p.price / p.mrp) * 100) : 0;
  const catLabel = c => J.CATEGORIES[c] || (c.charAt(0).toUpperCase() + c.slice(1));
  const isSvgData = u => /^data:image\/svg/i.test(u);
  const placeholder = () => J.svg({ pattern: 'sash', c: ['#d8dce6', '#eef0f6', '#ffffff'], collar: 'polo' });
  function mediaHTML(p) {
    const imgs = p.images.map(safeUrl).filter(Boolean);
    if (!imgs.length) return `<div class="face svgface single">${placeholder()}</div>`;
    const one = imgs.length === 1 ? ' single' : '';
    return `<img class="face front${one}" src="${esc(imgs[0])}" alt="${esc(p.name)}" loading="lazy">` + (imgs[1] ? `<img class="face back" src="${esc(imgs[1])}" alt="" loading="lazy">` : '');
  }
  function cardHTML(p) {
    const d = disc(p); const contain = p.images[0] && isSvgData(p.images[0]) ? ' contain' : '';
    return `<article class="card"><div class="card-media${contain}" data-act="open" data-id="${esc(p.id)}">
      ${p.tag ? `<span class="tag">${esc(p.tag)}</span>` : ''}${d ? `<span class="off">-${d}%</span>` : ''}${p.images.length > 1 ? '<span class="flip-hint">hover ↻</span>' : ''}
      <button class="heart ${wish.includes(String(p.id)) ? 'on' : ''}" data-act="wish" data-id="${esc(p.id)}" aria-label="Add to wishlist">${heartSVG}</button>
      ${mediaHTML(p)}</div>
      <div class="card-body"><h3>${esc(p.name)}</h3><small class="muted">${esc(catLabel(p.category))}${p.customizable ? ' · Name &amp; number' : ''}</small>
      <div class="price"><b>${inr(p.price)}</b>${d ? `<s>${inr(p.mrp)}</s>` : ''}</div>
      <div class="card-actions"><button class="btn btn-dark btn-sm" data-act="open" data-id="${esc(p.id)}">Select options</button></div></div></article>`;
  }
  function renderChips() {
    const cats = [...new Set(PRODUCTS.map(p => p.category))].sort((a, b) => Object.keys(J.CATEGORIES).indexOf(a) - Object.keys(J.CATEGORIES).indexOf(b));
    $('#chips').innerHTML = ['all', ...cats, 'wish'].map(c => `<button class="chip ${c === filter ? 'active' : ''}" data-f="${esc(c)}">${c === 'all' ? 'All' : c === 'wish' ? '♥ Wishlist' : esc(catLabel(c))}</button>`).join('');
  }
  function renderProducts() {
    let list = PRODUCTS.filter(p => filter === 'all' || (filter === 'wish' ? wish.includes(String(p.id)) : p.category === filter));
    if (query) list = list.filter(p => (p.name + ' ' + catLabel(p.category) + ' ' + p.tag + ' ' + p.description).toLowerCase().includes(query));
    const s = { low: (a, b) => a.price - b.price, high: (a, b) => b.price - a.price, disc: (a, b) => disc(b) - disc(a), new: (a, b) => String(b.created_at).localeCompare(String(a.created_at)) }[sortBy];
    if (s) list = [...list].sort(s);
    let empty;
    if (!PRODUCTS.length) empty = 'New designs are coming soon. Meanwhile, <a href="#studio" style="text-decoration:underline">design your own jersey</a>.';
    else if (filter === 'wish' && !query) empty = 'Your wishlist is empty. Tap ♥ on any jersey to save it.';
    else empty = `No jerseys match${query ? ` “${esc(query)}”` : ''}. Or <a href="#studio" style="text-decoration:underline">design your own</a>.`;
    $('#grid').innerHTML = list.length ? list.map(cardHTML).join('') : `<div class="empty">${empty}</div>`;
  }
  function updateBadges() { const w = wish.length, c = cart.reduce((a, i) => a + i.qty, 0); $('#wishCount').textContent = w; $('#wishCount').dataset.n = w; $('#cartCount').textContent = c; $('#cartCount').dataset.n = c; }
  function setFilter(f) { filter = f; renderChips(); renderProducts(); }
  $('#chips').addEventListener('click', e => { const b = e.target.closest('.chip'); if (b) setFilter(b.dataset.f); });
  $('#sortSel').onchange = e => { sortBy = e.target.value; renderProducts(); };
  function setQuery(v, from) { query = v.trim().toLowerCase(); if (from !== 'shop') $('#shopSearch').value = v; if (from !== 'head') $('#headerSearch').value = v; renderProducts(); }
  $('#shopSearch').addEventListener('input', e => setQuery(e.target.value, 'shop'));
  $('#headerSearch').addEventListener('input', e => setQuery(e.target.value, 'head'));
  $('#headerSearch').addEventListener('keydown', e => { if (e.key === 'Enter') $('#shop').scrollIntoView(); });
  $('#wishBtn').onclick = () => { setFilter('wish'); $('#shop').scrollIntoView(); };
  function toggleWish(id) { id = String(id); const i = wish.indexOf(id); if (i > -1) { wish.splice(i, 1); toast('Removed from wishlist'); } else { wish.push(id); toast('Saved to wishlist ♥'); } ls.set('ss_wish', wish); updateBadges(); renderProducts(); }
  $('#grid').addEventListener('click', e => { const el = e.target.closest('[data-act]'); if (!el) return; e.stopPropagation(); const id = el.dataset.id; if (el.dataset.act === 'wish') toggleWish(id); else openProduct(id); });

  async function loadProducts() {
    try { PRODUCTS = await DB.listProducts(false); }
    catch (e) { console.error(e); PRODUCTS = []; $('#grid').innerHTML = `<div class="empty">Couldn’t load products: ${esc(e.message)}</div>`; return; }
    wish = wish.filter(id => PRODUCTS.some(p => String(p.id) === id)); ls.set('ss_wish', wish);
    const min = PRODUCTS.length ? Math.min(...PRODUCTS.map(p => p.price)) : 0; if (min) $('#heroFrom').textContent = 'From ' + inr(min);
    renderChips(); renderProducts(); updateBadges();
    const m = location.hash.match(/^#p=(.+)$/); if (m) openProduct(decodeURIComponent(m[1]));
  }

  /* ---------- product modal ---------- */
  function openProduct(id) {
    const p = PRODUCTS.find(x => String(x.id) === String(id)); if (!p) return;
    const imgs = p.images.map(safeUrl).filter(Boolean);
    const st = { img: 0, size: p.sizes.includes('L') ? 'L' : p.sizes[0], qty: 1, name: '', number: '' };
    const d = disc(p);
    $('#pContent').innerHTML = `<div class="qv"><div class="qv-stage"><div class="gallery-main" id="gMain"></div>${imgs.length > 1 ? `<div class="thumbs" id="gThumbs">${imgs.map((u, i) => `<button data-i="${i}" class="${i ? '' : 'active'}"><img src="${esc(u)}" alt=""></button>`).join('')}</div>` : ''}</div>
      <div class="qv-info"><div>${p.tag ? `<span class="eyebrow">${esc(p.tag)}</span>` : ''}<h2 style="font-size:1.5rem">${esc(p.name)}</h2><small class="muted">${esc(catLabel(p.category))}</small></div>
      <div class="price"><b style="font-size:1.6rem">${inr(p.price)}</b>${d ? `<s>${inr(p.mrp)}</s><span style="color:var(--hot);font-weight:800">${d}% off</span>` : ''}</div>
      ${p.description ? `<p class="muted" style="font-size:.92rem;white-space:pre-line">${esc(p.description)}</p>` : ''}
      ${p.customizable ? `<div class="row2"><label><span class="lbl">Name on back</span><input class="field" id="pName" maxlength="12" placeholder="Optional"></label><label><span class="lbl">Number</span><input class="field" id="pNum" type="number" min="0" max="99" placeholder="Optional"></label></div>` : ''}
      <div><span class="lbl">Size <small>— <a href="#sizes" data-close style="text-decoration:underline">size guide</a></small></span><div class="sizes" id="pSizes">${p.sizes.map(s => `<button class="size ${s === st.size ? 'active' : ''}" data-s="${esc(s)}">${esc(s)}</button>`).join('')}</div></div>
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><div class="qty" id="pQty"><button data-q="-1">−</button><span>1</span><button data-q="1">+</button></div>
      <button class="btn btn-dark" id="pAdd" style="flex:1">Add to cart</button></div>
      <button class="btn btn-primary" id="pBook">Book now</button>
      <div style="display:flex;gap:10px;flex-wrap:wrap"><button class="btn btn-ghost btn-sm" id="pWish">${wish.includes(String(p.id)) ? '♥ Saved' : '♡ Wishlist'}</button><button class="btn btn-ghost btn-sm" id="pShare">🔗 Share</button></div></div></div>`;
    const drawMain = () => { const u = imgs[st.img]; $('#gMain').innerHTML = u ? `<img src="${esc(u)}" alt="${esc(p.name)}">` : placeholder(); };
    drawMain();
    if ($('#gThumbs')) $('#gThumbs').onclick = e => { const b = e.target.closest('button'); if (!b) return; st.img = +b.dataset.i; $$('#gThumbs button').forEach(x => x.classList.toggle('active', x === b)); drawMain(); };
    if ($('#pName')) { $('#pName').oninput = e => st.name = e.target.value; $('#pNum').oninput = e => st.number = e.target.value.slice(0, 2); }
    $('#pSizes').onclick = e => { const b = e.target.closest('.size'); if (!b) return; st.size = b.dataset.s; $$('#pSizes .size').forEach(x => x.classList.toggle('active', x === b)); };
    $('#pQty').onclick = e => { const b = e.target.closest('button'); if (!b) return; st.qty = Math.max(1, Math.min(99, st.qty + +b.dataset.q)); $('#pQty span').textContent = st.qty; };
    const item = () => ({ pid: p.id, title: p.name, image: imgs[0] || null, size: st.size, qty: st.qty, price: p.price, name: st.name.trim().toUpperCase(), number: st.number });
    $('#pAdd').onclick = () => { closeAll(); addToCart(item()); };
    $('#pBook').onclick = () => { addToCart(item(), true); startCheckout(); };
    $('#pWish').onclick = e => { toggleWish(p.id); e.target.textContent = wish.includes(String(p.id)) ? '♥ Saved' : '♡ Wishlist'; };
    $('#pShare').onclick = () => copy(location.href.split('#')[0] + '#p=' + encodeURIComponent(p.id), '🔗 Product link copied');
    openLayer($('#pModal'));
  }

  /* ---------- design studio ---------- */
  const S = { pattern: 'sash', c: ['#0a1f44', '#c6ff1a', '#ffffff'], collar: 'polo', team: 'SIXERS XI', name: 'ARJUN', number: '23', side: 'back', size: 'L', qty: 1, premium: false, premiumExtra: 50 };
  try { const m = location.hash.match(/design=([^&]+)/); if (m) { const d = JSON.parse(decodeURIComponent(atob(m[1]))); ['pattern', 'c', 'collar', 'team', 'name', 'number'].forEach(k => { if (d[k] != null) S[k] = d[k]; }); } } catch (e) { }
  $('#patGrid').innerHTML = J.PATTERNS.map(p => `<button class="pat" data-p="${p}"><div class="pthumb"></div>${p}</button>`).join('');
  $('#palettes').innerHTML = J.PALETTES.map((p, i) => `<button class="pal" data-i="${i}" aria-label="Palette ${i + 1}">${p.map(c => `<i style="background:${c}"></i>`).join('')}</button>`).join('');
  $('#sSizes').innerHTML = J.ALL_SIZES.map(s => `<button class="size" data-s="${s}">${s}</button>`).join('');
  const unitStudio = () => (Number(SETTINGS.custom_price) || 485) + (S.premium ? S.premiumExtra : 0);
  const design = () => ({ pattern: S.pattern, c: [...S.c], collar: S.collar });
  function renderStudio(full) {
    $('#stage').innerHTML = J.svg(S);
    $$('#sideSeg button').forEach(b => b.classList.toggle('active', b.dataset.side === S.side));
    $$('#collarSeg button').forEach(b => b.classList.toggle('active', b.dataset.collar === S.collar));
    $$('#sSizes .size').forEach(b => b.classList.toggle('active', b.dataset.s === S.size));
    $('#sQty').textContent = S.qty; $('#sTotal').textContent = inr(unitStudio() * S.qty);
    if (full !== false) {
      $$('#patGrid .pat').forEach(b => { b.classList.toggle('active', b.dataset.p === S.pattern); b.querySelector('.pthumb').innerHTML = J.svg({ ...S, pattern: b.dataset.p, side: 'front', team: '', number: '' }); });
      $('#c1').value = S.c[0]; $('#c2').value = S.c[1]; $('#c3').value = S.c[2];
      $('#sTeam').value = S.team; $('#sName').value = S.name; $('#sNum').value = S.number; $('#sPremium').checked = S.premium;
    }
    if ($('#teamJersey')) { $('#teamJersey').innerHTML = J.svg({ ...S, side: 'front' }); $('#teamTitle').textContent = (S.team || 'Team') + ' summary'; }
  }
  $('#patGrid').onclick = e => { const b = e.target.closest('.pat'); if (!b) return; S.pattern = b.dataset.p; renderStudio(); };
  $('#palettes').onclick = e => { const b = e.target.closest('.pal'); if (!b) return; S.c = [...J.PALETTES[+b.dataset.i]]; renderStudio(); };
  ['c1', 'c2', 'c3'].forEach((k, i) => { $('#' + k).addEventListener('input', e => { S.c = [...S.c]; S.c[i] = e.target.value; renderStudio(false); }); $('#' + k).addEventListener('change', () => renderStudio()); });
  $('#sideSeg').onclick = e => { const b = e.target.closest('button'); if (b) { S.side = b.dataset.side; renderStudio(false); } };
  $('#collarSeg').onclick = e => { const b = e.target.closest('button'); if (b) { S.collar = b.dataset.collar; renderStudio(); } };
  $('#sTeam').oninput = e => { S.team = e.target.value; S.side = 'front'; renderStudio(false); };
  $('#sName').oninput = e => { S.name = e.target.value; S.side = 'back'; renderStudio(false); };
  $('#sNum').oninput = e => { S.number = e.target.value.slice(0, 2); renderStudio(false); };
  $('#sSizes').onclick = e => { const b = e.target.closest('.size'); if (b) { S.size = b.dataset.s; renderStudio(false); } };
  $('#sQtyBox').onclick = e => { const b = e.target.closest('button'); if (b) { S.qty = Math.max(1, Math.min(99, S.qty + +b.dataset.q)); renderStudio(false); } };
  $('#sPremium').onchange = e => { S.premium = e.target.checked; renderStudio(false); };
  $('#randBtn').onclick = () => {
    S.pattern = J.PATTERNS[Math.floor(Math.random() * J.PATTERNS.length)]; const h = Math.floor(Math.random() * 360);
    const hsl = (h, s, l) => { s /= 100; l /= 100; const k = n => (n + h / 30) % 12, a = s * Math.min(l, 1 - l), f = n => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1)); return '#' + [f(0), f(8), f(4)].map(x => Math.round(x * 255).toString(16).padStart(2, '0')).join(''); };
    S.c = [hsl(h, 70, 22 + Math.random() * 20), hsl((h + 150 + Math.random() * 60) % 360, 85, 55), Math.random() > .3 ? '#ffffff' : '#111111']; S.collar = Math.random() > .5 ? 'polo' : 'round'; renderStudio(); toast('🎲 Fresh design generated');
  };
  $('#pngBtn').onclick = () => {
    const svg = J.svg(S); const big = svg.replace('<svg ', '<svg width="900" height="960" '); const img = new Image();
    const fallback = () => download(new Blob([svg], { type: 'image/svg+xml' }), 'my-jersey.svg');
    img.onload = () => { try { const c = document.createElement('canvas'); c.width = 900; c.height = 960; c.getContext('2d').drawImage(img, 0, 0, 900, 960); c.toBlob(b => { if (b) { download(b, 'my-jersey.png'); toast('Design downloaded'); } else fallback(); }); } catch (e) { fallback(); } };
    img.onerror = fallback; img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(big);
  };
  $('#shareBtn').onclick = () => { const d = btoa(encodeURIComponent(JSON.stringify({ pattern: S.pattern, c: S.c, collar: S.collar, team: S.team, name: S.name, number: S.number }))); copy(location.href.split('#')[0] + '#design=' + d, '🔗 Share link copied — anyone who opens it sees your design'); };
  $('#sAdd').onclick = () => addToCart({ pid: null, title: 'Custom Studio Jersey' + (S.premium ? ' (Premium)' : ''), image: null, design: design(), size: S.size, qty: S.qty, price: unitStudio(), name: S.name.trim().toUpperCase(), number: S.number, team: S.team.trim().toUpperCase() });

  /* ---------- team builder ---------- */
  let roster = ls.get('ss_roster', [{ name: 'Arjun', number: '23', size: 'L' }, { name: 'Meera', number: '7', size: 'M' }, { name: 'Kabir', number: '45', size: 'XL' }]);
  const tierPrice = n => n <= 10 ? Number(SETTINGS.custom_price) || 485 : n <= 20 ? Number(SETTINGS.team_price_11) || 449 : Number(SETTINGS.team_price_21) || 399;
  function renderRoster() {
    $('#rosterBody').innerHTML = roster.map((r, i) => `<tr data-i="${i}"><td class="muted">${i + 1}</td><td><input data-k="name" value="${esc(r.name)}" maxlength="12" placeholder="Player name"></td><td><input class="num" data-k="number" type="number" min="0" max="99" value="${esc(r.number)}"></td><td><select data-k="size">${J.ALL_SIZES.map(s => `<option ${s === r.size ? 'selected' : ''}>${s}</option>`).join('')}</select></td><td><button class="del" data-del="${i}" aria-label="Remove">×</button></td></tr>`).join('');
    teamSummary();
  }
  function teamSummary() {
    if (!$('#rosterBody')) return;
    ls.set('ss_roster', roster);
    const n = roster.length, unit = tierPrice(n);
    const counts = {}; roster.forEach(r => { if (r.number !== '') counts[r.number] = (counts[r.number] || 0) + 1; });
    const dups = Object.keys(counts).filter(k => counts[k] > 1);
    $$('#rosterBody tr').forEach(tr => { const r = roster[+tr.dataset.i]; tr.classList.toggle('dup', !!r && dups.includes(String(r.number))); });
    $('#dupWarn').textContent = dups.length ? `⚠ Duplicate number${dups.length > 1 ? 's' : ''}: ${dups.join(', ')}` : '';
    $('#tiers').innerHTML = [[1, 10, tierPrice(1)], [11, 20, tierPrice(11)], [21, '+', tierPrice(21)]].map(t => `<div class="tier ${n > 0 && n >= t[0] && (t[1] === '+' || n <= t[1]) ? 'active' : ''}"><span>${t[0]}${t[1] === '+' ? '+' : '–' + t[1]} jerseys</span><span>${inr(t[2])} each</span></div>`).join('');
    const sc = {}; roster.forEach(r => sc[r.size] = (sc[r.size] || 0) + 1);
    $('#sizePills').innerHTML = J.ALL_SIZES.filter(s => sc[s]).map(s => `<span>${s} × ${sc[s]}</span>`).join('');
    $('#tPlayers').textContent = n; $('#tUnit').textContent = inr(unit); $('#tTotal').textContent = inr(unit * n);
    $('#tEta').textContent = n > 11 ? 'about 20 days' : '7–12 days';
    const next = n < 11 ? 11 - n : n < 21 ? 21 - n : 0;
    $('#teamAdd').textContent = n ? `Add ${n} jerseys to cart` + (next && n ? ` · ${next} more for a lower price` : '') : 'Add players first';
  }
  $('#rosterBody').addEventListener('input', e => { const tr = e.target.closest('tr'); if (!tr || !e.target.dataset.k) return; let v = e.target.value; if (e.target.dataset.k === 'number') v = v.slice(0, 2); roster[+tr.dataset.i][e.target.dataset.k] = v; teamSummary(); });
  $('#rosterBody').addEventListener('change', e => { const tr = e.target.closest('tr'); if (tr && e.target.dataset.k) { roster[+tr.dataset.i][e.target.dataset.k] = e.target.value; teamSummary(); } });
  $('#rosterBody').addEventListener('click', e => { const b = e.target.closest('[data-del]'); if (b) { roster.splice(+b.dataset.del, 1); renderRoster(); } });
  $('#addRow').onclick = () => { roster.push({ name: '', number: '', size: 'L' }); renderRoster(); const ins = $$('#rosterBody input[data-k="name"]'); ins[ins.length - 1].focus(); };
  $('#clearRoster').onclick = () => { if (roster.length && confirm('Clear the whole squad list?')) { roster = []; renderRoster(); } };
  $('#pasteBtn').onclick = () => {
    const lines = $('#pasteArea').value.split(/\n+/).map(l => l.trim()).filter(Boolean); let added = 0;
    lines.forEach(l => { const parts = l.split(/[,\t;|]+/).map(x => x.trim()); if (!parts[0]) return; let size = (parts[2] || 'L').toUpperCase().replace(/\s/g, ''); if (/^\d+-\d+$/.test(size)) size += 'Y'; if (!J.ALL_SIZES.includes(size)) size = 'L'; roster.push({ name: parts[0].slice(0, 12), number: (parts[1] || '').replace(/\D/g, '').slice(0, 2), size }); added++; });
    $('#pasteArea').value = ''; renderRoster(); toast(added ? `Imported ${added} player${added > 1 ? 's' : ''}` : 'Nothing to import — use Name, Number, Size');
  };
  $('#csvBtn').onclick = () => { if (!roster.length) return toast('Add players first'); const rows = [['#', 'Name', 'Number', 'Size']].concat(roster.map((r, i) => [i + 1, r.name, r.number, r.size])); const csv = rows.map(r => r.map(x => `"${String(x).replace(/"/g, '""')}"`).join(',')).join('\n'); download(new Blob([csv], { type: 'text/csv' }), (S.team || 'team').replace(/\s+/g, '-').toLowerCase() + '-squad.csv'); toast('Squad list exported'); };
  $('#teamAdd').onclick = () => {
    if (!roster.length) return toast('Add players first'); const unit = tierPrice(roster.length);
    roster.forEach(r => addToCart({ pid: null, title: `${S.team || 'Team'} — Team Jersey`, image: null, design: design(), size: r.size, qty: 1, price: unit, name: (r.name || '').toUpperCase(), number: r.number, team: (S.team || '').toUpperCase() }, true));
    toast(`🏏 ${roster.length} jerseys added to cart`); openCart();
  };

  /* ---------- size finder ---------- */
  const CHART = [['S', 38, 27, 16.5], ['M', 40, 28, 17], ['L', 42, 29, 17.5], ['XL', 44, 30, 18], ['2XL', 46, 31, 18.5], ['3XL', 48, 32, 19], ['4XL', 50, 32.5, 19.5], ['5XL', 52, 33, 20], ['6XL', 54, 33.5, 20.5]];
  let fit = 'regular', rec = 'L';
  function recommend() {
    const h = +$('#hIn').value || 0, w = +$('#wIn').value || 0;
    if (h && h < 150 && w < 45) { rec = h < 100 ? '2-3Y' : h < 112 ? '4-5Y' : h < 124 ? '6-7Y' : h < 136 ? '8-9Y' : h < 146 ? '10-11Y' : '12-13Y'; }
    else { let i = w < 55 ? 0 : w < 63 ? 1 : w < 72 ? 2 : w < 82 ? 3 : w < 92 ? 4 : w < 102 ? 5 : w < 112 ? 6 : w < 122 ? 7 : 8; if (h > 185 && i < 8) i++; if (fit === 'loose' && i < 8) i++; if (fit === 'slim' && i > 0) i--; rec = J.ADULT[i]; }
    $('#recOut').textContent = rec;
    $('#chart tbody').innerHTML = CHART.map(r => `<tr class="${r[0] === rec ? 'hl' : ''}"><td>${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td><td>${r[3]}</td></tr>`).join('');
  }
  ['hIn', 'wIn'].forEach(k => $('#' + k).addEventListener('input', recommend));
  $('#fitSeg').onclick = e => { const b = e.target.closest('button'); if (!b) return; fit = b.dataset.fit; $$('#fitSeg button').forEach(x => x.classList.toggle('active', x === b)); recommend(); };
  $('#useSize').onclick = () => { S.size = rec; renderStudio(false); toast(`Size ${rec} selected in the Design Studio`); $('#studio').scrollIntoView(); };
  recommend();

  /* ---------- cart ---------- */
  const keyOf = i => JSON.stringify([i.pid, i.title, i.size, i.price, i.design || null, i.name || '', i.number || '', i.team || '']);
  const thumbHTML = i => i.image && safeUrl(i.image) ? `<img src="${esc(safeUrl(i.image))}" alt="">` : J.svg({ ...(i.design || {}), side: i.name || i.number ? 'back' : 'front', name: i.name, number: i.number, team: i.team });
  const persText = i => [i.name ? esc(i.name) : '', i.number !== '' && i.number != null ? '#' + esc(i.number) : ''].filter(Boolean).join(' ');
  function saveCart() { ls.set('ss_cart', cart); updateBadges(); }
  function addToCart(item, silent) { const k = keyOf(item); const ex = cart.find(x => x.key === k); if (ex) ex.qty += item.qty; else cart.push({ ...item, key: k }); saveCart(); if (!silent) { renderCart(); toast('Added to cart ✓'); openCart(); } }
  const cartTotal = () => cart.reduce((a, i) => a + i.price * i.qty, 0);
  function renderCart() {
    updateBadges();
    if (!cart.length) { $('#cartBody').innerHTML = `<div class="empty" style="padding:60px 10px"><div style="font-size:3rem">🏏</div><p style="margin:10px 0 16px">Your cart is empty.</p><a class="btn btn-dark" data-close href="#shop">Start shopping</a></div>`; $('#cartFoot').innerHTML = ''; return; }
    $('#cartBody').innerHTML = cart.map((i, idx) => `<div class="ci"><div class="thumb">${thumbHTML(i)}</div>
      <div><h4>${esc(i.title)}</h4><small>Size ${esc(i.size)}${persText(i) ? ' · ' + persText(i) : ''}</small><button class="rm" data-rm="${idx}">Remove</button></div>
      <div class="right"><b>${inr(i.price * i.qty)}</b><div class="qty"><button data-cq="${idx}" data-d="-1">−</button><span>${i.qty}</span><button data-cq="${idx}" data-d="1">+</button></div></div></div>`).join('');
    const qty = cart.reduce((a, i) => a + i.qty, 0);
    $('#cartFoot').innerHTML = `<div class="line"><span>Subtotal (${qty} item${qty > 1 ? 's' : ''})</span><span>${inr(cartTotal())}</span></div>
      <div class="hint">💬 ${esc(SETTINGS.delivery_note)}</div>
      <button class="btn btn-primary btn-block" id="checkoutBtn">Book order →</button>`;
    $('#checkoutBtn').onclick = startCheckout;
  }
  $('#cartBody').addEventListener('click', e => {
    const rm = e.target.closest('[data-rm]'), cq = e.target.closest('[data-cq]');
    if (rm) cart.splice(+rm.dataset.rm, 1); else if (cq) { const it = cart[+cq.dataset.cq]; it.qty += +cq.dataset.d; if (it.qty < 1) cart.splice(+cq.dataset.cq, 1); } else return;
    saveCart(); renderCart();
  });
  function openCart() { renderCart(); openLayer($('#drawer')); }
  $('#cartBtn').onclick = openCart;

  /* ---------- auth ---------- */
  function updateAcct() { const u = DB.user(); $('#acctLabel').textContent = u ? (u.name ? u.name.split(' ')[0] : 'Account') : 'Login'; }
  DB.onChange(() => updateAcct());
  $('#acctBtn').onclick = openAccount;
  function openAccount() { if (DB.user()) showProfile(); else openAuth('login'); }
  function openAuth(view, msg) {
    const box = $('#authContent');
    const head = msg ? `<div class="hint" style="margin-bottom:14px">${esc(msg)}</div>` : '';
    if (view === 'login') box.innerHTML = `<form class="modal-pad" id="authForm"><h2 style="margin-bottom:4px">Log in</h2><p class="muted" style="font-size:.88rem;margin-bottom:14px">Welcome back! Log in to book and track your orders.</p>${head}
      <div class="form-grid"><input class="field" name="email" type="email" required placeholder="Email" autocomplete="email"><input class="field" name="password" type="password" required placeholder="Password" autocomplete="current-password">
      <div class="form-msg" id="authMsg"></div><button class="btn btn-dark btn-block">Log in</button>
      <div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap"><button type="button" class="link-btn" data-view="signup">New here? Create an account</button><button type="button" class="link-btn" data-view="forgot">Forgot password?</button></div></div></form>`;
    else if (view === 'signup') box.innerHTML = `<form class="modal-pad" id="authForm"><h2 style="margin-bottom:4px">Create account</h2><p class="muted" style="font-size:.88rem;margin-bottom:14px">It takes 20 seconds. Your details are saved for faster booking.</p>${head}
      <div class="form-grid"><input class="field" name="name" required placeholder="Full name" autocomplete="name"><input class="field" name="phone" required placeholder="WhatsApp number (10 digits)" inputmode="tel" autocomplete="tel"><input class="field" name="email" type="email" required placeholder="Email" autocomplete="email"><input class="field" name="password" type="password" required minlength="6" placeholder="Password (min 6 characters)" autocomplete="new-password">
      <div class="form-msg" id="authMsg"></div><button class="btn btn-dark btn-block">Create account</button><button type="button" class="link-btn" data-view="login">Already have an account? Log in</button></div></form>`;
    else if (view === 'forgot') box.innerHTML = `<form class="modal-pad" id="authForm"><h2 style="margin-bottom:4px">Reset password</h2><p class="muted" style="font-size:.88rem;margin-bottom:14px">We'll email you a link to set a new password.</p>
      <div class="form-grid"><input class="field" name="email" type="email" required placeholder="Email"><div class="form-msg" id="authMsg"></div><button class="btn btn-dark btn-block">Send reset link</button><button type="button" class="link-btn" data-view="login">Back to log in</button></div></form>`;
    else if (view === 'newpass') box.innerHTML = `<form class="modal-pad" id="authForm"><h2 style="margin-bottom:14px">Set a new password</h2>
      <div class="form-grid"><input class="field" name="password" type="password" required minlength="6" placeholder="New password (min 6 characters)" autocomplete="new-password"><div class="form-msg" id="authMsg"></div><button class="btn btn-dark btn-block">Save password</button></div></form>`;
    box.querySelectorAll('[data-view]').forEach(b => b.onclick = () => openAuth(b.dataset.view, msg));
    const form = $('#authForm'), m = $('#authMsg');
    const say = (t, ok) => { m.textContent = t; m.className = 'form-msg ' + (ok ? 'ok' : 'err'); };
    form.onsubmit = async e => {
      e.preventDefault(); const f = Object.fromEntries(new FormData(form)); const btn = form.querySelector('.btn-dark'); busy(btn, true);
      try {
        if (view === 'login') { await DB.signIn({ email: f.email.trim(), password: f.password }); afterLogin(); }
        else if (view === 'signup') {
          if (!validPhone(f.phone)) throw new Error('Please enter a valid 10-digit mobile number.');
          const r = await DB.signUp({ email: f.email.trim(), password: f.password, name: f.name.trim(), phone: cleanPhone(f.phone) });
          if (r.needsConfirm) { busy(btn, false); say('✅ Account created! Check your email and tap the confirmation link, then log in here.', true); return; }
          afterLogin();
        }
        else if (view === 'forgot') { await DB.resetPassword(f.email.trim()); busy(btn, false); say('✅ Reset link sent — check your email.', true); return; }
        else if (view === 'newpass') { await DB.updatePassword(f.password); busy(btn, false); say('✅ Password updated. You are logged in.', true); setTimeout(closeAll, 1200); return; }
      } catch (err) { busy(btn, false); say(err.message); }
    };
    openLayer($('#authModal'));
    setTimeout(() => { const i = form.querySelector('input'); if (i && matchMedia('(min-width: 700px)').matches) i.focus(); }, 60);
  }
  window.addEventListener('sx-recovery', () => openAuth('newpass'));
  function afterLogin() {
    updateAcct(); const u = DB.user(); toast(`👋 Welcome${u && u.name ? ', ' + u.name.split(' ')[0] : ''}!`);
    const p = pending; pending = null;
    if (p === 'checkout') openCheckout(); else if (p === 'orders') openOrders(); else closeAll();
  }
  function showProfile() {
    const u = DB.user();
    $('#authContent').innerHTML = `<form class="modal-pad" id="profForm"><h2 style="margin-bottom:2px">My account</h2><p class="muted" style="font-size:.86rem;margin-bottom:14px">${esc(u.email)}</p>
      <div class="form-grid"><input class="field" name="name" value="${esc(u.name)}" placeholder="Full name"><input class="field" name="phone" value="${esc(u.phone)}" placeholder="WhatsApp number" inputmode="tel">
      <input class="field" name="address" value="${esc(u.address)}" placeholder="Address"><div class="row2"><input class="field" name="city" value="${esc(u.city)}" placeholder="City"><input class="field" name="pincode" value="${esc(u.pincode)}" placeholder="PIN code" inputmode="numeric"></div>
      <div class="form-msg" id="profMsg"></div><button class="btn btn-dark btn-block">Save details</button>
      <button type="button" class="btn btn-ghost btn-block" id="profOrders">📦 My orders</button><button type="button" class="link-btn" id="signOut">Log out</button></div></form>`;
    $('#profForm').onsubmit = async e => { e.preventDefault(); const f = Object.fromEntries(new FormData(e.target)); const btn = e.target.querySelector('.btn-dark'); busy(btn, true); try { await DB.updateProfile({ name: f.name.trim(), phone: cleanPhone(f.phone), address: f.address.trim(), city: f.city.trim(), pincode: f.pincode.trim() }); busy(btn, false); $('#profMsg').textContent = '✅ Saved'; $('#profMsg').className = 'form-msg ok'; } catch (err) { busy(btn, false); $('#profMsg').textContent = err.message; $('#profMsg').className = 'form-msg err'; } };
    $('#profOrders').onclick = openOrders;
    $('#signOut').onclick = async () => { await DB.signOut(); updateAcct(); closeAll(); toast('Logged out'); };
    openLayer($('#authModal'));
  }
  const cleanPhone = p => { let d = String(p || '').replace(/\D/g, ''); if (d.length === 12 && d.startsWith('91')) d = d.slice(2); if (d.length === 11 && d[0] === '0') d = d.slice(1); return d; };
  const validPhone = p => /^[6-9]\d{9}$/.test(cleanPhone(p));

  /* ---------- checkout / booking ---------- */
  function startCheckout() {
    if (!cart.length) return toast('Your cart is empty');
    if (!DB.user()) { pending = 'checkout'; openAuth('login', 'Please log in or create an account to book your order.'); return; }
    openCheckout();
  }
  function openCheckout() {
    const u = DB.user() || {}; const total = cartTotal(); const qty = cart.reduce((a, i) => a + i.qty, 0);
    $('#coContent').innerHTML = `<form class="modal-pad" id="coForm"><h2 style="margin-bottom:4px">Book your order</h2><p class="muted" style="font-size:.86rem;margin-bottom:14px">${qty} item${qty > 1 ? 's' : ''} · <b>${inr(total)}</b> · no payment now</p>
      <div class="form-grid"><input class="field" name="name" required placeholder="Full name" value="${esc(u.name || '')}"><input class="field" name="phone" required placeholder="WhatsApp number (10 digits)" inputmode="tel" value="${esc(u.phone || '')}">
      <textarea class="field" name="address" required placeholder="House / street / area" rows="2">${esc(u.address || '')}</textarea><div class="row2"><input class="field" name="city" required placeholder="City" value="${esc(u.city || '')}"><input class="field" name="pincode" required placeholder="PIN code" inputmode="numeric" value="${esc(u.pincode || '')}"></div>
      <textarea class="field" name="note" placeholder="Anything else? (team logo, needed-by date…)" rows="2"></textarea>
      <label class="check"><input type="checkbox" name="save" checked> Save these details for next time</label>
      <div class="hint">💬 ${esc(SETTINGS.delivery_note)}</div>
      <div class="form-msg err" id="coErr"></div><button class="btn btn-primary btn-block">Book order</button></div></form>`;
    $('#coForm').onsubmit = submitOrder;
    openLayer($('#coModal'));
  }
  async function submitOrder(e) {
    e.preventDefault(); const f = Object.fromEntries(new FormData(e.target)); const err = t => $('#coErr').textContent = t;
    if (!validPhone(f.phone)) return err('Please enter a valid 10-digit mobile number.');
    if (!/^\d{6}$/.test(String(f.pincode).trim())) return err('Please enter a valid 6-digit PIN code.');
    if (!cart.length) return err('Your cart is empty.');
    const btn = e.target.querySelector('.btn-primary'); busy(btn, true, 'Booking…');
    const items = cart.map(i => ({ pid: i.pid, title: i.title, image: i.image || null, design: i.design || null, size: i.size, qty: i.qty, price: i.price, name: i.name || '', number: i.number || '', team: i.team || '' }));
    const o = { customer_name: f.name.trim(), phone: cleanPhone(f.phone), address: f.address.trim(), city: f.city.trim(), pincode: f.pincode.trim(), note: (f.note || '').trim(), items, total: cartTotal() };
    try {
      if (f.save) DB.updateProfile({ name: o.customer_name, phone: o.phone, address: o.address, city: o.city, pincode: o.pincode }).catch(() => { });
      const saved = await DB.createOrder(o);
      cart = []; saveCart(); renderCart();
      showBooked({ ...o, ...saved });
    } catch (x) { busy(btn, false); err('Could not book: ' + x.message); }
  }
  function orderMessage(o) {
    const lines = [`🏏 *New order #${o.id}* — ${SETTINGS.store_name}`, '', `*Name:* ${o.customer_name}`, `*Phone:* ${o.phone}`, `*Address:* ${o.address}, ${o.city} - ${o.pincode}`, '', '*Items:*'];
    (o.items || []).forEach((it, i) => {
      const pers = [it.name, it.number !== '' && it.number != null ? '#' + it.number : ''].filter(Boolean).join(' ');
      let l = `${i + 1}. ${it.title} — Size ${it.size} × ${it.qty}${pers ? ` — ${pers}` : ''} = ${inr(it.price * it.qty)}`;
      if (it.design && !it.pid) l += `\n    (custom: ${it.design.pattern} pattern, ${it.design.collar} collar, colours ${it.design.c.join(' / ')}${it.team ? ', team "' + it.team + '"' : ''})`;
      lines.push(l);
    });
    lines.push('', `*Total:* ${inr(o.total)} (to pay on confirmation)`);
    if (o.note) lines.push(`*Note:* ${o.note}`);
    lines.push('', 'Please confirm my delivery date. Thank you!');
    return lines.join('\n');
  }
  function waButton(o, label) {
    const wa = J.waNumber(SETTINGS.whatsapp);
    if (!wa) return `<div class="hint">The store hasn't added its WhatsApp number yet. Your order is saved — we'll contact you on ${esc(o.phone)}.</div>`;
    return `<a class="btn btn-wa btn-block" href="${esc(J.waLink(wa, orderMessage(o)))}" target="_blank" rel="noopener">${WA_SVG} ${label || 'Send order on WhatsApp'}</a>`;
  }
  function showBooked(o) {
    $('#coContent').innerHTML = `<div class="success"><div class="big">🎉</div><h2>Order booked!</h2><p class="muted">Your order number is</p><div class="order-id">#${esc(o.id)}</div>
      <p style="margin:6px 0 18px"><b>One last step:</b> send your order to us on WhatsApp so we can confirm your delivery date.</p>
      ${waButton(o)}<button class="btn btn-ghost btn-block" id="goOrders" style="margin-top:10px">View my orders</button></div>`;
    $('#goOrders').onclick = openOrders;
    openLayer($('#coModal'));
  }

  /* ---------- my orders ---------- */
  async function openOrders() {
    if (!DB.user()) { pending = 'orders'; openAuth('login', 'Log in to see your orders.'); return; }
    const box = $('#ordersContent');
    box.innerHTML = '<h2 style="margin-bottom:14px">My orders</h2><p class="muted">Loading…</p>';
    openLayer($('#ordersModal'));
    let list;
    try { list = await DB.myOrders(); } catch (e) { box.innerHTML = `<h2>My orders</h2><p class="warn">${esc(e.message)}</p>`; return; }
    const statusOf = s => J.STATUSES.find(x => x[0] === s) || J.STATUSES[0];
    box.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:14px;flex-wrap:wrap"><h2>My orders</h2><button class="btn btn-ghost btn-sm" id="refOrders">↻ Refresh</button></div>` + (list.length ? list.map(o => {
      const st = statusOf(o.status);
      const del = o.status === 'cancelled' ? '' : o.status === 'delivered' ? `<div class="delivery">✅ Delivered${o.delivery_date ? ' on ' + esc(J.fmtDate(o.delivery_date)) : ''}</div>` : o.delivery_date ? `<div class="delivery">📦 <b>Expected delivery:</b> ${esc(J.fmtDate(o.delivery_date))}</div>` : `<div class="delivery pending">⏳ We'll message you on WhatsApp with your delivery date.</div>`;
      return `<div class="order-card"><div class="order-head"><div><b>Order #${esc(o.id)}</b> <small class="muted">· ${esc(J.fmtDate(o.created_at))}</small></div><span class="pill ${esc(o.status)}">${esc(st[1])}</span></div>
        <small class="muted">${esc(st[2])}</small>
        <div class="order-items">${(o.items || []).map(i => `<div class="oi"><div class="thumb">${thumbHTML(i)}</div><div>${esc(i.title)}<small>Size ${esc(i.size)} × ${esc(i.qty)}${persText(i) ? ' · ' + persText(i) : ''}</small></div><b>${inr(i.price * i.qty)}</b></div>`).join('')}</div>
        <div class="line total"><span>Total</span><span>${inr(o.total)}</span></div>${del}
        ${o.admin_note ? `<div class="hint" style="margin-top:8px">💬 <b>From ${esc(SETTINGS.store_name)}:</b> ${esc(o.admin_note)}</div>` : ''}
        ${o.status === 'new' ? `<div style="margin-top:10px">${waButton(o, 'Send this order on WhatsApp')}</div>` : ''}</div>`;
    }).join('') : `<div class="empty">No orders yet. <a href="#shop" data-close style="text-decoration:underline">Start shopping</a></div>`);
    $('#refOrders').onclick = openOrders;
  }

  /* ---------- help chat ---------- */
  const QA = {
    'How do I order?': 'Add jerseys to your cart, tap “Book order”, log in and enter your address. Your order then opens in WhatsApp — just tap send.',
    'Do I pay online?': 'No online payment. After you book, we message you on WhatsApp with the delivery date and payment details.',
    'Delivery time?': 'Usually 7–12 days. Team orders of 11+ jerseys take about 20 days. We confirm the exact date on WhatsApp.',
    'Team discount?': () => `Prices drop automatically for teams: ${inr(tierPrice(1))} (1–10), ${inr(tierPrice(11))} (11–20), ${inr(tierPrice(21))} (21+) per custom jersey.`,
    'Sizes?': 'Kids 2–3 yrs up to adult 6XL. Use the Size Finder on this page for a recommendation.'
  };
  function addMsg(t, who) { const m = document.createElement('div'); m.className = 'msg ' + who; m.textContent = t; $('#chatLog').appendChild(m); $('#chatLog').scrollTop = 1e6; }
  let chatInit = false;
  function toggleChat(force) {
    const c = $('#chat'); const open = force != null ? force : !c.classList.contains('open'); c.classList.toggle('open', open);
    if (open && !chatInit) { chatInit = true; addMsg('Hi! 👋 Tap a question below, or chat with us on WhatsApp.', 'bot'); $('#quick').innerHTML = Object.keys(QA).map(q => `<button>${q}</button>`).join('') + '<button data-wa style="border-color:#25d366;color:#128c4b">💬 WhatsApp us</button>'; }
  }
  $('#fab').onclick = () => toggleChat(); $('#chatClose').onclick = () => toggleChat(false);
  $('#footChat').onclick = e => { e.preventDefault(); toggleChat(true); };
  $('#quick').onclick = e => { const b = e.target.closest('button'); if (!b) return; if (b.hasAttribute('data-wa')) { $('#ctaWa').click(); return; } addMsg(b.textContent, 'me'); const a = QA[b.textContent]; setTimeout(() => addMsg(typeof a === 'function' ? a() : a, 'bot'), 400); };

  /* ---------- init ---------- */
  renderStudio(); renderRoster(); updateBadges(); renderCart();
  await DB.ready;
  updateAcct();
  try { SETTINGS = await DB.getSettings(); } catch (e) { console.warn(e); }
  applySettings();
  await loadProducts();
  if (/design=/.test(location.hash)) setTimeout(() => { $('#studio').scrollIntoView(); toast('Shared design loaded 🎨'); }, 300);
})();
