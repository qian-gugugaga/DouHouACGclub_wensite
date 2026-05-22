const express = require('express');
const { query } = require('../db');
const { authRequired, adminRequired } = require('../middleware/auth');
const router = express.Router();

// List all activities
router.get('/', async (req, res) => {
  const result = await query('SELECT * FROM activities ORDER BY event_date DESC');
  res.json(result.rows);
});

// Get single activity
router.get('/:id', async (req, res) => {
  const result = await query('SELECT * FROM activities WHERE id = $1', [req.params.id]);
  const activity = result.rows[0];
  if (!activity) return res.status(404).json({ error: '活动不存在' });
  res.json(activity);
});

// Create activity (admin)
router.post('/', adminRequired, async (req, res) => {
  const { title, eventDate, description, status, cover, cn } = req.body;
  if (!title || !eventDate) return res.status(400).json({ error: '标题和日期必填' });
  const result = await query(
    'INSERT INTO activities (title, event_date, description, status, cover, cn) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
    [title, eventDate, description || '', status || 'upcoming', cover || '', cn || '']
  );
  res.json({ id: result.rows[0].id });
});

// Update activity (admin)
router.put('/:id', adminRequired, async (req, res) => {
  const { title, eventDate, description, status, cover, cn } = req.body;
  const existingResult = await query('SELECT * FROM activities WHERE id = $1', [req.params.id]);
  const existing = existingResult.rows[0];
  if (!existing) return res.status(404).json({ error: '活动不存在' });
  await query(
    'UPDATE activities SET title=$1, event_date=$2, description=$3, status=$4, cover=$5, cn=$6 WHERE id=$7',
    [
      title || existing.title,
      eventDate || existing.event_date,
      description !== undefined ? description : existing.description,
      status || existing.status,
      cover !== undefined ? cover : existing.cover,
      cn !== undefined ? cn : existing.cn,
      req.params.id
    ]
  );
  res.json({ ok: true });
});

// Delete activity (admin)
router.delete('/:id', adminRequired, async (req, res) => {
  await query('DELETE FROM activities WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
});

module.exports = router;
