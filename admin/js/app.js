(() => {
'use strict';
const $ = (s, r = document) => r.querySelector(s);
const STATUSES = ['new', 'contacted', 'confirmed', 'closed'];
const inr = (n) => '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
const when = (d) => new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
const ref = (l) => String(l._id).slice(-6).toUpperCase();

// Safe DOM builder: everything goes in as text, never as HTML (leads are customer-supplied)
function h(tag, a = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(a)) {
    if (v == null || v === false || k === 'value' || k === 'checked') continue;
    if (k === 'class') e.className = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat()) if (c != null && c !== false) e.append(c.nodeType ? c : document.createTextNode(c));
  if (a.value != null) e.value = a.value;
  if (a.checked) e.checked = true;
  return e;
}

/* ---------- api + auth ---------- */
let token = sessionStorage.getItem('adm_token');
async function api(path, o = {}) {
  const r = await fetch('/api' + path, {
    method: o.method || 'GET',
    headers: { ...(token ? { Authorization: 'Bearer ' + token } : {}), ...(o.body ? { 'Content-Type': 'application/json' } : {}) },
    body: o.form || (o.body ? JSON.stringify(o.body) : undefined),
  });
  if (r.status === 401 && !o.login) { logout(); throw new Error('Session expired, please sign in again'); }
  if (o.raw && r.ok) return r;
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || d.message || 'Request failed (' + r.status + ')');
  return d;
}
function toast(msg, bad) {
  const t = h('div', { class: 'toast' + (bad ? ' bad' : '') }, msg);
  $('#toasts').append(t);
  setTimeout(() => t.remove(), 3500);
}
const guard = (fn) => async (...a) => { try { await fn(...a); } catch (e) { toast(e.message, true); } };

function logout() {
  token = null; sessionStorage.removeItem('adm_token');
  $('#app').hidden = true; $('#login').hidden = false;
}
$('#logout').onclick = logout;
$('#login-form').onsubmit = async (e) => {
  e.preventDefault();
  const f = e.target, err = $('#login-err'), btn = $('button', f);
  err.hidden = true; btn.disabled = true;
  try {
    const d = await api('/auth/login', { method: 'POST', login: true, body: { username: f.username.value, password: f.password.value } });
    token = d.token; sessionStorage.setItem('adm_token', token); f.password.value = '';
    $('#who').textContent = 'Signed in as ' + d.username;
    start();
  } catch (x) { err.textContent = x.message; err.hidden = false; }
  btn.disabled = false;
};

/* ---------- small ui helpers ---------- */
function modal(title, body) {
  const close = () => ov.remove();
  const ov = h('div', { class: 'ov', onclick: (e) => e.target === ov && close() },
    h('div', { class: 'modal', role: 'dialog' }, h('div', { class: 'head' }, h('h2', {}, title), h('button', { class: 'x', onclick: close, 'aria-label': 'Close' }, '×')), body));
  document.body.append(ov);
  return close;
}
const debounce = (fn, ms = 350) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
const tag = (s) => h('span', { class: 'tag s-' + s }, s);
const pager = (st, total, pages, go) => h('div', { class: 'pager' }, h('span', { class: 'muted small' }, total + ' total · page ' + st.page + ' of ' + pages),
  h('div', { class: 'row' }, h('button', { class: 'btn sm', disabled: st.page <= 1, onclick: () => go(st.page - 1) }, '‹ Prev'), h('button', { class: 'btn sm', disabled: st.page >= pages, onclick: () => go(st.page + 1) }, 'Next ›')));
const select = (opts, val, attrs = {}) => h('select', { ...attrs, value: val }, opts.map(([v, t]) => h('option', { value: v }, t)));

/* ---------- dashboard ---------- */
async function dashboard(v) {
  const s = await api('/admin/stats');
  const max = Math.max(1, ...s.days.map((d) => d.count));
  const totalLeads = Math.max(1, s.totals.leads);
  const stat = (l, val) => h('div', { class: 'card stat' }, h('span', {}, l), h('b', {}, val));
  v.append(
    h('div', { class: 'head' }, h('h1', {}, 'Dashboard')),
    h('div', { class: 'stats' },
      stat('Total leads', s.totals.leads), stat('Today', s.today), stat('Last 7 days', s.week),
      stat('Enquiry value', inr(s.totals.value)), stat('Confirmed value', inr(s.totals.confirmedValue)),
      stat('Active products', s.products.active + ' / ' + s.products.total)),
    h('div', { class: 'grid2' },
      h('div', { class: 'card' }, h('h2', {}, 'Leads – last 14 days'),
        h('div', { class: 'bars' }, s.days.map((d) => h('div', { class: 'bar', title: d.date + ': ' + d.count },
          h('em', {}, d.count || ''), h('i', { style: 'height:' + (d.count / max) * 100 + '%' }), d.date.slice(8) + '/' + d.date.slice(5, 7))))),
      h('div', { class: 'card' }, h('h2', {}, 'By status'),
        Object.entries(s.byStatus).map(([k, o]) => h('div', {}, h('div', { class: 'srow' }, h('span', {}, k), h('span', {}, o.count + ' · ' + inr(o.value))),
          h('div', { class: 'track' }, h('i', { style: 'width:' + (o.count / totalLeads) * 100 + '%' })))))),
    h('div', { class: 'card tw' }, h('div', { style: 'padding:16px 16px 6px' }, h('h2', {}, 'Most requested products')),
      s.top.length ? h('table', {}, h('thead', {}, h('tr', {}, h('th', {}, 'Product'), h('th', { class: 'num' }, 'Leads'), h('th', { class: 'num' }, 'Qty'), h('th', { class: 'num' }, 'Value'))),
        h('tbody', {}, s.top.map((t) => h('tr', {}, h('td', {}, t.name), h('td', { class: 'num' }, t.leads), h('td', { class: 'num' }, t.qty + ' ' + (t.unit || '')), h('td', { class: 'num' }, inr(t.value)))))) : h('div', { class: 'empty' }, 'No enquiries yet')));
}

/* ---------- leads ---------- */
const L = { page: 1, q: '', status: '', from: '', to: '' };
const leadQS = (extra = {}) => new URLSearchParams(Object.entries({ ...L, ...extra }).filter(([, x]) => x !== '' && x != null));
const dayStart = (d) => d && new Date(d + 'T00:00:00').toISOString();
const dayEnd = (d) => d && new Date(d + 'T23:59:59.999').toISOString();

async function leads(v) {
  const body = h('div');
  const load = guard(async () => {
    const qs = leadQS({ from: dayStart(L.from), to: dayEnd(L.to), limit: 20 });
    const d = await api('/admin/leads?' + qs);
    body.replaceChildren(d.leads.length ? h('div', { class: 'card tw' }, h('table', {},
      h('thead', {}, h('tr', {}, ['Ref', 'Date', 'Customer', 'Items'].map((x) => h('th', {}, x)), h('th', { class: 'num' }, 'Total'), h('th', {}, 'Status'), h('th', {}))),
      h('tbody', {}, d.leads.map((l) => h('tr', {},
        h('td', {}, '#' + ref(l)), h('td', {}, when(l.createdAt)),
        h('td', {}, h('b', {}, l.customer.name), h('div', { class: 'muted small' }, l.customer.phone + (l.customer.city ? ' · ' + l.customer.city : ''))),
        h('td', {}, l.items.length), h('td', { class: 'num' }, inr(l.total)), h('td', {}, tag(l.status)),
        h('td', { class: 'num' }, h('button', { class: 'btn sm', onclick: () => leadModal(l, load) }, 'View'))))))) : h('div', { class: 'card empty' }, 'No leads match'),
      pager(L, d.total, d.pages, (p) => { L.page = p; load(); }));
  });
  const set = (k) => (e) => { L[k] = e.target.value.trim(); L.page = 1; load(); };
  v.append(
    h('div', { class: 'head' }, h('h1', {}, 'Leads'),
      h('button', { class: 'btn', onclick: guard(async () => {
        const r = await api('/admin/leads/export.csv?' + leadQS({ page: '', from: dayStart(L.from), to: dayEnd(L.to) }), { raw: true });
        const a = h('a', { href: URL.createObjectURL(await r.blob()), download: 'leads.csv' });
        a.click(); URL.revokeObjectURL(a.href);
      }) }, '⬇ Export CSV')),
    h('div', { class: 'filters' },
      h('input', { type: 'search', placeholder: 'Search name, phone, city…', value: L.q, oninput: debounce(set('q')) }),
      select([['', 'All statuses'], ...STATUSES.map((s) => [s, s])], L.status, { onchange: set('status') }),
      h('input', { type: 'date', value: L.from, onchange: set('from'), 'aria-label': 'From date' }),
      h('input', { type: 'date', value: L.to, onchange: set('to'), 'aria-label': 'To date' }),
      h('button', { class: 'btn', onclick: () => { Object.assign(L, { page: 1, q: '', status: '', from: '', to: '' }); route(); } }, 'Reset')),
    body);
  await load();
}

function leadModal(l, reload) {
  const st = select(STATUSES.map((s) => [s, s]), l.status);
  const notes = h('textarea', { rows: 3, maxlength: 1000, placeholder: 'Private notes…', value: l.notes || '' });
  const wa = 'https://wa.me/91' + l.customer.phone;
  const close = modal('Lead #' + ref(l), h('div', {},
    h('dl', { class: 'kv' },
      h('dt', {}, 'Name'), h('dd', {}, l.customer.name),
      h('dt', {}, 'Phone'), h('dd', {}, h('a', { href: 'tel:' + l.customer.phone }, l.customer.phone), ' · ', h('a', { href: wa, target: '_blank', rel: 'noopener' }, 'WhatsApp ↗')),
      l.customer.email && [h('dt', {}, 'Email'), h('dd', {}, l.customer.email)],
      l.customer.city && [h('dt', {}, 'City'), h('dd', {}, l.customer.city)],
      h('dt', {}, 'Received'), h('dd', {}, when(l.createdAt))),
    h('div', { class: 'card tw', style: 'box-shadow:none;margin-bottom:12px' }, h('table', {},
      h('thead', {}, h('tr', {}, h('th', {}, 'Item'), h('th', { class: 'num' }, 'Qty'), h('th', { class: 'num' }, 'Amount'))),
      h('tbody', {}, l.items.map((i) => h('tr', {}, h('td', {}, i.name, h('div', { class: 'muted small' }, (i.sno ? 'S.No ' + i.sno + ' · ' : '') + inr(i.price) + ' / ' + (i.unit || 'unit'))), h('td', { class: 'num' }, i.qty), h('td', { class: 'num' }, inr(i.price * i.qty)))),
        h('tr', {}, h('td', {}, h('b', {}, 'Total')), h('td'), h('td', { class: 'num' }, h('b', {}, inr(l.total))))))),
    h('label', {}, 'Status', st), h('label', {}, 'Notes', notes),
    h('div', { class: 'row' },
      h('button', { class: 'btn primary', onclick: guard(async () => {
        await api('/admin/leads/' + l._id, { method: 'PATCH', body: { status: st.value, notes: notes.value } });
        toast('Lead updated'); close(); reload();
      }) }, 'Save'),
      h('span', { class: 'grow' }),
      h('button', { class: 'btn danger', onclick: guard(async () => {
        if (!confirm('Delete this lead permanently?')) return;
        await api('/admin/leads/' + l._id, { method: 'DELETE' }); toast('Lead deleted'); close(); reload();
      }) }, 'Delete'))));
}

/* ---------- products ---------- */
const P = { page: 1, q: '', category: '', active: '' };
let cats = [];

async function products(v) {
  cats = await api('/admin/categories');
  const catName = new Map(cats.map((c) => [c._id, c.name]));
  const body = h('div');
  const load = guard(async () => {
    const d = await api('/admin/products?' + new URLSearchParams(Object.entries({ ...P, limit: 20 }).filter(([, x]) => x !== '')));
    body.replaceChildren(d.products.length ? h('div', { class: 'card tw' }, h('table', {},
      h('thead', {}, h('tr', {}, h('th', {}), h('th', {}, 'Product'), h('th', {}, 'Categories'), h('th', { class: 'num' }, 'Price'), h('th', {}, 'Active'), h('th', {}))),
      h('tbody', {}, d.products.map((p) => h('tr', { class: p.isActive ? '' : 'off' },
        h('td', {}, p.image ? h('img', { class: 'thumb', src: p.image, alt: '', loading: 'lazy' }) : h('div', { class: 'thumb' })),
        h('td', {}, h('b', {}, p.name), p.isFeatured && ' ⭐', p.isGiftBox && ' 🎁'),
        h('td', { class: 'small muted' }, (p.categories || []).map((c) => catName.get(c)).filter(Boolean).join(', ') || '—'),
        h('td', { class: 'num' }, inr(p.price) + ' / ' + p.unit),
        h('td', {}, h('input', { type: 'checkbox', checked: p.isActive, 'aria-label': 'Active', onchange: guard(async (e) => {
          try { await api('/admin/products/' + p._id, { method: 'PATCH', body: { isActive: e.target.checked } }); load(); }
          catch (x) { e.target.checked = !e.target.checked; throw x; }
        }) })),
        h('td', { class: 'num' }, h('button', { class: 'btn sm', onclick: () => productModal(p, load) }, 'Edit'))))))) : h('div', { class: 'card empty' }, 'No products found'),
      pager(P, d.total, d.pages, (n) => { P.page = n; load(); }));
  });
  const set = (k) => (e) => { P[k] = e.target.value.trim(); P.page = 1; load(); };
  v.append(
    h('div', { class: 'head' }, h('h1', {}, 'Products'), h('button', { class: 'btn primary', onclick: () => productModal(null, load) }, '+ Add product')),
    h('div', { class: 'filters p' },
      h('input', { type: 'search', placeholder: 'Search products…', value: P.q, oninput: debounce(set('q')) }),
      select([['', 'All categories'], ...cats.map((c) => [c._id, c.name])], P.category, { onchange: set('category') }),
      select([['', 'Any status'], ['true', 'Active'], ['false', 'Hidden']], P.active, { onchange: set('active') })),
    body);
  await load();
}

function productModal(p, reload) {
  const f = {
    name: h('input', { required: true, maxlength: 200, value: p?.name || '' }),
    price: h('input', { type: 'number', min: 0, step: '0.01', required: true, value: p?.price ?? '' }),
    unit: h('input', { maxlength: 30, value: p?.unit || 'Box' }),
    image: h('input', { placeholder: 'Paste a Google Drive link, or upload a photo', value: p?.image || '' }),
  };
  const flag = (k, t, def) => h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: p ? p[k] : def }), t);
  const flags = { isActive: flag('isActive', 'Visible in shop', true), isFeatured: flag('isFeatured', 'Featured on home'), isGiftBox: flag('isGiftBox', 'Gift box') };
  const picked = new Set((p?.categories || []).map(String));
  const catBox = h('div', { class: 'cats' }, cats.map((c) => h('label', { class: 'chk' }, h('input', { type: 'checkbox', value: c._id, checked: picked.has(String(c._id)) }), c.name)));
  const preview = h('img', { class: 'thumb', alt: '', style: 'width:64px;height:64px', src: p?.image || '' });
  // Google Drive share links are converted to a direct image URL as soon as they are pasted
  const driveId = (u) => { try { const x = new URL(u); return x.hostname === 'drive.google.com' ? (x.pathname.match(/\/file\/d\/([\w-]+)/) || [])[1] || x.searchParams.get('id') : null; } catch { return null; } };
  f.image.oninput = () => {
    const id = driveId(f.image.value.trim());
    if (id) f.image.value = 'https://lh3.googleusercontent.com/d/' + id;
    preview.src = f.image.value;
  };
  const file = h('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp', hidden: true });
  const upBtn = h('button', { class: 'btn sm', type: 'button', onclick: () => file.click() }, '⬆ Upload photo');
  file.onchange = guard(async () => {
    const img = file.files[0];
    if (!img) return;
    if (img.size > 5 * 1024 * 1024) { file.value = ''; throw new Error('Image must be under 5 MB'); }
    const fd = new FormData(); fd.append('image', img);
    upBtn.disabled = true; upBtn.textContent = 'Uploading…';
    try { const d = await api('/admin/upload', { method: 'POST', form: fd }); f.image.value = d.url; preview.src = d.url; toast('Photo uploaded – click Save'); }
    finally { upBtn.disabled = false; upBtn.textContent = '⬆ Upload photo'; file.value = ''; }
  });
  const err = h('p', { class: 'err', hidden: true });

  const close = modal(p ? 'Edit product' : 'Add product', h('form', {
    onsubmit: guard(async (e) => {
      e.preventDefault(); err.hidden = true;
      const body = {
        name: f.name.value.trim(), price: Number(f.price.value), unit: f.unit.value.trim() || 'Box', image: f.image.value.trim(),
        categories: [...catBox.querySelectorAll('input:checked')].map((i) => i.value),
        isActive: $('input', flags.isActive).checked, isFeatured: $('input', flags.isFeatured).checked, isGiftBox: $('input', flags.isGiftBox).checked,
      };
      try { await api('/admin/products' + (p ? '/' + p._id : ''), { method: p ? 'PATCH' : 'POST', body }); }
      catch (x) { err.textContent = x.message; err.hidden = false; return; }
      toast(p ? 'Product saved' : 'Product added'); close(); reload();
    }),
  },
    h('label', {}, 'Name', f.name),
    h('div', { class: 'two' }, h('label', {}, 'Price (₹)', f.price), h('label', {}, 'Unit', f.unit)),
    h('div', { class: 'row', style: 'align-items:flex-end' }, h('label', { class: 'grow' }, 'Image URL or path', f.image), h('div', { style: 'margin-bottom:12px;display:grid;gap:6px;justify-items:center' }, preview, upBtn, file)),
    h('div', { class: 'small', style: 'font-weight:600;margin-bottom:4px' }, 'Categories'), catBox,
    h('div', { class: 'row', style: 'margin-bottom:12px' }, Object.values(flags)), err,
    h('div', { class: 'row' },
      h('button', { class: 'btn primary', type: 'submit' }, 'Save'),
      h('span', { class: 'grow' }),
      p && h('button', { class: 'btn danger', type: 'button', onclick: guard(async () => {
        if (!confirm('Delete "' + p.name + '"? Old leads keep their own copy.')) return;
        await api('/admin/products/' + p._id, { method: 'DELETE' }); toast('Product deleted'); close(); reload();
      }) }, 'Delete'))));
}

/* ---------- router ---------- */
const views = { dashboard, leads, products };
async function route() {
  if (!token) return;
  const name = (location.hash.match(/^#\/(\w+)/) || [])[1];
  if (!views[name]) { location.hash = '#/dashboard'; return; }
  document.querySelectorAll('[data-nav]').forEach((a) => a.classList.toggle('on', a.dataset.nav === name));
  const v = $('#view');
  v.replaceChildren();
  try { await views[name](v); } catch (e) { v.append(h('div', { class: 'card empty' }, e.message)); }
}
window.addEventListener('hashchange', route);

async function start() {
  $('#login').hidden = true; $('#app').hidden = false;
  route();
}
(async () => {
  if (!token) return logout();
  try { const me = await api('/auth/me'); $('#who').textContent = 'Signed in as ' + me.username; start(); }
  catch { logout(); }
})();
})();