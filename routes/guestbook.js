const express = require('express');
const { db } = require('../db');
const { authRequired } = require('../middleware/auth');
const router = express.Router();

router.get('/', async (req, res) => {
  const result = await db.execute("SELECT g.*, u.username as author_name, u.title as author_title FROM guestbook_messages g LEFT JOIN users u ON g.author_id = u.id ORDER BY g.created_at DESC");
  const messages = result.rows;
  const output = await Promise.all(messages.map(async (m) => {
    let replyTo = null;
    if (m.parent_id) {
      const parentResult = await db.execute('SELECT g.id, g.title, u.username FROM guestbook_messages g LEFT JOIN users u ON g.author_id = u.id WHERE g.id = ?', [m.parent_id]);
      const parent = parentResult.rows[0];
      if (parent) replyTo = { id: parent.id, title: parent.title, username: parent.username };
    }
    return { ...m, replyTo };
  }));
  res.json(output);
});

router.get('/:id', async (req, res) => {
  const threadResult = await db.execute("SELECT g.*, u.username as author_name, u.title as author_title FROM guestbook_messages g LEFT JOIN users u ON g.author_id = u.id WHERE g.id = ?", [req.params.id]);
  const thread = threadResult.rows[0];
  if (!thread) return res.status(404).json({ error: '帖子不存在' });
  const repliesResult = await db.execute("SELECT g.*, u.username as author_name, u.title as author_title FROM guestbook_messages g LEFT JOIN users u ON g.author_id = u.id WHERE g.parent_id = ? ORDER BY g.created_at ASC", [req.params.id]);
  res.json({ thread, replies: repliesResult.rows });
});

router.post('/', authRequired, async (req, res) => {
  const { title, text, parentId } = req.body;
  if (!text || !text.trim()) return res.status(400).json({ error: '请输入内容' });
  if (!parentId && (!title || !title.trim())) return res.status(400).json({ error: '请输入标题' });
  const result = await db.execute(
    'INSERT INTO guestbook_messages (author_id, title, text, parent_id) VALUES (?, ?, ?, ?)',
    [req.user.id, title ? title.trim() : null, text.trim(), parentId || null]
  );

  if (parentId) {
    const parentResult = await db.execute('SELECT author_id, parent_id FROM guestbook_messages WHERE id = ?', [parentId]);
    const parent = parentResult.rows[0];
    if (parent && parent.author_id !== req.user.id) {
      let rootId = parentId;
      let current = parent;
      while (current && current.parent_id) {
        rootId = current.parent_id;
        const nextResult = await db.execute('SELECT id, parent_id FROM guestbook_messages WHERE id = ?', [current.parent_id]);
        current = nextResult.rows[0];
      }
      await db.execute("INSERT INTO notifications (user_id, type, content, related_id) VALUES (?, 'reply', ?, ?)", [parent.author_id, req.user.username + ' 回复了你的帖子', rootId]);
    }
  }

  res.json({ id: Number(result.lastInsertRowid) });
});

router.delete('/:id', authRequired, async (req, res) => {
  const msgResult = await db.execute('SELECT * FROM guestbook_messages WHERE id = ? AND author_id = ?', [req.params.id, req.user.id]);
  if (!msgResult.rows[0]) return res.status(404).json({ error: '帖子不存在或无权删除' });

  async function deleteDescendants(parentId) {
    const childrenResult = await db.execute('SELECT id FROM guestbook_messages WHERE parent_id = ?', [parentId]);
    for (const c of childrenResult.rows) {
      await deleteDescendants(c.id);
    }
    await db.execute('DELETE FROM guestbook_messages WHERE id = ?', [parentId]);
  }
  await deleteDescendants(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
