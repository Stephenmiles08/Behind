// index.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const initDB = require('./models/initDB');

const authRoutes = require('./routes/auth');
const labsRoutes = require('./routes/labs');
const submissionsRoutes = require('./routes/submissions');
const instructorRoutes = require('./routes/instructor');
const adminRoutes = require('./routes/admin');
const leaderboardRoutes = require('./routes/leaderboard');
const profile = require('./routes/profile');
const settings = require('./routes/settings');

const app = express();
const PORT = process.env.PORT;

app.use(cors());
app.use(express.json());

// Initialize DB (safe to run; drops tables when initDB called)
initDB();

// Routes
app.use('/', authRoutes);
app.use('/labs', labsRoutes);
app.use('/submissions', submissionsRoutes);
app.use('/instructor', instructorRoutes);
app.use('/admin', adminRoutes);
app.use('/leaderboard', leaderboardRoutes);
app.use('/profile', profile);
app.use('/settings', settings);

// Health
app.get('/health', (req, res) => res.json({ ok: true }));

app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
