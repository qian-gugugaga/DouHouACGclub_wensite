const express = require('express');
const db = require('../db');
const { adminRequired } = require('../middleware/auth');
const router = express.Router();

// Public: list all announcements
router.get('/', (req, res) => {
  const list = db.prepare('SELECT * FROM announcements ORDER BY created_at DESC').all();
  res.json(list);
});

// Admin: create
router.post('/', adminRequired, (req, res) => {
  const { content } = req.body;
  if (!content || !content.trim()) return res.status(400).json({ error: '请输入公告内容' });
  const result = db.prepare('INSERT INTO announcements (content) VALUES (?)').run(content.trim());
  res.json({ id: result.lastInsertRowid });
});

// Admin: update
router.put('/:id', adminRequired, (req, res) => {
  const { content } = req.body;
  if (!content || !content.trim()) return res.status(400).json({ error: '请输入公告内容' });
  const existing = db.prepare('SELECT * FROM announcements WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: '公告不存在' });
  db.prepare('UPDATE announcements SET content = ? WHERE id = ?').run(content.trim(), req.params.id);
  res.json({ ok: true });
});

// Admin: delete
router.delete('/:id', adminRequired, (req, res) => {
  db.prepare('DELETE FROM announcements WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
