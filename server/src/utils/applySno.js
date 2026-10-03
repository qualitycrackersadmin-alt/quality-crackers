// Runs once at server start. Fills the Excel S.No on products that don't have one yet
// (from src/data/sno-map.json). Only touches the `sno` field and never overwrites an
// existing value, so it is safe on every restart and needs no shell access on the host.
const Product = require('../models/Product');
const map = require('../data/sno-map.json');

const empty = { $or: [{ sno: { $exists: false } }, { sno: '' }, { sno: null }] };

module.exports = async function applySno() {
  const slugs = Object.keys(map);
  const missing = await Product.countDocuments({ slug: { $in: slugs }, ...empty });
  if (!missing) return;
  let updated = 0;
  for (let i = 0; i < slugs.length; i += 50) {
    const r = await Product.bulkWrite(
      slugs.slice(i, i + 50).map((slug) => ({ updateOne: { filter: { slug, ...empty }, update: { $set: { sno: map[slug] } } } }))
    );
    updated += r.modifiedCount;
  }
  console.log(`S.No added to ${updated} products`);
};
