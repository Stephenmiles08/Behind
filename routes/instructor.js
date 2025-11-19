// routes/instructor.js
const express = require('express');
const router = express.Router();
const db = require('../db/db');
const auth = require('../middlewares/auth');

// GET /instructor/students - list students + total score + count solved
router.get('/students', auth('instructor'), (req, res) => {
    const query = `
    SELECT 
      u.id,
      u.username,
      COALESCE(SUM(s.score_awarded), 0) AS total_score,
      COUNT(DISTINCT CASE WHEN s.score_awarded > 0 THEN s.lab_id END) AS labs_solved
    FROM users u
    LEFT JOIN submissions s ON u.id = s.student_id
    WHERE u.role = 'student'
    GROUP BY u.id
    ORDER BY total_score DESC
  `;

  db.all(query, [], (err, rows) => {
    if (err) return res.status(500).json({ error: 'DB error' });
    res.json({ students: rows });
  });
});

// GET /instructor/student/:id - profile for a student (attempts + summary)
router.get('/students/:id', auth('instructor'), (req, res) => {
  const studentId = parseInt(req.params.id, 10);
  if (isNaN(studentId)) return res.status(400).json({ error: 'invalid id' });

  db.get("SELECT id, username, name, role, score FROM users WHERE id = ?", [studentId], (err, user) => {
    if (err) return res.status(500).json({ error: 'DB error' });
    if (!user) return res.status(404).json({ error: 'user not found' });

    db.all(
      `SELECT submissions.id, submissions.lab_id, labs.title AS lab_title, submissions.flag, submissions.score_awarded, submissions.created_at
       FROM submissions
       JOIN labs ON submissions.lab_id = labs.id
       WHERE submissions.student_id = ?
       ORDER BY submissions.created_at DESC`,
      [studentId],
      (err, attempts) => {
        if (err) return res.status(500).json({ error: 'DB error' });
        res.json({ user, attempts });
      }
    );
  });
});

router.get('/', auth('instructor'), (req, res) => {
    const q = `
      SELECT id, username
      FROM users
      WHERE role = 'instructor'
      ORDER BY username ASC
    `;
  
    db.all(q, [], (err, rows) => {
      if (err) return res.status(500).json({ error: 'DB error' });
  
      const instructors = rows.map(r => ({
        id: r.id,
        username: r.username
      }));
  
      res.json({ instructors });
    });
  });

module.exports = router;
