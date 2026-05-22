const express = require('express');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { authRequired } = require('../middleware/auth');
const router = express.Router();

router.post('/register', (req, res) => {
  const { username, password, password2, phone, qq } = req.body;
  if (!username || !password) return res.status(400).json({ error: '用户名和密码不能为空' });
  if (username.length < 2 || username.length > 20) return res.status(400).json({ error: '用户名2-20个字符' });
  if (password.length < 4) return res.status(400).json({ error: '密码至少4位' });
  if (password !== password2) return res.status(400).json({ error: '两次密码输入不一致' });
  if (!phone || !/^\d{6,15}$/.test(phone)) return res.status(400).json({ error: '请输入正确的手机号' });
  if (!qq || !/^\d{5,20}$/.test(qq)) return res.status(400).json({ error: '请输入正确的QQ号' });
  const exists = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (exists) return res.status(400).json({ error: '用户名已被注册' });
  const hash = bcrypt.hashSync(password, 10);
  const result = db.prepare('INSERT INTO users (username, password, phone, qq) VALUES (?, ?, ?, ?)').run(username, hash, phone, qq || '');
  res.json({ id: result.lastInsertRowid, username });
});

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: '账号或密码错误' });
  }
  const token = uuidv4();
  db.prepare('INSERT INTO sessions (user_id, token) VALUES (?, ?)').run(user.id, token);
  res.json({ token, user: { id: user.id, username: user.username, role: user.role } });
});

router.get('/me', authRequired, (req, res) => {
  const user = db.prepare('SELECT id, username, role, qq, phone, avatar, title, created_at FROM users WHERE id = ?').get(req.user.id);
  res.json({ user });
});

router.put('/profile', authRequired, (req, res) => {
  const { username, avatar } = req.body;
  if (username && username !== req.user.username) {
    if (username.length < 2 || username.length > 20) return res.status(400).json({ error: '用户名2-20个字符' });
    const exists = db.prepare('SELECT id FROM users WHERE username = ? AND id != ?').get(username, req.user.id);
    if (exists) return res.status(400).json({ error: '用户名已被使用' });
    db.prepare('UPDATE users SET username = ? WHERE id = ?').run(username, req.user.id);
  }
  if (avatar !== undefined) db.prepare('UPDATE users SET avatar = ? WHERE id = ?').run(avatar || '', req.user.id);
  res.json({ ok: true });
});

// Security: change password (requires QQ + phone verification if set)
router.put('/security/password', authRequired, (req, res) => {
  const { qq, phone, newPassword } = req.body;
  const user = db.prepare('SELECT qq, phone FROM users WHERE id = ?').get(req.user.id);
  if (user.qq && user.qq !== qq) return res.status(400).json({ error: 'QQ号验证失败' });
  if (user.phone && user.phone !== phone) return res.status(400).json({ error: '手机号验证失败' });
  if (!newPassword || newPassword.length < 4) return res.status(400).json({ error: '新密码至少4位' });
  const hash = bcrypt.hashSync(newPassword, 10);
  db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hash, req.user.id);
  res.json({ ok: true });
});

// Security: change QQ (skip verification if no original QQ)
router.put('/security/qq', authRequired, (req, res) => {
  const { oldQQ, newQQ } = req.body;
  const user = db.prepare('SELECT qq FROM users WHERE id = ?').get(req.user.id);
  if (user.qq && user.qq !== oldQQ) return res.status(400).json({ error: '原QQ号验证失败' });
  db.prepare('UPDATE users SET qq = ? WHERE id = ?').run(newQQ || '', req.user.id);
  res.json({ ok: true });
});

// Security: change phone (skip verification if no original phone)
router.put('/security/phone', authRequired, (req, res) => {
  const { oldPhone, newPhone } = req.body;
  const user = db.prepare('SELECT phone FROM users WHERE id = ?').get(req.user.id);
  if (user.phone && user.phone !== oldPhone) return res.status(400).json({ error: '原手机号验证失败' });
  if (!newPhone || !/^\d{6,15}$/.test(newPhone)) return res.status(400).json({ error: '请输入正确的手机号' });
  db.prepare('UPDATE users SET phone = ? WHERE id = ?').run(newPhone || '', req.user.id);
  res.json({ ok: true });
});

// Admin: search users
router.get('/users/search', authRequired, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: '需要管理员权限' });
  const { q } = req.query;
  if (!q) return res.json({ users: [] });
  const users = db.prepare('SELECT id, username, role, qq, phone, title, created_at FROM users WHERE username LIKE ? LIMIT 20').all('%' + q + '%');
  res.json({ users });
});

// Admin: set user title
router.put('/users/:id/title', authRequired, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: '需要管理员权限' });
  const { title } = req.body;
  db.prepare('UPDATE users SET title = ? WHERE id = ?').run(title || '', req.params.id);
  res.json({ ok: true });
});

// Get user profile by ID (public)
router.get('/profile/:id', (req, res) => {
  const user = db.prepare('SELECT id, username, role, avatar, title, created_at FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: '用户不存在' });

  const fanworks = db.prepare("SELECT id, tag1, tag2, text, images, status, created_at FROM fanwork_submissions WHERE author_id = ? AND status = 'approved' ORDER BY created_at DESC").all(req.params.id);
  const marketItems = db.prepare("SELECT id, title, price, tag, ip, images, text, status, created_at FROM market_items WHERE author_id = ? AND status = 'approved' ORDER BY created_at DESC").all(req.params.id);
  const threads = db.prepare("SELECT id, title, text, created_at FROM guestbook_messages WHERE author_id = ? AND parent_id IS NULL ORDER BY created_at DESC").all(req.params.id);
  const replies = db.prepare("SELECT id, text, parent_id, created_at FROM guestbook_messages WHERE author_id = ? AND parent_id IS NOT NULL ORDER BY created_at DESC").all(req.params.id);

  res.json({
    user,
    fanworks: fanworks.map(f => ({ ...f, images: JSON.parse(f.images || '[]') })),
    marketItems: marketItems.map(m => ({ ...m, images: JSON.parse(m.images || '[]') })),
    threads,
    replies,
    totalPosts: fanworks.length + marketItems.length + threads.length
  });
});

router.post('/logout', authRequired, (req, res) => {
  db.prepare('DELETE FROM sessions WHERE token = ?').run(req.headers.authorization);
  res.json({ ok: true });
});

module.exports = router;
