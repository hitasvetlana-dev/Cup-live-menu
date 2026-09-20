const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

// Хранилище меню
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

// Количество позиций для каждой точки
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
        item?.name || ''
      ).trim(),

      price:
        Number(item?.price) || 0,

      available:
        item?.available !== false,

      new:
        item?.new === true
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
        : Array.isArray(data.items)
          ? data.items
          : [];

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

function saveStore(
  store,
  items
) {

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


// =======================
// ПРОВЕРКА СЕРВЕРА
// =======================

app.get(
  '/api/health',
  (req, res) => {

    res.json({
      ok: true,
      service:
        'ЦУП Live Menu'
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
          error:
            'Ошибка загрузки меню'
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
      req.body?.password ||
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
        : req.body?.items;

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
