// One-time (re-runnable) fix for the LIVE database: sets the Excel S.No on existing products.
// Reads src/data/sno-map.json ({ "<product slug>": "<S.No>" }) and changes ONLY the `sno` field.
// Names, prices, images, active/featured flags are not touched.
//
//   node scripts/set-sno.js --dry-run     show what would change, no database needed
//   node scripts/set-sno.js               write to the database
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const Product = require('../src/models/Product');

const dryRun = process.argv.includes('--dry-run');
const map = JSON.parse(fs.readFileSync(path.join(__dirname, '../src/data/sno-map.json'), 'utf8'));

(async () => {
  const entries = Object.entries(map);
  if (dryRun) return console.log(`Dry run: ${entries.length} products would get an S.No. Nothing written.`);
  await require('../src/config/db')();
  const r = await Product.bulkWrite(entries.map(([slug, sno]) => ({ updateOne: { filter: { slug }, update: { $set: { sno } } } })));
  const have = await Product.countDocuments({ sno: { $ne: '' } });
  console.log(`Matched ${r.matchedCount} of ${entries.length} slugs, updated ${r.modifiedCount}. Products with S.No now: ${have}`);
  await mongoose.disconnect();
})().catch((e) => { console.error(e.message); process.exit(1); });
