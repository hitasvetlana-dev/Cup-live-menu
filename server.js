const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'cup2026';

const STORES = {
  'leninsk': 'Ленинск-Кузнецкий',
  'yurga-stroitelnaya': 'Юрга — Строительная',
  'yurga-kirpichnaya': 'Юрга — Кирпичная',
  'taiga': 'Тайга',
  'yashkino': 'Яшкино',
  'luna': 'Луна'
};

app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

function valid(id) {
  return Object.prototype.hasOwnProperty.call(STORES, id);
}

function file(id) {
  return path.join(DATA_DIR, `menu-${id}.json`);
}

function defaultMenu() {
  return Array.from({ length: 14 }, (_, i) => ({
    name: i < 10 ? `Пиво ${i + 1}` : '',
    price: i < 10 ? 150 + i * 10 : 0,
    available: true,
    isNew: false
  }));
}

function readDB(id) {
  try {
    return JSON.parse(fs.readFileSync(file(id), 'utf8'));
  } catch (e) {
    return defaultMenu();
  }
}

function writeDB(id, db) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(file(id), JSON.stringify(db, null, 2));
}

function auth(req, res, next) {
  if (req.get('x-admin-password') !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Неверный пароль' });
  }
  next();
}

app.get('/api/menu/:store', (req, res) => {
  if (!valid(req.params.store)) {
    return res.status(404).json({ error: 'Точка не найдена' });
  }

  res.json({
    store: req.params.store,
    storeName: STORES[req.params.store],
    items: readDB(req.params.store)
  });
});

app.post('/api/menu/:store', auth, (req, res) => {
  if (!valid(req.params.store)) {
    return res.status(404).json({ error: 'Точка не найдена' });
  }

  const items = Array.isArray(req.body.items) ? req.body.items : req.body;

  if (!Array.isArray(items)) {
    return res.status(400).json({ error: 'Неверные данные' });
  }

  writeDB(req.params.store, items);
  res.json({ ok: true });
});

app.get('/admin/:store', (req, res) => {
  if (!valid(req.params.store)) {
    return res.status(404).send('Точка не найдена');
  }

  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/:store', (req, res, next) => {
  if (!valid(req.params.store)) return next();

  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/', (req, res) => {
  res.redirect('/leninsk');
});

app.listen(PORT, () => {
  console.log(`ЦУП запущен на порту ${PORT}`);
});
