const express = require('express');
const { query } = require('../db');
const { authRequired } = require('../middleware/auth');
const router = express.Router();

router.get('/', authRequired, async (req, res) => {
  const notifications = (await query(
    'SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50',
    [req.user.id]
  )).rows;
  const unreadRow = (await query(
    'SELECT COUNT(*) as count FROM notifications WHERE user_id = $1 AND read = 0',
    [req.user.id]
  )).rows[0];
  res.json({ notifications, unreadCount: unreadRow.count });
});

router.put('/:id/read', authRequired, async (req, res) => {
  await query('UPDATE notifications SET read = 1 WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
  res.json({ ok: true });
});

router.put('/read-all', authRequired, async (req, res) => {
  await query('UPDATE notifications SET read = 1 WHERE user_id = $1', [req.user.id]);
  res.json({ ok: true });
});

module.exports = router;
