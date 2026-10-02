const express = require('express');
const Category = require('../models/Category');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

// GET /api/categories  ->  active categories in price-list order
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const categories = await Category.find({ isActive: true })
      .sort({ sortOrder: 1, name: 1 })
      .select('name slug sortOrder isActive')
      .lean();
    // always revalidate (cheap 304 thanks to ETag) so price/category edits show up at once
    res.set('Cache-Control', 'no-cache');
    res.json(categories);
  })
);

module.exports = router;
