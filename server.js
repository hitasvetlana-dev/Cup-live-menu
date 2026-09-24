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

app.use(express.json({ limit: '1mb' }));
app.use(express.static(PUBLIC_DIR));

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
    store + '.json'
  );
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

  const clean =
    items
      .slice(0, getLimit(store))
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

          abv:
            String(
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

  while (
    clean.length < getLimit(store)
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
    const data =
      JSON.parse(
        fs.readFileSync(
          file,
          'utf8'
        )
      );

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

app.get(
  '/api/health',
  function (req, res) {
    return res.json({
      ok: true,
      service: 'ЦУП Live Menu'
    });
  }
);

app.get(
  '/api/stores',
  function (req, res) {
    return res.json(
      STORES
    );
  }
);

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
          error:
            'Неизвестная точка'
        });
    }

    res.set(
      'Cache-Control',
      'no-store, no-cache, must-revalidate, max-age=0'
    );

    return res.json({
      ok: true,
      store: store,
      storeName:
        STORES[store],
      limit:
        getLimit(store),
      items:
        loadStore(store)
    });
  }
);

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
          error:
            'Неизвестная точка'
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

    const items =
      allItems.slice(
        (screen - 1) * 14,
        (screen - 1) * 14 + 14
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
              item.soon
                ? '<span class="soon-badge">СКОРО ПОДВЕЗУТ</span>'
                : (
                    item.new
                      ? '<span class="new-badge">NEW</span>'
                      : ''
                  );

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
    url('/8B5AE0DF-45B3-4244-A904-F2ABFA489704.png?v=20260924c')
    center center /
    100% 100%
    no-repeat;
}

.menu-shade {
  position: absolute;

  left: 0.4%;
  right: 0.4%;

  top: 11%;

  height: 71%;

  background:
    rgba(
      0,
      0,
      0,
      0.27
    );

  border-radius:
    18px;
}

.menu {
  position: absolute;

  left: 0.7%;
  right: 0.7%;

  top: 11.8%;

  height: 69.5%;
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

  top: 12.8%;

  height: 67%;

  width: 3px;

  background:
    rgba(
      255,
      198,
      41,
      0.90
    );

  transform:
    translateX(-50%);
}

.beer-row {
  position: relative;

  width: 100%;

  height: 14.2857%;

  background:
    rgba(
      0,
      0,
      0,
      0.24
    );

  border-bottom:
    2px solid
    rgba(
      255,
      255,
      255,
      0.18
    );
}

.beer-name {
  position: absolute;

  left: 1%;

  top: 50%;

  transform:
    translateY(-50%);

  width: 59%;

  color: #fff;

  font-size: 3.95vw;

  font-weight: 900;

  line-height: 1;

  white-space: nowrap;

  overflow: hidden;

  text-overflow: ellipsis;

  text-shadow:
    0 4px 10px #000,
    0 0 4px #000;
}

.beer-abv {
  position: absolute;

  right: 24%;

  top: 50%;

  transform:
    translateY(-50%);

  color: #e8e8e8;

  font-size: 2.35vw;

  font-weight: 800;

  white-space: nowrap;

  text-shadow:
    0 3px 8px #000;
}

.beer-price {
  position: absolute;

  right: 0.6%;

  top: 50%;

  transform:
    translateY(-50%);

  color: #ffc629;

  font-size: 4.55vw;

  font-weight: 900;

  line-height: 1;

  white-space: nowrap;

  text-align: right;

  text-shadow:
    0 4px 10px #000,
    0 0 4px #000;
}

.ruble {
  margin-left: 3px;

  font-size: 2.25vw;

  font-weight: 900;
}

.new-badge,
.soon-badge {
  display: inline-block;

  margin-left: 8px;

  padding:
    3px 7px;

  background: #ffc629;

  color: #000;

  font-weight: 900;

  vertical-align: middle;

  transform:
    rotate(-3deg);
}

.new-badge {
  font-size: 0.72vw;
}

.soon-badge {
  font-size: 0.62vw;

  letter-spacing:
    0.02em;
}

.empty {
  position: absolute;

  left: 28%;
  right: 28%;

  top: 38%;

  padding: 24px;

  background:
    rgba(
      0,
      0,
      0,
      0.82
    );

  border:
    2px solid
    #ffc629;

  color: #fff;

  text-align: center;

  font-size: 2.8vw;

  font-weight: 900;
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
