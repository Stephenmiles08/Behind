const express = require('express');
const db = require('../db/db');
const jwt = require('jsonwebtoken');
const router = express.Router();
const authenticate  = require('../middlewares/auth');
const JWT_SECRET = process.env.JWT_SECRET;

// Middleware: Verify student
// function verifyStudent(req, res, next) {
//   const auth = req.headers.authorization;
//   if (!auth) return res.status(401).json({ error: 'Missing token' });

//   const match = auth.match(/Bearer (.+)/);
//   if (!match) return res.status(401).json({ error: 'Invalid token' });

//   try {
//     const payload = jwt.verify(match[1], JWT_SECRET);
//     if (payload.role !== 'student') return res.status(403).json({ error: 'Not authorized' });
//     req.user = payload;
//     next();
//   } catch (e) {
//     return res.status(401).json({ error: 'Invalid token' });
//   }
// }

// --- Submit Flag ---
router.post("/", authenticate(), (req, res) => {
  const userId = req.user.id; // auth middleware must attach user
  const { labId, flag } = req.body;

  if (!labId || !flag) {
    return res.status(400).json({ error: "labId and flag are required" });
  }

  // Get lab info
  db.get("SELECT id, flag, score FROM labs WHERE id = ?", [labId], (err, lab) => {
    if (err) return res.status(500).json({ error: "DB error" });
    if (!lab) return res.status(404).json({ error: "Lab not found" });

    const score_awarded = flag === lab.flag ? lab.score : 0;

    db.run(
      "INSERT INTO submissions (student_id, lab_id, flag, score_awarded) VALUES (?, ?, ?, ?)",
      [userId, labId, flag, score_awarded],
      function (err) {
        if (err) return res.status(500).json({ error: "Failed to submit flag" });

        res.json({
          id: this.lastID,
          labId,
          flag,
          score_awarded,
          correct: score_awarded === lab.score,
        });
      }
    );
  });
});
// --- Leaderboard ---
router.get('/leaderboard', authenticate(),(req, res) => {
  db.all(`
    SELECT u.username, SUM(s.score_awarded) as total_score
    FROM users u
    JOIN submissions s ON u.id = s.student_id
    WHERE u.role='student'
    GROUP BY u.id
    ORDER BY total_score DESC
  `, [], (err, rows) => {
    if (err) return res.status(500).json({ error: 'DB Error' });
    res.json(rows);
  });
});

module.exports = router;
