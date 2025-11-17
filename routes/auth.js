const express = require('express');
const db = require('../db/db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const auth = require('../middlewares/auth');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET;


// --- Login ---
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  console.log(username);
  if (!username || !password) return res.status(400).json({ error: 'username and password required' });

  db.get("SELECT * FROM users WHERE username = ?", [username], async (err, user) => {
    if (err) return res.status(500).json({ error: 'DB Error' });
    if (!user) return res.status(400).json({ error: 'Invalid credentials' });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(400).json({ error: 'Invalid credentials' });

    const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '2h' });
    res.json({ token, role: user.role });
  });
});

router.post('/register', async (req, res) => {
  const { name, username, password } = req.body;
  if (!name || !username || !password) return res.status(400).json({ error: 'All fields required' });

  const hash = await bcrypt.hash(password, 10);
  db.run("INSERT INTO users (username, password, role) VALUES (?, ?, ?)",
    [ username, hash, 'student'], function(err) {
      if (err) return res.status(400).json({ error: 'Username taken' });
      res.json({ success:true, message: 'Student registered'});
    });
});


// --- Instructor creates other instructors ---
router.post('/register-instructor',auth('instructor'), async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'username and password required' });

    const hash = await bcrypt.hash(password, 10);
    db.run(`INSERT INTO users (username, password, role) VALUES (?, ?, ?)`, [username, hash, 'instructor'], (err) => {
      if (err) return res.status(500).json({ error: 'Username already exists' });
      res.json({ message: 'Instructor account created successfully' });
    });
  } catch (e) {
    return res.status(401).json({ error: 'Invalid token' });
  }
});

module.exports = router;
