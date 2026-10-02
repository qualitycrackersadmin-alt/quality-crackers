const rateLimit = require('express-rate-limit');

const make = (windowMinutes, limit, error) =>
  rateLimit({
    windowMs: windowMinutes * 60 * 1000,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error },
  });

module.exports = {
  // general API traffic
  apiLimiter: make(15, 300, 'Too many requests, please try again later.'),
  // the public enquiry form: stops spam filling the dashboard
  leadLimiter: make(60, 10, 'Too many enquiries from this device, please try again later.'),
  // admin login: slows password guessing
  loginLimiter: make(15, 10, 'Too many login attempts, please try again later.'),
};
