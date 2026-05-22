const express = require('express');
const { db } = require('../db');
const { adminRequired } = require('../middleware/auth');
const router = express.Router();

// Public: list all announcements
router.get('/', async (req, res) => {
  const result = await db.execute('SELECT * FROM announcements ORDER BY created_at DESC');
  res.json(result.rows);
});

// Admin: create
router.post('/', adminRequired, async (req, res) => {
  const { content } = req.body;
  if (!content || !content.trim()) return res.status(400).json({ error: '请输入公告内容' });
  const result = await db.execute('INSERT INTO announcements (content) VALUES (?)', [content.trim()]);
  res.json({ id: Number(result.lastInsertRowid) });
});

// Admin: update
router.put('/:id', adminRequired, async (req, res) => {
  const { content } = req.body;
  if (!content || !content.trim()) return res.status(400).json({ error: '请输入公告内容' });
  const existingResult = await db.execute('SELECT * FROM announcements WHERE id = ?', [req.params.id]);
  const existing = existingResult.rows[0];
  if (!existing) return res.status(404).json({ error: '公告不存在' });
  await db.execute('UPDATE announcements SET content = ? WHERE id = ?', [content.trim(), req.params.id]);
  res.json({ ok: true });
});

// Admin: delete
router.delete('/:id', adminRequired, async (req, res) => {
  await db.execute('DELETE FROM announcements WHERE id = ?', [req.params.id]);
  res.json({ ok: true });
});

module.exports = router;
