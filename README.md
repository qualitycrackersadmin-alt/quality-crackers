# Crackers Shop

Diwali crackers catalogue with WhatsApp enquiries and an admin dashboard.

- `client/`  customer website (HTML, CSS, JS)
- `admin/`   admin dashboard (HTML, CSS, JS)
- `server/`  Node.js + Express + MongoDB API (also serves both sites)
- `data/`    source price list (`Crackers_order_form.xlsx`)

## Run locally

```bash
cd server
npm install
cp .env.example .env        # then fill in MONGODB_URI, JWT_SECRET, WHATSAPP_NUMBER...
npm run create-admin -- owner "a-strong-password"
npm run dev
```

Check it works: open http://localhost:3000/api/health  ->  `{"ok":true}`

## Status

- [x] Step 1: server, MongoDB connection, models, security middleware
- [ ] Step 2: import the price list into MongoDB (with images)
- [ ] Step 3: products API + products page
- [ ] Step 4: cart, lead endpoint, WhatsApp message
- [ ] Step 5: admin login + leads dashboard
- [ ] Step 6: admin product management + stats
- [ ] Step 7: deploy
