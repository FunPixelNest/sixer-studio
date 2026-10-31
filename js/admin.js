/* Admin panel: orders, products (with photo upload) and store settings */
(async function () {
  'use strict';
  const J = window.Jersey, DB = window.DB;
  const { esc, inr, safeUrl } = J;
  const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
  const app = $('#app');
  let SETTINGS = { ...DB.DEFAULT_SETTINGS }, ORDERS = [], PRODUCTS = [];
  let starting = false;
  let tab = 'orders', oFilter = 'all', oQuery = '', pQuery = '';
  const WA_SVG = '<svg class="wa-ic" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm4.5 12.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.4.1-.7.3-.2.3-.9.9-.9 2.2s.9 2.5 1 2.7c.1.2 1.8 2.8 4.4 3.9 1.6.7 2.3.8 3.1.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.5-.3z"/></svg>';

  let tt; function toast(m) { const t = $('#toast'); t.textContent = m; t.classList.add('show'); clearTimeout(tt); tt = setTimeout(() => t.classList.remove('show'), 2600); }
  try { const t = localStorage.getItem('ss_theme'); if (t) document.documentElement.setAttribute('data-theme', JSON.parse(t)); } catch (e) { }
  const busy = (btn, on, label) => { if (!btn) return; if (on) { btn.dataset.label = btn.innerHTML; btn.disabled = true; btn.style.opacity = .7; btn.innerHTML = label || 'Saving…'; } else { btn.disabled = false; btn.style.opacity = ''; btn.innerHTML = btn.dataset.label || btn.innerHTML; } };
  function openModal(el) { $('#overlay').classList.add('show'); el.classList.add('open'); document.body.style.overflow = 'hidden'; }
  function closeModal() { $('#overlay').classList.remove('show'); $$('.modal.open').forEach(m => m.classList.remove('open')); document.body.style.overflow = ''; }
  $('#overlay').onclick = closeModal;
  document.addEventListener('click', e => { if (e.target.closest('[data-close]')) closeModal(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
  const catLabel = c => J.CATEGORIES[c] || (c ? c.charAt(0).toUpperCase() + c.slice(1) : '');

  if (DB.mode === 'demo') $('#demoBar').innerHTML = `<div class="demo-bar">🧪 Demo mode — data is saved only in this browser. Connect Supabase in <code>js/config.js</code> to go live (see README).</div>`;

  /* ================= login gate ================= */
  await DB.ready;
  DB.onChange(() => gate());
  gate();

  async function gate() {
    const u = DB.user();
    if (!u) return showLogin();
    let ok = false;
    try { ok = await DB.isAdmin(); } catch (e) { console.error(e); }
    if (!ok) {
      app.innerHTML = `<div class="login-wrap"><div class="login-card"><h2>Not an admin account</h2><p class="muted" style="margin:8px 0 16px">You're logged in as <b>${esc(u.email)}</b>, but this e-mail isn't in the admin list.</p>
        <div class="hint">${DB.mode === 'demo' ? 'In demo mode, log in with the demo admin account shown on the login screen.' : 'Add it in Supabase → SQL Editor:<br><code>insert into admins (email) values (\'' + esc(u.email) + '\');</code><br>then reload this page.'}</div>
        <button class="btn btn-dark btn-block" id="out" style="margin-top:16px">Log out</button><a href="index.html" class="btn btn-ghost btn-block" style="margin-top:8px">Go to store</a></div></div>`;
      $('#out').onclick = () => DB.signOut();
      return;
    }
    if (!$('#adminShell') && !starting) { starting = true; try { await startAdmin(); } finally { starting = false; } }
  }

  function showLogin() {
    app.innerHTML = `<div class="login-wrap"><form class="login-card" id="lf"><a href="index.html" class="logo" style="margin-bottom:18px"><span class="logo-mark">S</span>ADMIN</a>
      <h2 style="margin-bottom:4px">Admin login</h2><p class="muted" style="font-size:.88rem;margin-bottom:16px">Manage products, photos and orders.</p>
      <div class="form-grid"><input class="field" name="email" type="email" required placeholder="Admin email" autocomplete="email"><input class="field" name="password" type="password" required placeholder="Password" autocomplete="current-password">
      <div class="form-msg err" id="lm"></div><button class="btn btn-dark btn-block">Log in</button>
      ${DB.mode === 'demo' ? `<div class="hint">Demo admin: <b>${esc(DB.demoAdmin.email)}</b> / <b>${esc(DB.demoAdmin.password)}</b> <button type="button" class="link-btn" id="fillDemo">fill in</button></div>` : `<div class="hint">First time? Create an account on the <a href="index.html" style="text-decoration:underline">store</a> with the e-mail you added to the admins table in setup.sql, then log in here.</div>`}</div></form></div>`;
    if ($('#fillDemo')) $('#fillDemo').onclick = () => { $('#lf').email.value = DB.demoAdmin.email; $('#lf').password.value = DB.demoAdmin.password; };
    $('#lf').onsubmit = async e => { e.preventDefault(); const f = e.target; const btn = f.querySelector('.btn-dark'); busy(btn, true, 'Logging in…'); try { await DB.signIn({ email: f.email.value.trim(), password: f.password.value }); } catch (err) { busy(btn, false); $('#lm').textContent = err.message; } };
  }

  /* ================= shell ================= */
  async function startAdmin() {
    app.innerHTML = `<div id="adminShell"><header class="admin-top"><div class="wrap nav"><a href="index.html" class="logo" style="color:#fff"><span class="logo-mark">S</span><span id="aStore">ADMIN</span></a>
      <div class="nav-tools"><a href="index.html" target="_blank" class="btn btn-sm btn-outline-light">View store ↗</a><button class="btn btn-sm btn-outline-light" id="aOut">Log out</button></div></div></header>
      <main class="wrap admin-main"><div class="tabs" id="aTabs"><button data-t="orders" class="active">📦 Orders <span id="newBadge"></span></button><button data-t="products">👕 Products</button><button data-t="settings">⚙️ Settings</button></div><div id="aBody"></div></main></div>`;
    $('#aOut').onclick = async () => { await DB.signOut(); };
    $('#aTabs').onclick = e => { const b = e.target.closest('button'); if (!b) return; tab = b.dataset.t; $$('#aTabs button').forEach(x => x.classList.toggle('active', x === b)); render(); };
    try { SETTINGS = await DB.getSettings(); } catch (e) { }
    $('#aStore').textContent = (SETTINGS.store_name || 'Store').toUpperCase() + ' ADMIN';
    await Promise.all([loadOrders(), loadProducts()]);
    render();
    setInterval(pollOrders, 60000);
  }
  function render() { if (tab === 'orders') renderOrders(); else if (tab === 'products') renderProducts(); else renderSettings(); }
  async function loadOrders() { try { ORDERS = await DB.allOrders(); } catch (e) { toast('Could not load orders: ' + e.message); ORDERS = []; } updateNewBadge(); }
  async function loadProducts() { try { PRODUCTS = await DB.listProducts(true); } catch (e) { toast('Could not load products: ' + e.message); PRODUCTS = []; } }
  function updateNewBadge() { const n = ORDERS.filter(o => o.status === 'new').length; $('#newBadge').innerHTML = n ? `<span class="pill new" style="margin-left:4px">${n}</span>` : ''; document.title = (n ? `(${n}) ` : '') + 'Store Admin'; }
  async function pollOrders() {
    try {
      const fresh = await DB.allOrders(); const known = new Set(ORDERS.map(o => o.id)); const added = fresh.filter(o => !known.has(o.id));
      if (added.length) { ORDERS = fresh; updateNewBadge(); toast(`🔔 ${added.length} new order${added.length > 1 ? 's' : ''}!`); if (tab === 'orders' && !document.querySelector('.order-card.dirty')) renderOrders(); }
    } catch (e) { }
  }

  /* ================= orders ================= */
  const STATUS_MSG = {
    new: 'we have received your order',
    confirmed: 'is confirmed ✅',
    printing: 'is being printed 🖨️',
    shipped: 'has been shipped 🚚',
    delivered: 'has been delivered 🏆 Hope you love it!',
    cancelled: 'has been cancelled.'
  };
  function customerMessage(o, status, date, note) {
    const first = String(o.customer_name || '').split(' ')[0] || 'there';
    const lines = [`Hi ${first}! 👋`, '', status === 'new' ? `Thanks for your ${SETTINGS.store_name} order #${o.id} — we have received it.` : `Your ${SETTINGS.store_name} order #${o.id} ${STATUS_MSG[status]}`];
    if (date && status !== 'cancelled' && status !== 'delivered') lines.push('', `📦 *Expected delivery:* ${J.fmtDate(date)}`);
    if (status !== 'cancelled' && status !== 'delivered') lines.push(`💰 *Total:* ${inr(o.total)}`);
    if (note) lines.push('', note);
    lines.push('', 'Thank you! 🏏');
    return lines.join('\n');
  }
  const thumbHTML = i => i.image && safeUrl(i.image) ? `<img src="${esc(safeUrl(i.image))}" alt="">` : J.svg({ ...(i.design || {}), side: i.name || i.number ? 'back' : 'front', name: i.name, number: i.number, team: i.team });
  function orderCard(o) {
    const st = J.STATUSES.find(s => s[0] === o.status) || J.STATUSES[0];
    const items = (o.items || []).map(i => {
      const pers = [i.name, i.number !== '' && i.number != null ? '#' + i.number : ''].filter(Boolean).join(' ');
      const des = i.design && !i.pid ? `<small>Custom: ${esc(i.design.pattern)} · ${esc(i.design.collar)} · ${i.design.c.map(c => `<span style="display:inline-block;width:10px;height:10px;border-radius:3px;background:${esc(c)};vertical-align:middle;border:1px solid var(--line)"></span>`).join(' ')}${i.team ? ' · team “' + esc(i.team) + '”' : ''}</small>` : '';
      return `<div class="oi"><div class="thumb">${thumbHTML(i)}</div><div><b>${esc(i.title)}</b><small>Size <b>${esc(i.size)}</b> × ${esc(i.qty)}${pers ? ' · <b>' + esc(pers) + '</b>' : ''}</small>${des}</div><b>${inr(i.price * i.qty)}</b></div>`;
    }).join('');
    const tel = esc(o.phone);
    return `<div class="order-card" data-id="${esc(o.id)}"><div class="adm-order"><div>
      <div class="order-head"><div><b style="font-size:1.1rem">#${esc(o.id)}</b> <small class="muted">· ${esc(new Date(o.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }))}</small></div><span class="pill ${esc(o.status)}">${esc(st[1])}</span></div>
      <div class="cust"><b>${esc(o.customer_name)}</b> · <a href="tel:${tel}">${tel}</a>${o.email ? ' · ' + esc(o.email) : ''}<br>${esc(o.address)}, ${esc(o.city)} – ${esc(o.pincode)}${o.note ? `<br><span class="muted">📝 ${esc(o.note)}</span>` : ''}</div>
      <div class="order-items">${items}</div><div class="line total"><span>Total</span><span>${inr(o.total)}</span></div></div>
      <div class="controls">
        <label><span class="lbl">Status</span><select class="field" data-f="status">${J.STATUSES.map(s => `<option value="${s[0]}" ${s[0] === o.status ? 'selected' : ''}>${s[1]}</option>`).join('')}</select></label>
        <label><span class="lbl">Delivery date</span><input class="field" type="date" data-f="delivery_date" value="${esc(o.delivery_date || '')}"></label>
        <label><span class="lbl">Message to customer <small>(shown in their “My Orders”)</small></span><textarea class="field" rows="2" data-f="admin_note" placeholder="e.g. Pay ₹500 advance on UPI to confirm">${esc(o.admin_note || '')}</textarea></label>
        <div class="row2"><button class="btn btn-dark btn-sm" data-act="save">Save</button><a class="btn btn-wa btn-sm" data-act="wa" target="_blank" rel="noopener" href="#">${WA_SVG} WhatsApp</a></div>
        <div style="display:flex;justify-content:space-between;gap:8px"><button class="link-btn" data-act="copy">Copy message</button><button class="link-btn" data-act="del" style="color:var(--hot)">Delete</button></div>
      </div></div></div>`;
  }
  function renderOrders() {
    const counts = { all: ORDERS.length }; ORDERS.forEach(o => counts[o.status] = (counts[o.status] || 0) + 1);
    let list = ORDERS.filter(o => oFilter === 'all' || o.status === oFilter);
    if (oQuery) list = list.filter(o => (o.id + ' ' + o.customer_name + ' ' + o.phone + ' ' + (o.email || '') + ' ' + o.city).toLowerCase().includes(oQuery));
    $('#aBody').innerHTML = `<div class="stat-row">${[['all', 'All orders']].concat(J.STATUSES.map(s => [s[0], s[1]])).map(s => `<button class="stat ${oFilter === s[0] ? 'active' : ''}" data-s="${s[0]}"><b>${counts[s[0]] || 0}</b><span>${s[1]}</span></button>`).join('')}</div>
      <div class="toolbar"><input class="field grow" id="oSearch" type="search" placeholder="Search order #, name, phone, city…" value="${esc(oQuery)}"><button class="btn btn-ghost btn-sm" id="oRefresh">↻ Refresh</button><button class="btn btn-ghost btn-sm" id="oCsv">⬇ Export CSV</button></div>
      <div id="oList">${list.length ? list.map(orderCard).join('') : `<div class="empty">${ORDERS.length ? 'No orders match.' : 'No orders yet. When a customer books, it shows up here.'}</div>`}</div>`;
    $$('.stat').forEach(b => b.onclick = () => { oFilter = b.dataset.s; renderOrders(); });
    $('#oSearch').oninput = e => { oQuery = e.target.value.trim().toLowerCase(); const pos = e.target.selectionStart; renderOrders(); const s = $('#oSearch'); s.focus(); s.setSelectionRange(pos, pos); };
    $('#oRefresh').onclick = async () => { await loadOrders(); renderOrders(); toast('Orders refreshed'); };
    $('#oCsv').onclick = exportCsv;
    $$('#oList .order-card').forEach(wireOrder);
  }
  function updateStats() { const counts = { all: ORDERS.length }; ORDERS.forEach(o => counts[o.status] = (counts[o.status] || 0) + 1); $$('.stat').forEach(b => b.querySelector('b').textContent = counts[b.dataset.s] || 0); }
  function wireOrder(card) {
    const id = isNaN(+card.dataset.id) ? card.dataset.id : +card.dataset.id;
    const o = ORDERS.find(x => x.id === id); if (!o) return;
    const val = f => card.querySelector(`[data-f="${f}"]`).value;
    const msg = () => customerMessage(o, val('status'), val('delivery_date'), val('admin_note').trim());
    const wa = card.querySelector('[data-act="wa"]');
    const refresh = () => { wa.href = J.waLink(o.phone, msg()); };
    refresh();
    card.addEventListener('input', () => { card.classList.add('dirty'); refresh(); });
    card.addEventListener('change', () => {
      refresh();
      if (val('status') === 'confirmed' && !val('delivery_date')) toast('Tip: set a delivery date so the customer sees it');
    });
    const save = async (quiet) => {
      const patch = { status: val('status'), delivery_date: val('delivery_date') || null, admin_note: val('admin_note').trim() };
      const btn = card.querySelector('[data-act="save"]'); busy(btn, true);
      try { const u = await DB.updateOrder(o.id, patch); Object.assign(o, u || patch); card.classList.remove('dirty'); if (!quiet) toast(`Order #${o.id} saved ✓`); const pill = card.querySelector('.pill'); const st = J.STATUSES.find(s => s[0] === o.status); pill.className = 'pill ' + o.status; pill.textContent = st[1]; updateNewBadge(); updateStats(); }
      catch (e) { toast('Save failed: ' + e.message); }
      busy(btn, false);
    };
    card.querySelector('[data-act="save"]').onclick = () => save(false);
    wa.onclick = () => { if (card.classList.contains('dirty')) save(true); };
    card.querySelector('[data-act="copy"]').onclick = () => { const t = msg(); (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(() => toast('Message copied'), () => prompt('Copy:', t)); };
    card.querySelector('[data-act="del"]').onclick = async () => { if (!confirm(`Delete order #${o.id}? This can't be undone.`)) return; try { await DB.deleteOrder(o.id); ORDERS = ORDERS.filter(x => x !== o); updateNewBadge(); renderOrders(); toast('Order deleted'); } catch (e) { toast('Delete failed: ' + e.message); } };
  }
  function exportCsv() {
    if (!ORDERS.length) return toast('No orders to export');
    const rows = [['Order', 'Date', 'Status', 'Delivery date', 'Name', 'Phone', 'Email', 'Address', 'City', 'PIN', 'Item', 'Size', 'Qty', 'Print name', 'Number', 'Line total', 'Order total', 'Customer note']];
    ORDERS.forEach(o => (o.items || []).forEach(i => rows.push([o.id, new Date(o.created_at).toLocaleDateString('en-IN'), o.status, o.delivery_date || '', o.customer_name, o.phone, o.email || '', o.address, o.city, o.pincode, i.title, i.size, i.qty, i.name || '', i.number || '', i.price * i.qty, o.total, o.note || ''])));
    const csv = rows.map(r => r.map(x => `"${String(x == null ? '' : x).replace(/"/g, '""')}"`).join(',')).join('\n');
    const fname = 'orders-' + new Date().toISOString().slice(0, 10) + '.csv';
    if (window.SixerApp && SixerApp.saveFile) { SixerApp.saveFile(fname, 'text/csv', '\ufeff' + csv); return; } // Android admin app
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv' })); a.download = fname; document.body.appendChild(a); a.click(); setTimeout(() => a.remove(), 300);
  }

  /* ================= products ================= */
  function renderProducts() {
    let list = PRODUCTS; if (pQuery) list = list.filter(p => (p.name + ' ' + p.category + ' ' + p.tag).toLowerCase().includes(pQuery));
    $('#aBody').innerHTML = `<div class="toolbar"><button class="btn btn-primary" id="pNew">+ Add product</button><input class="field grow" id="pSearch" type="search" placeholder="Search products…" value="${esc(pQuery)}"><span class="muted" style="font-size:.85rem">${PRODUCTS.length} products · ${PRODUCTS.filter(p => p.active).length} visible</span></div>
      <div class="box table-scroll" style="padding:6px 14px">${list.length ? `<table class="prod-table"><thead><tr><th></th><th>Product</th><th>Category</th><th>Price</th><th>Visible</th><th>Order</th><th></th></tr></thead><tbody>
      ${list.map(p => `<tr data-id="${esc(p.id)}" class="${p.active ? '' : 'hidden-row'}"><td>${p.images[0] && safeUrl(p.images[0]) ? `<img src="${esc(safeUrl(p.images[0]))}" alt="">` : '<div style="width:52px;height:52px;border-radius:10px;background:var(--surface-2);display:grid;place-items:center;font-size:.6rem" class="muted">No photo</div>'}</td>
        <td><b>${esc(p.name)}</b>${p.tag ? ` <span class="pill">${esc(p.tag)}</span>` : ''}<br><small class="muted">${p.images.length} photo${p.images.length === 1 ? '' : 's'} · ${p.sizes.length} sizes${p.customizable ? ' · name/number' : ''}</small></td>
        <td>${esc(catLabel(p.category))}</td><td><b>${inr(p.price)}</b>${p.mrp ? `<br><s class="muted">${inr(p.mrp)}</s>` : ''}</td>
        <td><label class="switch"><input type="checkbox" data-act="vis" ${p.active ? 'checked' : ''}><span></span></label></td>
        <td style="white-space:nowrap"><button class="btn btn-ghost btn-sm" data-act="up" title="Move up">↑</button> <button class="btn btn-ghost btn-sm" data-act="down" title="Move down">↓</button></td>
        <td style="white-space:nowrap"><button class="btn btn-ghost btn-sm" data-act="edit">Edit</button> <button class="btn btn-ghost btn-sm" data-act="dup" title="Duplicate">⧉</button> <button class="btn btn-ghost btn-sm" data-act="del" style="color:var(--hot)">✕</button></td></tr>`).join('')}</tbody></table>` : `<div class="empty">${PRODUCTS.length ? 'No products match.' : 'No products yet. Click “Add product” to upload your first jersey.'}</div>`}</div>`;
    $('#pNew').onclick = () => editProduct(null);
    $('#pSearch').oninput = e => { pQuery = e.target.value.trim().toLowerCase(); const pos = e.target.selectionStart; renderProducts(); const s = $('#pSearch'); s.focus(); s.setSelectionRange(pos, pos); };
    $$('.prod-table tbody tr').forEach(tr => {
      const p = PRODUCTS.find(x => String(x.id) === tr.dataset.id);
      tr.onclick = async e => {
        const b = e.target.closest('[data-act]'); if (!b) return; const act = b.dataset.act;
        if (act === 'edit') editProduct(p);
        else if (act === 'dup') editProduct({ ...p, id: null, name: p.name + ' (copy)' });
        else if (act === 'del') { if (!confirm(`Delete “${p.name}”?`)) return; try { await DB.deleteProduct(p.id); PRODUCTS = PRODUCTS.filter(x => x !== p); renderProducts(); toast('Product deleted'); } catch (err) { toast('Delete failed: ' + err.message); } }
        else if (act === 'up' || act === 'down') moveProduct(p, act === 'up' ? -1 : 1);
      };
      const vis = tr.querySelector('[data-act="vis"]');
      vis.onchange = async () => { try { const u = await DB.saveProduct({ ...p, active: vis.checked }); Object.assign(p, u); tr.classList.toggle('hidden-row', !p.active); toast(p.active ? 'Now visible in the store' : 'Hidden from the store'); } catch (err) { vis.checked = !vis.checked; toast('Failed: ' + err.message); } };
    });
  }
  async function moveProduct(p, dir) {
    const i = PRODUCTS.indexOf(p), j = i + dir; if (j < 0 || j >= PRODUCTS.length) return;
    [PRODUCTS[i], PRODUCTS[j]] = [PRODUCTS[j], PRODUCTS[i]];
    const changed = PRODUCTS.map((x, k) => ({ x, k })).filter(({ x, k }) => x.sort !== k);
    changed.forEach(({ x, k }) => x.sort = k);
    renderProducts();
    try { await Promise.all(changed.map(({ x }) => DB.saveProduct(x))); } catch (e) { toast('Could not save order: ' + e.message); }
  }

  function editProduct(src) {
    const p = src ? JSON.parse(JSON.stringify(src)) : { id: null, name: '', category: 'polo', price: '', mrp: '', tag: '', description: '', images: [], sizes: J.ADULT.slice(), customizable: true, active: true, sort: PRODUCTS.length ? Math.min(...PRODUCTS.map(x => x.sort)) - 1 : 0 };
    let uploading = 0;
    const cats = [...new Set(Object.keys(J.CATEGORIES).concat(PRODUCTS.map(x => x.category)).concat([p.category]))];
    $('#prodContent').innerHTML = `<form class="modal-pad" id="pf"><h2 style="margin-bottom:16px">${p.id ? 'Edit product' : 'Add product'}</h2>
      <div class="form-grid">
        <div><span class="lbl">Photos <small>— first photo is the cover; the 2nd shows when customers hover. Drag files here or click +</small></span><div class="img-grid" id="imgGrid"></div><input type="file" id="fileIn" accept="image/*" multiple hidden></div>
        <label><span class="lbl">Product name *</span><input class="field" name="name" required maxlength="80" value="${esc(p.name)}" placeholder="e.g. Royal Blue Polo Cricket Jersey"></label>
        <div class="row2"><label><span class="lbl">Category</span><select class="field" name="category">${cats.map(c => `<option value="${esc(c)}" ${c === p.category ? 'selected' : ''}>${esc(catLabel(c))}</option>`).join('')}</select></label>
        <label><span class="lbl">Badge <small>(optional)</small></span><input class="field" name="tag" maxlength="16" value="${esc(p.tag)}" placeholder="New, Bestseller…" list="tagList"><datalist id="tagList"><option>New</option><option>Bestseller</option><option>Trending</option><option>Limited</option><option>Combo</option></datalist></label></div>
        <div class="row2"><label><span class="lbl">Selling price (₹) *</span><input class="field" name="price" type="number" min="0" required value="${esc(p.price)}"></label>
        <label><span class="lbl">MRP (₹) <small>— shows a strike-through & % off</small></span><input class="field" name="mrp" type="number" min="0" value="${esc(p.mrp || '')}"></label></div>
        <label><span class="lbl">Description</span><textarea class="field" name="description" rows="3" placeholder="Fabric, fit, what's included…">${esc(p.description)}</textarea></label>
        <div><span class="lbl">Sizes <small>— <button type="button" class="link-btn" data-sz="adult">adult</button> · <button type="button" class="link-btn" data-sz="kids">kids</button> · <button type="button" class="link-btn" data-sz="all">all</button> · <button type="button" class="link-btn" data-sz="none">none</button></small></span>
          <div class="size-check" id="szBox">${J.ALL_SIZES.map(s => `<label><input type="checkbox" value="${s}" ${p.sizes.includes(s) ? 'checked' : ''}><span>${s}</span></label>`).join('')}</div></div>
        <label class="toggle-row"><span class="switch"><input type="checkbox" name="customizable" ${p.customizable ? 'checked' : ''}><span></span></span> Customers can add a name &amp; number</label>
        <label class="toggle-row"><span class="switch"><input type="checkbox" name="active" ${p.active ? 'checked' : ''}><span></span></span> Visible in the store</label>
        <div class="form-msg err" id="pfMsg"></div>
        <div class="row2"><button type="button" class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-dark" id="pfSave">${p.id ? 'Save changes' : 'Add product'}</button></div>
      </div></form>`;
    const grid = $('#imgGrid'), fileIn = $('#fileIn');
    function drawImgs() {
      grid.innerHTML = p.images.map((u, i) => `<div class="img-tile">${i === 0 ? '<span class="cover">COVER</span>' : ''}<img src="${esc(safeUrl(u))}" alt=""><div class="tools"><button type="button" data-m="${i}" data-d="-1" title="Move left">◀</button><button type="button" data-rm="${i}" title="Remove">✕</button><button type="button" data-m="${i}" data-d="1" title="Move right">▶</button></div></div>`).join('')
        + Array.from({ length: uploading }, () => '<div class="img-tile skeleton" style="aspect-ratio:1"></div>').join('')
        + '<div class="drop" id="dropZone">＋<br>Add photos</div>';
      $('#dropZone').onclick = () => fileIn.click();
      wireDrop($('#dropZone'));
    }
    grid.onclick = e => {
      const rm = e.target.closest('[data-rm]'), mv = e.target.closest('[data-m]');
      if (rm) { p.images.splice(+rm.dataset.rm, 1); drawImgs(); }
      else if (mv) { const i = +mv.dataset.m, j = i + +mv.dataset.d; if (j >= 0 && j < p.images.length) { [p.images[i], p.images[j]] = [p.images[j], p.images[i]]; drawImgs(); } }
    };
    async function addFiles(files) {
      files = [...files].filter(f => /^image\//.test(f.type)); if (!files.length) return;
      if (files.some(f => f.size > 15 * 1024 * 1024)) toast('Very large photos are resized automatically');
      uploading += files.length; drawImgs(); $('#pfSave').disabled = true;
      for (const f of files) {
        try { const url = await DB.uploadImage(f); p.images.push(url); }
        catch (e) { toast('Upload failed: ' + e.message); }
        uploading--; drawImgs();
      }
      $('#pfSave').disabled = false;
    }
    function wireDrop(el) {
      el.ondragover = e => { e.preventDefault(); el.classList.add('over'); };
      el.ondragleave = () => el.classList.remove('over');
      el.ondrop = e => { e.preventDefault(); el.classList.remove('over'); addFiles(e.dataTransfer.files); };
    }
    $('#prodContent').ondragover = e => e.preventDefault();
    $('#prodContent').ondrop = e => { e.preventDefault(); if (e.dataTransfer && e.dataTransfer.files.length) addFiles(e.dataTransfer.files); };
    fileIn.onchange = () => { addFiles(fileIn.files); fileIn.value = ''; };
    drawImgs();
    $$('[data-sz]').forEach(b => b.onclick = () => { const set = { adult: J.ADULT, kids: J.KIDS, all: J.ALL_SIZES, none: [] }[b.dataset.sz]; $$('#szBox input').forEach(i => i.checked = set.includes(i.value)); });
    $('#pf').onsubmit = async e => {
      e.preventDefault(); if (uploading) return;
      const f = e.target;
      const out = { ...p, name: f.name.value.trim(), category: f.category.value, tag: f.tag.value.trim(), price: Number(f.price.value), mrp: f.mrp.value ? Number(f.mrp.value) : null, description: f.description.value.trim(), sizes: $$('#szBox input:checked').map(i => i.value), customizable: f.customizable.checked, active: f.active.checked };
      if (!out.sizes.length) return $('#pfMsg').textContent = 'Pick at least one size.';
      if (out.mrp && out.mrp < out.price) return $('#pfMsg').textContent = 'MRP should be higher than the selling price (or leave it empty).';
      if (!out.images.length && !confirm('This product has no photos. Save anyway?')) return;
      const btn = $('#pfSave'); busy(btn, true);
      try {
        const saved = await DB.saveProduct(out);
        const i = PRODUCTS.findIndex(x => String(x.id) === String(saved.id));
        if (i > -1) PRODUCTS[i] = saved; else PRODUCTS.unshift(saved);
        PRODUCTS.sort((a, b) => a.sort - b.sort || String(b.created_at).localeCompare(String(a.created_at)));
        closeModal(); renderProducts(); toast(p.id ? 'Product updated ✓' : 'Product added ✓ — it is now in the store');
      } catch (err) { busy(btn, false); $('#pfMsg').textContent = err.message; }
    };
    openModal($('#prodModal'));
  }

  /* ================= settings ================= */
  function renderSettings() {
    const s = SETTINGS;
    $('#aBody').innerHTML = `<div class="team-grid"><form class="box" id="sf"><h3>Store settings</h3><div class="form-grid">
      <label><span class="lbl">Store name</span><input class="field" name="store_name" value="${esc(s.store_name)}" maxlength="40"></label>
      <label><span class="lbl">Your WhatsApp number <small>— orders are sent here. 10-digit Indian numbers get +91 automatically.</small></span><input class="field" name="whatsapp" value="${esc(s.whatsapp)}" placeholder="e.g. 9876543210" inputmode="tel"></label>
      <label><span class="lbl">Announcement bar <small>(leave empty to hide)</small></span><input class="field" name="announcement" value="${esc(s.announcement)}" maxlength="140"></label>
      <label><span class="lbl">Booking note <small>— shown in the cart and at checkout</small></span><textarea class="field" name="delivery_note" rows="2" maxlength="300">${esc(s.delivery_note)}</textarea></label>
      <div><span class="lbl">Design Studio jersey prices (₹)</span><div class="row2" style="grid-template-columns:repeat(3,1fr)"><label><small class="muted">1–10 jerseys</small><input class="field" type="number" min="0" name="custom_price" value="${esc(s.custom_price)}"></label><label><small class="muted">11–20</small><input class="field" type="number" min="0" name="team_price_11" value="${esc(s.team_price_11)}"></label><label><small class="muted">21+</small><input class="field" type="number" min="0" name="team_price_21" value="${esc(s.team_price_21)}"></label></div></div>
      <div class="form-msg" id="sfMsg"></div>
      <div class="row2"><button type="button" class="btn btn-wa" id="testWa">${WA_SVG} Test WhatsApp</button><button class="btn btn-dark">Save settings</button></div></div></form>
      <div class="box"><h3>Status</h3><p style="margin:8px 0"><b>Mode:</b> ${DB.mode === 'demo' ? '🧪 Demo (this browser only)' : '🟢 Live (Supabase)'}</p>
      <p class="muted" style="font-size:.88rem;margin-bottom:10px">Logged in as ${esc((DB.user() || {}).email || '')}</p>
      <div class="hint" style="margin-bottom:10px"><b>How orders work</b><br>1. Customer books → order appears in <b>Orders</b> with status <span class="pill new">New</span><br>2. Their WhatsApp opens with the order details → they send it to your number<br>3. Set status + delivery date, press <b>Save</b>, then <b>WhatsApp</b> to message them. They also see it in “My Orders”.</div>
      ${DB.mode === 'demo' ? '' : `<div class="hint"><b>Add another admin</b><br>Supabase → SQL Editor:<br><code>insert into admins (email) values ('friend@example.com');</code></div>`}</div></div>`;
    $('#testWa').onclick = () => { const n = J.waNumber($('#sf').whatsapp.value); if (n.length < 11) return toast('Enter a valid WhatsApp number first'); window.open(J.waLink(n, 'Test message from my store admin ✅'), '_blank'); };
    $('#sf').onsubmit = async e => {
      e.preventDefault(); const f = e.target; const btn = f.querySelector('.btn-dark');
      const wa = J.waNumber(f.whatsapp.value);
      if (f.whatsapp.value && wa.length < 11) { $('#sfMsg').className = 'form-msg err'; $('#sfMsg').textContent = 'That WhatsApp number looks wrong. Use 10 digits, e.g. 9876543210.'; return; }
      const next = { ...SETTINGS, store_name: f.store_name.value.trim() || 'My Store', whatsapp: wa, announcement: f.announcement.value.trim(), delivery_note: f.delivery_note.value.trim() || DB.DEFAULT_SETTINGS.delivery_note, custom_price: Number(f.custom_price.value) || 0, team_price_11: Number(f.team_price_11.value) || 0, team_price_21: Number(f.team_price_21.value) || 0 };
      busy(btn, true);
      try { await DB.saveSettings(next); SETTINGS = next; $('#aStore').textContent = SETTINGS.store_name.toUpperCase() + ' ADMIN'; f.whatsapp.value = wa; $('#sfMsg').className = 'form-msg ok'; $('#sfMsg').textContent = '✅ Saved — the store is updated.'; }
      catch (err) { $('#sfMsg').className = 'form-msg err'; $('#sfMsg').textContent = err.message; }
      busy(btn, false);
    };
  }
})();
