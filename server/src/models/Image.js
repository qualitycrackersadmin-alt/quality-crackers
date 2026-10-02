const { Schema, model } = require('mongoose');

// Product photos live here (already resized to small WebP files by the upload route).
const imageSchema = new Schema(
  {
    data: { type: Buffer, required: true },
    contentType: { type: String, default: 'image/webp' },
    size: Number,
  },
  { timestamps: true }
);

module.exports = model('Image', imageSchema);