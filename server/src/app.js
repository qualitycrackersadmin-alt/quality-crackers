const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');

const { port, isProd, clientOrigins } = require('./config/env');
const connectDB = require('./config/db');
const { apiLimiter } = require('./middleware/rateLimit');
const { notFound, errorHandler } = require('./middleware/errorHandler');
const routes = require('./routes');

const app = express();

app.set('trust proxy', 1); //  correct client IPs behind a host's proxy (rate limiting)

app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        'script-src': ["'self'"],
        'img-src': ["'self'", 'data:', 'https://lh3.googleusercontent.com', 'https://drive.google.com', 'https://drive.usercontent.google.com'],
        'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        'font-src': ["'self'", 'https://fonts.gstatic.com'],
        // would force https on plain-http localhost
        'upgrade-insecure-requests': isProd ? [] : null,
      },
    },
  })
);
app.use(cors({ origin: clientOrigins.length ? clientOrigins : false }));
app.use(express.json({ limit: '100kb' }));
app.use('/img', require('./routes/images'));
app.use('/api', apiLimiter, routes);

// Static sites: customer site at "/", admin dashboard at "/admin"
const root = path.join(__dirname, '../../');
const client = path.join(root, 'client');
app.use('/admin', express.static(path.join(root, 'admin')));

// Customer pages served by Express (clean URLs). Data comes from /api/*.
const page = (file) => (req, res) => res.sendFile(path.join(client, file));
app.get('/', page('index.html'));
app.get('/products', page('products.html'));
app.get('/cart', page('cart.html'));

// Product photos rarely change: cache them. CSS/JS: short cache so deploys show up quickly.
app.use('/assets', express.static(path.join(client, 'assets'), { maxAge: isProd ? '7d' : 0 }));
app.use(express.static(client, { maxAge: isProd ? '1h' : 0 }));

app.use(notFound);
app.use(errorHandler);

async function start() {
  await connectDB();
  app.listen(port, () => console.log(`Server running on http://localhost:${port}`));
}

if (require.main === module) {
  start().catch((err) => {
    console.error('Failed to start:', err.message);
    process.exit(1);
  });
}

module.exports = app;