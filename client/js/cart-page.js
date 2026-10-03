// Cart page: step 1 review cart -> step 2 customer details -> save to DB (POST /api/leads) -> WhatsApp.
document.addEventListener('DOMContentLoaded', async () => {
  const { esc, money } = App; const $ = (id) => document.getElementById(id);
  const cfg = await App.config();
  const CUST = 'crackers_customer_v1';
  let step = 1, sending = false;

  function setStep(n) {
    step = n;
    $('summary').hidden = n !== 1; $('form').hidden = n !== 2;
    $('s1').className = n === 1 ? 'on' : 'ok'; $('s2').className = n === 2 ? 'on' : ''; $('s3').className = '';
    if (n === 2) { $('form').scrollIntoView({ behavior: 'smooth', block: 'center' }); $('form').name.focus({ preventScroll: true }); }
  }

  function render() {
    const items = App.cart.all();
    $('empty').hidden = !!items.length || !$('done').hidden;
    $('filled').hidden = !items.length;
    if (!items.length) return;
    $('items').innerHTML = items.map((i) => `<div class="item" data-id="${i.id}">
      <div class="ithumb"><span>🎇</span>${i.image ? `<img src="${esc(i.image)}" alt="">` : ''}</div>
      <div class="pname">${esc(i.name)}<small>${money(i.price)} per ${esc(i.unit || 'Box')}</small></div>
      <div class="qty"><button type="button" data-d="-1" aria-label="Less">−</button><input type="number" min="1" max="10000" value="${i.qty}" aria-label="Quantity"><button type="button" data-d="1" aria-label="More">+</button></div>
      <div class="line">${money(i.price * i.qty)}</div><button type="button" class="x" data-rm aria-label="Remove ${esc(i.name)}">✕</button></div>`).join('');
    document.querySelectorAll('.tv').forEach((e) => (e.textContent = money(App.cart.total())));
    $('cnt').textContent = `${items.length} item${items.length === 1 ? '' : 's'}`;
  }
  const update = (id, qty) => { const it = App.cart.all().find((x) => x.id === id); if (it) App.cart.set(it, qty); render(); };
  $('items').addEventListener('click', (e) => {
    const r = e.target.closest('.item'); if (!r) return; const id = r.dataset.id;
    if (e.target.closest('[data-rm]')) return update(id, 0);
    const b = e.target.closest('button[data-d]'); if (b) update(id, App.cart.qty(id) + Number(b.dataset.d));
  });
  $('items').addEventListener('change', (e) => { if (e.target.matches('input')) update(e.target.closest('.item').dataset.id, e.target.value); });

  $('proceed').addEventListener('click', () => App.cart.count() && setStep(2));
  $('form').addEventListener('input', () => { $('err').textContent = ''; });
  $('back').addEventListener('click', () => setStep(1));

  // prefill details from last time on this device
  try { const c = JSON.parse(localStorage.getItem(CUST)); if (c) for (const k of ['name', 'phone', 'email', 'city']) if (c[k]) $('form')[k].value = c[k]; } catch (e) {}

  // S.No of each product (not shown on the site, only added to the WhatsApp message)
  const snoById = {};
  const snoReady = App.products().then((ps) => ps.forEach((p) => (snoById[p._id] = p.sno))).catch(() => {});

  const message = (c, items, total, ref) =>
    `Hello ${cfg.shopName}, I would like to order these crackers${ref ? ` (Ref #${ref})` : ''}:\n\n` +
    items.map((i, n) => `${n + 1}. ${snoById[i.id] ? `[S.No ${snoById[i.id]}] ` : ''}${i.name} - ${i.qty} ${i.unit || 'Box'} x ${money(i.price)} = ${money(i.qty * i.price)}`).join('\n') +
    `\n\nTotal: ${money(total)}\n\nName: ${c.name}\nPhone: ${c.phone}\nEmail: ${c.email}${c.city ? '\nCity: ' + c.city : ''}`;
  const waLink = (c, items, total, ref) => `https://wa.me/${App.waNumber(cfg.whatsappNumber)}?text=${encodeURIComponent(message(c, items, total, ref))}`;

  $('form').addEventListener('submit', async (e) => {
    e.preventDefault(); if (sending) return;
    const f = e.target; const err = $('err'); err.textContent = ''; $('skip').hidden = true;
    const c = { name: f.name.value.trim(), phone: f.phone.value.replace(/\D/g, ''), email: f.email.value.trim(), city: f.city.value.trim() };
    if (!c.name) return (err.textContent = 'Please enter your name.');
    if (!/^[6-9]\d{9}$/.test(c.phone)) return (err.textContent = 'Enter a valid 10-digit mobile number.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email)) return (err.textContent = 'Enter a valid email address.');
    const items = App.cart.all(); const total = App.cart.total();
    if (!items.length) return;
    if (!cfg.whatsappNumber) return (err.textContent = 'The shop WhatsApp number is not set up yet.');

    const btn = f.querySelector('button[type=submit]'); sending = true; btn.disabled = true; btn.textContent = 'Saving…';
    try {
      const res = await App.api('/leads', { method: 'POST', body: JSON.stringify({ customer: c, items: items.map((i) => ({ product: i.id, qty: i.qty })) }) });
      try { localStorage.setItem(CUST, JSON.stringify(c)); } catch (x) {}
      await snoReady;
      const url = waLink(c, items, total, res.ref);
      App.cart.clear();
      $('filled').hidden = true; $('empty').hidden = true; $('done').hidden = false;
      $('ref').textContent = '#' + res.ref; $('wa').href = url; window.scrollTo(0, 0);
      setTimeout(() => (location.href = url), 700);
    } catch (ex) {
      err.textContent = (ex.message || 'Could not save your details.') + ' Please try again.';
      const skip = $('skip'); skip.hidden = false; skip.onclick = (ev) => { ev.preventDefault(); location.href = waLink(c, items, total); };
      sending = false; btn.disabled = false; btn.textContent = 'Save & send on WhatsApp';
    }
  });

  render();
});