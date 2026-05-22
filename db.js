const { createClient } = require('@libsql/client');
const bcrypt = require('bcryptjs');

const db = createClient({
  url: process.env.TURSO_URL || 'file:data/dfdm.db',
  authToken: process.env.TURSO_TOKEN || ''
});

async function initDB() {
  // Users
  await db.execute(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT DEFAULT 'member',
    qq TEXT DEFAULT '',
    phone TEXT DEFAULT '',
    avatar TEXT DEFAULT '',
    title TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now','localtime'))
  )`);

  // Sessions
  await db.execute(`CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    token TEXT UNIQUE NOT NULL,
    created_at TEXT DEFAULT (datetime('now','localtime')),
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`);

  // Monthly issues
  await db.execute(`CREATE TABLE IF NOT EXISTS monthly_issues (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    publish_date TEXT,
    cover TEXT,
    content TEXT,
    images TEXT DEFAULT '[]',
    author_id INTEGER,
    cn TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now','localtime')),
    FOREIGN KEY (author_id) REFERENCES users(id)
  )`);

  // Fanworks
  await db.execute(`CREATE TABLE IF NOT EXISTS fanwork_submissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tag1 TEXT,
    tag2 TEXT,
    images TEXT DEFAULT '[]',
    text TEXT,
    status TEXT DEFAULT 'pending',
    author_id INTEGER,
    likes INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now','localtime')),
    FOREIGN KEY (author_id) REFERENCES users(id)
  )`);

  // Market items
  await db.execute(`CREATE TABLE IF NOT EXISTS market_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    price TEXT,
    qq TEXT,
    tag TEXT,
    ip TEXT,
    images TEXT DEFAULT '[]',
    text TEXT,
    status TEXT DEFAULT 'pending',
    author_id INTEGER,
    created_at TEXT DEFAULT (datetime('now','localtime')),
    FOREIGN KEY (author_id) REFERENCES users(id)
  )`);

  // Guestbook
  await db.execute(`CREATE TABLE IF NOT EXISTS guestbook_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    author_id INTEGER,
    title TEXT,
    text TEXT NOT NULL,
    parent_id INTEGER,
    created_at TEXT DEFAULT (datetime('now','localtime')),
    FOREIGN KEY (author_id) REFERENCES users(id)
  )`);

  // Notifications
  await db.execute(`CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    type TEXT NOT NULL,
    content TEXT,
    related_id INTEGER,
    read INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now','localtime')),
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`);

  // Comments
  await db.execute(`CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    target_type TEXT NOT NULL,
    target_id INTEGER NOT NULL,
    author_id INTEGER,
    text TEXT NOT NULL,
    parent_id INTEGER,
    created_at TEXT DEFAULT (datetime('now','localtime')),
    FOREIGN KEY (author_id) REFERENCES users(id)
  )`);

  // Activities
  await db.execute(`CREATE TABLE IF NOT EXISTS activities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    event_date TEXT NOT NULL,
    description TEXT DEFAULT '',
    status TEXT DEFAULT 'upcoming',
    cover TEXT DEFAULT '',
    cn TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now','localtime'))
  )`);

  // Announcements
  await db.execute(`CREATE TABLE IF NOT EXISTS announcements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    content TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now','localtime'))
  )`);

  // Admin account
  const adminCheck = await db.execute('SELECT id FROM users WHERE username = ?', ['dfdm']);
  if (adminCheck.rows.length === 0) {
    const hash = bcrypt.hashSync('114514', 10);
    await db.execute('INSERT INTO users (username, password, role) VALUES (?, ?, ?)', ['dfdm', hash, 'admin']);
    console.log('Admin account created: dfdm / 114514');
  }
}

module.exports = { db, initDB };
