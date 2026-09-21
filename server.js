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
  return Object.prototype.hasOwnProperty.call(
    STORES,
    store
  );
}

function getLimit(store) {
  return STORE_LIMITS[store] || 14;
}

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(
      DATA_DIR,
      { recursive: true }
    );
  }
}

function getFile(store) {
  return path.join(
    DATA_DIR,
    `${store}.json`
  );
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
    () => blankItem()
  );
}

function normaliseItems(store, items) {
  if (!Array.isArray(items)) {
    return [];
  }

  const limit = getLimit(store);

  return items
    .slice(0, limit)
    .map(item => ({
      name: String(
        (item && item.name) || ''
      ).trim(),

      price:
        Number(
          item && item.price
        ) || 0,

      available:
        !item ||
        item.available !== false,

      new:
        !!(
          item &&
          item.new === true
        )
    }));
}

function loadStore(store) {
  ensureDataDir();

  const file = getFile(store);

  if (!fs.existsSync(file)) {
    return defaultItems(store);
  }

  try {
    const raw =
      fs.readFileSync(
        file,
        'utf8'
      );

    const data =
      JSON.parse(raw);

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
      normaliseItems(
        store,
        source
      );

    const limit =
      getLimit(store);

    while (
      result.length < limit
    ) {
      result.push(
        blankItem()
      );
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

  const file =
    getFile(store);

  const clean =
    normaliseItems(
      store,
      items
    );

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

app.get(
  '/api/health',
  (req, res) => {
    res.json({
      ok: true,
      service: 'ЦУП Live Menu'
    });
  }
);


// =======================
// СПИСОК ТОЧЕК
// =======================

app.get(
  '/api/stores',
  (req, res) => {
    res.json(STORES);
  }
);


// =======================
// ПОЛУЧИТЬ МЕНЮ
// =======================

app.get(
  '/api/menu',
  (req, res) => {

    const store =
      String(
        req.query.store || ''
      );

    if (!validStore(store)) {
      return res
        .status(400)
        .json({
          ok: false,
          error: 'Неизвестная точка'
        });
    }

    try {
      const items =
        loadStore(store);

      res.set(
        'Cache-Control',
        'no-store, no-cache, must-revalidate'
      );

      return res.json({
        ok: true,
        store,
        storeName:
          STORES[store],
        limit:
          getLimit(store),
        items
      });

    } catch (error) {
      console.error(
        'Ошибка загрузки:',
        error
      );

      return res
        .status(500)
        .json({
          ok: false,
          error: 'Ошибка загрузки меню'
        });
    }
  }
);


// =======================
// СОХРАНИТЬ МЕНЮ
// =======================

app.post(
  '/api/menu',
  (req, res) => {

    const store =
      String(
        req.query.store || ''
      );

    if (!validStore(store)) {
      return res
        .status(400)
        .json({
          ok: false,
          error: 'Неизвестная точка'
        });
    }

    if (!ADMIN_PASSWORD) {
      return res
        .status(500)
        .json({
          ok: false,
          error:
            'Пароль администратора не настроен'
        });
    }

    const password =
      req.get(
        'x-admin-password'
      ) ||
      (
        req.body &&
        req.body.password
      ) ||
      '';

    if (
      password !==
      ADMIN_PASSWORD
    ) {
      return res
        .status(401)
        .json({
          ok: false,
          error:
            'Неверный пароль администратора'
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
      return res
        .status(400)
        .json({
          ok: false,
          error:
            'Неверный формат меню'
        });
    }

    try {
      const saved =
        saveStore(
          store,
          items
        );

      console.log(
        `Меню сохранено: ${store}, позиций: ${saved.length}`
      );

      return res.json({
        ok: true,
        message:
          'Меню сохранено',
        store,
        storeName:
          STORES[store],
        items: saved
      });

    } catch (error) {
      console.error(
        'Ошибка сохранения:',
        error
      );

      return res
        .status(500)
        .json({
          ok: false,
          error:
            'Сервер не смог сохранить меню'
        });
    }
  }
);


// =======================
// ТВ-МЕНЮ
// БЕЗ JAVASCRIPT НА ТВ
// =======================

app.get(
  '/tv',
  (req, res) => {

    let store =
      String(
        req.query.store || ''
      );

    if (!validStore(store)) {
      store =
        'yurga-stroitelnaya';
    }

    let screen =
      parseInt(
        req.query.screen,
        10
      );

    if (
      !screen ||
      screen < 1
    ) {
      screen = 1;
    }

    const allItems =
      loadStore(store)
        .filter(function(item) {
          return (
            item &&
            item.available !== false &&
            String(
              item.name || ''
            ).trim() !== ''
          );
        });

    // 14 позиций на один телевизор
    const ITEMS_PER_SCREEN = 14;

    const start =
      (screen - 1) *
      ITEMS_PER_SCREEN;

    const items =
      allItems.slice(
        start,
        start + ITEMS_PER_SCREEN
      );

    const half =
      Math.ceil(
        items.length / 2
      );

    const left =
      items.slice(
        0,
        half
      );

    const right =
      items.slice(
        half
      );

    function makeRows(list) {
      return list
        .map(function(item) {

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
                '<span class="ruble">₽</span>' +
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

<!-- Автоматически обновляем страницу раз в минуту -->
<meta http-equiv="refresh" content="60">

<title>ЦУП — Пивное меню</title>

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
  background: #000;
  color: #fff;
  font-family: Arial, Helvetica, sans-serif;
}

.page {
  position: relative;
  width: 100vw;
  height: 100vh;
  overflow: hidden;

  background-color: #000;

  background-image:
    url('/03BFD300-F622-4B6D-B466-26D615008FCD.png');

  background-repeat: no-repeat;
  background-position: center center;
  background-size: cover;
}

.header {
  position: absolute;
  left: 4.5%;
  right: 4.5%;
  top: 5%;
  height: 16%;
  border-bottom: 3px solid #ffc629;
}

.logo {
  position: absolute;
  left: 0;
  top: 0;
  color: #ffc629;
  font-size: 5.7vw;
  font-weight: bold;
  line-height: 1;
}

.subtitle {
  position: absolute;
  left: 17%;
  top: 18%;
  font-size: 2.1vw;
  font-weight: bold;
  letter-spacing: 0.08em;
}

.store-name {
  position: absolute;
  right: 0;
  top: 22%;
  font-size: 1.75vw;
  font-weight: bold;
  color: #d6d6d6;
  text-align: right;
}

.menu {
  position: absolute;
  left: 39%;
  right: 5%;
  top: 27%;
  bottom: 9%;
}

.column {
  position: absolute;
  top: 0;
  width: 47%;
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
  height: 8.1vh;
  border-bottom:
    1px solid rgba(255,255,255,0.20);
}

.item-name {
  position: absolute;
  left: 0;
  top: 50%;
  width: 72%;
  transform: translateY(-50%);
  font-size: 1.8vw;
  font-weight: bold;
  line-height: 1.05;
  color: #fff;
}

.item-price {
  position: absolute;
  right: 0;
  top: 50%;
  transform: translateY(-50%);
  color: #ffc629;
  font-size: 2.4vw;
  font-weight: bold;
  white-space: nowrap;
}

.ruble {
  font-size: 1.25vw;
  margin-left: 4px;
}

.new-badge {
  display: inline-block;
  margin-left: 8px;
  padding: 2px 6px;
  background: #ffc629;
  color: #000;
  font-size: 0.65vw;
  font-weight: bold;
  vertical-align: middle;
}

.empty {
  position: absolute;
  left: 39%;
  right: 5%;
  top: 48%;
  text-align: center;
  color: #aaa;
  font-size: 1.8vw;
  font-weight: bold;
}

.footer {
  position: absolute;
  right: 4.5%;
  bottom: 3%;
  color: rgba(255,255,255,0.70);
  font-size: 0.8vw;
  letter-spacing: 0.08em;
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

    <div class="store-name">
      ${escapeHtml(STORES[store])}
    </div>

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

  <div class="footer">
    ЦУП — БАР ДЛЯ СВОИХ
  </div>

</div>

</body>
</html>`
    );
  }
);


// =======================
// ГЛАВНАЯ СТРАНИЦА
// =======================

app.get(
  '/',
  (req, res) => {

    res.sendFile(
      path.join(
        __dirname,
        'public',
        'index.html'
      )
    );

  }
);


// =======================
// ЗАПУСК
// =======================

app.listen(
  PORT,
  '0.0.0.0',
  () => {

    console.log(
      `ЦУП Live Menu запущен на порту ${PORT}`
    );

  }
);
