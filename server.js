// =====================================================
// ТВ-МЕНЮ ЦУП
// 14 ПОЗИЦИЙ: 7 СЛЕВА + 7 СПРАВА
// КРУПНЫЙ ТЕКСТ ПОВЕРХ НОВОГО ФОНА
// БЕЗ JAVASCRIPT НА ТЕЛЕВИЗОРЕ
// =====================================================

app.get('/tv', function (req, res) {

  var store = String(req.query.store || '');

  if (!validStore(store)) {
    store = 'yurga-stroitelnaya';
  }

  var screen = parseInt(req.query.screen, 10);

  if (!screen || screen < 1) {
    screen = 1;
  }

  var ITEMS_PER_SCREEN = 14;

  var allItems = loadStore(store).filter(function (item) {
    return (
      item &&
      item.available !== false &&
      String(item.name || '').trim() !== ''
    );
  });

  var start =
    (screen - 1) * ITEMS_PER_SCREEN;

  var items =
    allItems.slice(
      start,
      start + ITEMS_PER_SCREEN
    );

  var left =
    items.slice(0, 7);

  var right =
    items.slice(7, 14);

  function makeRows(list) {

    return list.map(function (item) {

      var badge = '';

      if (item.new === true) {
        badge =
          '<span class="new-badge">NEW</span>';
      }

      return (
        '<div class="beer-row">' +

          '<div class="beer-name">' +
            escapeHtml(item.name) +
            badge +
          '</div>' +

          '<div class="beer-price">' +
            escapeHtml(item.price) +
            '<span class="ruble">₽</span>' +
          '</div>' +

        '</div>'
      );

    }).join('');
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

/* ==========================================
   НОВЫЙ ФОН НА ВЕСЬ ЭКРАН
   ========================================== */

.screen {

  position: relative;

  width: 100vw;
  height: 100vh;

  overflow: hidden;

  background-color: #000;

  background-image:
    url('/8B5AE0DF-45B3-4244-A904-F2ABFA489704.png?v=500');

  background-repeat: no-repeat;

  background-position:
    center center;

  background-size:
    100% 100%;
}

/* ==========================================
   ОБЛАСТЬ МЕНЮ

   Ассортимент занимает почти весь экран.
   Космонавт остаётся маленьким внизу.
   ========================================== */

.menu {

  position: absolute;

  left: 2.2%;
  right: 2.2%;

  top: 13.5%;

  height: 66%;
}

/* ==========================================
   ДВА СТОЛБЦА
   ========================================== */

.column {

  position: absolute;

  top: 0;

  width: 48.2%;
  height: 100%;
}

.column-left {
  left: 0;
}

.column-right {
  right: 0;
}

/* ==========================================
   КАЖДАЯ СТРОКА
   ========================================== */

.beer-row {

  position: relative;

  width: 100%;

  height: 14.2857%;

  border-bottom:
    2px solid rgba(255,255,255,0.16);

  background:
    rgba(0,0,0,0.32);
}

/* ==========================================
   НАЗВАНИЕ ПИВА — ОЧЕНЬ КРУПНО
   ========================================== */

.beer-name {

  position: absolute;

  left: 2.5%;

  top: 50%;

  transform:
    translateY(-50%);

  width: 71%;

  color: #ffffff;

  font-size: 2.65vw;

  font-weight: 900;

  line-height: 1;

  white-space: nowrap;

  overflow: hidden;

  text-overflow: ellipsis;

  text-shadow:
    0 3px 8px #000,
    0 0 3px #000;
}

/* ==========================================
   ЦЕНА — ЕЩЁ КРУПНЕЕ
   ========================================== */

.beer-price {

  position: absolute;

  right: 2%;

  top: 50%;

  transform:
    translateY(-50%);

  color: #ffc629;

  font-size: 3.35vw;

  font-weight: 900;

  line-height: 1;

  white-space: nowrap;

  text-align: right;

  text-shadow:
    0 3px 8px #000,
    0 0 3px #000;
}

.ruble {

  margin-left: 5px;

  font-size: 1.8vw;

  font-weight: 900;
}

/* ==========================================
   NEW
   ========================================== */

.new-badge {

  display: inline-block;

  margin-left: 12px;

  padding:
    4px 9px;

  background:
    #ffc629;

  color:
    #000000;

  font-size:
    0.72vw;

  font-weight:
    900;

  vertical-align:
    middle;

  transform:
    rotate(-4deg);
}

/* ==========================================
   ЕСЛИ ПОЗИЦИЙ НЕТ
   ========================================== */

.empty {

  position: absolute;

  left: 25%;
  right: 25%;

  top: 38%;

  padding: 25px;

  background:
    rgba(0,0,0,0.82);

  border:
    2px solid #ffc629;

  color:
    #ffffff;

  text-align:
    center;

  font-size:
    2.6vw;

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
});
