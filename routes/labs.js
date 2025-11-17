const express = require('express');
const db = require('../db/db');
const jwt = require('jsonwebtoken');
const authenticate = require('../middlewares/auth');
const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET;

// Middleware: Verify instructor
function verifyInstructor(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'Missing token' });

  const match = auth.match(/Bearer (.+)/);
  if (!match) return res.status(401).json({ error: 'Invalid token' });

  try {
    const payload = jwt.verify(match[1], JWT_SECRET);
    if (payload.role !== 'instructor') return res.status(403).json({ error: 'Not authorized' });
    req.user = payload;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// --- Create Lab ---
router.post('/', verifyInstructor, (req, res) => {
  const { title, description, flag, score } = req.body;
  db.run(
    `INSERT INTO labs (title, description, flag, score) VALUES (?, ?, ?, ?)`,
    [title, description, flag, score],
    function(err) {
      if (err) return res.status(500).json({ error: 'DB Error' });
      res.json({ message: 'Lab created', labId: this.lastID });
    }
  );
});

// --- Get all Labs (students can see) ---
router.get('/', (req, res) => {
  db.all(
    `SELECT id, title, description, score FROM labs`,
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ error: 'DB Error' });

      res.json({ labs: rows });
    }
  );
});

router.get("/:id", (req, res) => {
  const labId = req.params.id;

  db.get("SELECT id, title, description, score FROM labs WHERE id = ?", [labId], (err, lab) => {
    if (err) return res.status(500).json({ error: "DB error" });
    if (!lab) return res.status(404).json({ error: "Lab not found" });

    res.json(lab);
  });
});

router.get("/:id/submissions", (req, res) => {
  const labId = req.params.id;

  // Get lab info
  db.get("SELECT * FROM labs WHERE id = ?", [labId], (err, lab) => {
    if (err) return res.status(500).json({ error: "DB error" });
    if (!lab) return res.status(404).json({ error: "Lab not found" });

    // Get submissions for this lab
    db.all(
      `SELECT 
          submissions.id,
          submissions.flag,
          submissions.score_awarded,
          users.username AS studentName
       FROM submissions
       JOIN users ON submissions.student_id = users.id
       WHERE submissions.lab_id = ?
       ORDER BY submissions.id DESC`,
      [labId],
      (err, submissionRows) => {
        console.log(err);
        if (err) return res.status(500).json({ error: "DB error" });

        // Compute 'correct' dynamically
        const submissions = submissionRows.map((s) => ({
          id: s.id,
          studentName: s.studentName,
          flag: s.flag,
          correct: s.score_awarded === lab.score,
        }));

        return res.json({
          id: lab.id,
          title: lab.title,
          description: lab.description,
          score: lab.score,
          submissionsCount: submissions.length,
          submissions,
        });
      }
    );
  });
});

router.put("/:id", authenticate(), (req, res) => {
  const labId = req.params.id;
  const { title, description, flag, score } = req.body;

  // Validate input
  if (!title || !description || !flag || !score) {
    return res.status(400).json({ error: "All fields are required" });
  }

  const parsedScore = parseInt(score);
  if (isNaN(parsedScore) || parsedScore < 1) {
    return res.status(400).json({ error: "Score must be a positive number" });
  }

  db.run(
    `UPDATE labs 
     SET title = ?, description = ?, flag = ?, score = ? 
     WHERE id = ?`,
    [title, description, flag, parsedScore, labId],
    function (err) {
      if (err) return res.status(500).json({ error: "DB error" });
      if (this.changes === 0) return res.status(404).json({ error: "Lab not found" });

      res.json({ message: "Lab updated successfully" });
    }
  );
});


module.exports = router;
