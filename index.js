require('dotenv').config();
const express = require('express');
const cors = require('cors');
const initDB = require('./models/initDB');

const authRoutes = require('./routes/auth');
const labRoutes = require('./routes/labs');
const submissionRoutes = require('./routes/submissions');
const leaderboardRoutes= require('./routes/leaderboard');
const profileRoutes = require('./routes/profile');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3002;

// Initialize DB
initDB();

// app.use((req, res, next) => {
//     console.log('Headers:', req.headers);
//     console.log('Body:', req.body);
//     next();
//   });

// Routes
app.use('/auth', authRoutes);
app.use('/labs', labRoutes);
app.use('/submissions', submissionRoutes);
app.use('/leaderboard', leaderboardRoutes);
app.use('/profile', profileRoutes);

app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
