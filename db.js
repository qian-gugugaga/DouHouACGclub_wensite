const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'data', 'dfdm.db'));

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT DEFAULT 'member',
    qq TEXT DEFAULT '',
    phone TEXT DEFAULT '',
    avatar TEXT DEFAULT '',
    title TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    token TEXT UNIQUE NOT NULL,
    created_at TEXT DEFAULT (datetime('now','localtime')),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS monthly_issues (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    publish_date TEXT,
    cover TEXT,
    content TEXT,
    images TEXT DEFAULT '[]',
    author_id INTEGER,
    created_at TEXT DEFAULT (datetime('now','localtime')),
    FOREIGN KEY (author_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS fanwork_submissions (
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
  );

  CREATE TABLE IF NOT EXISTS market_items (
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
  );

  CREATE TABLE IF NOT EXISTS guestbook_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    author_id INTEGER,
    title TEXT,
    text TEXT NOT NULL,
    parent_id INTEGER,
    created_at TEXT DEFAULT (datetime('now','localtime')),
    FOREIGN KEY (author_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    type TEXT NOT NULL,
    content TEXT,
    related_id INTEGER,
    read INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now','localtime')),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
`);

// Migration: add title column to guestbook_messages
try { db.exec('ALTER TABLE guestbook_messages ADD COLUMN title TEXT'); } catch(e) {}
// Migration: add qq/avatar to users
try { db.exec('ALTER TABLE users ADD COLUMN qq TEXT DEFAULT \'\''); } catch(e) {}
try { db.exec('ALTER TABLE users ADD COLUMN avatar TEXT DEFAULT \'\''); } catch(e) {}
try { db.exec('ALTER TABLE users ADD COLUMN phone TEXT DEFAULT \'\''); } catch(e) {}
try { db.exec('ALTER TABLE users ADD COLUMN title TEXT DEFAULT \'\''); } catch(e) {}

// Comments table for fanworks & market
db.exec(`
  CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    target_type TEXT NOT NULL,
    target_id INTEGER NOT NULL,
    author_id INTEGER,
    text TEXT NOT NULL,
    parent_id INTEGER,
    created_at TEXT DEFAULT (datetime('now','localtime')),
    FOREIGN KEY (author_id) REFERENCES users(id)
  );
`);

// Activities table
db.exec(`
  CREATE TABLE IF NOT EXISTS activities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    event_date TEXT NOT NULL,
    description TEXT DEFAULT '',
    status TEXT DEFAULT 'upcoming',
    cover TEXT DEFAULT '',
    cn TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now','localtime'))
  );
`);

// Migration: add cn to monthly_issues
try { db.exec('ALTER TABLE monthly_issues ADD COLUMN cn TEXT DEFAULT \'\''); } catch(e) {}
// Migration: add cn to activities
try { db.exec('ALTER TABLE activities ADD COLUMN cn TEXT DEFAULT \'\''); } catch(e) {}

// Ensure admin account exists
const bcrypt = require('bcryptjs');
const adminUser = db.prepare('SELECT id FROM users WHERE username = ?').get('dfdm');
if (!adminUser) {
  const hash = bcrypt.hashSync('114514', 10);
  db.prepare('INSERT INTO users (username, password, role) VALUES (?, ?, ?)').run('dfdm', hash, 'admin');
  console.log('Admin account created: dfdm / 114514');
}

module.exports = db;
