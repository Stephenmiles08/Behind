// routes/leaderboard.js
const express = require('express');
const router = express.Router();
const db = require('../db/db');
const auth = require('../middlewares/auth');


// GET /leaderboard?period=today|week|all&metric=score|labs
router.get('/', auth(), (req, res) => {
  const period = req.query.period || 'all'; // today, week, all
  const metric = req.query.metric || 'score'; // score or labs

  let timeWhere = '';
  const params = [];

  if (period === 'today') {
    timeWhere = `AND s.created_at >= date('now','localtime','start of day')`;
  } else if (period === 'week') {
    timeWhere = `AND s.created_at >= date('now','localtime','-6 days')`;
  } // all -> no filter

  if (metric === 'score') {
    const q = `
      SELECT u.username, COALESCE(SUM(s.score_awarded),0) as total_score, COUNT(DISTINCT CASE WHEN s.score_awarded>0 THEN s.lab_id END) as labs_completed
      FROM users u
      LEFT JOIN submissions s ON u.id = s.student_id ${timeWhere}
      WHERE u.role = 'student'
      GROUP BY u.id
      ORDER BY total_score DESC
      LIMIT 200
    `;
    db.all(q, params, (err, rows) => {
      if (err) return res.status(500).json({ error: 'DB error' });
      res.json(rows);
    });
  } else {
    // metric = labs
    const q = `
      SELECT u.username, COALESCE(SUM(s.score_awarded),0) as total_score, COUNT(DISTINCT CASE WHEN s.score_awarded>0 THEN s.lab_id END) as labs_completed
      FROM users u
      LEFT JOIN submissions s ON u.id = s.student_id ${timeWhere}
      WHERE u.role = 'student'
      GROUP BY u.id
      ORDER BY labs_completed DESC, total_score DESC
      LIMIT 200
    `;
    db.all(q, params, (err, rows) => {
      if (err) return res.status(500).json({ error: 'DB error' });
      res.json(rows);
    });
  }
});

module.exports = router;
