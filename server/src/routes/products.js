const express = require('express');
const Category = require('../models/Category');
const Product = require('../models/Product');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

// GET /api/products
//  optional filters:  ?category=<slug>  ?giftBox=true  ?featured=true
// Returns every active product in price-list order. "categories" holds category ids.
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const filter = { isActive: true };
    if (req.query.giftBox === 'true') filter.isGiftBox = true;
    if (req.query.featured === 'true') filter.isFeatured = true;

    if (req.query.category) {
      // String() so a crafted ?category[$ne]=x cannot inject a Mongo operator
      const category = await Category.findOne({ slug: String(req.query.category), isActive: true }).select('_id');
      if (!category) return res.json([]);
      filter.categories = category._id;
    }

    const products = await Product.find(filter)
      .sort({ sortOrder: 1, name: 1 })
      .select('name slug categories price unit image isGiftBox isFeatured isActive sno')
      .lean();
    res.set('Cache-Control', 'no-cache');
    res.json(products);
  })
);

module.exports = router;
