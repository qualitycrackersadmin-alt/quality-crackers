const express = require('express');
const { z } = require('zod');
const Lead = require('../models/Lead');
const Product = require('../models/Product');
const Category = require('../models/Category');
const asyncHandler = require('../utils/asyncHandler');
const slugify = require('../utils/slugify');
const multer = require('multer');
const sharp = require('sharp');
const Image = require('../models/Image');

// Turns any Google Drive share link into a direct image URL the browser can display
const normalizeImage = (raw) => {
  const v = raw.trim();
  try {
    const u = new URL(v);
    if (u.hostname === 'drive.google.com') {
      const id = (u.pathname.match(/\/file\/d\/([\w-]+)/) || [])[1] || u.searchParams.get('id');
      if (id && /^[\w-]{10,}$/.test(id)) return 'https://lh3.googleusercontent.com/d/' + id;
    }
  } catch { /* not a URL: leave as is */ }
  return v;
};

// deletes a stored photo when a product stops using it (keeps the free 512 MB tidy)
const dropImage = async (url) => {
  const m = /^\/img\/([a-f\d]{24})$/i.exec(url || '');
  if (m) await Image.findByIdAndDelete(m[1]);
};

// Everything here is mounted behind requireAdmin (see routes/index.js).
const router = express.Router();
router.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

const TZ = process.env.TZ_NAME || 'Asia/Kolkata';
const STATUSES = ['new', 'contacted', 'confirmed', 'closed'];
const oid = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');
const dayKey = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(d); // YYYY-MM-DD
const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const pageOf = (q, def = 20) => ({
  page: Math.max(1, parseInt(q.page, 10) || 1),
  limit: Math.min(100, Math.max(1, parseInt(q.limit, 10) || def)),
});

/* ------------------------------------------------------------------ leads */

// ?status=  ?q= (name / phone / email / city / ref)  ?from= ?to= (ISO dates)
function leadFilter(q) {
  const f = {};
  if (STATUSES.includes(q.status)) f.status = q.status;
  const s = String(q.q || '').trim().replace(/^#/, '');
  if (s) {
    const re = new RegExp(escRe(s), 'i');
    f.$or = [{ 'customer.name': re }, { 'customer.phone': re }, { 'customer.email': re }, { 'customer.city': re }, { ref: re }];
  }
  const from = new Date(q.from);
  const to = new Date(q.to);
  if (q.from && !isNaN(from)) f.createdAt = { ...f.createdAt, $gte: from };
  if (q.to && !isNaN(to)) f.createdAt = { ...f.createdAt, $lte: to };
  return f;
}

router.get(
  '/leads',
  asyncHandler(async (req, res) => {
    const { page, limit } = pageOf(req.query);
    const filter = leadFilter(req.query);
    const [total, leads] = await Promise.all([
      Lead.countDocuments(filter),
      Lead.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    ]);
    res.json({ leads, total, page, pages: Math.max(1, Math.ceil(total / limit)) });
  })
);

// CSV download (must be declared before /leads/:id)
router.get(
  '/leads/export.csv',
  asyncHandler(async (req, res) => {
    const rows = await Lead.find(leadFilter(req.query)).sort({ createdAt: -1 }).limit(10000).lean();
    // quote every cell; a leading = + - @ would be run as a formula by Excel, so neutralise it
    const cell = (v) => {
      v = String(v ?? '');
      if (/^[=+\-@\t\r]/.test(v)) v = "'" + v;
      return '"' + v.replace(/"/g, '""') + '"';
    };
    const head = ['Ref', 'Date', 'Status', 'Name', 'Phone', 'Email', 'City', 'Items', 'Total', 'Notes'];
    const lines = rows.map((l) =>
      [
        l.ref,
        new Date(l.createdAt).toLocaleString('en-IN', { timeZone: TZ }),
        l.status,
        l.customer.name,
        l.customer.phone,
        l.customer.email,
        l.customer.city,
        l.items.map((i) => `${i.sno ? '#' + i.sno + ' ' : ''}${i.name} x ${i.qty} ${i.unit || ''}`.trim()).join('; '),
        l.total,
        l.notes,
      ].map(cell).join(',')
    );
    res.set('Content-Type', 'text/csv; charset=utf-8');
    res.set('Content-Disposition', `attachment; filename="leads-${dayKey(new Date())}.csv"`);
    res.send('\ufeff' + [head.map(cell).join(','), ...lines].join('\r\n'));
  })
);

router.get(
  '/leads/:id',
  asyncHandler(async (req, res) => {
    const lead = await Lead.findById(oid.parse(req.params.id)).lean();
    if (!lead) return res.status(404).json({ error: 'Lead not found' });
    res.json(lead);
  })
);

const leadPatch = z.object({ status: z.enum(STATUSES).optional(), notes: z.string().max(1000).optional() });
router.patch(
  '/leads/:id',
  asyncHandler(async (req, res) => {
    const data = leadPatch.parse(req.body);
    const lead = await Lead.findByIdAndUpdate(oid.parse(req.params.id), { $set: data }, { new: true, runValidators: true }).lean();
    if (!lead) return res.status(404).json({ error: 'Lead not found' });
    res.json(lead);
  })
);

router.delete(
  '/leads/:id',
  asyncHandler(async (req, res) => {
    const lead = await Lead.findByIdAndDelete(oid.parse(req.params.id));
    if (!lead) return res.status(404).json({ error: 'Lead not found' });
    res.json({ ok: true });
  })
);

/* ------------------------------------------------------------------ stats */

router.get(
  '/stats',
  asyncHandler(async (req, res) => {
    const [leads, productTotal, productActive] = await Promise.all([
      Lead.find({}).select('createdAt status total items').sort({ createdAt: -1 }).limit(20000).lean(),
      Product.countDocuments({}),
      Product.countDocuments({ isActive: true }),
    ]);

    const byStatus = Object.fromEntries(STATUSES.map((s) => [s, { count: 0, value: 0 }]));
    const perDay = new Map();
    const top = new Map();
    let value = 0;
    for (const l of leads) {
      const s = byStatus[l.status] || (byStatus[l.status] = { count: 0, value: 0 });
      s.count += 1;
      s.value += l.total || 0;
      value += l.total || 0;
      const k = dayKey(l.createdAt);
      perDay.set(k, (perDay.get(k) || 0) + 1);
      for (const i of l.items) {
        const t = top.get(i.name) || { name: i.name, unit: i.unit, leads: 0, qty: 0, value: 0 };
        t.leads += 1;
        t.qty += i.qty;
        t.value += i.price * i.qty;
        top.set(i.name, t);
      }
    }

    const days = [];
    for (let n = 13; n >= 0; n--) {
      const k = dayKey(new Date(Date.now() - n * 864e5));
      days.push({ date: k, count: perDay.get(k) || 0 });
    }

    res.json({
      totals: { leads: leads.length, value, confirmedValue: byStatus.confirmed.value },
      byStatus,
      today: days[13].count,
      week: days.slice(7).reduce((a, d) => a + d.count, 0),
      days,
      top: [...top.values()].sort((a, b) => b.leads - a.leads || b.qty - a.qty).slice(0, 8),
      products: { total: productTotal, active: productActive },
    });
  })
);

/* --------------------------------------------------------------- products */

const productBase = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200),
  price: z.number().min(0, 'Price cannot be negative').max(1000000),
  unit: z.string().trim().min(1).max(30),
  categories: z.array(oid).max(20),
  // images live in client/assets; an external URL or script link is never accepted
  // accepts: empty, a bundled /assets path, an uploaded /img/<id>, or a Google Drive link
  image: z.preprocess(
    (v) => (typeof v === 'string' ? normalizeImage(v) : v),
    z.string().trim().max(300)
      .refine(
        (v) => v === '' || /^\/assets\/[\w\-./]+$/.test(v) || /^\/img\/[a-f\d]{24}$/i.test(v) || /^https:\/\/lh3\.googleusercontent\.com\/d\/[\w-]{10,}$/.test(v),
        'Image must be an uploaded photo or a Google Drive link (shared as "Anyone with the link")'
      )
      .refine((v) => !v.includes('..'), 'Invalid image path')
  ),
  isActive: z.boolean(),
  isFeatured: z.boolean(),
  isGiftBox: z.boolean(),
});

router.get(
  '/categories',
  asyncHandler(async (req, res) => {
    res.json(await Category.find({}).sort({ sortOrder: 1, name: 1 }).lean());
  })
);

router.get(
  '/products',
  asyncHandler(async (req, res) => {
    const { page, limit } = pageOf(req.query, 50);
    const filter = {};
    const s = String(req.query.q || '').trim();
    if (s) filter.name = new RegExp(escRe(s), 'i');
    if (/^[a-f\d]{24}$/i.test(String(req.query.category || ''))) filter.categories = String(req.query.category);
    if (req.query.active === 'true') filter.isActive = true;
    if (req.query.active === 'false') filter.isActive = false;
    const [total, products] = await Promise.all([
      Product.countDocuments(filter),
      Product.find(filter).sort({ sortOrder: 1, name: 1 }).skip((page - 1) * limit).limit(limit).lean(),
    ]);
    res.json({ products, total, page, pages: Math.max(1, Math.ceil(total / limit)) });
  })
);

router.post(
  '/products',
  asyncHandler(async (req, res) => {
    const data = productBase.partial({ unit: true, categories: true, image: true, isActive: true, isFeatured: true, isGiftBox: true }).parse(req.body);
    const base = slugify(data.name) || 'product';
    let slug = base;
    for (let n = 2; await Product.exists({ slug }); n++) slug = `${base}-${n}`;
    const last = await Product.findOne().sort({ sortOrder: -1 }).select('sortOrder').lean();
    const product = await Product.create({
      unit: 'Box', categories: [], image: '', isActive: true, isFeatured: false, isGiftBox: false,
      ...data, slug, sortOrder: (last ? last.sortOrder : 0) + 1,
    });
    res.status(201).json(product);
  })
);

router.patch(
  '/products/:id',
  asyncHandler(async (req, res) => {
    const data = productBase.partial().parse(req.body); // slug is kept so shared links never break
    const id = oid.parse(req.params.id);
    const old = await Product.findById(id).select('image').lean();
    if (!old) return res.status(404).json({ error: 'Product not found' });
    const product = await Product.findByIdAndUpdate(id, { $set: data }, { new: true, runValidators: true }).lean();
    if (data.image !== undefined && data.image !== old.image) await dropImage(old.image);
    res.json(product);
  })
);

router.delete(
  '/products/:id',
  asyncHandler(async (req, res) => {
    const product = await Product.findByIdAndDelete(oid.parse(req.params.id));
    if (!product) return res.status(404).json({ error: 'Product not found' });
    await dropImage(product.image);
    res.json({ ok: true }); // old leads keep their own copy of name and price
  })
);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => cb(null, ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)),
});

// POST /api/admin/upload  (multipart, field "image") -> { url: "/img/<id>" }
router.post(
  '/upload',
  upload.single('image'),
  asyncHandler(async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Choose a JPG, PNG or WebP image under 5 MB' });
    let data;
    try {
      // sharp re-encodes the file, so anything that is not a real image is rejected here
      data = await sharp(req.file.buffer)
        .rotate()
        .resize({ width: 900, height: 900, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 78 })
        .toBuffer();
    } catch {
      return res.status(400).json({ error: 'That file is not a valid image' });
    }
    const img = await Image.create({ data, contentType: 'image/webp', size: data.length });
    res.status(201).json({ url: '/img/' + img._id });
  })
);

module.exports = router;