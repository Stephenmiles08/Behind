// routes/auth.js
const express = require('express');
const router = express.Router();
const db = require('../db/db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const auth = require('../middlewares/auth');
require('dotenv').config();
const ROLES = require('../libs/roles');

const JWT_SECRET = process.env.JWT_SECRET || 'supersecret';

// Student registration
router.post('/auth/register', async (req, res) => {
  const { name, username, password } = req.body;
  if (!name || !username || !password) return res.status(400).json({ success: false, message: 'name, username and password required' });

  const hash = await bcrypt.hash(password, 10);
  db.run("INSERT INTO users (name, username, password, role) VALUES (?, ?, ?, ?)",
    [name, username, hash, 'student'], function (err) {
      if (err) return res.status(400).json({ success: false, message: 'Username taken' });
      return res.json({ success: true, message: 'Student registered', id: this.lastID });
    });
});

// Login (students & instructors)
router.post('/auth/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'username and password required' });

  db.get("SELECT * FROM users WHERE username = ?", [username], async (err, user) => {
    if (err) return res.status(500).json({ error: 'DB error' });
    if (!user) return res.status(400).json({ error: 'Invalid credentials' });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(400).json({ error: 'Invalid credentials' });

    const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, role: user.role, username: user.username, id: user.id });
  });
});

// Register instructor (only instructor/admin can create instructors)
router.post('/register-instructor', auth([ROLES.SUPERADMIN]), async (req, res) => {
  const { username, password, name } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'username and password required' });

  const hash = await bcrypt.hash(password, 10);
  db.run("INSERT INTO users (name, username, password, role) VALUES (?, ?, ?, 'instructor')", [name || username, username, hash], function(err) {
    if (err) return res.status(500).json({ error: 'Username already exists' });
    res.json({ message: 'Instructor account created', id: this.lastID });
  });
});

router.post('/change-password', auth(), (req, res) => {
  const userId = req.user.id;
  const { oldPassword, newPassword } = req.body;

  if (!oldPassword || !newPassword)
    return res.status(400).json({ error: 'Both passwords required' });

  db.get("SELECT password FROM users WHERE id = ?", [userId], (err, user) => {
    if (err) return res.status(500).json({ error: 'DB error' });

    bcrypt.compare(oldPassword, user.password, (err, match) => {
      if (err) return res.status(500).json({ error: 'Hash error' });
      if (!match) return res.status(403).json({ error: 'Incorrect old password' });

      bcrypt.hash(newPassword, 10, (err, hash) => {
        if (err) return res.status(500).json({ error: 'Hash error' });

        db.run(
          "UPDATE users SET password = ? WHERE id = ?",
          [hash, userId],
          (err) => {
            if (err) return res.status(500).json({ error: 'DB error' });
            res.json({ message: 'Password updated successfully' });
          }
        );
      });
    });
  });
});


module.exports = router;
