// routes/submissions.js
const express = require('express');
const router = express.Router();
const db = require('../db/db');
const auth = require('../middlewares/auth');

// POST /submissions - student submits a flag
router.post('/', auth('student'), (req, res) => {
  const studentId = req.user.id;
  const { labId, flag } = req.body;
  if (!labId || !flag) return res.status(400).json({ error: 'labId and flag required' });

  // Step 1: Check if lab exists
  db.get("SELECT id, flag, score FROM labs WHERE id = ?", [labId], (err, lab) => {
    if (err) return res.status(500).json({ error: 'DB error' });
    if (!lab) return res.status(404).json({ error: 'Lab not found' });

    // Step 2: Check if student has already solved this lab
    db.get(
      "SELECT 1 FROM submissions WHERE student_id = ? AND lab_id = ? AND score_awarded > 0 LIMIT 1",
      [studentId, labId],
      (err, solved) => {
        if (err) return res.status(500).json({ error: 'DB error' });
        if (solved) {
          return res.status(400).json({ error: 'Lab already solved. You cannot resubmit.' });
        }

        // Step 3: Calculate score for this submission
        const score_awarded = flag === lab.flag ? lab.score : 0;

        // Step 4: Insert submission
        db.run(
          `INSERT INTO submissions (student_id, lab_id, flag, score_awarded) VALUES (?, ?, ?, ?)`,
          [studentId, labId, flag, score_awarded],
          function(err) {
            if (err) return res.status(500).json({ error: 'DB error' });

            // Step 5: Update user's score if correct
            if (score_awarded > 0) {
              db.run(`UPDATE users SET score = COALESCE(score,0) + ? WHERE id = ?`, [score_awarded, studentId]);
            }

            res.json({
              id: this.lastID,
              labId,
              flag,
              score_awarded,
              correct: score_awarded === lab.score,
            });
          }
        );
      }
    );
  });
});


// GET /submissions/solved/:studentId
router.get("/solved/:studentId", auth("instructor"), (req, res) => {
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
