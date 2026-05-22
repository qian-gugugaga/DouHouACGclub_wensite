const { query } = require('../db');

async function authRequired(req, res, next) {
  const token = req.headers.authorization || req.query.token;
  if (!token) return res.status(401).json({ error: '请先登录' });
  const result = await query('SELECT user_id FROM sessions WHERE token = $1', [token]);
  const session = result.rows[0];
  if (!session) return res.status(401).json({ error: '登录已过期' });
  const userResult = await query('SELECT id, username, role FROM users WHERE id = $1', [session.user_id]);
  const user = userResult.rows[0];
  if (!user) return res.status(401).json({ error: '用户不存在' });
  req.user = user;
  next();
}

async function adminRequired(req, res, next) {
  await authRequired(req, res, async () => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: '需要管理员权限' });
    next();
  });
}

module.exports = { authRequired, adminRequired };
