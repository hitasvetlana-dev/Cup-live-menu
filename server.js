const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';

const DATA_DIR =
  process.env.DATA_DIR ||
  path.join('/tmp', 'cup-menu-data');

const PUBLIC_DIR =
  path.join(__dirname, 'public');

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

app.use(
  express.json({
    limit: '1mb'
  })
);

app.use(
  express.static(
    PUBLIC_DIR
  )
);

// =====================================================
// ФУНКЦИИ
// =====================================================

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
      {
        recursive: true
      }
    );
  }
}

function getFile(store) {
  return path.join(
    DATA_DIR,
    store + '.json'
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

function normaliseItems(store, items) {

  const limit =
    getLimit(store);

  if (!Array.isArray(items)) {
    items = [];
  }

  const clean =
    items
      .slice(0, limit)
      .map(function (item) {

        return {
          name:
            String(
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
        };
      });

  while (
    clean.length < limit
  ) {
    clean.push(
      blankItem()
    );
  }

  return clean;
}

function loadStore(store) {

  ensureDataDir();

  const file =
    getFile(store);

  if (!fs.existsSync(file)) {
    return normaliseItems(
      store,
      []
    );
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

    return normaliseItems(
      store,
      source
    );

  } catch (error) {

    console.error(
      'Ошибка чтения меню:',
      error
    );

    return normaliseItems(
      store,
      []
    );
  }
}

function saveStore(store, items) {

  ensureDataDir();

  const clean =
    normaliseItems(
      store,
      items
    );

  fs.writeFileSync(
    getFile(store),
    JSON.stringify(
      {
        items: clean
      },
      null,
      2
    ),
    'utf8'
  );

  return clean;
}

function escapeHtml(value) {

  return String(
    value == null
      ? ''
      : value
  )
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// =====================================================
// ПРОВЕРКА
// =====================================================

app.get(
  '/api/health',
  function (req, res) {

    return res.json({
      ok: true,
      service: 'ЦУП Live Menu'
    });
  }
);

// =====================================================
// МАГАЗИНЫ
// =====================================================

app.get(
  '/api/stores',
  function (req, res) {

    return res.json(
      STORES
    );
  }
);

// =====================================================
// ПОЛУЧИТЬ МЕНЮ
// =====================================================

app.get(
  '/api/menu',
  function (req, res) {

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

    res.set(
      'Cache-Control',
      'no-store, no-cache, must-revalidate, max-age=0'
    );

    return res.json({
      ok: true,
      store: store,
      storeName: STORES[store],
      limit: getLimit(store),
      items: loadStore(store)
    });
  }
);

// =====================================================
// СОХРАНИТЬ МЕНЮ
// =====================================================

app.post(
  '/api/menu',
  function (req, res) {

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

      return res.json({
        ok: true,
        message:
          'Меню сохранено',
        store: store,
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

// =====================================================
// ТВ-МЕНЮ
// 14 ПОЗИЦИЙ НА ЭКРАН
// 7 СЛЕВА + 7 СПРАВА
// =====================================================

app.get(
  '/tv',
  function (req, res) {

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

    const maxScreens =
      Math.max(
        1,
        Math.ceil(
          getLimit(store) / 14
        )
      );

    if (
      screen > maxScreens
    ) {
      screen =
        maxScreens;
    }

    const allItems =
      loadStore(store)
        .filter(
          function (item) {

            return (
              item &&
              item.available !== false &&
              String(
                item.name || ''
              ).trim() !== ''
            );
          }
        );

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
      items.slice(
        0,
        7
      );

    const right =
      items.slice(
        7,
        14
      );

    function makeRows(list) {

      return list
        .map(
          function (item) {

            const badge =
              item.new === true
                ? '<span class="new-badge">NEW</span>'
                : '';

            return (
              '<div class="beer-row">' +

                '<div class="beer-name">' +
                  escapeHtml(
                    item.name
                  ) +
                  badge +
                '</div>' +

                '<div class="beer-price">' +
                  escapeHtml(
                    item.price
                  ) +
                  '<span class="ruble">₽</span>' +
                '</div>' +

              '</div>'
            );
          }
        )
        .join('');
    }

    res.set(
      'Cache-Control',
      'no-store, no-cache, must-revalidate, max-age=0'
    );

    res.type(
      'html'
    );

    return res.send(
`<!DOCTYPE html>
<html lang="ru">

<head>

<meta charset="UTF-8">

<meta
  name="viewport"
  content="width=device-width, initial-scale=1.0"
>

<meta
  http-equiv="refresh"
  content="60"
>

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

  font-family:
    Arial,
    Helvetica,
    sans-serif;
}

/* ======================================
   ФОН
   ====================================== */

.screen {

  position: relative;

  width: 100vw;
  height: 100vh;

  overflow: hidden;

  background-color: #000;

  background-image:
    url('/8B5AE0DF-45B3-4244-A904-F2ABFA489704.png?v=20260924');

  background-repeat:
    no-repeat;

  background-position:
    center center;

  background-size:
    100% 100%;
}

/* ======================================
   ЗАТЕМНЕНИЕ ПОД АССОРТИМЕНТОМ
   ====================================== */

.menu-shade {

  position: absolute;

  left: 0.8%;
  right: 0.8%;

  top: 12.2%;

  height: 68.5%;

  background:
    rgba(0,0,0,0.25);

  border-radius:
    18px;
}

/* ======================================
   МЕНЮ
   ====================================== */

.menu {

  position: absolute;

  left: 1.3%;
  right: 1.3%;

  top: 13%;

  height: 67%;
}

/* ======================================
   ДВЕ КОЛОНКИ
   ====================================== */

.column {

  position: absolute;

  top: 0;

  width: 48.8%;
  height: 100%;
}

.column-left {
  left: 0;
}

.column-right {
  right: 0;
}

/* ======================================
   ЦЕНТРАЛЬНАЯ ЛИНИЯ
   ====================================== */

.center-line {

  position: absolute;

  left: 50%;

  top: 14%;

  height: 64%;

  width: 3px;

  background:
    rgba(
      255,
      198,
      41,
      0.85
    );

  transform:
    translateX(-50%);
}

/* ======================================
   СТРОКА
   ====================================== */

.beer-row {

  position: relative;

  width: 100%;

  height: 14.2857%;

  background:
    rgba(0,0,0,0.30);

  border-bottom:
    2px solid
    rgba(
      255,
      255,
      255,
      0.17
    );
}

/* ======================================
   НАЗВАНИЕ — ЕЩЁ КРУПНЕЕ
   ====================================== */

.beer-name {

  position: absolute;

  left: 1.6%;

  top: 50%;

  transform:
    translateY(-50%);

  width: 72%;

  color:
    #ffffff;

  font-size:
    3.4vw;

  font-weight:
    900;

  line-height:
    1;

  white-space:
    nowrap;

  overflow:
    hidden;

  text-overflow:
    ellipsis;

  text-shadow:
    0 4px 9px #000,
    0 0 4px #000;
}

/* ======================================
   ЦЕНА — ЕЩЁ КРУПНЕЕ
   ====================================== */

.beer-price {

  position: absolute;

  right: 1%;

  top: 50%;

  transform:
    translateY(-50%);

  color:
    #ffc629;

  font-size:
    4.2vw;

  font-weight:
    900;

  line-height:
    1;

  white-space:
    nowrap;

  text-align:
    right;

  text-shadow:
    0 4px 9px #000,
    0 0 4px #000;
}

.ruble {

  margin-left:
    5px;

  font-size:
    2.1vw;

  font-weight:
    900;
}

/* ======================================
   NEW
   ====================================== */

.new-badge {

  display:
    inline-block;

  margin-left:
    8px;

  padding:
    3px 7px;

  background:
    #ffc629;

  color:
    #000;

  font-size:
    0.75vw;

  font-weight:
    900;

  vertical-align:
    middle;

  transform:
    rotate(-4deg);
}

/* ======================================
   ЕСЛИ МЕНЮ ПУСТО
   ====================================== */

.empty {

  position: absolute;

  left: 28%;
  right: 28%;

  top: 38%;

  padding:
    24px;

  background:
    rgba(0,0,0,0.82);

  border:
    2px solid
    #ffc629;

  color:
    #fff;

  text-align:
    center;

  font-size:
    2.8vw;

  font-weight:
    900;
}

</style>

</head>

<body>

<div class="screen">

  ${
    items.length > 0
      ? `
        <div class="menu-shade">
        </div>

        <div class="center-line">
        </div>

        <div class="menu">

          <div class="column column-left">
            ${makeRows(left)}
          </div>

          <div class="column column-right">
            ${makeRows(right)}
          </div>

        </div>
      `
      : `
        <div class="empty">
          Меню обновляется
        </div>
      `
  }

</div>

</body>

</html>`
    );
  }
);

// =====================================================
// ГЛАВНАЯ
// =====================================================

app.get(
  '/',
  function (req, res) {

    return res.sendFile(
      path.join(
        __dirname,
        'public',
        'index.html'
      )
    );
  }
);

// =====================================================
// ЗАПУСК
// =====================================================

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
