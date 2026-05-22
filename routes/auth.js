const express = require('express');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { db } = require('../db');
const { authRequired } = require('../middleware/auth');
const router = express.Router();

router.post('/register', async (req, res) => {
  const { username, password, password2, phone, qq } = req.body;
  if (!username || !password) return res.status(400).json({ error: '用户名和密码不能为空' });
  if (username.length < 2 || username.length > 20) return res.status(400).json({ error: '用户名2-20个字符' });
  if (password.length < 4) return res.status(400).json({ error: '密码至少4位' });
  if (password !== password2) return res.status(400).json({ error: '两次密码输入不一致' });
  if (!phone || !/^\d{6,15}$/.test(phone)) return res.status(400).json({ error: '请输入正确的手机号' });
  if (!qq || !/^\d{5,20}$/.test(qq)) return res.status(400).json({ error: '请输入正确的QQ号' });
  const exists = (await db.execute('SELECT id FROM users WHERE username = ?', [username])).rows[0];
  if (exists) return res.status(400).json({ error: '用户名已被注册' });
  const hash = bcrypt.hashSync(password, 10);
  const result = await db.execute('INSERT INTO users (username, password, phone, qq) VALUES (?, ?, ?, ?)', [username, hash, phone, qq || '']);
  res.json({ id: Number(result.lastInsertRowid), username });
});

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const user = (await db.execute('SELECT * FROM users WHERE username = ?', [username])).rows[0];
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: '账号或密码错误' });
  }
  const token = uuidv4();
  await db.execute('INSERT INTO sessions (user_id, token) VALUES (?, ?)', [user.id, token]);
  res.json({ token, user: { id: user.id, username: user.username, role: user.role } });
});

router.get('/me', authRequired, async (req, res) => {
  const user = (await db.execute('SELECT id, username, role, qq, phone, avatar, title, created_at FROM users WHERE id = ?', [req.user.id])).rows[0];
  res.json({ user });
});

router.put('/profile', authRequired, async (req, res) => {
  const { username, avatar } = req.body;
  if (username && username !== req.user.username) {
    if (username.length < 2 || username.length > 20) return res.status(400).json({ error: '用户名2-20个字符' });
    const exists = (await db.execute('SELECT id FROM users WHERE username = ? AND id != ?', [username, req.user.id])).rows[0];
    if (exists) return res.status(400).json({ error: '用户名已被使用' });
    await db.execute('UPDATE users SET username = ? WHERE id = ?', [username, req.user.id]);
  }
  if (avatar !== undefined) await db.execute('UPDATE users SET avatar = ? WHERE id = ?', [avatar || '', req.user.id]);
  res.json({ ok: true });
});

// Security: change password (requires QQ + phone verification if set)
router.put('/security/password', authRequired, async (req, res) => {
  const { qq, phone, newPassword } = req.body;
  const user = (await db.execute('SELECT qq, phone FROM users WHERE id = ?', [req.user.id])).rows[0];
  if (user.qq && user.qq !== qq) return res.status(400).json({ error: 'QQ号验证失败' });
  if (user.phone && user.phone !== phone) return res.status(400).json({ error: '手机号验证失败' });
  if (!newPassword || newPassword.length < 4) return res.status(400).json({ error: '新密码至少4位' });
  const hash = bcrypt.hashSync(newPassword, 10);
  await db.execute('UPDATE users SET password = ? WHERE id = ?', [hash, req.user.id]);
  res.json({ ok: true });
});

// Security: change QQ (skip verification if no original QQ)
router.put('/security/qq', authRequired, async (req, res) => {
  const { oldQQ, newQQ } = req.body;
  const user = (await db.execute('SELECT qq FROM users WHERE id = ?', [req.user.id])).rows[0];
  if (user.qq && user.qq !== oldQQ) return res.status(400).json({ error: '原QQ号验证失败' });
  await db.execute('UPDATE users SET qq = ? WHERE id = ?', [newQQ || '', req.user.id]);
  res.json({ ok: true });
});

// Security: change phone (skip verification if no original phone)
router.put('/security/phone', authRequired, async (req, res) => {
  const { oldPhone, newPhone } = req.body;
  const user = (await db.execute('SELECT phone FROM users WHERE id = ?', [req.user.id])).rows[0];
  if (user.phone && user.phone !== oldPhone) return res.status(400).json({ error: '原手机号验证失败' });
  if (!newPhone || !/^\d{6,15}$/.test(newPhone)) return res.status(400).json({ error: '请输入正确的手机号' });
  await db.execute('UPDATE users SET phone = ? WHERE id = ?', [newPhone || '', req.user.id]);
  res.json({ ok: true });
});

// Admin: search users
// Admin only: list all members
router.get('/users', authRequired, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: '仅管理员可查看' });
  const users = (await db.execute('SELECT id, username, role, avatar, title, created_at FROM users ORDER BY id ASC')).rows;
  res.json({ users });
});

router.get('/users/search', authRequired, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: '需要管理员权限' });
  const { q } = req.query;
  const users = q
    ? (await db.execute('SELECT id, username, role, qq, phone, title, created_at FROM users WHERE username LIKE ? LIMIT 50', ['%' + q + '%'])).rows
    : (await db.execute('SELECT id, username, role, qq, phone, title, created_at FROM users ORDER BY id DESC LIMIT 50')).rows;
  res.json({ users });
});

// Admin: set user title
router.put('/users/:id/title', authRequired, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: '需要管理员权限' });
  const { title } = req.body;
  await db.execute('UPDATE users SET title = ? WHERE id = ?', [title || '', req.params.id]);
  res.json({ ok: true });
});

// Get user profile by ID (public)
router.get('/profile/:id', async (req, res) => {
  const user = (await db.execute('SELECT id, username, role, avatar, title, created_at FROM users WHERE id = ?', [req.params.id])).rows[0];
  if (!user) return res.status(404).json({ error: '用户不存在' });

  const fanworks = (await db.execute("SELECT id, tag1, tag2, text, images, status, created_at FROM fanwork_submissions WHERE author_id = ? AND status = 'approved' ORDER BY created_at DESC", [req.params.id])).rows;
  const marketItems = (await db.execute("SELECT id, title, price, tag, ip, images, text, status, created_at FROM market_items WHERE author_id = ? AND status = 'approved' ORDER BY created_at DESC", [req.params.id])).rows;
  const threads = (await db.execute("SELECT id, title, text, created_at FROM guestbook_messages WHERE author_id = ? AND parent_id IS NULL ORDER BY created_at DESC", [req.params.id])).rows;
  const replies = (await db.execute("SELECT id, text, parent_id, created_at FROM guestbook_messages WHERE author_id = ? AND parent_id IS NOT NULL ORDER BY created_at DESC", [req.params.id])).rows;

  res.json({
    user,
    fanworks: fanworks.map(f => ({ ...f, images: JSON.parse(f.images || '[]') })),
    marketItems: marketItems.map(m => ({ ...m, images: JSON.parse(m.images || '[]') })),
    threads,
    replies,
    totalPosts: fanworks.length + marketItems.length + threads.length
  });
});

router.post('/logout', authRequired, async (req, res) => {
  await db.execute('DELETE FROM sessions WHERE token = ?', [req.headers.authorization]);
  res.json({ ok: true });
});

module.exports = router;
