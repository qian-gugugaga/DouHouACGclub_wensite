const express = require('express');
const db = require('../db');
const { authRequired, adminRequired } = require('../middleware/auth');
const router = express.Router();

router.get('/', (req, res) => {
  const items = db.prepare("SELECT m.*, u.username as author_name, u.title as author_title FROM market_items m LEFT JOIN users u ON m.author_id = u.id WHERE m.status = 'approved' ORDER BY m.created_at DESC").all();
  res.json(items.map(s => ({ ...s, images: JSON.parse(s.images || '[]') })));
});

// Get current user's own items (all statuses)
router.get('/mine', authRequired, (req, res) => {
  const items = db.prepare("SELECT m.*, u.username as author_name, u.title as author_title FROM market_items m LEFT JOIN users u ON m.author_id = u.id WHERE m.author_id = ? ORDER BY m.created_at DESC").all(req.user.id);
  res.json(items.map(s => ({ ...s, images: JSON.parse(s.images || '[]') })));
});

router.post('/', authRequired, (req, res) => {
  const { title, price, qq, tag, ip, images, text } = req.body;
  if (!title) return res.status(400).json({ error: '请输入物品名称' });
  if (!price) return res.status(400).json({ error: '请输入价格' });
  if (!tag) return res.status(400).json({ error: '请选择物品类型' });
  if (!images || images.length === 0) return res.status(400).json({ error: '请上传图片' });
  const result = db.prepare(
    'INSERT INTO market_items (title, price, qq, tag, ip, images, text, author_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(title, price, qq || '', tag, ip || '', JSON.stringify(images), text || '', req.user.id);
  res.json({ id: result.lastInsertRowid });
});

router.get('/pending', adminRequired, (req, res) => {
  const items = db.prepare("SELECT m.*, u.username as author_name, u.title as author_title FROM market_items m LEFT JOIN users u ON m.author_id = u.id WHERE m.status = 'pending' ORDER BY m.created_at DESC").all();
  res.json(items.map(s => ({ ...s, images: JSON.parse(s.images || '[]') })));
});

router.put('/:id/approve', adminRequired, (req, res) => {
  db.prepare("UPDATE market_items SET status = 'approved' WHERE id = ?").run(req.params.id);
  const item = db.prepare('SELECT * FROM market_items WHERE id = ?').get(req.params.id);
  if (item) {
    db.prepare("INSERT INTO notifications (user_id, type, content, related_id) VALUES (?, 'approve', ?, ?)").run(item.author_id, '你的集市物品已通过审核', item.id);
  }
  res.json({ ok: true });
});

router.put('/:id/reject', adminRequired, (req, res) => {
  db.prepare("UPDATE market_items SET status = 'rejected' WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

// User delete own market item
router.delete('/:id', authRequired, (req, res) => {
  const item = db.prepare('SELECT * FROM market_items WHERE id = ? AND author_id = ?').get(req.params.id, req.user.id);
  if (!item) return res.status(404).json({ error: '物品不存在或无权删除' });
  db.prepare('DELETE FROM market_items WHERE id = ?').run(req.params.id);
  db.prepare('DELETE FROM comments WHERE target_type = ? AND target_id = ?').run('market', req.params.id);
  res.json({ ok: true });
});

module.exports = router;
