const { Schema, model } = require('mongoose');

const productSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 200 },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    // A product can sit in several categories (the price list repeats some items).
    categories: [{ type: Schema.Types.ObjectId, ref: 'Category' }],
    price: { type: Number, required: true, min: 0 },
    unit: { type: String, default: 'Box', trim: true }, // Box, Pkt, Bundle, Set, Pcs...
    image: { type: String, default: '' },
    isActive: { type: Boolean, default: true },
    isFeatured: { type: Boolean, default: false },
    isGiftBox: { type: Boolean, default: false },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true }
);

productSchema.index({ name: 'text' });
productSchema.index({ categories: 1 });
productSchema.index({ isActive: 1, sortOrder: 1 });

module.exports = model('Product', productSchema);
