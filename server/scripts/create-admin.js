// Usage:  npm run create-admin -- <username> <password>
// Or set ADMIN_USERNAME / ADMIN_PASSWORD in the environment to keep the
// password out of your shell history. Running it again resets the password.
require('../src/config/env');
const mongoose = require('mongoose');
const connectDB = require('../src/config/db');
const Admin = require('../src/models/Admin');

async function main() {
  const [argUser, argPass] = process.argv.slice(2);
  const username = (argUser || process.env.ADMIN_USERNAME || '').toLowerCase().trim();
  const password = argPass || process.env.ADMIN_PASSWORD || '';

  if (username.length < 3 || password.length < 8) {
    console.error('Usage: npm run create-admin -- <username (min 3)> <password (min 8)>');
    process.exit(1);
  }

  await connectDB();
  const admin = (await Admin.findOne({ username })) || new Admin({ username });
  await admin.setPassword(password);
  await admin.save();
  console.log(`Admin "${username}" saved.`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
