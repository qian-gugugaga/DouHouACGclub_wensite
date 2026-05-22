const express = require('express');
const { query } = require('../db');
const { adminRequired } = require('../middleware/auth');
const router = express.Router();

// Public: list all announcements
router.get('/', async (req, res) => {
  const result = await query('SELECT * FROM announcements ORDER BY created_at DESC');
  res.json(result.rows);
});

// Admin: create
router.post('/', adminRequired, async (req, res) => {
  const { content } = req.body;
  if (!content || !content.trim()) return res.status(400).json({ error: '请输入公告内容' });
  const result = await query(
    'INSERT INTO announcements (content) VALUES ($1) RETURNING id',
    [content.trim()]
  );
  res.json({ id: result.rows[0].id });
});

// Admin: update
router.put('/:id', adminRequired, async (req, res) => {
  const { content } = req.body;
  if (!content || !content.trim()) return res.status(400).json({ error: '请输入公告内容' });
  const existingResult = await query('SELECT * FROM announcements WHERE id = $1', [req.params.id]);
  const existing = existingResult.rows[0];
  if (!existing) return res.status(404).json({ error: '公告不存在' });
  await query('UPDATE announcements SET content = $1 WHERE id = $2', [content.trim(), req.params.id]);
  res.json({ ok: true });
});

// Admin: delete
router.delete('/:id', adminRequired, async (req, res) => {
  await query('DELETE FROM announcements WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
});

module.exports = router;
