const express = require('express');
const { db } = require('../db');
const { authRequired, adminRequired } = require('../middleware/auth');
const router = express.Router();

// List all activities
router.get('/', async (req, res) => {
  const activities = (await db.execute('SELECT * FROM activities ORDER BY event_date DESC')).rows;
  res.json(activities);
});

// Get single activity
router.get('/:id', async (req, res) => {
  const activity = (await db.execute('SELECT * FROM activities WHERE id = ?', [req.params.id])).rows[0];
  if (!activity) return res.status(404).json({ error: '活动不存在' });
  res.json(activity);
});

// Create activity (admin)
router.post('/', adminRequired, async (req, res) => {
  const { title, eventDate, description, status, cover, cn } = req.body;
  if (!title || !eventDate) return res.status(400).json({ error: '标题和日期必填' });
  const result = await db.execute(
    'INSERT INTO activities (title, event_date, description, status, cover, cn) VALUES (?, ?, ?, ?, ?, ?)',
    [title, eventDate, description || '', status || 'upcoming', cover || '', cn || '']
  );
  res.json({ id: Number(result.lastInsertRowid) });
});

// Update activity (admin)
router.put('/:id', adminRequired, async (req, res) => {
  const { title, eventDate, description, status, cover, cn } = req.body;
  const existing = (await db.execute('SELECT * FROM activities WHERE id = ?', [req.params.id])).rows[0];
  if (!existing) return res.status(404).json({ error: '活动不存在' });
  await db.execute(
    'UPDATE activities SET title=?, event_date=?, description=?, status=?, cover=?, cn=? WHERE id=?',
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
  await db.execute('DELETE FROM activities WHERE id = ?', [req.params.id]);
  res.json({ ok: true });
});

module.exports = router;
