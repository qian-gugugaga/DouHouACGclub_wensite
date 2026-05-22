const express = require('express');
const { db } = require('../db');
const { authRequired } = require('../middleware/auth');
const router = express.Router();

// Get comments for a target (fanwork or market item)
router.get('/:targetType/:targetId', async (req, res) => {
  const { targetType, targetId } = req.params;
  const result = await db.execute(
    `SELECT c.*, u.username as author_name, u.title as author_title
     FROM comments c LEFT JOIN users u ON c.author_id = u.id
     WHERE c.target_type = ? AND c.target_id = ?
     ORDER BY c.created_at ASC`,
    [targetType, targetId]
  );
  res.json(result.rows);
});

// Add a comment
router.post('/', authRequired, async (req, res) => {
  const { targetType, targetId, text, parentId } = req.body;
  if (!text || !text.trim()) return res.status(400).json({ error: '请输入评论内容' });
  if (!targetType || !targetId) return res.status(400).json({ error: '缺少目标信息' });

  const result = await db.execute(
    'INSERT INTO comments (target_type, target_id, author_id, text, parent_id) VALUES (?, ?, ?, ?, ?)',
    [targetType, targetId, req.user.id, text.trim(), parentId || null]
  );

  // Notify the target author
  const table = targetType === 'fanwork' ? 'fanwork_submissions' : 'market_items';
  const targetResult = await db.execute(
    `SELECT author_id, text, title FROM ${table} WHERE id = ?`,
    [targetId]
  );
  const target = targetResult.rows[0];
  if (target && target.author_id !== req.user.id) {
    const snippet = (target.title || target.text || '').substring(0, 30);
    await db.execute(
      "INSERT INTO notifications (user_id, type, content, related_id) VALUES (?, 'comment', ?, ?)",
      [target.author_id, req.user.username + ' 评论了你的' + (targetType === 'fanwork' ? '创作' : '集市物品') + '「' + snippet + '」', targetId]
    );
  }

  // If replying to another comment, notify that comment author
  if (parentId) {
    const parentResult = await db.execute(
      'SELECT author_id FROM comments WHERE id = ?',
      [parentId]
    );
    const parent = parentResult.rows[0];
    if (parent && parent.author_id !== req.user.id) {
      await db.execute(
        "INSERT INTO notifications (user_id, type, content, related_id) VALUES (?, 'comment_reply', ?, ?)",
        [parent.author_id, req.user.username + ' 回复了你的评论', targetId]
      );
    }
  }

  res.json({ id: Number(result.lastInsertRowid) });
});

module.exports = router;
