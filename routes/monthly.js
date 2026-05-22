const express = require('express');
const { db } = require('../db');
const { adminRequired } = require('../middleware/auth');
const router = express.Router();

router.get('/', async (req, res) => {
  const result = await db.execute('SELECT * FROM monthly_issues ORDER BY created_at DESC');
  res.json(result.rows.map(i => ({ ...i, images: JSON.parse(i.images || '[]') })));
});

router.post('/', adminRequired, async (req, res) => {
  const { title, publishDate, cover, content, images, cn } = req.body;
  if (!title) return res.status(400).json({ error: '请输入标题' });
  const result = await db.execute(
    'INSERT INTO monthly_issues (title, publish_date, cover, content, images, author_id, cn) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [title, publishDate, cover, content, JSON.stringify(images || []), req.user.id, cn || '']
  );
  res.json({ id: Number(result.lastInsertRowid) });
});

router.put('/:id', adminRequired, async (req, res) => {
  const { title, publishDate, cover, content, images, cn } = req.body;
  const existingResult = await db.execute('SELECT * FROM monthly_issues WHERE id = ?', [req.params.id]);
  const existing = existingResult.rows[0];
  if (!existing) return res.status(404).json({ error: '月刊不存在' });
  await db.execute(
    'UPDATE monthly_issues SET title=?, publish_date=?, cover=?, content=?, images=?, cn=? WHERE id=?',
    [
      title || existing.title,
      publishDate || existing.publish_date,
      cover !== undefined ? cover : existing.cover,
      content !== undefined ? content : existing.content,
      images !== undefined ? JSON.stringify(images) : existing.images,
      cn !== undefined ? cn : existing.cn,
      req.params.id
    ]
  );
  res.json({ ok: true });
});

router.delete('/:id', adminRequired, async (req, res) => {
  await db.execute('DELETE FROM monthly_issues WHERE id = ?', [req.params.id]);
  res.json({ ok: true });
});

module.exports = router;
