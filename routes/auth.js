const express = require('express');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { query } = require('../db');
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
  const exists = (await query('SELECT id FROM users WHERE username = $1', [username])).rows[0];
  if (exists) return res.status(400).json({ error: '用户名已被注册' });
  const hash = bcrypt.hashSync(password, 10);
  const result = await query('INSERT INTO users (username, password, phone, qq) VALUES ($1, $2, $3, $4) RETURNING id', [username, hash, phone, qq || '']);
  res.json({ id: result.rows[0].id, username });
});

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const user = (await query('SELECT * FROM users WHERE username = $1', [username])).rows[0];
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: '账号或密码错误' });
  }
  const token = uuidv4();
  await query('INSERT INTO sessions (user_id, token) VALUES ($1, $2)', [user.id, token]);
  res.json({ token, user: { id: user.id, username: user.username, role: user.role } });
});

router.get('/me', authRequired, async (req, res) => {
  const user = (await query('SELECT id, username, role, qq, phone, avatar, title, created_at FROM users WHERE id = $1', [req.user.id])).rows[0];
  res.json({ user });
});

router.put('/profile', authRequired, async (req, res) => {
  const { username, avatar } = req.body;
  if (username && username !== req.user.username) {
    if (username.length < 2 || username.length > 20) return res.status(400).json({ error: '用户名2-20个字符' });
    const exists = (await query('SELECT id FROM users WHERE username = $1 AND id != $2', [username, req.user.id])).rows[0];
    if (exists) return res.status(400).json({ error: '用户名已被使用' });
    await query('UPDATE users SET username = $1 WHERE id = $2', [username, req.user.id]);
  }
  if (avatar !== undefined) await query('UPDATE users SET avatar = $1 WHERE id = $2', [avatar || '', req.user.id]);
  res.json({ ok: true });
});

// Security: change password (requires QQ + phone verification if set)
router.put('/security/password', authRequired, async (req, res) => {
  const { qq, phone, newPassword } = req.body;
  const user = (await query('SELECT qq, phone FROM users WHERE id = $1', [req.user.id])).rows[0];
  if (user.qq && user.qq !== qq) return res.status(400).json({ error: 'QQ号验证失败' });
  if (user.phone && user.phone !== phone) return res.status(400).json({ error: '手机号验证失败' });
  if (!newPassword || newPassword.length < 4) return res.status(400).json({ error: '新密码至少4位' });
  const hash = bcrypt.hashSync(newPassword, 10);
  await query('UPDATE users SET password = $1 WHERE id = $2', [hash, req.user.id]);
  res.json({ ok: true });
});

// Security: change QQ (skip verification if no original QQ)
router.put('/security/qq', authRequired, async (req, res) => {
  const { oldQQ, newQQ } = req.body;
  const user = (await query('SELECT qq FROM users WHERE id = $1', [req.user.id])).rows[0];
  if (user.qq && user.qq !== oldQQ) return res.status(400).json({ error: '原QQ号验证失败' });
  await query('UPDATE users SET qq = $1 WHERE id = $2', [newQQ || '', req.user.id]);
  res.json({ ok: true });
});

// Security: change phone (skip verification if no original phone)
router.put('/security/phone', authRequired, async (req, res) => {
  const { oldPhone, newPhone } = req.body;
  const user = (await query('SELECT phone FROM users WHERE id = $1', [req.user.id])).rows[0];
  if (user.phone && user.phone !== oldPhone) return res.status(400).json({ error: '原手机号验证失败' });
  if (!newPhone || !/^\d{6,15}$/.test(newPhone)) return res.status(400).json({ error: '请输入正确的手机号' });
  await query('UPDATE users SET phone = $1 WHERE id = $2', [newPhone || '', req.user.id]);
  res.json({ ok: true });
});

// Admin only: list all members
router.get('/users', authRequired, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: '仅管理员可查看' });
  const users = (await query('SELECT id, username, role, avatar, title, qq, phone, password, created_at FROM users ORDER BY id ASC')).rows;
  res.json({ users });
});

// Admin: search users
router.get('/users/search', authRequired, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: '需要管理员权限' });
  const { q, exact } = req.query;
  const users = q
    ? (exact
      ? (await query('SELECT id, username, role, qq, phone, password, title, created_at FROM users WHERE username = $1 LIMIT 1', [q])).rows
      : (await query('SELECT id, username, role, qq, phone, password, title, created_at FROM users WHERE username LIKE $1 LIMIT 50', ['%' + q + '%'])).rows)
    : (await query('SELECT id, username, role, qq, phone, password, title, created_at FROM users ORDER BY id DESC LIMIT 50')).rows;
  res.json({ users });
});

// Admin: set user title
router.put('/users/:id/title', authRequired, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: '需要管理员权限' });
  const { title } = req.body;
  await query('UPDATE users SET title = $1 WHERE id = $2', [title || '', req.params.id]);
  res.json({ ok: true });
});

// Get user profile by ID (public)
router.get('/profile/:id', async (req, res) => {
  const user = (await query('SELECT id, username, role, avatar, title, created_at FROM users WHERE id = $1', [req.params.id])).rows[0];
  if (!user) return res.status(404).json({ error: '用户不存在' });

  const fanworks = (await query("SELECT id, tag1, tag2, text, images, status, created_at FROM fanwork_submissions WHERE author_id = $1 AND status = 'approved' ORDER BY created_at DESC", [req.params.id])).rows;
  const marketItems = (await query("SELECT id, title, price, tag, ip, images, text, status, created_at FROM market_items WHERE author_id = $1 AND status = 'approved' ORDER BY created_at DESC", [req.params.id])).rows;
  const threads = (await query("SELECT id, title, text, created_at FROM guestbook_messages WHERE author_id = $1 AND parent_id IS NULL ORDER BY created_at DESC", [req.params.id])).rows;
  const replies = (await query("SELECT id, text, parent_id, created_at FROM guestbook_messages WHERE author_id = $1 AND parent_id IS NOT NULL ORDER BY created_at DESC", [req.params.id])).rows;

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
  await query('DELETE FROM sessions WHERE token = $1', [req.headers.authorization]);
  res.json({ ok: true });
});

module.exports = router;
