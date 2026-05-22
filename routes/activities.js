const express = require('express');
const db = require('../db');
const { authRequired, adminRequired } = require('../middleware/auth');
const router = express.Router();

// List all activities
router.get('/', (req, res) => {
  const activities = db.prepare('SELECT * FROM activities ORDER BY event_date DESC').all();
  res.json(activities);
});

// Get single activity
router.get('/:id', (req, res) => {
  const activity = db.prepare('SELECT * FROM activities WHERE id = ?').get(req.params.id);
  if (!activity) return res.status(404).json({ error: '活动不存在' });
  res.json(activity);
});

// Create activity (admin)
router.post('/', adminRequired, (req, res) => {
  const { title, eventDate, description, status, cover, cn } = req.body;
  if (!title || !eventDate) return res.status(400).json({ error: '标题和日期必填' });
  const result = db.prepare(
    'INSERT INTO activities (title, event_date, description, status, cover, cn) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(title, eventDate, description || '', status || 'upcoming', cover || '', cn || '');
  res.json({ id: result.lastInsertRowid });
});

// Update activity (admin)
router.put('/:id', adminRequired, (req, res) => {
  const { title, eventDate, description, status, cover, cn } = req.body;
  const existing = db.prepare('SELECT * FROM activities WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: '活动不存在' });
  db.prepare(
    'UPDATE activities SET title=?, event_date=?, description=?, status=?, cover=?, cn=? WHERE id=?'
  ).run(
    title || existing.title,
    eventDate || existing.event_date,
    description !== undefined ? description : existing.description,
    status || existing.status,
    cover !== undefined ? cover : existing.cover,
    cn !== undefined ? cn : existing.cn,
    req.params.id
  );
  res.json({ ok: true });
});

// Delete activity (admin)
router.delete('/:id', adminRequired, (req, res) => {
  db.prepare('DELETE FROM activities WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
