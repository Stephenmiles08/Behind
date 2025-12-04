// routes/labs.js
const express = require('express');
const router = express.Router();
const db = require('../db/db');
const auth = require('../middlewares/auth');
const ROLES = require('../libs/roles');

// Create lab (instructor)
router.post('/', auth([ROLES.SUPERADMIN, ROLES.INSTRUCTOR]), (req, res) => {
  const { 
    title, 
    description, 
    description_markdown, 
    hint, 
    difficulty, 
    lab_type,          
    flag, 
    score 
  } = req.body;
  if (!title || !flag || !score) return res.status(400).json({ error: 'title, flag, score required' });

  db.run(
    `INSERT INTO labs (title, description, description_markdown, hint, difficulty, lab_type, flag, score) 
 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
 [title, description || '', description_markdown || null, hint || '', difficulty || 'easy', lab_type || 'exercise', flag, score]
 ,
    function(err) {
      if (err) return res.status(500).json({ error: 'DB error' });
      res.json({ message: 'Lab created', id: this.lastID });
    }
  );
});

router.get("/:id/attempts", auth(), (req, res) => {
  const labId = parseInt(req.params.id, 10);
  const studentId = req.query.studentId
  ? parseInt(req.query.studentId, 10)
  : req.user.id;

  const q = `
    SELECT 
      submissions.id AS id,
      submissions.lab_id AS labId,
      labs.title AS labTitle,
      submissions.flag AS flag,
      submissions.score_awarded AS score,
      submissions.created_at AS submitted_at
    FROM submissions
    JOIN labs ON submissions.lab_id = labs.id
    WHERE submissions.student_id = ?
      AND submissions.lab_id = ?
    ORDER BY submissions.created_at DESC
    LIMIT 1000
  `;

  db.all(q, [studentId, labId], (err, rows) => {
    if (err) return res.status(500).json({ error: "DB error" });

    const attempts = rows.map((r) => ({
      id: r.id,
      labId: r.labId,
      labTitle: r.labTitle,
      score: r.score,
      correct: r.score > 0,
      submitted_at: r.submitted_at,
    }));

    return res.json({ attempts });
  });
});

router.get('/all', auth([ROLES.SUPERADMIN, ROLES.INSTRUCTOR]), (req, res) => {
  db.all(
    `SELECT * FROM labs`,
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ error: 'DB error' });
      res.json({ labs: rows });
    }
  );
});

// Get all labs (public to authenticated)
router.get('/', auth(), (req, res) => {
  // Get global lab mode from app_config
  db.get("SELECT mode FROM app_config WHERE key = 'lab_mode' LIMIT 1", [], (err, configRow) => {
    if (err) return res.status(500).json({ error: 'DB error (mode)' });

    const activeMode = configRow?.mode || 'exercise';

    const query = `
      SELECT 
        labs.id,
        labs.title,
        labs.description,
        labs.score,
        labs.difficulty,
        labs.lab_type,
        COUNT(submissions.id) AS submissionsCount
      FROM labs
      LEFT JOIN submissions ON submissions.lab_id = labs.id
      WHERE labs.lab_type = ?
      GROUP BY labs.id
      ORDER BY labs.id ASC
    `;

    db.all(query, [activeMode], (err, rows) => {
      if (err) return res.status(500).json({ error: 'DB Error' });
      res.json({ labs: rows, mode: activeMode });
    });
  });
});

// Get single lab info (students call 

// GET /labs/:id  (for students)
router.get('/:id', auth([ROLES.STUDENT, ROLES.INSTRUCTOR, ROLES.SUPERADMIN]), (req, res) => {
  const userId = req.user.id;
  const labId = req.params.id;

  db.get(`
    SELECT l.*, 
           EXISTS(
             SELECT 1 FROM submissions s 
             WHERE s.student_id = ? AND s.lab_id = l.id AND s.score_awarded > 0
           ) AS completed
    FROM labs l 
    WHERE l.id = ?
  `, [userId, labId], (err, lab) => {
    if (err || !lab) return res.status(404).json({ error: 'Lab not found' });

    // Convert SQLite 0/1 to boolean
    lab.completed = !!lab.completed;

    

    // Hide real flag from students
    if (req.user.role === ROLES.STUDENT) {
      lab.flag = "flag{hidden_for_students}";
    }

    res.json(lab);
  });
});

// Get hint (protected route; can be open)
router.get('/:id/hint', auth(), (req, res) => {
  const labId = req.params.id;
  db.get("SELECT hint FROM labs WHERE id = ?", [labId], (err, row) => {
    if (err) return res.status(500).json({ error: 'DB error' });
    if (!row) return res.status(404).json({ error: 'Lab not found' });
    res.json({ hint: row.hint || '' });
  });
});

// Update lab (instructor)
router.put('/:id', auth([ROLES.INSTRUCTOR, ROLES.SUPERADMIN]), (req, res) => {
  const labId = req.params.id;
  const { 
    title, 
    description, 
    description_markdown, 
    hint, 
    difficulty, 
    lab_type,       
    flag, 
    score 
  } = req.body;
  
  if (!title || !flag || !score) return res.status(400).json({ error: 'title, flag, score required' });

  db.run(
    `UPDATE labs 
SET title = ?, description = ?, description_markdown = ?, hint = ?, difficulty = ?, lab_type = ?, flag = ?, score = ?
WHERE id = ?`,
[title, description || '', description_markdown || null, hint || '', difficulty || 'easy', lab_type ?? undefined, flag, score, labId]
,
    function(err) {
      if (err) return res.status(500).json({ error: 'DB error' });
      if (this.changes === 0) return res.status(404).json({ error: 'Lab not found' });
      res.json({ message: 'Lab updated' });
    }
  );
});

// Delete lab (instructor)
router.delete('/:id', auth([ROLES.INSTRUCTOR, ROLES.SUPERADMIN]), (req, res) => {
  const labId = req.params.id;
  db.run("DELETE FROM labs WHERE id = ?", [labId], function(err) {
    if (err) return res.status(500).json({ error: 'DB error' });
    if (this.changes === 0) return res.status(404).json({ error: 'Lab not found' });
    res.json({ message: 'Lab deleted' });
  });
});

// GET lab submissions (separate route for instructor)
router.get('/:id/submissions', auth([ROLES.SUPERADMIN, ROLES.INSTRUCTOR]), (req, res) => {
  const labId = req.params.id;
  db.get("SELECT score FROM labs WHERE id = ?", [labId], (err, lab) => {
    if (err) return res.status(500).json({ error: 'DB error' });
    if (!lab) return res.status(404).json({ error: 'Lab not found' });

    db.all(
      `SELECT submissions.id, submissions.flag, submissions.score_awarded, submissions.created_at, users.username AS studentName
       FROM submissions
       JOIN users ON submissions.student_id = users.id
       WHERE submissions.lab_id = ?
       ORDER BY submissions.created_at DESC`,
      [labId],
      (err, rows) => {
        if (err) return res.status(500).json({ error: 'DB error' });

        const submissions = rows.map((s) => ({
          id: s.id,
          studentName: s.studentName,
          flag: s.flag,
          correct: s.score_awarded === lab.score,
          timestamp: s.created_at
        }));

        res.json({ submissions, submissionsCount: submissions.length });
      }
    );
  });
});

module.exports = router;
