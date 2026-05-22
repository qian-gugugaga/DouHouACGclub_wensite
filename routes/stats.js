const express = require('express');
const { query } = require('../db');
const { adminRequired } = require('../middleware/auth');
const router = express.Router();

// Public: get all site stats
router.get('/', async (_req, res) => {
  const rows = (await query('SELECT key, value FROM site_stats')).rows;
  const stats = {};
  rows.forEach(r => { stats[r.key] = r.value; });
  res.json(stats);
});

// Admin: update stats
router.put('/', adminRequired, async (req, res) => {
  const { stats } = req.body;
  if (!stats || typeof stats !== 'object') return res.status(400).json({ error: '请提供数据' });
  for (const [key, value] of Object.entries(stats)) {
    await query(
      'INSERT INTO site_stats (key, value, updated_at) VALUES ($1, $2, NOW()) ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()',
      [key, String(value)]
    );
  }
  res.json({ ok: true });
});

module.exports = router;
