const express = require('express');
const { query } = require('../db');
const { authRequired } = require('../middleware/auth');
const router = express.Router();

router.get('/', async (req, res) => {
  const result = await query(
    "SELECT g.*, u.username as author_name, u.title as author_title, u.avatar, (SELECT COUNT(*) FROM post_likes WHERE post_id = g.id) as likes FROM guestbook_messages g LEFT JOIN users u ON g.author_id = u.id ORDER BY g.created_at DESC"
  );
  const messages = result.rows;
  const output = await Promise.all(messages.map(async (m) => {
    let replyTo = null;
    if (m.parent_id) {
      const parentResult = await query(
        'SELECT g.id, g.title, u.username FROM guestbook_messages g LEFT JOIN users u ON g.author_id = u.id WHERE g.id = $1',
        [m.parent_id]
      );
      const parent = parentResult.rows[0];
      if (parent) replyTo = { id: parent.id, title: parent.title, username: parent.username };
    }
    return { ...m, images: JSON.parse(m.images || '[]'), replyTo };
  }));
  res.json(output);
});

router.get('/:id', async (req, res) => {
  const threadResult = await query(
    "SELECT g.*, u.username as author_name, u.title as author_title, u.avatar FROM guestbook_messages g LEFT JOIN users u ON g.author_id = u.id WHERE g.id = $1",
    [req.params.id]
  );
  const thread = threadResult.rows[0];
  if (!thread) return res.status(404).json({ error: '帖子不存在' });
  const repliesResult = await query(
    "SELECT g.*, u.username as author_name, u.title as author_title, u.avatar FROM guestbook_messages g LEFT JOIN users u ON g.author_id = u.id WHERE g.parent_id = $1 ORDER BY g.created_at ASC",
    [req.params.id]
  );
  res.json({ thread: { ...thread, images: JSON.parse(thread.images || '[]') }, replies: repliesResult.rows.map(r => ({ ...r, images: JSON.parse(r.images || '[]') })) });
});

router.post('/', authRequired, async (req, res) => {
  const { title, text, parentId, images } = req.body;
  if (!text || !text.trim()) return res.status(400).json({ error: '请输入内容' });
  if (!parentId && (!title || !title.trim())) return res.status(400).json({ error: '请输入标题' });
  const imgs = Array.isArray(images) ? images : [];
  if (parentId && imgs.length > 1) return res.status(400).json({ error: '回复仅可携带一张图片' });

  const result = await query(
    'INSERT INTO guestbook_messages (author_id, title, text, parent_id, images) VALUES ($1, $2, $3, $4, $5) RETURNING id',
    [req.user.id, title ? title.trim() : null, text.trim(), parentId || null, JSON.stringify(imgs)]
  );
  const newId = result.rows[0].id;

  if (parentId) {
    const parentResult = await query(
      'SELECT author_id, parent_id FROM guestbook_messages WHERE id = $1',
      [parentId]
    );
    const parent = parentResult.rows[0];
    if (parent && parent.author_id !== req.user.id) {
      let rootId = parentId;
      let current = parent;
      while (current && current.parent_id) {
        rootId = current.parent_id;
        const nextResult = await query(
          'SELECT id, parent_id FROM guestbook_messages WHERE id = $1',
          [current.parent_id]
        );
        current = nextResult.rows[0];
      }
      await query(
        "INSERT INTO notifications (user_id, type, content, related_id) VALUES ($1, 'reply', $2, $3)",
        [parent.author_id, req.user.username + ' 回复了你的帖子', rootId]
      );
    }
  }

  res.json({ id: newId });
});

router.delete('/:id', authRequired, async (req, res) => {
  const msgResult = await query(
    'SELECT * FROM guestbook_messages WHERE id = $1 AND author_id = $2',
    [req.params.id, req.user.id]
  );
  if (!msgResult.rows[0]) return res.status(404).json({ error: '帖子不存在或无权删除' });

  async function deleteDescendants(parentId) {
    const childrenResult = await query(
      'SELECT id FROM guestbook_messages WHERE parent_id = $1',
      [parentId]
    );
    for (const c of childrenResult.rows) {
      await deleteDescendants(c.id);
    }
    await query('DELETE FROM guestbook_messages WHERE id = $1', [parentId]);
  }
  await deleteDescendants(req.params.id);
  res.json({ ok: true });
});

// Like/unlike a post
router.post('/:id/like', authRequired, async (req, res) => {
  const postId = req.params.id;
  const existing = (await query(
    'SELECT id FROM post_likes WHERE user_id = $1 AND post_id = $2',
    [req.user.id, postId]
  )).rows[0];

  if (existing) {
    // Unlike
    await query('DELETE FROM post_likes WHERE id = $1', [existing.id]);
  } else {
    // Like
    await query(
      'INSERT INTO post_likes (user_id, post_id) VALUES ($1, $2)',
      [req.user.id, postId]
    );
    // Notify post author (skip self-likes)
    const post = (await query(
      'SELECT author_id, title FROM guestbook_messages WHERE id = $1', [postId]
    )).rows[0];
    if (post && post.author_id !== req.user.id) {
      const title = (post.title || '').substring(0, 20);
      await query(
        "INSERT INTO notifications (user_id, type, content, related_id) VALUES ($1, 'like', $2, $3)",
        [post.author_id, req.user.username + ' 赞了你的帖子「' + title + '」', postId]
      );
    }
  }

  const countRow = (await query(
    'SELECT COUNT(*) as c FROM post_likes WHERE post_id = $1',
    [postId]
  )).rows[0];
  res.json({ liked: !existing, likes: Number(countRow.c) });
});

module.exports = router;
