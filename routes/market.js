const express = require('express');
const { query } = require('../db');
const { authRequired, adminRequired } = require('../middleware/auth');
const router = express.Router();

router.get('/', async (req, res) => {
  const result = await query(
    "SELECT m.*, u.username as author_name, u.title as author_title FROM market_items m LEFT JOIN users u ON m.author_id = u.id WHERE m.status = 'approved' ORDER BY m.created_at DESC"
  );
  res.json(result.rows.map(s => ({ ...s, images: JSON.parse(s.images || '[]') })));
});

router.get('/mine', authRequired, async (req, res) => {
  const result = await query(
    "SELECT m.*, u.username as author_name, u.title as author_title FROM market_items m LEFT JOIN users u ON m.author_id = u.id WHERE m.author_id = $1 ORDER BY m.created_at DESC",
    [req.user.id]
  );
  res.json(result.rows.map(s => ({ ...s, images: JSON.parse(s.images || '[]') })));
});

router.post('/', authRequired, async (req, res) => {
  const { title, price, qq, tag, ip, images, text } = req.body;
  if (!title) return res.status(400).json({ error: '请输入物品名称' });
  if (!price) return res.status(400).json({ error: '请输入价格' });
  if (!tag) return res.status(400).json({ error: '请选择物品类型' });
  if (!images || images.length === 0) return res.status(400).json({ error: '请上传图片' });
  const result = await query(
    'INSERT INTO market_items (title, price, qq, tag, ip, images, text, author_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id',
    [title, price, qq || '', tag, ip || '', JSON.stringify(images), text || '', req.user.id]
  );
  res.json({ id: result.rows[0].id });
});

router.get('/pending', adminRequired, async (req, res) => {
  const result = await query(
    "SELECT m.*, u.username as author_name, u.title as author_title FROM market_items m LEFT JOIN users u ON m.author_id = u.id WHERE m.status = 'pending' ORDER BY m.created_at DESC"
  );
  res.json(result.rows.map(s => ({ ...s, images: JSON.parse(s.images || '[]') })));
});

router.put('/:id/approve', adminRequired, async (req, res) => {
  await query("UPDATE market_items SET status = 'approved' WHERE id = $1", [req.params.id]);
  const result = await query('SELECT * FROM market_items WHERE id = $1', [req.params.id]);
  const item = result.rows[0];
  if (item) {
    await query(
      "INSERT INTO notifications (user_id, type, content, related_id) VALUES ($1, 'approve', $2, $3)",
      [item.author_id, '你的集市物品已通过审核', item.id]
    );
  }
  res.json({ ok: true });
});

router.put('/:id/reject', adminRequired, async (req, res) => {
  await query("UPDATE market_items SET status = 'rejected' WHERE id = $1", [req.params.id]);
  res.json({ ok: true });
});

router.delete('/:id', authRequired, async (req, res) => {
  const result = await query('SELECT * FROM market_items WHERE id = $1 AND author_id = $2', [req.params.id, req.user.id]);
  if (!result.rows[0]) return res.status(404).json({ error: '物品不存在或无权删除' });
  await query('DELETE FROM market_items WHERE id = $1', [req.params.id]);
  await query('DELETE FROM comments WHERE target_type = $1 AND target_id = $2', ['market', req.params.id]);
  res.json({ ok: true });
});

module.exports = router;
