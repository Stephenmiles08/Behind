const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const db = new sqlite3.Database(path.join(__dirname, 'labs.db'), (err) => {
  if (err) console.error('DB Connection Error:', err);
  else console.log('Connected to SQLite database');
});

module.exports = db;
