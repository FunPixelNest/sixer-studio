/*
  Data layer. One interface, two back-ends:
    • Supabase  — real logins, shared database and photo storage (when js/config.js is filled in)
    • Demo      — everything stored in this browser only (when config is empty)
*/
(function () {
  'use strict';
  const CFG = window.SIXER_CONFIG || {};
  const J = window.Jersey;
  const DEFAULT_SETTINGS = {
    store_name: 'Sixer Studio',
    whatsapp: '',
    announcement: '🏏 Book your custom jersey online — we confirm delivery date on WhatsApp',
    delivery_note: 'No online payment needed. After you book, we will message you on WhatsApp with the delivery date and payment details.',
    custom_price: 485,
    team_price_11: 449,
    team_price_21: 399,
    instagram: ''
  };
  const listeners = [];
  let currentUser = null;
  const emit = () => listeners.forEach(f => { try { f(currentUser); } catch (e) { console.error(e); } });
  const normProduct = p => ({
    id: p.id, name: p.name || '', category: p.category || 'other', price: Number(p.price) || 0, mrp: p.mrp ? Number(p.mrp) : null,
    description: p.description || '', images: Array.isArray(p.images) ? p.images.filter(Boolean) : [], sizes: Array.isArray(p.sizes) && p.sizes.length ? p.sizes : J.ADULT.slice(0, 5),
    customizable: p.customizable !== false, tag: p.tag || '', active: p.active !== false, sort: Number(p.sort) || 0, created_at: p.created_at || new Date().toISOString()
  });
  const sortProducts = list => list.sort((a, b) => a.sort - b.sort || String(b.created_at).localeCompare(String(a.created_at)));

  /* ------------------------------------------------------------------ SUPABASE */
  function supabaseBackend() {
    const sb = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true } });
    const toUser = u => u ? { id: u.id, email: u.email, name: (u.user_metadata || {}).name || '', phone: (u.user_metadata || {}).phone || '', address: (u.user_metadata || {}).address || '', city: (u.user_metadata || {}).city || '', pincode: (u.user_metadata || {}).pincode || '' } : null;
    const chk = ({ data, error }) => { if (error) throw new Error(friendly(error.message)); return data; };
    let adminCache = null;
    sb.auth.onAuthStateChange((evt, session) => { if (evt === 'PASSWORD_RECOVERY') setTimeout(() => window.dispatchEvent(new Event('sx-recovery')), 300); const nu = toUser(session && session.user); if ((nu && nu.id) !== (currentUser && currentUser.id)) adminCache = null; currentUser = nu; emit(); });

    return {
      mode: 'supabase',
      async init() { const { data } = await sb.auth.getSession(); currentUser = toUser(data.session && data.session.user); },
      user: () => currentUser,
      async signUp({ email, password, name, phone }) {
        const d = chk(await sb.auth.signUp({ email, password, options: { data: { name, phone }, emailRedirectTo: location.href.split('#')[0] } }));
        if (d.session) currentUser = toUser(d.user);
        return { needsConfirm: !d.session };
      },
      async signIn({ email, password }) { const d = chk(await sb.auth.signInWithPassword({ email, password })); currentUser = toUser(d.user); emit(); return currentUser; },
      async signOut() { await sb.auth.signOut(); currentUser = null; adminCache = null; emit(); },
      async resetPassword(email) { chk(await sb.auth.resetPasswordForEmail(email, { redirectTo: location.href.split('#')[0] })); },
      async updatePassword(password) { chk(await sb.auth.updateUser({ password })); },
      async updateProfile(p) { const d = chk(await sb.auth.updateUser({ data: p })); currentUser = toUser(d.user); emit(); return currentUser; },
      async isAdmin() { if (!currentUser) return false; if (adminCache == null) adminCache = !!chk(await sb.rpc('is_admin')); return adminCache; },

      async listProducts(all) { let q = sb.from('products').select('*'); if (!all) q = q.eq('active', true); return sortProducts(chk(await q).map(normProduct)); },
      async saveProduct(p) {
        const row = normProduct(p); delete row.created_at; const id = row.id; delete row.id;
        const d = id ? chk(await sb.from('products').update(row).eq('id', id).select().single()) : chk(await sb.from('products').insert(row).select().single());
        return normProduct(d);
      },
      async deleteProduct(id) { chk(await sb.from('products').delete().eq('id', id)); },
      async uploadImage(file) {
        const blob = await J.resizeImage(file, 1400, 0.85);
        const path = 'products/' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.jpg';
        chk(await sb.storage.from('product-images').upload(path, blob, { contentType: 'image/jpeg', cacheControl: '31536000', upsert: false }));
        return sb.storage.from('product-images').getPublicUrl(path).data.publicUrl;
      },

      async createOrder(o) { const d = chk(await sb.from('orders').insert({ ...o, email: currentUser && currentUser.email }).select().single()); return d; },
      async myOrders() { if (!currentUser) return []; return chk(await sb.from('orders').select('*').eq('user_id', currentUser.id).order('created_at', { ascending: false })); },
      async allOrders() { return chk(await sb.from('orders').select('*').order('created_at', { ascending: false }).limit(1000)); },
      async updateOrder(id, patch) { return chk(await sb.from('orders').update(patch).eq('id', id).select().single()); },
      async deleteOrder(id) { chk(await sb.from('orders').delete().eq('id', id)); },

      async getSettings() { const { data, error } = await sb.from('settings').select('data').eq('id', 1).maybeSingle(); if (error) console.warn(error); return { ...DEFAULT_SETTINGS, ...((data && data.data) || {}) }; },
      async saveSettings(s) { chk(await sb.from('settings').upsert({ id: 1, data: s })); return s; }
    };
  }

  function friendly(m) {
    m = String(m || 'Something went wrong');
    if (/Invalid login credentials/i.test(m)) return 'Wrong email or password.';
    if (/Email not confirmed/i.test(m)) return 'Please confirm your email first — check your inbox for the link.';
    if (/User already registered/i.test(m)) return 'An account with this email already exists. Try logging in.';
    if (/row-level security/i.test(m)) return 'You don’t have permission to do that. (Is this account listed in the admins table?)';
    if (/Password should be/i.test(m)) return 'Password must be at least 6 characters.';
    if (/Failed to fetch|NetworkError/i.test(m)) return 'Can’t reach the server. Check your internet connection.';
    return m;
  }

  /* ------------------------------------------------------------------ DEMO (localStorage) */
  function demoBackend() {
    const K = { p: 'sx_demo_products', o: 'sx_demo_orders', u: 'sx_demo_users', s: 'sx_demo_session', st: 'sx_demo_settings' };
    const get = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } };
    const set = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { throw new Error('Browser storage is full. In demo mode photos are stored in your browser — delete some products, or connect Supabase for real storage.'); } };
    const wait = (ms) => new Promise(r => setTimeout(r, ms || 120));
    const ADMIN = { email: 'admin@demo.com', password: 'admin123' };

    function seed() {
      if (get(K.p, null)) return;
      const S = [
        ['Thunder Sash Polo', 'polo', 'sash', ['#0a1f44', '#c6ff1a', '#ffffff'], 485, 1299, 'Bestseller'],
        ['Inferno Fade Polo', 'polo', 'fade', ['#ff4d2e', '#ffb800', '#ffffff'], 485, 1299, 'New'],
        ['Royal Hoops Round Neck', 'round', 'hoops', ['#1b3fa6', '#ffd23f', '#ffffff'], 449, 999, ''],
        ['Ocean Wave Polo', 'polo', 'wave', ['#006d77', '#83c5be', '#edf6f9'], 485, 1299, 'New'],
        ['Blackout Chevron Polo', 'polo', 'chevron', ['#111111', '#e63946', '#f1faee'], 499, 1299, 'Trending'],
        ['Pitch Stripes Round Neck', 'round', 'stripes', ['#2d6a4f', '#95d5b2', '#ffffff'], 449, 999, ''],
        ['Holi Splash Jersey', 'round', 'splash', ['#ffffff', '#ff006e', '#3a86ff'], 469, 1199, 'Limited'],
        ['Mini Champs Kids Jersey', 'kids', 'sash', ['#ffbe0b', '#fb5607', '#ffffff'], 349, 799, ''],
        ['Jersey + Track Combo — Navy', 'combo', 'wave', ['#0a1f44', '#3a86ff', '#ffffff'], 999, 1899, 'Combo']
      ];
      const t = Date.now();
      set(K.p, S.map((s, i) => normProduct({
        id: 'demo-' + (i + 1), name: s[0], category: s[1], price: s[4], mrp: s[5], tag: s[6], sort: i,
        description: 'Quick-dry polyester, sublimation printed so colours never crack or fade. Add your name and number.',
        images: [J.dataUrl({ pattern: s[2], c: s[3], collar: s[1] === 'round' ? 'round' : 'polo', side: 'front', team: 'YOUR TEAM' }), J.dataUrl({ pattern: s[2], c: s[3], collar: s[1] === 'round' ? 'round' : 'polo', side: 'back', name: 'YOUR NAME', number: '10' })],
        sizes: s[1] === 'kids' ? J.KIDS : J.ADULT, created_at: new Date(t - i * 1000).toISOString()
      })));
    }
    const users = () => get(K.u, {});
    const toUser = u => u ? { id: u.id, email: u.email, name: u.name || '', phone: u.phone || '', address: u.address || '', city: u.city || '', pincode: u.pincode || '' } : null;
    const load = () => { const e = get(K.s, null); if (e === ADMIN.email) return { id: 'admin', email: ADMIN.email, name: 'Demo Admin', phone: '' }; return toUser(users()[e]); };

    return {
      mode: 'demo', demoAdmin: ADMIN,
      async init() { seed(); currentUser = load(); },
      user: () => currentUser,
      async signUp({ email, password, name, phone }) {
        await wait(); email = String(email).trim().toLowerCase(); const u = users();
        if (u[email] || email === ADMIN.email) throw new Error('An account with this email already exists. Try logging in.');
        if (String(password).length < 6) throw new Error('Password must be at least 6 characters.');
        u[email] = { id: 'u-' + Date.now(), email, password, name, phone }; set(K.u, u); set(K.s, email); currentUser = load(); emit(); return { needsConfirm: false };
      },
      async signIn({ email, password }) {
        await wait(); email = String(email).trim().toLowerCase();
        if (email === ADMIN.email && password === ADMIN.password) { set(K.s, email); currentUser = load(); emit(); return currentUser; }
        const u = users()[email]; if (!u || u.password !== password) throw new Error('Wrong email or password.');
        set(K.s, email); currentUser = load(); emit(); return currentUser;
      },
      async signOut() { set(K.s, null); currentUser = null; emit(); },
      async resetPassword() { await wait(); throw new Error('Password reset emails work once Supabase is connected.'); },
      async updatePassword() { throw new Error('Not available in demo mode.'); },
      async updateProfile(p) { const u = users(); if (currentUser && u[currentUser.email]) { Object.assign(u[currentUser.email], p); set(K.u, u); } currentUser = { ...currentUser, ...p }; emit(); return currentUser; },
      async isAdmin() { return !!currentUser && currentUser.email === ADMIN.email; },

      async listProducts(all) { await wait(60); const l = get(K.p, []).map(normProduct); return sortProducts(all ? l : l.filter(p => p.active)); },
      async saveProduct(p) {
        await wait(); const l = get(K.p, []); const row = normProduct(p);
        if (row.id) { const i = l.findIndex(x => x.id === row.id); if (i > -1) { row.created_at = l[i].created_at; l[i] = row; } else l.unshift(row); }
        else { row.id = 'p-' + Date.now(); l.unshift(row); }
        set(K.p, l); return row;
      },
      async deleteProduct(id) { set(K.p, get(K.p, []).filter(p => p.id !== id)); },
      async uploadImage(file) {
        const blob = await J.resizeImage(file, 700, 0.75);
        return await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(blob); });
      },

      async createOrder(o) {
        await wait(250); const l = get(K.o, []); const id = (l.reduce((m, x) => Math.max(m, x.id), 1000)) + 1;
        const row = { ...o, id, user_id: currentUser && currentUser.id, email: currentUser && currentUser.email, status: 'new', delivery_date: null, admin_note: '', created_at: new Date().toISOString() };
        l.unshift(row); set(K.o, l); return row;
      },
      async myOrders() { return currentUser ? get(K.o, []).filter(o => o.user_id === currentUser.id) : []; },
      async allOrders() { await wait(60); return get(K.o, []); },
      async updateOrder(id, patch) { const l = get(K.o, []); const o = l.find(x => x.id === id); Object.assign(o, patch); set(K.o, l); return o; },
      async deleteOrder(id) { set(K.o, get(K.o, []).filter(o => o.id !== id)); },

      async getSettings() { return { ...DEFAULT_SETTINGS, ...get(K.st, {}) }; },
      async saveSettings(s) { set(K.st, s); return s; }
    };
  }

  const useSupabase = !!(CFG.SUPABASE_URL && CFG.SUPABASE_ANON_KEY && window.supabase);
  const api = useSupabase ? supabaseBackend() : demoBackend();
  api.onChange = f => listeners.push(f);
  api.DEFAULT_SETTINGS = DEFAULT_SETTINGS;
  api.configError = !!(CFG.SUPABASE_URL && CFG.SUPABASE_ANON_KEY && !window.supabase);
  api.ready = api.init().catch(e => console.error('Init failed', e));
  window.DB = api;
})();
