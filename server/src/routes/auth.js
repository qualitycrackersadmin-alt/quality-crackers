const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { z } = require('zod');
const Admin = require('../models/Admin');
const { jwtSecret, jwtExpiresIn } = require('../config/env');
const { requireAdmin } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 12); // keeps timing equal for unknown usernames

const loginSchema = z.object({
  username: z.string().trim().toLowerCase().min(1).max(50),
  password: z.string().min(1).max(200),
});

// POST /api/auth/login  ->  { token, username }
router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const { username, password } = loginSchema.parse(req.body);
    const admin = await Admin.findOne({ username });
    const ok = admin ? await admin.verifyPassword(password) : (await bcrypt.compare(password, DUMMY_HASH), false);
    if (!ok) return res.status(401).json({ error: 'Incorrect username or password' });

    const token = jwt.sign({ sub: String(admin._id), username: admin.username }, jwtSecret, {
      algorithm: 'HS256',
      expiresIn: jwtExpiresIn,
    });
    res.json({ token, username: admin.username });
  })
);

// GET /api/auth/me  ->  checks that a stored token is still valid
router.get('/me', requireAdmin, (req, res) => res.json({ username: req.admin.username }));

module.exports = router;