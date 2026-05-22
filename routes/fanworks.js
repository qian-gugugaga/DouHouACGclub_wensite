const express = require('express');
const db = require('../db');
const { authRequired, adminRequired } = require('../middleware/auth');
const router = express.Router();

router.get('/', (req, res) => {
  const subs = db.prepare("SELECT f.*, u.username as author_name, u.title as author_title FROM fanwork_submissions f LEFT JOIN users u ON f.author_id = u.id WHERE f.status = 'approved' ORDER BY f.created_at DESC").all();
  res.json(subs.map(s => ({ ...s, images: JSON.parse(s.images || '[]') })));
});

// Get current user's own submissions (all statuses)
router.get('/mine', authRequired, (req, res) => {
  const subs = db.prepare("SELECT f.*, u.username as author_name, u.title as author_title FROM fanwork_submissions f LEFT JOIN users u ON f.author_id = u.id WHERE f.author_id = ? ORDER BY f.created_at DESC").all(req.user.id);
  res.json(subs.map(s => ({ ...s, images: JSON.parse(s.images || '[]') })));
});

router.post('/', authRequired, (req, res) => {
  const { tag1, tag2, images, text } = req.body;
  if (!tag1 || !tag2) return res.status(400).json({ error: '请选择标签' });
  if (!images || images.length === 0) return res.status(400).json({ error: '请上传图片' });
  if (!text) return res.status(400).json({ error: '请输入正文' });
  const result = db.prepare(
    'INSERT INTO fanwork_submissions (tag1, tag2, images, text, author_id) VALUES (?, ?, ?, ?, ?)'
  ).run(tag1, tag2, JSON.stringify(images), text, req.user.id);
  res.json({ id: result.lastInsertRowid });
});

// Admin: list pending
router.get('/pending', adminRequired, (req, res) => {
  const subs = db.prepare("SELECT f.*, u.username as author_name, u.title as author_title FROM fanwork_submissions f LEFT JOIN users u ON f.author_id = u.id WHERE f.status = 'pending' ORDER BY f.created_at DESC").all();
  res.json(subs.map(s => ({ ...s, images: JSON.parse(s.images || '[]') })));
});

// Admin: approve
router.put('/:id/approve', adminRequired, (req, res) => {
  db.prepare("UPDATE fanwork_submissions SET status = 'approved' WHERE id = ?").run(req.params.id);
  const sub = db.prepare('SELECT * FROM fanwork_submissions WHERE id = ?').get(req.params.id);
  if (sub) {
    db.prepare("INSERT INTO notifications (user_id, type, content, related_id) VALUES (?, 'approve', ?, ?)").run(sub.author_id, '你的创作投稿已通过审核', sub.id);
  }
  res.json({ ok: true });
});

router.put('/:id/reject', adminRequired, (req, res) => {
  db.prepare("UPDATE fanwork_submissions SET status = 'rejected' WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

// User delete own fanwork
router.delete('/:id', authRequired, (req, res) => {
  const sub = db.prepare('SELECT * FROM fanwork_submissions WHERE id = ? AND author_id = ?').get(req.params.id, req.user.id);
  if (!sub) return res.status(404).json({ error: '作品不存在或无权删除' });
  db.prepare('DELETE FROM fanwork_submissions WHERE id = ?').run(req.params.id);
  db.prepare('DELETE FROM comments WHERE target_type = ? AND target_id = ?').run('fanwork', req.params.id);
  res.json({ ok: true });
});

module.exports = router;
