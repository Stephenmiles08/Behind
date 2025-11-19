require('dotenv').config();

const db = require('../db/db');
const bcrypt = require('bcrypt');

async function initDB() {
  db.serialize(async () => {
    // Drop old tables (only when reinitializing)
    db.run(`DROP TABLE IF EXISTS submissions`);
    db.run(`DROP TABLE IF EXISTS labs`);
    db.run(`DROP TABLE IF EXISTS users`);

    // Users table
    db.run(`
      CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        username TEXT UNIQUE,
        password TEXT,
        role TEXT,
        score INTEGER DEFAULT 0
      )
    `);

    // Labs table (added difficulty & hint & description stays)
    db.run(`
      CREATE TABLE labs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT,
        description TEXT,
        description_markdown TEXT,
        hint TEXT,
        difficulty TEXT DEFAULT 'easy',
        flag TEXT,
        score INTEGER
      )
    `);

    // Submissions table (added created_at)
    db.run(`
      CREATE TABLE submissions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        student_id INTEGER,
        lab_id INTEGER,
        flag TEXT,
        score_awarded INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(student_id) REFERENCES users(id),
        FOREIGN KEY(lab_id) REFERENCES labs(id)
      )
    `);

    // Seed default super-instructor
    const defaultInstructor = {
      username: process.env.DEFAULT_INSTRUCTOR_USERNAME || 'superinstructor',
      password: process.env.DEFAULT_INSTRUCTOR_PASSWORD || 'Password123!',
      role: 'instructor',
      name: process.env.DEFAULT_INSTRUCTOR_NAME || 'Super Instructor',
    };
    const hash = await bcrypt.hash(defaultInstructor.password, 10);

    db.run(
      `INSERT INTO users (name, username, password, role) VALUES (?, ?, ?, ?)`,
      [defaultInstructor.name, defaultInstructor.username, hash, defaultInstructor.role],
      () => console.log('Default super-instructor created')
    );

    // Optional: seed a couple labs
    db.run(
      `INSERT INTO labs (title, description, description_markdown, hint, difficulty, flag, score)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        'Intro Brute Force',
        'Find the admin by brute force.',
        'Find the admin by brute force.\n\n- Try enumeration\n- Use a wordlist',
        'Try common admin-like usernames and short passwords.',
        'easy',
        'FLAG-BRUTE-EXAMPLE-001',
        100,
      ],
      () => console.log('Seed lab created')
    );

    console.log('Database initialized successfully.');
  });
}

// If run directly
if (require.main === module) {
  initDB().then(() => process.exit(0)).catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

module.exports = initDB;
