const express = require('express');
const Image = require('../models/Image');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

// GET /img/:id  (public). Every upload gets a new id, so the file can be cached forever.
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    if (!/^[a-f\d]{24}$/i.test(req.params.id)) return res.status(404).end();
    const img = await Image.findById(req.params.id); // not .lean(): we want a real Buffer back
    if (!img) return res.status(404).end();
    res.set({
      'Content-Type': img.contentType,
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
    });
    res.send(img.data);
  })
);

module.exports = router;