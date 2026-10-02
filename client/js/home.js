document.addEventListener('DOMContentLoaded', async () => {
  const { esc } = App; const $ = (id) => document.getElementById(id);
  const c = await App.config(); $('shop-name').textContent = c.shopName;
  let products = [], cats = [];
  try { [products, cats] = await Promise.all([App.products(), App.categories()]); }
  catch (e) { $('gifts').innerHTML = '<p class="muted">Could not load products. Please refresh.</p>'; return; }
  const byId = Object.fromEntries(products.map((p) => [p._id, p]));
  const catOf = (p) => (cats.find((x) => x._id === (p.categories || [])[0]) || {}).name || '';

  $('feats').innerHTML = [['🪔', `${products.length}+ crackers`, 'Full Sivakasi price list'], ['🗂️', `${cats.length} categories`, 'Easy to browse'], ['🎁', 'Gift boxes', 'Ready packs, fixed prices'], ['💬', 'Order on WhatsApp', 'We confirm everything']]
    .map(([i, t, s]) => `<div class="feat"><span>${i}</span><div><b>${t}</b><small>${s}</small></div></div>`).join('');

  const boxes = products.filter((p) => p.isGiftBox).sort((a, b) => a.price - b.price);
  $('gifts').innerHTML = boxes.length ? boxes.map((p) => App.card(p, 'gift')).join('') : '<p class="muted">Gift boxes will appear here soon.</p>';

  $('cats').innerHTML = cats.map((x) => {
    const first = products.find((p) => p.image && (p.categories || []).includes(x._id));
    return `<a class="tile" href="/products.html?cat=${encodeURIComponent(x.slug)}"><div class="timg"><span>${App.icon(x.name)}</span>${first ? `<img src="${esc(first.image)}" alt="" loading="lazy">` : ''}</div><b>${esc(x.name)}</b></a>`;
  }).join('');

  const picks = [];
  for (const x of cats) { const p = products.find((q) => q.image && !q.isGiftBox && (q.categories || [])[0] === x._id && q.price >= 60); if (p && !picks.includes(p)) picks.push(p); if (picks.length === 10) break; }
  $('picks').innerHTML = picks.map((p) => App.card(p, catOf(p))).join('');

  App.bindCards($('gifts'), (id) => byId[id]); App.bindCards($('picks'), (id) => byId[id]);
});