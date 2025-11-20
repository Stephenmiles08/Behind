const express = require('express');
const router = express.Router();
const db = require('../db/db');
const auth = require('../middlewares/auth');

router.post('/mode', auth('instructor'), (req, res) => {
    const { mode } = req.body;
    
    if (!['exercise', 'competition'].includes(mode)) {
      return res.status(400).json({ error: 'Invalid mode' });
    }
  
    db.run("UPDATE app_config SET mode = ? WHERE id = 1", [mode], (err) => {
      if (err) return res.status(500).json({ error: 'DB error' });
      res.json({ mode });
    });
  });

  router.get('/mode', auth(), (req, res) => {
    db.get("SELECT mode FROM app_config WHERE id = 1", (err, row) => {
      if (err) return res.status(500).json({ error: 'DB error' });
      res.json({ mode: row.mode });
    });
  });
  
module.exports = router;
