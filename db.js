const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL 未设置，请在 Railway 上添加 PostgreSQL 插件或设置环境变量');
  process.exit(1);
}

const isNeon = process.env.DATABASE_URL.includes('neon.tech');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isNeon ? { rejectUnauthorized: false } : false
});

// Ensure every connection uses Beijing time (UTC+8)
pool.on('connect', async (client) => {
  await client.query("SET timezone = 'Asia/Shanghai'");
});

async function query(sql, params = []) {
  const result = await pool.query(sql, params);
  return { rows: result.rows, rowCount: result.rowCount };
}

async function initDB() {
  // Set Beijing timezone for this session
  await query("SET timezone = 'Asia/Shanghai'");

  // One-time: migrate existing UTC timestamps to Beijing time (UTC+8)
  const migrationDone = (await query("SELECT value FROM site_stats WHERE key = 'tz_migrated'")).rows[0];
  if (!migrationDone) {
    const tables = ['users', 'sessions', 'monthly_issues', 'fanwork_submissions', 'market_items',
      'guestbook_messages', 'notifications', 'comments', 'activities', 'post_likes', 'announcements', 'site_stats'];
    for (const t of tables) {
      await query(`UPDATE ${t} SET created_at = created_at + INTERVAL '8 hours' WHERE created_at IS NOT NULL`);
    }
    await query("INSERT INTO site_stats (key, value) VALUES ('tz_migrated', '1') ON CONFLICT (key) DO NOTHING");
    console.log('Migrated existing timestamps to Beijing time (UTC+8)');
  }

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
    text TEXT NOT NULL, parent_id INTEGER, images TEXT DEFAULT '[]',
    created_at TIMESTAMP DEFAULT NOW())`);
  await query(`ALTER TABLE guestbook_messages ADD COLUMN IF NOT EXISTS images TEXT DEFAULT '[]'`);

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

  // Site stats
  await query(`CREATE TABLE IF NOT EXISTS site_stats (
    id SERIAL PRIMARY KEY, key TEXT UNIQUE NOT NULL,
    value TEXT NOT NULL, updated_at TIMESTAMP DEFAULT NOW())`);
  // Seed default stats if empty
  const statsExist = await query('SELECT id FROM site_stats LIMIT 1');
  if (statsExist.rows.length === 0) {
    await query("INSERT INTO site_stats (key, value) VALUES ('members', '328'), ('works', '1247'), ('events', '56'), ('months', '12')");
  }

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
