const { Schema, model } = require('mongoose');

// Name, unit and price are copied from the product when the enquiry is made,
// so later price changes never alter old leads.
const itemSchema = new Schema(
  {
    product: { type: Schema.Types.ObjectId, ref: 'Product' },
    sno: { type: String, trim: true }, // Excel S.No of the product at the time of the enquiry
    name: { type: String, required: true, trim: true },
    unit: { type: String, trim: true },
    price: { type: Number, required: true, min: 0 },
    qty: { type: Number, required: true, min: 1, max: 10000 },
  },
  { _id: false }
);

const leadSchema = new Schema(
  {
    customer: {
      name: { type: String, required: true, trim: true, maxlength: 100 },
      // 10-digit Indian mobile number, stored without the country code
      phone: { type: String, required: true, trim: true, match: /^[6-9]\d{9}$/ },
      email : { type: String, trim: true, lowercase: true },
      city: { type: String, trim: true, maxlength: 100, default: '' },
    },
    items: {
      type: [itemSchema],
      validate: [(items) => items.length > 0, 'At least one item is required'],
    },
    total: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ['new', 'contacted', 'confirmed', 'closed'],
      default: 'new',
    },
    notes: { type: String, default: '', maxlength: 1000 }, // owner's private notes
  },
  { timestamps: true }
);

leadSchema.pre('validate', function (next) {
  const sum = this.items.reduce((acc, item) => acc + item.price * item.qty, 0);
  this.total = Math.round(sum * 100) / 100;
  next();
});

leadSchema.index({ createdAt: -1 });
leadSchema.index({ status: 1, createdAt: -1 });

module.exports = model('Lead', leadSchema);
