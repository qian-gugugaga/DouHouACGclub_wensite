const express = require('express');
const path = require('path');
const fs = require('fs');
const { authRequired } = require('../middleware/auth');
const router = express.Router();

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

router.post('/', authRequired, (req, res) => {
  // Handle base64 image uploads
  const { images } = req.body;
  if (!images || !Array.isArray(images)) return res.status(400).json({ error: '请提供图片数据' });
  const saved = [];
  images.forEach((img, i) => {
    if (img && img.startsWith('data:image/')) {
      const ext = img.match(/data:image\/(\w+)/)?.[1] || 'png';
      const name = Date.now() + '_' + i + '.' + ext;
      const data = img.replace(/^data:image\/\w+;base64,/, '');
      fs.writeFileSync(path.join(UPLOAD_DIR, name), Buffer.from(data, 'base64'));
      saved.push('/uploads/' + name);
    }
  });
  res.json({ urls: saved });
});

module.exports = router;
