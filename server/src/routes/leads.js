const express = require('express');
const { z } = require('zod');
const Lead = require('../models/Lead');
const Product = require('../models/Product');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

const schema = z.object({
  customer: z.object({
    name: z.string().trim().min(1, 'Name is required').max(100),
    phone: z.string().trim().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit mobile number'),
    email: z.string().trim().toLowerCase().email('Enter a valid email address').max(200),
    city: z.string().trim().max(100).optional().default(''),
  }),
  items: z
    .array(z.object({ product: z.string().regex(/^[a-f\d]{24}$/i), qty: z.number().int().min(1).max(10000) }))
    .min(1, 'Your cart is empty')
    .max(150),
});

// POST /api/leads  (public)
// Called when the customer submits the details form on the cart page, BEFORE WhatsApp opens.
// The browser sends product ids + quantities only. Name, unit and price are read from the
// database here, so a customer can never submit a tampered price.
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { customer, items } = schema.parse(req.body);

    // merge duplicate product ids
    const qtyById = new Map();
    for (const i of items) qtyById.set(i.product, (qtyById.get(i.product) || 0) + i.qty);

    const products = await Product.find({ _id: { $in: [...qtyById.keys()] }, isActive: true }).select('name unit price').lean();
    const byId = new Map(products.map((p) => [String(p._id), p]));

    const lines = [];
    for (const [id, qty] of qtyById) {
      const p = byId.get(id);
      if (!p) return res.status(400).json({ error: 'Some items are no longer available. Please refresh the page.' });
      lines.push({ product: p._id, name: p.name, unit: p.unit, price: p.price, qty });
    }

    const lead = await Lead.create({ customer, items: lines });
    res.status(201).json({ ok: true, id: lead._id, ref: String(lead._id).slice(-6).toUpperCase(), total: lead.total });
  })
);

module.exports = router;