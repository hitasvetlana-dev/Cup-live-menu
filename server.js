const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '1234';

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

function validStore(id) {
  return Object.prototype.hasOwnProperty.call(STORES, id);
}

function fileFor(id) {
  return path.join(DATA_DIR, `menu-${id}.json`);
}

function emptyMenu() {
  return Array.from({ length: 14 }, () => ({
    name: '',
    price: 0,
    status: 'available',
    isNew: false
  }));
}

function readMenu(id) {
  try {
    const file = fileFor(id);

    if (!fs.existsSync(file)) {
      return emptyMenu();
    }

    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    return emptyMenu();
  }
}

function writeMenu(id, menu) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(
    fileFor(id),
    JSON.stringify(menu, null, 2),
    'utf8'
  );
}

app.get('/api/menu/:store', (req, res) => {
  const id = req.params.store;

  if (!validStore(id)) {
    return res.status(404).json({ error: 'Точка не найдена' });
  }

  res.json({
    store: id,
    storeName: STORES[id],
    items: readMenu(id)
  });
});

app.post('/api/menu/:store', (req, res) => {
  const id = req.params.store;

  if (!validStore(id)) {
    return res.status(404).json({ error: 'Точка не найдена' });
  }

  const password =
    req.get('x-admin-password') ||
    req.body.password ||
    '';

  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Неверный пароль' });
  }

  const items = Array.isArray(req.body)
    ? req.body
    : req.body.items;

  if (!Array.isArray(items)) {
    return res.status(400).json({ error: 'Неверные данные меню' });
  }

  try {
    writeMenu(id, items);
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Ошибка сохранения' });
  }
});

app.get('/:store', (req, res, next) => {
  if (!validStore(req.params.store)) return next();

  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/admin/:store', (req, res, next) => {
  if (!validStore(req.params.store)) return next();

  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.listen(PORT, () => {
  console.log(`ЦУП запущен на порту ${PORT}`);
});
