const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Пароль берём из Render → Environment → ADMIN_PASSWORD
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Cup2026!';

// На Render используем папку /tmp.
// Для локального запуска — папку data.
const DATA_DIR = process.env.DATA_DIR || path.join('/tmp', 'cup-menu-data');

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

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function validStore(store) {
  return Object.prototype.hasOwnProperty.call(STORES, store);
}

function getFile(store) {
  return path.join(DATA_DIR, `${store}.json`);
}

function defaultItems() {
  return Array.from({ length: 14 }, () => ({
    name: '',
    price: 0,
    available: true,
    new: false
  }));
}

function normaliseItems(items) {
  if (!Array.isArray(items)) return [];

  return items.slice(0, 14).map(item => ({
    name: String(item?.name || '').trim(),
    price: Number(item?.price) || 0,
    available: item?.available !== false,
    new: item?.new === true
  }));
}

function loadStore(store) {
  ensureDataDir();

  const file = getFile(store);

  if (!fs.existsSync(file)) {
    return defaultItems();
  }

  try {
    const raw = fs.readFileSync(file, 'utf8');
    const data = JSON.parse(raw);

    const items = Array.isArray(data)
      ? data
      : Array.isArray(data.items)
        ? data.items
        : [];

    const result = normaliseItems(items);

    while (result.length < 14) {
      result.push({
        name: '',
        price: 0,
        available: true,
        new: false
      });
    }

    return result;
  } catch (error) {
    console.error('Ошибка чтения меню:', error);
    return defaultItems();
  }
}

function saveStore(store, items) {
  ensureDataDir();

  const file = getFile(store);
  const clean = normaliseItems(items);

  fs.writeFileSync(
    file,
    JSON.stringify({ items: clean }, null, 2),
    'utf8'
  );

  return clean;
}

// Проверка сервера
app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    service: 'ЦУП Live Menu'
  });
});

// Список точек
app.get('/api/stores', (req, res) => {
  res.json(STORES);
});

// Получить меню
app.get('/api/menu', (req, res) => {
  const store = String(req.query.store || '');

  if (!validStore(store)) {
    return res.status(400).json({
      ok: false,
      error: 'Неизвестная точка'
    });
  }

  const items = loadStore(store);

  res.set('Cache-Control', 'no-store');

  return res.json({
    ok: true,
    store,
    storeName: STORES[store],
    items
  });
});

// Сохранить меню
app.post('/api/menu', (req, res) => {
  const store = String(req.query.store || '');

  if (!validStore(store)) {
    return res.status(400).json({
      ok: false,
      error: 'Неизвестная точка'
    });
  }

  const password =
    req.get('x-admin-password') ||
    req.body?.password ||
    '';

  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({
      ok: false,
      error: 'Неверный пароль администратора'
    });
  }

  const items = Array.isArray(req.body)
    ? req.body
    : req.body?.items;

  if (!Array.isArray(items)) {
    return res.status(400).json({
      ok: false,
      error: 'Неверный формат меню'
    });
  }

  try {
    const saved = saveStore(store, items);

    console.log(
      `Меню сохранено: ${store}, позиций: ${saved.length}`
    );

    return res.json({
      ok: true,
      message: 'Меню сохранено',
      store,
      items: saved
    });

  } catch (error) {
    console.error('Ошибка сохранения:', error);

    return res.status(500).json({
      ok: false,
      error: 'Сервер не смог сохранить меню'
    });
  }
});

// Открытие главного меню
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`ЦУП Live Menu запущен на порту ${PORT}`);
});
