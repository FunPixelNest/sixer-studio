/* Shared helpers + SVG jersey renderer (used by the store, the Design Studio and the admin panel) */
(function () {
  'use strict';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const inr = n => '₹' + Math.round(Number(n) || 0).toLocaleString('en-IN');
  // Only allow image URLs we produce ourselves (https / data:image / relative)
  const safeUrl = u => {
    u = String(u || '').trim();
    if (/^https:\/\//i.test(u) || /^data:image\//i.test(u) || /^(\.\/|\/)?[\w\-./]+$/.test(u)) return u;
    return '';
  };

  const BODY = 'M96 22 L58 34 L8 80 L42 128 L72 108 L72 304 Q150 314 228 304 L228 108 L258 128 L292 80 L242 34 L204 22 Q150 60 96 22 Z';
  const SPL = [[60,140,26],[210,90,18],[120,240,34],[250,220,22],[90,62,12],[180,180,14],[40,250,16],[230,292,20],[150,120,9],[270,150,10],[110,180,7],[200,250,8]];
  let uid = 0;

  function svg(o) {
    const c = o.c || ['#0a1f44', '#c6ff1a', '#ffffff'];
    const c1 = c[0], c2 = c[1], c3 = c[2];
    const id = 'j' + (++uid) + Math.random().toString(36).slice(2, 6);
    const side = o.side || 'front';
    let pat = '';
    switch (o.pattern) {
      case 'sash': pat = `<path d="M30 320 L250 30 L310 30 L310 70 L95 330Z" fill="${c2}"/><path d="M100 330 L310 80 L310 96 L116 330Z" fill="${c3}"/>`; break;
      case 'stripes': pat = Array.from({ length: 10 }, (_, i) => `<rect x="${i * 36 - 20}" y="0" width="14" height="340" fill="${c2}" transform="skewX(-12)"/>`).join(''); break;
      case 'chevron': pat = `<path d="M0 150 L150 230 L300 150 L300 190 L150 270 L0 190Z" fill="${c2}"/><path d="M0 205 L150 285 L300 205 L300 222 L150 302 L0 222Z" fill="${c3}"/>`; break;
      case 'hoops': pat = [140, 196, 252].map(y => `<rect x="0" y="${y}" width="300" height="24" fill="${c2}"/>`).join('') + `<rect x="0" y="170" width="300" height="6" fill="${c3}"/><rect x="0" y="226" width="300" height="6" fill="${c3}"/>`; break;
      case 'wave': pat = `<path d="M0 170 C60 130 100 210 150 170 S240 130 300 170 L300 340 L0 340Z" fill="${c2}"/><path d="M0 215 C60 175 100 255 150 215 S240 175 300 215 L300 230 C240 190 200 270 150 230 S60 190 0 230Z" fill="${c3}"/>`; break;
      case 'split': pat = `<rect x="150" y="0" width="150" height="340" fill="${c2}"/><rect x="146" y="0" width="8" height="340" fill="${c3}"/>`; break;
      case 'splash': pat = SPL.map((s, i) => `<circle cx="${s[0]}" cy="${s[1]}" r="${s[2]}" fill="${i % 2 ? c3 : c2}" opacity="${i % 3 ? 0.9 : 0.7}"/>`).join(''); break;
      case 'fade': pat = `<defs><linearGradient id="${id}g" x1="0" y1="0" x2="0" y2="1"><stop offset=".25" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs><rect width="300" height="340" fill="url(#${id}g)"/>` + [200, 222, 244].map((y, i) => `<path d="M0 ${y} L300 ${y - 60}" stroke="${c3}" stroke-width="${4 - i}" opacity=".7"/>`).join(''); break;
    }
    const cuffs = `<path d="M8 80 L42 128 L50 122 L17 73Z" fill="${c2}"/><path d="M292 80 L258 128 L250 122 L283 73Z" fill="${c2}"/>`;
    let collar;
    if (o.collar === 'polo' && side === 'front') {
      collar = `<path d="M140 40 L160 40 L158 92 L142 92Z" fill="${c2}" stroke="rgba(0,0,0,.2)"/><circle cx="150" cy="60" r="2.6" fill="${c3}"/><circle cx="150" cy="76" r="2.6" fill="${c3}"/><path d="M96 22 L124 54 L148 42 Q118 38 106 16Z" fill="${c3}" stroke="rgba(0,0,0,.25)"/><path d="M204 22 L176 54 L152 42 Q182 38 194 16Z" fill="${c3}" stroke="rgba(0,0,0,.25)"/>`;
    } else if (o.collar === 'polo') {
      collar = `<path d="M96 22 Q150 44 204 22 L198 12 Q150 30 102 12Z" fill="${c3}" stroke="rgba(0,0,0,.25)"/>`;
    } else {
      collar = side === 'front' ? `<path d="M96 22 Q150 60 204 22 L196 18 Q150 50 104 18Z" fill="${c3}"/>` : `<path d="M96 22 Q150 36 204 22 L198 18 Q150 30 102 18Z" fill="${c3}"/>`;
    }
    const fontW = w => `font-family="Bebas Neue,Impact,Arial Narrow,sans-serif" text-anchor="middle" font-weight="700" fill="${c3}" stroke="rgba(0,0,0,.35)" stroke-width="${w}" paint-order="stroke"`;
    const font = fontW(2.5);
    let txt = '';
    const name = String(o.name || '').toUpperCase().slice(0, 12), team = String(o.team || '').toUpperCase().slice(0, 14);
    const num = (o.number === '' || o.number == null) ? '' : String(o.number).slice(0, 2);
    if (side === 'front') {
      if (team) { const fs = Math.min(34, 240 / (team.length * 0.5 + 1)); txt += `<text x="150" y="160" font-size="${fs.toFixed(1)}" ${font}>${esc(team)}</text>`; }
      if (num) txt += `<text x="196" y="122" font-size="26" ${font}>${esc(num)}</text>`;
    } else {
      if (name) { const fs = Math.min(40, 200 / (name.length * 0.48 + 0.6)); txt += `<text x="150" y="104" font-size="${fs.toFixed(1)}" ${font}>${esc(name)}</text>`; }
      if (num) txt += `<text x="150" y="232" font-size="120" ${fontW(4)}>${esc(num)}</text>`;
    }
    return `<svg viewBox="0 0 300 320" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Jersey ${side} view"><defs><clipPath id="${id}c"><path d="${BODY}"/></clipPath><linearGradient id="${id}s" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#000" stop-opacity=".22"/><stop offset=".5" stop-color="#fff" stop-opacity=".07"/><stop offset="1" stop-color="#000" stop-opacity=".22"/></linearGradient></defs><g clip-path="url(#${id}c)"><rect width="300" height="340" fill="${c1}"/>${pat}${cuffs}<rect width="300" height="340" fill="url(#${id}s)"/></g>${collar}${txt}<path d="${BODY}" fill="none" stroke="rgba(0,0,0,.28)" stroke-width="2"/></svg>`;
  }
  const dataUrl = o => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg(o));

  /* Resize an uploaded photo in the browser before upload (saves storage + makes pages fast) */
  function resizeImage(file, max, quality) {
    max = max || 1400; quality = quality || 0.85;
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        const s = Math.min(1, max / Math.max(img.width, img.height));
        const w = Math.round(img.width * s), h = Math.round(img.height * s);
        const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
        const ctx = cv.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h); ctx.drawImage(img, 0, 0, w, h);
        URL.revokeObjectURL(url);
        cv.toBlob(b => b ? resolve(b) : reject(new Error('Could not process image')), 'image/jpeg', quality);
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('That file is not an image we can read')); };
      img.src = url;
    });
  }

  const KIDS = ['2-3Y', '4-5Y', '6-7Y', '8-9Y', '10-11Y', '12-13Y'];
  const ADULT = ['S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL', '6XL'];
  const CATEGORIES = { polo: 'Polo collar', round: 'Round neck', kids: 'Kids', combo: 'Combos', track: 'Track pants', other: 'Other' };
  const STATUSES = [
    ['new', 'New', 'Order received — we will message you on WhatsApp'],
    ['confirmed', 'Confirmed', 'Order confirmed, delivery date shared'],
    ['printing', 'Printing', 'Your kit is being printed'],
    ['shipped', 'Shipped', 'On its way to you'],
    ['delivered', 'Delivered', 'Enjoy match day! 🏆'],
    ['cancelled', 'Cancelled', 'This order was cancelled']
  ];
  const waNumber = n => { let d = String(n || '').replace(/\D/g, ''); if (d.length === 10) d = '91' + d; if (d.length === 11 && d[0] === '0') d = '91' + d.slice(1); return d; };
  const waLink = (num, text) => 'https://wa.me/' + waNumber(num) + '?text=' + encodeURIComponent(text);
  const fmtDate = d => { if (!d) return ''; const x = new Date(String(d).length === 10 ? d + 'T00:00:00' : d); return isNaN(x) ? '' : x.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }); };

  window.Jersey = {
    svg, dataUrl, esc, inr, safeUrl, resizeImage, waNumber, waLink, fmtDate,
    PATTERNS: ['sash', 'stripes', 'chevron', 'hoops', 'wave', 'split', 'splash', 'fade'],
    PALETTES: [['#0a1f44','#c6ff1a','#ffffff'],['#ff4d2e','#ffb800','#ffffff'],['#111111','#e63946','#f1faee'],['#006d77','#83c5be','#edf6f9'],['#5a189a','#ff9e00','#ffffff'],['#1b3fa6','#ffd23f','#ffffff'],['#2d6a4f','#95d5b2','#ffffff'],['#7b1e3a','#f4a261','#ffffff']],
    KIDS, ADULT, ALL_SIZES: KIDS.concat(ADULT), CATEGORIES, STATUSES
  };
})();
