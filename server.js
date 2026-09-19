const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const FILE = path.join(DATA_DIR, 'menu.json');
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'cup2026';

app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

function readDB() {
  try {
    return JSON.parse(fs.readFileSync(FILE, 'utf8'));
  } catch (e) {
    return { title: 'ПИВО НА КРАНАХ', items: [] };
  }
}

function writeDB(db) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const temp = FILE + '.tmp';
  fs.writeFileSync(temp, JSON.stringify(db, null, 2), 'utf8');
  fs.renameSync(temp, FILE);
}

function auth(req, res, next) {
  const password = req.get('x-admin-password');

  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Неверный пароль' });
  }

  next();
}

app.get('/api/menu', (req, res) => {
  res.json(readDB());
});

app.put('/api/menu', auth, (req, res) => {
  const incoming = Array.isArray(req.body.items) ? req.body.items : [];

  const items = incoming.slice(0, 50).map(item => ({
    name: String(item.name || '').trim().slice(0, 80),
    price: Math.max(0, Number(item.price) || 0),
    status: ['sale', 'way', 'hidden'].includes(item.status)
      ? item.status
      : 'sale',
    new: Boolean(item.new)
  }));

  const db = {
    title: 'ПИВО НА КРАНАХ',
    items
  };

  writeDB(db);

  res.json({
    ok: true,
    items: db.items
  });
});

app.get('/health', (req, res) => {
  res.send('OK');
});

app.get('/screen', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`ЦУП запущен на порту ${PORT}`);
});
