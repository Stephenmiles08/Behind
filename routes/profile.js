const express = require('express');
const router = express.Router();
const db = require('../db/db');
const authenticate  = require('../middlewares/auth');

// Get logged-in user profile
router.get('/', authenticate(), (req, res) => {
  const studentId = req.user.id;

  const sql = `
    SELECT 
      l.title,
      l.score AS max_score,
      MAX(s.score_awarded) AS score_awarded   -- This ensures only points once per lab
    FROM labs l
    LEFT JOIN submissions s 
      ON s.lab_id = l.id 
      AND s.student_id = ? 
      AND s.score_awarded > 0                    -- Only count correct submissions
    GROUP BY l.id, l.title, l.score
    HAVING MAX(s.score_awarded) IS NOT NULL OR 1  -- Include all labs (solved or not)
    ORDER BY l.title
  `;

  db.all(sql, [studentId], (err, labs) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Database error' });
    }

    // Compute totals server-side (optional but cleaner)
    const totalScore = labs
      .reduce((sum, lab) => sum + (lab.score_awarded || 0), 0);

    const labsCompleted = labs
      .filter(lab => (lab.score_awarded || 0) > 0).length;

    res.json({
      username: req.user.username,
      totalScore,
      labsCompleted,
      labs,  // still send per-lab data if you want a detailed list later
    });
  });
});

module.exports = router;
