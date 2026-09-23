const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

// =====================================================
// МАГАЗИНЫ
// =====================================================

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

app.use(
  express.json({
    limit: '1mb'
  })
);

app.use(
  express.static(
    path.join(__dirname, 'public')
  )
);

// =====================================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
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

function defaultItems(store) {

  const limit =
    getLimit(store);

  return Array.from(
    {
      length: limit
    },
    function () {
      return blankItem();
    }
  );
}

function normaliseItems(store, items) {

  if (!Array.isArray(items)) {
    return [];
  }

  const limit =
    getLimit(store);

  return items
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
}

function loadStore(store) {

  ensureDataDir();

  const file =
    getFile(store);

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

  while (
    clean.length <
    getLimit(store)
  ) {
    clean.push(
      blankItem()
    );
  }

  fs.writeFileSync(
    file,
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
// ПРОВЕРКА СЕРВЕРА
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
// СПИСОК МАГАЗИНОВ
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
          error:
            'Неизвестная точка'
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

        store:
          store,

        storeName:
          STORES[store],

        limit:
          getLimit(store),

        items:
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
          error:
            'Ошибка загрузки меню'
        });
    }
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

      console.log(
        'Меню сохранено: ' +
        store +
        ', позиций: ' +
        saved.length
      );

      return res.json({

        ok: true,

        message:
          'Меню сохранено',

        store:
          store,

        storeName:
          STORES[store],

        items:
          saved
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
// ТВ-МЕНЮ ЦУП
//
// 14 ПОЗИЦИЙ
// 7 СЛЕВА + 7 СПРАВА
//
// screen=1 -> позиции 1–14
// screen=2 -> позиции 15–28
// screen=3 -> позиции 29–42
//
// БЕЗ JAVASCRIPT НА ТЕЛЕВИЗОРЕ
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

    if (screen > 3) {
      screen = 3;
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

    const ITEMS_PER_SCREEN =
      14;

    const start =
      (screen - 1) *
      ITEMS_PER_SCREEN;

    const items =
      allItems.slice(
        start,
        start +
        ITEMS_PER_SCREEN
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

<title>
ЦУП — Пивное меню
</title>

<style>

* {
  box-sizing: border-box;
