const { Schema, model } = require('mongoose');

const categorySchema = new Schema(
  {
    name: { type: String, required: true, trim: true, unique: true, maxlength: 120 },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = model('Category', categorySchema);
