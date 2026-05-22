const express = require('express');
const { db } = require('../db');
const { authRequired } = require('../middleware/auth');
const router = express.Router();

router.get('/', authRequired, async (req, res) => {
  const notifications = (await db.execute(
    'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50',
    [req.user.id]
  )).rows;
  const unreadRow = (await db.execute(
    'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND read = 0',
    [req.user.id]
  )).rows[0];
  res.json({ notifications, unreadCount: unreadRow.count });
});

router.put('/:id/read', authRequired, async (req, res) => {
  await db.execute('UPDATE notifications SET read = 1 WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
  res.json({ ok: true });
});

router.put('/read-all', authRequired, async (req, res) => {
  await db.execute('UPDATE notifications SET read = 1 WHERE user_id = ?', [req.user.id]);
  res.json({ ok: true });
});

module.exports = router;
