// routes/admin.js
const bcrypt = require('bcrypt');
const express = require('express');
const router = express.Router();
const db = require('../db/db');
const auth = require('../middlewares/auth');
const initDB = require('../models/initDB');
const ROLES = require('../libs/roles');

router.post(
  '/reset-password',
  auth([ROLES.SUPERADMIN]),
  (req, res) => {
    const { userId, newPassword } = req.body;

    // Validation
    if (!userId || !newPassword) {
      return res.status(400).json({ error: 'userId and newPassword are required' });
    }

    if (typeof newPassword !== 'string' || newPassword.length < 6) {
      return res
        .status(400)
        .json({ error: 'New password must be at least 6 characters' });
    }

    // Hash the new password
    bcrypt.hash(newPassword, 10, (err, hash) => {
      if (err) {
        console.error('Bcrypt error:', err);
        return res.status(500).json({ error: 'Password hashing failed' });
      }

      // Update the user's password in DB
      db.run(
        `UPDATE users SET password = ? WHERE id = ?`,
        [hash, userId],
        function (err) {
          if (err) {
            console.error('DB error during password reset:', err);
            return res.status(500).json({ error: 'Database error' });
          }

          if (this.changes === 0) {
            return res.status(404).json({ error: 'User not found' });
          }

          // Optional: Log the action (audit trail)
          console.log(`Password reset by ${req.user.email} (ID: ${req.user.id}) for user ID: ${userId}`);

          return res.json({
            message: 'Password successfully reset',
            userId,
            resetAt: new Date().toISOString(),
          });
        }
      );
    });
  }
);

// POST /admin/reset-db  (instructor only or admin)
router.post('/reset-db', auth([ROLES.SUPERADMIN]), async (req, res) => {
  try {
    await initDB();
    return res.json({ message: 'Database reinitialized' });
  } catch (e) {
    return res.status(500).json({ error: 'Failed to reinitialize DB' });
  }
});

// POST /admin/reset-scores (delete submissions and reset user scores)
router.post('/reset-scores', auth([ROLES.SUPERADMIN, ROLES.INSTRUCTOR]), (req, res) => {
  db.serialize(() => {
    db.run("DELETE FROM submissions", (err) => {
      if (err) return res.status(500).json({ error: 'DB error' });
      db.run("UPDATE users SET score = 0 WHERE role = 'student'", (err2) => {
        if (err2) return res.status(500).json({ error: 'DB error' });
        return res.json({ message: 'Student scores reset' });
      });
    });
  });
});

// POST /admin/reset-labs (recreate default labs only)
router.post('/reset-labs', auth([ROLES.SUPERADMIN, ROLES.INSTRUCTOR]), (req, res) => {
  db.serialize(() => {
    db.run("DELETE FROM labs", (err) => {
      if (err) return res.status(500).json({ error: 'DB error' });
      // you can seed default labs here; keep minimal
      const stmt = db.prepare(`INSERT INTO labs (title, description, description_markdown, hint, difficulty, flag, score) VALUES (?, ?, ?, ?, ?, ?, ?)`);
      stmt.run('Intro Brute Force', 'Short description', null, 'Try enumeration', 'easy', 'FLAG-BRUTE-EXAMPLE-001', 100);
      stmt.run('SQLi Lab', 'Extract the hash', null, 'Try union select', 'medium', 'FLAG-SQLI-EXAMPLE-001', 150);
      stmt.finalize((e) => {
        if (e) return res.status(500).json({ error: 'DB error' });
        return res.json({ message: 'Labs reset' });
      });
    });
  });
});

module.exports = router;
