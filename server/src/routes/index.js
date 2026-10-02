const express = require('express');
const { shop } = require('../config/env');
const { leadLimiter, loginLimiter } = require('../middleware/rateLimit');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.get('/health', (req, res) => res.json({ ok: true }));

// Public shop details the frontend needs (name, WhatsApp number for wa.me links)
router.get('/config', (req, res) => {
  res.json({
    shopName: shop.name,
    shopCity: shop.city,
    whatsappNumber: shop.whatsappNumber,
  });
});

router.use('/products', require('./products'));
router.use('/categories', require('./categories'));

router.use('/leads', leadLimiter, require('./leads'));

// Next steps will mount here:
router.use('/auth', loginLimiter, require('./auth'));
router.use('/admin', requireAdmin, require('./admin'));

module.exports = router;