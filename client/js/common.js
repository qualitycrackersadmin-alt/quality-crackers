// Shared: API calls (served by this same Express server), cart store, header/footer, product cards.
(function () {
  const App = (window.App = {});
  const KEY = 'crackers_cart_v1';

  App.esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  App.money = (n) => '₹' + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 });

  App.api = async (path, opts = {}) => {
    const res = await fetch('/api' + path, { headers: { 'Content-Type': 'application/json' }, ...opts });
    if (!res.ok) {
      let msg = 'Something went wrong';
      try { msg = (await res.json()).error || msg; } catch (e) {}
      throw new Error(msg);
    }
    return res.json();
  };
  let cfg, prods, cats;
  App.config = () => (cfg ||= App.api('/config').catch(() => ({ shopName: 'Crackers Shop', shopCity: '', whatsappNumber: '' })));
  App.products = () => (prods ||= App.api('/products').then((d) => d.filter((p) => p.isActive !== false)));
  App.categories = () => (cats ||= App.api('/categories'));

  // ---- cart: { [productId]: { id, name, unit, price, image, qty } }
  const read = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } };
  const write = (c) => { try { localStorage.setItem(KEY, JSON.stringify(c)); } catch (e) {} App.refreshBadge(); document.dispatchEvent(new Event('cart:change')); };
  App.cart = {
    all: () => Object.values(read()),
    qty: (id) => (read()[id] || {}).qty || 0,
    set(p, qty) {
      const c = read(); const id = p._id || p.id;
      qty = Math.max(0, Math.min(10000, parseInt(qty, 10) || 0));
      if (qty) c[id] = { id, name: p.name, unit: p.unit, price: p.price, image: p.image || '', qty }; else delete c[id];
      write(c);
    },
    clear: () => write({}),
    count: () => Object.keys(read()).length,
    total: () => Object.values(read()).reduce((s, i) => s + i.price * i.qty, 0),
  };
  App.refreshBadge = () => {
    const b = document.getElementById('badge'); if (!b) return;
    const n = App.cart.count(); b.textContent = n; b.hidden = !n;
  };
  App.toast = (msg) => {
    let t = document.getElementById('toast');
    if (!t) { t = document.createElement('div'); t.id = 'toast'; document.body.appendChild(t); }
    t.textContent = msg; t.className = 'show'; clearTimeout(t._t); t._t = setTimeout(() => (t.className = ''), 1800);
  };

  App.icon = (name) => {
    const n = String(name || '').toLowerCase();
    const map = [['gift', '🎁'], ['sparkler', '✨'], ['flower', '🌸'], ['pot', '🌸'], ['chakkar', '🌀'], ['wheel', '🌀'], ['rocket', '🚀'], ['sky', '🎆'], ['shot', '🎆'], ['kid', '🎈'], ['novelt', '🎈'], ['ring', '🔴'], ['match', '🔥'], ['smoke', '💨'], ['bomb', '💥'], ['sound', '💥'], ['bijili', '💥'], ['chorsa', '💥'], ['garland', '💥'], ['lakshmi', '🪔'], ['star', '⭐'], ['whistl', '🎶']];
    const hit = map.find(([k]) => n.includes(k)); return hit ? hit[1] : '🎇';
  };
  App.waNumber = (n) => { n = String(n).replace(/\D/g, ''); return n.length === 10 ? '91' + n : n; };

  // ---- product card + add/stepper control (shared by home and shop pages)
  App.ctl = (q) => q
    ? `<div class="qty"><button data-d="-1" aria-label="Less">−</button><input type="number" min="0" max="10000" value="${q}" aria-label="Quantity"><button data-d="1" aria-label="More">+</button></div>`
    : '<button class="btn btn-add" data-d="1">Add</button>';
  App.card = (p, catName) => `<article class="pc" data-id="${p._id}">
    <div class="pimg"><span>${App.icon(p.name + ' ' + (catName || ''))}</span>${p.image ? `<img src="${App.esc(p.image)}" alt="${App.esc(p.name)}" loading="lazy">` : ''}</div>
    <div class="pb"><h3>${App.esc(p.name)}</h3><div class="pu">per ${App.esc(p.unit || 'Box')}</div>
    <div class="pf"><b>${App.money(p.price)}</b><div class="ctl">${App.ctl(App.cart.qty(p._id))}</div></div></div></article>`;
  App.bindCards = (root, findProduct) => {
    const upd = (card, qty) => {
      const p = findProduct(card.dataset.id); if (!p) return;
      App.cart.set(p, qty);
      card.querySelector('.ctl').innerHTML = App.ctl(App.cart.qty(p._id));
      if (qty > 0 && !card.dataset.t) { card.dataset.t = 1; App.toast(`${p.name} added to cart`); setTimeout(() => delete card.dataset.t, 1500); }
    };
    root.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-d]'); if (!b) return;
      const card = b.closest('.pc'); upd(card, App.cart.qty(card.dataset.id) + Number(b.dataset.d));
    });
    root.addEventListener('change', (e) => { if (e.target.matches('.qty input')) upd(e.target.closest('.pc'), e.target.value); });
  };

  document.addEventListener('error', (e) => { if (e.target.tagName === 'IMG') e.target.style.display = 'none'; }, true);

  document.addEventListener('DOMContentLoaded', async () => {
    const page = document.body.dataset.page;
    const q = new URLSearchParams(location.search).get('q') || '';
    const h = document.getElementById('site-header');
    if (h) h.innerHTML = `<div class="ann">🪔 Fill your cart, share your details, confirm on WhatsApp</div>
<header class="top"><div class="wrap nav"><a class="logo" href="/"><i class="flame"></i><span id="logo">Crackers</span></a>
<form class="search" action="/products.html" role="search"><input name="q" type="search" value="${App.esc(q)}" placeholder="Search crackers…" aria-label="Search"><button aria-label="Search">🔍</button></form>
<nav><a href="/"${page === 'home' ? ' class="on"' : ''}>Home</a><a href="/products.html"${page === 'products' ? ' class="on"' : ''}>Shop</a><a class="pill${page === 'cart' ? ' on' : ''}" href="/cart.html">🛒 <span class="lbl">Cart</span> <span id="badge" hidden>0</span></a></nav></div>
<div class="catnav"><div class="wrap" id="catnav"></div></div></header>`;
    App.refreshBadge();
    document.addEventListener('cart:change', App.refreshBadge);

    const c = await App.config();
    document.title = document.title.replace('Crackers', c.shopName);
    const logo = document.getElementById('logo'); if (logo) logo.textContent = c.shopName;
    const f = document.getElementById('site-footer');
    if (f) f.innerHTML = `<footer><div class="wrap"><b>${App.esc(c.shopName)}</b>${c.shopCity ? ' · ' + App.esc(c.shopCity) : ''}<p class="small">Prices are confirmed by the shop on WhatsApp. No online payment on this website.</p></div></footer>`;
    if (c.whatsappNumber) {
      const a = document.createElement('a');
      a.className = 'wa-float'; a.href = `https://wa.me/${App.waNumber(c.whatsappNumber)}`; a.target = '_blank'; a.rel = 'noopener'; a.setAttribute('aria-label', 'Chat on WhatsApp'); a.textContent = 'WhatsApp';
      document.body.appendChild(a);
    }
    try {
      const list = await App.categories(); const nav = document.getElementById('catnav');
      if (nav) nav.innerHTML = list.map((x) => `<a href="/products.html?cat=${encodeURIComponent(x.slug)}">${App.esc(x.name)}</a>`).join('');
    } catch (e) {}
  });
})();