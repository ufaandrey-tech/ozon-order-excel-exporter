# 🔍 Как заглянуть в код Ozon — пошаговая инструкция

## Шаг 1. Откройте страницу заказов

Перейдите на [https://www.ozon.ru/my/orderlist](https://www.ozon.ru/my/orderlist)

Убедитесь, что **видите список своих заказов** на странице.

---

## Шаг 2. Откройте инструменты разработчика (DevTools)

| Если у вас | Нажмите |
|---|---|
| **Яндекс Браузер** | `F12` или `Ctrl + Shift + I` |
| **Google Chrome** | `F12` или `Ctrl + Shift + I` |
| **Microsoft Edge** | `F12` или `Ctrl + Shift + I` |
| **Mozilla Firefox** | `F12` или `Ctrl + Shift + I` |

Справа/снизу откроется панель с кодом страницы.

---

## Шаг 3. Перейдите на вкладку «Console» (Консоль)

В панели DevTools наверху есть вкладки: **Elements**, **Console**, **Sources**, **Network** и т.д.

Нажмите **«Console»** (или «Консоль»).

---

## Шаг 4. Выполните команду №1 (главная)

**Скопируйте** этот текст полностью:

```js
console.log('=== НАЧАЛО ===');
document.querySelectorAll('div').forEach((el, i) => {
  const text = (el.textContent || '').trim();
  if (text.length > 50 && text.length < 2000 && el.children.length > 0) {
    const cls = el.className || '(без класса)';
    if (cls.length > 3 || cls.includes('order') || cls.includes('Order') || cls.includes('card') || cls.includes('Card') || cls.includes('item') || cls.includes('Item')) {
      console.log('БЛОК #' + i + ' | class: ' + cls + ' | текст: ' + text.slice(0, 250));
    }
  }
});
console.log('=== КОНЕЦ ===');
```

**Вставьте** в консоль (Ctrl+V) и нажмите **Enter**.

Скопируйте результат и пришлите его мне.

---

## Шаг 5 (дополнительный). Команда для точных селекторов

Выполните в консоли ещё и это:

```js
console.log('=== ССЫЛКИ ===');
document.querySelectorAll('a[href*="my/order"], a[href*="order/"]').forEach((a, i) => {
  console.log('Ссылка #' + i + ' | href: ' + a.href + ' | текст: ' + (a.textContent || '').trim().slice(0, 100));
});
console.log('=== ДАТЫ ===');
document.querySelectorAll('[class*="date"], [class*="Date"], time, [datetime]').forEach((el, i) => {
  console.log('Дата #' + i + ' | class: ' + (el.className || '') + ' | текст: ' + (el.textContent || '').trim().slice(0, 100));
});
console.log('=== ГОТОВО ===');
```

Результат тоже пришлите.

---

## Шаг 6. Я обновлю скрипт

На основе этих данных я **точно подберу селекторы** под вашу версию Ozon и скрипт заработает!
