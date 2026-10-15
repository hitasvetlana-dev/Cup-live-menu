const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();

const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';

const PUBLIC_DIR = path.join(__dirname, 'public');

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
  'leninsk': 18,
  'yurga-stroitelnaya': 54,
  'yurga-kirpichnaya': 18,
  'taiga': 18,
  'yashkino': 18,
  'luna': 18
};

app.use(express.json({ limit: '1mb' }));
app.use(express.static(PUBLIC_DIR));

function validStore(store) {
  return Object.prototype.hasOwnProperty.call(STORES, store);
}

function getLimit(store) {
  return STORE_LIMITS[store] || 18;
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
    abv: '',
    available: true,
    new: false,
    soon: false
  };
}

function normaliseItems(store, items) {
  if (!Array.isArray(items)) {
    items = [];
  }

  const limit = getLimit(store);

  const clean = items
    .slice(0, limit)
    .map(function (item) {
      return {
        name: String(
          (item && item.name) || ''
        ).trim(),

        price: Number(
          item && item.price
        ) || 0,

        abv: String(
          (item && item.abv) || ''
        )
          .replace('%', '')
          .trim(),

        available:
          !item ||
          item.available !== false,

        new:
          !!(
            item &&
            item.new === true
          ),

        soon:
          !!(
            item &&
            item.soon === true
          )
      };
    });

  while (clean.length < limit) {
    clean.push(blankItem());
  }

  return clean;
}

function loadStore(store) {
  ensureDataDir();

  const file = getFile(store);

  if (!fs.existsSync(file)) {
    return normaliseItems(store, []);
  }

  try {
    const raw =
      fs.readFileSync(file, 'utf8');

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

/* =========================
   ПРОВЕРКА
   ========================= */

app.get(
  '/api/health',
  function (req, res) {
    return res.json({
      ok: true,
      service: 'ЦУП Live Menu'
    });
  }
);

/* =========================
   СПИСОК ТОЧЕК
   ========================= */

app.get(
  '/api/stores',
  function (req, res) {
    return res.json(STORES);
  }
);

/* =========================
   ПОЛУЧИТЬ МЕНЮ
   ========================= */

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

/* =========================
   СОХРАНИТЬ МЕНЮ
   ========================= */

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
      req.get('x-admin-password') ||
      (
        req.body &&
        req.body.password
      ) ||
      '';

    if (password !== ADMIN_PASSWORD) {
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
        storeName: STORES[store],
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
            'Не удалось сохранить меню'
        });
    }
  }
);

/* =========================
   ТВ МЕНЮ

   ТВ 1 = 1–18
   ТВ 2 = 19–36
   ТВ 3 = 37–54

   9 слева + 9 справа
   ========================= */

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

    if (!screen || screen < 1) {
      screen = 1;
    }

    const ITEMS_PER_SCREEN = 18;
    const ITEMS_PER_COLUMN = 9;

    const maxScreens =
      Math.max(
        1,
        Math.ceil(
          getLimit(store) /
          ITEMS_PER_SCREEN
        )
      );

    if (screen > maxScreens) {
      screen = maxScreens;
    }

    const allItems =
      loadStore(store);

    const start =
      (screen - 1) *
      ITEMS_PER_SCREEN;

    const items =
      allItems.slice(
        start,
        start + ITEMS_PER_SCREEN
      );

    while (
      items.length <
      ITEMS_PER_SCREEN
    ) {
      items.push(
        blankItem()
      );
    }

    const left =
      items.slice(
        0,
        ITEMS_PER_COLUMN
      );

    const right =
      items.slice(
        ITEMS_PER_COLUMN,
        ITEMS_PER_SCREEN
      );

    function makeRows(list) {
      return list
        .map(function (item) {

          const visible =
            item &&
            item.available !== false &&
            String(
              item.name || ''
            ).trim() !== '';

          if (!visible) {
            return (
              '<div class="beer-row empty-row"></div>'
            );
          }

          let badge = '';

          if (item.soon === true) {
            badge =
              '<span class="soon-badge">СКОРО ПОДВЕЗУТ</span>';
          } else if (
            item.new === true
          ) {
            badge =
              '<span class="new-badge">NEW</span>';
          }

          const abv =
            item.abv
              ? (
                  '<span class="beer-abv">' +
                  escapeHtml(item.abv) +
                  '%</span>'
                )
              : '';

          return (
            '<div class="beer-row">' +

              '<div class="beer-name">' +
                escapeHtml(item.name) +
                badge +
              '</div>' +

              abv +

              '<div class="beer-price">' +
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
      'no-store, no-cache, must-revalidate, max-age=0'
    );

    res.type('html');

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

.screen {
  position: relative;

  width: 100vw;
  height: 100vh;

  overflow: hidden;

  background:
    #000
    url('/8B5AE0DF-45B3-4244-A904-F2ABFA489704.png?v=20261015')
    center center /
    100% 100%
    no-repeat;
}

.menu-shade {
  position: absolute;

  left: 0.4%;
  right: 0.4%;

  top: 10.7%;

  height: 72.5%;

  background:
    rgba(0,0,0,0.29);

  border-radius:
    16px;
}

.menu {
  position: absolute;

  left: 0.7%;
  right: 0.7%;

  top: 11.4%;

  height: 71%;
}

.column {
  position: absolute;

  top: 0;

  width: 49.1%;
  height: 100%;
}

.column-left {
  left: 0;
}

.column-right {
  right: 0;
}

.center-line {
  position: absolute;

  left: 50%;

  top: 12%;

  height: 69%;

  width: 3px;

  background:
    rgba(255,198,41,0.92);

  transform:
    translateX(-50%);
}

.beer-row {
  position: relative;

  width: 100%;

  height: 11.1111%;

  background:
    rgba(0,0,0,0.24);

  border-bottom:
    1px solid
    rgba(255,255,255,0.19);
}

.empty-row {
  background:
    rgba(0,0,0,0.12);
}

.beer-name {
  position: absolute;

  left: 1%;

  top: 50%;

  transform:
    translateY(-50%);

  width: 60%;

  color: #fff;

  font-size: 3.2vw;

  font-weight: 900;

  line-height: 1;

  white-space: nowrap;

  overflow: hidden;

  text-overflow: ellipsis;

  text-shadow:
    0 4px 9px #000,
    0 0 4px #000;
}

.beer-abv {
  position: absolute;

  right: 23%;

  top: 50%;

  transform:
    translateY(-50%);

  color: #eeeeee;

  font-size: 1.85vw;

  font-weight: 900;

  white-space: nowrap;

  text-shadow:
    0 3px 7px #000;
}

.beer-price {
  position: absolute;

  right: 0.6%;

  top: 50%;

  transform:
    translateY(-50%);

  color: #ffc629;

  font-size: 3.8vw;

  font-weight: 900;

  line-height: 1;

  white-space: nowrap;

  text-align: right;

  text-shadow:
    0 4px 9px #000,
    0 0 4px #000;
}

.ruble {
  margin-left: 3px;

  font-size: 1.85vw;

  font-weight: 900;
}

.new-badge,
.soon-badge {
  display: inline-block;

  margin-left: 6px;

  padding:
    2px 5px;

  background: #ffc629;

  color: #000;

  font-weight: 900;

  vertical-align: middle;

  transform:
    rotate(-3deg);
}

.new-badge {
  font-size: 0.62vw;
}

.soon-badge {
  font-size: 0.50vw;
}

</style>

</head>

<body>

<div class="screen">

  <div class="menu-shade"></div>

  <div class="center-line"></div>

  <div class="menu">

    <div class="column column-left">
      ${makeRows(left)}
    </div>

    <div class="column column-right">
      ${makeRows(right)}
    </div>

  </div>

</div>

</body>

</html>`
    );
  }
);

/* =========================
   ГЛАВНАЯ
   ========================= */

app.get(
  '/',
  function (req, res) {
    return res.sendFile(
      path.join(
        PUBLIC_DIR,
        'index.html'
      )
    );
  }
);

/* =========================
   ЗАПУСК
   ========================= */

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
