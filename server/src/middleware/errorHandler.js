function notFound(req, res) {
  res.status(404).json({ error: 'Not found' });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err.name === 'ZodError') {
    return res.status(400).json({
      error: 'Invalid input',
      details: err.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
    });
  }
  if (err.name === 'ValidationError') {
    return res.status(400).json({ error: err.message });
  }
  if (err.name === 'CastError') {
    return res.status(400).json({ error: `Invalid ${err.path}` });
  }
  if (err.code === 11000) {
    return res.status(409).json({ error: 'A record with that value already exists' });
  }

  const status = err.status || 500;
  if (status >= 500) console.error(err);
  return res.status(status).json({
    error: status >= 500 ? 'Something went wrong' : err.message,
  });
}

module.exports = { notFound, errorHandler };
