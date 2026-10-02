const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../config/env');

// Protects admin routes. Expects:  Authorization: Bearer <token>
function requireAdmin(req, res, next) {
  const [scheme, token] = (req.headers.authorization || '').split(' ');
  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  try {
    req.admin = jwt.verify(token, jwtSecret, { algorithms: ['HS256'] });
    return next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

module.exports = { requireAdmin };
