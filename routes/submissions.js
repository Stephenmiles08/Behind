// routes/submissions.js
const express = require('express');
const router = express.Router();
const db = require('../db/db');
const auth = require('../middlewares/auth');
const ROLES = require('../libs/roles');

// POST /submissions - student submits a flag
router.post('/', auth([ROLES.STUDENT]), (req, res) => {
  const studentId = req.user.id;
  const { labId, flag } = req.body;

  if (!labId || !flag) {
    return res.status(400).json({ error: 'labId and flag required' });
  }

  db.get("SELECT id, flag AS correctFlag, score FROM labs WHERE id = ?", [labId], (err, lab) => {
    if (err || !lab) return res.status(404).json({ error: 'Lab not found' });

    // Check if student ALREADY solved it correctly before
    db.get(
      "SELECT 1 FROM submissions WHERE student_id = ? AND lab_id = ? AND score_awarded > 0 LIMIT 1",
      [studentId, labId],
      (err, alreadySolved) => {
        if (err) return res.status(500).json({ error: 'DB error' });

        const hasSolvedBefore = !!alreadySolved;
        const isCorrectNow = flag.trim() === lab.correctFlag.trim();
        
        // Award points ONLY on the FIRST correct submission
        const score_awarded = (isCorrectNow && !hasSolvedBefore) ? lab.score : 0;

        // Lab is completed if solved before OR correct now
        const completed = hasSolvedBefore || isCorrectNow;

        // Always allow submission (so attempts are recorded)
        db.run(
          `INSERT INTO submissions (student_id, lab_id, flag, score_awarded)
           VALUES (?, ?, ?, ?)`,
          [studentId, labId, flag, score_awarded],
          function(err) {
            if (err) return res.status(500).json({ error: 'DB error' });

            // Award points to user score only once
            if (score_awarded > 0) {
              db.run(
                `UPDATE users SET score = COALESCE(score, 0) + ? WHERE id = ?`,
                [score_awarded, studentId]
              );
            }

            res.json({
              id: this.lastID,
              labId,
              flag,
              score_awarded,
              correct: isCorrectNow,
              completed        // ← now 100% reliable
            });
          }
        );
      }
    );
  });
});

// GET /submissions/solved/:studentId
router.get("/solved/:studentId", auth([ROLES.INSTRUCTOR, ROLES.SUPERADMIN]), (req, res) => {
  const studentId = parseInt(req.params.studentId, 10);

  const q = `
    SELECT 
      labs.id AS lab_id,
      labs.title AS lab_title,
      MAX(submissions.score_awarded) AS score,
      MAX(submissions.created_at) AS solved_at
    FROM labs
    JOIN submissions ON labs.id = submissions.lab_id
    WHERE submissions.student_id = ?
    GROUP BY labs.id
  `;

  db.all(q, [studentId], (err, rows) => {
    if (err) return res.status(500).json({ error: "DB error" });

    // Map to frontend-friendly format
    const solved = rows.map((r) => ({
      lab_id: r.lab_id,
      lab_title: r.lab_title,
      score: r.score,
      solved_at: r.solved_at,
    }));

    return res.json({ solved });
  });
});

module.exports = router;

