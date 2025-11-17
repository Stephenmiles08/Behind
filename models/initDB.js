const db = require('../db/db');
const bcrypt = require('bcrypt');

async function initDB() {
  db.serialize(async () => {
    // Users table
    db.run(`DROP TABLE IF EXISTS users`);
    db.run(`
      CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE,
        password TEXT,
        role TEXT
      )
    `);

    // Labs table
    db.run(`DROP TABLE IF EXISTS labs`);
    db.run(`
      CREATE TABLE labs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT,
        description TEXT,
        flag TEXT,
        score INTEGER
      )
    `);

    // Submissions table
    db.run(`DROP TABLE IF EXISTS submissions`);
    db.run(`
      CREATE TABLE submissions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        student_id INTEGER,
        lab_id INTEGER,
        flag TEXT,
        score_awarded INTEGER,
        FOREIGN KEY(student_id) REFERENCES users(id),
        FOREIGN KEY(lab_id) REFERENCES labs(id)
      )
    `);

    // Default super-instructor
    const defaultInstructor = { username: 'superinstructor', password: 'Password123!', role: 'instructor' };
    const hash = await bcrypt.hash(defaultInstructor.password, 10);

    db.run(`INSERT INTO users (username, password, role) VALUES (?, ?, ?)`,
      [defaultInstructor.username, hash, defaultInstructor.role],
      () => console.log('Default super-instructor created')
    );
  });
}

module.exports = initDB;
