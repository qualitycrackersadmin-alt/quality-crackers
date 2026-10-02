document.addEventListener('DOMContentLoaded', async () => {
  const { esc } = App; const $ = (id) => document.getElementById(id);
  const params = new URLSearchParams(location.search);
  const state = { cat: params.get('cat') || '', q: (params.get('q') || '').toLowerCase(), sort: '', shown: 36 };
  let products = [], cats = [];
  try { [products, cats] = await Promise.all([App.products(), App.categories()]); }
  catch (e) { $('grid').innerHTML = '<p class="muted">Could not load products. Please refresh.</p>'; return; }
  const byId = Object.fromEntries(products.map((p) => [p._id, p]));
  const catName = (p) => (cats.find((x) => x._id === (p.categories || [])[0]) || {}).name || '';
  const count = (x) => products.filter((p) => (p.categories || []).includes(x._id)).length;

  function side() {
    $('side').innerHTML = `<a href="?" data-cat="" class="${state.cat ? '' : 'on'}">All crackers <small>${products.length}</small></a>` +
      cats.map((x) => `<a href="?cat=${encodeURIComponent(x.slug)}" data-cat="${esc(x.slug)}" class="${state.cat === x.slug ? 'on' : ''}">${esc(x.name)} <small>${count(x)}</small></a>`).join('');
  }
  function filtered() {
    const cur = cats.find((x) => x.slug === state.cat);
    let list = products.filter((p) => (!cur || (p.categories || []).includes(cur._id)) && (!state.q || p.name.toLowerCase().includes(state.q)));
    if (state.sort) list = [...list].sort((a, b) => (state.sort === 'asc' ? a.price - b.price : b.price - a.price));
    return { cur, list };
  }
  function render(reset) {
    if (reset) state.shown = 36;
    const { cur, list } = filtered();
    const t = cur ? cur.name : state.q ? `Results for “${state.q}”` : 'All crackers';
    $('title').textContent = t; $('crumb').textContent = t; document.title = t + ' – ' + document.title.split(' – ').pop();
    $('count').textContent = `${list.length} item${list.length === 1 ? '' : 's'}`;
    $('grid').innerHTML = list.length ? list.slice(0, state.shown).map((p) => App.card(p, catName(p))).join('') : '<p class="muted">Nothing matches. Try another search or category.</p>';
    $('more').hidden = list.length <= state.shown;
    $('more').textContent = `Show more (${list.length - state.shown} left)`;
  }
  function bar() {
    const n = App.cart.count(); $('bar').hidden = !n;
    $('bar-text').textContent = `${n} item${n === 1 ? '' : 's'} · ${App.money(App.cart.total())}`;
  }
  $('side').addEventListener('click', (e) => {
    const a = e.target.closest('a[data-cat]'); if (!a) return; e.preventDefault();
    state.cat = a.dataset.cat; state.q = ''; side(); render(true);
    history.replaceState(null, '', state.cat ? `?cat=${encodeURIComponent(state.cat)}` : location.pathname);
    const on = $('side').querySelector('.on'); if (on) on.scrollIntoView({ inline: 'center', block: 'nearest' });
  });
  $('sort').addEventListener('change', (e) => { state.sort = e.target.value; render(true); });
  $('more').addEventListener('click', () => { state.shown += 36; render(); });
  App.bindCards($('grid'), (id) => byId[id]);
  document.addEventListener('cart:change', bar);
  side(); render(); bar();
  const on = $('side').querySelector('.on'); if (on && state.cat) on.scrollIntoView({ inline: 'center', block: 'nearest' });
});