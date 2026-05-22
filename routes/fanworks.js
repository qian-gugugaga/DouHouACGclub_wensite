const express = require('express');
const { db } = require('../db');
const { authRequired, adminRequired } = require('../middleware/auth');
const router = express.Router();

router.get('/', async (req, res) => {
  const result = await db.execute("SELECT f.*, u.username as author_name, u.title as author_title FROM fanwork_submissions f LEFT JOIN users u ON f.author_id = u.id WHERE f.status = 'approved' ORDER BY f.created_at DESC");
  res.json(result.rows.map(s => ({ ...s, images: JSON.parse(s.images || '[]') })));
});

router.get('/mine', authRequired, async (req, res) => {
  const result = await db.execute("SELECT f.*, u.username as author_name, u.title as author_title FROM fanwork_submissions f LEFT JOIN users u ON f.author_id = u.id WHERE f.author_id = ? ORDER BY f.created_at DESC", [req.user.id]);
  res.json(result.rows.map(s => ({ ...s, images: JSON.parse(s.images || '[]') })));
});

router.post('/', authRequired, async (req, res) => {
  const { tag1, tag2, images, text } = req.body;
  if (!tag1 || !tag2) return res.status(400).json({ error: '请选择标签' });
  if (!images || images.length === 0) return res.status(400).json({ error: '请上传图片' });
  if (!text) return res.status(400).json({ error: '请输入正文' });
  const result = await db.execute(
    'INSERT INTO fanwork_submissions (tag1, tag2, images, text, author_id) VALUES (?, ?, ?, ?, ?)',
    [tag1, tag2, JSON.stringify(images), text, req.user.id]
  );
  res.json({ id: Number(result.lastInsertRowid) });
});

router.get('/pending', adminRequired, async (req, res) => {
  const result = await db.execute("SELECT f.*, u.username as author_name, u.title as author_title FROM fanwork_submissions f LEFT JOIN users u ON f.author_id = u.id WHERE f.status = 'pending' ORDER BY f.created_at DESC");
  res.json(result.rows.map(s => ({ ...s, images: JSON.parse(s.images || '[]') })));
});

router.put('/:id/approve', adminRequired, async (req, res) => {
  await db.execute("UPDATE fanwork_submissions SET status = 'approved' WHERE id = ?", [req.params.id]);
  const result = await db.execute('SELECT * FROM fanwork_submissions WHERE id = ?', [req.params.id]);
  const sub = result.rows[0];
  if (sub) {
    await db.execute("INSERT INTO notifications (user_id, type, content, related_id) VALUES (?, 'approve', ?, ?)", [sub.author_id, '你的创作投稿已通过审核', sub.id]);
  }
  res.json({ ok: true });
});

router.put('/:id/reject', adminRequired, async (req, res) => {
  await db.execute("UPDATE fanwork_submissions SET status = 'rejected' WHERE id = ?", [req.params.id]);
  res.json({ ok: true });
});

router.delete('/:id', authRequired, async (req, res) => {
  const result = await db.execute('SELECT * FROM fanwork_submissions WHERE id = ? AND author_id = ?', [req.params.id, req.user.id]);
  if (!result.rows[0]) return res.status(404).json({ error: '作品不存在或无权删除' });
  await db.execute('DELETE FROM fanwork_submissions WHERE id = ?', [req.params.id]);
  await db.execute('DELETE FROM comments WHERE target_type = ? AND target_id = ?', ['fanwork', req.params.id]);
  res.json({ ok: true });
});

module.exports = router;
