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

  // Validate input
  if (!labId || !flag) {
    return res.status(400).json({ error: 'labId and flag required' });
  }

  // Fetch the lab (with correct flag and score)
  db.get(
    "SELECT id, flag, score FROM labs WHERE id = ?",
    [labId],
    (err, lab) => {
      if (err) return res.status(500).json({ error: 'DB error' });
      if (!lab) return res.status(404).json({ error: 'Lab not found' });

      // Check if student already solved this lab (has at least one correct submission)
      db.get(
        `SELECT 1 
         FROM submissions 
         WHERE student_id = ? AND lab_id = ? AND score_awarded > 0 
         LIMIT 1`,
        [studentId, labId],
        (err, alreadySolved) => {
          if (err) return res.status(500).json({ error: 'DB error' });

          // Prevent resubmission if already solved (optional — you can remove if you allow resubmits)
          if (alreadySolved) {
            return res.status(400).json({
              error: 'Lab already solved. You cannot resubmit.'
            });
          }

          // Evaluate current submission
          const isCorrect = flag === lab.flag;
          const score_awarded = isCorrect ? lab.score : 0;

          // Lab is completed if this submission is correct (since alreadySolved is false here)
          const completed = isCorrect;

          // Insert the submission
          db.run(
            `INSERT INTO submissions (student_id, lab_id, flag, score_awarded)
             VALUES (?, ?, ?, ?)`,
            [studentId, labId, flag, score_awarded],
            function (err) {
              if (err) return res.status(500).json({ error: 'DB error' });

              const submissionId = this.lastID;

              // Award points only on correct first-time solve
              if (score_awarded > 0) {
                db.run(
                  `UPDATE users 
                   SET score = COALESCE(score, 0) + ? 
                   WHERE id = ?`,
                  [score_awarded, studentId],
                  (err) => {
                    if (err) console.error('Failed to update user score:', err);
                  }
                );
              }

              // Send response
              res.json({
                id: submissionId,
                labId,
                flag,
                score_awarded,
                correct: isCorrect,     // Was THIS submission correct?
                completed               // Is the lab NOW marked as completed? (true only on first correct submit)
              });
            }
          );
        }
      );
    }
  );
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

