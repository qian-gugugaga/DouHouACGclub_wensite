const express = require('express');
const { query } = require('../db');
const { adminRequired } = require('../middleware/auth');
const router = express.Router();

router.get('/', async (req, res) => {
  const result = await query('SELECT * FROM monthly_issues ORDER BY created_at DESC');
  res.json(result.rows.map(i => ({ ...i, images: JSON.parse(i.images || '[]') })));
});

router.post('/', adminRequired, async (req, res) => {
  const { title, publishDate, cover, content, images, cn } = req.body;
  if (!title) return res.status(400).json({ error: '请输入标题' });
  const result = await query(
    'INSERT INTO monthly_issues (title, publish_date, cover, content, images, author_id, cn) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id',
    [title, publishDate, cover, content, JSON.stringify(images || []), req.user.id, cn || '']
  );
  res.json({ id: result.rows[0].id });
});

router.put('/:id', adminRequired, async (req, res) => {
  const { title, publishDate, cover, content, images, cn } = req.body;
  const existingResult = await query('SELECT * FROM monthly_issues WHERE id = $1', [req.params.id]);
  const existing = existingResult.rows[0];
  if (!existing) return res.status(404).json({ error: '月刊不存在' });
  await query(
    'UPDATE monthly_issues SET title=$1, publish_date=$2, cover=$3, content=$4, images=$5, cn=$6 WHERE id=$7',
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
  await query('DELETE FROM monthly_issues WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
});

module.exports = router;
