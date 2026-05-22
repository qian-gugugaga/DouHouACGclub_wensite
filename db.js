const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

let db;

if (process.env.TURSO_URL) {
  // Turso cloud mode
  const { createClient } = require('@libsql/client');
  db = createClient({
    url: process.env.TURSO_URL,
    authToken: process.env.TURSO_TOKEN || ''
  });
  console.log('Using Turso cloud database');
} else {
  // Local SQLite mode
  const Database = require('better-sqlite3');
  const dataDir = path.join(__dirname, 'data');
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  const localDb = new Database(path.join(dataDir, 'dfdm.db'));
  localDb.pragma('journal_mode = WAL');
  localDb.pragma('foreign_keys = ON');
  // Wrap better-sqlite3 to same API as libsql
  db = {
    execute: async (sql, params) => {
      const stmt = localDb.prepare(sql);
      if (sql.trim().toUpperCase().startsWith('SELECT')) {
        const rows = params ? stmt.all(...(Array.isArray(params) ? params : [params])) : stmt.all();
        return { rows };
      } else {
        const result = params ? stmt.run(...(Array.isArray(params) ? params : [params])) : stmt.run();
        return { rows: [], lastInsertRowid: result.lastInsertRowid, changes: result.changes };
      }
    }
  };
  console.log('Using local SQLite database');
}

async function initDB() {
  const tables = [
    `CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL, role TEXT DEFAULT 'member', qq TEXT DEFAULT '',
      phone TEXT DEFAULT '', avatar TEXT DEFAULT '', title TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now','localtime')))`,
    `CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL,
      token TEXT UNIQUE NOT NULL, created_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (user_id) REFERENCES users(id))`,
    `CREATE TABLE IF NOT EXISTS monthly_issues (
      id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, publish_date TEXT,
      cover TEXT, content TEXT, images TEXT DEFAULT '[]', author_id INTEGER,
      cn TEXT DEFAULT '', created_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (author_id) REFERENCES users(id))`,
    `CREATE TABLE IF NOT EXISTS fanwork_submissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT, tag1 TEXT, tag2 TEXT,
      images TEXT DEFAULT '[]', text TEXT, status TEXT DEFAULT 'pending',
      author_id INTEGER, likes INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (author_id) REFERENCES users(id))`,
    `CREATE TABLE IF NOT EXISTS market_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, price TEXT,
      qq TEXT, tag TEXT, ip TEXT, images TEXT DEFAULT '[]', text TEXT,
      status TEXT DEFAULT 'pending', author_id INTEGER,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (author_id) REFERENCES users(id))`,
    `CREATE TABLE IF NOT EXISTS guestbook_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT, author_id INTEGER, title TEXT,
      text TEXT NOT NULL, parent_id INTEGER,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (author_id) REFERENCES users(id))`,
    `CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL,
      type TEXT NOT NULL, content TEXT, related_id INTEGER,
      read INTEGER DEFAULT 0, created_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (user_id) REFERENCES users(id))`,
    `CREATE TABLE IF NOT EXISTS comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT, target_type TEXT NOT NULL,
      target_id INTEGER NOT NULL, author_id INTEGER, text TEXT NOT NULL,
      parent_id INTEGER, created_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (author_id) REFERENCES users(id))`,
    `CREATE TABLE IF NOT EXISTS activities (
      id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL,
      event_date TEXT NOT NULL, description TEXT DEFAULT '',
      status TEXT DEFAULT 'upcoming', cover TEXT DEFAULT '', cn TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now','localtime')))`,
    `CREATE TABLE IF NOT EXISTS post_likes (
      id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL,
      post_id INTEGER NOT NULL, created_at TEXT DEFAULT (datetime('now','localtime')),
      UNIQUE(user_id, post_id))`,
    `CREATE TABLE IF NOT EXISTS announcements (
      id INTEGER PRIMARY KEY AUTOINCREMENT, content TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now','localtime')))`
  ];

  for (const sql of tables) {
    await db.execute(sql);
  }

  const adminCheck = await db.execute('SELECT id FROM users WHERE username = ?', ['dfdm']);
  if (adminCheck.rows.length === 0) {
    const hash = bcrypt.hashSync('114514', 10);
    await db.execute('INSERT INTO users (username, password, role) VALUES (?, ?, ?)', ['dfdm', hash, 'admin']);
    console.log('Admin account created: dfdm / 114514');
  }
}

module.exports = { db, initDB };
