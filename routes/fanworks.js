const express = require('express');
const { query } = require('../db');
const { authRequired, adminRequired } = require('../middleware/auth');
const router = express.Router();

router.get('/', async (req, res) => {
  const result = await query(
    `SELECT f.*, u.username as author_name, u.title as author_title
     FROM fanwork_submissions f
     LEFT JOIN users u ON f.author_id = u.id
     WHERE f.status = 'approved'
     ORDER BY f.created_at DESC`
  );
  res.json(result.rows.map(s => ({ ...s, images: JSON.parse(s.images || '[]') })));
});

router.get('/mine', authRequired, async (req, res) => {
  const result = await query(
    `SELECT f.*, u.username as author_name, u.title as author_title
     FROM fanwork_submissions f
     LEFT JOIN users u ON f.author_id = u.id
     WHERE f.author_id = $1
     ORDER BY f.created_at DESC`,
    [req.user.id]
  );
  res.json(result.rows.map(s => ({ ...s, images: JSON.parse(s.images || '[]') })));
});

router.post('/', authRequired, async (req, res) => {
  const { tag1, tag2, images, text } = req.body;
  if (!tag1 || !tag2) return res.status(400).json({ error: '请选择标签' });
  if (!images || images.length === 0) return res.status(400).json({ error: '请上传图片' });
  if (!text) return res.status(400).json({ error: '请输入正文' });
  const result = await query(
    'INSERT INTO fanwork_submissions (tag1, tag2, images, text, author_id) VALUES ($1, $2, $3, $4, $5) RETURNING id',
    [tag1, tag2, JSON.stringify(images), text, req.user.id]
  );
  res.json({ id: result.rows[0].id });
});

router.get('/pending', adminRequired, async (req, res) => {
  const result = await query(
    `SELECT f.*, u.username as author_name, u.title as author_title
     FROM fanwork_submissions f
     LEFT JOIN users u ON f.author_id = u.id
     WHERE f.status = 'pending'
     ORDER BY f.created_at DESC`
  );
  res.json(result.rows.map(s => ({ ...s, images: JSON.parse(s.images || '[]') })));
});

router.put('/:id/approve', adminRequired, async (req, res) => {
  await query(
    "UPDATE fanwork_submissions SET status = 'approved' WHERE id = $1",
    [req.params.id]
  );
  const result = await query(
    'SELECT * FROM fanwork_submissions WHERE id = $1',
    [req.params.id]
  );
  const sub = result.rows[0];
  if (sub) {
    await query(
      'INSERT INTO notifications (user_id, type, content, related_id) VALUES ($1, $2, $3, $4)',
      [sub.author_id, 'approve', '你的创作投稿已通过审核', sub.id]
    );
  }
  res.json({ ok: true });
});

router.put('/:id/reject', adminRequired, async (req, res) => {
  await query(
    "UPDATE fanwork_submissions SET status = 'rejected' WHERE id = $1",
    [req.params.id]
  );
  res.json({ ok: true });
});

router.delete('/:id', authRequired, async (req, res) => {
  const result = await query(
    'SELECT * FROM fanwork_submissions WHERE id = $1 AND author_id = $2',
    [req.params.id, req.user.id]
  );
  if (!result.rows[0]) return res.status(404).json({ error: '作品不存在或无权删除' });
  await query(
    'DELETE FROM fanwork_submissions WHERE id = $1',
    [req.params.id]
  );
  await query(
    'DELETE FROM comments WHERE target_type = $1 AND target_id = $2',
    ['fanwork', req.params.id]
  );
  res.json({ ok: true });
});

module.exports = router;
