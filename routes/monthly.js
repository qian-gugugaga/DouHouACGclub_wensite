const express = require('express');
const db = require('../db');
const { authRequired, adminRequired } = require('../middleware/auth');
const router = express.Router();

router.get('/', (req, res) => {
  const issues = db.prepare('SELECT * FROM monthly_issues ORDER BY created_at DESC').all();
  res.json(issues.map(i => ({ ...i, images: JSON.parse(i.images || '[]') })));
});

router.post('/', adminRequired, (req, res) => {
  const { title, publishDate, cover, content, images, cn } = req.body;
  if (!title) return res.status(400).json({ error: '请输入标题' });
  const result = db.prepare(
    'INSERT INTO monthly_issues (title, publish_date, cover, content, images, author_id, cn) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(title, publishDate, cover, content, JSON.stringify(images || []), req.user.id, cn || '');
  res.json({ id: result.lastInsertRowid });
});

router.put('/:id', adminRequired, (req, res) => {
  const { title, publishDate, cover, content, images, cn } = req.body;
  const existing = db.prepare('SELECT * FROM monthly_issues WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: '月刊不存在' });
  db.prepare(
    'UPDATE monthly_issues SET title=?, publish_date=?, cover=?, content=?, images=?, cn=? WHERE id=?'
  ).run(
    title || existing.title,
    publishDate || existing.publish_date,
    cover !== undefined ? cover : existing.cover,
    content !== undefined ? content : existing.content,
    images !== undefined ? JSON.stringify(images) : existing.images,
    cn !== undefined ? cn : existing.cn,
    req.params.id
  );
  res.json({ ok: true });
});

router.delete('/:id', adminRequired, (req, res) => {
  db.prepare('DELETE FROM monthly_issues WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
