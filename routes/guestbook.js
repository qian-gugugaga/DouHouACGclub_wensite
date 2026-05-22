const express = require('express');
const db = require('../db');
const { authRequired } = require('../middleware/auth');
const router = express.Router();

router.get('/', (req, res) => {
  const messages = db.prepare("SELECT g.*, u.username as author_name, u.title as author_title FROM guestbook_messages g LEFT JOIN users u ON g.author_id = u.id ORDER BY g.created_at DESC").all();
  const result = messages.map(m => {
    let replyTo = null;
    if (m.parent_id) {
      const parent = db.prepare('SELECT g.id, g.title, u.username FROM guestbook_messages g LEFT JOIN users u ON g.author_id = u.id WHERE g.id = ?').get(m.parent_id);
      if (parent) replyTo = { id: parent.id, title: parent.title, username: parent.username };
    }
    return { ...m, replyTo };
  });
  res.json(result);
});

// Get single thread with replies
router.get('/:id', (req, res) => {
  const thread = db.prepare("SELECT g.*, u.username as author_name, u.title as author_title FROM guestbook_messages g LEFT JOIN users u ON g.author_id = u.id WHERE g.id = ?").get(req.params.id);
  if (!thread) return res.status(404).json({ error: '帖子不存在' });
  const replies = db.prepare("SELECT g.*, u.username as author_name, u.title as author_title FROM guestbook_messages g LEFT JOIN users u ON g.author_id = u.id WHERE g.parent_id = ? ORDER BY g.created_at ASC").all(req.params.id);
  res.json({ thread, replies });
});

router.post('/', authRequired, (req, res) => {
  const { title, text, parentId } = req.body;
  if (!text || !text.trim()) return res.status(400).json({ error: '请输入内容' });
  if (!parentId && (!title || !title.trim())) return res.status(400).json({ error: '请输入标题' });
  const result = db.prepare('INSERT INTO guestbook_messages (author_id, title, text, parent_id) VALUES (?, ?, ?, ?)').run(req.user.id, title ? title.trim() : null, text.trim(), parentId || null);

  // If replying to someone, notify them
  if (parentId) {
    const parent = db.prepare('SELECT author_id, parent_id FROM guestbook_messages WHERE id = ?').get(parentId);
    if (parent && parent.author_id !== req.user.id) {
      // Find root thread ID for proper navigation
      let rootId = parentId;
      let current = parent;
      while (current && current.parent_id) {
        rootId = current.parent_id;
        current = db.prepare('SELECT id, parent_id FROM guestbook_messages WHERE id = ?').get(current.parent_id);
      }
      db.prepare("INSERT INTO notifications (user_id, type, content, related_id) VALUES (?, 'reply', ?, ?)").run(parent.author_id, req.user.username + ' 回复了你的帖子', rootId);
    }
  }

  res.json({ id: result.lastInsertRowid });
});

// User delete own post/thread (and its replies)
router.delete('/:id', authRequired, (req, res) => {
  const msg = db.prepare('SELECT * FROM guestbook_messages WHERE id = ? AND author_id = ?').get(req.params.id, req.user.id);
  if (!msg) return res.status(404).json({ error: '帖子不存在或无权删除' });
  // Delete all replies under this thread (if it's a thread) + the message itself
  function deleteDescendants(parentId) {
    const children = db.prepare('SELECT id FROM guestbook_messages WHERE parent_id = ?').all(parentId);
    children.forEach(function(c) { deleteDescendants(c.id); });
    db.prepare('DELETE FROM guestbook_messages WHERE id = ?').run(parentId);
  }
  deleteDescendants(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
