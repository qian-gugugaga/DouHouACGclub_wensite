const express = require('express');
const path = require('path');

const app = express();

// Parse JSON bodies (with increased limit for base64 images)
app.use(express.json({ limit: '50mb' }));

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Serve static frontend files
app.use(express.static(path.join(__dirname, 'public')));

// Initialize database (creates tables + admin account)
require('./db');

// API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/monthly', require('./routes/monthly'));
app.use('/api/fanworks', require('./routes/fanworks'));
app.use('/api/market', require('./routes/market'));
app.use('/api/guestbook', require('./routes/guestbook'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/activities', require('./routes/activities'));
app.use('/api/comments', require('./routes/comments'));
app.use('/api/upload', require('./routes/upload'));

// SPA fallback
app.use((req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('东方动漫社 · 神秘据点 服务端已启动: http://localhost:' + PORT);
});
