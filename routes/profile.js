const express = require('express');
const router = express.Router();
const db = require('../db/db');
const authenticate  = require('../middlewares/auth');

// Get logged-in user profile
router.get('/', authenticate(), (req, res) => {
    db.all(
        `SELECT labs.title, labs.score as max_score, submissions.score_awarded
         FROM submissions
         JOIN labs ON submissions.lab_id = labs.id
         WHERE submissions.student_id = ?`,
        [req.user.id],
        (err, rows) => {
          if (err) return res.status(500).json({ error: 'DB error' });
          res.json({ username: req.user.username, labs: rows });
        }
      );
});

module.exports = router;
