// Express 4 does not catch errors thrown inside async route handlers; this forwards them
// to the error middleware instead of leaving the request hanging.
module.exports = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
