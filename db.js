const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function query(sql, params = []) {
  const result = await pool.query(sql, params);
  return { rows: result.rows, rowCount: result.rowCount };
}

async function initDB() {
  // Users
  await query(`CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY, username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL, role TEXT DEFAULT 'member', qq TEXT DEFAULT '',
    phone TEXT DEFAULT '', avatar TEXT DEFAULT '', title TEXT DEFAULT '',
    created_at TIMESTAMP DEFAULT NOW())`);

  // Sessions
  await query(`CREATE TABLE IF NOT EXISTS sessions (
    id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id),
    token TEXT UNIQUE NOT NULL, created_at TIMESTAMP DEFAULT NOW())`);

  // Monthly issues
  await query(`CREATE TABLE IF NOT EXISTS monthly_issues (
    id SERIAL PRIMARY KEY, title TEXT NOT NULL, publish_date TEXT,
    cover TEXT, content TEXT, images TEXT DEFAULT '[]', author_id INTEGER,
    cn TEXT DEFAULT '', created_at TIMESTAMP DEFAULT NOW())`);

  // Fanworks
  await query(`CREATE TABLE IF NOT EXISTS fanwork_submissions (
    id SERIAL PRIMARY KEY, tag1 TEXT, tag2 TEXT,
    images TEXT DEFAULT '[]', text TEXT, status TEXT DEFAULT 'pending',
    author_id INTEGER, likes INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW())`);

  // Market items
  await query(`CREATE TABLE IF NOT EXISTS market_items (
    id SERIAL PRIMARY KEY, title TEXT NOT NULL, price TEXT,
    qq TEXT, tag TEXT, ip TEXT, images TEXT DEFAULT '[]', text TEXT,
    status TEXT DEFAULT 'pending', author_id INTEGER,
    created_at TIMESTAMP DEFAULT NOW())`);

  // Guestbook
  await query(`CREATE TABLE IF NOT EXISTS guestbook_messages (
    id SERIAL PRIMARY KEY, author_id INTEGER, title TEXT,
    text TEXT NOT NULL, parent_id INTEGER,
    created_at TIMESTAMP DEFAULT NOW())`);

  // Notifications
  await query(`CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL,
    type TEXT NOT NULL, content TEXT, related_id INTEGER,
    read INTEGER DEFAULT 0, created_at TIMESTAMP DEFAULT NOW())`);

  // Comments
  await query(`CREATE TABLE IF NOT EXISTS comments (
    id SERIAL PRIMARY KEY, target_type TEXT NOT NULL,
    target_id INTEGER NOT NULL, author_id INTEGER, text TEXT NOT NULL,
    parent_id INTEGER, created_at TIMESTAMP DEFAULT NOW())`);

  // Activities
  await query(`CREATE TABLE IF NOT EXISTS activities (
    id SERIAL PRIMARY KEY, title TEXT NOT NULL,
    event_date TEXT NOT NULL, description TEXT DEFAULT '',
    status TEXT DEFAULT 'upcoming', cover TEXT DEFAULT '', cn TEXT DEFAULT '',
    created_at TIMESTAMP DEFAULT NOW())`);

  // Post likes
  await query(`CREATE TABLE IF NOT EXISTS post_likes (
    id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL,
    post_id INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, post_id))`);

  // Announcements
  await query(`CREATE TABLE IF NOT EXISTS announcements (
    id SERIAL PRIMARY KEY, content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW())`);

  // Admin account
  const adminCheck = await query('SELECT id FROM users WHERE username = $1', ['dfdm']);
  if (adminCheck.rows.length === 0) {
    const hash = bcrypt.hashSync('114514', 10);
    await query('INSERT INTO users (username, password, role) VALUES ($1, $2, $3)', ['dfdm', hash, 'admin']);
    console.log('Admin account created: dfdm / 114514');
  }

  console.log('Database initialized');
}

module.exports = { query, initDB, pool };
