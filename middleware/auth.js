const db = require('../db');

function authRequired(req, res, next) {
  const token = req.headers.authorization || req.query.token;
  if (!token) return res.status(401).json({ error: '请先登录' });
  const session = db.prepare('SELECT user_id FROM sessions WHERE token = ?').get(token);
  if (!session) return res.status(401).json({ error: '登录已过期' });
  const user = db.prepare('SELECT id, username, role FROM users WHERE id = ?').get(session.user_id);
  if (!user) return res.status(401).json({ error: '用户不存在' });
  req.user = user;
  next();
}

function adminRequired(req, res, next) {
  authRequired(req, res, () => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: '需要管理员权限' });
    next();
  });
}

module.exports = { authRequired, adminRequired };
