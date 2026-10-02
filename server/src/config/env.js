const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const missing = ['MONGODB_URI', 'JWT_SECRET'].filter((key) => !process.env[key]);
if (missing.length) {
  console.error(`Missing required environment variables: ${missing.join(', ')}`);
  console.error('Copy server/.env.example to server/.env and fill them in.');
  process.exit(1);
}
if (process.env.JWT_SECRET.length < 32) {
  console.error('JWT_SECRET must be at least 32 characters long.');
  process.exit(1);
}

module.exports = {
  isProd: process.env.NODE_ENV === 'production',
  port: Number(process.env.PORT) || 3000,
  mongoUri: process.env.MONGODB_URI,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',
  clientOrigins: (process.env.CLIENT_ORIGIN || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  shop: {
    name: process.env.SHOP_NAME || 'Your Shop Name',
    city: process.env.SHOP_CITY || '',
    whatsappNumber: (process.env.WHATSAPP_NUMBER || '').replace(/\D/g, ''),
  },
};
