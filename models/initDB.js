// scripts/init-db.js  (or wherever you keep it)
require('dotenv').config();
const db = require('../db/db');        // ← your current db.js (connects to labs.db)
const bcrypt = require('bcrypt');
const fs = require('fs');
const path = require('path');

// Allow forced reset: node scripts/init-db.js --force
const FORCE_RESET = process.argv.includes('--force') || process.env.RESET_DB === '1';

async function initDB() {
  const dbPath = path.join(__dirname, '../db/labs.db');

  // Helper: check if a table exists
  const tableExists = (table) => {
    return new Promise((resolve) => {
      db.get(
        `SELECT name FROM sqlite_master WHERE type='table' AND name = ?`,
        [table],
        (err, row) => {
          resolve(!err && row);
        }
      );
    });
  };

  // Wait for the DB connection to be fully ready
  await new Promise((resolve) => {
    if (db.open) return resolve();
    db.once('open', resolve);
  });

  const dbFileExists = fs.existsSync(dbPath);

  if (!FORCE_RESET && dbFileExists && (await tableExists('users'))) {
    console.log('labs.db already exists and is initialized → skipping setup');
    return;
  }

  console.log(
    FORCE_RESET
      ? 'Force reset requested → recreating database...'
      : dbFileExists
      ? 'labs.db exists but is empty → initializing...'
      : 'No labs.db found → creating fresh database...'
  );

  // ─────── ONLY RUNS WHEN NEEDED ───────
  return new Promise((resolve, reject) => {
    db.serialize(async () => {
      try {
        // 1. Drop everything (only on fresh or forced init)
        db.run(`DROP TABLE IF EXISTS submissions`);
        db.run(`DROP TABLE IF EXISTS labs`);
        db.run(`DROP TABLE IF EXISTS users`);
        db.run(`DROP TABLE IF EXISTS app_config`);

        // 2. Create tables
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

        db.run(`
          CREATE TABLE labs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT,
            description TEXT,
            description_markdown TEXT,
            hint TEXT,
            difficulty TEXT DEFAULT 'easy',
            lab_type TEXT DEFAULT 'exercise',
            flag TEXT,
            score INTEGER
          )
        `);

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

        db.run(`
          CREATE TABLE app_config (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            key TEXT UNIQUE,
            mode TEXT
          )
        `);

        // 3. Seed default config
        db.run(`INSERT OR REPLACE INTO app_config (key, mode) VALUES ('lab_mode', 'exercise')`);

        // 4. Seed superadmin (only if not exists)
        const hash = await bcrypt.hash(process.env.DEFAULT_INSTRUCTOR_PASSWORD || 'admin123', 10);
        db.run(
          `INSERT OR IGNORE INTO users (username, name, password, role)
           VALUES (?, ?, ?, ?)`,
          [
            process.env.DEFAULT_INSTRUCTOR_USERNAME || 'admin',
            process.env.DEFAULT_INSTRUCTOR_NAME || 'Super Instructor',
            hash,
            'superadmin'
          ],
          (err) => {
            if (err) console.error('Superadmin insert error:', err);
            else console.log('Superadmin ready');
          }
        );

        // 5. Seed one example lab (only if labs table is empty)
        db.get(`SELECT COUNT(*) AS count FROM labs`, (err, row) => {
          if (!err && row.count === 0) {
            db.run(
              `INSERT INTO labs (title, description, description_markdown, hint, difficulty, lab_type, flag, score)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                'Intro Brute Force',
                'Find the admin by brute force.',
                '# Intro Brute Force\nFind the admin by brute force.\n\n- Try enumeration\n- Use a wordlist',
                'Try common admin-like usernames and short passwords.',
                'easy',
                'exercise',
                'FLAG-BRUTE-EXAMPLE-001',
                100
              ],
              () => console.log('Example lab seeded')
            );
          }
        });

        console.log('Database initialization complete!');
        resolve();
      } catch (err) {
        reject(err);
      }
    });
  });
}

// Run only when executed directly
if (require.main === module) {
  initDB()
    .then(() => {
      console.log('All done!');
      db.close();
      process.exit(0);
    })
    .catch((err) => {
      console.error('Init failed:', err);
      db.close();
      process.exit(1);
    });
}

module.exports = initDB;
