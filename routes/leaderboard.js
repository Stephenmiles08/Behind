const express = require('express');
const router = express.Router();
const db = require('../db/db');
const  auth  = require('../middlewares/auth'); 

// Get leaderboard (students ordered by score)
router.get('/', auth(), (req, res) => {
  db.all(
    `SELECT users.username, SUM(submissions.score_awarded) as total_score
     FROM users
     JOIN submissions ON users.id = submissions.student_id
     WHERE users.role = 'student'
     GROUP BY users.id
     ORDER BY total_score DESC`,
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ error: 'DB error' });
      res.json(rows);
    }
  );
});

module.exports = router;
