// Loads data/categories.json and data/products.json (made by tools/extract_price_list.py)
// into MongoDB.
//
//   npm run import-products                 load into the database
//   npm run import-products -- --dry-run    only check the files (no database needed)
//
// Safe to run again: records are matched by slug and updated, never duplicated.
// Fields the owner edits in the dashboard (isActive, isFeatured) are only set the
// first time a product is created, so re-importing will not undo them.
// Products removed from the spreadsheet are NOT deleted; hide them from the dashboard.
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const Category = require('../src/models/Category');
const Product = require('../src/models/Product');

const dryRun = process.argv.includes('--dry-run');
const dataDir = path.join(__dirname, '../../data');
const load = (file) => JSON.parse(fs.readFileSync(path.join(dataDir, file), 'utf8'));

function check(categories, products) {
  const problems = [];
  const catSlugs = new Set(categories.map((c) => c.slug));
  const seen = new Set();

  for (const c of categories) {
    const err = new Category(c).validateSync();
    if (err) problems.push(`Category "${c.name}": ${err.message}`);
  }
  for (const p of products) {
    if (seen.has(p.slug)) problems.push(`Duplicate product slug: ${p.slug}`);
    seen.add(p.slug);
    for (const s of p.categories) {
      if (!catSlugs.has(s)) problems.push(`"${p.name}" uses unknown category "${s}"`);
    }
    // categories are slugs in the file; swap in ids just to run schema validation
    const err = new Product({
      ...p,
      categories: p.categories.map(() => new mongoose.Types.ObjectId()),
    }).validateSync();
    if (err) problems.push(`Product "${p.name}": ${err.message}`);
  }
  return problems;
}

// Writes in small batches. Real MongoDB handles one big bulkWrite fine, but some
// MongoDB-compatible servers stall on very large batches; 50 per batch costs nothing.
async function bulkInChunks(Model, ops, size = 50) {
  const total = { upserted: 0, modified: 0 };
  for (let i = 0; i < ops.length; i += size) {
    const r = await Model.bulkWrite(ops.slice(i, i + size));
    total.upserted += r.upsertedCount;
    total.modified += r.modifiedCount;
  }
  return total;
}

async function main() {
  const categories = load('categories.json');
  const products = load('products.json');

  const problems = check(categories, products);
  if (problems.length) {
    console.error(`Found ${problems.length} problem(s):\n - ${problems.join('\n - ')}`);
    process.exit(1);
  }
  const giftBoxes = products.filter((p) => p.isGiftBox).length;
  const withImage = products.filter((p) => p.image).length;
  console.log(
    `Files OK: ${categories.length} categories, ${products.length} products ` +
      `(${giftBoxes} gift boxes, ${withImage} with pictures)`
  );
  if (dryRun) return console.log('Dry run: nothing was written to the database.');

  const connectDB = require('../src/config/db'); // reads .env, so only loaded for a real run
  await connectDB();

  const catResult = await bulkInChunks(
    Category,
    categories.map((c) => ({
      updateOne: {
        filter: { slug: c.slug },
        update: { $set: { name: c.name, sortOrder: c.sortOrder }, $setOnInsert: { isActive: true } },
        upsert: true,
      },
    }))
  );

  const idBySlug = Object.fromEntries(
    (await Category.find({ slug: { $in: categories.map((c) => c.slug) } }).select('slug')).map((c) => [c.slug, c._id])
  );

  const prodResult = await bulkInChunks(
    Product,
    products.map((p) => ({
      updateOne: {
        filter: { slug: p.slug },
        update: {
          $set: {
            name: p.name,
            categories: p.categories.map((s) => idBySlug[s]),
            price: p.price,
            unit: p.unit,
            image: p.image,
            isGiftBox: p.isGiftBox,
            sortOrder: p.sortOrder,
          },
          $setOnInsert: { isActive: true, isFeatured: false },
        },
        upsert: true,
      },
    }))
  );

  console.log(`Categories: ${catResult.upserted} added, ${catResult.modified} updated`);
  console.log(`Products:   ${prodResult.upserted} added, ${prodResult.modified} updated`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
