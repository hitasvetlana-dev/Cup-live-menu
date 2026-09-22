const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

// =======================
// МАГАЗИНЫ
// =======================

const DATA_DIR =
  process.env.DATA_DIR ||
  path.join('/tmp', 'cup-menu-data');

const STORES = {
  'leninsk': 'Ленинск-Кузнецкий',
  'yurga-stroitelnaya': 'Юрга — Строительная',
  'yurga-kirpichnaya': 'Юрга — Кирпичная',
  'taiga': 'Тайга',
  'yashkino': 'Яшкино',
  'luna': 'Луна'
};

const STORE_LIMITS = {
  'leninsk': 14,
  'yurga-stroitelnaya': 42,
  'yurga-kirpichnaya': 14,
  'taiga': 14,
  'yashkino': 14,
  'luna': 14
};

app.use(express.json({ limit: '1mb' }));

app.use(
  express.static(
    path.join(__dirname, 'public')
  )
);

// =======================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// =======================

function validStore(store) {
  return Object.prototype.hasOwnProperty.call(STORES, store);
}

function getLimit(store) {
  return STORE_LIMITS[store] || 14;
}

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function getFile(store) {
  return path.join(DATA_DIR, store + '.json');
}

function blankItem() {
  return {
    name: '',
    price: 0,
    available: true,
    new: false
  };
}

function defaultItems(store) {
  const limit = getLimit(store);

  return Array.from(
    { length: limit },
    function () {
      return blankItem();
    }
  );
}

function normaliseItems(store, items) {
  if (!Array.isArray(items)) {
    return [];
  }

  const limit = getLimit(store);

  return items
    .slice(0, limit)
    .map(function (item) {
      return {
        name: String(
          (item && item.name) || ''
        ).trim(),

        price:
          Number(item && item.price) || 0,

        available:
          !item ||
          item.available !== false,

        new:
          !!(
            item &&
            item.new === true
          )
      };
    });
}

function loadStore(store) {
  ensureDataDir();

  const file = getFile(store);

  if (!fs.existsSync(file)) {
    return defaultItems(store);
  }

  try {
    const raw = fs.readFileSync(file, 'utf8');
    const data = JSON.parse(raw);

    const source =
      Array.isArray(data)
        ? data
        : (
            data &&
            Array.isArray(data.items)
              ? data.items
              : []
          );

    const result =
      normaliseItems(store, source);

    const limit = getLimit(store);

    while (result.length < limit) {
      result.push(blankItem());
    }

    return result;

  } catch (error) {
    console.error(
      'Ошибка чтения меню:',
      error
    );

    return defaultItems(store);
  }
}

function saveStore(store, items) {
  ensureDataDir();

  const file = getFile(store);

  const clean =
    normaliseItems(store, items);

  fs.writeFileSync(
    file,
    JSON.stringify(
      { items: clean },
      null,
      2
    ),
    'utf8'
  );

  return clean;
}

function escapeHtml(value) {
  return String(
    value == null ? '' : value
  )
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// =======================
// ПРОВЕРКА СЕРВЕРА
// =======================

app.get('/api/health', function (req, res) {
  res.json({
    ok: true,
    service: 'ЦУП Live Menu'
  });
});

// =======================
// СПИСОК ТОЧЕК
// =======================

app.get('/api/stores', function (req, res) {
  res.json(STORES);
});

// =======================
// ПОЛУЧИТЬ МЕНЮ
// =======================

app.get('/api/menu', function (req, res) {

  const store =
    String(req.query.store || '');

  if (!validStore(store)) {
    return res.status(400).json({
      ok: false,
      error: 'Неизвестная точка'
    });
  }

  try {
    const items = loadStore(store);

    res.set(
      'Cache-Control',
      'no-store, no-cache, must-revalidate'
    );

    return res.json({
      ok: true,
      store: store,
      storeName: STORES[store],
      limit: getLimit(store),
      items: items
    });

  } catch (error) {

    console.error(
      'Ошибка загрузки:',
      error
    );

    return res.status(500).json({
      ok: false,
      error: 'Ошибка загрузки меню'
    });
  }
});

// =======================
// СОХРАНИТЬ МЕНЮ
// =======================

app.post('/api/menu', function (req, res) {

  const store =
    String(req.query.store || '');

  if (!validStore(store)) {
    return res.status(400).json({
      ok: false,
      error: 'Неизвестная точка'
    });
  }

  if (!ADMIN_PASSWORD) {
    return res.status(500).json({
      ok: false,
      error: 'Пароль администратора не настроен'
    });
  }

  const password =
    req.get('x-admin-password') ||
    (
      req.body &&
      req.body.password
    ) ||
    '';

  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({
      ok: false,
      error: 'Неверный пароль администратора'
    });
  }

  const items =
    Array.isArray(req.body)
      ? req.body
      : (
          req.body &&
          req.body.items
        );

  if (!Array.isArray(items)) {
    return res.status(400).json({
      ok: false,
      error: 'Неверный формат меню'
    });
  }

  try {

    const saved =
      saveStore(store, items);

    console.log(
      'Меню сохранено: ' +
      store +
      ', позиций: ' +
      saved.length
    );

    return res.json({
      ok: true,
      message: 'Меню сохранено',
      store: store,
      storeName: STORES[store],
      items: saved
    });

  } catch (error) {

    console.error(
      'Ошибка сохранения:',
      error
    );

    return res.status(500).json({
      ok: false,
      error: 'Сервер не смог сохранить меню'
    });
  }
});

// =============================================
// ТВ-МЕНЮ
// 14 ПОЗИЦИЙ — 7 СЛЕВА + 7 СПРАВА
// БЕЗ JAVASCRIPT НА ТЕЛЕВИЗОРЕ
// =============================================

app.get('/tv', function (req, res) {

  let store =
    String(req.query.store || '');

  if (!validStore(store)) {
    store = 'yurga-stroitelnaya';
  }

  let screen =
    parseInt(req.query.screen, 10);

  if (!screen || screen < 1) {
    screen = 1;
  }

  const allItems =
    loadStore(store)
      .filter(function (item) {
        return (
          item &&
          item.available !== false &&
          String(item.name || '').trim() !== ''
        );
      });

  const ITEMS_PER_SCREEN = 14;

  const start =
    (screen - 1) *
    ITEMS_PER_SCREEN;

  const items =
    allItems.slice(
      start,
      start + ITEMS_PER_SCREEN
    );

  const left =
    items.slice(0, 7);

  const right =
    items.slice(7, 14);

  function makeRows(list) {

    return list
      .map(function (item) {

        const badge =
          item.new === true
            ? '<span class="new-badge">NEW</span>'
            : '';

        return (
          '<div class="item">' +

            '<div class="item-name">' +
              escapeHtml(item.name) +
              badge +
            '</div>' +

            '<div class="item-price">' +
              escapeHtml(item.price) +
              '<span class="ruble"> ₽</span>' +
            '</div>' +

          '</div>'
        );
      })
      .join('');
  }

  res.set(
    'Cache-Control',
    'no-store, no-cache, must-revalidate'
  );

  res.type('html');

  res.send(
`<!DOCTYPE html>
<html lang="ru">

<head>

<meta charset="UTF-8">

<meta
  http-equiv="refresh"
  content="60"
>

<title>
ЦУП — Пивное меню
</title>

<style>

* {
  box-sizing: border-box;
}

html,
body {
  margin: 0;
  padding: 0;

  width: 100%;
  height: 100%;

  overflow: hidden;

  background: #050505;

  color: #fff;

  font-family:
    Arial,
    Helvetica,
    sans-serif;
}

/* =========================
   ОСНОВНОЙ ЭКРАН
   ========================= */

.page {

  position: relative;

  width: 100vw;
  height: 100vh;

  overflow: hidden;

  background-color: #050505;

  background-image:
    linear-gradient(
      to bottom,
      rgba(0,0,0,0.30) 0%,
      rgba(0,0,0,0.72) 60%,
      rgba(0,0,0,0.20) 100%
    ),
    url('/03BFD300-F622-4B6D-B466-26D615008FCD.png');

  background-repeat: no-repeat;

  background-position:
    center center;

  background-size:
    cover;
}

/* дополнительное затемнение
   за ассортиментом */

.menu-background {

  position: absolute;

  left: 2.5%;
  right: 2.5%;

  top: 18%;
  height: 61%;

  background:
    rgba(3, 5, 7, 0.76);

  border-top:
    1px solid rgba(255,198,41,0.55);

  border-bottom:
    1px solid rgba(255,198,41,0.35);
}

/* =========================
   ШАПКА
   ========================= */

.header {

  position: absolute;

  left: 3.5%;
  right: 3.5%;

  top: 3%;

  height: 13%;

  border-bottom:
    3px solid #ffc629;
}

.logo {

  position: absolute;

  left: 0;
  top: 0;

  color: #ffc629;

  font-size: 5.2vw;

  font-weight: 900;

  line-height: 1;
}

.subtitle {

  position: absolute;

  left: 16%;

  top: 12%;

  color: #fff;

  font-size: 2.05vw;

  font-weight: 900;

  letter-spacing: 0.05em;
}

.slogan {

  position: absolute;

  left: 16%;

  top: 56%;

  color: #c9c9c9;

  font-size: 0.95vw;

  font-weight: 700;

  letter-spacing: 0.28em;
}

.store-name {

  position: absolute;

  right: 0;

  top: 16%;

  color: #fff;

  font-size: 1.75vw;

  font-weight: 900;

  text-align: right;
}

.store-line {

  position: absolute;

  right: 0;

  bottom: 18%;

  width: 25%;

  height: 4px;

  background: #ffc629;
}

/* =========================
   МЕНЮ
   ========================= */

.menu {

  position: absolute;

  left: 3.5%;
  right: 3.5%;

  top: 19.5%;

  height: 57%;
}

.column {

  position: absolute;

  top: 0;

  width: 47.5%;
}

.column-left {
  left: 0;
}

.column-right {
  right: 0;
}

.item {

  position: relative;

  width: 100%;

  height: 8vh;

  border-bottom:
    1px solid rgba(255,255,255,0.25);
}

.item-name {

  position: absolute;

  left: 0;

  top: 50%;

  width: 69%;

  transform:
    translateY(-50%);

  color: #fff;

  font-size: 2.25vw;

  font-weight: 900;

  line-height: 1.02;

  text-shadow:
    0 2px 4px rgba(0,0,0,0.95);
}

.item-price {

  position: absolute;

  right: 0;

  top: 50%;

  transform:
    translateY(-50%);

  color: #ffc629;

  font-size: 3.15vw;

  font-weight: 900;

  white-space: nowrap;

  text-shadow:
    0 2px 6px rgba(0,0,0,0.95);
}

.ruble {

  font-size: 1.65vw;

  font-weight: 900;
}

.new-badge {

  display: inline-block;

  margin-left: 10px;

  padding:
    4px 9px;

  background:
    #ffc629;

  color:
    #080808;

  font-size:
    0.75vw;

  font-weight:
    900;

  transform:
    rotate(-4deg);

  vertical-align:
    middle;
}

/* =========================
   НИЖНЯЯ ЗОНА
   ========================= */

.bottom-slogan {

  position: absolute;

  left: 48%;

  bottom: 8%;

  color: #fff;

  font-size: 2.1vw;

  font-weight: 800;

  font-style: italic;

  transform: rotate(-3deg);

  text-shadow:
    0 2px 7px #000;
}

.footer {

  position: absolute;

  right: 3.5%;

  bottom: 4%;

  color: #fff;

  font-size: 1.05vw;

  font-weight: 900;

  letter-spacing: 0.24em;

  border-bottom:
    4px solid #ffc629;

  padding-bottom:
    7px;
}

.empty {

  position: absolute;

  left: 10%;
  right: 10%;

  top: 43%;

  text-align: center;

  color: #fff;

  font-size: 3vw;

  font-weight: 900;
}

</style>

</head>

<body>

<div class="page">

  <div class="header">

    <div class="logo">
      ЦУП
    </div>

    <div class="subtitle">
      ПИВНОЙ БАР • МАРКЕТ
    </div>

    <div class="slogan">
      БОЛЬШЕ ЧЕМ ПРОСТО ПИВО
    </div>

    <div class="store-name">
      ${escapeHtml(STORES[store])}
    </div>

    <div class="store-line">
    </div>

  </div>

  <div class="menu-background">
  </div>

  ${
    items.length > 0
      ?
`<div class="menu">

  <div class="column column-left">
    ${makeRows(left)}
  </div>

  <div class="column column-right">
    ${makeRows(right)}
  </div>

</div>`
      :
`<div class="empty">
  Меню обновляется
</div>`
  }

  <div class="bottom-slogan">
    Пиво нашей орбиты!
  </div>

  <div class="footer">
    ЦУП — БАР ДЛЯ СВОИХ
  </div>

</div>

</body>

</html>`
  );
});

// =======================
// ГЛАВНАЯ СТРАНИЦА
// =======================

app.get('/', function (req, res) {

  res.sendFile(
    path.join(
      __dirname,
      'public',
      'index.html'
    )
  );

});

// =======================
// ЗАПУСК
// =======================

app.listen(
  PORT,
  '0.0.0.0',
  function () {

    console.log(
      'ЦУП Live Menu запущен на порту ' +
      PORT
    );

  }
);
